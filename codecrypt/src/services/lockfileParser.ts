/**
 * Lockfile Parser Service
 * 
 * Parses npm lockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml) to extract
 * transitive dependencies with URL-based resolutions. This enables detection of
 * dead URLs in nested dependencies that aren't visible in package.json.
 * 
 * Requirements: 1.1, 4.1
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Transitive dependency information extracted from lockfile
 */
export interface TransitiveDependency {
  /** Package name */
  name: string;
  /** Resolved URL from lockfile */
  resolvedUrl: string;
  /** Parent packages that depend on this */
  parents: string[];
  /** Depth in dependency tree (0 = direct dependency) */
  depth: number;
}

/**
 * Lockfile type
 */
export type LockfileType = 'npm' | 'yarn' | 'pnpm' | null;

/**
 * Lockfile Parser interface
 */
export interface ILockfileParser {
  /**
   * Parse lockfile and extract all URL-based dependencies
   */
  parseLockfile(repoPath: string): Promise<TransitiveDependency[]>;
  
  /**
   * Detect which lockfile type exists
   */
  detectLockfileType(repoPath: string): Promise<LockfileType>;
  
  /**
   * Delete all lockfiles in preparation for regeneration
   */
  deleteLockfiles(repoPath: string): Promise<void>;
}

/**
 * LockfileParser class
 */
export class LockfileParser implements ILockfileParser {
  /**
   * Detect which lockfile type exists in the repository
   */
  async detectLockfileType(repoPath: string): Promise<LockfileType> {
    const lockfiles: Array<{ file: string; type: LockfileType }> = [
      { file: 'package-lock.json', type: 'npm' },
      { file: 'yarn.lock', type: 'yarn' },
      { file: 'pnpm-lock.yaml', type: 'pnpm' }
    ];

    for (const { file, type } of lockfiles) {
      const lockfilePath = path.join(repoPath, file);
      try {
        await fs.access(lockfilePath);
        logger.info(`Detected ${type} lockfile: ${file}`);
        return type;
      } catch {
        // File doesn't exist, continue
      }
    }

    logger.info('No lockfile detected');
    return null;
  }

  /**
   * Parse lockfile and extract all URL-based dependencies
   */
  async parseLockfile(repoPath: string): Promise<TransitiveDependency[]> {
    const lockfileType = await this.detectLockfileType(repoPath);

    if (!lockfileType) {
      logger.info('No lockfile found, skipping transitive dependency analysis');
      return [];
    }

    logger.info(`Parsing ${lockfileType} lockfile for URL-based dependencies`);

    switch (lockfileType) {
      case 'npm':
        return this.parseNpmLockfile(repoPath);
      case 'yarn':
        return this.parseYarnLockfile(repoPath);
      case 'pnpm':
        return this.parsePnpmLockfile(repoPath);
      default:
        return [];
    }
  }

  /**
   * Parse npm lockfile (package-lock.json)
   */
  private async parseNpmLockfile(repoPath: string): Promise<TransitiveDependency[]> {
    const lockfilePath = path.join(repoPath, 'package-lock.json');
    
    try {
      const content = await fs.readFile(lockfilePath, 'utf-8');
      const lockfile = JSON.parse(content);
      
      const dependencies: TransitiveDependency[] = [];
      
      // npm v7+ uses "packages" field
      if (lockfile.packages) {
        for (const [packagePath, packageInfo] of Object.entries(lockfile.packages)) {
          const resolved = (packageInfo as any).resolved;
          
          if (resolved && this.isUrlBasedResolution(resolved)) {
            // Extract package name from path (e.g., "node_modules/querystring" -> "querystring")
            const name = this.extractPackageNameFromPath(packagePath);
            
            if (name) {
              dependencies.push({
                name,
                resolvedUrl: resolved,
                parents: [], // Will be populated in a second pass
                depth: this.calculateDepth(packagePath)
              });
            }
          }
        }
      }
      
      // npm v6 uses "dependencies" field (legacy format)
      if (lockfile.dependencies && !lockfile.packages) {
        this.parseNpmV6Dependencies(lockfile.dependencies, dependencies, [], 0);
      }
      
      logger.info(`Found ${dependencies.length} URL-based dependencies in npm lockfile`);
      return dependencies;
    } catch (error) {
      logger.error('Failed to parse npm lockfile', error);
      return [];
    }
  }

