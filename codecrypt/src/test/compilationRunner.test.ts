/**
 * Tests for CompilationRunner
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CompilationRunner, createCompilationRunner } from '../services/compilationRunner';
import { PostResurrectionCompilationResult, CompileOptions } from '../types';

suite('CompilationRunner', () => {
  let testRepoPath: string;
  let runner: CompilationRunner;

  setup(async () => {
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-compilation-runner-test-'));
    runner = createCompilationRunner();
  });

  teardown(async () => {
    if (testRepoPath) {
      try {
        await fs.rm(testRepoPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  suite('detectPackageManager', () => {
    test('should detect npm from package-lock.json', async () => {
      await fs.writeFile(path.join(testRepoPath, 'package-lock.json'), '{}');
      const manager = await runner.detectPackageManager(testRepoPath);
      assert.strictEqual(manager, 'npm');
    });

    test('should detect yarn from yarn.lock', async () => {
      await fs.writeFile(path.join(testRepoPath, 'yarn.lock'), '');
      const manager = await runner.detectPackageManager(testRepoPath);
      assert.strictEqual(manager, 'yarn');
    });

    test('should detect pnpm from pnpm-lock.yaml', async () => {
      await fs.writeFile(path.join(testRepoPath, 'pnpm-lock.yaml'), '');
      const manager = await runner.detectPackageManager(testRepoPath);
      assert.strictEqual(manager, 'pnpm');
    });

    test('should prioritize pnpm over yarn and npm', async () => {
      await fs.writeFile(path.join(testRepoPath, 'package-lock.json'), '{}');
      await fs.writeFile(path.join(testRepoPath, 'yarn.lock'), '');
      await fs.writeFile(path.join(testRepoPath, 'pnpm-lock.yaml'), '');
      const manager = await runner.detectPackageManager(testRepoPath);
      assert.strictEqual(manager, 'pnpm');
    });

    test('should prioritize yarn over npm', async () => {
      await fs.writeFile(path.join(testRepoPath, 'package-lock.json'), '{}');
      await fs.writeFile(path.join(testRepoPath, 'yarn.lock'), '');
      const manager = await runner.detectPackageManager(testRepoPath);
      assert.strictEqual(manager, 'yarn');
    });

    test('should default to npm when no lockfile found', async () => {
      const manager = await runner.detectPackageManager(testRepoPath);
      assert.strictEqual(manager, 'npm');
    });
  });

  suite('detectBuildCommand', () => {
    test('should detect build script', () => {
      const packageJson = { scripts: { build: 'tsc' } };
      const cmd = runner.detectBuildCommand(packageJson);
      assert.strictEqual(cmd, 'build');
    });

    test('should detect compile script when build is not present', () => {
      const packageJson = { scripts: { compile: 'tsc', test: 'jest' } };
      const cmd = runner.detectBuildCommand(packageJson);
      assert.strictEqual(cmd, 'compile');
    });

    test('should detect tsc script', () => {
      const packageJson = { scripts: { tsc: 'tsc', test: 'jest' } };
      const cmd = runner.detectBuildCommand(packageJson);
      assert.strictEqual(cmd, 'tsc');
    });

    test('should detect build:prod script', () => {
      const packageJson = { scripts: { 'build:prod': 'webpack --mode production' } };
      const cmd = runner.detectBuildCommand(packageJson);
      assert.strictEqual(cmd, 'build:prod');
    });

    test('should return null when no scripts', () => {
      const packageJson = {};
      const cmd = runner.detectBuildCommand(packageJson);
      assert.strictEqual(cmd, null);
    });

    test('should fallback to test when no build script', () => {
      const packageJson = { scripts: { test: 'jest', lint: 'eslint' } };
      const cmd = runner.detectBuildCommand(packageJson);
      assert.strictEqual(cmd, 'test');
    });

    test('should prioritize build over compile', () => {
      const packageJson = { scripts: { build: 'webpack', compile: 'tsc' } };
      const cmd = runner.detectBuildCommand(packageJson);
      assert.strictEqual(cmd, 'build');
    });
  });


  suite('compile', () => {
    test('should execute build command and capture output', async function() {
      this.timeout(10000);
      
      // Create a simple package.json with an echo script
      const packageJson = {
        name: 'test-project',
        scripts: {
          build: 'echo "Build successful"'
        }
      };
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build',
        timeout: 10000
      };

      const result = await runner.compile(testRepoPath, options);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Build successful'));
      assert.ok(result.duration > 0);
    });

    test('should capture stderr on failure', async function() {
      this.timeout(10000);
      
      // Create a package.json with a failing script
      const packageJson = {
        name: 'test-project',
        scripts: {
          build: 'echo "Error message" >&2 && exit 1'
        }
      };
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build',
        timeout: 10000
      };

      const result = await runner.compile(testRepoPath, options);
      
      assert.strictEqual(result.success, false);
      assert.notStrictEqual(result.exitCode, 0);
      assert.ok(result.duration > 0);
    });

    test('should handle timeout', async function() {
      this.timeout(15000);
      
      // Create a package.json with a long-running script
      const packageJson = {
        name: 'test-project',
        scripts: {
          build: 'sleep 10'
        }
      };
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build',
        timeout: 1000 // 1 second timeout
      };

      const result = await runner.compile(testRepoPath, options);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.exitCode, -1);
      assert.ok(result.stderr.includes('TIMEOUT'));
    });
  });

  suite('compile - missing build script handling', () => {
    test('should return not_applicable when no build script exists', async function() {
      this.timeout(10000);
      
      // Create a package.json without any build scripts
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'echo "test"'
        }
      };
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build',
        timeout: 10000
      };

      const result = await runner.compile(testRepoPath, options);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.compilationStatus, 'not_applicable');
      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('No build script detected'));
      assert.ok(result.duration >= 0);
    });

    test('should return not_applicable when package.json has no scripts', async function() {
      this.timeout(10000);
      
      // Create a package.json without scripts section
      const packageJson = {
        name: 'test-project',
        version: '1.0.0'
      };
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build',
        timeout: 10000
      };

      const result = await runner.compile(testRepoPath, options);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.compilationStatus, 'not_applicable');
      assert.strictEqual(result.exitCode, 0);
    });

    test('should execute build when build script exists', async function() {
      this.timeout(10000);
      
      // Create a package.json with a build script
      const packageJson = {
        name: 'test-project',
        scripts: {
          build: 'echo "Building..."'
        }
      };
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build',
        timeout: 10000
      };

      const result = await runner.compile(testRepoPath, options);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.compilationStatus, 'passed');
      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Building'));
    });

    test('should return failed status when build fails', async function() {
      this.timeout(10000);
      
      // Create a package.json with a failing build script
      const packageJson = {
        name: 'test-project',
        scripts: {
          build: 'exit 1'
        }
      };
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build',
        timeout: 10000
      };

      const result = await runner.compile(testRepoPath, options);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.compilationStatus, 'failed');
      assert.notStrictEqual(result.exitCode, 0);
    });
  });

  suite('generateCompilationProof', () => {
    test('should generate proof with all required fields', () => {
      const result: PostResurrectionCompilationResult = {
        success: true,
        compilationStatus: 'passed',
        exitCode: 0,
        stdout: 'Build successful',
        stderr: '',
        duration: 5000
      };

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build'
      };

      const proof = runner.generateCompilationProof(result, options, 3);

      assert.ok(proof.timestamp instanceof Date);
      assert.strictEqual(proof.buildCommand, 'build');
      assert.strictEqual(proof.exitCode, 0);
      assert.strictEqual(proof.duration, 5000);
      assert.strictEqual(proof.packageManager, 'npm');
      assert.strictEqual(proof.iterationsRequired, 3);
      assert.ok(proof.outputHash.length === 64); // SHA-256 hex is 64 chars
    });

    test('should generate different hashes for different outputs', () => {
      const result1: PostResurrectionCompilationResult = {
        success: true,
        compilationStatus: 'passed',
        exitCode: 0,
        stdout: 'Output 1',
        stderr: '',
        duration: 1000
      };

      const result2: PostResurrectionCompilationResult = {
        success: true,
        compilationStatus: 'passed',
        exitCode: 0,
        stdout: 'Output 2',
        stderr: '',
        duration: 1000
      };

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build'
      };

      const proof1 = runner.generateCompilationProof(result1, options, 1);
      const proof2 = runner.generateCompilationProof(result2, options, 1);

      assert.notStrictEqual(proof1.outputHash, proof2.outputHash);
    });

    test('should generate same hash for same output', () => {
      const result: PostResurrectionCompilationResult = {
        success: true,
        compilationStatus: 'passed',
        exitCode: 0,
        stdout: 'Same output',
        stderr: 'Same error',
        duration: 1000
      };

      const options: CompileOptions = {
        packageManager: 'npm',
        buildCommand: 'build'
      };

      const proof1 = runner.generateCompilationProof(result, options, 1);
      const proof2 = runner.generateCompilationProof(result, options, 1);

      assert.strictEqual(proof1.outputHash, proof2.outputHash);
    });
  });

  suite('createCompilationRunner', () => {
    test('should create a CompilationRunner instance', () => {
      const instance = createCompilationRunner();
      assert.ok(instance instanceof CompilationRunner);
    });
  });
});
