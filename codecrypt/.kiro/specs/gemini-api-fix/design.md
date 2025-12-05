# Design Document: Gemini API Model Configuration Fix

## Overview

This design addresses the configuration of CodeCrypt's LLM analysis to use the latest Gemini API model. The system now defaults to `gemini-3-pro-preview`, which is Google's latest Gemini API model. This ensures all LLM-based semantic analysis works correctly, enabling the resurrection process's ability to understand developer intent and suggest intelligent modernizations.

## Architecture

The fix involves updating the default model name in two locations:
1. `llmAnalysis.ts` - The GeminiClient class default configuration
2. `resurrectionOrchestrator.ts` - The fallback configuration when reading from VS Code settings

The architecture remains unchanged - we're simply correcting a configuration value.

## Components and Interfaces

### Affected Components

1. **GeminiClient** (`src/services/llmAnalysis.ts`)
   - Default model configuration in constructor
   - Model validation and error handling

2. **ResurrectionOrchestrator** (`src/services/resurrectionOrchestrator.ts`)
   - Gemini model configuration reading from VS Code settings
   - Fallback model selection logic

### Configuration Interface

```typescript
interface GeminiConfig {
  apiKey: string;
  model?: string;  // Should default to 'gemini-3-pro-preview'
  timeout?: number;
  maxRetries?: number;
}
```

## Data Models

No changes to data models - this is purely a configuration fix.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid Model Name Usage
*For any* Gemini API call, the model name used SHALL be one that exists in Google's Gemini API (e.g., `gemini-3-pro-preview`)
**Validates: Requirements 1.1, 1.2**

### Property 2: Configuration Consistency
*For any* code path that initializes a GeminiClient, the default model name SHALL be consistent across all initialization points
**Validates: Requirements 3.2**

### Property 3: Error Message Clarity
*For any* 404 error from the Gemini API, the error message SHALL include the attempted model name and suggest valid alternatives
**Validates: Requirements 2.1, 2.3**

## Error Handling

### Current Error Handling Issues

The current error handling catches the 404 error but doesn't provide actionable guidance:
```typescript
throw new CodeCryptError(
  `Gemini analysis failed: ${errorMessage}`
);
```

### Improved Error Handling

```typescript
if (error.message.includes('404') && error.message.includes('not found')) {
  throw new CodeCryptError(
    `Gemini model '${this.config.model}' not found. ` +
    `Recommended model: gemini-3-pro-preview. ` +
    `Update your configuration in VS Code settings (codecrypt.geminiModel).`
  );
}
```

## Testing Strategy

### Unit Tests

1. **Test GeminiClient initialization with valid model names**
   - Verify `gemini-3-pro-preview` is accepted
   - Verify custom model names from configuration are used correctly

2. **Test error messages for invalid models**
   - Verify 404 errors include model name
   - Verify error messages suggest valid alternatives

3. **Test configuration reading**
   - Verify default model is used when no config provided
   - Verify custom model from VS Code settings is used when provided

### Integration Tests

1. **Test full resurrection flow with Gemini**
   - Verify LLM analysis completes successfully
   - Verify hybrid analysis includes LLM insights
   - Verify resurrection report includes LLM analysis summary

2. **Test fallback behavior**
   - Verify system falls back to Anthropic if Gemini fails
   - Verify system continues with AST-only if both fail

### Manual Testing

1. Run resurrection on a test repository with Gemini configured
2. Verify no 404 errors in logs
3. Verify LLM insights appear in resurrection report
4. Test with different valid model names

## Implementation Notes

### Valid Gemini Model Names (as of December 2024)

- `gemini-3-pro-preview` ⭐ Recommended - Latest model with enhanced capabilities

### Recommended Default

Use `gemini-3-pro-preview` as the default because:
1. It's the current recommended model from Google
2. It provides enhanced capabilities for code analysis
3. It has good performance and reliability
4. It's well-supported in the current API version

### Configuration Priority

1. User-configured model in VS Code settings (`codecrypt.geminiModel`)
2. Default model in code (`gemini-3-pro-preview`)

## Migration Strategy

This is a simple configuration change with no breaking changes:

1. Update default model name in `llmAnalysis.ts`
2. Update default model name in `resurrectionOrchestrator.ts`
3. Add improved error messages for invalid models
4. Update documentation to reflect valid model names
5. No user action required - existing configurations will continue to work if they use valid model names

## Performance Considerations

- `gemini-3-pro-preview` provides good performance for code analysis tasks
- API latency is acceptable for the resurrection workflow
- No performance degradation expected from this configuration

## Security Considerations

No security implications - this is purely a configuration fix.

## Documentation Updates

Update the following documentation:
1. README.md - Mention valid Gemini model names
2. Configuration guide - List valid model options
3. Troubleshooting guide - Add section on Gemini API errors
