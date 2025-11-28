/**
 * Validation Service
 * Handles compilation checks and test execution after dependency updates
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { TransformationLogEntry } from '../types';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';

const logger = getLogger();

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether validation passed */
  success: boolean;
  /** Whether compilation was checked */
  compilationChecked: boolean;
  /** Whether compilation passed (if checked) */
  compilationPassed?: boolean;
  /** Whether tests were run */
  testsRun: boolean;
  /** Whether tests passed (if run) */
  testsPassed?: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Detailed output from compilation/tests */
  output?: string;
}

/**
 * Check if the repository is a TypeScript project
 */
async function isTypeScriptProject(repoPath: string): Promise<boolean> {
  try {
    const tsconfigPath = path.join(repoPath, 'tsconfig.json');
    await fs.access(tsconfigPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the repository has a test script
 */
async function hasTestScript(repoPath: string): Promise<boolean> {
  try {
    const packageJsonPath = path.join(repoPath, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    
    return !!(packageJson.scripts && packageJson.scripts.test);
  } catch {
    return false;
  }
}

/**
 * Run TypeScript compilation check
 */
async function runCompilationCheck(repoPath: string): Promise<{ success: boolean; output: string }> {
  logger.validation('compilation', 'running');
  
  try {
    const output = execSync('npx tsc --noEmit', {
      cwd: repoPath,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 60000 // 1 minute timeout
    });
    
    logger.validation('compilation', true);
    return { success: true, output };
    
  } catch (error: any) {
    const output = error.stdout || error.stderr || error.message;
    logger.validation('compilation', false, output.substring(0, 500));
    return { success: false, output };
  }
}

/**
 * Run test suite
 */
async function runTests(repoPath: string): Promise<{ success: boolean; output: string }> {
  logger.validation('tests', 'running');
  
  try {
    const output = execSync('npm test', {
      cwd: repoPath,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 120000 // 2 minute timeout
    });
    
    logger.validation('tests', true);
    return { success: true, output };
    
  } catch (error: any) {
    const output = error.stdout || error.stderr || error.message;
    logger.validation('tests', false, output.substring(0, 500));
    return { success: false, output };
  }
}

/**
 * Validate repository after a dependency update
 * Runs compilation check (if TypeScript) and test suite (if available)
 * 
 * @param repoPath Path to the repository
 * @returns ValidationResult with success status and details
 */
export async function validateAfterUpdate(repoPath: string): Promise<ValidationResult> {
  logger.info('Starting validation after update');
  
  const result: ValidationResult = {
    success: true,
    compilationChecked: false,
    testsRun: false
  };
  
  try {
    // Check if TypeScript project
    const isTS = await isTypeScriptProject(repoPath);
    
    if (isTS) {
      logger.info('TypeScript project detected, running compilation check');
      result.compilationChecked = true;
      
      const compilationResult = await runCompilationCheck(repoPath);
      result.compilationPassed = compilationResult.success;
      
      if (!compilationResult.success) {
        result.success = false;
        result.error = 'Compilation failed';
        result.output = compilationResult.output;
        logger.error('Validation failed: compilation errors');
        return result;
      }
    } else {
      logger.info('Not a TypeScript project, skipping compilation check');
    }
    
    // Check if test script exists
    const hasTests = await hasTestScript(repoPath);
    
    if (hasTests) {
      logger.info('Test script found, running tests');
      result.testsRun = true;
      
      const testResult = await runTests(repoPath);
      result.testsPassed = testResult.success;
      
      if (!testResult.success) {
        result.success = false;
        result.error = 'Tests failed';
        result.output = testResult.output;
        logger.error('Validation failed: test failures');
        return result;
      }
    } else {
      logger.info('No test script found, skipping tests');
    }
    
    logger.info('Validation passed successfully');
    return result;
    
  } catch (error: any) {
    logger.error('Validation error', error);
    result.success = false;
    result.error = error.message || 'Unknown validation error';
    return result;
  }
}

/**
 * Create a transformation log entry for validation
 */
export function createValidationLogEntry(result: ValidationResult): TransformationLogEntry {
  if (result.success) {
    const checks: string[] = [];
    if (result.compilationChecked) {
      checks.push('compilation');
    }
    if (result.testsRun) {
      checks.push('tests');
    }
    
    return {
      timestamp: new Date(),
      type: 'test_run',
      message: `Validation passed: ${checks.join(' and ')}`,
      details: {
        compilationChecked: result.compilationChecked,
        compilationPassed: result.compilationPassed,
        testsRun: result.testsRun,
        testsPassed: result.testsPassed
      }
    };
  } else {
    return {
      timestamp: new Date(),
      type: 'error',
      message: `Validation failed: ${result.error}`,
      details: {
        compilationChecked: result.compilationChecked,
        compilationPassed: result.compilationPassed,
        testsRun: result.testsRun,
        testsPassed: result.testsPassed,
        output: result.output
      }
    };
  }
}
