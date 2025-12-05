# Design Document: Demo Critical Fixes

## Overview

This design addresses three critical failure modes discovered during the demo: Gemini API model configuration errors, dead dependency URLs causing cascading failures, and missing build scripts causing validation loops. The solution implements robust error handling, intelligent fallbacks, and better detection of project characteristics.

## Architecture

The fixes are organized into three main areas:

1. **LLM Provider Resilience**: Enhanced Gemini client configuration and fallback logic
2. **Dependency Resolution**: Dead URL detection and alternative source resolution
3. **Validation Intelligence**: Smart detection of project build requirements

## Components and Interfaces

### 1. Enhanced Gemini Client

**Location**: `src/services/llmAnalysis.ts`

**Changes**:
- Update model name to use `gemini-3-pro-preview` (current recommended model)
- Add API version configuration (use v1 instead of v1beta)
- Implement provider fallback logic
- Add better error messages with model and API version details

**Interface**:
```typescript
interface GeminiConfig {
  apiKey: string;
  model?: string; // Default: 'gemini-3-pro-preview'
  apiVersion?: string; // Default: 'v1'
  timeout?: number;
  maxRetries?: number;
}

class GeminiClient {
  constructor(config: GeminiConfig);
  async analyzeCode(prompt: string): Promise<string>;
  // Returns null on failure instead of throwing
  async analyzeCodeSafe(prompt: string): Promise<string | null>;
}
```

### 2. Dead URL Handler

**Location**: `src/services/deadUrlHandler.ts` (new file)

**Purpose**: Detect and handle dead dependency URLs

**Interface**:
```typescript
interface DeadUrlDetectionResult {
  isDeadUrl: boolean;
  packageName?: string;
  deadUrl?: string;
  suggestedFix?: string;
}

class DeadUrlHandler {
  // Detect if npm error is due to dead URL
  detectDeadUrl(errorOutput: string): DeadUrlDetectionResult;
  
  // Attempt to fix package.json by replacing dead URLs
  async fixDeadUrls(packageJsonPath: string): Promise<number>;
  
  // Get alternative source for a package
  async getAlternativeSource(packageName: string, deadUrl: string): Promise<string | null>;
}
```

### 3. Build Script Detector

**Location**: `src/services/environmentDetection.ts` (enhance existing)

**Purpose**: Intelligently detect project build requirements

**Interface**:
```typescript
interface BuildConfiguration {
  hasBuildScript: boolean;
  buildCommand?: string;
  buildTool?: 'npm' | 'gulp' | 'grunt' | 'webpack' | 'none';
  requiresCompilation: boolean;
}

class EnvironmentDetector {
  // Existing methods...
  
  // New method
  async detectBuildConfiguration(repoPath: string): Promise<BuildConfiguration>;
}
```

### 4. Enhanced Compilation Runner

**Location**: `src/services/compilationRunner.ts` (enhance existing)

**Purpose**: Handle missing build scripts gracefully

**Changes**:
- Check for build script existence before running
- Return "not applicable" status for projects without build scripts
- Detect alternative build commands (gulp, grunt, etc.)

## Data Models

### Error Classification

```typescript
enum ErrorCategory {
  DEAD_URL = 'dead_url',
  MISSING_BUILD_SCRIPT = 'missing_build_script',
  LLM_API_ERROR = 'llm_api_error',
  DEPENDENCY_CONFLICT = 'dependency_conflict',
  // ... existing categories
}

interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  context: Record<string, any>;
  suggestedFix?: string;
  canRecover: boolean;
}
```

### Resurrection Result Enhancement

