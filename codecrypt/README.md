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
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

**Supported Model:**
- `gemini-3-pro-preview` (recommended, default) - Latest model with enhanced capabilities

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
| Model | claude-3-5-sonnet-20241022 | gemini-3-pro-preview (configurable) |
| Context Window | Large | Large |
| Code Understanding | Excellent | Excellent |
| Cost | Pay per token | Free tier available |
| Setup | API key required | API key required |
| Fallback Support | ✅ Yes | ✅ Yes |

## Extension Settings

This extension contributes the following settings:

* `codecrypt.llmProvider`: Choose LLM provider for semantic analysis (`anthropic` or `gemini`)
* `codecrypt.geminiModel`: Configure which Gemini model to use (default: `gemini-3-pro-preview`)
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
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

### Maximum Reliability (Both Providers)

Configure both providers for automatic fallback:

```json
{
  "codecrypt.llmProvider": "gemini",
  "codecrypt.geminiModel": "gemini-3-pro-preview"
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

## Dead URL Detection

CodeCrypt automatically detects and resolves dead URLs in both direct and transitive dependencies, ensuring your resurrection process doesn't fail due to inaccessible package sources.

### What are Dead URLs?

Dead URLs are dependencies specified as direct URLs (GitHub tarballs, git repositories, etc.) that are no longer accessible. Common examples include:

- **GitHub Archive URLs**: `https://github.com/user/repo/archive/v1.0.0.tar.gz`
- **Git Repository URLs**: `git+https://github.com/user/repo.git#commit-hash`
- **Direct Tarball URLs**: `https://example.com/package.tar.gz`

These URLs often become dead when:
- Repositories are deleted or made private
- GitHub changes URL formats
- Hosting services go offline
- Specific commits or tags are removed

### Direct vs. Transitive Dependencies

**Direct Dependencies** are listed explicitly in your `package.json`:
```json
{
  "dependencies": {
    "querystring": "https://github.com/substack/querystring/archive/0.2.0.tar.gz"
  }
}
```

**Transitive Dependencies** are dependencies of your dependencies, found in lockfiles but not in `package.json`:
```json
// In package-lock.json
{
  "packages": {
    "node_modules/some-package/node_modules/querystring": {
      "resolved": "https://github.com/substack/querystring/archive/0.2.0.tar.gz"
    }
  }
}
```

### How CodeCrypt Detects Dead URLs

CodeCrypt uses a multi-layered approach to detect and resolve dead URLs:

#### 1. Lockfile Parsing

CodeCrypt parses your project's lockfile to extract all URL-based dependencies:

- **npm**: `package-lock.json` (v1, v2, and v3 formats)
- **Yarn**: `yarn.lock` (v1 and v2 formats)
- **pnpm**: `pnpm-lock.yaml`

The parser extracts:
- Package names and resolved URLs
- Parent dependency chains (which packages depend on this)
- Dependency depth (how deep in the tree)

#### 2. URL Validation

For each URL-based dependency (direct or transitive), CodeCrypt:
1. Sends an HTTP HEAD request to check accessibility
2. Follows redirects (up to 5 hops)
3. Validates response status (200 = OK, 404 = dead)
4. Handles network timeouts gracefully

#### 3. Package Replacement Registry

CodeCrypt maintains a curated registry of known dead URLs and their replacements:

```json
{
  "deadUrlPatterns": [
    {
      "pattern": "github.com/substack/querystring/*",
      "replacementPackage": "querystring",
      "replacementVersion": "^0.2.1",
      "reason": "Old GitHub tarball URL no longer accessible. Package is available on npm registry."
    }
  ]
}
```

**Wildcard Support**: Patterns support wildcards (`*`) to match multiple URLs:
- `github.com/user/*` - Matches all packages from a user
- `github.com/*/archive/*.tar.gz` - Matches all GitHub archive URLs

#### 4. Automatic Resolution

When a dead URL is detected, CodeCrypt attempts resolution in this order:

1. **Registry Match**: Check if URL matches a known pattern in the replacement registry
2. **npm Registry Lookup**: Search for the package on npm by name
3. **Parent Removal**: If unresolvable, remove the parent dependency and log a warning

