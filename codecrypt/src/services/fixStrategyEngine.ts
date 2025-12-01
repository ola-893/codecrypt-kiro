/**
 * FixStrategyEngine - Applies fixes based on error analysis
 * 
 * This service selects and applies fix strategies for post-resurrection
 * validation errors. It supports multiple strategies per error type and
 * tracks attempted strategies to enable rotation on failure.
 * 
 * **Feature: post-resurrection-validation**
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  IFixStrategyEngine,
  AnalyzedError,
  FixHistory,
  FixStrategy,
  FixResult,
  PostResurrectionErrorCategory,
  DEFAULT_FIX_STRATEGIES,
  NATIVE_MODULE_ALTERNATIVES,
  PackageManager
} from '../types';

/**
 * Tracks which strategies have been attempted for each error
 */
interface AttemptedStrategies {
  /** Map of error key to list of attempted strategy types */
  [errorKey: string]: string[];
}

/**
 * FixStrategyEngine class that selects and applies fix strategies
 */
export class FixStrategyEngine implements IFixStrategyEngine {
  /** Tracks attempted strategies per error to enable rotation */
  private attemptedStrategies: AttemptedStrategies = {};

  /**
   * Select the best fix strategy for an error
   * 
   * @param error - The analyzed error to fix
   * @param history - Fix history for prioritizing known fixes
   * @returns The selected fix strategy
   */
  selectStrategy(error: AnalyzedError, history: FixHistory): FixStrategy {
    const errorKey = this.getErrorKey(error);
    const attempted = this.attemptedStrategies[errorKey] || [];

    // First, check if we have a successful fix in history
    const historicalFix = this.findHistoricalFix(error, history);
    if (historicalFix && !attempted.includes(this.getStrategyKey(historicalFix))) {
      return historicalFix;
    }

    // Get all available strategies for this error category
    const strategies = this.getStrategiesForError(error);

    // Find the first strategy that hasn't been attempted
    for (const strategy of strategies) {
      const strategyKey = this.getStrategyKey(strategy);
      if (!attempted.includes(strategyKey)) {
        return strategy;
      }
    }

    // If all strategies have been attempted, return the first one (will fail gracefully)
    return strategies[0] || { type: 'force_install' };
  }


