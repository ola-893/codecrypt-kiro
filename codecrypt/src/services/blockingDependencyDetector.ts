/**
 * Blocking Dependency Detector
 * 
 * Identifies packages that will prevent npm install from completing.
 * Checks against known blocking packages and architecture incompatibilities.
 */

import * as os from 'os';
import {
  BlockingDependency,
  BlockingReason,
  IBlockingDependencyDetector,
  IPackageReplacementRegistry
} from '../types';

/**
 * Known blocking packages with their reasons
 */
const KNOWN_BLOCKING_PACKAGES: Record<string, BlockingReason> = {
  'node-sass': 'architecture_incompatible',
  'phantomjs': 'architecture_incompatible',
  'phantomjs-prebuilt': 'architecture_incompatible',
  'fibers': 'architecture_incompatible',
  'deasync': 'build_failure',
  'node-canvas': 'build_failure',
  'canvas': 'build_failure'
};

/**
 * BlockingDependencyDetector implementation
 */
export class BlockingDependencyDetector implements IBlockingDependencyDetector {
  private registry: IPackageReplacementRegistry | null = null;

  constructor(registry?: IPackageReplacementRegistry) {
    this.registry = registry || null;
  }

  /**
   * Detect all blocking dependencies in a dependency map
   */
  async detect(dependencies: Map<string, string>): Promise<BlockingDependency[]> {
    const blockingDeps: BlockingDependency[] = [];
    const currentArch = os.arch();

    for (const [name, version] of dependencies.entries()) {
      // Check if package is in known blocking list
      const blockingReason = this.getBlockingReason(name);
      
      if (blockingReason) {
        // Check if we have a replacement
        const replacement = this.registry?.lookup(name) || undefined;
        
        blockingDeps.push({
          name,
          version,
          reason: blockingReason,
          replacement
        });
        continue;
      }

      // Check architecture incompatibility from registry
      if (this.registry) {
        const archIncompatible = await this.checkArchitectureIncompatibility(name, currentArch);
        if (archIncompatible) {
          const replacement = this.registry.lookup(name) || undefined;
          
          blockingDeps.push({
            name,
            version,
            reason: 'architecture_incompatible',
            replacement
          });
          continue;
        }
      }

      // Check for dead URLs
      if (this.isGitHubArchiveUrl(version)) {
        const isAccessible = await this.checkUrlAccessibility(version);
        if (!isAccessible) {
          blockingDeps.push({
            name,
            version,
            reason: 'dead_url',
            replacement: undefined
          });
        }
      }
    }

    return blockingDeps;
  }

  /**
   * Check if a package is known to be blocking
   */
  isKnownBlocking(packageName: string): boolean {
    return packageName in KNOWN_BLOCKING_PACKAGES;
  }

  /**
   * Get the blocking reason for a package
   */
  getBlockingReason(packageName: string): BlockingReason | null {
    return KNOWN_BLOCKING_PACKAGES[packageName] || null;
  }

  /**
   * Check if a package is architecture incompatible
   */
  private async checkArchitectureIncompatibility(
    packageName: string,
    currentArch: string
  ): Promise<boolean> {
    if (!this.registry) {
      return false;
    }

    // Get architecture incompatible list from registry
    const archIncompatibleList = (this.registry as any).getArchitectureIncompatible?.() || [];
    
    for (const entry of archIncompatibleList) {
      if (entry.packageName === packageName) {
        return entry.incompatibleArchitectures.includes(currentArch);
      }
    }

    return false;
  }

  /**
   * Check if a version string is a GitHub archive URL
   */
  private isGitHubArchiveUrl(version: string): boolean {
    return version.includes('github.com') && 
           (version.includes('/archive/') || version.includes('/tarball/'));
  }

  /**
   * Check if a URL is accessible
   */
  private async checkUrlAccessibility(url: string): Promise<boolean> {
    try {
      // Extract full URL if it's in the format "https://..."
      let fullUrl = url;
      if (!url.startsWith('http')) {
        fullUrl = `https://${url}`;
      }

      // Create an AbortController with a 5 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(fullUrl, { 
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.ok;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        return false;
      }
    } catch (error) {
      return false;
    }
  }
}
