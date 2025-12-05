# CodeCrypt Quick Reference

Quick reference for common tasks and configurations.

## LLM Provider Configuration

### Switch Provider

```bash
# Via Command Palette
CodeCrypt: Switch LLM Provider
```

### Configure API Keys

```bash
# Anthropic
CodeCrypt: Configure Anthropic API Key

# Gemini
CodeCrypt: Configure Gemini API Key
```

### Choose Gemini Model

```json
{
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

**Available Model:**
- `gemini-3-pro-preview` ⭐ Recommended (default)

## Fallback Configuration

### Maximum Reliability Setup

1. **Configure both providers:**
   ```bash
   CodeCrypt: Configure Gemini API Key
   CodeCrypt: Configure Anthropic API Key
   ```

2. **Set primary provider:**
   ```json
   {
     "codecrypt.llmProvider": "gemini",
     "codecrypt.geminiModel": "gemini-3-pro-preview"
   }
   ```

3. **Fallback chain activates automatically:**
   ```
   Gemini → Anthropic → AST-only
   ```

## Common Issues

### Gemini 404 Error

**Error:** `404 - Model not found`

**Fix:**
```json
{
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

### Dead URL Error

**Error:** `404 Not Found - GET https://github.com/...tar.gz`

**Fix:** Automatic! CodeCrypt detects and resolves to npm registry.

**Manual Fix (if needed):**
```json
// Change from:
"package": "https://github.com/user/repo/archive/1.0.0.tar.gz"

// To:
"package": "^1.0.0"
```

### Missing Build Script

**Message:** `Compilation validation: not_applicable`

**This is normal!** Many projects don't need compilation.

**If you need compilation, add:**
```json
{
  "scripts": {
    "build": "tsc"  // or your build command
  }
}
```

## Validation Status

| Status | Meaning | Action |
|--------|---------|--------|
| `passed` | ✅ Succeeded | None |
| `failed` | ❌ Failed | Review errors |
| `not_applicable` | ⏭️ Skipped | None (normal) |

## Partial Success

**Message:** `Resurrection completed with partial success`

**This is success!** Some operations succeeded, system is improved.

**Check:**
- Which dependencies succeeded/failed
- Which validations passed/skipped
- Review suggestions for manual fixes

## Commands

```bash
# Start resurrection
CodeCrypt: Resurrect Repository

# Configure providers
CodeCrypt: Configure Anthropic API Key
CodeCrypt: Configure Gemini API Key
CodeCrypt: Switch LLM Provider

# Manage secrets
CodeCrypt: Configure GitHub Token
CodeCrypt: Clear All Secrets
```

## Configuration Examples

### Anthropic Only
```json
{
  "codecrypt.llmProvider": "anthropic"
}
```

### Gemini Only
```json
{
  "codecrypt.llmProvider": "gemini",
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

### Both (Recommended)
```json
{
  "codecrypt.llmProvider": "gemini",
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```
Then configure both API keys for automatic fallback.

## Logs

**View logs:**
1. Open Output panel (View → Output)
2. Select "CodeCrypt" from dropdown

**Look for:**
- `[INFO]` - Normal operations
- `[WARN]` - Warnings (fallback, skipped operations)
- `[ERROR]` - Errors (with context and suggestions)

## Getting Help

1. **Check logs** - Output channel has detailed info
2. **Review report** - Resurrection summary shows what happened
3. **See troubleshooting** - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
4. **Read detailed docs** - [DEMO_CRITICAL_FIXES.md](./DEMO_CRITICAL_FIXES.md)

## Quick Diagnostics

### Test LLM Connection
1. Configure API key
2. Run resurrection on small repo
3. Check output for LLM messages

### Test npm
```bash
cd /path/to/repo
npm install
npm test
```

### Reset Everything
```bash
# Clear all secrets
CodeCrypt: Clear All Secrets

# Reconfigure
CodeCrypt: Configure Anthropic API Key
CodeCrypt: Configure Gemini API Key
```

## Best Practices

✅ **Do:**
- Configure both LLM providers for reliability
- Use `gemini-3-pro-preview` for best compatibility
- Review partial success reports
- Check logs for detailed information

❌ **Don't:**
- Panic if some operations fail (partial success is good!)
- Assume "not_applicable" means failure
- Ignore the fallback chain
- Skip reading error messages

---

**For detailed information, see:**
- [README.md](./README.md) - Full documentation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Problem solving
- [DEMO_CRITICAL_FIXES.md](./DEMO_CRITICAL_FIXES.md) - Feature details
- [SECURITY.md](./SECURITY.md) - Security information

🧟✨
