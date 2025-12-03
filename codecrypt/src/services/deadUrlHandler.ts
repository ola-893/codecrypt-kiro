/**
 * Dead URL Handler
 * 
 * Handles detection and resolution of dependencies with dead URLs.
 * Marks dependencies with dead URLs, attempts npm registry resolution,
 * and removes unresolvable dependencies with warnings.
 * 
 * Requirements: 1.4, 1.5, 5.2, 5.5
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { URLValidator } from './urlValidator';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Result of dead URL handling for a single dependency
 */
export interface DeadUrlHandlingResult {
  /** Package name */
  packageName: string;
  /** Original URL that was dead */
  deadUrl: string;
  /** Whether the URL was confirmed dead */
  isUrlDead: boolean;
  /** Alternative npm version if found */
  npmAlternative?: string;
  /** Whether the dependency was resolved */
  resolved: boolean;
  /** Action taken (kept, replaced, removed) */
  action: 'kept' | 'replaced' | 'removed';
  /** Warning message if applicable */
  warning?: string;
}

/**
 * Summary of dead URL handling for all dependencies
 */
export interface DeadUrlHandlingSummary {
  /** Total number of URL-based dependencies checked */
  totalChecked: number;
  /** Number of dead URLs found */
  deadUrlsFound: number;
  /** Number of dependencies resolved via npm */
  resolvedViaNpm: number;
  /** Number of dependencies removed */
  removed: number;
  /** Detailed results for each dependency */
  results: DeadUrlHandlingResult[];
}

/**
 * DeadUrlHandler class
 */
export class DeadUrlHandler {
  private urlValidator: URLValidator;

  constructor(urlValidator?: URLValidator) {
    this.urlValidator = urlValidator || new URLValidator();
  }

  /**
   * Check if a version string is a URL-based dependency
   */
  private isUrlBasedDependency(version: string): boolean {
    return version.includes('://') || 
           version.startsWith('github:') ||
           version.includes('github.com');
  }

  /**
   * Handle dead URLs in dependencies
   * Validates URLs, attempts npm resolution, and updates package.json
   */
  async handleDeadUrls(
    repoPath: string,
    dependencies: Map<string, string>
  ): Promise<DeadUrlHandlingSummary> {
    logger.info('Starting dead URL detection and handling');
    
    const results: DeadUrlHandlingResult[] = [];
    let totalChecked = 0;
    let deadUrlsFound = 0;
    let resolvedViaNpm = 0;
    let removed = 0;

    // Filter to only URL-based dependencies
    const urlBasedDeps = new Map<string, string>();
    for (const [name, version] of dependencies.entries()) {
      if (this.isUrlBasedDependency(version)) {
        urlBasedDeps.set(name, version);
      }
    }

    logger.info(`Found ${urlBasedDeps.size} URL-based dependencies to check`);

    // Check each URL-based dependency
    for (const [packageName, version] of urlBasedDeps.entries()) {
      totalChecked++;
      
      logger.info(`Checking URL for ${packageName}: ${version}`);
      
      // Validate the URL
      const validationResult = await this.urlValidator.validate(version);
      
      if (validationResult.isValid) {
        // URL is accessible, keep it
        results.push({
          packageName,
          deadUrl: version,
          isUrlDead: false,
          resolved: true,
          action: 'kept'
        });
        logger.info(`  ✓ URL is accessible for ${packageName}`);
        continue;
      }

      // URL is dead
      deadUrlsFound++;
      logger.warn(`  ✗ Dead URL detected for ${packageName}: ${version}`);

      // Try to extract package name and find npm alternative
      const extractedName = this.urlValidator.extractPackageFromUrl(version);
      const searchName = extractedName || packageName;
      
      logger.info(`  Attempting npm registry lookup for: ${searchName}`);
      const npmVersion = await this.urlValidator.findNpmAlternative(searchName);

      if (npmVersion) {
        // Found npm alternative
        resolvedViaNpm++;
        results.push({
          packageName,
          deadUrl: version,
          isUrlDead: true,
          npmAlternative: npmVersion,
          resolved: true,
          action: 'replaced',
          warning: `Replaced dead URL with npm registry version ${npmVersion}`
        });
        logger.info(`  ✓ Found npm alternative: ${npmVersion}`);
      } else {
        // No npm alternative found, mark for removal
        removed++;
        results.push({
          packageName,
          deadUrl: version,
          isUrlDead: true,
          resolved: false,
          action: 'removed',
          warning: `Dead URL could not be resolved. Package will be removed.`
        });
        logger.warn(`  ✗ No npm alternative found for ${packageName}`);
      }
    }

    const summary: DeadUrlHandlingSummary = {
      totalChecked,
      deadUrlsFound,
      resolvedViaNpm,
      removed,
      results
    };

    logger.info('Dead URL handling complete:');
    logger.info(`  Total checked: ${totalChecked}`);
    logger.info(`  Dead URLs found: ${deadUrlsFound}`);
    logger.info(`  Resolved via npm: ${resolvedViaNpm}`);
    logger.info(`  Removed: ${removed}`);

    return summary;
  }

