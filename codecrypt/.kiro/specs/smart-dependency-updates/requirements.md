# Requirements Document

## Introduction

This specification addresses critical issues discovered during real-world resurrection attempts where the current one-at-a-time dependency update strategy fails due to:

1. **Transitive dependency conflicts** - Old packages like `node-sass` block all subsequent updates because they fail to build on modern architectures (ARM64/Apple Silicon)
2. **Dead package URLs** - GitHub archive URLs that no longer exist (e.g., `querystring@https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz`)
3. **Cascading failures** - Running `npm install` after each individual update causes the same transitive dependency to fail repeatedly
4. **Deprecated package replacements** - Packages like `node-sass` need to be replaced with modern alternatives (`sass`) rather than just updated

The Smart Dependency Update system will pre-analyze the dependency tree, identify blocking packages, apply intelligent replacement strategies, and use batch updates to minimize npm install cycles.

## Glossary

- **Blocking_Dependency**: A dependency that prevents npm install from completing due to build failures, missing URLs, or architecture incompatibility
- **Transitive_Dependency**: A dependency that is not directly listed in package.json but is required by a direct dependency
- **Package_Replacement**: A mapping from a deprecated/dead package to its modern equivalent (e.g., `node-sass` → `sass`)
- **Batch_Update**: Updating multiple dependencies in package.json before running a single npm install
- **Dependency_Tree**: The complete graph of all direct and transitive dependencies
- **Architecture_Incompatible**: A package that cannot build on the current system architecture (e.g., ARM64)

## Requirements

### Requirement 1

**User Story:** As a developer using CodeCrypt, I want the system to detect and handle blocking dependencies before attempting updates, so that the resurrection process doesn't fail repeatedly on the same transitive dependency issue.

#### Acceptance Criteria

1. WHEN the Dependency_Analyzer scans a repository THEN the system SHALL identify all Blocking_Dependencies by checking for known problematic packages (node-sass, phantomjs, etc.)
2. WHEN a Blocking_Dependency is detected THEN the system SHALL check if a Package_Replacement mapping exists for that dependency
3. WHEN a Package_Replacement exists THEN the system SHALL add the replacement to the resurrection plan with highest priority
4. WHEN the system detects a package with a GitHub archive URL THEN the system SHALL verify the URL is accessible before planning updates
5. IF a GitHub archive URL returns 404 THEN the system SHALL mark the dependency as requiring manual intervention or removal

### Requirement 2

**User Story:** As a developer, I want the system to use batch updates instead of one-at-a-time updates, so that npm install runs fewer times and transitive dependency issues are resolved more efficiently.

#### Acceptance Criteria

1. WHEN generating a resurrection plan THEN the system SHALL group compatible updates into batches
2. WHEN executing a batch update THEN the system SHALL modify all package.json entries in the batch before running npm install
3. WHEN a batch update fails THEN the system SHALL fall back to updating packages individually within that batch
4. WHEN falling back to individual updates THEN the system SHALL skip packages that caused the batch failure
5. WHILE executing batch updates THEN the system SHALL emit progress events for each package in the batch

### Requirement 3

**User Story:** As a developer, I want the system to maintain a registry of known package replacements, so that deprecated packages are automatically replaced with their modern equivalents.

#### Acceptance Criteria

1. WHEN the system initializes THEN the system SHALL load a Package_Replacement registry containing known mappings
2. WHEN a deprecated package is detected THEN the system SHALL look up the replacement in the registry
3. WHEN a replacement is found THEN the system SHALL update the package name and version in package.json
4. WHEN replacing a package THEN the system SHALL log the replacement action with before/after details
5. WHERE the replacement requires code changes THEN the system SHALL flag the file for manual review

### Requirement 4

**User Story:** As a developer, I want the system to detect architecture-incompatible packages before attempting installation, so that ARM64/Apple Silicon users don't waste time on packages that will never build.

#### Acceptance Criteria

1. WHEN analyzing dependencies THEN the system SHALL check each package against a list of known Architecture_Incompatible packages
2. WHEN an Architecture_Incompatible package is detected THEN the system SHALL check if a compatible replacement exists
3. IF no compatible replacement exists THEN the system SHALL mark the package as requiring manual intervention
4. WHEN reporting Architecture_Incompatible packages THEN the system SHALL include the reason and suggested alternatives
5. WHEN the system detects `node-sass` THEN the system SHALL automatically plan replacement with `sass` (Dart Sass)

### Requirement 5

**User Story:** As a developer, I want the system to validate package URLs before attempting installation, so that dead GitHub archive URLs don't cause npm install failures.

#### Acceptance Criteria

1. WHEN analyzing a dependency with a URL-based version THEN the system SHALL perform a HEAD request to verify accessibility
2. IF the URL returns a non-2xx status THEN the system SHALL mark the dependency as having a Dead_URL
3. WHEN a Dead_URL is detected THEN the system SHALL attempt to find the package on npm registry instead
4. IF the package exists on npm THEN the system SHALL update the version to use the npm registry version
5. WHEN a Dead_URL cannot be resolved THEN the system SHALL remove the dependency and log a warning

### Requirement 6

**User Story:** As a developer, I want the system to provide clear reporting on why certain updates failed and what manual actions are needed, so that I can complete the resurrection process.

#### Acceptance Criteria

1. WHEN an update fails THEN the system SHALL categorize the failure type (architecture, dead URL, peer conflict, etc.)
2. WHEN generating the resurrection report THEN the system SHALL include a section for manual intervention items
3. WHEN a package requires manual intervention THEN the system SHALL provide specific guidance on how to resolve the issue
4. WHEN the resurrection completes THEN the system SHALL summarize successful updates, failed updates, and pending manual actions
5. WHEN a Package_Replacement was applied THEN the system SHALL note any code changes that may be required

### Requirement 7

**User Story:** As a developer, I want the system to handle peer dependency conflicts intelligently, so that updates don't fail due to strict peer dependency requirements.

#### Acceptance Criteria

1. WHEN npm install fails with peer dependency errors THEN the system SHALL parse the error to identify conflicting packages
2. WHEN peer conflicts are detected THEN the system SHALL attempt installation with `--legacy-peer-deps` flag
3. IF `--legacy-peer-deps` fails THEN the system SHALL attempt installation with `--force` flag
4. WHEN using fallback flags THEN the system SHALL log a warning about potential compatibility issues
5. WHEN all installation attempts fail THEN the system SHALL record the specific peer conflict for the report

### Requirement 8

**User Story:** As a developer, I want the system to serialize and deserialize the package replacement registry, so that the registry can be updated without code changes.

#### Acceptance Criteria

1. WHEN the system starts THEN the system SHALL load the Package_Replacement registry from a JSON configuration file
2. WHEN a new replacement mapping is discovered THEN the system SHALL allow adding it to the registry
3. WHEN serializing the registry THEN the system SHALL include package name, replacement name, version mapping, and any required code transformations
4. WHEN deserializing the registry THEN the system SHALL validate the JSON structure matches the expected schema
5. IF the registry file is missing or invalid THEN the system SHALL use a built-in default registry
