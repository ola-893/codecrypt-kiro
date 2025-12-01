/**
 * GitHub integration service
 * Handles repository operations via GitHub MCP and git commands
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';

import { getSecureConfig } from './secureConfig';
import { spawnSync } from 'child_process';

const logger = getLogger();

/**
 * Checks if the GitHub CLI (gh) is installed and available in the system's PATH.
 * @returns {boolean} True if gh is installed, false otherwise.
 */
function isGitHubCliInstalled(): boolean {
  // Use spawnSync to synchronously check for the command.
  // The 'which' or 'command -v' equivalent in Node.js is to try spawning the process
  // and check for the 'ENOENT' error.
  const result = spawnSync('gh', ['--version'], { stdio: 'ignore' });
  return result.error === undefined;
}

/**
 * Repository metadata from GitHub
 */
export interface RepositoryMetadata {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  stars: number;
  lastPushedAt: string;
}

/**
 * Parse GitHub repository URL to extract owner and repo name
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (!match) {
    throw new CodeCryptError('Invalid GitHub URL format', 'INVALID_URL');
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Fetch repository metadata from GitHub
 * Uses the GitHub MCP server to get repository information
 */
export async function fetchRepositoryMetadata(
  owner: string,
  repo: string,
  retries = 3
): Promise<RepositoryMetadata> {
  logger.info(`Fetching metadata for ${owner}/${repo}`);

  if (!isGitHubCliInstalled()) {
    const errorMessage = 'GitHub CLI (gh) not found. Please install it to continue. See: https://cli.github.com/';
    logger.error(errorMessage);
    vscode.window.showErrorMessage(errorMessage);
    throw new CodeCryptError(errorMessage, 'DEPENDENCY_MISSING');
  }
  
  const secureConfig = getSecureConfig();
  const token = await secureConfig.getGitHubToken();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Use GitHub CLI to fetch repository metadata
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execFileAsync = promisify(execFile);
      
      const { stdout } = await execFileAsync('gh', [
        'repo',
        'view',
        `${owner}/${repo}`,
        '--json',
        'name,owner,description,defaultBranchRef,primaryLanguage,stargazerCount,pushedAt'
      ], {
        env: {
          ...process.env,
          GH_TOKEN: token,
        },
      });
      
      const data = JSON.parse(stdout);
      
      const metadata: RepositoryMetadata = {
        owner: data.owner.login,
        name: data.name,
        fullName: `${data.owner.login}/${data.name}`,
        description: data.description,
        defaultBranch: data.defaultBranchRef.name,
        language: data.primaryLanguage?.name || null,
        stars: data.stargazerCount,
        lastPushedAt: data.pushedAt
      };
      
      logger.info(`Successfully fetched metadata for ${metadata.fullName}`);
      return metadata;
      
    } catch (error: any) {
      logger.warn(`Attempt ${attempt}/${retries} failed to fetch metadata: ${error.message}`);
      
      if (attempt === retries) {
        throw new CodeCryptError(
          `Failed to fetch repository metadata after ${retries} attempts: ${error.message}`,
          'GITHUB_API_ERROR'
        );
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new CodeCryptError('Unexpected error in fetchRepositoryMetadata', 'UNKNOWN_ERROR');
}

/**
 * Clone a GitHub repository to a temporary workspace directory
 */
export async function cloneRepository(
  owner: string,
  repo: string,
  workspaceDir: string | undefined,
  retries = 3
): Promise<string> {
  logger.info(`Cloning repository ${owner}/${repo}`);
  
  const repoName = `resurrected-${repo}`;
  const workspaceRoot = workspaceDir ? path.join(workspaceDir, repoName) : path.join(require('os').tmpdir(), 'codecrypt');
  
  if (!workspaceDir) {
    await fs.mkdir(workspaceRoot, { recursive: true });
  }
  
  const repoPath = workspaceDir ? workspaceRoot : path.join(workspaceRoot, `${owner}-${repo}-${Date.now()}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execFileAsync = promisify(execFile);
      
      const repoUrl = `https://github.com/${owner}/${repo}.git`;
      logger.info(`Cloning from ${repoUrl} to ${repoPath}`);
      
      await execFileAsync('git', ['clone', repoUrl, repoPath]);
      
      const stats = await fs.stat(repoPath);
      if (!stats.isDirectory()) {
        throw new Error('Clone directory was not created');
      }
      
      logger.info(`Successfully cloned repository to ${repoPath}`);
      return repoPath;
      
    } catch (error: any) {
      logger.warn(`Attempt ${attempt}/${retries} failed to clone repository: ${error.message}`);
      
      try {
        await fs.rm(repoPath, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.warn(`Failed to clean up after failed clone: ${cleanupError}`);
      }
      
      if (attempt === retries) {
        throw new CodeCryptError(
          `Failed to clone repository after ${retries} attempts: ${error.message}`,
          'CLONE_ERROR'
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new CodeCryptError('Unexpected error in cloneRepository', 'UNKNOWN_ERROR');
}

/**
 * Open the cloned repository in a new Kiro window.
 */
export async function openClonedRepository(repoPath: string): Promise<void> {
  logger.info(`Opening cloned repository in new window: ${repoPath}`);
  try {
    const repoUri = vscode.Uri.file(repoPath);
    await vscode.commands.executeCommand('vscode.openFolder', repoUri, { forceNewWindow: true });
    
    // Slight delay to ensure the new window is ready
    setTimeout(() => {
      vscode.commands.executeCommand('kiro .');
    }, 2000);

  } catch (error) {
    logger.error('Failed to open cloned repository in new window', error);
    vscode.window.showErrorMessage(`Failed to open the resurrected repository: ${error}`);
  }
}

/**
 * Get commit history for a repository
 */
export async function getCommitHistory(
  repoPath: string,
  maxCount = 100
): Promise<Array<{ hash: string; date: string; message: string; author: string }>> {
  logger.info(`Fetching commit history from ${repoPath}`);
  
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    
    const { stdout } = await execFileAsync('git', [
      'log',
      `--max-count=${maxCount}`,
      '--format=%H|%aI|%s|%an'
    ], { cwd: repoPath });
    
    const commits = stdout
      .trim()
      .split('\n')
      .filter((line: string) => line.length > 0)
      .map((line: string) => {
        const [hash, date, message, author] = line.split('|');
        return { hash, date, message, author };
      });
    
    logger.info(`Found ${commits.length} commits`);
    return commits;
    
  } catch (error: any) {
    throw new CodeCryptError(
      `Failed to fetch commit history: ${error.message}`,
      'GIT_ERROR'
    );
  }
}

/**
 * Create and checkout a new Git branch for resurrection
 * Branch name format: codecrypt/resurrection-<timestamp>
 * 
 * @param repoPath Path to the cloned repository
 * @returns Name of the created branch
 */
export async function createResurrectionBranch(repoPath: string): Promise<string> {
  logger.info('Creating resurrection branch');
  
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    
    // Generate branch name with timestamp
    const timestamp = Date.now();
    const branchName = `codecrypt/resurrection-${timestamp}`;
    
    logger.info(`Branch name: ${branchName}`);
    
    // Create and checkout the new branch
    await execFileAsync('git', ['checkout', '-b', branchName], { cwd: repoPath });
    
    logger.info(`Successfully created and checked out branch: ${branchName}`);
    
    // Verify we're on the new branch
    const { stdout } = await execFileAsync('git', ['branch', '--show-current'], { cwd: repoPath });
    const currentBranch = stdout.trim();
    
    if (currentBranch !== branchName) {
      throw new Error(`Branch verification failed: expected ${branchName}, got ${currentBranch}`);
    }
    
    logger.info(`Branch verification successful: ${currentBranch}`);
    
    return branchName;
    
  } catch (error: any) {
    throw new CodeCryptError(
      `Failed to create resurrection branch: ${error.message}`,
      'GIT_BRANCH_ERROR'
    );
  }
}

/**
 * Push a branch to the remote repository
 * 
 * @param repoPath Path to the repository
 * @param branchName Name of the branch to push
 * @param retries Number of retry attempts
 */
export async function pushBranch(
  repoPath: string,
  branchName: string,
  retries = 3
): Promise<void> {
  logger.info(`Pushing branch ${branchName} to remote`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execFileAsync = promisify(execFile);
      
      // Push the branch to origin
      await execFileAsync('git', ['push', '-u', 'origin', branchName], { cwd: repoPath });
      
      logger.info(`Successfully pushed branch ${branchName}`);
      return;
      
    } catch (error: any) {
      logger.warn(`Attempt ${attempt}/${retries} failed to push branch: ${error.message}`);
      
      if (attempt === retries) {
        throw new CodeCryptError(
          `Failed to push branch after ${retries} attempts: ${error.message}`,
          'GIT_PUSH_ERROR'
        );
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Create a pull request on GitHub
 * Uses GitHub CLI to create the PR with resurrection report
 * 
 * @param owner Repository owner
 * @param repo Repository name
 * @param branchName Name of the head branch (resurrection branch)
 * @param baseBranch Name of the base branch (usually 'main' or 'master')
 * @param title PR title
 * @param body PR body (resurrection report)
 * @param retries Number of retry attempts
 * @returns URL of the created pull request
 */
export async function createPullRequest(
  owner: string,
  repo: string,
  branchName: string,
  baseBranch: string,
  title: string,
  body: string,
  retries = 3
): Promise<string> {
  logger.info(`Creating pull request for ${owner}/${repo}`);

  if (!isGitHubCliInstalled()) {
    const errorMessage = 'GitHub CLI (gh) not found. Please install it to create pull requests. See: https://cli.github.com/';
    logger.error(errorMessage);
    vscode.window.showErrorMessage(errorMessage);
    throw new CodeCryptError(errorMessage, 'DEPENDENCY_MISSING');
  }

  const secureConfig = getSecureConfig();
  const token = await secureConfig.getGitHubToken();

  logger.info(`  Head: ${branchName}`);
  logger.info(`  Base: ${baseBranch}`);
  logger.info(`  Title: ${title}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execFileAsync = promisify(execFile);
      
      // Create PR using GitHub CLI
      const { stdout } = await execFileAsync('gh', [
        'pr',
        'create',
        '--repo', `${owner}/${repo}`,
        '--head', branchName,
        '--base', baseBranch,
        '--title', title,
        '--body', body
      ], {
        env: {
          ...process.env,
          GH_TOKEN: token,
        },
      });
      
      const prUrl = stdout.trim();
      
      logger.info(`Successfully created pull request: ${prUrl}`);
      return prUrl;
      
    } catch (error: any) {
      logger.warn(`Attempt ${attempt}/${retries} failed to create PR: ${error.message}`);
      
      if (attempt === retries) {
        // Check if the error is due to no commits
        if (error.message.includes('no commits') || error.message.includes('No commits')) {
          throw new CodeCryptError(
            'Cannot create pull request: no commits on resurrection branch',
            'NO_COMMITS_ERROR'
          );
        }
        
        // Check if PR already exists
        if (error.message.includes('already exists')) {
          logger.warn('Pull request already exists for this branch');
          throw new CodeCryptError(
            'Pull request already exists for this branch',
            'PR_ALREADY_EXISTS'
          );
        }
        
        throw new CodeCryptError(
          `Failed to create pull request after ${retries} attempts: ${error.message}`,
          'PR_CREATION_ERROR'
        );
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new CodeCryptError('Unexpected error in createPullRequest', 'UNKNOWN_ERROR');
}

/**
 * Generate a resurrection-themed PR title
 * 
 * @param stats Statistics about the resurrection
 * @returns Formatted PR title
 */
export function generatePRTitle(stats: {
  updatesCount: number;
  vulnerabilitiesFixed: number;
}): string {
  const emoji = '🧟';
  
  if (stats.vulnerabilitiesFixed > 0) {
    return `${emoji} CodeCrypt Resurrection: ${stats.updatesCount} updates, ${stats.vulnerabilitiesFixed} vulnerabilities fixed`;
  }
  
  return `${emoji} CodeCrypt Resurrection: ${stats.updatesCount} dependency updates`;
}
