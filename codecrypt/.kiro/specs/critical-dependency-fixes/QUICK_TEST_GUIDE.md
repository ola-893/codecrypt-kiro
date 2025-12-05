# Quick Manual Test Guide

## 🚀 5-Minute Verification

### Prerequisites
- ✅ All previous tasks completed
- ✅ Gemini API key ready (get at https://makersuite.google.com/app/apikey)

### Step 1: Run Automated Check (30 seconds)
```bash
cd codecrypt/.kiro/specs/critical-dependency-fixes
node verify-gemini-config.js
```
**Expected:** ✅ PASSED - All checks successful!

### Step 2: Configure API Key (1 minute)
1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type: `CodeCrypt: Configure Gemini API Key`
4. Paste your API key (starts with `AIza`)
5. Confirm: "Gemini API key stored securely"

### Step 3: Create Test Repo (1 minute)
```bash
mkdir /tmp/test-dead-repo && cd /tmp/test-dead-repo
git init

cat > package.json << 'EOF'
{
  "name": "test-dead-repo",
  "version": "1.0.0",
  "dependencies": {
    "react": "^16.8.0",
    "lodash": "^4.17.15"
  }
}
EOF

mkdir src
cat > src/App.js << 'EOF'
import React from 'react';
import _ from 'lodash';

class App extends React.Component {
  render() {
    return <div>{_.range(10).map(i => <p key={i}>Item {i}</p>)}</div>;
  }
}
export default App;
EOF

git add . && git commit -m "Initial commit"
```

### Step 4: Run Resurrection (2 minutes)
1. In VS Code: `Cmd+Shift+P` → `CodeCrypt: Resurrect Repository`
2. Enter: `/tmp/test-dead-repo`
3. Watch Output panel (View → Output → CodeCrypt)

### Step 5: Verify Success (1 minute)

**Look for these in Output:**
- ✅ "Using Gemini model: gemini-3-pro-preview"
- ✅ "LLM analysis complete"
- ✅ "Generated X insights"

**Search for "404":**
- ❌ Should find ZERO matches

**Check Report:**
- ✅ File created: `RESURRECTION_REPORT.md`
- ✅ Contains "LLM Analysis" section
- ✅ Shows developer intent insights

## Success Criteria

All of these must be true:
- [x] Automated verification passes
- [x] API key configured without errors
- [x] Resurrection completes successfully
- [x] No 404 errors in logs
- [x] Report contains LLM insights
- [x] Model used is `gemini-3-pro-preview`

## If Something Fails

### "API key not configured"
```bash
# Set environment variable instead
export GEMINI_API_KEY="your-key-here"
code .
```

### "404 - Model not found"
Check VS Code settings:
- Settings → Search "codecrypt"
- Verify `Gemini Model` = `gemini-3-pro-preview`

### "LLM analysis skipped"
1. Check LLM provider: `CodeCrypt: Switch LLM Provider` → Select `gemini`
2. Verify API key is valid
3. Check internet connection

## Full Documentation

For detailed instructions, see:
- **Complete Guide:** `MANUAL_VERIFICATION_GUIDE.md`
- **Task Summary:** `MANUAL_VERIFICATION_SUMMARY.md`
- **Troubleshooting:** `codecrypt/TROUBLESHOOTING.md`

## Quick Commands Reference

```bash
# Verify configuration
node verify-gemini-config.js

# Check VS Code settings
code --list-extensions | grep codecrypt

# View logs
# In VS Code: View → Output → Select "CodeCrypt"

# Clean test
rm -rf /tmp/test-dead-repo
```

---

**Time Required:** ~5 minutes  
**Difficulty:** Easy  
**Prerequisites:** Gemini API key
