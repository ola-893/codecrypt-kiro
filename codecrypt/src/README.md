# CodeCrypt Source Code Structure

## Overview

This directory contains the source code for the CodeCrypt VS Code extension, which resurrects abandoned repositories through AI-powered modernization.

## Core Files

### `extension.ts`
Main entry point for the VS Code extension. Handles:
- Extension activation and deactivation
- Command registration (`codecrypt.resurrectRepository`)
- User input validation for GitHub URLs
- Progress notifications

### `types.ts`
Core TypeScript interfaces and types:
- `ResurrectionContext`: Main state object for resurrection process
- `DependencyInfo`: Information about package dependencies
- `TransformationLogEntry`: Log entries for transformation operations
- `VulnerabilityInfo`: Security vulnerability data
- `ResurrectionConfig`: Configuration options
- `ResurrectionResult`: Result of resurrection operation

## Utilities

### `utils/errors.ts`
Error handling utilities:
- Custom error classes (`RepositoryError`, `DependencyError`, `NetworkError`, `ValidationError`)
- `retryWithBackoff()`: Retry failed operations with exponential backoff
- `safeJsonParse()`: Safe JSON parsing with error handling
- `formatErrorForUser()`: Format errors for user display

### `utils/logger.ts`
Logging infrastructure:
- `Logger` class: Structured logging with levels (DEBUG, INFO, WARN, ERROR)
- Output channel integration with VS Code
- Global logger instance management

## Testing

### `test/`
Test files using Mocha framework:
- `extension.test.ts`: Extension integration tests
- `types.test.ts`: Core types validation tests
- `errors.test.ts`: Error handling and utility tests

## Architecture

The extension follows a modular architecture:

1. **Input Layer**: User provides GitHub repository URL
2. **Analysis Layer**: (To be implemented) Analyzes repository health and dependencies
3. **Transformation Layer**: (To be implemented) Updates dependencies and modernizes code
4. **Output Layer**: (To be implemented) Generates reports and creates pull requests

## Development

### Building
```bash
npm run compile
```

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Next Steps

The following components will be implemented in subsequent tasks:
- GitHub repository cloning and analysis
- Dependency detection and version checking
- Automated dependency updates
- Code transformation engine
- Validation and testing
- Report generation
