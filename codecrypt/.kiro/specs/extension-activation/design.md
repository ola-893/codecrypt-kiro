# Design Document: Extension Activation & Lifecycle

## Overview

This design addresses the critical issue of VS Code extension activation failures. The extension must activate reliably, handle errors gracefully, and provide clear diagnostics when issues occur. The design focuses on defensive programming, comprehensive error handling, and thorough testing.

## Architecture

### Activation Flow

```
VS Code Extension Host
  ↓
activate(context) called
  ↓
Try-Catch Wrapper
  ├→ Initialize Logger (synchronous)
  ├→ Initialize Secure Config (synchronous)
  ├→ Register Commands (synchronous)
  └→ Log Success
  ↓
Extension Active
```

### Error Handling Strategy

1. **Top-Level Try-Catch**: Wrap entire activate function to catch any initialization errors
2. **Service-Level Error Handling**: Each service handles its own errors
3. **Graceful Degradation**: Extension continues to activate even if non-critical services fail
4. **User Feedback**: Show clear error messages to users when activation fails

## Components and Interfaces

### 1. Extension Entry Point (`extension.ts`)

**Responsibilities:**
- Export `activate()` and `deactivate()` functions
- Initialize core services
- Register all commands
- Handle activation errors

**Interface:**
```typescript
export function activate(context: vscode.ExtensionContext): void | Promise<void>
export function deactivate(): void | Promise<void>
```

### 2. Logger Service (`utils/logger.ts`)

**Responsibilities:**
- Create VS Code output channel
- Provide logging methods (debug, info, warn, error)
- Handle log disposal

**Interface:**
```typescript
export function initializeLogger(channelName: string): Logger
export function getLogger(): Logger
export function disposeLogger(): void
```

### 3. Secure Config Service (`services/secureConfig.ts`)

**Responsibilities:**
- Initialize VS Code SecretStorage
- Provide secure storage for API keys
- Handle configuration errors

**Interface:**
```typescript
export function initializeSecureConfig(context: vscode.ExtensionContext): SecureConfigManager
export function getSecureConfig(): SecureConfigManager
```

### 4. Command Registration

**Responsibilities:**
- Register all VS Code commands
- Add commands to context.subscriptions
- Handle command execution errors

**Commands:**
1. `codecrypt.resurrectRepository` - Main resurrection workflow
2. `codecrypt.helloWorld` - Test command
3. `codecrypt.configureGitHubToken` - Configure GitHub token
4. `codecrypt.configureGeminiApiKey` - Configure Gemini API key
5. `codecrypt.switchLLMProvider` - Switch between LLM providers
6. `codecrypt.clearSecrets` - Clear all stored secrets

## Data Models

### Extension Context
```typescript
interface vscode.ExtensionContext {
  subscriptions: vscode.Disposable[];
  secrets: vscode.SecretStorage;
  extensionPath: string;
  // ... other VS Code provided fields
}
```

### Logger
```typescript
class Logger {
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel;
  
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: any): void;
  section(title: string): void;
  subsection(title: string): void;
  show(): void;
  dispose(): void;
}
```

