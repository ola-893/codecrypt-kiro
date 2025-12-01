# Post-Resurrection Validation Design

## Overview

The Post-Resurrection Validation system implements an iterative "fix until it works" approach to resurrection. Rather than attempting to predict all issues upfront, it embraces the reality that resurrection is messy and uses actual compilation failures to drive targeted fixes. The system runs in a loop: compile → analyze errors → apply fix → retry, continuing until compilation succeeds or max iterations is reached.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Resurrection Orchestrator                     │
│                    (existing component)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Post-Resurrection Validator                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Compilation │  │   Error     │  │    Fix Strategy         │ │
│  │   Runner    │──│  Analyzer   │──│      Engine             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│         │                │                    │                 │
│         ▼                ▼                    ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Compilation │  │   Error     │  │    Fix History          │ │
│  │    Proof    │  │  Patterns   │  │      Store              │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Event Emitter                               │
│              (progress, errors, fixes, summary)                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### PostResurrectionValidator

Main orchestrator for the validation loop.

```typescript
interface PostResurrectionValidator {
  validate(repoPath: string, options?: ValidationOptions): Promise<ValidationResult>;
  getFixHistory(repoPath: string): FixHistory;
}

interface ValidationOptions {
  maxIterations?: number;        // Default: 10
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'auto';
  buildCommand?: string;         // Override auto-detection
  skipNativeModules?: boolean;   // Skip native module fixes
}

interface ValidationResult {
  success: boolean;
  iterations: number;
  compilationProof?: CompilationProof;
  appliedFixes: AppliedFix[];
  remainingErrors: AnalyzedError[];
  duration: number;
}
```

### CompilationRunner

Executes build commands and captures output.

```typescript
interface CompilationRunner {
  compile(repoPath: string, options: CompileOptions): Promise<CompilationResult>;
  detectBuildCommand(packageJson: PackageJson): string;
  detectPackageManager(repoPath: string): 'npm' | 'yarn' | 'pnpm';
}

interface CompileOptions {
  packageManager: 'npm' | 'yarn' | 'pnpm';
  buildCommand: string;
  timeout?: number;
}

interface CompilationResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

interface CompilationProof {
  timestamp: Date;
  buildCommand: string;
  exitCode: number;
  duration: number;
  outputHash: string;
}
```

### ErrorAnalyzer

Parses compilation errors and categorizes them.

```typescript
interface ErrorAnalyzer {
  analyze(compilationResult: CompilationResult): AnalyzedError[];
  categorize(errorMessage: string): ErrorCategory;
  extractPackageInfo(error: AnalyzedError): PackageInfo | null;
  prioritize(errors: AnalyzedError[]): AnalyzedError[];
}

type ErrorCategory = 
  | 'dependency_not_found'
  | 'dependency_version_conflict'
  | 'peer_dependency_conflict'
  | 'native_module_failure'
  | 'lockfile_conflict'
  | 'git_dependency_failure'
  | 'syntax_error'
  | 'type_error'
  | 'unknown';

interface AnalyzedError {
  category: ErrorCategory;
  message: string;
  packageName?: string;
  versionConstraint?: string;
  conflictingPackages?: string[];
  suggestedFix?: FixStrategy;
  priority: number;
}

interface PackageInfo {
  name: string;
  requestedVersion?: string;
  installedVersion?: string;
  conflictsWith?: string[];
}
```

### FixStrategyEngine

Applies fixes based on error analysis.

```typescript
interface FixStrategyEngine {
  selectStrategy(error: AnalyzedError, history: FixHistory): FixStrategy;
  applyFix(repoPath: string, strategy: FixStrategy): Promise<FixResult>;
  getAlternativeStrategies(error: AnalyzedError): FixStrategy[];
}

type FixStrategy =
  | { type: 'adjust_version'; package: string; newVersion: string }
  | { type: 'legacy_peer_deps'; }
  | { type: 'remove_lockfile'; lockfile: string }
  | { type: 'substitute_package'; original: string; replacement: string }
  | { type: 'remove_package'; package: string }
  | { type: 'add_resolution'; package: string; version: string }
  | { type: 'force_install'; };

interface FixResult {
  success: boolean;
  strategy: FixStrategy;
  error?: string;
}

interface AppliedFix {
  iteration: number;
  error: AnalyzedError;
  strategy: FixStrategy;
  result: FixResult;
}
```

### FixHistoryStore

Persists successful fixes for future use.

```typescript
interface FixHistoryStore {
  recordFix(repoId: string, errorPattern: string, strategy: FixStrategy): void;
  getSuccessfulFix(errorPattern: string): FixStrategy | null;
  getHistory(repoId: string): FixHistory;
  saveHistory(repoId: string, history: FixHistory): Promise<void>;
}

interface FixHistory {
  repoId: string;
  fixes: HistoricalFix[];
  lastResurrection: Date;
}

interface HistoricalFix {
  errorPattern: string;
  strategy: FixStrategy;
  successCount: number;
  lastUsed: Date;
}
```

