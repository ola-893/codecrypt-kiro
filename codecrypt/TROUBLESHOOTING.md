# CodeCrypt Troubleshooting Guide

This guide helps you diagnose and resolve common issues when resurrecting repositories with CodeCrypt.

## Table of Contents

- [LLM Provider Issues](#llm-provider-issues)
- [Dependency Installation Failures](#dependency-installation-failures)
- [Build and Compilation Issues](#build-and-compilation-issues)
- [Validation Failures](#validation-failures)
- [General Tips](#general-tips)

---

## LLM Provider Issues

### Gemini API Model Not Found (404 Error)

**Symptoms:**
```
Error: Gemini API error: 404 - Model not found
```

**Causes:**
- The specified model is not available in your API version
- Your API key doesn't have access to the requested model
- Model name is misspelled or outdated

**Solutions:**

1. **Update to the supported model:**
   ```json
   {
     "codecrypt.geminiModel": "gemini-3-pro-preview"
   }
   ```

2. **Verify your API key has access:**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Check which models are available for your API key
   - Some models require special access or billing enabled

3. **Check the model name:**
   - Ensure no typos in the model name
   - Use the officially supported model: `gemini-3-pro-preview` (recommended)

4. **Let the system fall back:**
   - CodeCrypt will automatically try Anthropic if configured
   - If no LLM works, it continues with AST-only analysis
   - Check the output for fallback messages

### LLM Provider Fallback Chain

CodeCrypt uses an intelligent fallback strategy:

```
Gemini (primary) → Anthropic (fallback) → AST-only (final fallback)
```

**Configuration for robust fallback:**

```json
{
  "codecrypt.llmProvider": "gemini",
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

Then configure both API keys:
- Run: `CodeCrypt: Configure Gemini API Key`
- Run: `CodeCrypt: Configure Anthropic API Key`

This ensures if Gemini fails, Anthropic takes over automatically.

### Anthropic API Issues

**Symptoms:**
```
Error: Anthropic API error: 401 - Invalid API key
```

**Solutions:**

1. **Verify your API key:**
   - Should start with `sk-ant-`
   - Get a new key from [Anthropic Console](https://console.anthropic.com/)
   - Run: `CodeCrypt: Configure Anthropic API Key`

2. **Check API key permissions:**
   - Ensure the key has access to Claude models
   - Verify billing is set up if required

### No LLM Provider Available

**Symptoms:**
```
[WARN] No LLM provider available, using AST-only analysis
```

**Impact:**
- Resurrection continues but without semantic understanding
- May miss some modernization opportunities
- Still updates dependencies and fixes basic issues

**Solutions:**

1. **Configure at least one LLM provider:**
   - Gemini: `CodeCrypt: Configure Gemini API Key`
   - Anthropic: `CodeCrypt: Configure Anthropic API Key`

2. **Verify provider selection:**
   ```json
   {
     "codecrypt.llmProvider": "anthropic"  // or "gemini"
   }
   ```

---

## Dependency Installation Failures

### Dead URL Errors (404 Not Found)

**Symptoms:**
```
npm error 404 Not Found - GET https://github.com/user/package/archive/1.0.0.tar.gz
npm error 404 'package@https://github.com/...' is not in this registry
```

**Causes:**
- Old package.json references GitHub tarball URLs that no longer exist
- Repository was deleted or moved
- Specific version/tag was removed

**How CodeCrypt Handles This:**

CodeCrypt automatically detects and resolves dead URLs:

1. **Detection:** Identifies 404 errors for GitHub tarball URLs
2. **Resolution:** Attempts to find the package in npm registry
3. **Replacement:** Updates package.json with working npm registry URL
4. **Fallback:** If package doesn't exist anywhere, marks it as failed and continues

**Manual Resolution:**

If automatic resolution fails, you can manually fix package.json:

```json
// Before (dead URL)
{
  "dependencies": {
    "querystring": "https://github.com/substack/querystring/archive/0.2.0.tar.gz"
  }
}

// After (npm registry)
{
  "dependencies": {
    "querystring": "^0.2.0"
  }
}
```

### Multiple Dependencies Failing

**Symptoms:**
```
[ERROR] Failed to update 5 dependencies
[INFO] Successfully updated 3 dependencies
```

**What CodeCrypt Does:**

- Continues with successful updates (partial success)
- Reports which dependencies failed and why
- Marks resurrection as `partialSuccess: true`
- Provides detailed summary in final report

**Review the Summary:**

Check the resurrection report for:
- `dependencyUpdateSummary.succeeded`: Number of successful updates
- `dependencyUpdateSummary.failed`: Number of failed updates
- Individual error messages for each failure

**Common Causes:**

1. **Dead URLs:** See above section
2. **Version conflicts:** Incompatible dependency versions
3. **Network issues:** Temporary npm registry problems
4. **Deprecated packages:** Package no longer exists

**Solutions:**

1. **Review failed dependencies:**
   - Check if they're still needed
   - Look for modern alternatives
   - Consider removing obsolete dependencies

2. **Manual intervention:**
   - Update package.json manually for problematic packages
   - Run `npm install` to verify fixes
   - Re-run CodeCrypt resurrection

---

## Build and Compilation Issues

### Missing Build Script

**Symptoms:**
```
[INFO] No build script detected in package.json
[INFO] Compilation validation: not_applicable
```

**This is Normal!**

Many projects don't require compilation:
- Pure JavaScript projects
- Projects without a build step
- Libraries that don't need transpilation

**How CodeCrypt Handles This:**

1. **Detection:** Checks package.json for build scripts before attempting compilation
2. **Smart Skip:** Marks compilation as "not applicable" instead of "failed"
3. **Continues:** Proceeds with other validations (tests, if available)
4. **Reports:** Clearly indicates compilation was skipped, not failed

**Build Script Detection:**

CodeCrypt looks for these scripts in order:
1. `"build"` - Standard build script
2. `"compile"` - Compilation script
3. `"prepare"` or `"prepublish"` - Pre-publish build
4. Alternative build tools:
   - `gulpfile.js` → runs `gulp build` or `gulp`
   - `Gruntfile.js` → runs `grunt build` or `grunt`
   - `webpack.config.js` → runs `webpack`

**If You Need Compilation:**

Add a build script to package.json:

```json
{
  "scripts": {
    "build": "tsc",  // TypeScript
    // or
    "build": "babel src -d dist",  // Babel
    // or
    "build": "webpack"  // Webpack
  }
}
```

### Compilation Fails After Resurrection

**Symptoms:**
```
[ERROR] Compilation failed with exit code 1
```

**Causes:**
- TypeScript errors after dependency updates
- Breaking changes in updated packages
- Missing type definitions

**Solutions:**

1. **Check the error output:**
   - Review compilation errors in the output
   - Identify which files/packages are causing issues

2. **Update TypeScript types:**
   ```bash
   npm install --save-dev @types/node @types/react
   ```

3. **Fix breaking changes:**
   - Review changelogs for updated packages
   - Update code to match new APIs
   - Consider using CodeCrypt's LLM analysis for suggestions

4. **Incremental approach:**
   - Update dependencies one at a time
   - Test compilation after each update
   - Identify which update caused the break

---

## Validation Failures

### Understanding Validation Status

CodeCrypt reports three validation statuses:

- **`passed`**: Validation succeeded
- **`failed`**: Validation ran but failed
- **`not_applicable`**: Validation was skipped (not needed)

**Example Report:**

```json
{
  "validationSummary": {
    "compilationStatus": "not_applicable",  // No build script
    "testsStatus": "passed"                 // Tests ran and passed
  }
}
```

### Validation Loop (Repeated Failures)

**Symptoms:**
- Validation runs multiple times
- Same errors repeat
- Process seems stuck

**How CodeCrypt Prevents This:**

1. **Retry Limit:** Maximum 3 attempts per validation
2. **Stop on Repeated Failure:** Stops retrying after 3 identical failures
3. **Reports Final State:** Clearly indicates validation failed after retries

**If You See This:**

The validation genuinely failed - manual intervention needed:
1. Review the error messages
2. Fix the underlying issues
3. Re-run resurrection

### Partial Success

**Symptoms:**
```
[INFO] Resurrection completed with partial success
[INFO] 3 of 5 dependencies updated successfully
[INFO] Compilation: not_applicable
[INFO] Tests: passed
```

**This is Success!**

Partial success means:
- Core functionality was improved
- Some operations succeeded
- System is in a better state than before

**What to Do:**

1. **Review the summary:**
   - Check which dependencies succeeded
   - Identify which failed and why
   - Determine if failures are critical

2. **Manual fixes:**
   - Address failed dependencies manually if needed
   - Update code for breaking changes
   - Re-run tests

3. **Accept the improvement:**
   - Even partial success is valuable
   - System is more secure and modern
   - Can iterate further if needed

---

## General Tips

### Enable Detailed Logging

For debugging, check the CodeCrypt output channel:
1. Open Output panel (View → Output)
2. Select "CodeCrypt" from dropdown
3. Review detailed logs

### Check Prerequisites

Before resurrecting a repository:

- [ ] Node.js is installed
- [ ] npm is available
- [ ] At least one LLM provider is configured
- [ ] GitHub token is configured (for private repos)
- [ ] Docker is running (for Time Machine validation)

### Common Configuration

Recommended settings for reliability:

```json
{
  "codecrypt.llmProvider": "anthropic",
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

Configure both API keys for automatic fallback:
- `CodeCrypt: Configure Anthropic API Key`
- `CodeCrypt: Configure Gemini API Key`

### Getting Help

If you encounter issues not covered here:

1. **Check the logs:**
   - Output channel has detailed error messages
   - Look for `[ERROR]` and `[WARN]` messages

2. **Review the resurrection report:**
   - Contains summary of all operations
   - Identifies what succeeded and what failed

3. **File an issue:**
   - Include relevant log excerpts
   - Describe the repository being resurrected
   - Share your configuration (redact API keys!)

### Performance Tips

For large repositories:

1. **Use the recommended model:**
   ```json
   {
     "codecrypt.geminiModel": "gemini-3-pro-preview"
   }
   ```

2. **Skip optional validations:**
   - Focus on critical updates first
   - Run full validation separately

3. **Incremental resurrection:**
   - Update dependencies in batches
   - Validate after each batch

---

## Error Message Reference

### LLM Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| `404 - Model not found` | Model doesn't exist or no access | Update model name or API key |
| `401 - Invalid API key` | API key is wrong or expired | Reconfigure API key |
| `429 - Rate limit` | Too many requests | Wait and retry |
| `Network error` | Connection failed | Check internet connection |

### Dependency Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| `404 Not Found - GitHub URL` | Dead tarball URL | Automatic resolution or manual fix |
| `ENOTFOUND` | Package doesn't exist | Remove or find alternative |
| `ETARGET` | Version conflict | Update version constraints |
| `ERESOLVE` | Dependency conflict | Review and resolve conflicts |

### Validation Errors

| Status | Meaning | Action |
|--------|---------|--------|
| `not_applicable` | Validation skipped (normal) | None needed |
| `failed` | Validation ran but failed | Review errors and fix |
| `passed` | Validation succeeded | Success! |

---

## Quick Fixes

### Reset Everything

If things are really broken:

```bash
# Clear all secrets
# Run command: CodeCrypt: Clear All Secrets

# Reconfigure
# Run command: CodeCrypt: Configure Anthropic API Key
# Run command: CodeCrypt: Configure Gemini API Key

# Try again
# Run command: CodeCrypt: Resurrect Repository
```

### Test LLM Connection

Verify your LLM provider works:

1. Configure API key
2. Run resurrection on a small test repo
3. Check output for LLM analysis messages

### Verify npm Works

Test npm outside CodeCrypt:

```bash
cd /path/to/repo
npm install
npm test
npm run build
```

If these fail, fix npm issues first before using CodeCrypt.

---

**Remember:** CodeCrypt is designed to handle failures gracefully. Partial success is still success! 🧟✨
