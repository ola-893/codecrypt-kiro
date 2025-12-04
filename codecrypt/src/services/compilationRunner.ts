/**
 * CompilationRunner - Executes build commands and captures output
 * 
 * This service handles the execution of compilation/build commands for
 * post-resurrection validation. It supports npm, yarn, and pnpm package
 * managers and provides timeout handling.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import {
  ICompilationRunner,
  CompileOptions,
  PostResurrectionCompilationResult,
  PostResurrectionCompilationProof,
  PackageManager
} from '../types';
import { detectBuildConfiguration } from './environmentDetection';

/** Default timeout for compilation (5 minutes) */
const DEFAULT_TIMEOUT = 300000;

/**
 * CompilationRunner class that executes build commands and captures output
 */
export class CompilationRunner implements ICompilationRunner {
  /**
   * Execute compilation and return result
   * 
   * @param repoPath - Path to the repository
   * @param options - Compilation options including package manager and build command
   * @returns Promise resolving to compilation result
   */
  async compile(repoPath: string, options: CompileOptions): Promise<PostResurrectionCompilationResult> {
    const { packageManager, buildCommand, timeout = DEFAULT_TIMEOUT } = options;
    const startTime = Date.now();

    // Check if the project has a build script
    const buildConfig = await detectBuildConfiguration(repoPath);
    
    if (!buildConfig.hasBuildScript) {
      // No build script found - return not_applicable status
      const duration = Date.now() - startTime;
      return {
        success: true,
        compilationStatus: 'not_applicable',
        exitCode: 0,
        stdout: 'No build script detected. Compilation not required.',
        stderr: '',
        duration
      };
    }

    return new Promise((resolve) => {
      // Build the full command based on package manager
      const { command, args } = this.buildCommandArgs(packageManager, buildCommand);

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(command, args, {
        cwd: repoPath,
        shell: true,
        env: { ...process.env, CI: 'true', FORCE_COLOR: '0' }
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);


      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (timedOut) {
          resolve({
            success: false,
            compilationStatus: 'failed',
            exitCode: -1,
            stdout,
            stderr: stderr + '\n[TIMEOUT] Compilation timed out after ' + timeout + 'ms',
            duration
          });
        } else {
          const success = code === 0;
          resolve({
            success,
            compilationStatus: success ? 'passed' : 'failed',
            exitCode: code ?? 1,
            stdout,
            stderr,
            duration
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          compilationStatus: 'failed',
          exitCode: -1,
          stdout,
          stderr: stderr + '\n[ERROR] ' + error.message,
          duration
        });
      });
    });
  }

  /**
   * Build command and arguments based on package manager
   */
  private buildCommandArgs(packageManager: PackageManager, buildCommand: string): { command: string; args: string[] } {
    // If buildCommand is a full command (e.g., "npm run build"), use it directly
    if (buildCommand.startsWith('npm ') || buildCommand.startsWith('yarn ') || buildCommand.startsWith('pnpm ')) {
      const parts = buildCommand.split(' ');
      return { command: parts[0], args: parts.slice(1) };
    }

    // Otherwise, construct the command based on package manager
    switch (packageManager) {
      case 'yarn':
        return { command: 'yarn', args: ['run', buildCommand] };
      case 'pnpm':
        return { command: 'pnpm', args: ['run', buildCommand] };
      case 'npm':
      default:
        return { command: 'npm', args: ['run', buildCommand] };
    }
  }

  /**
   * Detect the build command from package.json
   * 
   * @param packageJson - Parsed package.json object
   * @returns The detected build command, 'test' if available, or null if no scripts
   */
  detectBuildCommand(packageJson: Record<string, unknown>): string | null {
    const scripts = packageJson.scripts as Record<string, string> | undefined;
    
    if (!scripts || Object.keys(scripts).length === 0) {
      return null; // No scripts available
    }

    // Priority order for build commands
    const buildCommandPriority = [
      'build',
      'compile',
      'tsc',
      'build:prod',
      'build:production',
      'dist',
      'test' // Fallback to test if no build command
    ];

    for (const cmd of buildCommandPriority) {
      if (scripts[cmd]) {
        return cmd;
      }
    }

    // If no standard build command found, return null
    return null;
  }

  /**
   * Detect the package manager from lockfiles in the repository
   * 
   * @param repoPath - Path to the repository
   * @returns Promise resolving to the detected package manager
   */
  async detectPackageManager(repoPath: string): Promise<PackageManager> {
    // Check for lockfiles in priority order
    const lockfiles: Array<{ file: string; manager: PackageManager }> = [
      { file: 'pnpm-lock.yaml', manager: 'pnpm' },
      { file: 'yarn.lock', manager: 'yarn' },
      { file: 'package-lock.json', manager: 'npm' }
    ];

    for (const { file, manager } of lockfiles) {
      const lockfilePath = path.join(repoPath, file);
      if (fs.existsSync(lockfilePath)) {
        return manager;
      }
    }

    // Default to npm if no lockfile found
    return 'npm';
  }

  /**
   * Generate a compilation proof artifact for successful compilation
   * 
   * @param result - The compilation result
   * @param options - The compile options used
   * @param iterations - Number of iterations required
   * @returns CompilationProof artifact
   */
  generateCompilationProof(
    result: PostResurrectionCompilationResult,
    options: CompileOptions,
    iterations: number
  ): PostResurrectionCompilationProof {
    // Generate hash of the combined output
    const outputHash = crypto
      .createHash('sha256')
      .update(result.stdout + result.stderr)
      .digest('hex');

    return {
      timestamp: new Date(),
      buildCommand: options.buildCommand,
      exitCode: result.exitCode,
      duration: result.duration,
      outputHash,
      packageManager: options.packageManager,
      iterationsRequired: iterations
    };
  }
}

/**
 * Create a new CompilationRunner instance
 */
export function createCompilationRunner(): CompilationRunner {
  return new CompilationRunner();
}
