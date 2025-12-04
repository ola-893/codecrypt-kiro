/**
 * Dependency Updater Service
 * Handles automated dependency updates with npm install and git commits
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { ResurrectionPlanItem, TransformationLogEntry } from '../types';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';
import { sandboxedNpmInstall, validateFilePath, safeReadFile, safeWriteFile } from './sandbox';

const logger = getLogger();

/**
 * Result of a dependency update operation
 */
export interface UpdateResult {
  /** Whether the update was successful */
  success: boolean;
  /** Package name that was updated */
  packageName: string;
  /** Version that was installed */
  version: string;
  /** Error message if update failed */
  error?: string;
  /** Commit hash if successful */
  commitHash?: string;
}

/**
 * Update a single dependency in package.json
 * 
 * @param repoPath Path to the cloned repository
 * @param planItem The resurrection plan item to execute
 * @returns UpdateResult with success status and details
 */
export async function updateDependency(
  repoPath: string,
  planItem: ResurrectionPlanItem
): Promise<UpdateResult> {
  // Log dependency update start with enhanced formatting
  logger.dependencyUpdate(
    planItem.packageName,
    planItem.currentVersion,
    planItem.targetVersion,
    'pending'
  );
  
  try {
    // Read package.json with sandboxed file access
    const packageJsonPath = path.join(repoPath, 'package.json');
    let packageJsonContent: string;
    let packageJson: any;
    
    try {
      // Validate file path is within repository
      validateFilePath(packageJsonPath, repoPath);
      packageJsonContent = await safeReadFile(packageJsonPath, repoPath);
    } catch (error: any) {
      throw new CodeCryptError(
        `Failed to read package.json: ${error.message}`,
        'FILE_READ_ERROR'
      );
    }
    
    try {
      packageJson = JSON.parse(packageJsonContent);
    } catch (error: any) {
      throw new CodeCryptError(
        `Failed to parse package.json: ${error.message}`,
        'JSON_PARSE_ERROR'
      );
    }
    
    // Update the version in dependencies or devDependencies
    let updated = false;
    
    if (packageJson.dependencies && packageJson.dependencies[planItem.packageName]) {
      packageJson.dependencies[planItem.packageName] = planItem.targetVersion;
      updated = true;
      logger.info(`Updated ${planItem.packageName} in dependencies`);
    }
    
    if (packageJson.devDependencies && packageJson.devDependencies[planItem.packageName]) {
      packageJson.devDependencies[planItem.packageName] = planItem.targetVersion;
      updated = true;
      logger.info(`Updated ${planItem.packageName} in devDependencies`);
    }
    
    if (!updated) {
      throw new CodeCryptError(
        `Package ${planItem.packageName} not found in dependencies or devDependencies`,
        'PACKAGE_NOT_FOUND'
      );
    }
    
    if (!packageJson.overrides) {
      packageJson.overrides = {};
    }
    packageJson.overrides.querystring = '0.2.1';
    
    // Write updated package.json with sandboxed file access
    try {
      await safeWriteFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + '\n',
        repoPath
      );
      logger.info('package.json updated');
    } catch (error: any) {
      throw new CodeCryptError(
        `Failed to write package.json: ${error.message}`,
        'FILE_WRITE_ERROR'
      );
    }
    
    // Run npm install in sandboxed environment
    logger.info('Running sandboxed npm install...');
    try {
      sandboxedNpmInstall(repoPath);
      logger.info('npm install completed successfully');
    } catch (error: any) {
      logger.error('npm install failed', error);
      
      // Provide user-friendly error messages based on common npm errors
      const errorMessage = error.message || String(error);
      let userMessage = 'npm install failed';
      
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('network')) {
        userMessage = 'Network error during npm install. Please check your internet connection.';
      } else if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
        userMessage = 'Permission denied during npm install. Check file permissions.';
      } else if (errorMessage.includes('ETIMEOUT') || errorMessage.includes('timeout')) {
        userMessage = 'npm install timed out. The registry may be slow or unreachable.';
      } else if (errorMessage.includes('peer dep')) {
        userMessage = `Peer dependency conflict when installing ${planItem.packageName}`;
      } else if (errorMessage.includes('out of memory')) {
        userMessage = 'npm install ran out of memory. Try closing other applications.';
      }
      
      throw new CodeCryptError(
        `${userMessage}: ${errorMessage}`,
        'NPM_INSTALL_FAILED'
      );
    }
    
    // Commit the changes with error handling
    const commitMessage = generateCommitMessage(planItem);
    let commitHash: string;
    
    try {
      commitHash = await commitChanges(repoPath, commitMessage);
      logger.info(`Changes committed: ${commitHash}`);
    } catch (error: any) {
      throw new CodeCryptError(
        `Failed to commit changes: ${error.message}`,
        'GIT_COMMIT_FAILED'
      );
    }
    
    // Log successful update
    logger.dependencyUpdate(
      planItem.packageName,
      planItem.currentVersion,
      planItem.targetVersion,
      'success'
    );
    
    return {
      success: true,
      packageName: planItem.packageName,
      version: planItem.targetVersion,
      commitHash
    };
    
  } catch (error: any) {
    const errorMessage = error instanceof CodeCryptError 
      ? error.message 
      : `Unexpected error: ${error.message || 'Unknown error'}`;
    
    logger.error(`Failed to update ${planItem.packageName}`, error);
    
    // Log failed update
    logger.dependencyUpdate(
      planItem.packageName,
      planItem.currentVersion,
      planItem.targetVersion,
      'failed'
    );
    
    return {
      success: false,
      packageName: planItem.packageName,
      version: planItem.targetVersion,
      error: errorMessage
    };
  }
}