```typescript
interface ResurrectionResult {
  // ... existing fields
  
  // New fields
  partialSuccess: boolean;
  llmAnalysisStatus: 'success' | 'partial' | 'failed' | 'skipped';
  llmProvider?: 'anthropic' | 'gemini' | 'none';
  dependencyUpdateSummary: {
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  validationSummary: {
    compilationStatus: 'passed' | 'failed' | 'not_applicable';
    testsStatus: 'passed' | 'failed' | 'not_applicable';
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: LLM Fallback Consistency
*For any* repository resurrection attempt, if the primary LLM provider fails, the system should either use a fallback provider or continue with AST-only analysis without crashing.
**Validates: Requirements 1.3, 5.1, 5.4**

### Property 2: Dead URL Detection Accuracy
*For any* npm error output containing a 404 status and a GitHub tarball URL, the dead URL detector should correctly identify it as a dead URL error.
**Validates: Requirements 2.1**

### Property 3: Build Script Detection Correctness
*For any* repository, if package.json contains no "build" script, the build configuration detector should return `hasBuildScript: false` and `requiresCompilation: false`.
**Validates: Requirements 3.1, 3.2**

### Property 4: Partial Success Reporting
*For any* resurrection attempt where at least one dependency updates successfully, the result should be marked as `partialSuccess: true` even if other dependencies fail.
**Validates: Requirements 4.3, 5.2**

### Property 5: Error Context Completeness
*For any* error logged during resurrection, the error object should contain at minimum: error message, category, timestamp, and operation context.
**Validates: Requirements 4.1**

### Property 6: Validation Skip Logic
*For any* repository where `requiresCompilation: false`, the compilation validation should return status "not_applicable" without attempting to run npm build.
**Validates: Requirements 3.2, 3.3**

### Property 7: Alternative Source Resolution
*For any* dead URL pointing to a GitHub tarball, if the package exists in the npm registry, the alternative source resolver should return the npm registry URL.
**Validates: Requirements 2.2**

## Error Handling

### LLM API Errors

**Detection**:
- Catch 404 errors with model name in message
- Catch network errors (ECONNREFUSED, fetch failed)
- Catch timeout errors

**Recovery**:
1. Log error with full context (model, API version, provider)
2. If Gemini fails and Anthropic is configured, switch to Anthropic
3. If all LLM providers fail, continue with AST-only analysis
4. Mark LLM analysis as "failed" or "skipped" in results

### Dead URL Errors

**Detection**:
- Parse npm error output for "404 Not Found" + GitHub URL pattern
- Extract package name from error message
- Identify if it's a transitive dependency issue

**Recovery**:
1. Log the dead URL and affected package
2. Check if package exists in npm registry
3. If found, update package.json to use npm registry
4. If not found, mark package as failed and continue
5. Report all dead URLs in final summary

### Missing Build Script

**Detection**:
- Read package.json before attempting compilation
- Check for "build", "compile", or "prepublish" scripts
- Check for gulpfile.js, Gruntfile.js, webpack.config.js

**Recovery**:
1. If no build mechanism found, skip compilation validation
2. Mark compilation as "not applicable" in results
3. Continue with other validations (tests, if available)
4. Report in summary that compilation was skipped

## Testing Strategy

### Unit Tests

**Dead URL Handler**:
- Test detection of various 404 error formats
- Test extraction of package names from errors
- Test alternative source resolution
- Test package.json URL replacement

**Build Script Detector**:
- Test detection with various package.json configurations
- Test detection of alternative build tools
- Test handling of missing package.json

**Enhanced Compilation Runner**:
- Test skip logic for projects without build scripts
- Test detection of alternative build commands
- Test status reporting for "not applicable" cases

### Property-Based Tests

**Property 1: LLM Fallback Consistency**
- Generate random LLM failure scenarios
- Verify system continues without crashing
- Verify AST analysis still runs

**Property 2: Dead URL Detection Accuracy**
- Generate various npm error outputs with dead URLs
- Verify all are correctly detected
- Verify package names are correctly extracted

**Property 3: Build Script Detection Correctness**
- Generate random package.json files with/without build scripts
- Verify detection accuracy is 100%

**Property 7: Alternative Source Resolution**
- Generate random package names
- For packages in npm registry, verify npm URL is returned
- For packages not in registry, verify null is returned

### Integration Tests

**End-to-End Resurrection with Failures**:
- Test resurrection of repo with dead URLs
- Verify partial success is reported correctly
- Verify dead URLs are fixed in package.json

**LLM Provider Fallback**:
- Test with Gemini configured but failing
- Verify fallback to Anthropic works
- Verify AST-only fallback works

**Missing Build Script Handling**:
- Test resurrection of repo without build script
- Verify compilation validation is skipped
- Verify other validations still run

## Implementation Notes

### Gemini API Model Fix

The system now uses `gemini-3-pro-preview` which is the current recommended model. This provides:

1. **Best compatibility**: Widely available and stable
2. **Enhanced capabilities**: Latest model with improved performance
3. **v1 API support**: Uses the stable API endpoint

The model configuration is set in `llmAnalysis.ts` and can be overridden via VS Code settings.

### Dead URL Pattern

The specific error pattern to detect:
```
npm error 404 Not Found - GET https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz
npm error 404  'querystring@https://github.com/...' is not in this registry.
```

This indicates a package.json dependency pointing to a dead GitHub URL. The fix is to replace it with the npm registry version.

### Build Script Detection Logic

Priority order for build detection:
1. Check package.json for "build" script
2. Check for "compile" script
3. Check for "prepublish" or "prepare" script
4. Check for gulpfile.js → use "gulp build" or "gulp"
5. Check for Gruntfile.js → use "grunt build" or "grunt"
6. Check for webpack.config.js → use "webpack"
7. If none found → no build required

## Dependencies

- Existing: `@google/generative-ai`, `@anthropic-ai/sdk`
- No new external dependencies required
- Uses existing Node.js `fs`, `path` modules

## Performance Considerations

- Dead URL detection adds minimal overhead (regex parsing of error output)
- Build script detection is a one-time check at start of validation
- LLM fallback adds latency only when primary provider fails
- Overall impact: <100ms additional overhead in happy path

## Security Considerations

- Dead URL handler should validate replacement URLs before updating package.json
- Should not automatically trust npm registry without verification
- Should log all package.json modifications for audit trail
- API keys for LLM providers should remain in secure storage

## Rollout Strategy

1. **Phase 1**: Implement dead URL handler and build script detector
2. **Phase 2**: Fix Gemini API configuration and add fallback logic
3. **Phase 3**: Enhance error reporting and result summaries
4. **Phase 4**: Add comprehensive tests
5. **Phase 5**: Update documentation and user messaging

## Success Metrics

- LLM analysis success rate > 80% (up from 0% in demo)
- Dependency update success rate > 50% (up from 23% in demo)
- Zero crashes due to missing build scripts
- Clear error messages for all failure modes
- Partial success reported correctly in all cases
