# Requirements Document: Demo Critical Fixes

## Introduction

This spec addresses critical failures discovered during the demo that prevent CodeCrypt from successfully resurrecting repositories. The demo revealed three major failure categories: LLM API configuration issues, dependency installation failures, and missing build scripts.

## Glossary

- **LLM**: Large Language Model - AI service used for semantic code analysis
- **Gemini API**: Google's generative AI API service
- **API Version**: The version of the API endpoint being called (v1, v1beta, etc.)
- **Querystring Package**: A Node.js package for parsing URL query strings
- **Build Script**: An npm script that compiles/builds the project
- **Resurrection Process**: The automated process of modernizing dead code

## Requirements

### Requirement 1: Fix Gemini API Model Configuration

**User Story:** As a developer using CodeCrypt, I want the Gemini LLM integration to work correctly, so that semantic code analysis can provide insights during resurrection.

#### Acceptance Criteria

1. WHEN the system initializes the Gemini client THEN it SHALL use a model name that is compatible with the current API version
2. WHEN the Gemini API returns a 404 model not found error THEN the system SHALL log the error with the attempted model name and API version
3. WHEN the Gemini API fails THEN the system SHALL gracefully fall back to AST-only analysis without crashing
4. WHEN using Gemini API THEN the system SHALL use the stable v1 API endpoint instead of v1beta
5. WHERE the user has configured Anthropic API key THEN the system SHALL prefer Anthropic over Gemini for reliability

### Requirement 2: Handle Missing Dependency URLs

**User Story:** As a developer resurrecting old repositories, I want CodeCrypt to handle missing or dead dependency URLs gracefully, so that the resurrection process can continue with available packages.

#### Acceptance Criteria

1. WHEN npm install fails with a 404 error for a GitHub tarball URL THEN the system SHALL detect this as a dead URL error
2. WHEN a dependency URL is dead THEN the system SHALL attempt to find an alternative source (npm registry, updated GitHub URL)
3. WHEN a dependency cannot be resolved from any source THEN the system SHALL mark it as failed and continue with other dependencies
4. WHEN the querystring package is referenced from a dead GitHub URL THEN the system SHALL use the npm registry version instead
5. WHEN multiple dependencies fail due to the same root cause THEN the system SHALL identify and report the common issue

### Requirement 3: Handle Missing Build Scripts

**User Story:** As a developer, I want CodeCrypt to handle repositories without build scripts intelligently, so that validation doesn't fail unnecessarily for projects that don't require compilation.

#### Acceptance Criteria

1. WHEN a repository has no build script in package.json THEN the system SHALL detect this before attempting compilation
2. WHEN no build script exists THEN the system SHALL skip compilation validation and mark it as "not applicable"
3. WHEN validation runs THEN the system SHALL distinguish between "compilation failed" and "no compilation needed"
4. WHEN generating the final report THEN the system SHALL clearly indicate which validations were skipped and why
5. WHERE a repository uses Gulp or other task runners THEN the system SHALL detect and use the appropriate build command

### Requirement 4: Improve Error Recovery and Reporting

**User Story:** As a developer, I want clear error messages and recovery strategies when the resurrection process encounters issues, so that I can understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN any critical error occurs THEN the system SHALL log the error with full context (file, operation, timestamp)
2. WHEN LLM analysis fails THEN the system SHALL report which files were analyzed successfully and which failed
3. WHEN dependency updates fail THEN the system SHALL provide a summary of successful vs failed updates with reasons
4. WHEN validation fails THEN the system SHALL explain why each validation step failed
5. WHEN the resurrection completes THEN the system SHALL generate a comprehensive report including all errors and partial successes

### Requirement 5: Add Fallback Strategies

**User Story:** As a developer, I want CodeCrypt to have intelligent fallback strategies, so that partial failures don't prevent the entire resurrection from completing.

#### Acceptance Criteria

1. WHEN LLM analysis fails for all files THEN the system SHALL continue with AST-only analysis
2. WHEN some dependencies fail to update THEN the system SHALL continue with successfully updated dependencies
3. WHEN validation fails repeatedly THEN the system SHALL stop retrying and report the final state
4. WHEN the Gemini API is unavailable THEN the system SHALL automatically switch to Anthropic if configured
5. WHERE no LLM provider is available THEN the system SHALL complete resurrection using only AST analysis
