/**
 * Dependency Analysis Service
 * Handles detection, parsing, and analysis of project dependencies
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DependencyInfo, VulnerabilityInfo } from '../types';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';

const logger = getLogger();

/**
 * Package.json structure
 */
interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Detects and parses package.json in the repository
 * @param repoPath Path to the cloned repository
 * @returns Parsed package.json object
 * @throws CodeCryptError if package.json is not found or malformed
 */
export async function detectAndParsePackageJson(repoPath: string): Promise<PackageJson> {
  logger.info('Detecting package.json in repository');
  
  const packageJsonPath = path.join(repoPath, 'package.json');
  
  try {
    // Check if package.json exists
    await fs.access(packageJsonPath);
    logger.info(`Found package.json at: ${packageJsonPath}`);
  } catch (error) {
    throw new CodeCryptError(
      'No package.json found in repository root',
      'PACKAGE_JSON_NOT_FOUND'
    );
  }
  
  try {
    // Read and parse package.json
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(content);
    
    logger.info(`Parsed package.json successfully`);
    logger.info(`Project name: ${packageJson.name || 'Unknown'}`);
    logger.info(`Dependencies: ${Object.keys(packageJson.dependencies || {}).length}`);
    logger.info(`DevDependencies: ${Object.keys(packageJson.devDependencies || {}).length}`);
    
    return packageJson;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CodeCryptError(
        `package.json contains invalid JSON: ${error.message}`,
        'MALFORMED_PACKAGE_JSON'
      );
    }
    throw new CodeCryptError(
      `Failed to read package.json: ${error instanceof Error ? error.message : String(error)}`,
      'PACKAGE_JSON_READ_ERROR'
    );
  }
}

/**
 * Extracts all dependencies from package.json
 * @param packageJson Parsed package.json object
 * @returns Map of package names to versions
 */
export function extractDependencies(packageJson: PackageJson): Map<string, string> {
  const dependencies = new Map<string, string>();
  
  // Add regular dependencies
  if (packageJson.dependencies) {
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      dependencies.set(name, version);
    }
  }
  
  // Add dev dependencies
  if (packageJson.devDependencies) {
    for (const [name, version] of Object.entries(packageJson.devDependencies)) {
      dependencies.set(name, version);
    }
  }
  
  logger.info(`Extracted ${dependencies.size} total dependencies`);
  return dependencies;
}

/**
 * NPM registry package metadata
 */
interface NpmPackageMetadata {
  name: string;
  'dist-tags': {
    latest: string;
    [key: string]: string;
  };
  versions: Record<string, any>;
  time?: Record<string, string>;
}

/**
 * NPM audit response
 */
interface NpmAuditResponse {
  vulnerabilities?: Record<string, {
    name: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    via: Array<{
      title: string;
      url?: string;
    }>;
  }>;
}

/**
 * Queries npm registry for package information
 * @param packageName Name of the npm package
 * @returns Package metadata from npm registry
 */
