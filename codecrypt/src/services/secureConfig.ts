/**
 * Secure Configuration Service
 * Handles secure storage and retrieval of API keys and MCP credentials
 */

import * as vscode from 'vscode';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';



/**
 * Configuration keys for secure storage
 */
export enum SecureConfigKey {
  GITHUB_TOKEN = 'codecrypt.github.token',
  NPM_TOKEN = 'codecrypt.npm.token',
  MCP_GITHUB_TOKEN = 'codecrypt.mcp.github.token',
  MCP_REGISTRY_TOKEN = 'codecrypt.mcp.registry.token',
  ANTHROPIC_API_KEY = 'codecrypt.anthropicApiKey',
  GEMINI_API_KEY = 'codecrypt.geminiApiKey'
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

/**
 * Secure configuration manager
 * Uses VS Code's SecretStorage API for sensitive data
 */
export class SecureConfigManager {
  private context: vscode.ExtensionContext;
  private secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.secretStorage = context.secrets;
  }

  /**
   * Store a secret value securely
   * @param key Configuration key
   * @param value Secret value to store
   */
  async storeSecret(key: SecureConfigKey, value: string): Promise<void> {
    const logger = getLogger();
    try {
      await this.secretStorage.store(key, value);
      logger.info(`Stored secret for key: ${key}`);
    } catch (error: any) {
      logger.error(`Failed to store secret for key: ${key}`, error);
      throw new CodeCryptError(
        `Failed to store secure configuration: ${error.message}`,
        'CONFIG_STORE_ERROR'
      );
    }
  }

  /**
   * Retrieve a secret value
   * @param key Configuration key
   * @returns Secret value or undefined if not found
   */
  async getSecret(key: SecureConfigKey): Promise<string | undefined> {
    const logger = getLogger();
    try {
      const value = await this.secretStorage.get(key);
      if (value) {
        logger.info(`Retrieved secret for key: ${key}`);
      }
      return value;
    } catch (error: any) {
      logger.error(`Failed to retrieve secret for key: ${key}`, error);
      throw new CodeCryptError(
        `Failed to retrieve secure configuration: ${error.message}`,
        'CONFIG_RETRIEVE_ERROR'
      );
    }
  }

  /**
   * Delete a secret value
   * @param key Configuration key
   */
  async deleteSecret(key: SecureConfigKey): Promise<void> {
    const logger = getLogger();
    try {
      await this.secretStorage.delete(key);
      logger.info(`Deleted secret for key: ${key}`);
    } catch (error: any) {
      logger.error(`Failed to delete secret for key: ${key}`, error);
      throw new CodeCryptError(
        `Failed to delete secure configuration: ${error.message}`,
        'CONFIG_DELETE_ERROR'
      );
    }
  }

  /**
   * Get GitHub token with fallback to environment variable
   * @returns GitHub token or undefined
   */
  async getGitHubToken(): Promise<string | undefined> {
    const logger = getLogger();
    // First try to get from secure storage
    let token = await this.getSecret(SecureConfigKey.GITHUB_TOKEN);
    
    if (!token) {
      // Fallback to environment variable (for CI/CD)
      token = process.env.GITHUB_TOKEN;
      if (token) {
        logger.info('Using GitHub token from environment variable');
      }
    }
    
    return token;
  }

  /**
   * Get npm token with fallback to environment variable
   * @returns npm token or undefined
   */
  async getNpmToken(): Promise<string | undefined> {
    const logger = getLogger();
    // First try to get from secure storage
    let token = await this.getSecret(SecureConfigKey.NPM_TOKEN);
    
    if (!token) {
      // Fallback to environment variable
      token = process.env.NPM_TOKEN;
      if (token) {
        logger.info('Using npm token from environment variable');
      }
    }
    
    return token;
  }

