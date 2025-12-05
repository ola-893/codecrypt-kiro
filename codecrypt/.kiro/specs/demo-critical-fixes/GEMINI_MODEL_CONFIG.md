# Gemini Model Configuration

## Overview

CodeCrypt now supports configurable Gemini models, allowing you to use different versions of Google's Gemini API including the newer `gemini-3-pro-preview` model.

## Configuration

### Setting the Gemini Model

You can configure which Gemini model to use via VS Code settings:

1. **Via Settings UI:**
   - Open VS Code Settings (Cmd/Ctrl + ,)
   - Search for "codecrypt gemini"
   - Set "Codecrypt: Gemini Model" to your desired model

2. **Via settings.json:**
   ```json
   {
     "codecrypt.geminiModel": "gemini-3-pro-preview"
   }
   ```

### Supported Models

- `gemini-3-pro-preview` (default) ⭐ Recommended - Latest model with enhanced capabilities

### Setting the LLM Provider

To use Gemini instead of Anthropic:

```json
{
  "codecrypt.llmProvider": "gemini",
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

Or use the command palette:
- `CodeCrypt: Switch LLM Provider`

## API Key Configuration

You'll need to configure your Gemini API key:

1. Run command: `CodeCrypt: Configure Gemini API Key`
2. Enter your API key when prompted
3. The key is stored securely in VS Code's secret storage

## How It Works

The Gemini model configuration is used in two places:

1. **createLLMClient()** - When creating a new LLM client via the helper function
2. **ResurrectionOrchestrator** - When running hybrid analysis during resurrection

The system will:
1. Read the `codecrypt.geminiModel` setting
2. Pass it to the GeminiClient constructor
3. Use that model for all code analysis requests

## Fallback Behavior

If Gemini fails (network issues, API errors, etc.), CodeCrypt will:
1. Try Anthropic if an API key is configured
2. Fall back to AST-only analysis if no LLM providers work
3. Continue the resurrection process without crashing

## Example Usage

For users with `gemini-3-pro-preview` API access:

```json
{
  "codecrypt.llmProvider": "gemini",
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

The system will log which model is being used:
```
[INFO] Using Gemini model: gemini-3-pro-preview
[INFO] Gemini client initialized with model: gemini-3-pro-preview
```

## Troubleshooting

If you see errors about model not found:
1. Verify your API key has access to the specified model
2. Check the model name is spelled correctly
3. Ensure you're using `gemini-3-pro-preview` which is the current recommended model
4. Check the logs for detailed error messages

For comprehensive troubleshooting, see:
- [TROUBLESHOOTING.md](../../../TROUBLESHOOTING.md) - Complete troubleshooting guide
- [DEMO_CRITICAL_FIXES.md](../../../DEMO_CRITICAL_FIXES.md) - Detailed documentation of all fixes

## Implementation Details

- Configuration is read from `vscode.workspace.getConfiguration('codecrypt')`
- Default model is `gemini-3-pro-preview` for best compatibility
- Model name is passed to `GoogleGenerativeAI.getGenerativeModel()`
- The same model is used for all analysis requests in a session
- Automatic fallback to Anthropic if Gemini fails (when both are configured)
