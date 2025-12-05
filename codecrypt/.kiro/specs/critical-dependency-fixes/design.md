# Design Document: Critical Dependency and API Configuration Fixes

## Overview

This design addresses two critical failures preventing CodeCrypt from functioning:
1. A dead GitHub tarball URL for the `querystring` dependency that blocks all npm installs
2. An outdated Gemini model name that causes LLM analysis to fail with 404 errors

The solution involves updating `package.json` to remove or replace the dead dependency, and updating the Gemini model configuration to use `gemini-3-pro-preview`.

## Architecture

The fixes involve modifications to two distinct areas:

### Dependency Resolution Layer
- **package.json**: Remove or replace the dead querystring GitHub URL
- **Code Analysis**: Verify if querystring is actually used in the codebase
- **Replacement Strategy**: Use npm registry version or Node.js built-in module

### LLM Analysis Layer
- **llmAnalysis.ts**: Update GeminiClient default model configuration
- **resurrectionOrchestrator.ts**: Update fallback model configuration
- **Error Handling**: Improve error messages for invalid models

## Components and Interfaces

### 1. Package Dependency Configuration

**Current State:**
```json
{
  "querystring": "https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz"
}
```

**Proposed Solutions (in priority order):**

**Option A: Remove entirely** (if unused or Node.js built-in is sufficient)
- Node.js includes `querystring` as a built-in module since v0.1.25
- Check if code uses `require('querystring')` or `import querystring`
- If using built-in is acceptable, remove from package.json

**Option B: Use npm registry version**
```json
{
  "querystring": "^0.2.1"
}
```

**Option C: Use modern replacement**
```json
{
  "query-string": "^7.1.3"
}
```

### 2. Gemini Model Configuration

**Affected Files:**
- `src/services/llmAnalysis.ts` - GeminiClient class
- `src/services/resurrectionOrchestrator.ts` - Configuration reading

**Current Configuration:**
```typescript
const model = config.model || 'gemini-3-pro-preview';
```

**Status:** ✅ Already updated to use the correct model

### Configuration Interface

```typescript
interface GeminiConfig {
  apiKey: string;
  model?: string;  // Default: 'gemini-3-pro-preview'
  timeout?: number;
  maxRetries?: number;
}
```

## Data Models

No changes to data models - these are configuration fixes only.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Valid Dependency Sources
*For any* dependency in package.json, the dependency source SHALL be either an npm registry package or a valid, accessible URL
**Validates: Requirements 1.2, 1.4**

### Property 2: Non-Registry URL Detection
*For any* package.json file, parsing SHALL identify all dependencies using non-registry URLs (GitHub, tarball, git, etc.)
**Validates: Requirements 5.3**

## Error Handling

### Current Error Handling Issues

**Dependency Resolution:**
- npm fails with generic 404 error
- No clear indication which dependency caused the failure
- No suggestions for alternatives

**Gemini API:**
- Generic error message doesn't identify the model name issue
- No list of valid model alternatives provided

### Improved Error Handling

**For Gemini API Errors:**
```typescript
if (error.message.includes('404') && error.message.includes('models/')) {
  throw new CodeCryptError(
    `Gemini model '${this.config.model}' not found. ` +
    `The configured model is not available in the Gemini API. ` +
    `Update to 'gemini-3-pro-preview' in VS Code settings (codecrypt.geminiModel).`,
    'GEMINI_MODEL_NOT_FOUND'
  );
}
```

**For Dependency Validation:**
```typescript
// Add pre-install validation
function validateDependencies(packageJson: any): string[] {
  const issues: string[] = [];
  for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
    if (typeof version === 'string' && version.startsWith('http')) {
      issues.push(`Dependency '${name}' uses direct URL: ${version}`);
    }
  }
  return issues;
}
```

## Testing Strategy

### Unit Tests

1. **Test dependency source validation**
   - Verify npm registry packages are identified as valid
   - Verify GitHub URLs are identified as non-registry
   - Verify built-in modules don't require package.json entries

2. **Test Gemini model configuration**
   - Verify default model is `gemini-3-pro-preview`
   - Verify custom model from settings overrides default
   - Verify error messages include model name and suggestions

