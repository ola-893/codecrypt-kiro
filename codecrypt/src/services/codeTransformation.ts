/**
 * Code Transformation Service
 * Applies simple find-and-replace transformations to fix breaking changes
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';

const logger = getLogger();

/**
 * Transformation rule for fixing breaking changes
 */
export interface TransformationRule {
  /** Package that this rule applies to */
  package: string;
  /** Version range this rule applies from (e.g., "1.x") */
  fromVersion: string;
  /** Version range this rule applies to (e.g., "2.x") */
  toVersion: string;
  /** Type of transformation */
  transformation: {
    /** Type of transformation (currently only supports rename_function) */
    type: 'rename_function' | 'replace_text';
    /** Old name/text to find */
    oldName: string;
    /** New name/text to replace with */
    newName: string;
  };
  /** Optional file pattern to limit transformation scope */
  filePattern?: string;
}

/**
 * Result of applying transformations
 */
export interface TransformationResult {
  /** Whether transformations were applied */
  applied: boolean;
  /** Number of files modified */
  filesModified: number;
  /** Number of replacements made */
  replacementsMade: number;
  /** List of files that were modified */
  modifiedFiles: string[];
}

/**
 * Load transformation rules from JSON file
 * 
 * @param rulesPath Path to the transformation rules JSON file
 * @returns Array of transformation rules
 */
export async function loadTransformationRules(rulesPath: string): Promise<TransformationRule[]> {
  try {
    const rulesContent = await fs.readFile(rulesPath, 'utf-8');
    const rules = JSON.parse(rulesContent);
    
    if (!Array.isArray(rules)) {
      throw new CodeCryptError('Transformation rules must be an array', 'INVALID_RULES');
    }
    
    logger.info(`Loaded ${rules.length} transformation rules from ${rulesPath}`);
    return rules;
    
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.info('No transformation rules file found, returning empty array');
      return [];
    }
    
    logger.error('Failed to load transformation rules', error);
    throw new CodeCryptError(
      `Failed to load transformation rules: ${error.message}`,
      'RULES_LOAD_FAILED'
    );
  }
}

/**
 * Find applicable transformation rules for a package update
 * 
 * @param rules All available transformation rules
 * @param packageName Name of the package being updated
 * @param fromVersion Version being updated from
 * @param toVersion Version being updated to
 * @returns Array of applicable rules
 */
export function findApplicableRules(
  rules: TransformationRule[],
  packageName: string,
  fromVersion: string,
  toVersion: string
): TransformationRule[] {
  const applicable = rules.filter(rule => {
    // Check if package matches
    if (rule.package !== packageName) {
      return false;
    }
    
    // Simple version matching (e.g., "1.x" matches "1.0.0", "1.5.2", etc.)
    const fromMajor = fromVersion.split('.')[0];
    const toMajor = toVersion.split('.')[0];
    const ruleFromMajor = rule.fromVersion.replace('.x', '');
    const ruleToMajor = rule.toVersion.replace('.x', '');
    
    return fromMajor === ruleFromMajor && toMajor === ruleToMajor;
  });
  
  logger.info(`Found ${applicable.length} applicable rules for ${packageName} ${fromVersion} → ${toVersion}`);
  return applicable;
}

/**
 * Apply a transformation rule to a file
 * 
 * @param filePath Path to the file
 * @param rule Transformation rule to apply
 * @returns Number of replacements made
 */
async function applyRuleToFile(filePath: string, rule: TransformationRule): Promise<number> {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;
    
    // Apply transformation based on type
    if (rule.transformation.type === 'rename_function' || rule.transformation.type === 'replace_text') {
      // Simple global find and replace
      const regex = new RegExp(escapeRegExp(rule.transformation.oldName), 'g');
      content = content.replace(regex, rule.transformation.newName);
    }
    
    // Count replacements
    const replacements = (originalContent.match(new RegExp(escapeRegExp(rule.transformation.oldName), 'g')) || []).length;
    
    if (replacements > 0) {
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Applied ${replacements} replacements in ${filePath}`);
    }
    
    return replacements;
    
  } catch (error: any) {
    logger.error(`Failed to apply transformation to ${filePath}`, error);
    return 0;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a file matches a pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Simple glob-like pattern matching
  const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
  return regex.test(filePath);
}

/**
 * Recursively find all files in a directory
 */
async function findAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      // Skip node_modules and other common directories
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'out') {
        continue;
      }
      
      if (entry.isDirectory()) {
        const subFiles = await findAllFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  } catch (error: any) {
    logger.error(`Failed to read directory ${dir}`, error);
  }
  
  return files;
}

/**
 * Apply transformation rules to a repository
 * 
 * @param repoPath Path to the repository
 * @param rules Transformation rules to apply
 * @returns TransformationResult with details of changes made
 */
export async function applyTransformations(
  repoPath: string,
  rules: TransformationRule[]
): Promise<TransformationResult> {
  logger.info(`Applying ${rules.length} transformation rules to ${repoPath}`);
  
  const result: TransformationResult = {
    applied: false,
    filesModified: 0,
    replacementsMade: 0,
    modifiedFiles: []
  };
  
  if (rules.length === 0) {
    logger.info('No transformation rules to apply');
    return result;
  }
  
  try {
    // Find all files in the repository
    const allFiles = await findAllFiles(repoPath);
    logger.info(`Found ${allFiles.length} files to scan`);
    
    // Apply each rule
    for (const rule of rules) {
      logger.info(`Applying rule: ${rule.transformation.oldName} → ${rule.transformation.newName}`);
      
      // Filter files by pattern if specified
      const targetFiles = rule.filePattern
        ? allFiles.filter(f => matchesPattern(f, rule.filePattern!))
        : allFiles;
      
      logger.info(`Scanning ${targetFiles.length} files for this rule`);
      
      // Apply rule to each file
      for (const relativeFilePath of targetFiles) {
        const fullPath = path.join(repoPath, relativeFilePath);
        const replacements = await applyRuleToFile(fullPath, rule);
        
        if (replacements > 0) {
          result.filesModified++;
          result.replacementsMade += replacements;
          result.modifiedFiles.push(relativeFilePath);
        }
      }
    }
    
    result.applied = result.replacementsMade > 0;
    
    logger.info(`Transformation complete: ${result.filesModified} files modified, ${result.replacementsMade} replacements made`);
    
  } catch (error: any) {
    logger.error('Failed to apply transformations', error);
    throw new CodeCryptError(
      `Failed to apply transformations: ${error.message}`,
      'TRANSFORMATION_FAILED'
    );
  }
  
  return result;
}

/**
 * Create a default transformation rules file
 * 
 * @param rulesPath Path where the rules file should be created
 */
export async function createDefaultRulesFile(rulesPath: string): Promise<void> {
  const defaultRules: TransformationRule[] = [
    {
      package: 'example-lib',
      fromVersion: '1.x',
      toVersion: '2.x',
      transformation: {
        type: 'rename_function',
        oldName: 'oldFunction',
        newName: 'newFunction'
      },
      filePattern: '*.ts'
    }
  ];
  
  await fs.writeFile(rulesPath, JSON.stringify(defaultRules, null, 2), 'utf-8');
  logger.info(`Created default transformation rules file at ${rulesPath}`);
}
