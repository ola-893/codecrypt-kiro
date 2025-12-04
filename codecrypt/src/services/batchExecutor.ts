
import { UpdateBatch } from './batchPlanner';
import { NpmInstallError, parseNpmError } from '../utils/errors';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { ResurrectionPlanItem } from '../services/resurrectionPlanning';

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
    try {
      await this.applyBatchToPackageJson(batch, projectPath);
      const { stdout, stderr, code } = await this.runCommand('npm', ['install']);

      if (code === 0) {
        return new BatchExecutionResult(batch, true, stdout);
      } else {
        await this.restorePackageJson(projectPath);
        const error = parseNpmError(stderr);
        return new BatchExecutionResult(batch, false, `${stdout}\n${stderr}`, error);
      }
    } catch (e: any) {
      await this.restorePackageJson(projectPath);
      return new BatchExecutionResult(batch, false, e.message, parseNpmError(e.message));
    }
  }

  public async executeWithFallback(batch: UpdateBatch, projectPath: string): Promise<BatchExecutionResult> {
    const installFlags = ['', '--legacy-peer-deps', '--force'];
    let lastResult: BatchExecutionResult | undefined;
    
    for (const flag of installFlags) {
      const flagsUsed = flag ? [flag] : [];
      try {
        await this.applyBatchToPackageJson(batch, projectPath);
        const { stdout, stderr, code } = await this.runCommand('npm', ['install', ...flagsUsed].filter(f => f));

        if (code === 0) {
          return new BatchExecutionResult(batch, true, stdout, undefined, flagsUsed);
        } else {
          lastResult = new BatchExecutionResult(batch, false, `${stdout}\n${stderr}`, parseNpmError(stderr), flagsUsed);
        }
      } catch (e: any) {
        lastResult = new BatchExecutionResult(batch, false, e.message, parseNpmError(e.message), flagsUsed);
      } finally {
        await this.restorePackageJson(projectPath);
      }
    }
    
    // If all attempts with flags fail, try individual fallback
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
}