  /**
   * Apply a fix strategy to the repository
   * 
   * @param repoPath - Path to the repository
   * @param strategy - The fix strategy to apply
   * @returns Promise resolving to the fix result
   */
  async applyFix(repoPath: string, strategy: FixStrategy): Promise<FixResult> {
    try {
      switch (strategy.type) {
        case 'adjust_version':
          return await this.applyVersionAdjustment(repoPath, strategy.package, strategy.newVersion);

        case 'legacy_peer_deps':
          return await this.applyLegacyPeerDeps(repoPath);

        case 'remove_lockfile':
          return await this.applyRemoveLockfile(repoPath, strategy.lockfile);

        case 'substitute_package':
          return await this.applySubstitutePackage(repoPath, strategy.original, strategy.replacement);

        case 'remove_package':
          return await this.applyRemovePackage(repoPath, strategy.package);

        case 'add_resolution':
          return await this.applyAddResolution(repoPath, strategy.package, strategy.version);

        case 'force_install':
          return await this.applyForceInstall(repoPath);

        default:
          return {
            success: false,
            strategy,
            error: `Unknown strategy type: ${(strategy as FixStrategy).type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        strategy,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get alternative strategies for an error
   * 
   * @param error - The analyzed error
   * @returns Array of alternative fix strategies
   */
  getAlternativeStrategies(error: AnalyzedError): FixStrategy[] {
    return this.getStrategiesForError(error);
  }

  /**
   * Mark a strategy as attempted for an error
   * 
   * @param error - The error that was addressed
   * @param strategy - The strategy that was attempted
   */
  markStrategyAttempted(error: AnalyzedError, strategy: FixStrategy): void {
    const errorKey = this.getErrorKey(error);
    if (!this.attemptedStrategies[errorKey]) {
      this.attemptedStrategies[errorKey] = [];
    }
    const strategyKey = this.getStrategyKey(strategy);
    if (!this.attemptedStrategies[errorKey].includes(strategyKey)) {
      this.attemptedStrategies[errorKey].push(strategyKey);
    }
  }

  /**
   * Reset attempted strategies (e.g., for a new validation run)
   */
  resetAttemptedStrategies(): void {
    this.attemptedStrategies = {};
  }

  /**
   * Check if there are untried strategies for an error
   * 
   * @param error - The analyzed error
   * @returns True if there are untried strategies
   */
  hasUntriedStrategies(error: AnalyzedError): boolean {
    const errorKey = this.getErrorKey(error);
    const attempted = this.attemptedStrategies[errorKey] || [];
    const strategies = this.getStrategiesForError(error);
    
    return strategies.some(s => !attempted.includes(this.getStrategyKey(s)));
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get a unique key for an error (for tracking attempts)
   */
  private getErrorKey(error: AnalyzedError): string {
    return `${error.category}:${error.packageName || 'none'}`;
  }

  /**
   * Get a unique key for a strategy (for tracking attempts)
   */
  private getStrategyKey(strategy: FixStrategy): string {
    switch (strategy.type) {
      case 'adjust_version':
        return `adjust_version:${strategy.package}:${strategy.newVersion}`;
      case 'remove_lockfile':
        return `remove_lockfile:${strategy.lockfile}`;
      case 'substitute_package':
        return `substitute_package:${strategy.original}:${strategy.replacement}`;
      case 'remove_package':
        return `remove_package:${strategy.package}`;
      case 'add_resolution':
        return `add_resolution:${strategy.package}:${strategy.version}`;
      default:
        return strategy.type;
    }
  }

  /**
   * Find a historical fix that matches the error
   */
  private findHistoricalFix(error: AnalyzedError, history: FixHistory): FixStrategy | null {
    if (!history || !history.fixes) {
      return null;
    }

    // Create error pattern to match
    const errorPattern = this.getErrorKey(error);

    // Find matching historical fix
    const match = history.fixes.find(fix => fix.errorPattern === errorPattern);
    return match ? match.strategy : null;
  }


  /**
   * Get all available strategies for an error, customized with error details
   */
  private getStrategiesForError(error: AnalyzedError): FixStrategy[] {
    const baseStrategies = DEFAULT_FIX_STRATEGIES[error.category] || [];
    
    // Customize strategies based on error details
    return baseStrategies.map(strategy => this.customizeStrategy(strategy, error));
  }

  /**
   * Customize a strategy template with error-specific details
   */
  private customizeStrategy(strategy: FixStrategy, error: AnalyzedError): FixStrategy {
    switch (strategy.type) {
      case 'adjust_version':
        return {
          type: 'adjust_version',
          package: error.packageName || strategy.package,
          newVersion: this.determineTargetVersion(error)
        };

      case 'remove_package':
        return {
          type: 'remove_package',
          package: error.packageName || strategy.package
        };

      case 'substitute_package':
        const replacement = error.packageName 
          ? NATIVE_MODULE_ALTERNATIVES[error.packageName] || ''
          : strategy.replacement;
        return {
          type: 'substitute_package',
          original: error.packageName || strategy.original,
          replacement
        };

      case 'add_resolution':
        return {
          type: 'add_resolution',
          package: error.packageName || strategy.package,
          version: error.versionConstraint || strategy.version || '*'
        };

      case 'remove_lockfile':
        // Determine the correct lockfile based on what exists
        return {
          type: 'remove_lockfile',
          lockfile: strategy.lockfile
        };

      default:
        return strategy;
    }
  }

  /**
   * Determine the target version for a version adjustment
   */
  private determineTargetVersion(error: AnalyzedError): string {
    // If we have a version constraint from the error, try to use it
    if (error.versionConstraint) {
      // If it's a specific version, use it
      if (/^\d+\.\d+\.\d+/.test(error.versionConstraint)) {
        return error.versionConstraint;
      }
    }
    // Default to 'latest' which will be resolved during installation
    return 'latest';
  }

  // ============================================================================
  // Fix Application Methods
  // ============================================================================

  /**
   * Apply version adjustment in package.json
   */
  private async applyVersionAdjustment(
    repoPath: string,
    packageName: string,
    newVersion: string
  ): Promise<FixResult> {
    const strategy: FixStrategy = { type: 'adjust_version', package: packageName, newVersion };
    
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        return { success: false, strategy, error: 'package.json not found' };
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      let modified = false;

      // Check dependencies
      if (packageJson.dependencies?.[packageName]) {
        packageJson.dependencies[packageName] = newVersion;
        modified = true;
      }

      // Check devDependencies
      if (packageJson.devDependencies?.[packageName]) {
        packageJson.devDependencies[packageName] = newVersion;
        modified = true;
      }

      // Check peerDependencies
      if (packageJson.peerDependencies?.[packageName]) {
        packageJson.peerDependencies[packageName] = newVersion;
        modified = true;
      }

      if (!modified) {
        return { success: false, strategy, error: `Package ${packageName} not found in package.json` };
      }

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      return { success: true, strategy };
    } catch (error) {
      return { success: false, strategy, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Apply --legacy-peer-deps by creating/updating .npmrc
   */
  private async applyLegacyPeerDeps(repoPath: string): Promise<FixResult> {
    const strategy: FixStrategy = { type: 'legacy_peer_deps' };
    
    try {
      const npmrcPath = path.join(repoPath, '.npmrc');
      let content = '';

      if (fs.existsSync(npmrcPath)) {
        content = fs.readFileSync(npmrcPath, 'utf-8');
        // Check if already set
        if (content.includes('legacy-peer-deps=true')) {
          return { success: true, strategy };
        }
      }

      // Add legacy-peer-deps setting
      content = content.trim();
      if (content && !content.endsWith('\n')) {
        content += '\n';
      }
      content += 'legacy-peer-deps=true\n';

      fs.writeFileSync(npmrcPath, content);
      return { success: true, strategy };
    } catch (error) {
      return { success: false, strategy, error: error instanceof Error ? error.message : String(error) };
    }
  }


  /**
   * Remove lockfile to allow fresh dependency resolution
   */
  private async applyRemoveLockfile(repoPath: string, lockfile: string): Promise<FixResult> {
    const strategy: FixStrategy = { type: 'remove_lockfile', lockfile };
    
    try {
      // Try to remove the specified lockfile
      const lockfilePath = path.join(repoPath, lockfile);
      
      if (fs.existsSync(lockfilePath)) {
        fs.unlinkSync(lockfilePath);
        return { success: true, strategy };
      }

      // If specified lockfile doesn't exist, try to find and remove any lockfile
      const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
      for (const lf of lockfiles) {
        const lfPath = path.join(repoPath, lf);
        if (fs.existsSync(lfPath)) {
          fs.unlinkSync(lfPath);
          return { success: true, strategy: { type: 'remove_lockfile', lockfile: lf } };
        }
      }

      // Also remove node_modules to ensure clean install
      const nodeModulesPath = path.join(repoPath, 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        fs.rmSync(nodeModulesPath, { recursive: true, force: true });
      }

      return { success: true, strategy };
    } catch (error) {
      return { success: false, strategy, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Substitute a package with an alternative
   */
  private async applySubstitutePackage(
    repoPath: string,
    original: string,
    replacement: string
  ): Promise<FixResult> {
    const strategy: FixStrategy = { type: 'substitute_package', original, replacement };
    
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        return { success: false, strategy, error: 'package.json not found' };
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      let modified = false;

      // Helper to substitute in a dependencies object
      const substituteIn = (deps: Record<string, string> | undefined): boolean => {
        if (!deps || !deps[original]) return false;
        
        const version = deps[original];
        delete deps[original];
        
        // Only add replacement if it's not empty (empty means remove only)
        if (replacement) {
          deps[replacement] = version;
        }
        return true;
      };

      // Try to substitute in all dependency types
      modified = substituteIn(packageJson.dependencies) || modified;
      modified = substituteIn(packageJson.devDependencies) || modified;
      modified = substituteIn(packageJson.optionalDependencies) || modified;

      if (!modified) {
        return { success: false, strategy, error: `Package ${original} not found in package.json` };
      }

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      return { success: true, strategy };
    } catch (error) {
      return { success: false, strategy, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Remove a package from dependencies
   */
  private async applyRemovePackage(repoPath: string, packageName: string): Promise<FixResult> {
    const strategy: FixStrategy = { type: 'remove_package', package: packageName };
    
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        return { success: false, strategy, error: 'package.json not found' };
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      let modified = false;

      // Remove from all dependency types
      if (packageJson.dependencies?.[packageName]) {
        delete packageJson.dependencies[packageName];
        modified = true;
      }
      if (packageJson.devDependencies?.[packageName]) {
        delete packageJson.devDependencies[packageName];
        modified = true;
      }
      if (packageJson.optionalDependencies?.[packageName]) {
        delete packageJson.optionalDependencies[packageName];
        modified = true;
      }
      if (packageJson.peerDependencies?.[packageName]) {
        delete packageJson.peerDependencies[packageName];
        modified = true;
      }

      if (!modified) {
        return { success: false, strategy, error: `Package ${packageName} not found in package.json` };
      }

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      return { success: true, strategy };
    } catch (error) {
      return { success: false, strategy, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Add a resolution/override for a package version
   */
  private async applyAddResolution(
    repoPath: string,
    packageName: string,
    version: string
  ): Promise<FixResult> {
    const strategy: FixStrategy = { type: 'add_resolution', package: packageName, version };
    
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        return { success: false, strategy, error: 'package.json not found' };
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Add to resolutions (yarn) and overrides (npm)
      if (!packageJson.resolutions) {
        packageJson.resolutions = {};
      }
      packageJson.resolutions[packageName] = version;

      if (!packageJson.overrides) {
        packageJson.overrides = {};
      }
      packageJson.overrides[packageName] = version;

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      return { success: true, strategy };
    } catch (error) {
      return { success: false, strategy, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Apply force install (creates .npmrc with force=true)
   */
  private async applyForceInstall(repoPath: string): Promise<FixResult> {
    const strategy: FixStrategy = { type: 'force_install' };
    
    try {
      const npmrcPath = path.join(repoPath, '.npmrc');
      let content = '';

      if (fs.existsSync(npmrcPath)) {
        content = fs.readFileSync(npmrcPath, 'utf-8');
        // Check if already set
        if (content.includes('force=true')) {
          return { success: true, strategy };
        }
      }

      // Add force setting
      content = content.trim();
      if (content && !content.endsWith('\n')) {
        content += '\n';
      }
      content += 'force=true\n';

      fs.writeFileSync(npmrcPath, content);
      return { success: true, strategy };
    } catch (error) {
      return { success: false, strategy, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

/**
 * Create a new FixStrategyEngine instance
 */
export function createFixStrategyEngine(): FixStrategyEngine {
  return new FixStrategyEngine();
}