  /**
   * Prompt user for GitHub token and store it securely
   */
  async promptAndStoreGitHubToken(): Promise<string | undefined> {
    const token = await vscode.window.showInputBox({
      prompt: 'Enter your GitHub Personal Access Token',
      password: true,
      placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'Token is required';
        }
        if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
          return 'Invalid GitHub token format';
        }
        return null;
      }
    });

    if (token) {
      await this.storeSecret(SecureConfigKey.GITHUB_TOKEN, token);
      vscode.window.showInformationMessage('GitHub token stored securely');
      return token;
    }

    return undefined;
  }

  /**
   * Get Anthropic API key with fallback to environment variable
   * @returns Anthropic API key or undefined
   */
  async getAnthropicApiKey(): Promise<string | undefined> {
    const logger = getLogger();
    // First try to get from secure storage
    let apiKey = await this.getSecret(SecureConfigKey.ANTHROPIC_API_KEY);
    
    if (!apiKey) {
      // Fallback to environment variable
      apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        logger.info('Using Anthropic API key from environment variable');
      }
    }
    
    return apiKey;
  }

  /**
   * Prompt user for Anthropic API key and store it securely
   */
  async promptAndStoreAnthropicApiKey(): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Anthropic API Key',
      password: true,
      placeHolder: 'sk-ant-api03-...',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'API key is required';
        }
        if (!value.startsWith('sk-ant-')) {
          return 'Invalid Anthropic API key format';
        }
        return null;
      }
    });

    if (apiKey) {
      await this.storeSecret(SecureConfigKey.ANTHROPIC_API_KEY, apiKey);
      vscode.window.showInformationMessage('Anthropic API key stored securely');
      return apiKey;
    }

    return undefined;
  }

  /**
   * Get Gemini API key with fallback to environment variable
   * @returns Gemini API key or undefined
   */
  async getGeminiApiKey(): Promise<string | undefined> {
    const logger = getLogger();
    // First try to get from secure storage
    let apiKey = await this.getSecret(SecureConfigKey.GEMINI_API_KEY);
    
    if (!apiKey) {
      // Fallback to environment variable
      apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        logger.info('Using Gemini API key from environment variable');
      }
    }
    
    return apiKey;
  }

  /**
   * Prompt user for Gemini API key and store it securely
   */
  async promptAndStoreGeminiApiKey(): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Google Gemini API Key',
      password: true,
      placeHolder: 'AIza...',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'API key is required';
        }
        if (!value.startsWith('AIza')) {
          return 'Invalid Gemini API key format (should start with AIza)';
        }
        return null;
      }
    });

    if (apiKey) {
      await this.storeSecret(SecureConfigKey.GEMINI_API_KEY, apiKey);
      vscode.window.showInformationMessage('Gemini API key stored securely');
      return apiKey;
    }

    return undefined;
  }

  /**
   * Get MCP server configuration from VS Code settings
   * Validates that no secrets are exposed in the configuration
   */
  getMCPServerConfig(): MCPServerConfig[] {
    const logger = getLogger();
    const config = vscode.workspace.getConfiguration('codecrypt');
    const mcpServers = config.get<MCPServerConfig[]>('mcpServers', []);

    // Validate that no secrets are in the configuration
    for (const server of mcpServers) {
      if (server.env) {
        for (const [key, value] of Object.entries(server.env)) {
          // Check for common secret patterns
          if (this.looksLikeSecret(key, value)) {
            logger.warn(`Potential secret detected in MCP server config: ${server.name}.env.${key}`);
            vscode.window.showWarningMessage(
              `Warning: Potential secret detected in MCP server configuration for ${server.name}. ` +
              `Please use secure storage instead.`
            );
          }
        }
      }
    }

    return mcpServers;
  }

  /**
   * Check if a configuration value looks like a secret
   */
  private looksLikeSecret(key: string, value: string): boolean {
    const secretKeywords = ['token', 'key', 'secret', 'password', 'credential', 'api_key'];
    const keyLower = key.toLowerCase();
    
    // Check if key contains secret keywords
    const hasSecretKeyword = secretKeywords.some(keyword => keyLower.includes(keyword));
    
    // Check if value looks like a token (long alphanumeric string)
    const looksLikeToken = value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value);
    
    return hasSecretKeyword && looksLikeToken;
  }

  /**
   * Sanitize environment variables to remove secrets before logging
   */
  sanitizeEnvForLogging(env: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(env)) {
      if (this.looksLikeSecret(key, value)) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Validate MCP server connection without exposing credentials
   */
  async validateMCPConnection(serverName: string): Promise<boolean> {
    const logger = getLogger();
    logger.info(`Validating MCP server connection: ${serverName}`);
    
    try {
      // Get server configuration
      const servers = this.getMCPServerConfig();
      const server = servers.find(s => s.name === serverName);
      
      if (!server) {
        throw new CodeCryptError(
          `MCP server '${serverName}' not found in configuration`,
          'MCP_SERVER_NOT_FOUND'
        );
      }
      
      if (server.disabled) {
        logger.warn(`MCP server '${serverName}' is disabled`);
        return false;
      }
      
      // Log sanitized configuration
      const sanitizedEnv = server.env ? this.sanitizeEnvForLogging(server.env) : {};
      logger.info(`MCP server config: ${JSON.stringify({ ...server, env: sanitizedEnv })}`);
      
      // TODO: Implement actual connection validation
      // For now, just check that the configuration exists
      logger.info(`MCP server '${serverName}' configuration is valid`);
      return true;
      
    } catch (error: any) {
      logger.error(`Failed to validate MCP server connection: ${serverName}`, error);
      return false;
    }
  }

  /**
   * Clear all stored secrets (for testing or reset)
   */
  async clearAllSecrets(): Promise<void> {
    const logger = getLogger();
    logger.info('Clearing all stored secrets');
    
    for (const key of Object.values(SecureConfigKey)) {
      try {
        await this.deleteSecret(key);
      } catch (error) {
        // Ignore errors for non-existent keys
      }
    }
    
    vscode.window.showInformationMessage('All stored secrets have been cleared');
  }
}

/**
 * Global secure config manager instance
 */
let secureConfigManager: SecureConfigManager | undefined;

/**
 * Initialize the secure config manager
 */
export function initializeSecureConfig(context: vscode.ExtensionContext): SecureConfigManager {
  const logger = getLogger();
  secureConfigManager = new SecureConfigManager(context);
  logger.info('Secure configuration manager initialized');
  return secureConfigManager;
}

/**
 * Get the secure config manager instance
 */
export function getSecureConfig(): SecureConfigManager {
  if (!secureConfigManager) {
    throw new CodeCryptError(
      'Secure configuration manager not initialized',
      'CONFIG_NOT_INITIALIZED'
    );
  }
  return secureConfigManager;
}
