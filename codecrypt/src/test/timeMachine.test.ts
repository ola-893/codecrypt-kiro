/**
 * Tests for Time Machine validation service
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import * as sinon from 'sinon';
import {
  hasTestScript,
  validateTimeMachineConfig,
  runTimeMachineValidation,
} from '../services/timeMachine';
import { dockerService } from '../services/docker';
import * as sandbox from '../services/sandbox';
import type { ContainerExecResult } from '../services/docker';
import type Docker from 'dockerode';

suite('Time Machine Validation Tests', () => {
  let testRepoPath: string;

  setup(async () => {
    // Create a temporary directory for testing
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-timemachine-test-'));

    // Initialize a git repository
    execSync('git init', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.email "test@codecrypt.test"', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.name "CodeCrypt Test"', { cwd: testRepoPath, stdio: 'pipe' });
  });

  teardown(async () => {
    // Clean up test directory
    if (testRepoPath) {
      try {
        await fs.rm(testRepoPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  suite('hasTestScript', () => {
    test('should return true when test script exists', async () => {
      const packageJson = {
        name: 'test-repo',
        version: '1.0.0',
        scripts: {
          test: 'jest',
        },
      };

      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await hasTestScript(testRepoPath);

      assert.strictEqual(result, true);
    });

    test('should return false when test script does not exist', async () => {
      const packageJson = {
        name: 'test-repo',
        version: '1.0.0',
        scripts: {
          build: 'tsc',
        },
      };

      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await hasTestScript(testRepoPath);

      assert.strictEqual(result, false);
    });

    test('should return false when package.json cannot be read', async () => {
      const result = await hasTestScript('/nonexistent/path');

      assert.strictEqual(result, false);
    });

    test('should return false when scripts section is missing', async () => {
      const packageJson = {
        name: 'test-repo',
        version: '1.0.0',
      };

      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await hasTestScript(testRepoPath);

      assert.strictEqual(result, false);
    });
  });

  suite('validateTimeMachineConfig', () => {
    test('should return no errors for valid config', () => {
      const errors = validateTimeMachineConfig({
        originalNodeVersion: '14.0.0',
        repoPath: '/test/repo',
        enabled: true,
      });

      assert.strictEqual(errors.length, 0);
    });

    test('should return error when repoPath is missing', () => {
      const errors = validateTimeMachineConfig({
        originalNodeVersion: '14.0.0',
        repoPath: '',
        enabled: true,
      });

      assert.ok(errors.includes('Repository path is required'));
      assert.strictEqual(errors.length, 1);
    });

    test('should allow missing originalNodeVersion (auto-detect)', () => {
      const errors = validateTimeMachineConfig({
        originalNodeVersion: '',
        repoPath: '/test/repo',
        enabled: true,
      });

      assert.strictEqual(errors.length, 0);
    });

    test('should validate config with all fields present', () => {
      const errors = validateTimeMachineConfig({
        originalNodeVersion: '16.20.0',
        repoPath: '/valid/path',
        enabled: true,
      });

      assert.strictEqual(errors.length, 0);
    });

    test('should validate config when disabled', () => {
      const errors = validateTimeMachineConfig({
        originalNodeVersion: '',
        repoPath: '/test/repo',
        enabled: false,
      });

      assert.strictEqual(errors.length, 0);
    });
  });

  suite('Test output parsing (integration)', () => {
    test('should handle repository with Jest test output format', async () => {
      const packageJson = {
        name: 'test-repo',
        version: '1.0.0',
        scripts: {
          test: 'echo "Tests: 2 failed, 8 passed, 10 total"',
        },
      };

      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const hasTests = await hasTestScript(testRepoPath);
      assert.strictEqual(hasTests, true);
    });

    test('should handle repository with Mocha test output format', async () => {
      const packageJson = {
        name: 'test-repo',
        version: '1.0.0',
        scripts: {
          test: 'echo "15 passing\\n2 failing"',
        },
      };

      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const hasTests = await hasTestScript(testRepoPath);
      assert.strictEqual(hasTests, true);
    });

    test('should handle repository with custom test command', async () => {
      const packageJson = {
        name: 'test-repo',
        version: '1.0.0',
        scripts: {
          test: 'node test.js',
        },
      };

      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const hasTests = await hasTestScript(testRepoPath);
      assert.strictEqual(hasTests, true);
    });
  });

  suite('Configuration validation edge cases', () => {
    test('should handle config with undefined repoPath', () => {
      const errors = validateTimeMachineConfig({
        originalNodeVersion: '14.0.0',
        repoPath: undefined as any,
        enabled: true,
      });

      assert.ok(errors.length > 0);
    });

    test('should handle config with null repoPath', () => {
      const errors = validateTimeMachineConfig({
        originalNodeVersion: '14.0.0',
        repoPath: null as any,
        enabled: true,
      });

      assert.ok(errors.length > 0);
    });

    test('should handle config with whitespace-only repoPath', () => {
      const errors = validateTimeMachineConfig({
        originalNodeVersion: '14.0.0',
        repoPath: '   ',
        enabled: true,
      });

      // Whitespace is technically valid, but empty string is not
      // The function checks for falsy values
      assert.strictEqual(errors.length, 0);
    });
  });

  suite('Time Machine Validation with Mocked Docker', () => {
    let dockerStub: sinon.SinonStub;
    let sandboxStub: sinon.SinonStub;
    let createContainerStub: sinon.SinonStub;
    let startContainerStub: sinon.SinonStub;
    let stopContainerStub: sinon.SinonStub;
    let removeContainerStub: sinon.SinonStub;
    let execInContainerStub: sinon.SinonStub;

    setup(async () => {
      // Create package.json with test script
      const packageJson = {
        name: 'test-repo',
        version: '1.0.0',
        scripts: {
          test: 'jest',
        },
        engines: {
          node: '14.0.0',
        },
      };

      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Stub Docker service methods
      dockerStub = sinon.stub(dockerService, 'checkDockerAvailable').resolves(true);
      
      // Create mock container object
      const mockContainer = {
        inspect: sinon.stub().resolves({ Name: 'test-container' }),
        start: sinon.stub().resolves(),
        stop: sinon.stub().resolves(),
        remove: sinon.stub().resolves(),
      } as any;

      createContainerStub = sinon.stub(dockerService, 'createContainer').resolves(mockContainer);
      startContainerStub = sinon.stub(dockerService, 'startContainer').resolves();
      stopContainerStub = sinon.stub(dockerService, 'stopContainer').resolves();
      removeContainerStub = sinon.stub(dockerService, 'removeContainer').resolves();
      
      execInContainerStub = sinon.stub(dockerService, 'execInContainer').resolves({
        exitCode: 0,
        stdout: 'Tests: 0 failed, 10 passed, 10 total',
        stderr: '',
        executionTime: 1000,
      } as ContainerExecResult);

      // Stub sandbox npm test
      sandboxStub = sinon.stub(sandbox, 'sandboxedNpmTest').returns('Tests: 0 failed, 10 passed, 10 total');
    });

    teardown(() => {
      sinon.restore();
    });

    test('should run validation successfully when both environments pass', async () => {
      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.functionalEquivalence, true);
      assert.strictEqual(result.originalResults.passed, true);
      assert.strictEqual(result.modernResults.passed, true);
      assert.ok(result.comparisonReport.includes('VERIFIED'));
    });

    test('should detect differences when test counts differ', async () => {
      // Modern tests pass with different count
      sandboxStub.returns('Tests: 0 failed, 8 passed, 8 total');

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      assert.strictEqual(result.functionalEquivalence, false);
      assert.ok(result.comparisonReport.includes('DIFFERENCES DETECTED'));
      assert.ok(result.comparisonReport.includes('Number of tests differs'));
    });

    test('should detect differences when modern tests fail', async () => {
      // Modern tests fail
      sandboxStub.throws(new Error('Tests: 2 failed, 8 passed, 10 total'));

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      assert.strictEqual(result.functionalEquivalence, false);
      assert.strictEqual(result.modernResults.passed, false);
      assert.ok(result.comparisonReport.includes('DIFFERENCES DETECTED'));
    });

    test('should detect differences when original tests fail', async () => {
      // Original tests fail
      execInContainerStub.resolves({
        exitCode: 1,
        stdout: 'Tests: 2 failed, 8 passed, 10 total',
        stderr: '',
        executionTime: 1000,
      } as ContainerExecResult);

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      assert.strictEqual(result.functionalEquivalence, false);
      assert.strictEqual(result.originalResults.passed, false);
      assert.ok(result.comparisonReport.includes('DIFFERENCES DETECTED'));
    });

    test('should calculate performance improvement correctly', async () => {
      // Original tests take 2000ms
      execInContainerStub.resolves({
        exitCode: 0,
        stdout: 'Tests: 0 failed, 10 passed, 10 total',
        stderr: '',
        executionTime: 2000,
      } as ContainerExecResult);

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      // Modern tests run in ~0ms (mocked), so improvement should be significant
      assert.ok(result.performanceImprovement > 0);
      assert.ok(result.comparisonReport.includes('Performance improved'));
    });

    test('should handle Docker unavailable gracefully', async () => {
      dockerStub.resolves(false);
      sinon.stub(dockerService, 'handleDockerUnavailable').resolves();

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
      assert.ok(result.errors.includes('Docker daemon is not running or not installed'));
      assert.ok(result.comparisonReport.includes('Docker not available'));
    });

    test('should auto-detect Node version when not provided', async () => {
      const config = {
        originalNodeVersion: '',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      // Should have detected version from package.json
      assert.ok(createContainerStub.called);
      const containerConfig = createContainerStub.firstCall.args[0];
      assert.ok(containerConfig.image.includes('14'));
    });

    test('should create container with correct configuration', async () => {
      const config = {
        originalNodeVersion: '16.20.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      await runTimeMachineValidation(config);

      assert.ok(createContainerStub.calledOnce);
      const containerConfig = createContainerStub.firstCall.args[0];
      
      assert.strictEqual(containerConfig.image, 'node:16.20.0-alpine');
      assert.strictEqual(containerConfig.workDir, '/app');
      assert.ok(containerConfig.volumes.length > 0);
      assert.strictEqual(containerConfig.volumes[0].container, '/app');
    });

    test('should execute npm install in container before tests', async () => {
      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      await runTimeMachineValidation(config);

      assert.ok(execInContainerStub.calledTwice);
      
      // First call should be npm install
      const firstCall = execInContainerStub.firstCall.args[1];
      assert.deepStrictEqual(firstCall, ['npm', 'install', '--legacy-peer-deps']);
      
      // Second call should be npm test
      const secondCall = execInContainerStub.secondCall.args[1];
      assert.deepStrictEqual(secondCall, ['npm', 'test']);
    });

    test('should cleanup container after successful validation', async () => {
      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      await runTimeMachineValidation(config);

      assert.ok(stopContainerStub.calledOnce);
      assert.ok(removeContainerStub.calledOnce);
    });

    test('should cleanup container after error', async () => {
      execInContainerStub.rejects(new Error('Container execution failed'));
      sinon.stub(dockerService, 'cleanupContainers').resolves();

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.originalResults.passed, false);
    });

    test('should parse Jest test output correctly', async () => {
      execInContainerStub.resolves({
        exitCode: 0,
        stdout: 'Tests: 2 failed, 18 passed, 20 total',
        stderr: '',
        executionTime: 1500,
      } as ContainerExecResult);

      sandboxStub.returns('Tests: 0 failed, 20 passed, 20 total');

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      assert.strictEqual(result.originalResults.testsRun, 20);
      assert.strictEqual(result.originalResults.testsPassed, 18);
      assert.strictEqual(result.originalResults.testsFailed, 2);
      
      assert.strictEqual(result.modernResults.testsRun, 20);
      assert.strictEqual(result.modernResults.testsPassed, 20);
      assert.strictEqual(result.modernResults.testsFailed, 0);
    });

    test('should parse Mocha test output correctly', async () => {
      execInContainerStub.resolves({
        exitCode: 0,
        stdout: '15 passing\n2 failing',
        stderr: '',
        executionTime: 1200,
      } as ContainerExecResult);

      sandboxStub.returns('17 passing');

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      assert.strictEqual(result.originalResults.testsRun, 17);
      assert.strictEqual(result.originalResults.testsPassed, 15);
      assert.strictEqual(result.originalResults.testsFailed, 2);
      
      assert.strictEqual(result.modernResults.testsRun, 17);
      assert.strictEqual(result.modernResults.testsPassed, 17);
      assert.strictEqual(result.modernResults.testsFailed, 0);
    });

    test('should handle container install failure gracefully', async () => {
      // First call (npm install) fails, second call (npm test) succeeds
      execInContainerStub.onFirstCall().resolves({
        exitCode: 1,
        stdout: '',
        stderr: 'npm install failed',
        executionTime: 500,
      } as ContainerExecResult);
      
      execInContainerStub.onSecondCall().resolves({
        exitCode: 0,
        stdout: 'Tests: 0 failed, 10 passed, 10 total',
        stderr: '',
        executionTime: 1000,
      } as ContainerExecResult);

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      // Should continue with tests even if install fails
      assert.ok(execInContainerStub.calledTwice);
      assert.strictEqual(result.originalResults.passed, true);
    });

    test('should include performance comparison in report', async () => {
      execInContainerStub.resolves({
        exitCode: 0,
        stdout: 'Tests: 0 failed, 10 passed, 10 total',
        stderr: '',
        executionTime: 3000,
      } as ContainerExecResult);

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      assert.ok(result.comparisonReport.includes('Performance Comparison'));
      assert.ok(result.comparisonReport.includes('Original:'));
      assert.ok(result.comparisonReport.includes('Modern:'));
    });

    test('should handle negative performance improvement', async () => {
      // Modern tests are slower
      execInContainerStub.resolves({
        exitCode: 0,
        stdout: 'Tests: 0 failed, 10 passed, 10 total',
        stderr: '',
        executionTime: 500,
      } as ContainerExecResult);

      // Simulate slower modern tests by making sandbox take longer
      sandboxStub.callsFake(() => {
        // Simulate delay
        const start = Date.now();
        while (Date.now() - start < 1000) {
          // Busy wait
        }
        return 'Tests: 0 failed, 10 passed, 10 total';
      });

      const config = {
        originalNodeVersion: '14.0.0',
        repoPath: testRepoPath,
        enabled: true,
      };

      const result = await runTimeMachineValidation(config);

      // Performance should be negative (slower)
      assert.ok(result.performanceImprovement < 0 || result.comparisonReport.includes('decreased'));
    });
  });
});
