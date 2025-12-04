
import { UpdateBatch } from './batchPlanner';
import { NpmInstallError, parseNpmError } from '../utils/errors';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { ResurrectionPlanItem } from '../services/resurrectionPlanning';
import { getLogger } from '../utils/logger';
import { BatchExecutionResult as NewBatchExecutionResult, PackageUpdateResult } from '../types';
import { ResurrectionEventEmitter } from './eventEmitter';

const logger = getLogger();

export interface BatchExecutor {
  execute(batch: UpdateBatch, projectPath: string): Promise<BatchExecutionResult>;
  executeWithFallback(batch: UpdateBatch, projectPath: string): Promise<BatchExecutionResult>;
}

export class BatchExecutionResult {
  constructor(
    public readonly batch: UpdateBatch,
    public readonly success: boolean,
    public readonly log: string,
    public readonly error?: NpmInstallError,
    public readonly installFlagsUsed?: string[]
  ) {}
}

export class NpmBatchExecutor implements BatchExecutor {
  // Internal wrappers for fs/promises methods to allow easier stubbing in tests
  private async _readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return fs.readFile(filePath, encoding);
  }

  private async _writeFile(filePath: string, content: string): Promise<void> {
    return fs.writeFile(filePath, content);
  }

  private async applyBatchToPackageJson(batch: UpdateBatch, projectPath: string): Promise<void> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJsonContent = await this._readFile(packageJsonPath);
    const packageJson = JSON.parse(packageJsonContent);

    let changed = false;
    for (const pkg of batch.packages) {
      if (packageJson.dependencies && packageJson.dependencies[pkg.packageName]) {
        packageJson.dependencies[pkg.packageName] = pkg.targetVersion;
        changed = true;
      }
      if (packageJson.devDependencies && packageJson.devDependencies[pkg.packageName]) {
        packageJson.devDependencies[pkg.packageName] = pkg.targetVersion;
        changed = true;
      }
    }

    if (changed) {
      await this._writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
  }

  private async restorePackageJson(projectPath: string): Promise<void> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    // For simplicity, we'll just git checkout the file.
    // A more robust implementation might store the original content in memory.
    await this.runCommand('git', ['checkout', 'HEAD', '--', packageJsonPath]);
  }

  private async runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve) => {
      const child = spawn(command, args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });
    });
  }

  public async execute(batch: UpdateBatch, projectPath: string): Promise<BatchExecutionResult> {
    logger.info(`[BatchExecutor] Executing batch ${batch.id} with ${batch.packages.length} package(s)`);
    batch.packages.forEach(pkg => {
      logger.info(`[BatchExecutor]   - ${pkg.packageName}: ${pkg.currentVersion} → ${pkg.targetVersion}`);
    });

    try {
      logger.info(`[BatchExecutor] Applying changes to package.json`);
      await this.applyBatchToPackageJson(batch, projectPath);
      
      logger.info(`[BatchExecutor] Running: npm install`);
      const startTime = Date.now();
      const { stdout, stderr, code } = await this.runCommand('npm', ['install']);
      const elapsed = Date.now() - startTime;
      
      logger.info(`[BatchExecutor] npm install completed in ${elapsed}ms with exit code ${code}`);

      if (code === 0) {
        logger.info(`[BatchExecutor] Batch ${batch.id} succeeded`);
        return new BatchExecutionResult(batch, true, stdout);
      } else {
        logger.warn(`[BatchExecutor] Batch ${batch.id} failed, restoring package.json`);
        logger.debug(`[BatchExecutor] stderr: ${stderr.substring(0, 500)}`);
        await this.restorePackageJson(projectPath);
        const error = parseNpmError(stderr);
        return new BatchExecutionResult(batch, false, `${stdout}\n${stderr}`, error);
      }
    } catch (e: any) {
      logger.error(`[BatchExecutor] Exception during batch ${batch.id} execution`, e);
      await this.restorePackageJson(projectPath);
      return new BatchExecutionResult(batch, false, e.message, parseNpmError(e.message));
    }
  }

  public async executeWithFallback(batch: UpdateBatch, projectPath: string): Promise<BatchExecutionResult> {
    logger.info(`[BatchExecutor] Executing batch ${batch.id} with fallback strategies`);
    const installFlags = ['', '--legacy-peer-deps', '--force'];
    let lastResult: BatchExecutionResult | undefined;
    
    for (const flag of installFlags) {
      const flagsUsed = flag ? [flag] : [];
      const flagDesc = flag || 'no flags';
      logger.info(`[BatchExecutor] Attempting with ${flagDesc}`);
      
      try {
        await this.applyBatchToPackageJson(batch, projectPath);
        const command = ['install', ...flagsUsed].filter(f => f);
        logger.info(`[BatchExecutor] Running: npm ${command.join(' ')}`);
        
        const startTime = Date.now();
        const { stdout, stderr, code } = await this.runCommand('npm', command);
        const elapsed = Date.now() - startTime;
        
        logger.info(`[BatchExecutor] npm install completed in ${elapsed}ms with exit code ${code}`);

        if (code === 0) {
          logger.info(`[BatchExecutor] Batch ${batch.id} succeeded with ${flagDesc}`);
          return new BatchExecutionResult(batch, true, stdout, undefined, flagsUsed);
        } else {
          logger.warn(`[BatchExecutor] Batch ${batch.id} failed with ${flagDesc}`);
          logger.debug(`[BatchExecutor] stderr: ${stderr.substring(0, 500)}`);
          lastResult = new BatchExecutionResult(batch, false, `${stdout}\n${stderr}`, parseNpmError(stderr), flagsUsed);
        }
      } catch (e: any) {
        logger.error(`[BatchExecutor] Exception with ${flagDesc}`, e);
        lastResult = new BatchExecutionResult(batch, false, e.message, parseNpmError(e.message), flagsUsed);
      } finally {
        await this.restorePackageJson(projectPath);
      }
    }
    
    // If all attempts with flags fail, try individual fallback
    logger.info(`[BatchExecutor] All flag strategies failed, trying individual package installation`);
    return await this.individualFallback(batch, projectPath);
  }

  private async individualFallback(batch: UpdateBatch, projectPath: string): Promise<BatchExecutionResult> {
    const successfulPackages: ResurrectionPlanItem[] = [];
    const failedPackages: ResurrectionPlanItem[] = [];
    let log = 'Batch installation failed. Attempting individual installation...\n';

    for (const pkg of batch.packages) {
      const singlePackageBatch: UpdateBatch = { ...batch, packages: [pkg] };
      // Temporarily modify package.json for individual package
      const packageJsonPath = path.join(projectPath, 'package.json');
      const originalPackageJsonContent = await this._readFile(packageJsonPath);
      const packageJson = JSON.parse(originalPackageJsonContent);

      if (packageJson.dependencies && packageJson.dependencies[pkg.packageName]) {
        packageJson.dependencies[pkg.packageName] = pkg.targetVersion;
      }
      if (packageJson.devDependencies && packageJson.devDependencies[pkg.packageName]) {
        packageJson.devDependencies[pkg.packageName] = pkg.targetVersion;
      }
      await this._writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const result = await this.execute(singlePackageBatch, projectPath); // Execute without fallback for individual
      if (result.success) {
        successfulPackages.push(pkg);
        log += `SUCCESS: ${pkg.packageName}@${pkg.targetVersion}\n`;
      } else {
        failedPackages.push(pkg);
        log += `FAILURE: ${pkg.packageName}@${pkg.targetVersion}\n${result.log}\n`;
      }
      // Restore original package.json after each individual attempt
      await this._writeFile(packageJsonPath, originalPackageJsonContent);
    }

    if (successfulPackages.length > 0) {
      // Create a final batch of all successful packages and install them together
      const finalBatch: UpdateBatch = { ...batch, packages: successfulPackages };
      await this.applyBatchToPackageJson(finalBatch, projectPath);
      const { stdout, stderr, code } = await this.runCommand('npm', ['install']);
      if (code === 0) {
        log += 'Final installation of successful packages was successful.';
         return new BatchExecutionResult(finalBatch, true, log);
      } else {
        log += 'Final installation of successful packages failed.';
        await this.restorePackageJson(projectPath);
        return new BatchExecutionResult(batch, false, log, parseNpmError(stderr));
      }
    }

    return new BatchExecutionResult(batch, false, log);
  }

  // ============================================================================
  // New Batch Execution Methods (Task 1)
  // ============================================================================

  /**
   * Update package.json with a new version for a specific package
   * Task 1.3: Implement updatePackageJson() helper
   */
  private async updatePackageJson(
    repoPath: string,
    packageName: string,
    version: string
  ): Promise<void> {
    const packageJsonPath = path.join(repoPath, 'package.json');
    
    try {
      // Check if package.json exists
      await fs.access(packageJsonPath);
    } catch (error) {
      logger.warn(`[BatchExecutor] package.json not found at ${packageJsonPath}`);
      throw new Error(`package.json not found at ${packageJsonPath}`);
    }

    const packageJsonContent = await this._readFile(packageJsonPath);
    const packageJson = JSON.parse(packageJsonContent);

    let updated = false;

    // Update in dependencies
    if (packageJson.dependencies && packageJson.dependencies[packageName]) {
      logger.info(`[BatchExecutor] Updating ${packageName} in dependencies: ${packageJson.dependencies[packageName]} → ${version}`);
      packageJson.dependencies[packageName] = version;
      updated = true;
    }

    // Update in devDependencies
    if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
      logger.info(`[BatchExecutor] Updating ${packageName} in devDependencies: ${packageJson.devDependencies[packageName]} → ${version}`);
      packageJson.devDependencies[packageName] = version;
      updated = true;
    }

    if (!updated) {
      logger.warn(`[BatchExecutor] Package ${packageName} not found in dependencies or devDependencies`);
    }

    // Write updated package.json
    await this._writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    logger.info(`[BatchExecutor] Successfully updated package.json`);
  }

  /**
   * Run npm install with output capture and timeout
   * Task 1.4: Implement runNpmInstall() with output capture
   */
  private async runNpmInstall(repoPath: string): Promise<{ success: boolean; error?: string }> {
    logger.info(`[BatchExecutor] Running npm install --legacy-peer-deps in ${repoPath}`);
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeout = 120000; // 2 minutes
      
      const child = spawn('npm', ['install', '--legacy-peer-deps'], {
        cwd: repoPath,
        shell: true
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill();
        logger.error(`[BatchExecutor] npm install timed out after ${timeout}ms`);
      }, timeout);

      // Capture stdout
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Task 5.1: Log npm install output (stdout) in real-time
        const lines = output.split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => {
          logger.debug(`[BatchExecutor] npm: ${line}`);
        });
      });

      // Capture stderr
      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Task 5.1: Log npm install output (stderr) in real-time
        const lines = output.split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => {
          logger.debug(`[BatchExecutor] npm (stderr): ${line}`);
        });
      });

      // Handle process completion
      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        
        logger.info(`[BatchExecutor] npm install completed in ${elapsed}ms with exit code ${code}`);
        
        // Task 5.1: Log npm install output summary
        if (stdout) {
          const stdoutLines = stdout.split('\n').length;
          logger.info(`[BatchExecutor] npm stdout: ${stdoutLines} lines`);
          
          // Log important lines from stdout (added/updated packages, warnings)
          const importantLines = stdout.split('\n').filter(line => 
            line.includes('added') || 
            line.includes('updated') || 
            line.includes('removed') ||
            line.includes('WARN') ||
            line.includes('ERR!')
          );
          
          if (importantLines.length > 0) {
            logger.info(`[BatchExecutor] npm install summary:`);
            importantLines.slice(0, 10).forEach(line => {
              logger.info(`[BatchExecutor]   ${line.trim()}`);
            });
          }
        }
        
        if (stderr) {
          const stderrLines = stderr.split('\n').filter(line => line.trim()).length;
          logger.info(`[BatchExecutor] npm stderr: ${stderrLines} lines`);
          
          // Log error/warning lines from stderr
          const errorLines = stderr.split('\n').filter(line => line.trim());
          if (errorLines.length > 0 && code !== 0) {
            logger.warn(`[BatchExecutor] npm install errors/warnings:`);
            errorLines.slice(0, 10).forEach(line => {
              logger.warn(`[BatchExecutor]   ${line.trim()}`);
            });
          }
        }

        if (timedOut) {
          resolve({
            success: false,
            error: `npm install timed out after ${timeout}ms`
          });
        } else if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: `npm install failed with exit code ${code}: ${stderr.substring(0, 500)}`
          });
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        logger.error(`[BatchExecutor] npm install process error:`, error);
        resolve({
          success: false,
          error: `npm install process error: ${error.message}`
        });
      });
    });
  }

  /**
   * Validate an update by checking compilation and tests
   * Task 1.5: Implement validateUpdate() helper
   */
  private async validateUpdate(repoPath: string): Promise<{ success: boolean; compilationPassed?: boolean; testsPassed?: boolean }> {
    logger.info(`[BatchExecutor] Validating update in ${repoPath}`);
    
    let compilationPassed = false;
    let testsPassed = false;

    // Check if TypeScript project
    const tsconfigPath = path.join(repoPath, 'tsconfig.json');
    let isTypeScriptProject = false;
    
    try {
      await fs.access(tsconfigPath);
      isTypeScriptProject = true;
      logger.info(`[BatchExecutor] Detected TypeScript project`);
    } catch {
      logger.info(`[BatchExecutor] Not a TypeScript project (no tsconfig.json)`);
    }

    // Run compilation check if TypeScript
    if (isTypeScriptProject) {
      logger.info(`[BatchExecutor] Running TypeScript compilation check`);
      const compileResult = await this.runCommand('npx', ['tsc', '--noEmit']);
      
      if (compileResult.code === 0) {
        logger.info(`[BatchExecutor] Compilation passed`);
        compilationPassed = true;
      } else {
        logger.warn(`[BatchExecutor] Compilation failed with exit code ${compileResult.code}`);
        logger.debug(`[BatchExecutor] Compilation stderr: ${compileResult.stderr.substring(0, 500)}`);
      }
    } else {
      // For non-TypeScript projects, assume compilation passes
      compilationPassed = true;
    }

    // Check if test script exists
    const packageJsonPath = path.join(repoPath, 'package.json');
    let hasTestScript = false;
    
    try {
      const packageJsonContent = await this._readFile(packageJsonPath);
      const packageJson = JSON.parse(packageJsonContent);
      
      if (packageJson.scripts && packageJson.scripts.test && packageJson.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        hasTestScript = true;
        logger.info(`[BatchExecutor] Detected test script: ${packageJson.scripts.test}`);
      } else {
        logger.info(`[BatchExecutor] No test script found or default test script`);
      }
    } catch (error) {
      logger.warn(`[BatchExecutor] Could not read package.json for test script check`);
    }

    // Run tests if available
    if (hasTestScript) {
      logger.info(`[BatchExecutor] Running tests`);
      const testResult = await this.runCommand('npm', ['test']);
      
      if (testResult.code === 0) {
        logger.info(`[BatchExecutor] Tests passed`);
        testsPassed = true;
      } else {
        logger.warn(`[BatchExecutor] Tests failed with exit code ${testResult.code}`);
        logger.debug(`[BatchExecutor] Test stderr: ${testResult.stderr.substring(0, 500)}`);
      }
    } else {
      // If no tests, assume tests pass
      testsPassed = true;
    }

    const success = compilationPassed && testsPassed;
    logger.info(`[BatchExecutor] Validation result: ${success ? 'PASSED' : 'FAILED'} (compilation: ${compilationPassed}, tests: ${testsPassed})`);
    
    return {
      success,
      compilationPassed,
      testsPassed
    };
  }

  /**
   * Execute a single batch of package updates
   * Task 1.2: Implement executeBatch() for single batch
   */
  private async executeBatchNew(
    batch: UpdateBatch,
    repoPath: string,
    eventEmitter: ResurrectionEventEmitter
  ): Promise<NewBatchExecutionResult> {
    const startTime = Date.now();
    const results: PackageUpdateResult[] = [];

    logger.info(`[BatchExecutor] Executing batch ${batch.id} with ${batch.packages.length} package(s)`);

    for (let i = 0; i < batch.packages.length; i++) {
      const pkg = batch.packages[i];
      
      // Task 5.1: Log each package update attempt
      logger.info(`[BatchExecutor] ========================================`);
      logger.info(`[BatchExecutor] Package ${i + 1}/${batch.packages.length}: ${pkg.packageName}`);
      logger.info(`[BatchExecutor] ========================================`);
      logger.info(`[BatchExecutor] Current version: ${pkg.currentVersion}`);
      logger.info(`[BatchExecutor] Target version: ${pkg.targetVersion}`);
      logger.info(`[BatchExecutor] Update reason: ${pkg.reason || 'Not specified'}`);
      
      // Emit package_update_started event
      eventEmitter.emitPackageUpdateStarted({
        packageName: pkg.packageName,
        fromVersion: pkg.currentVersion,
        toVersion: pkg.targetVersion
      });

      try {
        // Update package.json
        logger.info(`[BatchExecutor] Step 1/3: Updating package.json...`);
        await this.updatePackageJson(repoPath, pkg.packageName, pkg.targetVersion);

        // Run npm install
        logger.info(`[BatchExecutor] Step 2/3: Running npm install...`);
        const installResult = await this.runNpmInstall(repoPath);

        if (!installResult.success) {
          logger.warn(`[BatchExecutor] ✗ npm install failed for ${pkg.packageName}`);
          logger.warn(`[BatchExecutor] Error: ${installResult.error}`);
          
          const result: PackageUpdateResult = {
            packageName: pkg.packageName,
            fromVersion: pkg.currentVersion,
            toVersion: pkg.targetVersion,
            success: false,
            error: installResult.error
          };
          
          results.push(result);
          
          // Emit package_updated event
          eventEmitter.emitPackageUpdated(result);
          
          logger.info(`[BatchExecutor] Continuing to next package...`);
          continue;
        }

        logger.info(`[BatchExecutor] ✓ npm install succeeded`);

        // Validate the update
        logger.info(`[BatchExecutor] Step 3/3: Validating update...`);
        const validationResult = await this.validateUpdate(repoPath);

        const result: PackageUpdateResult = {
          packageName: pkg.packageName,
          fromVersion: pkg.currentVersion,
          toVersion: pkg.targetVersion,
          success: true,
          validationPassed: validationResult.success
        };

        results.push(result);

        // Emit package_updated event
        eventEmitter.emitPackageUpdated(result);

        // Task 5.1: Log validation results
        if (validationResult.success) {
          logger.info(`[BatchExecutor] ✓ Validation PASSED`);
          if (validationResult.compilationPassed !== undefined) {
            logger.info(`[BatchExecutor]   - Compilation: ${validationResult.compilationPassed ? 'PASSED' : 'FAILED'}`);
          }
          if (validationResult.testsPassed !== undefined) {
            logger.info(`[BatchExecutor]   - Tests: ${validationResult.testsPassed ? 'PASSED' : 'FAILED'}`);
          }
        } else {
          logger.warn(`[BatchExecutor] ✗ Validation FAILED`);
          if (validationResult.compilationPassed !== undefined) {
            logger.warn(`[BatchExecutor]   - Compilation: ${validationResult.compilationPassed ? 'PASSED' : 'FAILED'}`);
          }
          if (validationResult.testsPassed !== undefined) {
            logger.warn(`[BatchExecutor]   - Tests: ${validationResult.testsPassed ? 'PASSED' : 'FAILED'}`);
          }
        }

        logger.info(`[BatchExecutor] ✓ Successfully updated ${pkg.packageName}`);

      } catch (error: any) {
        logger.error(`[BatchExecutor] ✗ Error updating ${pkg.packageName}:`, error);
        
        const result: PackageUpdateResult = {
          packageName: pkg.packageName,
          fromVersion: pkg.currentVersion,
          toVersion: pkg.targetVersion,
          success: false,
          error: error.message
        };

        results.push(result);

        // Emit package_updated event
        eventEmitter.emitPackageUpdated(result);
      }
    }

    const duration = Date.now() - startTime;
    const batchResult: NewBatchExecutionResult = {
      batchId: batch.id,
      packagesAttempted: batch.packages.length,
      packagesSucceeded: results.filter(r => r.success).length,
      packagesFailed: results.filter(r => !r.success).length,
      results,
      duration
    };

    logger.info(`[BatchExecutor] Batch ${batch.id} complete: ${batchResult.packagesSucceeded}/${batchResult.packagesAttempted} succeeded in ${duration}ms`);

    return batchResult;
  }

  /**
   * Execute all batches in sequence
   * Task 1.1: Implement executeBatches() main loop
   */
  async executeBatches(
    batches: UpdateBatch[],
    repoPath: string,
    eventEmitter: ResurrectionEventEmitter
  ): Promise<NewBatchExecutionResult[]> {
    // Task 5.1: Log batch plan at start
    logger.info(`[BatchExecutor] ========================================`);
    logger.info(`[BatchExecutor] BATCH EXECUTION PLAN`);
    logger.info(`[BatchExecutor] ========================================`);
    logger.info(`[BatchExecutor] Total batches: ${batches.length}`);
    logger.info(`[BatchExecutor] Repository: ${repoPath}`);
    logger.info(`[BatchExecutor] ----------------------------------------`);
    
    batches.forEach((batch, index) => {
      logger.info(`[BatchExecutor] Batch ${index + 1}/${batches.length} (ID: ${batch.id}):`);
      batch.packages.forEach(pkg => {
        logger.info(`[BatchExecutor]   - ${pkg.packageName}: ${pkg.currentVersion} → ${pkg.targetVersion}`);
      });
    });
    
    logger.info(`[BatchExecutor] ========================================`);
    
    const results: NewBatchExecutionResult[] = [];

    for (const batch of batches) {
      logger.info(`[BatchExecutor] ----------------------------------------`);
      logger.info(`[BatchExecutor] Starting batch ${batch.id}`);
      logger.info(`[BatchExecutor] ----------------------------------------`);
      
      // Emit batch_started event
      eventEmitter.emitBatchStarted({
        batchId: batch.id,
        packages: batch.packages.map(pkg => ({
          name: pkg.packageName,
          fromVersion: pkg.currentVersion,
          toVersion: pkg.targetVersion
        }))
      });

      // Execute the batch
      const batchResult = await this.executeBatchNew(batch, repoPath, eventEmitter);
      results.push(batchResult);

      // Emit batch_completed event
      eventEmitter.emitBatchCompleted(batchResult);

      // Task 5.1: Log batch summary at end
      logger.info(`[BatchExecutor] ----------------------------------------`);
      logger.info(`[BatchExecutor] BATCH ${batch.id} SUMMARY`);
      logger.info(`[BatchExecutor] ----------------------------------------`);
      logger.info(`[BatchExecutor] Packages attempted: ${batchResult.packagesAttempted}`);
      logger.info(`[BatchExecutor] Packages succeeded: ${batchResult.packagesSucceeded}`);
      logger.info(`[BatchExecutor] Packages failed: ${batchResult.packagesFailed}`);
      logger.info(`[BatchExecutor] Duration: ${batchResult.duration}ms`);
      logger.info(`[BatchExecutor] Success rate: ${((batchResult.packagesSucceeded / batchResult.packagesAttempted) * 100).toFixed(1)}%`);
      
      // Log individual package results
      batchResult.results.forEach(result => {
        const status = result.success ? '✓' : '✗';
        const validation = result.validationPassed !== undefined 
          ? ` (validation: ${result.validationPassed ? 'PASSED' : 'FAILED'})` 
          : '';
        logger.info(`[BatchExecutor]   ${status} ${result.packageName}: ${result.fromVersion} → ${result.toVersion}${validation}`);
        if (result.error) {
          logger.info(`[BatchExecutor]     Error: ${result.error.substring(0, 100)}`);
        }
      });
      logger.info(`[BatchExecutor] ----------------------------------------`);
    }

    const totalAttempted = results.reduce((sum, r) => sum + r.packagesAttempted, 0);
    const totalSucceeded = results.reduce((sum, r) => sum + r.packagesSucceeded, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.packagesFailed, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    // Task 5.1: Enhanced final summary
    logger.info(`[BatchExecutor] ========================================`);
    logger.info(`[BatchExecutor] ALL BATCHES COMPLETE`);
    logger.info(`[BatchExecutor] ========================================`);
    logger.info(`[BatchExecutor] Total packages attempted: ${totalAttempted}`);
    logger.info(`[BatchExecutor] Total packages succeeded: ${totalSucceeded}`);
    logger.info(`[BatchExecutor] Total packages failed: ${totalFailed}`);
    logger.info(`[BatchExecutor] Overall success rate: ${totalAttempted > 0 ? ((totalSucceeded / totalAttempted) * 100).toFixed(1) : '0'}%`);
    logger.info(`[BatchExecutor] Total duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
    logger.info(`[BatchExecutor] ========================================`);

    return results;
  }
}
