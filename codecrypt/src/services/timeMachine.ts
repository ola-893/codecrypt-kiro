/**
 * Time Machine Validation Service
 * Runs tests in parallel in original and modernized environments
 * Compares results to validate functional equivalence
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { dockerService, ContainerExecResult } from './docker';
import { detectNodeVersion, getNodeDockerImage } from './environmentDetection';
import {
  TimeMachineConfig,
  TimeMachineValidationResult,
  TestExecutionResult,
} from '../types';
import { getLogger } from '../utils/logger';
import { sandboxedNpmTest } from './sandbox';

const logger = getLogger();

/**
 * Parse test output to extract test counts
 */
function parseTestOutput(output: string): {
  testsRun?: number;
  testsPassed?: number;
  testsFailed?: number;
} {
  // Try to parse Jest output
  const jestMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/i);
  if (jestMatch) {
    return {
      testsFailed: parseInt(jestMatch[1], 10),
      testsPassed: parseInt(jestMatch[2], 10),
      testsRun: parseInt(jestMatch[3], 10),
    };
  }

  // Try to parse Mocha output
  const mochaMatch = output.match(/(\d+)\s+passing/i);
  const mochaFailMatch = output.match(/(\d+)\s+failing/i);
  if (mochaMatch) {
    const passed = parseInt(mochaMatch[1], 10);
    const failed = mochaFailMatch ? parseInt(mochaFailMatch[1], 10) : 0;
    return {
      testsPassed: passed,
      testsFailed: failed,
      testsRun: passed + failed,
    };
  }

  // Try to parse Vitest output
  const vitestMatch = output.match(/Test Files\s+(\d+)\s+passed.*\((\d+)\)/i);
  if (vitestMatch) {
    return {
      testsPassed: parseInt(vitestMatch[1], 10),
      testsRun: parseInt(vitestMatch[2], 10),
      testsFailed: parseInt(vitestMatch[2], 10) - parseInt(vitestMatch[1], 10),
    };
  }

  return {};
}

/**
 * Run tests in the modernized environment (current system)
 */
