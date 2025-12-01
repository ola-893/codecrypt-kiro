/**
 * FixHistoryStore - Persists successful fixes for future use
 * 
 * This service stores fix history in JSON files per repository,
 * enabling the system to learn from past successful fixes and
 * prioritize them for similar errors in future resurrections.
 * 
 * **Feature: post-resurrection-validation**
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  IFixHistoryStore,
  FixHistory,
  FixStrategy,
  HistoricalFix
} from '../types';

/**
 * Default directory for storing fix history files
 */
const DEFAULT_HISTORY_DIR = '.codecrypt';
const HISTORY_FILE_NAME = 'fix-history.json';

/**
 * FixHistoryStore class that persists and retrieves fix history
 */
export class FixHistoryStore implements IFixHistoryStore {
  /** In-memory cache of fix histories by repo ID */
  private historyCache: Map<string, FixHistory> = new Map();
  
  /** Global fix patterns (successful across multiple repos) */
  private globalPatterns: Map<string, FixStrategy> = new Map();

  /** Base directory for storing history files (for testing) */
  private baseDir: string | null = null;

  /**
   * Create a new FixHistoryStore
   * @param baseDir - Optional base directory for history files (for testing)
   */
  constructor(baseDir?: string) {
    this.baseDir = baseDir || null;
  }

  /**
   * Record a successful fix for an error pattern
   * 
   * @param repoId - Repository identifier
   * @param errorPattern - Pattern that identifies the error
   * @param strategy - The fix strategy that succeeded
   */
  recordFix(repoId: string, errorPattern: string, strategy: FixStrategy): void {
    const history = this.getOrCreateHistory(repoId);
    
    // Find existing fix for this pattern
    const existingIndex = history.fixes.findIndex(f => f.errorPattern === errorPattern);
    
    if (existingIndex >= 0) {
      // Update existing fix
      const existing = history.fixes[existingIndex];
      // Only update if it's the same strategy type
      if (this.strategiesMatch(existing.strategy, strategy)) {
        existing.successCount++;
        existing.lastUsed = new Date();
      } else {
        // Replace with new strategy (it worked more recently)
        history.fixes[existingIndex] = {
          errorPattern,
          strategy,
          successCount: 1,
          lastUsed: new Date()
        };
      }
    } else {
      // Add new fix
      history.fixes.push({
        errorPattern,
        strategy,
        successCount: 1,
        lastUsed: new Date()
      });
    }

    // Update last resurrection timestamp
    history.lastResurrection = new Date();

    // Update cache
    this.historyCache.set(repoId, history);

    // Update global patterns for cross-repo learning
    this.updateGlobalPattern(errorPattern, strategy);
  }

  /**
   * Get a previously successful fix for an error pattern
   * 
   * @param errorPattern - Pattern that identifies the error
   * @returns The successful fix strategy, or null if none found
   */
  getSuccessfulFix(errorPattern: string): FixStrategy | null {
    // First check global patterns (cross-repo learning)
    const globalFix = this.globalPatterns.get(errorPattern);
    if (globalFix) {
      return globalFix;
    }

    // Check all cached histories
    for (const history of this.historyCache.values()) {
      const fix = history.fixes.find(f => f.errorPattern === errorPattern);
      if (fix) {
        return fix.strategy;
      }
    }

    return null;
  }

  /**
   * Get the full fix history for a repository
   * 
   * @param repoId - Repository identifier
   * @returns The fix history for the repository
   */
  getHistory(repoId: string): FixHistory {
    return this.getOrCreateHistory(repoId);
  }

  /**
   * Save fix history to persistent storage
   * 
   * @param repoId - Repository identifier
   * @param history - The fix history to save
   */
  async saveHistory(repoId: string, history: FixHistory): Promise<void> {
    const historyPath = this.getHistoryPath(repoId);
    const historyDir = path.dirname(historyPath);

    // Ensure directory exists
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }

