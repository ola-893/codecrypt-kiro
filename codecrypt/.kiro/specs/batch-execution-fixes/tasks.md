# Implementation Plan

- [x] 1. Fix BatchExecutor to actually execute batches
  - [x] 1.1 Implement executeBatches() main loop
    - Add loop to iterate through all batches
    - Emit batch_started event for each batch
    - Call executeBatch() for each batch
    - Emit batch_completed event with results
    - Return array of BatchExecutionResult
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [x] 1.2 Implement executeBatch() for single batch
    - Loop through all packages in batch
    - Emit package_update_started event
    - Call updatePackageJson() to modify package.json
    - Call runNpmInstall() to install dependencies
    - Call validateUpdate() to check compilation/tests
    - Emit package_updated event with result
    - Handle errors and continue to next package
    - Return BatchExecutionResult with success/failure counts
    - _Requirements: 1.1, 1.3, 1.4_
  
  - [x] 1.3 Implement updatePackageJson() helper
    - Read package.json from repository
    - Update dependencies or devDependencies with new version
    - Write updated package.json back to disk
    - Handle missing package.json gracefully
    - _Requirements: 1.1_
  
  - [x] 1.4 Implement runNpmInstall() with output capture
    - Run npm install --legacy-peer-deps
    - Set 2-minute timeout
    - Capture stdout and stderr
    - Log output for debugging
    - Return success/failure with error message
    - _Requirements: 1.4, 4.4, 6.2_
  
  - [x] 1.5 Implement validateUpdate() helper
    - Check if TypeScript project (tsconfig.json exists)
    - Run compilation check if TypeScript
    - Check if test script exists in package.json
    - Run tests if available
    - Return validation result with compilation and test status
    - _Requirements: 1.3, 4.5_
  
  - [x] 1.6 Add BatchExecutionResult types to types.ts
    - Add BatchExecutionResult interface
    - Add PackageUpdateResult interface
    - Export from types.ts
    - _Requirements: 1.5_
  
  - [x] 1.7 Integrate BatchExecutor into ResurrectionOrchestrator
    - Replace current batch execution logic with new BatchExecutor
    - Pass eventEmitter to BatchExecutor
    - Store batch execution results in context
    - Update resurrection report with batch results
    - _Requirements: 1.1, 1.5_

