/**
 * Git History Service
 * Fetches and processes git history for Ghost Tour visualization
 */

import { getCommitHistory } from './github';
import { GitCommit, FileHistory } from '../types';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Fetch git history and build file histories
 */
export async function fetchGitHistoryData(repoPath: string): Promise<{
  commits: GitCommit[];
  fileHistories: FileHistory[];
}> {
  logger.info('Fetching git history for Ghost Tour');

  try {
    // Fetch commit history
    const rawCommits = await getCommitHistory(repoPath, 100);

    // Convert to GitCommit format
    const commits: GitCommit[] = rawCommits.map(commit => ({
      hash: commit.hash,
      date: new Date(commit.date),
      message: commit.message,
      author: commit.author,
      filesChanged: [], // Will be populated if needed
    }));

    // Build file histories from commits
    const fileHistories = await buildFileHistories(repoPath, commits);

    logger.info(`Git history loaded: ${commits.length} commits, ${fileHistories.length} files`);

    return { commits, fileHistories };
  } catch (error: any) {
    logger.error('Failed to fetch git history', error);
    // Return empty data rather than failing
    return { commits: [], fileHistories: [] };
  }
}

/**
 * Build file histories from commits
 */
async function buildFileHistories(
  repoPath: string,
  commits: GitCommit[]
): Promise<FileHistory[]> {
  const fileMap = new Map<string, FileHistory>();

  // For now, create a simple file history based on current files
  // In a full implementation, we'd parse git log for each file
  // This is a simplified version for the demo

  try {
    const { execSync } = require('child_process');
    
    // Get list of files with their change counts
    const output = execSync(
      'git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -50',
      { cwd: repoPath, encoding: 'utf-8' }
    );

    const lines = output.split('\n').filter((line: string) => line.trim());

    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (match) {
        const [, changesStr, filePath] = match;
        const changes = parseInt(changesStr, 10);

        // Skip non-code files
        if (!filePath.match(/\.(ts|js|tsx|jsx|py|java|go|rs|cpp|c|h)$/)) {
          continue;
        }

        fileMap.set(filePath, {
          path: filePath,
          commits: commits.slice(0, Math.min(changes, 10)).map(commit => ({
            hash: commit.hash,
            date: commit.date,
            message: commit.message,
            changes: 1,
          })),
          totalChanges: changes,
          loc: Math.floor(Math.random() * 500) + 50, // Placeholder
          complexity: Math.floor(Math.random() * 20) + 1, // Placeholder
        });
      }
    }
  } catch (error) {
    logger.warn('Could not build detailed file histories, using simplified version', error);
  }

  return Array.from(fileMap.values());
}
