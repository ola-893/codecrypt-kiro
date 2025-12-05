# Design Document: Demo Readiness Fixes

## Overview

This design addresses three critical gaps discovered during real-world testing: transitive dead URL detection, build system detection, and package replacement registry expansion. The solution involves enhancing existing services (DeadUrlHandler, CompilationRunner, PackageReplacementRegistry) and adding new lockfile parsing capabilities.

## Architecture

### Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                  ResurrectionOrchestrator                    │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ DependencyAnalysis│    │ DeadUrlHandler   │
│  + Lockfile Parse │    │  + Transitive    │
└────────┬───────────┘    └────────┬─────────┘
         │                         │
         │                         ▼
         │                ┌──────────────────┐
         │                │ PackageReplacement│
         │                │     Registry      │
         │                └──────────────────┘
         │
         ▼
┌──────────────────┐
│ CompilationRunner│
│  + Build System  │
│    Detection     │
└──────────────────┘
```

## Components and Interfaces

### 1. LockfileParser (New Service)

Parses npm lockfiles to extract transitive dependency URLs.

```typescript
interface LockfileParser {
  /**
   * Parse lockfile and extract all URL-based dependencies
   */
  parseL ockfile(repoPath: string): Promise<TransitiveDependency[]>;
  
  /**
   * Detect which lockfile type exists
   */
  detectLockfileType(repoPath: string): Promise<'npm' | 'yarn' | 'pnpm' | null>;
  
  /**
   * Delete all lockfiles in preparation for regeneration
   */
  deleteLockfiles(repoPath: string): Promise<void>;
}

interface TransitiveDependency {
  /** Package name */
  name: string;
  /** Resolved URL from lockfile */
  resolvedUrl: string;
  /** Parent packages that depend on this */
  parents: string[];
  /** Depth in dependency tree */
  depth: number;
}
```

### 2. Enhanced DeadUrlHandler

Extended to handle transitive dependencies from lockfiles.

```typescript
interface EnhancedDeadUrlHandler extends DeadUrlHandler {
  /**
   * Handle dead URLs including transitive dependencies
   */
  handleDeadUrlsWithTransitive(
    repoPath: string,
    directDeps: Map<string, string>,
    transitiveDeps: TransitiveDependency[]
  ): Promise<DeadUrlHandlingSummary>;
  
  /**
   * Regenerate lockfile after resolving dead URLs
   */
  regenerateLockfile(repoPath: string, packageManager: PackageManager): Promise<void>;
}
```

### 3. Enhanced CompilationRunner

Extended to detect task runners and use appropriate build commands.

```typescript
interface BuildSystemConfig {
  /** Type of build system detected */
  type: 'npm-script' | 'gulp' | 'grunt' | 'webpack' | 'rollup' | 'none';
  /** Build command to execute */
  buildCommand: string;
  /** Whether compilation is required */
  requiresCompilation: boolean;
  /** Config file that was detected */
  configFile?: string;
}

interface EnhancedCompilationRunner extends CompilationRunner {
  /**
   * Detect build system including task runners
   */
  detectBuildSystem(repoPath: string): Promise<BuildSystemConfig>;
}
```

### 4. Enhanced PackageReplacementRegistry

Extended to include dead URL patterns and wildcard matching.

```typescript
interface DeadUrlPattern {
  /** URL pattern (supports wildcards) */
  pattern: string;
  /** Replacement package name */
  replacementPackage: string;
  /** Replacement version */
  replacementVersion: string;
  /** Reason for replacement */
  reason: string;
}

interface EnhancedPackageReplacementRegistry {
  /**
   * Check if a URL matches a known dead URL pattern
   */
  matchesDeadUrlPattern(url: string): DeadUrlPattern | null;
  
  /**
   * Get all dead URL patterns
   */
  getDeadUrlPatterns(): DeadUrlPattern[];
}
```

## Data Models

### Lockfile Structures

**package-lock.json (npm v7+)**
```json
{
  "packages": {
    "node_modules/querystring": {
      "resolved": "https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz",
      "integrity": "sha512-..."
    }
  }
}
```

**yarn.lock**
```
querystring@https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz:
  version "0.2.0"
  resolved "https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz#..."
```

**pnpm-lock.yaml**
```yaml
packages:
  /querystring/0.2.0:
    resolution: {tarball: https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz}