### Secure Config Manager
```typescript
class SecureConfigManager {
  private context: vscode.ExtensionContext;
  private secretStorage: vscode.SecretStorage;
  
  async storeSecret(key: SecureConfigKey, value: string): Promise<void>;
  async getSecret(key: SecureConfigKey): Promise<string | undefined>;
  async deleteSecret(key: SecureConfigKey): Promise<void>;
  async clearAllSecrets(): Promise<void>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Activation Idempotence
*For any* VS Code session, calling activate() multiple times should not cause errors or duplicate command registrations
**Validates: Requirements 2.1, 2.3**

### Property 2: Command Registration Completeness
*For any* extension activation, all commands declared in package.json should be registered and available in the command palette
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: Error Containment
*For any* error during activation, the error should be logged and displayed to the user without crashing the extension host process
**Validates: Requirements 2.5, 7.1, 7.2**

### Property 4: Resource Cleanup
*For any* extension deactivation, all resources (output channels, subscriptions) should be properly disposed
**Validates: Requirements 5.2, 5.3, 5.4**

### Property 5: Manifest Validity
*For any* package.json, all required fields (name, publisher, version, main, engines.vscode) must be present and valid
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

## Error Handling

### Activation Errors

**Strategy**: Wrap activate() in try-catch, log error, show user message, re-throw

```typescript
export function activate(context: vscode.ExtensionContext) {
  try {
    // Initialization code
  } catch (error) {
    console.error('CodeCrypt extension activation failed:', error);
    vscode.window.showErrorMessage(`CodeCrypt failed to activate: ${error.message}`);
    throw error; // Let VS Code know activation failed
  }
}
```

### Service Initialization Errors

**Strategy**: Log warning, continue activation with degraded functionality

```typescript
try {
  initializeOptionalService();
} catch (error) {
  logger.warn('Optional service failed to initialize', error);
  // Continue activation
}
```

### Command Execution Errors

**Strategy**: Catch in command handler, log, show user-friendly message

```typescript
vscode.commands.registerCommand('codecrypt.command', async () => {
  try {
    // Command logic
  } catch (error) {
    logger.error('Command failed', error);
    vscode.window.showErrorMessage(`Command failed: ${formatErrorForUser(error)}`);
  }
});
```

## Testing Strategy

### Unit Tests

**Focus**: Individual service initialization and error handling

Tests:
- Logger initialization creates output channel
- Secure config manager initializes with context
- Error formatting produces user-friendly messages

**Framework**: Mocha (VS Code's default test framework)

### Integration Tests

**Focus**: Full extension activation in test VS Code instance

Tests:
- Extension can be found by ID
- Extension activates successfully
- All commands are registered
- Commands execute without throwing unhandled errors
- Package.json has all required fields
- Error handling works gracefully

**Framework**: @vscode/test-electron

**Test Structure**:
```typescript
suite('Extension Activation Test Suite', () => {
  suiteSetup(async () => {
    extension = vscode.extensions.getExtension('codecrypt.codecrypt');
    await extension.activate();
  });
  
  test('Extension should activate successfully', () => {
    assert.strictEqual(extension.isActive, true);
  });
  
  test('All commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('codecrypt.resurrectRepository'));
    // ... test other commands
  });
});
```

### Manual Testing

**Procedure**:
1. Press F5 to launch Extension Development Host
2. Open Developer Tools console
3. Check for activation errors
4. Test each command from command palette
5. Check Extension Host log for errors

## Implementation Notes

### Channel Closed Error

The "Channel has been closed" error indicates the extension host process crashed during activation. Common causes:

1. **Synchronous error in module loading**: An import statement fails because a module has a top-level error
2. **Unhandled promise rejection**: An async operation fails without proper error handling
3. **Native module loading failure**: A native Node.js module (like dockerode) fails to load

**Solution**: 
- Wrap activate() in try-catch to prevent crashes
- Use dynamic imports for heavy dependencies
- Add error logging at each initialization step

### Dynamic Imports

For services that might fail to load (e.g., Docker, AST parsers), use dynamic imports:

```typescript
try {
  const { createResurrectionOrchestrator } = await import('./services/resurrectionOrchestrator');
  // Use service
} catch (error) {
  logger.warn('Orchestrator service unavailable', error);
  // Provide fallback or skip feature
}
```

### Activation Events

Modern VS Code auto-generates activation events from `contributes.commands`. The explicit `activationEvents` array can be removed or kept for clarity.

## Deployment Considerations

### Pre-Deployment Checklist

- [ ] All integration tests pass
- [ ] Extension activates in clean VS Code instance
- [ ] All commands appear in command palette
- [ ] No errors in Extension Host log
- [ ] Package.json has all required fields
- [ ] Compiled output (dist/extension.js) exists and is not corrupted

### Debugging Production Issues

1. Ask user to check Extension Host log
2. Ask user to try in clean VS Code profile
3. Check VS Code version compatibility
4. Verify all dependencies are installed
5. Try clean build (rm -rf dist out node_modules && npm install && npm run compile)