## Data Models

### Error Patterns

Regular expressions for identifying error categories:

```typescript
const ERROR_PATTERNS = {
  dependency_not_found: /Cannot find module ['"]([^'"]+)['"]/,
  dependency_version_conflict: /ERESOLVE.*Could not resolve dependency/s,
  peer_dependency_conflict: /npm ERR! peer dep missing|peerDependencies/,
  native_module_failure: /node-gyp|gyp ERR!|binding\.gyp/,
  lockfile_conflict: /npm ERR! code ENOLOCK|lockfile version/,
  git_dependency_failure: /git dep preparation failed|Permission denied \(publickey\)/,
  syntax_error: /SyntaxError:|Unexpected token/,
  type_error: /TypeError:|TS\d+:/
};
```

### Fix Strategy Mappings

Default fix strategies for each error category:

```typescript
const DEFAULT_FIX_STRATEGIES: Record<ErrorCategory, FixStrategy[]> = {
  dependency_version_conflict: [
    { type: 'legacy_peer_deps' },
    { type: 'remove_lockfile', lockfile: 'package-lock.json' },
    { type: 'force_install' }
  ],
  peer_dependency_conflict: [
    { type: 'legacy_peer_deps' },
    { type: 'add_resolution', package: '', version: '' }
  ],
  native_module_failure: [
    { type: 'remove_package', package: '' },
    { type: 'substitute_package', original: '', replacement: '' }
  ],
  lockfile_conflict: [
    { type: 'remove_lockfile', lockfile: 'package-lock.json' }
  ],
  git_dependency_failure: [
    { type: 'substitute_package', original: '', replacement: '' },
    { type: 'remove_package', package: '' }
  ]
};
```

### Native Module Alternatives

Known substitutions for problematic native modules:

```typescript
const NATIVE_MODULE_ALTERNATIVES: Record<string, string> = {
  'bcrypt': 'bcryptjs',
  'node-sass': 'sass',
  'fibers': '',  // Remove, no alternative
  'deasync': '',  // Remove, no alternative
  'sharp': '',    // Skip, optional
  'canvas': '',   // Skip, optional
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Resurrection Loop Invariant
*For any* resurrection attempt, if compilation fails and iterations remain below max, the system should apply a fix and retry; if compilation succeeds, the loop should terminate with success; if max iterations is reached, the loop should terminate with failure report.
**Validates: Requirements 1.1, 4.1, 4.2, 4.3, 4.5**

### Property 2: Error Parsing Completeness
*For any* compilation error output, the Error Analyzer should categorize the error into exactly one category and extract relevant package information when applicable.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 3: Fix Strategy Application
*For any* analyzed error with a known category, the Fix Strategy Engine should select and attempt at least one fix strategy; if the fix fails, an alternative strategy should be attempted.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 4.4**

### Property 4: Event Emission Completeness
*For any* resurrection loop execution, events should be emitted for: iteration start, error analysis, fix application, fix outcome, and loop completion summary.
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 5: Fix History Persistence
*For any* successful fix, the error pattern and strategy should be recorded; when the same error pattern is encountered again, the previously successful strategy should be prioritized.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### Property 6: Compilation Proof Generation
*For any* successful compilation, a Compilation Proof artifact should be generated containing timestamp, build command, exit code, duration, and output hash.
**Validates: Requirements 1.3**

## Error Handling

### Compilation Timeouts
- Default timeout: 5 minutes per compilation attempt
- On timeout: Treat as failure, emit timeout error event
- Strategy: Reduce timeout for subsequent attempts if pattern detected

### Infinite Loop Prevention
- Max iterations enforced (default: 10)
- Track applied fixes to avoid repeating failed strategies
- Detect oscillating fixes (A→B→A) and break cycle

### Partial Success Handling
- If core build succeeds but optional scripts fail, consider partial success
- Report which scripts succeeded/failed
- Allow user to accept partial success

### Network Failures
- Retry npm/yarn/pnpm operations with exponential backoff
- Cache successful package downloads
- Fallback to offline mode if available

## Testing Strategy

### Unit Tests
- Error pattern matching for each error category
- Fix strategy selection logic
- Package.json modification functions
- Build command detection

### Property-Based Tests
The following property-based tests will be implemented using fast-check:

1. **Resurrection Loop Invariant Test**: Generate random sequences of compilation results and verify loop behavior
2. **Error Parsing Round-Trip Test**: Generate error messages, parse them, verify categorization
3. **Fix Strategy Application Test**: Generate errors, verify appropriate strategies are selected
4. **Event Emission Test**: Run validation, verify all required events are emitted
5. **Fix History Test**: Record fixes, verify retrieval and prioritization

### Integration Tests
- End-to-end resurrection loop with mock compilation
- Real package.json modification and validation
- Event emission verification with SSE server

### Test Configuration
- Property-based tests: minimum 100 iterations per property
- Use fast-check library for property-based testing
- Tag each property test with: `**Feature: post-resurrection-validation, Property {number}: {property_text}**`