```

### Enhanced Package Replacement Registry

```json
{
  "deadUrlPatterns": [
    {
      "pattern": "github.com/substack/querystring/*",
      "replacementPackage": "querystring",
      "replacementVersion": "^0.2.1",
      "reason": "Old GitHub tarball URL no longer accessible. Package is available on npm registry."
    },
    {
      "pattern": "github.com/*/archive/*.tar.gz",
      "replacementPackage": null,
      "replacementVersion": null,
      "reason": "Generic GitHub archive URLs are often dead. Attempt npm registry lookup."
    }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Lockfile Parsing Completeness
*For any* valid npm lockfile (package-lock.json, yarn.lock, or pnpm-lock.yaml), parsing should extract all URL-based dependencies without missing any entries.
**Validates: Requirements 1.1**

### Property 2: Dead URL Detection Consistency
*For any* dependency (direct or transitive) with a URL-based resolution, the dead URL detection should produce the same result when run multiple times on the same URL.
**Validates: Requirements 1.2**

### Property 3: Build System Detection Priority
*For any* repository with multiple build systems, npm scripts should always take priority over task runner files when both exist.
**Validates: Requirements 2.7**

### Property 4: Registry Pattern Matching Correctness
*For any* dead URL that matches a registry pattern, the replacement should be applied consistently regardless of the order in which patterns are checked.
**Validates: Requirements 3.2**

### Property 5: Lockfile Regeneration Idempotency
*For any* repository, deleting and regenerating the lockfile twice should produce equivalent lockfiles (same resolved versions).
**Validates: Requirements 4.2**

### Property 6: Dependency Chain Preservation
*For any* transitive dependency that is removed, all parent dependencies that exclusively depend on it should also be identified in the error report.
**Validates: Requirements 5.2**

### Property 7: Build Command Fallback Determinism
*For any* repository without build scripts or task runners, the system should always mark it as "not requiring compilation" rather than failing.
**Validates: Requirements 6.1**

## Error Handling

### Lockfile Parsing Errors
- **Malformed lockfile**: Log warning, skip transitive analysis, continue with direct dependencies only
- **Unsupported lockfile version**: Log warning with version info, skip transitive analysis
- **Missing lockfile**: Skip transitive analysis, continue with direct dependencies only

### Dead URL Resolution Errors
- **Network timeout**: Retry up to 3 times with exponential backoff
- **npm registry unavailable**: Log error, mark dependency as unresolvable
- **Circular dependency detected**: Log warning, break circle at deepest level

### Build System Detection Errors
- **Multiple task runners**: Use priority order (npm > gulp > grunt > webpack > rollup)
- **Task runner without npx**: Log warning, attempt direct execution
- **Build command fails**: Log full output, mark validation as failed but continue

### Lockfile Regeneration Errors
- **npm install fails**: Log error, keep old lockfile, continue resurrection
- **Permission denied**: Log error with sudo suggestion, continue
- **Disk space**: Log error, continue without lockfile regeneration

## Testing Strategy

### Unit Tests
- LockfileParser: Test parsing of each lockfile format with various URL patterns
- DeadUrlHandler: Test transitive dependency resolution with mock lockfile data
- CompilationRunner: Test build system detection with various project structures
- PackageReplacementRegistry: Test pattern matching with wildcards and edge cases

### Property-Based Tests
- Property 1: Generate random valid lockfiles, verify all URLs extracted
- Property 2: Generate random URLs, verify detection consistency
- Property 3: Generate repos with multiple build systems, verify priority
- Property 4: Generate URLs matching patterns, verify consistent replacement
- Property 5: Generate package.json files, verify lockfile regeneration idempotency
- Property 6: Generate dependency trees, verify chain identification
- Property 7: Generate repos without build systems, verify fallback behavior

### Integration Tests
- End-to-end test with the actual puewue-frontend repository (the one that exposed these issues)
- Test with repositories using each lockfile type (npm, yarn, pnpm)
- Test with repositories using each build system (Gulp, Grunt, Webpack, Rollup)
- Test with repositories having multiple dead URLs at different depths

## Implementation Notes

### Lockfile Parsing Strategy
1. Detect lockfile type by checking for file existence
2. Parse using format-specific logic (JSON for npm, custom parser for yarn, YAML for pnpm)
3. Extract all `resolved` fields that contain URLs
4. Build dependency tree to identify parent relationships
5. Sort by depth (deepest first) for processing order

### Build System Detection Strategy
1. Check package.json scripts first (highest priority)
2. Check for task runner files (gulpfile.js, Gruntfile.js, etc.)
3. Check for bundler configs (webpack.config.js, rollup.config.js)
4. If multiple found, use priority order
5. If none found, mark as "not requiring compilation"

### Package Replacement Registry Strategy
1. Load registry on startup
2. For each dead URL, check against patterns in order
3. Support wildcards using glob-style matching
4. Cache pattern matches to avoid repeated regex operations
5. Log all replacements for transparency

### Performance Considerations
- Lockfile parsing: Stream large files instead of loading entirely into memory
- URL validation: Batch requests and use connection pooling
- Pattern matching: Compile regex patterns once at startup
- Lockfile regeneration: Run in background, don't block main thread

## Demo Scenario Validation

The implementation must successfully handle the puewue-frontend repository scenario:
- 13 outdated dependencies detected
- querystring dead URL in transitive dependencies
- Gulp build system (no npm build script)
- Successfully update 3+ packages
- Generate clean resurrection report
- Complete in under 10 minutes