  /**
   * Parse npm v6 dependencies (recursive)
   */
  private parseNpmV6Dependencies(
    deps: Record<string, any>,
    result: TransitiveDependency[],
    parents: string[],
    depth: number
  ): void {
    for (const [name, info] of Object.entries(deps)) {
      if (info.resolved && this.isUrlBasedResolution(info.resolved)) {
        result.push({
          name,
          resolvedUrl: info.resolved,
          parents: [...parents],
          depth
        });
      }
      
      // Recurse into nested dependencies
      if (info.dependencies) {
        this.parseNpmV6Dependencies(info.dependencies, result, [...parents, name], depth + 1);
      }
    }
  }

  /**
   * Parse yarn lockfile (yarn.lock)
   */
  private async parseYarnLockfile(repoPath: string): Promise<TransitiveDependency[]> {
    const lockfilePath = path.join(repoPath, 'yarn.lock');
    
    try {
      const content = await fs.readFile(lockfilePath, 'utf-8');
      const dependencies: TransitiveDependency[] = [];
      
      // Yarn lockfile format: package@version:\n  resolved "url"
      const lines = content.split('\n');
      let currentPackage: string | null = null;
      
      for (const line of lines) {
        // Package declaration line (starts without indentation, contains @)
        if (line && !line.startsWith(' ') && !line.startsWith('\t')) {
          // Extract package name from declaration like "querystring@https://..." or "@scope/package@https://..."
          // Handle both quoted and unquoted package names
          let match;
          
          // Try to match quoted scoped package: "@scope/package@version":
          if (line.startsWith('"@')) {
            match = line.match(/^"(@[^/]+\/[^@]+)@(.+)":$/);
          }
          // Try to match unquoted scoped package: @scope/package@version:
          else if (line.startsWith('@')) {
            match = line.match(/^(@[^/]+\/[^@]+)@(.+):$/);
          }
          // Try to match quoted regular package: "package@version":
          else if (line.startsWith('"')) {
            match = line.match(/^"([^@"]+)@(.+)":$/);
          }
          // Try to match unquoted regular package: package@version:
          else {
            match = line.match(/^([^@]+)@(.+):$/);
          }
          
          if (match) {
            currentPackage = match[1];
          }
        }
        
        // Resolved URL line (indented, starts with "resolved")
        if (currentPackage && line.trim().startsWith('resolved ')) {
          const urlMatch = line.match(/resolved\s+"([^"]+)"/);
          if (urlMatch) {
            const resolved = urlMatch[1];
            if (this.isUrlBasedResolution(resolved)) {
              dependencies.push({
                name: currentPackage,
                resolvedUrl: resolved,
                parents: [], // Yarn lockfile doesn't easily provide parent info
                depth: 1 // Assume transitive (depth 1) since we can't easily determine
              });
            }
          }
          currentPackage = null; // Reset after processing
        }
      }
      
