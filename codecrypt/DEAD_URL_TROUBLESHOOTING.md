# 🔗 Dead URL Troubleshooting Guide

This guide helps you diagnose and resolve dead URL issues during CodeCrypt resurrection. Dead URLs are dependencies specified as direct URLs (GitHub tarballs, git repositories, etc.) that are no longer accessible.

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [Common Scenarios](#common-scenarios)
- [Manual Intervention Steps](#manual-intervention-steps)
- [Registry Entry Examples](#registry-entry-examples)
- [Advanced Troubleshooting](#advanced-troubleshooting)

---

## Quick Diagnosis

### Identifying Dead URL Issues

Dead URL issues typically manifest as:

```
❌ Dead URL detected: https://github.com/user/package/archive/v1.0.0.tar.gz
⚠️  npm install failed: 404 Not Found
🔍 Checking replacement registry...
```

### Check the Resurrection Report

1. Open VS Code Output Panel: **View → Output**
2. Select **"CodeCrypt"** from the dropdown
3. Scroll to the **"Dead URL Resolution"** section
4. Look for the status of each dead URL:
   - ✅ **Resolved** - Automatically fixed, no action needed
   - 🗑️ **Removed** - Parent dependency removed, review needed
   - ❌ **Failed** - Manual intervention required

---

## Common Scenarios

### Scenario 1: GitHub Archive URL (Most Common)

**Symptom:**
```
Dead URL: https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz
Status: 404 Not Found
```

**Why it happens:**
- Repository was deleted or made private
- GitHub changed URL formats over time
- Specific tags or commits were removed
- Old tarball URLs are no longer supported

**Automatic Resolution:**
CodeCrypt automatically checks the npm registry for the package by name.

**Manual Resolution (if automatic fails):**

1. **Search npm registry:**
   ```bash
   npm search querystring
   npm view querystring versions
   ```

2. **Update package.json:**
   ```json
   {
     "dependencies": {
       "querystring": "^0.2.1"
     }
   }
   ```

3. **Add registry entry** (see [Registry Entry Examples](#registry-entry-examples))

### Scenario 2: Transitive Dead URL

**Symptom:**
```
Dead URL: https://github.com/user/package/archive/v1.0.0.tar.gz
Dependency Type: Transitive (via express → qs → querystring)
Parent Chain: express@4.17.1 → qs@6.7.0 → querystring
```

**Why it happens:**
- A dependency of your dependency uses a dead URL
- Not visible in your package.json
- Found in lockfile (package-lock.json, yarn.lock, pnpm-lock.yaml)

**Automatic Resolution:**
CodeCrypt parses the lockfile, detects the dead URL, and either:
1. Replaces it with npm registry version
2. Removes the parent dependency if unresolvable

**Manual Resolution:**

1. **Check if parent package has newer version:**
   ```bash
   npm view express versions
   npm install express@latest
   ```
   Newer versions often fix transitive dependency issues.

2. **If parent removal is suggested, verify impact:**
   ```bash
   # Search your codebase for usage
   grep -r "legacy-lib" src/
   
   # Check what depends on it
   npm ls legacy-lib
   ```

3. **Find alternative package:**
   ```bash
   npm search "alternative to legacy-lib"
   ```

### Scenario 3: Git Repository URL

**Symptom:**
```
Dead URL: git+https://github.com/user/repo.git#commit-hash
Status: Repository not found
```

**Why it happens:**
- Repository was deleted
- Repository was made private
- Commit hash no longer exists
- Git hosting service changed

**Manual Resolution:**

1. **Check if package is on npm:**
   ```bash
   npm view <package-name>
   ```

2. **If found, update package.json:**
   ```json
   {
     "dependencies": {
       "package-name": "^1.0.0"
     }
   }
   ```

3. **If not found, check alternative git hosts:**
   - GitLab: `git+https://gitlab.com/user/repo.git`
   - Bitbucket: `git+https://bitbucket.org/user/repo.git`

4. **Fork and publish (last resort):**
   ```bash
   # Clone from archive or cache
   git clone <old-url>
   
   # Update package.json with your info
   # Publish to npm
   npm publish
   ```

### Scenario 4: Direct Tarball URL

**Symptom:**
```
Dead URL: https://example.com/packages/package-1.0.0.tar.gz
Status: 404 Not Found
```

**Why it happens:**
- Hosting service went offline
- File was moved or deleted
- Domain expired

**Manual Resolution:**

1. **Search for package on npm:**
   ```bash
   npm search <package-name>
   ```

2. **Check package archives:**
   - [npm registry](https://www.npmjs.com/)
   - [unpkg.com](https://unpkg.com/)
   - [jsDelivr](https://www.jsdelivr.com/)

3. **Use Internet Archive:**
   - Visit [Wayback Machine](https://web.archive.org/)
   - Enter the dead URL
   - Download archived version
   - Publish to npm or use local file

### Scenario 5: Scoped Package URL

**Symptom:**
```
Dead URL: https://github.com/org/package/archive/v1.0.0.tar.gz
Package Name: @org/package
Status: Not found on npm
```

**Why it happens:**
- Scoped packages require special handling
- Organization name might differ from GitHub org
- Package might be private

**Manual Resolution:**

1. **Check with correct scope:**
   ```bash
   npm view @org/package
   npm view @different-org/package
   ```

2. **Search without scope:**
   ```bash
   npm search package
   ```

3. **Update package.json with correct scope:**
   ```json
   {
     "dependencies": {
       "@correct-org/package": "^1.0.0"
     }
   }
   ```

### Scenario 6: Multiple Dead URLs

**Symptom:**
```
Total dead URLs detected: 5
Successfully resolved: 2
Removed (unresolvable): 2
Failed (needs manual intervention): 1
```

**Why it happens:**
- Old project with many outdated dependencies
- Dependencies from abandoned packages
- Complex dependency tree

**Manual Resolution:**

1. **Prioritize by impact:**
   - Start with direct dependencies (in your package.json)
   - Then handle transitive dependencies
   - Focus on critical functionality first

2. **Batch update dependencies:**
   ```bash
   # Update all dependencies to latest
   npm update
   
   # Or use npm-check-updates
   npx npm-check-updates -u
   npm install
   ```

3. **Review removed packages:**
   ```bash
   # Check what was removed
   git diff package.json
   
   # Test your application
   npm test
   ```

---

## Manual Intervention Steps

### Step 1: Identify the Issue

1. **Read the resurrection report** in VS Code Output Panel
2. **Note the dead URL** and package name
3. **Check the dependency type** (direct or transitive)
4. **Review the parent chain** (for transitive dependencies)

### Step 2: Search for Alternatives

#### Option A: npm Registry

```bash
# Search by package name
npm search <package-name>

# View package details
npm view <package-name>

# Check available versions
npm view <package-name> versions
```

#### Option B: Alternative Registries

```bash
# Try yarn
yarn info <package-name>

# Try pnpm
pnpm view <package-name>
```

#### Option C: GitHub Search

1. Go to [GitHub](https://github.com/)
2. Search for the package name
3. Look for:
   - Official repository
   - Forks with recent activity
   - Alternative implementations

### Step 3: Update Dependencies

#### For Direct Dependencies

Edit `package.json`:

```json
{
  "dependencies": {
    "old-package": "https://github.com/user/old-package/archive/v1.0.0.tar.gz"
  }
}
```

Change to:

```json
{
  "dependencies": {
    "old-package": "^2.0.0"
  }
}
```

Then:

```bash
npm install
```

#### For Transitive Dependencies

**Option 1: Update parent package**

```bash
# Update the parent to latest version
npm install express@latest

# This often resolves transitive issues
```

**Option 2: Use npm overrides** (npm 8.3+)

Add to `package.json`:

```json
{
  "overrides": {
    "querystring": "^0.2.1"
  }
}
```

**Option 3: Use resolutions** (Yarn)

Add to `package.json`:

```json
{
  "resolutions": {
    "querystring": "^0.2.1"
  }
}
```

### Step 4: Regenerate Lockfile

```bash
# Delete existing lockfiles
rm package-lock.json yarn.lock pnpm-lock.yaml

# Regenerate
npm install
```

### Step 5: Verify the Fix

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run build (if applicable)
npm run build

# Start application
npm start
```

### Step 6: Add Registry Entry (Optional)

To help others, add a registry entry (see [Registry Entry Examples](#registry-entry-examples)).

---

## Registry Entry Examples

Add these entries to `data/package-replacement-registry.json` to automatically resolve common dead URLs.

### Example 1: Specific Package

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

**When to use:**
- You know the exact package and replacement
- The pattern is specific to one package
- You want automatic resolution for this package

### Example 2: Wildcard Pattern

```json
{
  "deadUrlPatterns": [
    {
      "pattern": "github.com/*/archive/*.tar.gz",
      "replacementPackage": null,
      "replacementVersion": null,
      "reason": "Generic GitHub archive URLs are often dead. Attempt npm registry lookup."
    }
  ]
}
```

**When to use:**
- Pattern matches multiple packages
- You want CodeCrypt to search npm automatically
- The replacement varies by package

### Example 3: Organization-Wide Pattern

```json
{
  "deadUrlPatterns": [
    {
      "pattern": "github.com/your-org/*",
      "replacementPackage": null,
      "replacementVersion": null,
      "reason": "Organization migrated all packages to npm registry. Search by package name."
    }
  ]
}
```

**When to use:**
- An entire organization moved to npm
- All packages from that org have dead URLs
- Package names are consistent

### Example 4: Version-Specific Pattern

```json
{
  "deadUrlPatterns": [
    {
      "pattern": "github.com/lodash/lodash/archive/4.17.*.tar.gz",
      "replacementPackage": "lodash",
      "replacementVersion": "^4.17.21",
      "reason": "Old lodash 4.17.x GitHub tarballs are dead. Use latest 4.17.x from npm."
    }
  ]
}
```

**When to use:**
- Specific version range has dead URLs
- You want to maintain version compatibility
- Newer versions might break compatibility

### Example 5: Alternative Registry

```json
{
  "deadUrlPatterns": [
    {
      "pattern": "bitbucket.org/*/get/*.tar.gz",
      "replacementPackage": null,
      "replacementVersion": null,
      "reason": "Bitbucket archive URLs may be inaccessible. Try npm registry."
    }
  ]
}
```

**When to use:**
- Packages from alternative git hosts
- URLs from services that changed formats
- Migration from one service to another

### Example 6: Scoped Package

```json
{
  "deadUrlPatterns": [
    {
      "pattern": "github.com/babel/babel/archive/*",
      "replacementPackage": "@babel/core",
      "replacementVersion": "^7.0.0",
      "reason": "Babel migrated to scoped packages. Use @babel/core from npm."
    }
  ]
}
```

**When to use:**
- Package migrated to scoped naming
- Organization restructured packages
- Package was renamed

### Complete Registry Example

Here's a complete `data/package-replacement-registry.json` with multiple patterns:

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
      "pattern": "github.com/lodash/lodash/archive/4.17.*.tar.gz",
      "replacementPackage": "lodash",
      "replacementVersion": "^4.17.21",
      "reason": "Old lodash 4.17.x GitHub tarballs are dead. Use latest 4.17.x from npm."
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
      "pattern": "github.com/babel/babel/archive/*",
      "replacementPackage": "@babel/core",
      "replacementVersion": "^7.0.0",
      "reason": "Babel migrated to scoped packages. Use @babel/core from npm."
    }
  ],
  "deprecatedPackages": []
}
```

---

## Advanced Troubleshooting

### Debugging Lockfile Parsing

If CodeCrypt isn't detecting transitive dead URLs:

1. **Check lockfile format:**
   ```bash
   # npm
   cat package-lock.json | grep "resolved"
   
   # yarn
   cat yarn.lock | grep "resolved"
   
   # pnpm
   cat pnpm-lock.yaml | grep "resolution"
   ```

2. **Verify lockfile version:**
   ```bash
   # npm lockfile version
   cat package-lock.json | grep "lockfileVersion"
   ```

3. **Manually search for URLs:**
   ```bash
   # Find all GitHub URLs in lockfile
   grep -r "github.com" package-lock.json
   
   # Find all tarball URLs
   grep -r ".tar.gz" package-lock.json
   ```

### Debugging Registry Pattern Matching

If registry patterns aren't matching:

1. **Test pattern manually:**
   ```javascript
   // In Node.js console
   const pattern = "github.com/substack/*";
   const url = "https://github.com/substack/querystring/archive/v1.0.0.tar.gz";
   
   // Convert pattern to regex
   const regex = new RegExp(pattern.replace(/\*/g, ".*"));
   console.log(regex.test(url)); // Should be true
   ```

2. **Check pattern order:**
   - More specific patterns should come first
   - Generic patterns should come last
   - First match wins

3. **Verify JSON syntax:**
   ```bash
   # Validate JSON
   cat data/package-replacement-registry.json | jq .
   ```

### Debugging Build System Detection

If CodeCrypt isn't detecting your build system:

1. **Check for config files:**
   ```bash
   ls -la | grep -E "(gulpfile|Gruntfile|webpack|rollup|vite)"
   ```

2. **Check package.json scripts:**
   ```bash
   cat package.json | jq .scripts
   ```

3. **Manually test build command:**
   ```bash
   # Try each command
   npm run build
   npx gulp
   npx grunt
   npx webpack
   npx rollup -c
   npx vite build
   ```

### Network Issues

If dead URL detection is failing due to network issues:

1. **Check connectivity:**
   ```bash
   curl -I https://registry.npmjs.org/
   ```

2. **Check proxy settings:**
   ```bash
   echo $HTTP_PROXY
   echo $HTTPS_PROXY
   ```

3. **Configure npm proxy:**
   ```bash
   npm config set proxy http://proxy.example.com:8080
   npm config set https-proxy http://proxy.example.com:8080
   ```

4. **Use alternative registry:**
   ```bash
   npm config set registry https://registry.npmmirror.com/
   ```

### Permission Issues

If lockfile regeneration fails due to permissions:

1. **Check file permissions:**
   ```bash
   ls -la package-lock.json
   ```

2. **Fix permissions:**
   ```bash
   chmod 644 package-lock.json
   ```

3. **Check directory permissions:**
   ```bash
   ls -la node_modules/
   ```

4. **Clean and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Circular Dependency Issues

If dead URL resolution causes circular dependencies:

1. **Identify the circle:**
   ```bash
   npm ls --all 2>&1 | grep "UNMET DEPENDENCY"
   ```

2. **Break the circle:**
   - Update one package in the circle to latest
   - Use npm overrides to force a specific version
   - Remove one package from the circle

3. **Use npm dedupe:**
   ```bash
   npm dedupe
   ```

---

## Getting Help

If you're still stuck after trying these troubleshooting steps:

1. **Check the resurrection report** for specific error messages
2. **Search GitHub issues** for similar problems
3. **Create a new issue** with:
   - Dead URL that's failing
   - Lockfile type and version
   - Full error message from resurrection report
   - Steps you've already tried

4. **Share your registry entry** if you found a solution

---

## Quick Reference

### Common Commands

```bash
# Search npm
npm search <package-name>

# View package info
npm view <package-name>

# Update dependencies
npm update

# Regenerate lockfile
rm package-lock.json && npm install

# Check dependency tree
npm ls <package-name>

# Validate JSON
cat data/package-replacement-registry.json | jq .
```

### File Locations

- **Registry:** `data/package-replacement-registry.json`
- **npm lockfile:** `package-lock.json`
- **Yarn lockfile:** `yarn.lock`
- **pnpm lockfile:** `pnpm-lock.yaml`
- **Resurrection report:** VS Code Output Panel → CodeCrypt

### Status Meanings

- ✅ **Resolved** - Automatically fixed, no action needed
- 🗑️ **Removed** - Parent dependency removed, review needed
- ❌ **Failed** - Manual intervention required

---

## Contributing

Found a dead URL pattern that others might encounter? Consider adding it to the registry and sharing it with the community!

1. Add the pattern to your local registry
2. Test thoroughly with real repositories
3. Document the reason clearly
4. Submit a pull request or create an issue

Your contribution helps make CodeCrypt better for everyone! 🧟✨
