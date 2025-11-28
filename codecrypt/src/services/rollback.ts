/**
 * Rollback Service
 * Handles reverting failed dependency updates using git
 */

import { execSync } from 'child_process';
import { DependencyInfo, TransformationLogEntry } from '../types';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';

const logger = getLogger();

/**
 * Result of a rollback operation
 */
export interface RollbackResult {
  /** Whether the rollback was successful */
  success: boolean;
  /** Commit hash that was rolled back */
  rolledBackCommit?: string;
  /** Commit message that was rolled back */
  rolledBackMessage?: string;
  /** Current commit hash after rollback */
  currentCommit?: string;
  /** Error message if rollback failed */
  error?: string;
}

/**
 * Get the current commit hash
 */
function getCurrentCommitHash(repoPath: string): string {
  try {
    const hash = execSync('git rev-parse HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    
    return hash;
  } catch (error: any) {
    throw new CodeCryptError(
      `Failed to get current commit hash: ${error.message}`,
      'GIT_ERROR'
    );
  }
}

/**
 * Get the commit message for a specific commit
 */
function getCommitMessage(repoPath: string, commitHash: string): string {
  try {
    const message = execSync(`git log -1 --pretty=%B ${commitHash}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    
    return message;
  } catch (error: any) {
    throw new CodeCryptError(
      `Failed to get commit message: ${error.message}`,
      'GIT_ERROR'
    );
  }
}

/**
 * Check if there are uncommitted changes
 */
function hasUncommittedChanges(repoPath: string): boolean {
  try {
    const status = execSync('git status --porcelain', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    
    return status.length > 0;
  } catch (error: any) {
    throw new CodeCryptError(
      `Failed to check git status: ${error.message}`,
      'GIT_ERROR'
    );
  }
}

/**
 * Rollback the last commit using git reset --hard HEAD~1
 * 
 * @param repoPath Path to the repository
 * @returns RollbackResult with details of the rollback
 */
export async function rollbackLastCommit(repoPath: string): Promise<RollbackResult> {
  logger.info('Rolling back last commit');
  
  try {
    // Get current commit info before rollback
    const currentCommit = getCurrentCommitHash(repoPath);
    const commitMessage = getCommitMessage(repoPath, currentCommit);
    
    logger.info(`Rolling back commit: ${currentCommit}`);
    logger.info(`Commit message: ${commitMessage}`);
    
    // Check for uncommitted changes
    if (hasUncommittedChanges(repoPath)) {
      logger.warn('Uncommitted changes detected, they will be lost');
    }
    
    // Perform rollback
    execSync('git reset --hard HEAD~1', {
      cwd: repoPath,
      stdio: 'pipe'
    });
    
    // Get new current commit
    const newCommit = getCurrentCommitHash(repoPath);
    
    logger.info(`Rollback successful, now at commit: ${newCommit}`);
    
    return {
      success: true,
      rolledBackCommit: currentCommit,
      rolledBackMessage: commitMessage,
      currentCommit: newCommit
    };
    
  } catch (error: any) {
    logger.error('Rollback failed', error);
    
    return {
      success: false,
      error: error.message || 'Unknown rollback error'
    };
  }
}

/**
 * Create a transformation log entry for a rollback
 */
export function createRollbackLogEntry(
  result: RollbackResult,
  packageName: string
): TransformationLogEntry {
  if (result.success) {
    return {
      timestamp: new Date(),
      type: 'rollback',
      message: `Rolled back failed update for ${packageName}`,
      details: {
        packageName,
        rolledBackCommit: result.rolledBackCommit,
        rolledBackMessage: result.rolledBackMessage,
        currentCommit: result.currentCommit
      }
    };
  } else {
    return {
      timestamp: new Date(),
      type: 'error',
      message: `Failed to rollback update for ${packageName}: ${result.error}`,
      details: {
        packageName,
        error: result.error
      }
    };
  }
}

/**
 * Mark a dependency as problematic in the dependency list
 * 
 * @param dependencies List of dependencies
 * @param packageName Name of the problematic package
 */
export function markDependencyAsProblematic(
  dependencies: DependencyInfo[],
  packageName: string
): void {
  const dependency = dependencies.find(d => d.name === packageName);
  
  if (dependency) {
    dependency.updateStatus = 'failed';
    logger.info(`Marked ${packageName} as problematic`);
  } else {
    logger.warn(`Could not find dependency ${packageName} to mark as problematic`);
  }
}

/**
 * Recover from a failed update by rolling back and marking the dependency as problematic
 * 
 * @param repoPath Path to the repository
 * @param packageName Name of the package that failed to update
 * @param dependencies List of all dependencies
 * @returns RollbackResult
 */
export async function recoverFromFailedUpdate(
  repoPath: string,
  packageName: string,
  dependencies: DependencyInfo[]
): Promise<RollbackResult> {
  logger.info(`Recovering from failed update of ${packageName}`);
  
  // Rollback the last commit
  const rollbackResult = await rollbackLastCommit(repoPath);
  
  if (rollbackResult.success) {
    // Mark dependency as problematic
    markDependencyAsProblematic(dependencies, packageName);
    logger.info(`Recovery successful for ${packageName}`);
  } else {
    logger.error(`Recovery failed for ${packageName}`);
  }
  
  return rollbackResult;
}