    // Serialize with date handling
    const serialized = JSON.stringify(history, (key, value) => {
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }
      return value;
    }, 2);

    fs.writeFileSync(historyPath, serialized, 'utf-8');

    // Update cache
    this.historyCache.set(repoId, history);
  }

  /**
   * Load fix history from persistent storage
   * 
   * @param repoId - Repository identifier
   * @returns The loaded fix history, or null if not found
   */
  async loadHistory(repoId: string): Promise<FixHistory | null> {
    // Check cache first
    if (this.historyCache.has(repoId)) {
      return this.historyCache.get(repoId)!;
    }

    const historyPath = this.getHistoryPath(repoId);

    if (!fs.existsSync(historyPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(historyPath, 'utf-8');
      const history = JSON.parse(content, (key, value) => {
        // Revive Date objects
        if (value && typeof value === 'object' && value.__type === 'Date') {
          return new Date(value.value);
        }
        // Handle ISO date strings
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return new Date(value);
        }
        return value;
      }) as FixHistory;

      // Update cache
      this.historyCache.set(repoId, history);

      // Update global patterns from loaded history
      for (const fix of history.fixes) {
        this.updateGlobalPattern(fix.errorPattern, fix.strategy);
      }

      return history;
    } catch (error) {
      // If file is corrupted, return null
      return null;
    }
  }

  /**
   * Get fixes prioritized by success count and recency
   * 
   * @param repoId - Repository identifier
   * @returns Array of historical fixes sorted by priority
   */
  getPrioritizedFixes(repoId: string): HistoricalFix[] {
    const history = this.getOrCreateHistory(repoId);
    
    // Sort by success count (descending), then by last used (descending)
    return [...history.fixes].sort((a, b) => {
      // Primary sort: success count
      if (b.successCount !== a.successCount) {
        return b.successCount - a.successCount;
      }
      // Secondary sort: last used date
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });
  }

  /**
   * Find a fix for an error pattern, prioritizing repo-specific then global
   * 
   * @param repoId - Repository identifier
   * @param errorPattern - Pattern that identifies the error
   * @returns The best matching fix strategy, or null if none found
   */
  findBestFix(repoId: string, errorPattern: string): FixStrategy | null {
    const history = this.getOrCreateHistory(repoId);
    
    // First, check repo-specific history
    const repoFix = history.fixes.find(f => f.errorPattern === errorPattern);
    if (repoFix) {
      return repoFix.strategy;
    }

    // Fall back to global patterns
    return this.globalPatterns.get(errorPattern) || null;
  }

  /**
   * Clear all history (for testing)
   */
  clearAll(): void {
    this.historyCache.clear();
    this.globalPatterns.clear();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get or create a fix history for a repository
   */
  private getOrCreateHistory(repoId: string): FixHistory {
    if (this.historyCache.has(repoId)) {
      return this.historyCache.get(repoId)!;
    }

    const newHistory: FixHistory = {
      repoId,
      fixes: [],
      lastResurrection: new Date()
    };

    this.historyCache.set(repoId, newHistory);
    return newHistory;
  }

  /**
   * Get the file path for a repository's history file
   */
  private getHistoryPath(repoId: string): string {
    // If baseDir is set (testing), use it directly
    if (this.baseDir) {
      return path.join(this.baseDir, this.sanitizeRepoId(repoId), HISTORY_FILE_NAME);
    }

    // Otherwise, use the repo path as the base
    // repoId is expected to be a path or URL
    const basePath = this.resolveRepoPath(repoId);
    return path.join(basePath, DEFAULT_HISTORY_DIR, HISTORY_FILE_NAME);
  }

  /**
   * Resolve a repo ID to a file system path
   */
  private resolveRepoPath(repoId: string): string {
    // If it's already a path, use it
    if (fs.existsSync(repoId) || repoId.startsWith('/') || repoId.startsWith('.')) {
      return repoId;
    }

    // If it's a URL, create a hash-based directory
    const hash = crypto.createHash('sha256').update(repoId).digest('hex').substring(0, 12);
    return path.join(process.cwd(), DEFAULT_HISTORY_DIR, hash);
  }

  /**
   * Sanitize a repo ID for use as a directory name
   */
  private sanitizeRepoId(repoId: string): string {
    // Replace invalid characters with underscores
    return repoId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
  }

  /**
   * Check if two strategies are functionally equivalent
   */
  private strategiesMatch(a: FixStrategy, b: FixStrategy): boolean {
    if (a.type !== b.type) {
      return false;
    }

    switch (a.type) {
      case 'adjust_version':
        return a.package === (b as typeof a).package;
      case 'remove_lockfile':
        return a.lockfile === (b as typeof a).lockfile;
      case 'substitute_package':
        return a.original === (b as typeof a).original;
      case 'remove_package':
        return a.package === (b as typeof a).package;
      case 'add_resolution':
        return a.package === (b as typeof a).package;
      default:
        return true;
    }
  }

  /**
   * Update global patterns with a successful fix
   */
  private updateGlobalPattern(errorPattern: string, strategy: FixStrategy): void {
    // Only add to global patterns if not already present
    // (we don't want to overwrite with potentially less successful strategies)
    if (!this.globalPatterns.has(errorPattern)) {
      this.globalPatterns.set(errorPattern, strategy);
    }
  }
}

/**
 * Create a new FixHistoryStore instance
 */
export function createFixHistoryStore(baseDir?: string): FixHistoryStore {
  return new FixHistoryStore(baseDir);
}
