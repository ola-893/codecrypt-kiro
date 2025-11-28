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
  logger.info(`Updating ${planItem.packageName} from ${planItem.currentVersion} to ${planItem.targetVersion}`);
  
  try {
    // Read package.json
    const packageJsonPath = path.join(repoPath, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    
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
    
    // Write updated package.json
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf-8'
    );
    logger.info('package.json updated');
    
    // Run npm install
    logger.info('Running npm install...');
    try {
      const output = execSync('npm install', {
        cwd: repoPath,
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 120000 // 2 minute timeout
      });
      logger.info('npm install completed successfully');
    } catch (error: any) {
      const errorMessage = error.stderr || error.stdout || error.message;
      logger.error('npm install failed', error);
      throw new CodeCryptError(
        `npm install failed: ${errorMessage}`,
        'NPM_INSTALL_FAILED'
      );
    }
    
    // Commit the changes
    const commitMessage = generateCommitMessage(planItem);
    const commitHash = await commitChanges(repoPath, commitMessage);
    
    logger.info(`Changes committed: ${commitHash}`);
    
    return {
      success: true,
      packageName: planItem.packageName,
      version: planItem.targetVersion,
      commitHash
    };
    
  } catch (error: any) {
    logger.error(`Failed to update ${planItem.packageName}`, error);
    
    return {
      success: false,
      packageName: planItem.packageName,
      version: planItem.targetVersion,
      error: error.message || 'Unknown error'
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