      logger.info(`Found ${dependencies.length} URL-based dependencies in yarn lockfile`);
      return dependencies;
    } catch (error) {
      logger.error('Failed to parse yarn lockfile', error);
      return [];
    }
  }

  /**
   * Parse pnpm lockfile (pnpm-lock.yaml)
   */
  private async parsePnpmLockfile(repoPath: string): Promise<TransitiveDependency[]> {
    const lockfilePath = path.join(repoPath, 'pnpm-lock.yaml');
    
    try {
      const content = await fs.readFile(lockfilePath, 'utf-8');
      const dependencies: TransitiveDependency[] = [];
      
      // Simple YAML parsing for pnpm lockfile
      // Format: /package/version:\n    resolution: {tarball: url}
      const lines = content.split('\n');
      let currentPackage: string | null = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Package declaration (starts with /)
        if (line.startsWith('  /') && line.endsWith(':')) {
          const packagePath = line.trim().slice(0, -1); // Remove trailing :
          currentPackage = this.extractPackageNameFromPath(packagePath);
        }
        
        // Resolution line with tarball
        if (currentPackage && line.includes('tarball:')) {
          const urlMatch = line.match(/tarball:\s*([^}]+)/);
          if (urlMatch) {
            const resolved = urlMatch[1].trim();
            if (this.isUrlBasedResolution(resolved)) {
              dependencies.push({
                name: currentPackage,
                resolvedUrl: resolved,
                parents: [],
                depth: 1
              });
            }
          }
          currentPackage = null;
        }
      }
      
      logger.info(`Found ${dependencies.length} URL-based dependencies in pnpm lockfile`);
      return dependencies;
    } catch (error) {
      logger.error('Failed to parse pnpm lockfile', error);
      return [];
    }
  }

  /**
   * Delete all lockfiles in the repository
   */
  async deleteLockfiles(repoPath: string): Promise<void> {
    const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    let deletedCount = 0;

    for (const lockfile of lockfiles) {
      const lockfilePath = path.join(repoPath, lockfile);
      try {
        await fs.unlink(lockfilePath);
        logger.info(`Deleted lockfile: ${lockfile}`);
        deletedCount++;
      } catch (error) {
        // File doesn't exist or can't be deleted, continue
      }
    }

    if (deletedCount === 0) {
      logger.info('No lockfiles found to delete');
    } else {
      logger.info(`Deleted ${deletedCount} lockfile(s)`);
    }
  }

  /**
   * Check if a resolved URL is URL-based (not from npm registry)
   */
  private isUrlBasedResolution(resolved: string): boolean {
    // npm registry URLs are not considered "URL-based" for our purposes
    if (resolved.includes('registry.npmjs.org') || resolved.includes('registry.yarnpkg.com')) {
      return false;
    }
    
    return resolved.startsWith('http://') ||
           resolved.startsWith('https://') ||
           resolved.startsWith('git://') ||
           resolved.startsWith('git+http://') ||
           resolved.startsWith('git+https://');
  }

  /**
   * Extract package name from lockfile path
   * Examples:
   *   "node_modules/querystring" -> "querystring"
   *   "node_modules/@babel/core" -> "@babel/core"
   *   "/querystring/0.2.0" -> "querystring"
   *   "node_modules/parent/node_modules/level2" -> "level2"
   */
  private extractPackageNameFromPath(packagePath: string): string | null {
    if (!packagePath) {
      return null;
    }
    
    // Remove leading slash
    let cleaned = packagePath.replace(/^\//, '');
    
    // For nested dependencies, find the last node_modules segment
    const lastNodeModulesIndex = cleaned.lastIndexOf('node_modules/');
    if (lastNodeModulesIndex !== -1) {
      cleaned = cleaned.substring(lastNodeModulesIndex + 'node_modules/'.length);
    }
    
    // Handle scoped packages (@org/package)
    if (cleaned.startsWith('@')) {
      const parts = cleaned.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    }
    
    // Regular packages - take first segment
    const parts = cleaned.split('/');
    return parts[0] || null;
  }

  /**
   * Calculate depth from package path
   * Examples:
   *   "node_modules/package" -> 1
   *   "node_modules/parent/node_modules/child" -> 2
   */
  private calculateDepth(packagePath: string): number {
    if (!packagePath || packagePath === '') {
      return 0; // Root
    }
    
    const nodeModulesCount = (packagePath.match(/node_modules/g) || []).length;
    return nodeModulesCount;
  }
}

/**
 * Create a new LockfileParser instance
 */
export function createLockfileParser(): LockfileParser {
  return new LockfileParser();
}
