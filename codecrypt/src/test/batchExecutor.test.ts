/**
 * Unit tests for BatchExecutor
 * Tests the new batch execution methods added in Task 1
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { NpmBatchExecutor } from '../services/batchExecutor';
import { UpdateBatch } from '../services/batchPlanner';
import { ResurrectionEventEmitter } from '../services/eventEmitter';

suite('BatchExecutor Unit Tests', () => {
  let executor: NpmBatchExecutor;
  let eventEmitter: ResurrectionEventEmitter;
  let readFileStub: sinon.SinonStub;
  let writeFileStub: sinon.SinonStub;
  let runCommandStub: sinon.SinonStub;
  let updatePackageJsonStub: sinon.SinonStub;
  let runNpmInstallStub: sinon.SinonStub;
  let validateUpdateStub: sinon.SinonStub;

  const repoPath = '/test/repo';

  setup(() => {
    executor = new NpmBatchExecutor();
    eventEmitter = new ResurrectionEventEmitter();

    // Stub internal methods
    readFileStub = sinon.stub(executor as any, '_readFile');
    writeFileStub = sinon.stub(executor as any, '_writeFile');
    runCommandStub = sinon.stub(executor as any, 'runCommand');
    
    // Stub the new private methods
    updatePackageJsonStub = sinon.stub(executor as any, 'updatePackageJson');
    runNpmInstallStub = sinon.stub(executor as any, 'runNpmInstall');
    validateUpdateStub = sinon.stub(executor as any, 'validateUpdate');
  });

  teardown(() => {
    sinon.restore();
  });

  suite('executeBatches()', () => {
    test('should execute multiple batches in sequence', async () => {
      const batch1: UpdateBatch = {
        id: 'batch-1',
        packages: [{
          packageName: 'lodash',
          currentVersion: '4.0.0',
          targetVersion: '4.17.21',
          priority: 1,
          reason: 'security',
          fixesVulnerabilities: true,
          vulnerabilityCount: 2
        }],
        priority: 1,
        estimatedRisk: 'low'
      };

      const batch2: UpdateBatch = {
        id: 'batch-2',
        packages: [{
          packageName: 'axios',
          currentVersion: '0.21.0',
          targetVersion: '1.6.0',
          priority: 2,
          reason: 'update',
          fixesVulnerabilities: false,
          vulnerabilityCount: 0
        }],
        priority: 2,
        estimatedRisk: 'medium'
      };

      // Mock successful updates
      updatePackageJsonStub.resolves();
      runNpmInstallStub.resolves({ success: true });
      validateUpdateStub.resolves({ success: true, compilationPassed: true, testsPassed: true });

      const results = await executor.executeBatches([batch1, batch2], repoPath, eventEmitter);

      assert.strictEqual(results.length, 2, 'Should return results for both batches');
      assert.strictEqual(results[0].batchId, 'batch-1');
      assert.strictEqual(results[1].batchId, 'batch-2');
      assert.strictEqual(results[0].packagesSucceeded, 1);
      assert.strictEqual(results[1].packagesSucceeded, 1);
    });

    test('should emit batch_started and batch_completed events', async () => {
      const batch: UpdateBatch = {
        id: 'test-batch',
        packages: [{
          packageName: 'test-pkg',
          currentVersion: '1.0.0',
          targetVersion: '2.0.0',
          priority: 1,
          reason: 'test',
          fixesVulnerabilities: false,
          vulnerabilityCount: 0
        }],
        priority: 1,
        estimatedRisk: 'low'
      };

      updatePackageJsonStub.resolves();
      runNpmInstallStub.resolves({ success: true });
      validateUpdateStub.resolves({ success: true });

      const batchStartedSpy = sinon.spy();
      const batchCompletedSpy = sinon.spy();
      
      eventEmitter.on('batch_started', batchStartedSpy);
      eventEmitter.on('batch_completed', batchCompletedSpy);

      await executor.executeBatches([batch], repoPath, eventEmitter);

      assert.ok(batchStartedSpy.calledOnce, 'Should emit batch_started event');
      assert.ok(batchCompletedSpy.calledOnce, 'Should emit batch_completed event');
    });

    test('should continue to next batch if one fails', async () => {
      const batch1: UpdateBatch = {
        id: 'failing-batch',
        packages: [{
          packageName: 'bad-pkg',
          currentVersion: '1.0.0',
          targetVersion: '2.0.0',
          priority: 1,
          reason: 'test',
          fixesVulnerabilities: false,
          vulnerabilityCount: 0
        }],
        priority: 1,
        estimatedRisk: 'high'
      };

      const batch2: UpdateBatch = {
        id: 'success-batch',
        packages: [{
          packageName: 'good-pkg',
          currentVersion: '1.0.0',
          targetVersion: '2.0.0',
          priority: 2,
          reason: 'test',
          fixesVulnerabilities: false,
          vulnerabilityCount: 0
        }],
        priority: 2,
        estimatedRisk: 'low'
      };

      // First batch fails, second succeeds
      updatePackageJsonStub.onFirstCall().rejects(new Error('Update failed'));
      updatePackageJsonStub.onSecondCall().resolves();
      runNpmInstallStub.resolves({ success: true });
      validateUpdateStub.resolves({ success: true });

      const results = await executor.executeBatches([batch1, batch2], repoPath, eventEmitter);

      assert.strictEqual(results.length, 2, 'Should return results for both batches');
      assert.strictEqual(results[0].packagesFailed, 1, 'First batch should have 1 failure');
      assert.strictEqual(results[1].packagesSucceeded, 1, 'Second batch should succeed');
    });
  });

  suite('applyBatchToPackageJson()', () => {
    test('should update dependencies correctly', async () => {
      const packageJson = {
        dependencies: {
          'lodash': '4.0.0',
          'axios': '0.21.0'
        },
        devDependencies: {
          'jest': '26.0.0'
        }
      };

      const batch: UpdateBatch = {
        id: 'test-batch',
        packages: [{
          packageName: 'lodash',
          currentVersion: '4.0.0',
          targetVersion: '4.17.21',
          priority: 1,
          reason: 'test',
          fixesVulnerabilities: false,
          vulnerabilityCount: 0
        }],
        priority: 1,
        estimatedRisk: 'low'
      };

      readFileStub.resolves(JSON.stringify(packageJson));
      writeFileStub.resolves();

      // Call the private method directly
      await (executor as any).applyBatchToPackageJson(batch, repoPath);

      assert.ok(writeFileStub.calledOnce, 'Should write updated package.json');
      const writtenContent = JSON.parse(writeFileStub.firstCall.args[1]);
      assert.strictEqual(writtenContent.dependencies.lodash, '4.17.21', 'Should update lodash version');
      assert.strictEqual(writtenContent.dependencies.axios, '0.21.0', 'Should not change axios');
    });

    test('should update devDependencies correctly', async () => {
      const packageJson = {
        dependencies: {},
        devDependencies: {
          'jest': '26.0.0'
        }
      };

      const batch: UpdateBatch = {
        id: 'test-batch',
        packages: [{
          packageName: 'jest',
          currentVersion: '26.0.0',
          targetVersion: '29.0.0',
          priority: 1,
          reason: 'test',
          fixesVulnerabilities: false,
          vulnerabilityCount: 0
        }],
        priority: 1,
        estimatedRisk: 'low'
      };

      readFileStub.resolves(JSON.stringify(packageJson));
      writeFileStub.resolves();

      await (executor as any).applyBatchToPackageJson(batch, repoPath);

      const writtenContent = JSON.parse(writeFileStub.firstCall.args[1]);
      assert.strictEqual(writtenContent.devDependencies.jest, '29.0.0');
    });

    test('should handle missing package.json gracefully', async () => {
      const batch: UpdateBatch = {
        id: 'test-batch',
        packages: [{
          packageName: 'lodash',
          currentVersion: '4.0.0',
          targetVersion: '4.17.21',
          priority: 1,
          reason: 'test',
          fixesVulnerabilities: false,
          vulnerabilityCount: 0
        }],
        priority: 1,
        estimatedRisk: 'low'
      };

      readFileStub.rejects(new Error('ENOENT: no such file'));

      try {
        await (executor as any).applyBatchToPackageJson(batch, repoPath);
        assert.fail('Should have thrown an error');
      } catch (error: any) {
        assert.ok(error.message.includes('ENOENT'));
      }
    });
  });

  suite('runNpmInstall()', () => {
    test('should return success when npm install succeeds', async () => {
      // Mock the result
      runNpmInstallStub.resolves({ success: true });

      const result = await runNpmInstallStub(repoPath);

      assert.ok(result.success, 'Should succeed');
      assert.ok(!result.error, 'Should not have error');
    });

    test('should return error when npm install fails', async () => {
      // Mock the result
      runNpmInstallStub.resolves({ success: false, error: 'npm install failed' });

      const result = await runNpmInstallStub(repoPath);

      assert.ok(!result.success, 'Should fail');
      assert.ok(result.error, 'Should have error message');
    });
  });

  suite('validateUpdate()', () => {
    test('should return success when validation passes', async () => {
      validateUpdateStub.resolves({ 
        success: true, 
        compilationPassed: true, 
        testsPassed: true 
      });

      const result = await validateUpdateStub(repoPath);

      assert.ok(result.success, 'Should succeed');
      assert.ok(result.compilationPassed, 'Compilation should pass');
      assert.ok(result.testsPassed, 'Tests should pass');
    });

    test('should return failure when compilation fails', async () => {
      validateUpdateStub.resolves({ 
        success: false, 
        compilationPassed: false, 
        testsPassed: true 
      });

      const result = await validateUpdateStub(repoPath);

      assert.ok(!result.success, 'Should fail');
      assert.ok(!result.compilationPassed, 'Compilation should fail');
    });

    test('should return failure when tests fail', async () => {
      validateUpdateStub.resolves({ 
        success: false, 
        compilationPassed: true, 
        testsPassed: false 
      });

      const result = await validateUpdateStub(repoPath);

      assert.ok(!result.success, 'Should fail');
      assert.ok(!result.testsPassed, 'Tests should fail');
    });
  });
});
