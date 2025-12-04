# Batch Execution and Validation Fixes: Requirements

## Introduction

This spec addresses critical issues discovered during resurrection testing where the batch execution system creates batches but fails to execute them, and the validation system gets stuck in infinite loops applying the same ineffective fix repeatedly.

## Glossary

- **Batch Executor**: The system component responsible for executing planned dependency update batches
- **Validation Loop**: The iterative process of checking compilation/test status and applying fixes
- **Fix Strategy**: A specific approach to resolving a compilation or dependency error
- **LLM Timeout**: When an LLM API request exceeds the configured timeout duration

## Requirements

### Requirement 1: Batch Execution Reliability

**User Story:** As a developer using CodeCrypt, I want the batch execution system to reliably execute all planned dependency updates, so that my repository is actually modernized rather than just analyzed.

#### Acceptance Criteria

1. WHEN the batch planner creates batches THEN the batch executor SHALL execute each batch in sequence
2. WHEN a batch execution begins THEN the system SHALL emit progress events indicating which batch is being processed
3. WHEN a batch execution completes THEN the system SHALL record the result (success/failure) for each package in the batch
4. WHEN a batch execution fails THEN the system SHALL log the specific error and continue to the next batch
5. WHEN all batches complete THEN the system SHALL report the total number of successful and failed updates

### Requirement 2: Validation Loop Prevention

**User Story:** As a developer using CodeCrypt, I want the validation system to avoid infinite loops, so that the resurrection process completes in a reasonable time.

#### Acceptance Criteria

1. WHEN the validation system applies a fix THEN the system SHALL record which fix strategy was attempted
2. WHEN the validation system encounters the same error after applying a fix THEN the system SHALL NOT apply the same fix strategy again
3. WHEN the validation system has exhausted all fix strategies for an error THEN the system SHALL mark the error as unfixable and stop attempting fixes
4. WHEN the validation system reaches the maximum iteration limit THEN the system SHALL terminate with a clear summary of remaining errors
5. WHEN the validation system detects no progress after 3 consecutive iterations THEN the system SHALL terminate early

### Requirement 3: LLM Timeout Handling

**User Story:** As a developer using CodeCrypt, I want the system to handle LLM timeouts gracefully, so that analysis can continue even when some files fail to analyze.

#### Acceptance Criteria

1. WHEN an LLM request times out THEN the system SHALL retry with exponential backoff up to 3 times
2. WHEN an LLM request fails after all retries THEN the system SHALL log the failure and continue with the next file
3. WHEN multiple LLM requests timeout THEN the system SHALL consider reducing the batch size or skipping LLM analysis
4. WHEN LLM analysis completes with partial results THEN the system SHALL proceed with available insights
5. WHEN LLM analysis is unavailable THEN the system SHALL fall back to AST-only analysis

### Requirement 4: Batch Execution Progress Tracking

**User Story:** As a developer using CodeCrypt, I want to see detailed progress during batch execution, so that I understand what the system is doing and can identify where problems occur.

#### Acceptance Criteria

1. WHEN a batch starts executing THEN the system SHALL emit an event with the batch ID and package list
2. WHEN a package update begins THEN the system SHALL emit an event with the package name and target version
3. WHEN a package update completes THEN the system SHALL emit an event with the result and any errors
4. WHEN npm install runs THEN the system SHALL stream the output to the log
5. WHEN validation runs THEN the system SHALL emit events for each validation step (compilation, tests)

### Requirement 5: Fix Strategy Diversity

**User Story:** As a developer using CodeCrypt, I want the validation system to try multiple different fix strategies, so that it can resolve a variety of error types.

#### Acceptance Criteria

1. WHEN the system encounters a dependency resolution error THEN the system SHALL try: force install, legacy peer deps, clean install, and package-lock deletion
2. WHEN the system encounters a compilation error THEN the system SHALL try: dependency updates, type fixes, and import fixes
3. WHEN the system encounters a test failure THEN the system SHALL try: dependency updates and test configuration fixes
4. WHEN a fix strategy succeeds THEN the system SHALL record which strategy worked for future reference
5. WHEN all fix strategies fail THEN the system SHALL provide a summary of what was attempted

### Requirement 6: Batch Execution Logging

**User Story:** As a developer debugging CodeCrypt, I want detailed logs of batch execution, so that I can understand why updates succeed or fail.

#### Acceptance Criteria

1. WHEN batch execution begins THEN the system SHALL log the complete batch plan with all packages and versions
2. WHEN npm install runs THEN the system SHALL capture and log stdout and stderr
3. WHEN validation runs THEN the system SHALL log compilation output and test results
4. WHEN an error occurs THEN the system SHALL log the full error stack trace and context
5. WHEN batch execution completes THEN the system SHALL log a summary of all results
