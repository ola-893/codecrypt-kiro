# Logging Improvements for LLM Analysis Debugging

## Overview
Added comprehensive logging to debug issues with LLM analysis timeouts and JSON parsing errors observed in the resurrection process.

## Changes Made

### 1. Enhanced LLM File Analysis Logging (`llmAnalysis.ts`)

#### In `analyzeFile()` function:
- **Request logging**: Log when LLM analysis is requested for each file
- **Response logging**: Log response length when received
- **JSON extraction logging**: Log when attempting to extract and parse JSON
- **Raw JSON preview**: Log first 200 characters of extracted JSON for debugging
- **Parse success logging**: Confirm successful parsing
- **Enhanced error logging**: 
  - Log JSON parse errors with detailed error messages
  - Log error position for SyntaxError
  - Log error type and context

### 2. Enhanced Gemini Client Logging (`llmAnalysis.ts`)

#### In `GeminiClient.analyzeCode()` method:
- **Timing tracking**: Track start time and elapsed time for each request
- **Prompt size logging**: Log prompt length in characters
- **API call tracking**: Log when API call starts
- **Completion logging**: Log when API call completes with elapsed time
- **Timeout logging**: Log detailed timeout information including elapsed vs configured timeout
- **Response size logging**: Log response text length
- **Retry logging**: Enhanced retry messages with attempt numbers and timing
- **Failure logging**: Log total attempts and elapsed time on final failure

### 3. Enhanced Repository Analysis Logging (`llmAnalysis.ts`)

#### In `analyzeRepository()` function:
- **File processing tracking**: Log current file number and total
- **File size logging**: Log file size in bytes and lines of code
- **Per-file timing**: Track and log time taken for each file analysis
- **Confidence logging**: Log confidence score for each completed analysis
- **Progress tracking**: Log remaining files when errors occur

### 4. Enhanced Orchestrator Logging (`resurrectionOrchestrator.ts`)

#### In `runHybridAnalysis()` method:
- **LLM phase timing**: Track total time for LLM analysis phase
- **File count logging**: Log total files and how many will be analyzed
- **Analysis timing**: Log total time for LLM repository analysis
- **Completion summary**: Log total files analyzed and total time
- **Error details**: Enhanced error logging with:
  - Elapsed time when error occurs
  - Full error message
  - Stack trace in debug mode

## Benefits

### 1. Timeout Debugging
- Can now see exactly how long each request takes
- Can identify if timeouts are due to slow API responses or configuration issues
- Can track which files are taking longest to analyze

### 2. JSON Parsing Debugging
- Can see the raw JSON being parsed
- Can identify malformed JSON responses
- Can see exact position of parse errors
- Can correlate parsing errors with specific files

### 3. Performance Analysis
- Can measure time spent on each file
- Can identify bottlenecks in the analysis pipeline
- Can optimize by adjusting file selection or timeout values

### 4. Error Recovery
- Better visibility into which files fail and why
- Can continue with remaining files after errors
- Can track success rate across file set

## Log Levels Used

- **INFO**: Normal operation milestones (file start/complete, phase start/complete)
- **DEBUG**: Detailed information for debugging (prompt size, response size, JSON preview)
- **WARN**: Recoverable issues (timeouts, retries, skipped files)
- **ERROR**: Failures that prevent analysis (parse errors, API failures)

## Example Log Output

```
[INFO] Processing file 1/10: lib/javascripts/graph_components/data_line.js
[DEBUG] File lib/javascripts/graph_components/data_line.js size: 5432 bytes, 156 LOC
[INFO] Requesting LLM analysis for lib/javascripts/graph_components/data_line.js
[DEBUG] Prompt length: 2345 characters
[DEBUG] Starting Gemini API call...
[INFO] Gemini API call completed in 2543ms
[DEBUG] Gemini response length: 1234 characters
[DEBUG] Attempting to parse JSON for lib/javascripts/graph_components/data_line.js, length: 1234
[DEBUG] Raw JSON preview for lib/javascripts/graph_components/data_line.js: {"developerIntent":"Create...
[INFO] Successfully parsed LLM response for lib/javascripts/graph_components/data_line.js
[INFO] Completed analysis of lib/javascripts/graph_components/data_line.js in 2678ms (confidence: 0.85)
```

## Next Steps

1. **Monitor logs** during resurrection to identify patterns in failures
2. **Adjust timeouts** if needed based on actual API response times
3. **Optimize file selection** to skip files that consistently fail
4. **Add retry logic** for specific error types if patterns emerge
5. **Consider caching** successful analyses to avoid re-analyzing same files

## Testing

All existing tests pass with the new logging in place. The logging is non-intrusive and doesn't affect functionality.

## Related Issues

This addresses the issues seen in the logs where:
- Gemini requests were timing out after 30 seconds
- JSON parsing was failing with "Bad escaped character" errors
- Multiple retries were exhausting without clear visibility into the problem
