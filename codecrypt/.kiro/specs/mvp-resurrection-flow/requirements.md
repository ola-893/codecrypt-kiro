# Requirements Document

## Introduction

The MVP Resurrection Flow is the core feature of CodeCrypt that enables automated analysis and modernization of abandoned GitHub repositories. This minimal viable product focuses on JavaScript/TypeScript repositories, providing essential functionality to detect repository abandonment, analyze dependencies, and generate actionable resurrection reports. The system will accept a GitHub repository URL, clone and analyze the codebase, identify outdated dependencies, and produce a comprehensive report with modernization recommendations.

## Glossary

- **Repository Analyzer**: The component that clones and examines repository metadata and structure
- **Dependency Scanner**: The component that identifies and catalogs all project dependencies
- **Version Checker**: The component that compares current dependency versions against latest available versions
- **Death Score Calculator**: The component that computes a numerical assessment of repository abandonment
- **Resurrection Report Generator**: The component that produces the final analysis document
- **Package Manager**: Tools like npm, yarn, or pnpm that manage JavaScript dependencies
- **Death Certificate**: A document detailing why and when a repository was abandoned
- **Outdated Dependency**: A package dependency that has newer versions available
- **Security Vulnerability**: A known security issue in a dependency version

## Requirements

### Requirement 1

**User Story:** As a developer, I want to provide a GitHub repository URL, so that the system can analyze it for resurrection potential.

#### Acceptance Criteria

1. WHEN a user provides a GitHub repository URL THEN the Repository Analyzer SHALL validate the URL format
2. WHEN a valid GitHub URL is provided THEN the Repository Analyzer SHALL clone the repository to a temporary workspace
3. WHEN the repository cannot be accessed THEN the Repository Analyzer SHALL return an error message indicating the access failure
4. WHEN the repository is successfully cloned THEN the Repository Analyzer SHALL extract basic metadata including last commit date and repository size
5. THE Repository Analyzer SHALL support both HTTPS and SSH GitHub URL formats

### Requirement 2

**User Story:** As a developer, I want the system to detect if a repository is abandoned, so that I can focus resurrection efforts on truly dead projects.

#### Acceptance Criteria

1. WHEN analyzing a repository THEN the Death Score Calculator SHALL compute a death score between 0 and 100
2. WHEN the last commit is older than 24 months THEN the Death Score Calculator SHALL increase the death score by 40 points
3. WHEN the repository has outdated dependencies THEN the Death Score Calculator SHALL increase the death score by 10 points per outdated major dependency up to 30 points
4. WHEN the death score exceeds 50 THEN the Death Score Calculator SHALL classify the repository as abandoned
5. THE Death Score Calculator SHALL generate a death certificate documenting the time of death and contributing factors

### Requirement 3

**User Story:** As a developer, I want the system to identify all project dependencies, so that I can understand what needs updating.

#### Acceptance Criteria

1. WHEN a package.json file is detected THEN the Dependency Scanner SHALL parse all dependencies and devDependencies
2. WHEN parsing dependencies THEN the Dependency Scanner SHALL extract the package name and current version for each dependency
3. WHEN a package-lock.json file exists THEN the Dependency Scanner SHALL use it to identify the exact installed versions
4. WHEN no package.json file is found THEN the Dependency Scanner SHALL report that the repository is not a JavaScript project
5. THE Dependency Scanner SHALL build a dependency inventory containing all direct dependencies

### Requirement 4

**User Story:** As a developer, I want to know which dependencies are outdated, so that I can prioritize modernization efforts.

#### Acceptance Criteria

1. WHEN the dependency inventory is complete THEN the Version Checker SHALL query the npm registry for the latest version of each package
2. WHEN comparing versions THEN the Version Checker SHALL determine if the current version is behind the latest stable version
3. WHEN a dependency has a newer major version THEN the Version Checker SHALL flag it as a major update
4. WHEN a dependency has a newer minor or patch version THEN the Version Checker SHALL flag it as a minor update
5. THE Version Checker SHALL calculate the total number of versions behind for each outdated dependency

### Requirement 5

**User Story:** As a developer, I want to identify security vulnerabilities in dependencies, so that I can address critical risks first.

#### Acceptance Criteria

1. WHEN analyzing dependencies THEN the Version Checker SHALL check for known security vulnerabilities using npm audit data
2. WHEN a vulnerability is found THEN the Version Checker SHALL record the severity level as critical, high, moderate, or low
3. WHEN a patched version exists THEN the Version Checker SHALL identify the minimum version that fixes the vulnerability
4. THE Version Checker SHALL count the total number of vulnerabilities by severity level
5. THE Version Checker SHALL prioritize dependencies with critical or high severity vulnerabilities

### Requirement 6

**User Story:** As a developer, I want a comprehensive resurrection report, so that I can understand what needs to be done to modernize the repository.

#### Acceptance Criteria

1. WHEN analysis is complete THEN the Resurrection Report Generator SHALL create a markdown report
2. WHEN generating the report THEN the Resurrection Report Generator SHALL include an executive summary with key metrics
3. WHEN generating the report THEN the Resurrection Report Generator SHALL include the death certificate with abandonment details
4. WHEN generating the report THEN the Resurrection Report Generator SHALL include a dependency analysis table showing current vs latest versions
5. WHEN generating the report THEN the Resurrection Report Generator SHALL include prioritized recommendations for modernization
6. WHEN generating the report THEN the Resurrection Report Generator SHALL include a security vulnerabilities section if any are found
7. THE Resurrection Report Generator SHALL save the report as a markdown file in the output directory

### Requirement 7

**User Story:** As a developer, I want the analysis to complete within a reasonable time, so that I can quickly assess multiple repositories.

#### Acceptance Criteria

1. WHEN analyzing a repository under 100MB THEN the Repository Analyzer SHALL complete within 60 seconds
2. WHEN querying package versions THEN the Version Checker SHALL batch requests to avoid rate limiting
3. WHEN the analysis exceeds 5 minutes THEN the Repository Analyzer SHALL timeout and report partial results
4. THE Repository Analyzer SHALL provide progress updates during long-running operations

### Requirement 8

**User Story:** As a developer, I want clear error messages when analysis fails, so that I can troubleshoot issues effectively.

#### Acceptance Criteria

1. WHEN an error occurs THEN the Repository Analyzer SHALL log the error with context information
2. WHEN network requests fail THEN the Repository Analyzer SHALL retry up to 3 times with exponential backoff
3. WHEN a critical error prevents analysis THEN the Repository Analyzer SHALL generate a partial report with available data
4. WHEN errors occur THEN the Repository Analyzer SHALL include error details in the final report
5. THE Repository Analyzer SHALL clean up temporary files even when errors occur
