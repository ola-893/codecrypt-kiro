# Requirements Document: Demo Readiness Fixes

## Introduction

This specification addresses critical issues discovered during real-world testing that prevent CodeCrypt from successfully resurrecting repositories with complex dependency scenarios. The fixes ensure the extension is demo-ready by handling transitive dead URLs, improving build system detection, and enhancing the package replacement registry.

## Glossary

- **System**: The CodeCrypt VS Code extension
- **Dead URL**: A dependency specified as a URL (GitHub tarball, git repo, etc.) that is no longer accessible
- **Transitive Dependency**: A dependency of a dependency (not directly listed in package.json)
- **Build System**: The tooling used to compile/build a project (npm scripts, Gulp, Grunt, Webpack, etc.)
- **Package Replacement Registry**: A curated database of known package replacements and dead URLs
- **npm Lockfile**: package-lock.json, yarn.lock, or pnpm-lock.yaml files that contain resolved dependency trees

## Requirements

### Requirement 1: Transitive Dead URL Detection

**User Story:** As a developer resurrecting an old repository, I want CodeCrypt to detect dead URLs in transitive dependencies (not just direct dependencies), so that the resurrection process doesn't fail due to nested dependency issues.

#### Acceptance Criteria

1. WHEN analyzing dependencies, THE System SHALL parse the npm lockfile (package-lock.json, yarn.lock, or pnpm-lock.yaml) to extract all resolved dependency URLs
2. WHEN a transitive dependency uses a URL-based resolution, THE System SHALL validate the URL accessibility
3. WHEN a transitive dead URL is detected, THE System SHALL attempt to find the package in the npm registry
4. WHEN a transitive dead URL cannot be resolved via npm, THE System SHALL remove the parent dependency that requires it and log a warning
5. WHEN multiple transitive dead URLs are found, THE System SHALL process them in dependency order (deepest first)

### Requirement 2: Enhanced Build System Detection

**User Story:** As a developer resurrecting a repository using Gulp, Grunt, or other task runners, I want CodeCrypt to correctly detect and use the appropriate build command, so that post-resurrection validation doesn't fail with "Missing script: build" errors.

#### Acceptance Criteria

1. WHEN detecting build configuration, THE System SHALL check for task runner files (gulpfile.js, Gruntfile.js, webpack.config.js, rollup.config.js)
2. WHEN a Gulp task runner is detected, THE System SHALL use "npx gulp" as the build command
3. WHEN a Grunt task runner is detected, THE System SHALL use "npx grunt" as the build command
4. WHEN a Webpack config is detected without npm scripts, THE System SHALL use "npx webpack" as the build command
5. WHEN a Rollup config is detected without npm scripts, THE System SHALL use "npx rollup -c" as the build command
6. WHEN no build system is detected, THE System SHALL mark compilation as "not_applicable" and skip validation
7. WHEN multiple build systems are detected, THE System SHALL prioritize npm scripts over task runners

### Requirement 3: Expanded Package Replacement Registry

**User Story:** As a developer, I want CodeCrypt to automatically handle known dead URLs and deprecated packages using a curated registry, so that common resurrection scenarios succeed without manual intervention.

#### Acceptance Criteria

1. WHEN the package replacement registry is loaded, THE System SHALL include entries for known dead GitHub tarball URLs
2. WHEN a dead URL matches a registry entry, THE System SHALL automatically apply the registered replacement without URL validation
3. WHEN the querystring package with a GitHub URL is detected, THE System SHALL replace it with the npm registry version "^0.2.1"
4. WHEN the registry contains a dead URL pattern, THE System SHALL support wildcard matching (e.g., "github.com/substack/*")
5. WHEN applying registry replacements, THE System SHALL log the replacement action for transparency

### Requirement 4: Lockfile-Aware Dependency Resolution

**User Story:** As a developer, I want CodeCrypt to update lockfiles after resolving dead URLs, so that subsequent npm install commands use the corrected dependencies.

#### Acceptance Criteria

1. WHEN dead URLs are resolved in package.json, THE System SHALL delete the existing lockfile (package-lock.json, yarn.lock, or pnpm-lock.yaml)
2. WHEN the lockfile is deleted, THE System SHALL run "npm install" to regenerate it with resolved dependencies
3. WHEN lockfile regeneration fails, THE System SHALL log the error and continue with the resurrection process
4. WHEN multiple lockfiles exist, THE System SHALL delete all of them before regeneration
5. WHEN no lockfile exists, THE System SHALL skip lockfile regeneration

### Requirement 5: Improved Error Reporting

**User Story:** As a developer, I want clear, actionable error messages when dead URLs cannot be resolved, so that I understand what manual steps might be needed.

#### Acceptance Criteria

1. WHEN a dead URL cannot be resolved, THE System SHALL log the package name, dead URL, and attempted resolution strategies
2. WHEN a transitive dependency causes failure, THE System SHALL identify the parent dependency chain
3. WHEN the resurrection report is generated, THE System SHALL include a "Dead URL Resolution" section with all attempted fixes
4. WHEN multiple dead URLs are found, THE System SHALL group them by resolution status (resolved, removed, failed)
5. WHEN a dead URL is from a known problematic source (e.g., old GitHub tarballs), THE System SHALL include a helpful explanation in the report

### Requirement 6: Build Command Fallback Strategy

**User Story:** As a developer, I want CodeCrypt to gracefully handle projects without build scripts, so that validation doesn't fail unnecessarily for projects that don't require compilation.

#### Acceptance Criteria

1. WHEN no build command is detected and no task runners exist, THE System SHALL mark the project as "not requiring compilation"
2. WHEN compilation is marked as not required, THE System SHALL skip the compilation validation step
3. WHEN compilation is skipped, THE System SHALL log the reason clearly
4. WHEN the resurrection report is generated, THE System SHALL indicate that compilation was not applicable
5. WHEN a project has only a "test" script and no build script, THE System SHALL use the test script as a validation fallback