/**
 * Generate a descriptive commit message for a dependency update
 */
function generateCommitMessage(planItem: ResurrectionPlanItem): string {
  const emoji = planItem.fixesVulnerabilities ? '🔒' : '⬆️';
  let message = `${emoji} feat: Update ${planItem.packageName} to ${planItem.targetVersion}`;
  
  if (planItem.fixesVulnerabilities) {
    message += `\n\nFixes ${planItem.vulnerabilityCount} security vulnerabilit${planItem.vulnerabilityCount === 1 ? 'y' : 'ies'}`;
  }
  
  message += `\n\nReason: ${planItem.reason}`;
  message += `\nPrevious version: ${planItem.currentVersion}`;
  message += `\n\n🧟 Automated by CodeCrypt`;
  
  return message;
}

/**
 * Commit changes to git
 * 
 * @param repoPath Path to the repository
 * @param message Commit message
 * @returns Commit hash
 */
async function commitChanges(repoPath: string, message: string): Promise<string> {
  try {
    // Stage all changes
    execSync('git add .', {
      cwd: repoPath,
      stdio: 'pipe'
    });
    
    // Commit with message
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: repoPath,
      stdio: 'pipe'
    });
    
    // Get commit hash
    const commitHash = execSync('git rev-parse HEAD', {
      cwd: repoPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    
    return commitHash;
    
  } catch (error: any) {
    logger.error('Failed to commit changes', error);
    throw new CodeCryptError(
      `Failed to commit changes: ${error.message}`,
      'GIT_COMMIT_FAILED'
    );
  }
}

/**
 * Create a transformation log entry for a dependency update
 */
export function createUpdateLogEntry(
  result: UpdateResult,
  planItem: ResurrectionPlanItem
): TransformationLogEntry {
  if (result.success) {
    return {
      timestamp: new Date(),
      type: 'dependency_update',
      message: `Updated ${result.packageName} from ${planItem.currentVersion} to ${result.version}`,
      details: {
        packageName: result.packageName,
        oldVersion: planItem.currentVersion,
        newVersion: result.version,
        commitHash: result.commitHash,
        fixedVulnerabilities: planItem.vulnerabilityCount
      }
    };
  } else {
    return {
      timestamp: new Date(),
      type: 'error',
      message: `Failed to update ${result.packageName}: ${result.error}`,
      details: {
        packageName: result.packageName,
        targetVersion: result.version,
        error: result.error
      }
    };
  }
}