async function queryNpmRegistry(packageName: string): Promise<NpmPackageMetadata> {
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  
  try {
    const response = await fetch(registryUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new CodeCryptError(
          `Package '${packageName}' not found in npm registry`,
          'PACKAGE_NOT_FOUND'
        );
      }
      throw new CodeCryptError(
        `Failed to fetch package '${packageName}' from npm registry: ${response.statusText}`,
        'NPM_REGISTRY_ERROR'
      );
    }
    
    const metadata: NpmPackageMetadata = await response.json();
    return metadata;
  } catch (error) {
    if (error instanceof CodeCryptError) {
      throw error;
    }
    throw new CodeCryptError(
      `Network error while querying npm registry for '${packageName}': ${error instanceof Error ? error.message : String(error)}`,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Normalizes a version string by removing semver prefixes
 * @param version Version string (e.g., "^4.17.1", "~2.0.0", "1.2.3")
 * @returns Normalized version string
 */
function normalizeVersion(version: string): string {
  // Remove common semver prefixes: ^, ~, >=, <=, >, <, =
  return version.replace(/^[\^~>=<]+/, '').trim();
}

/**
 * Compares two semantic versions
 * @param current Current version
 * @param latest Latest version
 * @returns true if current is outdated
 */
function isOutdated(current: string, latest: string): boolean {
  const currentNormalized = normalizeVersion(current);
  const latestNormalized = normalizeVersion(latest);
  
  // Simple comparison - if they're different, consider it outdated
  // A more sophisticated implementation would use semver library
  return currentNormalized !== latestNormalized;
}

/**
 * Analyzes a single dependency
 * @param name Package name
 * @param currentVersion Current version from package.json
 * @returns DependencyInfo object
 */
export async function analyzeDependency(
  name: string,
  currentVersion: string
): Promise<DependencyInfo> {
  logger.info(`Analyzing dependency: ${name}@${currentVersion}`);
  
  try {
    const metadata = await queryNpmRegistry(name);
    const latestVersion = metadata['dist-tags'].latest;
    
    const dependencyInfo: DependencyInfo = {
      name,
      currentVersion,
      latestVersion,
      vulnerabilities: [],
      updateStatus: 'pending'
    };
    
    // Check if outdated
    if (isOutdated(currentVersion, latestVersion)) {
      logger.info(`  ${name}: ${currentVersion} → ${latestVersion} (outdated)`);
    } else {
      logger.info(`  ${name}: ${currentVersion} (up to date)`);
    }
    
    return dependencyInfo;
  } catch (error) {
    logger.error(`Failed to analyze dependency ${name}`, error);
    
    // Return a dependency info with error status
    return {
      name,
      currentVersion,
      latestVersion: 'unknown',
      vulnerabilities: [],
      updateStatus: 'failed'
    };
  }
}

/**
 * Analyzes all dependencies from package.json
 * @param dependencies Map of package names to versions
 * @returns Array of DependencyInfo objects
 */
export async function analyzeAllDependencies(
  dependencies: Map<string, string>
): Promise<DependencyInfo[]> {
  logger.info(`Analyzing ${dependencies.size} dependencies...`);
  
  const results: DependencyInfo[] = [];
  
  // Analyze dependencies sequentially to avoid rate limiting
  for (const [name, version] of dependencies.entries()) {
    const info = await analyzeDependency(name, version);
    results.push(info);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const outdatedCount = results.filter(d => 
    d.latestVersion !== 'unknown' && isOutdated(d.currentVersion, d.latestVersion)
  ).length;
  
  logger.info(`Analysis complete: ${outdatedCount} outdated dependencies found`);
  
  return results;
}

/**
 * Builds a comprehensive dependency report
 * @param dependencies Array of analyzed dependencies
 * @returns DependencyReport object
 */
export function buildDependencyReport(dependencies: DependencyInfo[]): import('../types').DependencyReport {
  // Count outdated dependencies
  const outdatedDependencies = dependencies.filter(d => 
    d.latestVersion !== 'unknown' && isOutdated(d.currentVersion, d.latestVersion)
  ).length;
  
  // Count vulnerable dependencies and total vulnerabilities
  let totalVulnerabilities = 0;
  const vulnerableDependencies = dependencies.filter(d => {
    if (d.vulnerabilities.length > 0) {
      totalVulnerabilities += d.vulnerabilities.length;
      return true;
    }
    return false;
  }).length;
  
  // Sort dependencies: vulnerabilities first, then outdated, then by name
  const sortedDependencies = [...dependencies].sort((a, b) => {
    // Prioritize security vulnerabilities
    if (a.vulnerabilities.length > 0 && b.vulnerabilities.length === 0) {
      return -1;
    }
    if (a.vulnerabilities.length === 0 && b.vulnerabilities.length > 0) {
      return 1;
    }
    
    // Then prioritize outdated packages
    const aOutdated = a.latestVersion !== 'unknown' && isOutdated(a.currentVersion, a.latestVersion);
    const bOutdated = b.latestVersion !== 'unknown' && isOutdated(b.currentVersion, b.latestVersion);
    
    if (aOutdated && !bOutdated) {
      return -1;
    }
    if (!aOutdated && bOutdated) {
      return 1;
    }
    
    // Finally, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });
  
  const report: import('../types').DependencyReport = {
    totalDependencies: dependencies.length,
    outdatedDependencies,
    vulnerableDependencies,
    totalVulnerabilities,
    dependencies: sortedDependencies,
    generatedAt: new Date()
  };
  
  logger.info('Dependency report generated:');
  logger.info(`  Total dependencies: ${report.totalDependencies}`);
  logger.info(`  Outdated: ${report.outdatedDependencies}`);
  logger.info(`  Vulnerable: ${report.vulnerableDependencies}`);
  logger.info(`  Total vulnerabilities: ${report.totalVulnerabilities}`);
  
  return report;
}

/**
 * Performs complete dependency analysis on a repository
 * @param repoPath Path to the cloned repository
 * @returns DependencyReport object
 */
export async function analyzeDependencies(repoPath: string): Promise<import('../types').DependencyReport> {
  logger.info('Starting dependency analysis...');
  
  // Detect and parse package.json
  const packageJson = await detectAndParsePackageJson(repoPath);
  
  // Extract dependencies
  const dependencies = extractDependencies(packageJson);
  
  if (dependencies.size === 0) {
    logger.info('No dependencies found in package.json');
    return buildDependencyReport([]);
  }
  
  // Analyze all dependencies
  const analyzedDependencies = await analyzeAllDependencies(dependencies);
  
  // Build and return report
  return buildDependencyReport(analyzedDependencies);
}