  /**
   * Apply dead URL handling results to package.json
   * Updates the package.json file with resolved versions or removes unresolvable packages
   */
  async applyToPackageJson(
    repoPath: string,
    results: DeadUrlHandlingResult[]
  ): Promise<void> {
    const packageJsonPath = path.join(repoPath, 'package.json');
    
    try {
      // Read package.json
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      let modified = false;

      // Apply changes for each result
      for (const result of results) {
        if (result.action === 'kept') {
          // No changes needed
          continue;
        }

        // Check both dependencies and devDependencies
        for (const depType of ['dependencies', 'devDependencies'] as const) {
          if (packageJson[depType] && packageJson[depType][result.packageName]) {
            if (result.action === 'replaced' && result.npmAlternative) {
              // Replace with npm version
              packageJson[depType][result.packageName] = `^${result.npmAlternative}`;
              logger.info(`Updated ${result.packageName} in ${depType} to ^${result.npmAlternative}`);
              modified = true;
            } else if (result.action === 'removed') {
              // Remove the dependency
              delete packageJson[depType][result.packageName];
              logger.warn(`Removed ${result.packageName} from ${depType} (unresolvable dead URL)`);
              modified = true;
            }
          }
        }
      }

      if (modified) {
        // Write updated package.json
        await fs.writeFile(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2) + '\n',
          'utf-8'
        );
        logger.info('Updated package.json with dead URL resolutions');
      } else {
        logger.info('No changes needed to package.json');
      }
    } catch (error) {
      logger.error('Failed to apply dead URL handling to package.json', error);
      throw error;
    }
  }

  /**
   * Generate a report of dead URL handling
   */
  generateReport(summary: DeadUrlHandlingSummary): string {
    const lines: string[] = [];
    
    lines.push('=== Dead URL Handling Report ===');
    lines.push('');
    lines.push(`Total URL-based dependencies checked: ${summary.totalChecked}`);
    lines.push(`Dead URLs found: ${summary.deadUrlsFound}`);
    lines.push(`Resolved via npm registry: ${summary.resolvedViaNpm}`);
    lines.push(`Removed (unresolvable): ${summary.removed}`);
    lines.push('');

    if (summary.results.length > 0) {
      lines.push('Details:');
      lines.push('');

      for (const result of summary.results) {
        if (result.action === 'kept') {
          lines.push(`✓ ${result.packageName}: URL is accessible`);
        } else if (result.action === 'replaced') {
          lines.push(`→ ${result.packageName}: Replaced dead URL with npm version ${result.npmAlternative}`);
          lines.push(`  Original: ${result.deadUrl}`);
        } else if (result.action === 'removed') {
          lines.push(`✗ ${result.packageName}: Removed (dead URL, no npm alternative)`);
          lines.push(`  Dead URL: ${result.deadUrl}`);
        }
        
        if (result.warning) {
          lines.push(`  Warning: ${result.warning}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