#### 5. Lockfile Regeneration

After resolving dead URLs in `package.json`, CodeCrypt:
1. Deletes all existing lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`)
2. Runs `npm install` to regenerate with resolved dependencies
3. Validates the new lockfile contains no dead URLs

### Example: Resolving a Dead URL

**Before Resurrection:**
```json
// package.json
{
  "dependencies": {
    "express": "^4.17.1"
  }
}

// package-lock.json (transitive dependency)
{
  "packages": {
    "node_modules/express/node_modules/querystring": {
      "resolved": "https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz"
    }
  }
}
```

**CodeCrypt Detection:**
```
🔍 Parsing lockfile: package-lock.json
📦 Found 1 URL-based dependency: querystring
🌐 Validating URL: https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz
❌ Dead URL detected (404 Not Found)
🔎 Checking replacement registry...
✅ Match found: github.com/substack/querystring/*
🔄 Replacing with: querystring@^0.2.1 from npm registry
```

**After Resurrection:**
```json
// package.json (unchanged - transitive dependency)
{
  "dependencies": {
    "express": "^4.17.1"
  }
}

// package-lock.json (regenerated with npm registry version)
{
  "packages": {
    "node_modules/querystring": {
      "version": "0.2.1",
      "resolved": "https://registry.npmjs.org/querystring/-/querystring-0.2.1.tgz"
    }
  }
}
```

### Adding Custom Registry Entries

You can add your own dead URL patterns to the registry at `data/package-replacement-registry.json`:

```json
{
  "deadUrlPatterns": [
    {
      "pattern": "github.com/your-org/your-package/*",
      "replacementPackage": "your-package",
      "replacementVersion": "^2.0.0",
      "reason": "Migrated to npm registry"
    }
  ]
}
```

### Resurrection Report

The resurrection report includes a "Dead URL Resolution" section showing:

- **Resolved**: URLs successfully replaced with npm registry versions
- **Removed**: Parent dependencies removed due to unresolvable transitive URLs
- **Failed**: URLs that couldn't be resolved (manual intervention needed)

Each entry includes:
- Package name and dead URL
- Parent dependency chain (for transitive dependencies)
- Resolution strategy used
- Helpful explanations for known problematic sources

## Package Replacement Registry

CodeCrypt maintains a curated registry of known dead URLs and deprecated packages, enabling automatic resolution of common dependency issues without manual intervention. This registry is particularly useful for handling packages that have migrated from GitHub tarballs to npm, or packages with known problematic URL patterns.

### Registry Location

The package replacement registry is located at:

```
data/package-replacement-registry.json
```

This JSON file contains patterns for matching dead URLs and their corresponding replacements from the npm registry.

### Registry Structure

The registry consists of two main sections:

#### 1. Dead URL Patterns

The `deadUrlPatterns` array contains entries for known dead or problematic URLs:

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

**Field Descriptions:**

- **`pattern`** (required): URL pattern to match against. Supports wildcards (`*`) for flexible matching.
- **`replacementPackage`** (optional): The npm package name to use as a replacement. If `null`, CodeCrypt will attempt to find the package on npm by name.
- **`replacementVersion`** (optional): The version or version range to install (e.g., `"^0.2.1"`, `"latest"`). If `null`, uses the latest version.
- **`reason`** (required): Human-readable explanation of why this replacement is needed. Appears in resurrection reports.

#### 2. Deprecated Packages

The registry can also include deprecated package replacements (for future expansion):

```json
{
  "deprecatedPackages": [
    {
      "packageName": "request",
      "replacementPackage": "axios",
      "replacementVersion": "^1.0.0",
      "reason": "request is deprecated. axios is the recommended alternative."
    }
  ]
}
```

### Wildcard Pattern Matching

The registry supports powerful wildcard patterns for matching multiple URLs:

#### Single Wildcard (`*`)

Matches any characters within a single path segment:

```json
{
  "pattern": "github.com/substack/*",
  "reason": "Matches all packages from substack's GitHub"
}
```

**Matches:**
- `github.com/substack/querystring`
- `github.com/substack/node-browserify`
- `github.com/substack/minimist`

**Does NOT match:**
- `github.com/other-user/package`
- `github.com/substack/nested/path` (multiple segments)

#### Multiple Wildcards

Use multiple wildcards for complex patterns:

```json
{
  "pattern": "github.com/*/archive/*.tar.gz",
  "reason": "Matches all GitHub archive tarball URLs"
}
```

**Matches:**
- `github.com/user/archive/v1.0.0.tar.gz`
- `github.com/org/archive/master.tar.gz`
- `github.com/anyone/archive/anything.tar.gz`

#### Specific Package Versions

Match specific version patterns:

```json
{
  "pattern": "github.com/lodash/lodash/archive/4.17.*.tar.gz",
  "replacementPackage": "lodash",
  "replacementVersion": "^4.17.21",
  "reason": "Old 4.17.x GitHub tarballs are dead. Use npm registry."
}
```

### How to Add Registry Entries

Follow these steps to add your own dead URL patterns:

#### Step 1: Identify the Dead URL

Find the dead URL in your lockfile or error messages:

```
❌ Dead URL detected: https://github.com/user/old-package/archive/v1.0.0.tar.gz
```

#### Step 2: Create a Pattern

Create a pattern that matches this URL and similar ones:

```json
{
  "pattern": "github.com/user/old-package/*"
}
```

**Tips for creating patterns:**
- Use `*` to match version numbers: `github.com/user/package/*/archive.tar.gz`
- Use `*` to match multiple packages: `github.com/user/*`
- Be specific enough to avoid false matches
- Test your pattern against known URLs

#### Step 3: Specify the Replacement

Determine the npm package and version to use:

```json
{
  "pattern": "github.com/user/old-package/*",
  "replacementPackage": "old-package",
  "replacementVersion": "^2.0.0"
}
```

**Finding the replacement:**
1. Search npm: `npm search old-package`
2. Check package page: `https://www.npmjs.com/package/old-package`
3. Verify it's the same package (check description, author, repo)
4. Choose appropriate version (usually latest stable)

#### Step 4: Add a Reason

Provide a clear explanation for the replacement:

```json
{
  "pattern": "github.com/user/old-package/*",
  "replacementPackage": "old-package",
  "replacementVersion": "^2.0.0",
  "reason": "GitHub repository was deleted. Package is now maintained on npm registry."
}
```

#### Step 5: Add to Registry

Edit `data/package-replacement-registry.json` and add your entry:

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
      "pattern": "github.com/user/old-package/*",
      "replacementPackage": "old-package",
      "replacementVersion": "^2.0.0",
      "reason": "GitHub repository was deleted. Package is now maintained on npm registry."
    }
  ]
}
```

### Complete Example

Here's a complete example showing various pattern types:

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
    },
    {
      "pattern": "bitbucket.org/*/get/*.tar.gz",
      "replacementPackage": null,
      "replacementVersion": null,
      "reason": "Bitbucket archive URLs may be inaccessible. Try npm registry."
    },
    {
      "pattern": "github.com/lodash/lodash/archive/4.17.*.tar.gz",
      "replacementPackage": "lodash",
      "replacementVersion": "^4.17.21",
      "reason": "Old lodash 4.17.x GitHub tarballs are dead. Use latest 4.17.x from npm."
    }
  ],
  "deprecatedPackages": []
}
```

### Pattern Matching Priority

When multiple patterns match a URL, CodeCrypt uses the **first match** in the registry. Order your patterns from most specific to most general:

```json
{
  "deadUrlPatterns": [
    {
      "pattern": "github.com/user/specific-package/archive/v1.0.0.tar.gz",
      "comment": "Most specific - exact URL"
    },
    {
      "pattern": "github.com/user/specific-package/*",
      "comment": "Specific package, any version"
    },
    {
      "pattern": "github.com/user/*",
      "comment": "All packages from user"
    },
    {
      "pattern": "github.com/*/archive/*.tar.gz",
      "comment": "Most general - any GitHub archive"
    }
  ]
}
```

### Automatic Application

When CodeCrypt detects a dead URL that matches a registry pattern:

1. **Pattern Match**: Checks URL against all patterns in order
2. **Automatic Replacement**: Applies the registered replacement without URL validation
3. **Logging**: Logs the replacement action for transparency
4. **Report**: Includes replacement details in the resurrection report

**Example Output:**

```
🔍 Dead URL detected: https://github.com/substack/querystring/archive/0.2.0.tar.gz
✅ Registry match found: github.com/substack/querystring/*
🔄 Applying automatic replacement: querystring@^0.2.1
📝 Reason: Old GitHub tarball URL no longer accessible. Package is available on npm registry.
```

### Testing Your Registry Entries

After adding entries, test them:

1. **Find a test repository** with the dead URL
2. **Run resurrection**: `CodeCrypt: Resurrect Repository`
3. **Check logs**: Verify pattern matched and replacement applied
4. **Verify result**: Ensure `npm install` succeeds with replacement

### Contributing Registry Entries

If you discover dead URLs that others might encounter:

1. Add the pattern to your local registry
2. Test thoroughly with real repositories
3. Document the reason clearly
4. Consider contributing back to the project

### Troubleshooting Registry Issues

**Problem:** Pattern doesn't match expected URLs

**Solutions:**
- Check wildcard placement (must match full path segments)
- Test pattern with simple string matching first
- Verify URL format (with/without protocol, trailing slashes)
- Check for typos in the pattern

**Problem:** Wrong replacement is applied

**Solutions:**
- Check pattern order (more specific patterns should come first)
- Verify `replacementPackage` name matches npm exactly
- Test replacement manually: `npm install <replacementPackage>@<version>`

**Problem:** Registry changes not taking effect

**Solutions:**
- Restart VS Code to reload the registry
- Check JSON syntax (use a JSON validator)
- Verify file location: `data/package-replacement-registry.json`
- Check file permissions (must be readable)

## Resurrection Report Enhancements

CodeCrypt generates comprehensive resurrection reports that include detailed information about dead URL resolution, making it easy to understand what was fixed, what was removed, and what might need manual intervention.

### Dead URL Resolution Section

Every resurrection report includes a dedicated "Dead URL Resolution" section that provides complete transparency about how dead URLs were handled during the resurrection process.

#### Report Structure

The report groups dead URLs by their resolution status:

1. **✅ Resolved** - URLs successfully replaced with npm registry versions
2. **🗑️ Removed** - Parent dependencies removed due to unresolvable transitive URLs
3. **❌ Failed** - URLs that couldn't be resolved (manual intervention needed)

#### Example Report

```markdown
## Dead URL Resolution

### Summary
- Total dead URLs detected: 3
- Successfully resolved: 2
- Removed (unresolvable): 1
- Failed (needs manual intervention): 0

---

### ✅ Resolved (2)

#### 1. querystring
**Dead URL:** `https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz`
**Status:** Resolved via registry pattern match
**Replacement:** `querystring@^0.2.1` from npm registry
**Dependency Type:** Transitive (via express → qs → querystring)
**Parent Chain:** express@4.17.1 → qs@6.7.0 → querystring
**Resolution Strategy:** Matched pattern `github.com/substack/querystring/*`
**Explanation:** Old GitHub tarball URL no longer accessible. Package is available on npm registry.

#### 2. lodash
**Dead URL:** `https://github.com/lodash/lodash/archive/4.17.15.tar.gz`
**Status:** Resolved via npm registry lookup
**Replacement:** `lodash@^4.17.21` from npm registry
**Dependency Type:** Direct
**Resolution Strategy:** npm registry search by package name
**Explanation:** GitHub archive URLs are often dead. Package found on npm registry with newer version.

---

### 🗑️ Removed (1)

#### 1. old-unmaintained-package
**Dead URL:** `https://github.com/abandoned/old-package/archive/v1.0.0.tar.gz`
**Status:** Removed (unresolvable)
**Dependency Type:** Transitive (via legacy-lib → old-unmaintained-package)
**Parent Chain:** legacy-lib@2.0.0 → old-unmaintained-package@1.0.0
**Attempted Strategies:**
  1. Registry pattern match - No match found
  2. npm registry lookup - Package not found
  3. Parent removal - Removed legacy-lib@2.0.0
**Explanation:** Package not available on npm registry. Parent dependency `legacy-lib` was removed. You may need to find an alternative to `legacy-lib` or manually resolve this dependency.
**Action Required:** Review if `legacy-lib` is still needed. Consider finding an alternative package.

---

### ❌ Failed (0)

No failed resolutions. All dead URLs were either resolved or removed.
```

### Parent Chain Display

For transitive dependencies, the report shows the complete dependency chain, making it easy to understand where the dead URL came from:

**Format:**
```
Parent Chain: package-a@1.0.0 → package-b@2.0.0 → package-c@3.0.0 → dead-url-package
```

**Example:**
```
Parent Chain: express@4.17.1 → qs@6.7.0 → querystring
```

This shows that:
- Your project depends on `express@4.17.1`
- `express` depends on `qs@6.7.0`
- `qs` depends on `querystring` (which has a dead URL)

**Why this matters:**
- Helps you understand the impact of removing a dependency
- Shows which packages might be affected by the resolution
- Makes it clear if a dead URL is deep in your dependency tree
- Assists in finding alternative packages if needed

### Resolution Status Grouping

Dead URLs are grouped by their resolution status to make the report scannable and actionable:

#### ✅ Resolved
**What it means:** The dead URL was successfully replaced with a working npm registry version.

**What you need to do:** Nothing! These are automatically fixed.

**Example scenarios:**
- GitHub tarball URL replaced with npm registry version
- Old git repository URL replaced with published package
- Registry pattern match found and applied

#### 🗑️ Removed
**What it means:** The dead URL couldn't be resolved, so the parent dependency was removed.

**What you need to do:** Review if the removed package is critical to your application. You may need to:
- Find an alternative package
- Manually resolve the dependency
- Update your code to remove usage of the removed package

**Example scenarios:**
- Package not available on npm registry
- Abandoned package with no alternatives
- Transitive dependency of a non-critical package

#### ❌ Failed
**What it means:** The dead URL couldn't be resolved, and the parent couldn't be safely removed.

**What you need to do:** Manual intervention required. Options include:
- Finding the package on an alternative registry
- Contacting the package maintainer
- Forking and publishing the package yourself
- Finding an alternative package

**Example scenarios:**
- Critical dependency with no npm registry version
- Package with complex resolution requirements
- Network issues preventing resolution

### Helpful Explanations

The report includes context-aware explanations for common dead URL scenarios:

#### GitHub Archive URLs
```
Explanation: GitHub archive URLs (*.tar.gz) are often dead because:
- Repository was deleted or made private
- GitHub changed URL formats over time
- Specific tags or commits were removed
The package is available on npm registry with the same or newer version.
```

#### Abandoned Packages
```
Explanation: This package appears to be abandoned:
- No npm registry version found
- GitHub repository is inaccessible
- Last update was over 5 years ago
Consider finding a maintained alternative or forking the package.
```

#### Transitive Dependencies
```
Explanation: This is a transitive dependency (not directly in your package.json).
It's required by: express@4.17.1 → qs@6.7.0
Removing the parent package may affect functionality that depends on it.
Review your code before proceeding.
```

#### Registry Pattern Matches
```
Explanation: This dead URL matched a known pattern in the package replacement registry:
Pattern: github.com/substack/querystring/*
This is a common issue with old GitHub tarball URLs.
The replacement has been tested and is known to work.
```

### Accessing the Report

The resurrection report is generated automatically at the end of the resurrection process:

1. **In VS Code Output Panel:**
   - View → Output
   - Select "CodeCrypt" from the dropdown
   - Scroll to the "Dead URL Resolution" section

2. **In the Resurrection Summary:**
   - The summary includes a count of resolved/removed/failed URLs
   - Click "View Full Report" for detailed information

3. **In the Git Commit Message:**
   - The commit message includes a summary of dead URL resolutions
   - Example: "Resolved 2 dead URLs, removed 1 unresolvable dependency"

### Using Report Information

The report is designed to be actionable. Here's how to use it:

#### For Resolved URLs
✅ **No action needed** - These are automatically fixed and safe to use.

**Verification:**
```bash
npm install  # Should succeed with resolved dependencies
npm test     # Verify functionality still works
```

#### For Removed Dependencies
🗑️ **Review and test** - Check if the removed package was critical.

**Steps:**
1. Search your codebase for usage of the removed package
2. Run your test suite to check for breakage
3. If needed, find an alternative package
4. Update your code to use the alternative

**Example:**
```bash
# Search for usage
grep -r "legacy-lib" src/

# If found, find alternative
npm search "alternative to legacy-lib"

# Install alternative
npm install alternative-package
```

#### For Failed Resolutions
❌ **Manual intervention required** - Follow the suggested actions in the report.

**Options:**
1. **Find on alternative registry:**
   ```bash
   # Try yarn or pnpm registries
   yarn add package-name
   ```

2. **Fork and publish:**
   ```bash
   # Clone the old repository
   git clone <old-repo-url>
   
   # Publish to npm under your scope
   npm publish --access public
   ```

3. **Find alternative:**
   ```bash
   # Search for alternatives
   npm search "similar functionality"
   ```

### Troubleshooting Report Issues

**Problem:** Report shows "Failed" but I think it should be resolved

**Solutions:**
- Check if the package exists on npm: `npm view <package-name>`
- Verify the package name is correct (case-sensitive)
- Check if the package is scoped: `@org/package-name`
- Add a registry entry for automatic resolution

**Problem:** Parent chain is confusing

**Solutions:**
- Read from left to right: each arrow (→) shows "depends on"
- The rightmost package is the one with the dead URL
- The leftmost package is in your package.json
- Use `npm ls <package-name>` to verify the chain

**Problem:** Report says "Removed" but I need that package

**Solutions:**
- Check if the package is available under a different name
- Search npm for alternatives: `npm search <functionality>`
- Check if a newer version of the parent package fixes the issue
- Consider manually resolving by forking the package

## Build System Detection

CodeCrypt intelligently detects and uses the appropriate build system for your project, ensuring post-resurrection validation works correctly even for projects using task runners or bundlers instead of npm scripts.

### Supported Build Systems

CodeCrypt supports the following build systems (in priority order):

1. **npm Scripts** (Highest Priority)
   - Detected from: `package.json` → `scripts.build`
   - Command: `npm run build`
   - Most common in modern projects

2. **Gulp**
   - Detected from: `gulpfile.js`, `gulpfile.babel.js`, `gulpfile.ts`
   - Command: `npx gulp`
   - Popular task runner for streaming builds

3. **Grunt**
   - Detected from: `Gruntfile.js`, `Gruntfile.coffee`, `Gruntfile.ts`
   - Command: `npx grunt`
   - Classic task runner for automation

4. **Webpack**
   - Detected from: `webpack.config.js`, `webpack.config.ts`
   - Command: `npx webpack`
   - Module bundler for JavaScript applications

5. **Rollup**
   - Detected from: `rollup.config.js`, `rollup.config.ts`
   - Command: `npx rollup -c`
   - Module bundler optimized for libraries

6. **Vite**
   - Detected from: `vite.config.js`, `vite.config.ts`
   - Command: `npx vite build`
   - Next-generation frontend tooling

### Priority Order

When multiple build systems are detected, CodeCrypt uses this priority:

```
npm scripts > Gulp > Grunt > Webpack > Rollup > Vite
```

**Why npm scripts have priority?**
- Most projects with task runners also define npm scripts as entry points
- npm scripts provide a consistent interface across different build tools
- Developers expect `npm run build` to work regardless of underlying tooling

### Detection Examples

#### Example 1: npm Scripts (Standard)

**Project Structure:**
```
my-project/
├── package.json
└── src/
```

**package.json:**
```json
{
  "scripts": {
    "build": "tsc && webpack"
  }
}
```

**Detection Result:**
```
✅ Build system: npm-script
📦 Build command: npm run build
```

#### Example 2: Gulp Task Runner

**Project Structure:**
```
legacy-project/
├── package.json (no build script)
├── gulpfile.js
└── src/
```

**gulpfile.js:**
```javascript
const gulp = require('gulp');

gulp.task('default', function() {
  // Build tasks
});
```

**Detection Result:**
```
✅ Build system: gulp
📦 Build command: npx gulp
```

#### Example 3: Multiple Build Systems

**Project Structure:**
```
complex-project/
├── package.json (with build script)
├── gulpfile.js
├── webpack.config.js
└── src/
```

**Detection Result:**
```
✅ Build system: npm-script (priority over gulp and webpack)
📦 Build command: npm run build
ℹ️  Also detected: gulp, webpack (not used due to priority)
```

#### Example 4: No Build System

**Project Structure:**
```
simple-project/
├── package.json (no build script)
└── index.js
```

**Detection Result:**
```
ℹ️  Build system: none
📝 Compilation: not_applicable
✅ Skipping compilation validation (not required)
```

### Build System Detection Process

CodeCrypt follows this process to detect your build system:

1. **Check npm Scripts**
   - Parse `package.json`
   - Look for `scripts.build`, `scripts.compile`, or `scripts.prepare`
   - If found, use npm script (highest priority)

2. **Check Task Runner Files**
   - Look for `gulpfile.js`, `Gruntfile.js`, etc.
   - Check multiple file extensions (`.js`, `.ts`, `.babel.js`, `.coffee`)
   - Use first match based on priority order

3. **Check Bundler Configs**
   - Look for `webpack.config.js`, `rollup.config.js`, `vite.config.js`
   - Check multiple file extensions (`.js`, `.ts`, `.mjs`)
   - Use first match based on priority order

4. **Fallback to "Not Applicable"**
   - If no build system detected, mark as `not_applicable`
   - Skip compilation validation gracefully
   - Log reason clearly in resurrection report

### Handling Projects Without Build Systems

Not all projects require compilation. CodeCrypt gracefully handles these cases:

**Scenarios:**
- Pure JavaScript projects (no transpilation needed)
- Projects with only runtime scripts
- Documentation-only repositories
- Configuration-only packages

**Behavior:**
```
ℹ️  No build system detected
📝 Marking compilation as: not_applicable
✅ Skipping compilation validation
📊 Resurrection can still succeed
```

**In Resurrection Report:**
```markdown
## Compilation Validation

Status: Not Applicable
Reason: No build system detected (no build scripts or task runners)
Result: Skipped (not required for this project)
```

### Test Script Fallback

If no build system is detected but a test script exists, CodeCrypt can use it as a validation fallback:

**package.json:**
```json
{
  "scripts": {
    "test": "jest"
  }
}
```

**Behavior:**
```
ℹ️  No build script found
✅ Found test script: npm test
📝 Using test script as validation fallback
```

This ensures CodeCrypt can still validate the resurrection even without a dedicated build step.

### Troubleshooting Build Detection

**Problem:** CodeCrypt doesn't detect my build system

**Solutions:**
1. **Add npm script** (recommended):
   ```json
   {
     "scripts": {
       "build": "gulp"
     }
   }
   ```

2. **Check file naming**:
   - Ensure config files use standard names
   - Supported: `gulpfile.js`, `Gruntfile.js`, `webpack.config.js`, etc.

3. **Verify file location**:
   - Config files must be in project root
   - Nested configs are not detected

**Problem:** Wrong build system is used

**Explanation:**
- CodeCrypt uses priority order (npm scripts > task runners > bundlers)
- If you have both npm scripts and a task runner, npm scripts win

**Solution:**
- Remove or rename the higher-priority build system
- Or update the npm script to call your preferred tool

## Resilient Error Handling

CodeCrypt is designed to handle failures gracefully:

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
- Gemini API access is required (using `gemini-3-pro-preview` by default)

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
