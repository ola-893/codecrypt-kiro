# Extension Activation Debugging Guide

## Quick Checks

If the extension fails to activate, check these in order:

### 1. Check Extension Host Log
```
Cmd+Shift+P → "Developer: Show Logs" → "Extension Host"
```
This will show the actual error message and stack trace.

### 2. Verify Package.json Fields
Required fields:
- `name`: Must match pattern `^[a-z0-9][a-z0-9-]*$`
- `publisher`: Must be present (e.g., "codecrypt")
- `version`: Must follow semver (e.g., "0.0.1")
- `main`: Must point to existing file (e.g., "./dist/extension.js")
- `engines.vscode`: Must specify VS Code version (e.g., "^1.103.0")

### 3. Verify Compiled Output Exists
```bash
ls -la codecrypt/dist/extension.js
```
If missing, run:
```bash
npm run compile
```

### 4. Check for TypeScript Errors
```bash
npm run compile-tests
```
Fix any TypeScript compilation errors before testing.

### 5. Run Integration Tests
```bash
npm test
```
The extension activation tests will verify:
- Extension can be found by ID
- Extension activates successfully
- All commands are registered
- Commands execute without errors

## Common Issues and Solutions

### Issue: "undefined_publisher.codecrypt"
**Cause**: Missing `publisher` field in package.json  
**Solution**: Add `"publisher": "codecrypt"` to package.json

### Issue: "Cannot find module './dist/extension.js'"
**Cause**: Extension not compiled or wrong path in package.json  
**Solution**: 
1. Run `npm run compile`
2. Verify `"main": "./dist/extension.js"` in package.json

### Issue: "Extension activation failed" with no details
**Cause**: Error thrown in activate() function  
**Solution**: 
1. Check Extension Host log for stack trace
2. Add try-catch blocks around initialization code
3. Use debugger (F5) to step through activation

### Issue: Commands not appearing in palette
**Cause**: Commands not registered or activation events missing  
**Solution**:
1. Verify commands are in `contributes.commands` in package.json
2. Verify `context.subscriptions.push()` includes all commands
3. Reload window: `Cmd+Shift+P` → "Developer: Reload Window"

### Issue: "Module not found" errors during activation
**Cause**: Missing dependencies or incorrect import paths  
**Solution**:
1. Run `npm install` to ensure all dependencies are installed
2. Check import paths use correct extensions (.js for Node16 module resolution)
3. Verify webpack config has correct `extensionAlias` configuration

## Debug Mode

To debug extension activation in real-time:

1. Open the extension project in VS Code
2. Press F5 to launch Extension Development Host
3. In the new window, open Developer Tools: `Cmd+Shift+P` → "Developer: Toggle Developer Tools"
4. Go to Console tab to see activation logs
5. Set breakpoints in `src/extension.ts` activate() function
6. Reload the extension host window to trigger activation again

## Testing Activation Manually

1. Reload VS Code window:
   ```
   Cmd+Shift+P → "Developer: Reload Window"
   ```

2. Check extension is loaded:
   ```
   Cmd+Shift+P → "Developer: Show Running Extensions"
   ```
   Look for "codecrypt" in the list

3. Test a simple command:
   ```
   Cmd+Shift+P → "CodeCrypt: Hello World"
   ```
   Should show success message

4. Check for errors:
   ```
   Cmd+Shift+P → "Developer: Show Logs" → "Extension Host"
   ```

## Automated Testing

Run the comprehensive extension activation test suite:

```bash
cd codecrypt
npm run compile-tests
npm test
```

The tests verify:
- Extension manifest is valid
- Extension activates without errors
- All 6 commands are registered
- Commands execute successfully
- Error handling works correctly

## VS Code Version Compatibility

Ensure your VS Code version meets the minimum requirement:

1. Check current VS Code version: `Code → About Visual Studio Code`
2. Compare with `engines.vscode` in package.json
3. Update VS Code if needed

Current requirement: `^1.103.0`

## Clean Build

If all else fails, try a clean build:

```bash
cd codecrypt
rm -rf dist out node_modules
npm install
npm run compile
```

Then reload VS Code window.
