/**
 * Package Replacement Registry
 * 
 * Maintains mappings from deprecated packages to modern alternatives.
 * Supports serialization/deserialization from JSON configuration files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PackageReplacement,
  ArchitectureIncompatibleEntry,
  ReplacementRegistrySchema,
  IPackageReplacementRegistry
} from '../types';
import { Logger } from '../utils/logger';

const logger = new Logger('PackageReplacementRegistry');

/**
 * Dead URL pattern for automatic replacement
 */
export interface DeadUrlPattern {
  /** URL pattern (supports wildcards * and **) */
  pattern: string;
  /** Replacement package name (null to attempt npm lookup) */
  replacementPackage: string | null;
  /** Replacement version (null to use latest) */
  replacementVersion: string | null;
  /** Reason for replacement */
  reason: string;
}

/**
 * Default registry content with common package replacements
 */
const DEFAULT_REGISTRY: ReplacementRegistrySchema = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  replacements: [
    {
      oldName: 'node-sass',
      newName: 'sass',
      versionMapping: { '*': '^1.69.0' },
      requiresCodeChanges: false
    },
    {
      oldName: 'request',
      newName: 'node-fetch',
      versionMapping: { '*': '^3.3.0' },
      requiresCodeChanges: true,
      codeChangeDescription: 'Replace request() calls with fetch() API'
    }
  ],
  architectureIncompatible: [
    {
      packageName: 'node-sass',
      incompatibleArchitectures: ['arm64'],
      replacement: 'sass',
      reason: 'node-sass uses native bindings that don\'t support ARM64'
    },
    {
      packageName: 'phantomjs',
      incompatibleArchitectures: ['arm64'],
      replacement: 'puppeteer',
      reason: 'PhantomJS is deprecated and has no ARM64 binaries'
    }
  ],
  knownDeadUrls: [
    'github.com/substack/querystring'
  ]
};

/**
 * PackageReplacementRegistry implementation
 */
export class PackageReplacementRegistry implements IPackageReplacementRegistry {
  private registry: ReplacementRegistrySchema;
  private registryPath: string;

  constructor(registryPath?: string) {
    this.registryPath = registryPath || path.join(__dirname, '../../data/package-replacement-registry.json');
    // Start with an empty registry structure (not the default)
    this.registry = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      replacements: [],
      architectureIncompatible: [],
      knownDeadUrls: []
    };
  }

  /**
   * Load registry from JSON file
   * Falls back to default registry if file doesn't exist or is invalid
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.registryPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      // Validate schema
      if (this.validateSchema(parsed)) {
        this.registry = parsed;
      } else {
        logger.warn('Invalid registry schema, using default registry');
        this.registry = { ...DEFAULT_REGISTRY };
      }
    } catch (error) {
      // File doesn't exist or can't be read - use default
      logger.info('Registry file not found, using default registry');
      this.registry = { ...DEFAULT_REGISTRY };
    }
  }

  /**
   * Save registry to JSON file
   */
  async save(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.registryPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Update lastUpdated timestamp
      this.registry.lastUpdated = new Date().toISOString();
      
      // Write to file
      await fs.writeFile(
        this.registryPath,
        JSON.stringify(this.registry, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Failed to save registry: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Look up replacement for a package
   * Returns null if no replacement exists
   */
  lookup(packageName: string): PackageReplacement | null {
    const replacement = this.registry.replacements.find(
      r => r.oldName === packageName
    );
    return replacement || null;
  }

  /**
   * Add a new replacement to the registry
   */
  add(replacement: PackageReplacement): void {
    // Remove existing replacement for the same package if it exists
    this.registry.replacements = this.registry.replacements.filter(
      r => r.oldName !== replacement.oldName
    );
    
    // Add new replacement
    this.registry.replacements.push(replacement);
  }

  /**
   * Get all replacements
   */
  getAll(): PackageReplacement[] {
    return [...this.registry.replacements];
  }

  /**
   * Get architecture incompatible packages
   */
  getArchitectureIncompatible(): ArchitectureIncompatibleEntry[] {
    return [...this.registry.architectureIncompatible];
  }

  /**
   * Get known dead URLs
   */
  getKnownDeadUrls(): string[] {
    return [...this.registry.knownDeadUrls];
  }

  /**
   * Get all dead URL patterns from registry
   * Requirements: 3.1
   */
  getDeadUrlPatterns(): DeadUrlPattern[] {
    const patterns = (this.registry as any).deadUrlPatterns;
    return patterns ? [...patterns] : [];
  }

  /**
   * Check if a URL matches a known dead URL pattern
   * Requirements: 3.2, 3.4
   */
  matchesDeadUrlPattern(url: string): DeadUrlPattern | null {
    const patterns = this.getDeadUrlPatterns();
    
    for (const pattern of patterns) {
      if (this.urlMatchesPattern(url, pattern.pattern)) {
        logger.info(`URL matches dead URL pattern: ${pattern.pattern}`);
        return pattern;
      }
    }
    
    return null;
  }

  /**
   * Check if a URL matches a pattern (supports wildcards)
   */
  private urlMatchesPattern(url: string, pattern: string): boolean {
    // Convert glob-style pattern to regex
    // * matches any characters except /
    // ** matches any characters including /
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // Escape dots
      .replace(/\*\*/g, '___DOUBLESTAR___')  // Temporarily replace **
      .replace(/\*/g, '[^/]*')  // * matches anything except /
      .replace(/___DOUBLESTAR___/g, '.*');  // ** matches anything
    
    const regex = new RegExp(regexPattern);
    return regex.test(url);
  }

  /**
   * Validate registry schema
   */
  private validateSchema(data: any): data is ReplacementRegistrySchema {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check required fields
    if (!data.version || typeof data.version !== 'string') {
      return false;
    }

    if (!Array.isArray(data.replacements)) {
      return false;
    }

    if (!Array.isArray(data.architectureIncompatible)) {
      return false;
    }

    if (!Array.isArray(data.knownDeadUrls)) {
      return false;
    }

    // Validate each replacement entry
    for (const replacement of data.replacements) {
      if (!this.validateReplacement(replacement)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate a single replacement entry
   */
  private validateReplacement(replacement: any): replacement is PackageReplacement {
    if (!replacement || typeof replacement !== 'object') {
      return false;
    }

    // Check required fields
    if (!replacement.oldName || typeof replacement.oldName !== 'string') {
      return false;
    }

    if (!replacement.newName || typeof replacement.newName !== 'string') {
      return false;
    }

    if (!replacement.versionMapping || typeof replacement.versionMapping !== 'object') {
      return false;
    }

    if (typeof replacement.requiresCodeChanges !== 'boolean') {
      return false;
    }

    return true;
  }
}
