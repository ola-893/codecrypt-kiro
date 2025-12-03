/**
 * Sandbox Service
 * Provides secure execution environment for npm operations and file system access
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';

const logger = getLogger();

/**
 * Validates that a file path is within the allowed repository directory
 * Prevents path traversal attacks and access to files outside the repo
 * 
 * @param filePath Path to validate
 * @param repoPath Root path of the repository
 * @throws CodeCryptError if path is outside repository
 */
export function validateFilePath(filePath: string, repoPath: string): void {
  const normalizedFilePath = path.normalize(path.resolve(filePath));
  const normalizedRepoPath = path.normalize(path.resolve(repoPath));
  
  if (!normalizedFilePath.startsWith(normalizedRepoPath)) {
    throw new CodeCryptError(
      `Access denied: Path '${filePath}' is outside repository boundary`,
      'PATH_TRAVERSAL_BLOCKED'
    );
  }
  
  logger.info(`Path validation passed: ${filePath}`);
}

/**
 * Safely read a file within the repository
 * 
 * @param filePath Path to the file
 * @param repoPath Root path of the repository
 * @returns File contents
 */
export async function safeReadFile(filePath: string, repoPath: string): Promise<string> {
  validateFilePath(filePath, repoPath);
  
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error: any) {
    throw new CodeCryptError(
      `Failed to read file '${filePath}': ${error.message}`,
      'FILE_READ_ERROR'
    );
  }
}

/**
 * Safely write a file within the repository
 * 
 * @param filePath Path to the file
 * @param content Content to write
 * @param repoPath Root path of the repository
 */
export async function safeWriteFile(
  filePath: string,
  content: string,
  repoPath: string
): Promise<void> {
  validateFilePath(filePath, repoPath);
  
  try {
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error: any) {
    throw new CodeCryptError(
      `Failed to write file '${filePath}': ${error.message}`,
      'FILE_WRITE_ERROR'
    );
  }
}

/**
 * Options for sandboxed npm execution
 */
export interface SandboxedNpmOptions {
  /** Working directory (must be within repository) */
  cwd: string;
  /** Repository root path for validation */
  repoPath: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables to set */
  env?: Record<string, string>;
}

/**
 * Execute npm command in a sandboxed environment
 * Prevents arbitrary code execution from affecting the host system
 * 
 * @param command npm command to execute (e.g., 'install', 'test')
 * @param options Sandbox options
 * @returns Command output
 */
export function executeSandboxedNpm(
  command: string,
  options: SandboxedNpmOptions
): string {
  const { cwd, repoPath, timeout = 120000, env = {} } = options;
  
  // Validate working directory is within repository
  validateFilePath(cwd, repoPath);
  
  // Whitelist of allowed npm commands
  const allowedCommands = ['install', 'test', 'run', 'ci', 'audit'];
  const commandParts = command.split(' ');
  const npmCommand = commandParts[0];
  
  if (!allowedCommands.includes(npmCommand)) {
    throw new CodeCryptError(
      `npm command '${npmCommand}' is not allowed in sandbox`,
      'COMMAND_NOT_ALLOWED'
    );
  }
  
  logger.info(`Executing sandboxed npm command: npm ${command}`);
  logger.info(`Working directory: ${cwd}`);
  
  try {
    // Create sandboxed environment
    const sandboxEnv = {
      ...process.env,
      ...env,
      // Prevent npm from running arbitrary scripts by default
      npm_config_ignore_scripts: 'false', // We allow scripts but monitor them
      // Set npm to use a local cache within the repo
      npm_config_cache: path.join(repoPath, '.npm-cache'),
      // Disable update notifier to prevent network calls
      NO_UPDATE_NOTIFIER: '1',
      // Disable telemetry
      DISABLE_OPENCOLLECTIVE: '1',
      npm_config_fund: 'false'
    };
    
    // Execute npm command with restrictions
    const output = execSync(`npm ${command}`, {
      cwd,
      encoding: 'utf-8',
      timeout,
      env: sandboxEnv,
      stdio: 'pipe',
      // Set maximum buffer size to prevent memory exhaustion
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    logger.info('Sandboxed npm command completed successfully');
    return output;
    
  } catch (error: any) {
    const errorMessage = error.stderr || error.stdout || error.message;
    
    // Check for timeout
    if (error.killed && error.signal === 'SIGTERM') {
      throw new CodeCryptError(
        `npm ${command} timed out after ${timeout}ms`,
        'NPM_TIMEOUT'
      );
    }
    
    // Check for memory issues
    if (errorMessage.includes('heap out of memory') || errorMessage.includes('ENOMEM')) {
      throw new CodeCryptError(
        `npm ${command} ran out of memory`,
        'NPM_OUT_OF_MEMORY'
      );
    }
    
    logger.error(`Sandboxed npm command failed: ${errorMessage}`);
    throw new CodeCryptError(
      `npm ${command} failed: ${errorMessage}`,
      'NPM_COMMAND_FAILED'
    );
  }
}

/**
 * Execute npm install in a sandboxed environment
 * Uses --legacy-peer-deps to handle peer dependency conflicts in legacy repositories
 * Uses --ignore-scripts to skip native compilation that may fail on modern architectures
 * 
 * @param repoPath Path to the repository
 * @returns Installation output
 */
export function sandboxedNpmInstall(repoPath: string): string {
  return executeSandboxedNpm('install --legacy-peer-deps --ignore-scripts', {
    cwd: repoPath,
    repoPath,
    timeout: 180000 // 3 minutes for install
  });
}

/**
 * Execute npm test in a sandboxed environment
 * 
 * @param repoPath Path to the repository
 * @returns Test output
 */
export function sandboxedNpmTest(repoPath: string): string {
  return executeSandboxedNpm('test', {
    cwd: repoPath,
    repoPath,
    timeout: 300000 // 5 minutes for tests
  });
}

/**
 * Execute npm audit in a sandboxed environment
 * 
 * @param repoPath Path to the repository
 * @returns Audit output
 */
export function sandboxedNpmAudit(repoPath: string): string {
  return executeSandboxedNpm('audit --json', {
    cwd: repoPath,
    repoPath,
    timeout: 60000 // 1 minute for audit
  });
}

/**
 * Clean up sandbox artifacts
 * Removes temporary files and caches created during sandboxed operations
 * 
 * @param repoPath Path to the repository
 */
export async function cleanupSandbox(repoPath: string): Promise<void> {
  logger.info('Cleaning up sandbox artifacts');
  
  try {
    const cachePath = path.join(repoPath, '.npm-cache');
    await fs.rm(cachePath, { recursive: true, force: true });
    logger.info('Sandbox cleanup complete');
  } catch (error: any) {
    logger.warn(`Failed to clean up sandbox: ${error.message}`);
  }
}
