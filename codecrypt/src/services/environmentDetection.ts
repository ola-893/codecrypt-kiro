/**
 * Historical environment detection service
 * Determines the original Node.js version used by a repository
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getLogger } from '../utils/logger';
import { BuildConfiguration } from '../types';

const logger = getLogger();

/**
 * Environment detection result
 */
export interface EnvironmentInfo {
  /** Detected Node.js version */
  nodeVersion: string;
  /** Confidence level of detection (0-1) */
  confidence: number;
  /** Source of detection */
  source: 'package.json' | 'nvmrc' | 'git-history' | 'default';
  /** Additional details */
  details?: string;
}

/**
 * Parse Node.js version from package.json engines field
 */
async function parsePackageJsonEngines(repoPath: string): Promise<EnvironmentInfo | null> {
  try {
    const packageJsonPath = path.join(repoPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    if (packageJson.engines && packageJson.engines.node) {
      const nodeVersion = packageJson.engines.node;
      logger.info(`Found Node.js version in package.json engines: ${nodeVersion}`);

      // Parse version string (e.g., ">=12.0.0", "^14.15.0", "12.x")
      const versionMatch = nodeVersion.match(/(\d+)\.?(\d+)?\.?(\d+)?/);
      if (versionMatch) {
        const major = versionMatch[1];
        const minor = versionMatch[2] || '0';
        const patch = versionMatch[3] || '0';
        const normalizedVersion = `${major}.${minor}.${patch}`;

        return {
          nodeVersion: normalizedVersion,
          confidence: 0.9,
          source: 'package.json',
          details: `Parsed from engines.node: ${nodeVersion}`,
        };
      }
    }

    return null;
  } catch (error) {
    logger.debug('Could not parse package.json engines field', error);
    return null;
  }
}

/**
 * Parse Node.js version from .nvmrc file
 */
async function parseNvmrc(repoPath: string): Promise<EnvironmentInfo | null> {
  try {
    const nvmrcPath = path.join(repoPath, '.nvmrc');
    const content = await fs.readFile(nvmrcPath, 'utf-8');
    const nodeVersion = content.trim();

    logger.info(`Found Node.js version in .nvmrc: ${nodeVersion}`);

    // Parse version string (e.g., "v14.15.0", "14", "lts/fermium")
    if (nodeVersion.startsWith('lts/')) {
      // Map LTS codenames to versions
      const ltsMap: Record<string, string> = {
        'fermium': '14.21.3',
        'gallium': '16.20.2',
        'hydrogen': '18.19.0',
        'iron': '20.11.0',
      };
      const codename = nodeVersion.split('/')[1].toLowerCase();
      const mappedVersion = ltsMap[codename];

      if (mappedVersion) {
        return {
          nodeVersion: mappedVersion,
          confidence: 0.8,
          source: 'nvmrc',
          details: `Mapped from LTS codename: ${nodeVersion}`,
        };
      }
    }

    const versionMatch = nodeVersion.match(/v?(\d+)\.?(\d+)?\.?(\d+)?/);
    if (versionMatch) {
      const major = versionMatch[1];
      const minor = versionMatch[2] || '0';
      const patch = versionMatch[3] || '0';
      const normalizedVersion = `${major}.${minor}.${patch}`;

      return {
        nodeVersion: normalizedVersion,
        confidence: 0.85,
        source: 'nvmrc',
        details: `Parsed from .nvmrc: ${nodeVersion}`,
      };
    }

    return null;
  } catch (error) {
    logger.debug('Could not parse .nvmrc file', error);
    return null;
  }
}

/**
 * Analyze git history for Node.js version clues
 * Looks for CI configuration files and their historical versions
 */
async function analyzeGitHistory(repoPath: string): Promise<EnvironmentInfo | null> {
  try {
    // Check for common CI configuration files
    const ciFiles = [
      '.github/workflows/ci.yml',
      '.github/workflows/test.yml',
      '.github/workflows/main.yml',
      '.travis.yml',
      '.circleci/config.yml',
      'azure-pipelines.yml',
    ];

    for (const ciFile of ciFiles) {
      const ciPath = path.join(repoPath, ciFile);
      try {
        const content = await fs.readFile(ciPath, 'utf-8');

        // Look for Node.js version specifications in CI files
        const patterns = [
          /node[-_]?version:\s*['"]?(\d+)\.?(\d+)?\.?(\d+)?['"]?/i,
          /node:\s*['"]?(\d+)\.?(\d+)?\.?(\d+)?['"]?/i,
          /setup-node@.*\n.*node-version:\s*['"]?(\d+)\.?(\d+)?\.?(\d+)?['"]?/i,
        ];

        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) {
            const major = match[1];
            const minor = match[2] || '0';
            const patch = match[3] || '0';
            const normalizedVersion = `${major}.${minor}.${patch}`;

            logger.info(`Found Node.js version in ${ciFile}: ${normalizedVersion}`);

            return {
              nodeVersion: normalizedVersion,
              confidence: 0.7,
              source: 'git-history',
              details: `Found in CI configuration: ${ciFile}`,
            };
          }
        }
      } catch (error) {
        // File doesn't exist, continue to next
        continue;
      }
    }

    return null;
  } catch (error) {
    logger.debug('Could not analyze git history for Node.js version', error);
    return null;
  }
}

/**
 * Get default Node.js version based on repository age
 * Uses heuristics to guess a reasonable version
 */
function getDefaultVersion(lastCommitDate?: Date): EnvironmentInfo {
  const now = new Date();
  const yearsAgo = lastCommitDate
    ? (now.getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
    : 3;

  // Map years ago to Node.js versions (rough heuristic)
  let nodeVersion: string;
  if (yearsAgo < 1) {
    nodeVersion = '20.11.0'; // Recent
  } else if (yearsAgo < 2) {
    nodeVersion = '18.19.0'; // 1-2 years
  } else if (yearsAgo < 3) {
    nodeVersion = '16.20.2'; // 2-3 years
  } else if (yearsAgo < 4) {
    nodeVersion = '14.21.3'; // 3-4 years
  } else if (yearsAgo < 5) {
    nodeVersion = '12.22.12'; // 4-5 years
  } else {
    nodeVersion = '10.24.1'; // 5+ years
  }

  logger.warn(`Using default Node.js version: ${nodeVersion} (repository is ~${yearsAgo.toFixed(1)} years old)`);

  return {
    nodeVersion,
    confidence: 0.3,
    source: 'default',
    details: `Estimated based on repository age (~${yearsAgo.toFixed(1)} years)`,
  };
}

/**
 * Detect the original Node.js version used by a repository
 * Tries multiple detection methods in order of reliability
 */
export async function detectNodeVersion(
  repoPath: string,
  lastCommitDate?: Date
): Promise<EnvironmentInfo> {
  logger.info('Detecting historical Node.js version...');

  // Try detection methods in order of reliability
  const detectionMethods = [
    () => parsePackageJsonEngines(repoPath),
    () => parseNvmrc(repoPath),
    () => analyzeGitHistory(repoPath),
  ];

  for (const method of detectionMethods) {
    const result = await method();
    if (result) {
      logger.info(`Detected Node.js version: ${result.nodeVersion} (confidence: ${result.confidence}, source: ${result.source})`);
      return result;
    }
  }

  // Fall back to default version
  return getDefaultVersion(lastCommitDate);
}

/**
 * Validate that a Node.js version string is valid
 */
export function validateNodeVersion(version: string): boolean {
  const versionPattern = /^\d+\.\d+\.\d+$/;
  return versionPattern.test(version);
}

/**
 * Get Docker image name for a Node.js version
 */
export function getNodeDockerImage(nodeVersion: string): string {
  // Use alpine images for smaller size
  return `node:${nodeVersion}-alpine`;
}

/**
 * Get major version from full version string
 */
export function getMajorVersion(version: string): number {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Detect build configuration for a repository
 * Checks for build scripts in package.json and task runner files
 */
export async function detectBuildConfiguration(repoPath: string): Promise<BuildConfiguration> {
  logger.info('Detecting build configuration...');

  let hasBuildScript = false;
  let buildCommand: string | null = null;
  let buildTool: string | null = null;
  let requiresCompilation = false;

  try {
    // Check package.json for build scripts
    const packageJsonPath = path.join(repoPath, 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      if (packageJson.scripts) {
        const scripts = packageJson.scripts;

        // Check for common build script names
        const buildScriptNames = ['build', 'compile', 'prepare', 'prepublish', 'prepublishOnly'];
        
        for (const scriptName of buildScriptNames) {
          if (scripts[scriptName]) {
            hasBuildScript = true;
            buildCommand = `npm run ${scriptName}`;
            
            // Detect build tool from script content
            const scriptContent = scripts[scriptName];
            if (scriptContent.includes('webpack')) {
              buildTool = 'webpack';
            } else if (scriptContent.includes('vite')) {
              buildTool = 'vite';
            } else if (scriptContent.includes('tsc')) {
              buildTool = 'tsc';
            } else if (scriptContent.includes('rollup')) {
              buildTool = 'rollup';
            } else if (scriptContent.includes('esbuild')) {
              buildTool = 'esbuild';
            } else if (scriptContent.includes('parcel')) {
              buildTool = 'parcel';
            }

            logger.info(`Found build script: ${scriptName} -> ${scriptContent}`);
            break;
          }
        }
      }

      // Check if TypeScript is present (requires compilation)
      // This check is outside the scripts block so it works even without scripts
      if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
        requiresCompilation = true;
        if (!buildTool) {
          buildTool = 'tsc';
        }
        // If TypeScript is present but no build script, infer one
        if (!hasBuildScript) {
          hasBuildScript = true;
          buildCommand = 'npx tsc';
        }
      }
    } catch (error) {
      logger.debug('Could not parse package.json for build scripts', error);
    }

    // Check for task runner configuration files
    const taskRunnerFiles = [
      { file: 'webpack.config.js', tool: 'webpack' },
      { file: 'webpack.config.ts', tool: 'webpack' },
      { file: 'vite.config.js', tool: 'vite' },
      { file: 'vite.config.ts', tool: 'vite' },
      { file: 'rollup.config.js', tool: 'rollup' },
      { file: 'gulpfile.js', tool: 'gulp' },
      { file: 'Gruntfile.js', tool: 'grunt' },
      { file: 'tsconfig.json', tool: 'tsc' },
    ];

    for (const { file, tool } of taskRunnerFiles) {
      try {
        await fs.access(path.join(repoPath, file));
        logger.info(`Found task runner file: ${file}`);
        
        if (!buildTool) {
          buildTool = tool;
        }
        
        // If we found a config file but no build script, mark as requiring compilation
        if (tool === 'tsc' || tool === 'webpack' || tool === 'vite' || tool === 'rollup') {
          requiresCompilation = true;
        }
        
        // If we have a build tool but no build command, try to infer it
        if (!hasBuildScript && (tool === 'webpack' || tool === 'vite' || tool === 'rollup')) {
          hasBuildScript = true;
          buildCommand = `npx ${tool} build`;
        } else if (!hasBuildScript && tool === 'tsc') {
          hasBuildScript = true;
          buildCommand = 'npx tsc';
        } else if (!hasBuildScript && (tool === 'gulp' || tool === 'grunt')) {
          hasBuildScript = true;
          buildCommand = `npx ${tool}`;
        }
      } catch (error) {
        // File doesn't exist, continue
      }
    }

  } catch (error) {
    logger.error('Error detecting build configuration', error);
  }

  const config: BuildConfiguration = {
    hasBuildScript,
    buildCommand,
    buildTool,
    requiresCompilation,
  };

  logger.info(`Build configuration detected:`, config);

  return config;
}