3. **Test error message content**
   - Verify 404 errors include actionable guidance
   - Verify invalid model errors suggest valid alternatives

### Integration Tests

1. **Test npm install succeeds**
   - Run npm install in clean environment
   - Verify exit code is 0
   - Verify no 404 errors in output

2. **Test build process completes**
   - Run full build after dependency fixes
   - Verify compilation succeeds
   - Verify all tests pass

3. **Test Gemini API integration**
   - Initialize GeminiClient with new model
   - Make test API call
   - Verify successful response

### Manual Testing

1. Clean install test:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run compile
   npm test
   ```

2. Gemini API test:
   - Configure API key
   - Run resurrection on test repo
   - Verify LLM analysis completes
   - Check logs for 404 errors

## Implementation Strategy

### Phase 1: Dependency Fix

1. **Analyze querystring usage**
   - Search codebase for `require('querystring')` or `import querystring`
   - Determine if Node.js built-in is sufficient
   - Check if any code actually uses this dependency

2. **Choose replacement strategy**
   - If unused: Remove from package.json
   - If using built-in: Remove from package.json (Node.js includes it)
   - If needed: Replace with npm registry version `^0.2.1`

3. **Update package.json**
   - Remove or replace the dead URL
   - Run npm install to verify fix

4. **Verify functionality**
   - Run full test suite
   - Verify build succeeds
   - Check for any runtime errors

### Phase 2: Gemini Model Fix (PROJECT-WIDE)

**CRITICAL: All Gemini model references must be updated to `gemini-3-pro-preview` to prevent 404 errors**

1. **Update llmAnalysis.ts**
   - Change default model to `gemini-3-pro-preview` (line ~301, ~317, ~321)
   - Add improved error handling for 404 errors
   - Include model suggestions in error messages

2. **Update resurrectionOrchestrator.ts**
   - Update fallback model configuration (line ~366, ~376, ~391, ~454)
   - Ensure consistency with llmAnalysis.ts
   - Update all narration messages to reference correct model

3. **Update documentation files**
   - QUICK_REFERENCE.md: Update all model examples
   - ANALYSIS_FINDINGS.md: Update recommendations
   - FIXES_NEEDED.md: Update error examples
   - Any other docs mentioning Gemini models

4. **Update test files**
   - demoCriticalFixes.integration.test.ts: Update model assertions
   - Any tests that reference Gemini models

5. **Update spec files**
   - gemini-api-fix/tasks.md: Update model references
   - demo-critical-fixes/tasks.md: Update model references

6. **Test Gemini integration**
   - Run LLM analysis with new model
   - Verify successful API responses
   - Check error handling with invalid model
   - Verify NO occurrences of old model names remain

### Phase 3: Validation & Documentation

1. **Run comprehensive tests**
   - Unit tests
   - Integration tests
   - Manual end-to-end test

2. **Update documentation**
   - Document valid Gemini models
   - Add troubleshooting guide for dependency issues
   - Update configuration examples

## Migration Path

### For Users

No action required - these are internal fixes:
- Dependencies will install correctly after update
- Gemini API will work with new model
- Existing configurations remain compatible

### For Developers

1. Pull latest changes
2. Run `npm install` (should succeed now)
3. Run `npm run compile`
4. Run `npm test` to verify

## Performance Considerations

- No performance impact from dependency fix
- `gemini-3-pro-preview` may have different latency than old model
- Overall system performance should improve with working LLM analysis

## Security Considerations

### Dependency Security

- Removing dead GitHub URL reduces attack surface
- Using npm registry packages provides better security auditing
- Built-in Node.js modules are most secure option

### API Security

- No security changes to Gemini API integration
- API key handling remains unchanged
- Model name change doesn't affect security posture

## Rollback Strategy

If issues arise:

1. **Dependency rollback**: Revert package.json changes
2. **Model rollback**: Change model back to previous value
3. **Full rollback**: Revert entire commit

## Success Criteria

The fix is successful when:
1. ✅ `npm install` completes without 404 errors
2. ✅ `npm run compile` succeeds
3. ✅ All existing tests pass
4. ✅ Gemini API calls succeed without 404 errors
5. ✅ LLM analysis produces insights in resurrection reports
6. ✅ No regression in existing functionality