async function runModernTests(repoPath: string): Promise<TestExecutionResult> {
  logger.info('Running tests in modernized environment...');
  const startTime = Date.now();

  try {
    const output = sandboxedNpmTest(repoPath);
    const executionTime = Date.now() - startTime;

    const testCounts = parseTestOutput(output);

    logger.info(`Modern tests passed in ${executionTime}ms`);

    return {
      passed: true,
      exitCode: 0,
      stdout: output,
      stderr: '',
      executionTime,
      ...testCounts,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    const output = error.message || String(error);
    const testCounts = parseTestOutput(output);

    logger.error('Modern tests failed', error);

    return {
      passed: false,
      exitCode: error.code || 1,
      stdout: output,
      stderr: error.stderr || '',
      executionTime,
      ...testCounts,
    };
  }
}

/**
 * Run tests in the original environment (Docker container)
 */
async function runOriginalTests(
  repoPath: string,
  nodeVersion: string
): Promise<TestExecutionResult> {
  logger.info(`Running tests in original environment (Node.js ${nodeVersion})...`);

  const containerName = `codecrypt-timemachine-${Date.now()}`;
  const dockerImage = getNodeDockerImage(nodeVersion);

  try {
    // Create and start container
    const container = await dockerService.createContainer({
      image: dockerImage,
      name: containerName,
      workDir: '/app',
      volumes: [
        {
          host: repoPath,
          container: '/app',
          mode: 'rw',
        },
      ],
    });

    await dockerService.startContainer(container);

    // Install historical dependencies
    logger.info('Installing historical dependencies in container...');
    const installResult = await dockerService.execInContainer(container, [
      'npm',
      'install',
      '--legacy-peer-deps',
    ]);

    if (installResult.exitCode !== 0) {
      logger.warn('Failed to install dependencies in container', installResult.stderr);
      // Continue anyway - tests might still run
    }

    // Run tests
    logger.info('Running tests in container...');
    const testResult = await dockerService.execInContainer(container, [
      'npm',
      'test',
    ]);

    // Parse test output
    const testCounts = parseTestOutput(testResult.stdout + testResult.stderr);

    // Cleanup container
    await dockerService.stopContainer(container);
    await dockerService.removeContainer(container);

    logger.info(`Original tests completed with exit code ${testResult.exitCode}`);

    return {
      passed: testResult.exitCode === 0,
      exitCode: testResult.exitCode,
      stdout: testResult.stdout,
      stderr: testResult.stderr,
      executionTime: testResult.executionTime,
      ...testCounts,
    };
  } catch (error: any) {
    logger.error('Failed to run original tests', error);

    // Cleanup on error
    try {
      await dockerService.cleanupContainers(containerName);
    } catch (cleanupError) {
      logger.warn('Failed to cleanup container after error', cleanupError);
    }

    return {
      passed: false,
      exitCode: -1,
      stdout: '',
      stderr: error.message || String(error),
      executionTime: 0,
    };
  }
}

/**
 * Compare test outputs to determine functional equivalence
 */
function compareTestResults(
  originalResults: TestExecutionResult,
  modernResults: TestExecutionResult
): { equivalent: boolean; report: string } {
  const differences: string[] = [];

  // Compare pass/fail status
  if (originalResults.passed !== modernResults.passed) {
    differences.push(
      `Test pass/fail status differs: original ${originalResults.passed ? 'passed' : 'failed'}, modern ${modernResults.passed ? 'passed' : 'failed'}`
    );
  }

  // Compare test counts if available
  if (originalResults.testsRun && modernResults.testsRun) {
    if (originalResults.testsRun !== modernResults.testsRun) {
      differences.push(
        `Number of tests differs: original ran ${originalResults.testsRun}, modern ran ${modernResults.testsRun}`
      );
    }

    if (originalResults.testsPassed !== modernResults.testsPassed) {
      differences.push(
        `Number of passing tests differs: original ${originalResults.testsPassed}, modern ${modernResults.testsPassed}`
      );
    }

    if (originalResults.testsFailed !== modernResults.testsFailed) {
      differences.push(
        `Number of failing tests differs: original ${originalResults.testsFailed}, modern ${modernResults.testsFailed}`
      );
    }
  }

  // Analyze output differences (simplified comparison)
  const originalOutput = originalResults.stdout.toLowerCase();
  const modernOutput = modernResults.stdout.toLowerCase();

  // Check for new errors in modern version
  const errorPatterns = [
    /error:/gi,
    /exception:/gi,
    /failed:/gi,
    /assertion.*failed/gi,
  ];

  for (const pattern of errorPatterns) {
    const originalErrors = (originalOutput.match(pattern) || []).length;
    const modernErrors = (modernOutput.match(pattern) || []).length;

    if (modernErrors > originalErrors) {
      differences.push(
        `Modern version has more errors (${modernErrors} vs ${originalErrors})`
      );
    }
  }

  // Generate report
  let report = '## Time Machine Validation Report\n\n';

  report += '### Original Environment\n';
  report += `- Status: ${originalResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
  report += `- Exit Code: ${originalResults.exitCode}\n`;
  report += `- Execution Time: ${originalResults.executionTime}ms\n`;
  if (originalResults.testsRun) {
    report += `- Tests Run: ${originalResults.testsRun}\n`;
    report += `- Tests Passed: ${originalResults.testsPassed}\n`;
    report += `- Tests Failed: ${originalResults.testsFailed}\n`;
  }
  report += '\n';

  report += '### Modernized Environment\n';
  report += `- Status: ${modernResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
  report += `- Exit Code: ${modernResults.exitCode}\n`;
  report += `- Execution Time: ${modernResults.executionTime}ms\n`;
  if (modernResults.testsRun) {
    report += `- Tests Run: ${modernResults.testsRun}\n`;
    report += `- Tests Passed: ${modernResults.testsPassed}\n`;
    report += `- Tests Failed: ${modernResults.testsFailed}\n`;
  }
  report += '\n';

  if (differences.length === 0) {
    report += '### Functional Equivalence: ✅ VERIFIED\n\n';
    report += 'The modernized codebase produces identical test results to the original.\n';
  } else {
    report += '### Functional Equivalence: ⚠️ DIFFERENCES DETECTED\n\n';
    report += 'The following differences were found:\n\n';
    differences.forEach((diff, index) => {
      report += `${index + 1}. ${diff}\n`;
    });
  }

  return {
    equivalent: differences.length === 0 && originalResults.passed === modernResults.passed,
    report,
  };
}

/**
 * Calculate performance improvement percentage
 */
function calculatePerformanceImprovement(
  originalResults: TestExecutionResult,
  modernResults: TestExecutionResult
): number {
  if (originalResults.executionTime === 0) {
    return 0;
  }

  const improvement =
    ((originalResults.executionTime - modernResults.executionTime) /
      originalResults.executionTime) *
    100;

  return Math.round(improvement * 100) / 100; // Round to 2 decimal places
}

/**
 * Run Time Machine validation
 * Executes tests in parallel in original and modernized environments
 */
export async function runTimeMachineValidation(
  config: TimeMachineConfig
): Promise<TimeMachineValidationResult> {
  logger.info('Starting Time Machine validation...');

  // Check if Docker is available
  const dockerAvailable = await dockerService.checkDockerAvailable();
  if (!dockerAvailable) {
    await dockerService.handleDockerUnavailable();

    return {
      success: false,
      originalResults: {
        passed: false,
        exitCode: -1,
        stdout: '',
        stderr: 'Docker not available',
        executionTime: 0,
      },
      modernResults: {
        passed: false,
        exitCode: -1,
        stdout: '',
        stderr: 'Docker not available',
        executionTime: 0,
      },
      functionalEquivalence: false,
      performanceImprovement: 0,
      comparisonReport: 'Time Machine validation skipped: Docker not available',
      errors: ['Docker daemon is not running or not installed'],
    };
  }

  try {
    // Detect original Node.js version if not provided
    let nodeVersion = config.originalNodeVersion;
    if (!nodeVersion) {
      logger.info('Detecting original Node.js version...');
      const envInfo = await detectNodeVersion(config.repoPath);
      nodeVersion = envInfo.nodeVersion;
      logger.info(`Detected Node.js version: ${nodeVersion} (source: ${envInfo.source})`);
    }

    // Run tests in parallel
    logger.info('Running tests in parallel environments...');
    const [originalResults, modernResults] = await Promise.all([
      runOriginalTests(config.repoPath, nodeVersion),
      runModernTests(config.repoPath),
    ]);

    // Compare results
    const comparison = compareTestResults(originalResults, modernResults);
    const performanceImprovement = calculatePerformanceImprovement(
      originalResults,
      modernResults
    );

    // Add performance info to report
    let finalReport = comparison.report;
    finalReport += '\n### Performance Comparison\n\n';
    if (performanceImprovement > 0) {
      finalReport += `✅ Performance improved by ${performanceImprovement}%\n`;
      finalReport += `- Original: ${originalResults.executionTime}ms\n`;
      finalReport += `- Modern: ${modernResults.executionTime}ms\n`;
    } else if (performanceImprovement < 0) {
      finalReport += `⚠️ Performance decreased by ${Math.abs(performanceImprovement)}%\n`;
      finalReport += `- Original: ${originalResults.executionTime}ms\n`;
      finalReport += `- Modern: ${modernResults.executionTime}ms\n`;
    } else {
      finalReport += `➡️ Performance unchanged\n`;
      finalReport += `- Both: ${originalResults.executionTime}ms\n`;
    }

    const success = comparison.equivalent && modernResults.passed;

    logger.info(`Time Machine validation ${success ? 'succeeded' : 'completed with differences'}`);

    return {
      success,
      originalResults,
      modernResults,
      functionalEquivalence: comparison.equivalent,
      performanceImprovement,
      comparisonReport: finalReport,
    };
  } catch (error: any) {
    logger.error('Time Machine validation failed', error);

    return {
      success: false,
      originalResults: {
        passed: false,
        exitCode: -1,
        stdout: '',
        stderr: '',
        executionTime: 0,
      },
      modernResults: {
        passed: false,
        exitCode: -1,
        stdout: '',
        stderr: '',
        executionTime: 0,
      },
      functionalEquivalence: false,
      performanceImprovement: 0,
      comparisonReport: 'Time Machine validation failed due to error',
      errors: [error.message || String(error)],
    };
  }
}

/**
 * Check if repository has a test script
 */
export async function hasTestScript(repoPath: string): Promise<boolean> {
  try {
    const packageJsonPath = path.join(repoPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    return !!(packageJson.scripts && packageJson.scripts.test);
  } catch {
    return false;
  }
}

/**
 * Validate Time Machine configuration
 */
export function validateTimeMachineConfig(config: TimeMachineConfig): string[] {
  const errors: string[] = [];

  if (!config.repoPath) {
    errors.push('Repository path is required');
  }

  if (config.enabled && !config.originalNodeVersion) {
    // This is okay - we'll auto-detect
  }

  return errors;
}