- [x] 2. Implement validation loop prevention
  - [x] 2.1 Add fix tracking data structures
    - Add FixAttempt interface to types.ts
    - Add FixStrategy enum to types.ts
    - Add attemptedFixes Map to PostResurrectionValidator
    - Add MAX_ITERATIONS and NO_PROGRESS_THRESHOLD constants
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.2 Implement no-progress detection
    - Track previousErrorCount across iterations
    - Track noProgressCount counter
    - Compare currentErrorCount to previousErrorCount
    - Increment noProgressCount if no change
    - Reset noProgressCount if progress made
    - Terminate if noProgressCount >= 3
    - _Requirements: 2.5_
  
  - [x] 2.3 Implement fix strategy selection
    - Add selectFixStrategy() method
    - Categorize errors by type (dependency, import, type, syntax)
    - Select appropriate fix strategy based on error categories
    - Return FixStrategy enum value
    - _Requirements: 2.1, 5.1, 5.2, 5.3_
  
  - [x] 2.4 Implement fix attempt tracking
    - Add recordFixAttempt() method
    - Store FixAttempt in attemptedFixes Map
    - Add hasAttemptedFix() method to check if strategy was tried
    - Add selectAlternativeStrategy() to find unattempted strategies
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.5 Implement diverse fix strategies
    - Implement applyFix() method with switch statement
    - Add LEGACY_PEER_DEPS: npm install --legacy-peer-deps
    - Add DELETE_LOCKFILE: delete package-lock.json + npm install
    - Add CLEAN_INSTALL: delete node_modules + npm install
    - Add UPDATE_DEPENDENCIES: install missing packages
    - Add FORCE_INSTALL: npm install --force
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 2.6 Update validation loop logic
    - Check for completion (0 errors)
    - Check for no progress
    - Select fix strategy (avoid repeats)
    - Apply fix and record attempt
    - Log detailed progress at each step
    - Return ValidationResult with reason for termination
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Improve LLM timeout handling
  - [x] 3.1 Add timeout configuration
    - Add MAX_RETRIES constant (3)
    - Add BASE_TIMEOUT constant (30s)
    - Add MAX_TIMEOUT constant (60s)
    - Add TIMEOUT_THRESHOLD constant (3 consecutive timeouts)
    - _Requirements: 3.1, 3.2_
  
  - [x] 3.2 Implement adaptive timeout
    - Calculate timeout based on attempt number
    - Use exponential backoff: BASE_TIMEOUT * 1.5^(attempt-1)
    - Cap at MAX_TIMEOUT
    - _Requirements: 3.1_
  
  - [x] 3.3 Implement retry logic with backoff
    - Wrap LLM call in try-catch
    - Use Promise.race with timeout promise
    - On timeout, wait with exponential backoff
    - Retry up to MAX_RETRIES times
    - Return null if all retries fail (don't throw)
    - _Requirements: 3.1, 3.2_
  
  - [x] 3.4 Implement graceful degradation
    - Track timeoutCount across files
    - If timeoutCount >= TIMEOUT_THRESHOLD, skip remaining files
    - Log warning about skipped files
    - Return partial results instead of failing
    - _Requirements: 3.3, 3.4_
  
  - [x] 3.5 Update analyzeRepository() method
    - Call analyzeFile() for each file
    - Handle null results (timeouts)
    - Track timeout count
    - Break early if too many timeouts
    - Log summary of successful vs failed analyses
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 4. Add progress tracking events
  - [x] 4.1 Add new event types to eventEmitter
    - Add batch_started event type
    - Add batch_completed event type
    - Add package_update_started event type
    - Add package_updated event type
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 4.2 Emit events in BatchExecutor
    - Emit batch_started with batch ID and package list
    - Emit package_update_started with package name and versions
    - Emit package_updated with result and errors
    - Emit batch_completed with BatchExecutionResult
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 4.3 Update SSE server to forward new events
    - Add handlers for batch_started
    - Add handlers for batch_completed
    - Add handlers for package_update_started
    - Add handlers for package_updated
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Enhance logging throughout
  - [x] 5.1 Add detailed batch execution logs
    - Log batch plan at start
    - Log each package update attempt
    - Log npm install output (stdout/stderr)
    - Log validation results
    - Log batch summary at end
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [x] 5.2 Add detailed validation logs
    - Log iteration number and max iterations
    - Log error count at each iteration
    - Log selected fix strategy
    - Log fix application result
    - Log no-progress detection
    - Log termination reason
    - _Requirements: 6.4, 6.5_
  
  - [x] 5.3 Add detailed LLM analysis logs
    - Log file being analyzed
    - Log attempt number and timeout
    - Log retry backoff duration
    - Log timeout count
    - Log analysis summary (X/Y files)
    - _Requirements: 6.4, 6.5_

- [x] 6. Update resurrection report
  - [x] 6.1 Add batch execution summary
    - Show total batches executed
    - Show total packages attempted
    - Show successful vs failed updates
    - List each package with result
    - _Requirements: 1.5_
  
  - [x] 6.2 Add validation summary
    - Show number of validation iterations
    - Show fix strategies attempted
    - Show which strategies succeeded
    - Show remaining errors by category
    - _Requirements: 2.4, 5.5_
  
  - [x] 6.3 Add LLM analysis summary
    - Show files analyzed vs skipped
    - Show timeout count
    - Show partial results note if applicable
    - _Requirements: 3.4_

- [x] 7. Write unit tests
  - [x] 7.1 Test BatchExecutor
    - Test executeBatches() with multiple batches
    - Test executeBatch() with success and failure cases
    - Test updatePackageJson() updates correct fields
    - Test runNpmInstall() captures output
    - Mock npm commands for testing
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 7.2 Test validation loop prevention
    - Test no-progress detection
    - Test fix strategy selection
    - Test fix attempt tracking
    - Test alternative strategy selection
    - Test termination conditions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 7.3 Test LLM timeout handling
    - Test adaptive timeout calculation
    - Test retry logic with backoff
    - Test graceful degradation
    - Test partial results handling
    - Mock LLM API with timeouts
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 8. Integration testing
  - [x] 8.1 Test with real repository
    - Clone a dead repository
    - Run full resurrection flow
    - Verify batches are executed
    - Verify validation doesn't loop
    - Verify LLM timeouts are handled
    - Verify report shows actual updates
    - _Requirements: All_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
