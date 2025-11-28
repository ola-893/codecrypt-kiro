# CodeCrypt Security Implementation

This document describes the security measures implemented in CodeCrypt to ensure safe resurrection of repositories.

## Overview

CodeCrypt implements multiple layers of security to protect both the host system and user credentials during the resurrection process.

## Security Features

### 1. Comprehensive Error Handling (NFR-002)

#### Network Operations
- All network operations (GitHub API, npm registry) include retry logic with exponential backoff
- Maximum of 3 retry attempts for failed operations
- 10-second timeout for npm registry requests
- User-friendly error messages for common failure scenarios:
  - Network connectivity issues
  - Rate limiting
  - Permission errors
  - Timeout errors

#### File Operations
- All file reads/writes include proper error handling
- JSON parsing errors are caught and reported with context
- File system errors provide clear feedback to users

#### MCP Operations
- All MCP server calls are wrapped in try-catch blocks
- Failed operations are logged with detailed context
- Graceful degradation when optional services fail

### 2. Sandboxed npm Operations (NFR-003)

#### File System Validation
The `sandbox.ts` service provides:
- **Path Traversal Protection**: All file paths are validated to ensure they remain within the repository boundary
- **Safe File Operations**: `safeReadFile()` and `safeWriteFile()` functions validate paths before access
- Prevents access to sensitive system files (e.g., `/etc/passwd`)

#### npm Command Sandboxing
- **Command Whitelist**: Only approved npm commands are allowed (`install`, `test`, `run`, `ci`, `audit`)
- **Isolated Environment**: npm operations run with restricted environment variables
- **Resource Limits**:
  - 3-minute timeout for `npm install`
  - 5-minute timeout for `npm test`
  - 10MB maximum buffer size to prevent memory exhaustion
- **Local Cache**: npm uses a local cache within the repository (`.npm-cache`)
- **Disabled Telemetry**: All npm telemetry and update notifications are disabled

#### Security Environment Variables
```typescript
{
  npm_config_cache: path.join(repoPath, '.npm-cache'),
  NO_UPDATE_NOTIFIER: '1',
  DISABLE_OPENCOLLECTIVE: '1',
  npm_config_fund: 'false'
}
```

### 3. Secure API Key Handling (NFR-003)

#### VS Code SecretStorage
The `secureConfig.ts` service provides:
- **Encrypted Storage**: All API keys and tokens are stored using VS Code's SecretStorage API
- **No Plaintext Secrets**: Secrets are never stored in configuration files or logs
- **Secure Retrieval**: Secrets are only retrieved when needed and never exposed in logs

#### Supported Credentials
- GitHub Personal Access Token
- npm Token
- MCP Server Credentials

#### Secret Detection
- Automatic detection of potential secrets in configuration
- Warning messages when secrets are found in non-secure locations
- Sanitization of environment variables before logging

#### User Commands
- `codecrypt.configureGitHubToken`: Securely prompt and store GitHub token
- `codecrypt.clearSecrets`: Clear all stored secrets

#### Configuration Validation
- MCP server configurations are validated for exposed secrets
- Environment variables are sanitized before logging
- Token patterns are detected and redacted in logs

### 4. Logging Security

#### Sanitization
- All environment variables are sanitized before logging
- Tokens and API keys are replaced with `***REDACTED***`
- Secret detection based on:
  - Key name patterns (token, key, secret, password, credential)
  - Value patterns (long alphanumeric strings)

#### Example
```typescript
// Before sanitization
{ GITHUB_TOKEN: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz' }

// After sanitization
{ GITHUB_TOKEN: '***REDACTED***' }
```

## Security Best Practices

### For Users

1. **Use Secure Storage**: Always store API keys using the provided commands, never in configuration files
2. **Review Permissions**: Ensure GitHub tokens have minimal required permissions
3. **Regular Rotation**: Rotate API keys regularly
4. **Monitor Activity**: Review the CodeCrypt output channel for any security warnings

### For Developers

1. **Never Log Secrets**: Always use `sanitizeEnvForLogging()` before logging environment variables
2. **Validate Paths**: Always use `validateFilePath()` before file operations
3. **Use Sandboxed Operations**: Use `sandboxedNpmInstall()` and `sandboxedNpmTest()` instead of direct execution
4. **Handle Errors Gracefully**: Provide user-friendly error messages without exposing sensitive details

## Testing

Security features are thoroughly tested:
- **Sandbox Tests**: 11 tests covering path validation, file operations, and command restrictions
- **Secure Config Tests**: 11 tests covering secret detection, sanitization, and configuration management
- **Error Handling Tests**: 13 tests covering various error scenarios and retry logic

## Compliance

CodeCrypt's security implementation addresses:
- **NFR-002 (Reliability)**: Comprehensive error handling and retry mechanisms
- **NFR-003 (Security)**: Sandboxed execution and secure credential storage
- **OWASP Top 10**: Protection against path traversal, injection attacks, and sensitive data exposure

## Future Enhancements

Potential security improvements for future versions:
1. Container-based isolation for complete process sandboxing
2. Network traffic monitoring and filtering
3. Code signing verification for downloaded packages
4. Audit logging for all security-sensitive operations
5. Integration with security scanning services (Snyk, npm audit)
