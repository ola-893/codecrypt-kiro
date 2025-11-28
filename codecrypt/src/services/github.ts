/**
 * GitHub integration service
 * Handles repository operations via GitHub MCP and git commands
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';

const logger = getLogger();

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
      ]);
      
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
  retries = 3
): Promise<string> {
  logger.info(`Cloning repository ${owner}/${repo}`);
  
  // Create temporary workspace directory
  const workspaceRoot = path.join(require('os').tmpdir(), 'codecrypt');
  await fs.mkdir(workspaceRoot, { recursive: true });
  
  const repoPath = path.join(workspaceRoot, `${owner}-${repo}-${Date.now()}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execFileAsync = promisify(execFile);
      
      // Clone the repository using git
      const repoUrl = `https://github.com/${owner}/${repo}.git`;
      logger.info(`Cloning from ${repoUrl} to ${repoPath}`);
      
      await execFileAsync('git', ['clone', repoUrl, repoPath]);
      
      // Verify the clone was successful
      const stats = await fs.stat(repoPath);
      if (!stats.isDirectory()) {
        throw new Error('Clone directory was not created');
      }
      
      logger.info(`Successfully cloned repository to ${repoPath}`);
      return repoPath;
      
    } catch (error: any) {
      logger.warn(`Attempt ${attempt}/${retries} failed to clone repository: ${error.message}`);
      
      // Clean up failed clone attempt
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
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new CodeCryptError('Unexpected error in cloneRepository', 'UNKNOWN_ERROR');
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
