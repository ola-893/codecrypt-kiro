# 🧟 CodeCrypt

Bring dead code back to life with AI-powered modernization and dependency resurrection.

## Features

CodeCrypt is an autonomous AI agent that resurrects abandoned software projects by:

- 🔍 **Death Detection**: Analyzes repository activity and generates a "Death Certificate"
- 📦 **Dependency Analysis**: Identifies outdated dependencies and security vulnerabilities
- 🤖 **Hybrid Analysis**: Combines AST (Abstract Syntax Tree) analysis with LLM semantic understanding
- 🔄 **Automated Updates**: Intelligently updates dependencies with validation and rollback
- 🐳 **Time Machine Validation**: Tests original vs. modernized code in Docker containers
- 📊 **Live Dashboard**: Real-time metrics visualization with Chart.js
- 🎙️ **AI Narration**: Audio commentary on the resurrection process
- 🏙️ **3D Ghost Tour**: Interactive 3D visualization of code evolution
- 🎵 **Resurrection Symphony**: Musical representation of code quality metrics

## Requirements

- VS Code 1.106.1 or higher
- Node.js (for npm-based projects)
- Docker (optional, for Time Machine validation)
- API key for LLM provider (Anthropic Claude or Google Gemini)

## LLM Provider Setup

CodeCrypt supports two LLM providers for semantic code analysis with intelligent fallback:

### Anthropic Claude (Recommended)

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. Run command: `CodeCrypt: Configure Anthropic API Key` (or it will prompt you automatically)
3. Enter your API key starting with `sk-ant-`

### Google Gemini

1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Run command: `CodeCrypt: Configure Gemini API Key`
3. Enter your API key starting with `AIza`
4. Switch provider: `CodeCrypt: Switch LLM Provider` and select "Google Gemini"

### Configurable Gemini Models

You can choose which Gemini model to use:

```json
{
  "codecrypt.llmProvider": "gemini",
  "codecrypt.geminiModel": "gemini-1.5-flash-latest"
}
```

**Supported Models:**
- `gemini-1.5-flash-latest` (recommended) - Fast and efficient
- `gemini-1.5-pro` - More capable reasoning
- `gemini-3.0-pro` - Latest model (requires API access)
- `gemini-pro` - Stable fallback

### Intelligent Fallback Chain

CodeCrypt automatically falls back if the primary provider fails:

```
Primary LLM → Fallback LLM → AST-only Analysis
```

**Best Practice:** Configure both providers for maximum reliability:
- Primary: Your preferred provider (Gemini or Anthropic)
- Fallback: The other provider
- Final: AST-only analysis (always available)

This ensures resurrection continues even if one provider has issues.

### Provider Comparison

| Feature | Anthropic Claude | Google Gemini |
|---------|-----------------|---------------|
| Model | claude-3-5-sonnet-20241022 | gemini-1.5-flash-latest (configurable) |
| Context Window | Large | Large |
| Code Understanding | Excellent | Excellent |
| Cost | Pay per token | Free tier available |
| Setup | API key required | API key required |
| Fallback Support | ✅ Yes | ✅ Yes |

## Extension Settings

This extension contributes the following settings:

* `codecrypt.llmProvider`: Choose LLM provider for semantic analysis (`anthropic` or `gemini`)
* `codecrypt.geminiModel`: Configure which Gemini model to use (default: `gemini-1.5-flash-latest`)
* `codecrypt.mcpServers`: Configure MCP server connections for external integrations

## Commands

- `🧟 CodeCrypt: Resurrect Repository` - Start the resurrection process for a GitHub repository
- `🔒 CodeCrypt: Configure GitHub Token` - Set up GitHub authentication
- `🔑 CodeCrypt: Configure Gemini API Key` - Set up Google Gemini API key
- `🔄 CodeCrypt: Switch LLM Provider` - Switch between Anthropic and Gemini
- `🗑️ CodeCrypt: Clear All Secrets` - Remove all stored API keys

## Getting Started

1. Install the extension
2. Configure your LLM provider (Anthropic or Gemini)
3. Run `CodeCrypt: Resurrect Repository`
4. Enter a GitHub repository URL
5. Watch the magic happen! 🧟✨

## Configuration Examples

### Using Anthropic Claude (Recommended)

```json
{
  "codecrypt.llmProvider": "anthropic"
}
```

### Using Google Gemini with Custom Model

```json
{
  "codecrypt.llmProvider": "gemini",
  "codecrypt.geminiModel": "gemini-1.5-flash-latest"
}
```

### Maximum Reliability (Both Providers)

Configure both providers for automatic fallback:

```json
{
  "codecrypt.llmProvider": "gemini",
  "codecrypt.geminiModel": "gemini-1.5-flash-latest"
}
```

Then configure both API keys:
- `CodeCrypt: Configure Gemini API Key`
- `CodeCrypt: Configure Anthropic API Key`

If Gemini fails, Anthropic automatically takes over.

### Environment Variables (Alternative)

You can also set API keys via environment variables:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export GEMINI_API_KEY="AIza..."
```

## Security

- All API keys are stored securely using VS Code's SecretStorage API
- Keys are never logged or exposed in error messages
- Environment variables are sanitized before logging
- MCP server credentials are validated for security patterns

## Resilient Error Handling

CodeCrypt is designed to handle failures gracefully:

### Dead URL Detection
- Automatically detects dead GitHub tarball URLs (404 errors)
- Attempts to resolve packages from npm registry
- Continues with available packages if some fail
- Reports detailed summary of successful vs failed updates

### Build Script Detection
- Intelligently detects if a project requires compilation
- Skips compilation validation for projects without build scripts
- Supports alternative build tools (Gulp, Grunt, Webpack)
- Clearly distinguishes "not applicable" from "failed"

### Partial Success Reporting
- Resurrection can succeed even if some operations fail
- Detailed summary shows what succeeded and what failed
- Provides actionable information for manual fixes
- Marks results as `partialSuccess: true` when appropriate

### LLM Provider Fallback
- Automatically switches providers if primary fails
- Falls back to AST-only analysis if no LLM available
- Continues resurrection without crashing
- Logs which provider was used and why

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed guidance.

## Known Issues

- Time Machine validation requires Docker to be installed and running
- 3D Ghost Tour requires WebGL support in the browser
- Audio features require browser support for Web Speech API
- Some Gemini models require special API access (use `gemini-1.5-flash-latest` for best compatibility)

## Documentation

- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference for common tasks ⚡
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide
- **[DEMO_CRITICAL_FIXES.md](./DEMO_CRITICAL_FIXES.md)** - Detailed documentation of resilience features
- **[SECURITY.md](./SECURITY.md)** - Security implementation details

## Release Notes

### 0.0.1

Initial release with:
- Death detection and analysis
- Dependency resurrection
- Hybrid AST + LLM analysis
- Time Machine validation
- Live dashboard and visualizations
- Support for both Anthropic Claude and Google Gemini
- Intelligent LLM provider fallback
- Automatic dead URL detection and resolution
- Smart build script detection
- Partial success reporting

---

## Contributing

This is a Kiroween Hackathon project with a "resurrection" theme. All naming, UI/UX, and documentation embrace the spooky/gothic aesthetic.

## License

See LICENSE file for details.

**Enjoy resurrecting your code! 🧟**
