# Manual End-to-End Verification Guide

## Overview

This guide walks through the manual verification process for the critical dependency and Gemini API fixes. This verification ensures that:
1. The Gemini API integration works correctly with `gemini-3-pro-preview`
2. LLM analysis completes successfully during resurrection
3. No 404 errors occur in the logs
4. Resurrection reports include LLM insights

**Requirements Validated:** 3.3, 3.4

## Prerequisites

Before starting, ensure:
- ✅ All previous tasks (1-8) are completed
- ✅ CodeCrypt extension is built: `npm run compile`
- ✅ All tests pass: `npm test`
- ✅ You have a Google Gemini API key (get one at https://makersuite.google.com/app/apikey)

## Step 1: Configure Gemini API Key in VS Code

### Option A: Using VS Code Command (Recommended)

1. Open VS Code with the CodeCrypt extension loaded
2. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
3. Type and select: `CodeCrypt: Configure Gemini API Key`
4. Enter your Gemini API key when prompted (starts with `AIza`)
5. Verify you see the confirmation message: "Gemini API key stored securely"

### Option B: Using Environment Variable

Alternatively, you can set the environment variable:

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Then launch VS Code from the same terminal:

```bash
code .
```

### Verification

To verify the API key is configured:

1. Open Command Palette
2. Run: `CodeCrypt: Hello World`
3. Check the output channel for any configuration errors

## Step 2: Verify LLM Provider Configuration

1. Open VS Code Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "codecrypt"
3. Verify the following settings:
   - **LLM Provider**: Should be set to `gemini` (or switch to it)
   - **Gemini Model**: Should be `gemini-3-pro-preview` (default)

### To Switch to Gemini Provider:

1. Open Command Palette
2. Run: `CodeCrypt: Switch LLM Provider`
3. Select `gemini` from the options

## Step 3: Prepare a Test Repository

For this verification, we'll use a small, dead repository. You have two options:

### Option A: Use a Known Dead Repository

Use a repository with outdated dependencies, such as:
- `https://github.com/example/old-react-app` (if you have one)
- Any repository with Node.js < 14 and React < 17

### Option B: Create a Test Repository

Create a minimal test repository:

```bash
mkdir /tmp/test-dead-repo
cd /tmp/test-dead-repo
git init

# Create a package.json with old dependencies
cat > package.json << 'EOF'
{
  "name": "test-dead-repo",
  "version": "1.0.0",
  "dependencies": {
    "react": "^16.8.0",
    "react-dom": "^16.8.0",
    "lodash": "^4.17.15"
  },
  "devDependencies": {
    "webpack": "^4.0.0"
  }
}
EOF

# Create a simple React component
mkdir src
cat > src/App.js << 'EOF'
import React from 'react';
import _ from 'lodash';

class App extends React.Component {
  render() {
    const items = _.range(10);
    return <div>{items.map(i => <p key={i}>Item {i}</p>)}</div>;
  }
}

export default App;
EOF

# Commit the files
git add .
git commit -m "Initial commit with old dependencies"
```

## Step 4: Run Resurrection on Test Repository

1. Open VS Code
2. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
3. Run: `CodeCrypt: Resurrect Repository`
4. When prompted, enter the repository URL or path:
   - For GitHub: `https://github.com/your-org/your-repo`
   - For local: `/tmp/test-dead-repo`

## Step 5: Monitor the Resurrection Process

### Watch the Output Channel

1. Open the Output panel: `View > Output` or `Cmd+Shift+U`
2. Select "CodeCrypt" from the dropdown
3. Monitor the log output for:
   - ✅ "Starting resurrection process..."
   - ✅ "Death detection complete"
   - ✅ "Starting hybrid analysis..."
   - ✅ "AST analysis complete"
   - ✅ "Starting LLM analysis with Gemini..."
   - ✅ "LLM analysis complete"
   - ✅ "Resurrection planning complete"

### Check for Errors

**❌ FAIL Indicators:**
- Any line containing "404" related to Gemini API
- "Model not found" errors
- "GEMINI_MODEL_NOT_FOUND" error code
- LLM analysis skipped or failed

**✅ PASS Indicators:**
- "Using Gemini model: gemini-3-pro-preview"
- "LLM analysis complete"
- "Generated X insights from LLM analysis"
- No 404 errors in the entire log

## Step 6: Verify LLM Analysis Completion

### Check the Progress Notifications

During resurrection, you should see progress notifications:
1. "🔍 Analyzing repository structure..."
2. "🧠 Running hybrid analysis (AST + LLM)..."
3. "📋 Creating resurrection plan..."
4. "🔧 Applying transformations..."

### Verify LLM Analysis Ran

Look for these specific log entries:

```
[INFO] Starting LLM analysis with Gemini
[INFO] Using Gemini model: gemini-3-pro-preview
[INFO] Analyzing code intent for X files
[INFO] LLM analysis complete: Generated Y insights
```

If you see these, LLM analysis succeeded! ✅

## Step 7: Check Logs for 404 Errors

### Search the Output Log

1. In the Output panel (CodeCrypt channel), use `Cmd+F` or `Ctrl+F`
2. Search for: `404`
3. **Expected Result:** No matches found ✅

### Common 404 Error Patterns to Check

If you find any 404 errors, check if they match these patterns:

**❌ BAD (indicates failure):**
```
Error: 404 - Model 'models/gemini-pro' not found
Error: 404 - Model 'models/gemini-1.5-pro' not found
```

**✅ GOOD (no Gemini-related 404s):**
```
(No 404 errors in log)
```

## Step 8: Verify Resurrection Report Includes LLM Insights

### Locate the Resurrection Report

After resurrection completes, a report should be generated:

1. Check the workspace for a new file: `RESURRECTION_REPORT.md`
2. Or check the output for: "Report saved to: [path]"

### Verify Report Contents

Open the resurrection report and verify it contains:

#### 1. LLM Analysis Section

Look for a section titled "LLM Analysis" or "Semantic Insights":

```markdown
## LLM Analysis

### Developer Intent Insights

- **File: src/App.js**
  - Intent: Component renders a list of items using lodash range utility
  - Modernization suggestion: Consider using Array.from() instead of lodash
  - Complexity: Low
  
- **File: src/utils/helpers.js**
  - Intent: Utility functions for data transformation
  - Modernization suggestion: Use native array methods
```

#### 2. Hybrid Analysis Results

The report should show both AST and LLM analysis:

```markdown
## Hybrid Analysis Results

### AST Analysis
- Total files analyzed: X
- Functions detected: Y
- Complexity score: Z

### LLM Analysis
- Semantic insights generated: N
- Modernization suggestions: M
- Intent clarity score: High/Medium/Low
```

#### 3. Modernization Recommendations

LLM insights should influence the recommendations:

```markdown
## Modernization Recommendations

1. **Update React to v18** (Priority: High)
   - AST detected: Class components using legacy lifecycle methods
   - LLM insight: Components follow simple patterns, easy to convert to hooks
   
2. **Replace lodash with native methods** (Priority: Medium)
   - AST detected: 15 lodash imports
   - LLM insight: Most usage is simple array operations available natively
```

### Verification Checklist

- [ ] Report exists and is readable
- [ ] Report contains "LLM Analysis" or "Semantic Insights" section
- [ ] LLM insights are present for analyzed files
- [ ] Insights include developer intent understanding
- [ ] Modernization suggestions reference LLM analysis
- [ ] No error messages about LLM analysis failure

## Step 9: Verify No Regression in Functionality

### Run the Test Suite

After resurrection completes:

```bash
cd codecrypt
npm test
```

**Expected Result:** All tests pass ✅

### Check for New Issues

1. Review the resurrection branch created by CodeCrypt
2. Verify the changes make sense
3. Check that no files were corrupted
4. Verify dependencies were updated correctly

## Step 10: Document Results

### Create Verification Report

Document your findings:

```markdown
# Manual Verification Results

**Date:** [Current Date]
**Tester:** [Your Name]
**Test Repository:** [URL or path]

## Results

### ✅ PASS: Gemini API Configuration
- API key configured successfully
- No configuration errors

### ✅ PASS: LLM Analysis Execution
- LLM analysis started and completed
- Model used: gemini-3-pro-preview
- Insights generated: [number]

### ✅ PASS: No 404 Errors
- Searched entire log for "404"
- No Gemini-related 404 errors found

### ✅ PASS: Report Contains LLM Insights
- Report generated successfully
- LLM Analysis section present
- Insights include developer intent
- Modernization suggestions reference LLM analysis

## Issues Found

[List any issues encountered, or write "None"]

## Conclusion

[PASS/FAIL] - All verification criteria met.
```

## Troubleshooting

### Issue: "Gemini API key not configured"

**Solution:**
1. Run `CodeCrypt: Configure Gemini API Key` command
2. Or set `GEMINI_API_KEY` environment variable
3. Restart VS Code

### Issue: "404 - Model not found"

**Solution:**
1. Check that `codecrypt.geminiModel` setting is `gemini-3-pro-preview`
2. Verify no old model names remain in code
3. Run: `grep -r "gemini-pro" codecrypt/src/` (should return no results)

### Issue: "LLM analysis skipped"

**Solution:**
1. Verify `codecrypt.llmProvider` is set to `gemini`
2. Check API key is valid
3. Check internet connectivity
4. Review output log for specific error messages

### Issue: "Report missing LLM insights"

**Solution:**
1. Verify LLM analysis actually ran (check logs)
2. Check that hybrid analysis completed successfully
3. Verify the test repository has analyzable code files
4. Try with a different test repository

## Success Criteria Summary

The manual verification is successful when:

- ✅ Gemini API key is configured in VS Code settings
- ✅ Resurrection runs on a test repository without errors
- ✅ LLM analysis completes successfully using `gemini-3-pro-preview`
- ✅ No 404 errors appear in the logs
- ✅ Resurrection report includes LLM insights section
- ✅ LLM insights show developer intent understanding
- ✅ Modernization recommendations reference LLM analysis
- ✅ All existing tests still pass

## Next Steps

After successful verification:

1. Update the task status to complete
2. Document any findings in the verification report
3. Proceed to final checkpoint (Task 10)
4. Celebrate the successful fix! 🎉

## Additional Resources

- **Gemini API Documentation:** https://ai.google.dev/docs
- **Get API Key:** https://makersuite.google.com/app/apikey
- **CodeCrypt Documentation:** See `codecrypt/README.md`
- **Troubleshooting Guide:** See `codecrypt/TROUBLESHOOTING.md`
