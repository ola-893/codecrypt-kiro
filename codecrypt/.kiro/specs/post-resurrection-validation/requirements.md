# Requirements Document

## Introduction

The Post-Resurrection Validation system provides an iterative validation and repair loop that runs after resurrection attempts. When compilation or installation fails, the system analyzes the errors, applies targeted fixes, and retries until the resurrected codebase successfully compiles. This approach acknowledges that resurrection is inherently messy and embraces an iterative "fix until it works" strategy rather than attempting to predict all issues upfront.

## Glossary

- **Post-Resurrection Validator**: The component that validates compilation success after resurrection and orchestrates retry loops
- **Compilation Proof**: Evidence that the resurrected codebase successfully compiles without errors
- **Resurrection Iteration**: A single attempt to fix issues and re-validate compilation
- **Error Analyzer**: Component that parses compilation/installation errors to identify root causes
- **Fix Strategy**: A targeted repair action derived from error analysis
- **Resurrection Loop**: The iterative cycle of validate → analyze errors → apply fix → retry
- **Max Iterations**: The maximum number of fix attempts before declaring resurrection failed
- **Partial Success**: A state where core functionality compiles but some optional features remain broken

## Requirements

### Requirement 1

**User Story:** As a CodeCrypt user, I want the system to detect compilation failures after resurrection attempts, so that I know when the resurrected code needs further fixes.

#### Acceptance Criteria

1. WHEN a resurrection attempt completes THEN the Post-Resurrection Validator SHALL attempt to compile the resurrected codebase
2. WHEN compilation fails THEN the Post-Resurrection Validator SHALL capture the complete error output including stderr and exit codes
3. WHEN compilation succeeds THEN the Post-Resurrection Validator SHALL generate a Compilation Proof artifact
4. WHEN validating compilation THEN the Post-Resurrection Validator SHALL support npm, yarn, and pnpm build commands
5. WHEN a build command is not specified THEN the Post-Resurrection Validator SHALL detect the appropriate build command from package.json scripts

### Requirement 2

**User Story:** As a CodeCrypt user, I want the system to analyze compilation errors and identify root causes, so that targeted fixes can be applied.

#### Acceptance Criteria

1. WHEN compilation fails THEN the Error Analyzer SHALL parse error messages to identify error categories including dependency errors, syntax errors, type errors, and missing module errors
2. WHEN a dependency installation error occurs THEN the Error Analyzer SHALL extract the failing package name and version constraint
3. WHEN a peer dependency conflict is detected THEN the Error Analyzer SHALL identify the conflicting packages and version ranges
4. WHEN a native module compilation fails THEN the Error Analyzer SHALL identify the module and the specific build error
5. WHEN multiple errors occur THEN the Error Analyzer SHALL prioritize errors by likelihood of being the root cause

### Requirement 3

**User Story:** As a CodeCrypt user, I want the system to automatically apply fixes based on error analysis, so that resurrection can continue without manual intervention.

#### Acceptance Criteria

1. WHEN a dependency version conflict is identified THEN the Post-Resurrection Validator SHALL attempt to resolve by adjusting version constraints in package.json
2. WHEN a peer dependency conflict is identified THEN the Post-Resurrection Validator SHALL attempt to install compatible versions using --legacy-peer-deps or version pinning
3. WHEN a native module fails THEN the Post-Resurrection Validator SHALL attempt to substitute with a pure JavaScript alternative or remove from dependencies
4. WHEN a lockfile causes conflicts THEN the Post-Resurrection Validator SHALL remove the lockfile and regenerate
5. WHEN a git dependency is inaccessible THEN the Post-Resurrection Validator SHALL attempt to substitute with an npm registry version

### Requirement 4

**User Story:** As a CodeCrypt user, I want the system to retry resurrection until compilation succeeds, so that I get a working codebase without manual iteration.

#### Acceptance Criteria

1. WHEN a fix is applied THEN the Post-Resurrection Validator SHALL re-attempt compilation
2. WHILE compilation fails AND iteration count is below max iterations THEN the Post-Resurrection Validator SHALL continue the fix-retry loop
3. WHEN max iterations is reached without success THEN the Post-Resurrection Validator SHALL report all attempted fixes and remaining errors
4. WHEN the same error persists after a fix attempt THEN the Post-Resurrection Validator SHALL try an alternative fix strategy
5. WHEN compilation succeeds THEN the Post-Resurrection Validator SHALL exit the loop and report success with iteration count

### Requirement 5

**User Story:** As a CodeCrypt user, I want to see progress during the resurrection loop, so that I understand what fixes are being attempted.

#### Acceptance Criteria

1. WHEN starting a resurrection iteration THEN the Post-Resurrection Validator SHALL emit a progress event with iteration number and total max iterations
2. WHEN analyzing errors THEN the Post-Resurrection Validator SHALL emit events describing identified error categories
3. WHEN applying a fix THEN the Post-Resurrection Validator SHALL emit an event describing the fix strategy being attempted
4. WHEN a fix succeeds or fails THEN the Post-Resurrection Validator SHALL emit an event with the outcome
5. WHEN the loop completes THEN the Post-Resurrection Validator SHALL emit a summary event with total iterations, fixes applied, and final status

### Requirement 6

**User Story:** As a CodeCrypt user, I want the system to track which fixes were successful, so that similar issues can be resolved faster in future resurrections.

#### Acceptance Criteria

1. WHEN a fix successfully resolves an error THEN the Post-Resurrection Validator SHALL record the error pattern and successful fix strategy
2. WHEN encountering a previously seen error pattern THEN the Post-Resurrection Validator SHALL prioritize the previously successful fix strategy
3. WHEN a resurrection completes THEN the Post-Resurrection Validator SHALL store the fix history for the repository
4. WHEN generating reports THEN the Post-Resurrection Validator SHALL include a summary of all fixes applied during the resurrection
5. WHEN the same repository is resurrected again THEN the Post-Resurrection Validator SHALL apply learned fixes proactively
