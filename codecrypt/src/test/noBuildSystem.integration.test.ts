/**
 * Integration test for repositories without build systems
 * Tests Requirements 2.6, 6.1-6.5: Graceful handling of projects without build scripts
 */

import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CompilationRunner } from '../services/compilationRunner';
import { detectBuildConfiguration } from '../services/environmentDetection';

describe('No Build System Integration Test', () => {
  let testRepoPath: string;
  let compilationRunner: CompilationRunner;

  beforeEach(async () => {
    // Create a temporary test repository
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-no-build-test-'));
    compilationRunner = new CompilationRunner();

    // Create a minimal package.json without any build scripts
    const packageJson = {
      name: 'test-no-build-system',
      version: '1.0.0',
      description: 'Test repository without build system',
      main: 'index.js',
      scripts: {
        // Only non-build scripts
        start: 'node index.js'
      },
      dependencies: {
        express: '^4.18.0'
      }
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create a simple index.js file
    await fs.writeFile(
      path.join(testRepoPath, 'index.js'),
      `console.log('Hello from test app');`
    );
  });

  afterEach(async () => {
    // Clean up test repository
    await fs.rm(testRepoPath, { recursive: true, force: true });
  });

  it('should detect no build system (Requirement 2.6)', async () => {
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    assert.strictEqual(buildConfig.hasBuildScript, false);
    assert.strictEqual(buildConfig.buildCommand, null);
    assert.strictEqual(buildConfig.buildTool, 'none');
    assert.strictEqual(buildConfig.requiresCompilation, false);
  });

  it('should mark compilation as not_applicable (Requirement 6.1)', async () => {
    const result = await compilationRunner.compile(testRepoPath, {
      packageManager: 'npm',
      buildCommand: 'build'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.compilationStatus, 'not_applicable');
    assert.strictEqual(result.exitCode, 0);
  });

  it('should skip compilation validation gracefully (Requirement 6.2)', async () => {
    const result = await compilationRunner.compile(testRepoPath, {
      packageManager: 'npm',
      buildCommand: 'build'
    });

    // Should complete quickly without attempting to run any build command
    assert.ok(result.duration < 1000, 'Should complete in less than 1 second');
    assert.strictEqual(result.success, true);
  });

  it('should log clear reason for skipping (Requirement 6.3)', async () => {
    const result = await compilationRunner.compile(testRepoPath, {
      packageManager: 'npm',
      buildCommand: 'build'
    });

    assert.ok(result.stdout.includes('No build script detected'));
    assert.ok(result.stdout.includes('Compilation not required'));
    assert.strictEqual(result.stderr, '');
  });

  it('should indicate in result that compilation was not applicable (Requirement 6.4)', async () => {
    const result = await compilationRunner.compile(testRepoPath, {
      packageManager: 'npm',
      buildCommand: 'build'
    });

    // The result should clearly indicate not_applicable status
    assert.strictEqual(result.compilationStatus, 'not_applicable');
    assert.strictEqual(result.success, true);
    
    // Should not have error output
    assert.strictEqual(result.stderr, '');
  });

  it('should handle repository with only test script (Requirement 6.5)', async () => {
    // Update package.json to have only a test script
    const packageJson = {
      name: 'test-no-build-system',
      version: '1.0.0',
      scripts: {
        test: 'echo "Running tests"',
        start: 'node index.js'
      }
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Should still detect no build system
    assert.strictEqual(buildConfig.hasBuildScript, false);
    assert.strictEqual(buildConfig.buildCommand, null);

    const result = await compilationRunner.compile(testRepoPath, {
      packageManager: 'npm',
      buildCommand: 'build'
    });

    assert.strictEqual(result.compilationStatus, 'not_applicable');
  });

  it('should handle repository with no scripts at all', async () => {
    // Update package.json to have no scripts section
    const packageJson = {
      name: 'test-no-build-system',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0'
      }
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const buildConfig = await detectBuildConfiguration(testRepoPath);

    assert.strictEqual(buildConfig.hasBuildScript, false);
    assert.strictEqual(buildConfig.buildCommand, null);

    const result = await compilationRunner.compile(testRepoPath, {
      packageManager: 'npm',
      buildCommand: 'build'
    });

    assert.strictEqual(result.compilationStatus, 'not_applicable');
    assert.strictEqual(result.success, true);
  });

  it('should handle repository with empty scripts object', async () => {
    // Update package.json to have empty scripts
    const packageJson = {
      name: 'test-no-build-system',
      version: '1.0.0',
      scripts: {}
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const buildConfig = await detectBuildConfiguration(testRepoPath);

    assert.strictEqual(buildConfig.hasBuildScript, false);

    const result = await compilationRunner.compile(testRepoPath, {
      packageManager: 'npm',
      buildCommand: 'build'
    });

    assert.strictEqual(result.compilationStatus, 'not_applicable');
  });
});
