# Requirements Document: Critical Dependency and API Configuration Fixes

## Introduction

CodeCrypt is experiencing two critical failures that prevent successful execution:
1. **Dead Dependency URL**: The `package.json` contains a dependency pointing to a non-existent GitHub tarball URL (`https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz`), causing all npm install operations to fail with 404 errors.
2. **Invalid Gemini Model**: The LLM analysis service was using an outdated Gemini model name that returned 404 errors from the Gemini API. This has been fixed by updating to `gemini-3-pro-preview`.

These issues must be resolved to restore basic functionality.

## Glossary

- **Dead URL**: A dependency URL that returns a 404 Not Found error and prevents package installation
- **Gemini API**: Google's generative AI API for code understanding and analysis
- **Model Name**: The specific identifier for the Gemini model version being used
- **LLM Analysis Service**: The service responsible for semantic code analysis using AI models
- **Package Manager**: npm or similar tools that resolve and install dependencies

## Requirements

### Requirement 1

**User Story:** As a developer, I want CodeCrypt's dependencies to install successfully, so that I can build and run the extension.

#### Acceptance Criteria

1. WHEN npm install is executed THEN the system SHALL complete without 404 errors for dependency URLs
2. WHEN the querystring dependency is resolved THEN the system SHALL use a valid npm registry package or built-in Node.js module
3. WHEN package.json is updated THEN the system SHALL maintain all required functionality
4. WHEN dependencies are installed THEN the system SHALL use only accessible package sources
5. WHEN the build process runs THEN the system SHALL complete successfully without dependency resolution errors

### Requirement 2

**User Story:** As a developer, I want to identify and remove obsolete dependencies, so that the codebase remains maintainable and secure.

#### Acceptance Criteria

1. WHEN analyzing the querystring dependency THEN the system SHALL determine if it can be replaced with Node.js built-in modules
2. WHEN a dependency is obsolete THEN the system SHALL remove it from package.json
3. WHEN a dependency is removed THEN the system SHALL verify no code references remain
4. WHEN dependencies are updated THEN the system SHALL maintain backward compatibility for all features

### Requirement 3

**User Story:** As a developer using CodeCrypt, I want the Gemini API integration to use a valid model name, so that LLM analysis succeeds and provides semantic insights.

#### Acceptance Criteria

1. WHEN the LLM analysis service initializes THEN the system SHALL use a currently available Gemini model name
2. WHEN the Gemini API is called THEN the system SHALL receive successful responses without 404 model errors
3. WHEN hybrid analysis runs THEN the system SHALL complete both AST and LLM analysis phases
4. WHEN LLM analysis completes THEN the system SHALL generate developer intent insights
5. WHEN the model name is configured THEN the system SHALL use `gemini-3-pro-preview` as the default model

### Requirement 4

**User Story:** As a developer, I want clear error messages when dependencies or APIs fail, so that I can quickly diagnose and fix configuration issues.

#### Acceptance Criteria

1. WHEN a dependency URL returns 404 THEN the system SHALL log the failing URL and suggest alternatives
2. WHEN the Gemini API returns a model not found error THEN the system SHALL log the attempted model name and list valid options
3. WHEN npm install fails THEN the system SHALL identify which dependency caused the failure
4. WHEN API configuration is invalid THEN the system SHALL provide actionable guidance for correction

### Requirement 5

**User Story:** As a developer, I want to prevent future dependency URL failures, so that the codebase remains stable over time.

#### Acceptance Criteria

1. WHEN adding new dependencies THEN the system SHALL prefer npm registry packages over direct GitHub URLs
2. WHEN a GitHub URL is necessary THEN the system SHALL validate the URL is accessible before committing
3. WHEN dependencies are reviewed THEN the system SHALL identify any non-registry URLs
4. WHEN package.json is updated THEN the system SHALL include only stable, maintained dependencies
