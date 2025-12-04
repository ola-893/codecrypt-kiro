import {
  IBlockingDependencyDetector,
  BlockingDependency,
  IURLValidator,
  URLValidationResult,
  IPackageReplacementRegistry,
  PackageReplacement,
  ResurrectionPlanItem,
} from '../types';
import { BatchPlanner, UpdateBatch, IBatchPlanner } from '../services/batchPlanner';
import { BatchExecutor, BatchExecutionResult } from '../services/batchExecutor';
import {
  PackageReplacementExecutor,
  PackageReplacementResult,
  IPackageReplacementExecutor,
} from '../services/packageReplacementExecutor';
import { NpmInstallError, NpmErrorType } from '../utils/errors';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { SmartDependencyUpdaterImpl } from '../services/smartDependencyUpdater';

suite('SmartDependencyUpdater Unit Tests', () => {
  let blockingDetectorStub: sinon.SinonStubbedInstance<IBlockingDependencyDetector>;
  let urlValidatorStub: sinon.SinonStubbedInstance<IURLValidator>;
  let batchPlannerStub: sinon.SinonStubbedInstance<BatchPlanner>;
  let batchExecutorStub: sinon.SinonStubbedInstance<BatchExecutor>;
  let replacementRegistryStub: sinon.SinonStubbedInstance<IPackageReplacementRegistry>;
  let replacementExecutorStub: sinon.SinonStubbedInstance<IPackageReplacementExecutor>;
  let updater: SmartDependencyUpdaterImpl;

  setup(() => {
    blockingDetectorStub = {
      isKnownBlocking: sinon.stub(),
      getBlockingReason: sinon.stub(),
      detect: sinon.stub().resolves([]),
    } as sinon.SinonStubbedInstance<IBlockingDependencyDetector>;
    urlValidatorStub = {
      validate: sinon.stub(),
      findNpmAlternative: sinon.stub(),
      extractPackageFromUrl: sinon.stub(),
    };
    batchPlannerStub = sinon.createStubInstance(BatchPlanner);
    batchExecutorStub = {
      execute: sinon.stub(),
      executeWithFallback: sinon.stub(),
    };
    replacementRegistryStub = {
      load: sinon.stub(),
      save: sinon.stub(),
      lookup: sinon.stub(),
      add: sinon.stub(),
      getAll: sinon.stub(),
    };
    replacementExecutorStub = sinon.createStubInstance(PackageReplacementExecutor);
    replacementExecutorStub.executeReplacement.resolves([]);

    updater = new SmartDependencyUpdaterImpl(
      blockingDetectorStub,
      urlValidatorStub,
      batchPlannerStub,
      batchExecutorStub,
      replacementRegistryStub,
      replacementExecutorStub
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('analyze should identify blocking dependencies', async () => {
    const projectPath = '/test/project';
    const planItems: ResurrectionPlanItem[] = [
      { packageName: 'blocking-pkg', currentVersion: '1.0.0', targetVersion: '2.0.0', priority: 100, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
      { packageName: 'normal-pkg', currentVersion: '1.0.0', targetVersion: '1.1.0', priority: 50, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
    ];

    blockingDetectorStub.detect.withArgs(sinon.match.any).resolves([
      { name: 'blocking-pkg', version: '1.0.0', reason: 'architecture_incompatible', replacement: { oldName: 'blocking-pkg', newName: 'replacement-pkg', versionMapping: { '*': '3.0.0' }, requiresCodeChanges: true } },
    ]);
    blockingDetectorStub.isKnownBlocking.withArgs('blocking-pkg').returns(true);
    blockingDetectorStub.getBlockingReason.withArgs('blocking-pkg').returns('architecture_incompatible');
    replacementRegistryStub.lookup.withArgs('blocking-pkg').returns({
      oldName: 'blocking-pkg',
      newName: 'replacement-pkg',
      versionMapping: { '*': '3.0.0' },
      requiresCodeChanges: true,
    });
    batchPlannerStub.createBatches.returns([{
      id: 'batch-1',
      packages: [planItems[1]],
      priority: 100,
      estimatedRisk: 'high',
    }]);

    const result = await updater.analyze(projectPath, planItems);

    assert.strictEqual(result.blockingDependencies.length, 1);
    assert.strictEqual(result.blockingDependencies[0].name, 'blocking-pkg');
    assert.strictEqual(result.blockingDependencies[0].reason, 'architecture_incompatible');
    assert.strictEqual(result.blockingDependencies[0].replacement?.newName, 'replacement-pkg');
    assert.strictEqual(result.updateBatches.length, 1);
  });

  test('analyze should identify dead URLs', async () => {
    const projectPath = '/test/project';
    const planItems: ResurrectionPlanItem[] = [
      { packageName: 'http://dead.url/pkg', currentVersion: '1.0.0', targetVersion: '2.0.0', priority: 100, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
      { packageName: 'normal-pkg', currentVersion: '1.0.0', targetVersion: '1.1.0', priority: 50, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
    ];

    urlValidatorStub.validate.withArgs('http://dead.url/pkg').resolves({
      url: 'http://dead.url/pkg',
      isValid: false,
      statusCode: 404,
      error: 'Not Found',
    });
    batchPlannerStub.createBatches.returns([{
      id: 'batch-1',
      packages: planItems,
      priority: 100,
      estimatedRisk: 'high',
    }]);

    const result = await updater.analyze(projectPath, planItems);

    assert.strictEqual(result.deadUrls.length, 1);
    assert.strictEqual(result.deadUrls[0].url, 'http://dead.url/pkg');
    assert.strictEqual(result.deadUrls[0].isValid, false);
    assert.strictEqual(result.updateBatches.length, 1);
  });

  test('analyze should identify package replacements', async () => {
    const projectPath = '/test/project';
    const planItems: ResurrectionPlanItem[] = [
      { packageName: 'old-pkg', currentVersion: '1.0.0', targetVersion: '2.0.0', priority: 100, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
      { packageName: 'normal-pkg', currentVersion: '1.0.0', targetVersion: '1.1.0', priority: 50, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
    ];

    replacementRegistryStub.lookup.withArgs('old-pkg').returns({
      oldName: 'old-pkg',
      newName: 'new-pkg',
      versionMapping: { '*': '3.0.0' },
      requiresCodeChanges: true,
    });
    batchPlannerStub.createBatches.returns([{
      id: 'batch-1',
      packages: planItems,
      priority: 100,
      estimatedRisk: 'high',
    }]);

    const result = await updater.analyze(projectPath, planItems);

    assert.strictEqual(result.replacements.length, 1);
    assert.strictEqual(result.replacements[0].oldName, 'old-pkg');
    assert.strictEqual(result.replacements[0].newName, 'new-pkg');
    assert.strictEqual(result.updateBatches.length, 1);
  });

  test('execute should apply replacements and execute batches', async () => {
    const projectPath = '/test/project';
    const planItems: ResurrectionPlanItem[] = [
      { packageName: 'old-pkg', currentVersion: '1.0.0', targetVersion: '2.0.0', priority: 100, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
      { packageName: 'normal-pkg', currentVersion: '1.0.0', targetVersion: '1.1.0', priority: 50, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
    ];
    const replacements: PackageReplacement[] = [
      {
        oldName: 'old-pkg',
        newName: 'new-pkg',
        versionMapping: { '*': '3.0.0' },
        requiresCodeChanges: true,
        codeChangeDescription: 'manual code changes',
        importMappings: {},
      },
    ];
    const updateBatches: UpdateBatch[] = [
      {
        id: 'batch-1',
        packages: [planItems[1]], // Only normal-pkg for this batch
        priority: 50,
        estimatedRisk: 'low',
      },
    ];

    const analysisResult = {
      blockingDependencies: [],
      deadUrls: [],
      replacements,
      updateBatches,
      initialPlanItems: planItems,
    };

    replacementExecutorStub.executeReplacement.withArgs(replacements).resolves([
      { packageName: 'new-pkg', oldVersion: '1.0.0', newVersion: '3.0.0', requiresManualReview: true },
    ]);

    batchExecutorStub.executeWithFallback.withArgs(updateBatches[0], projectPath).resolves({
      batch: updateBatches[0],
      success: true,
      log: 'npm install successful',
    } as BatchExecutionResult);

    const result = await updater.execute(projectPath, analysisResult);

    assert.ok(result.overallSuccess, 'Overall execution should be successful');
    assert.strictEqual(result.manualInterventionRequired.length, 1);
    assert.strictEqual(result.manualInterventionRequired[0].packageName, 'new-pkg');
    assert.strictEqual(result.successfulUpdates.length, 1);
    assert.strictEqual(result.successfulUpdates[0].packageName, 'normal-pkg');
    assert.strictEqual(result.failedUpdates.length, 0);
  });

  test('execute should handle batch failures', async () => {
    const projectPath = '/test/project';
    const planItems: ResurrectionPlanItem[] = [
      { packageName: 'failing-pkg', currentVersion: '1.0.0', targetVersion: '2.0.0', priority: 100, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
    ];
    const updateBatches: UpdateBatch[] = [
      {
        id: 'batch-1',
        packages: [planItems[0]],
        priority: 100,
        estimatedRisk: 'high',
      },
    ];

    const analysisResult = {
      blockingDependencies: [],
      deadUrls: [],
      replacements: [],
      updateBatches,
      initialPlanItems: planItems,
    };

    batchExecutorStub.executeWithFallback.withArgs(updateBatches[0], projectPath).resolves({
      batch: updateBatches[0],
      success: false,
      log: 'npm install failed',
      error: { errorType: NpmErrorType.Unknown, message: 'Install error' },
    } as BatchExecutionResult);

    const result = await updater.execute(projectPath, analysisResult);

    assert.ok(!result.overallSuccess, 'Overall execution should not be successful');
    assert.strictEqual(result.manualInterventionRequired.length, 0);
    assert.strictEqual(result.successfulUpdates.length, 0);
    assert.strictEqual(result.failedUpdates.length, 1);
    assert.strictEqual(result.failedUpdates[0].item.packageName, 'failing-pkg');
    assert.strictEqual(result.failedUpdates[0].error, 'Install error');
  });

  test('execute should handle manual intervention from replacements', async () => {
    const projectPath = '/test/project';
    const planItems: ResurrectionPlanItem[] = [];
    const replacements: PackageReplacement[] = [
      {
        oldName: 'old-pkg',
        newName: 'new-pkg',
        versionMapping: { '*': '3.0.0' },
        requiresCodeChanges: true,
        codeChangeDescription: 'manual code changes for old-pkg',
        importMappings: {},
      },
      {
        oldName: 'another-old-pkg',
        newName: 'another-new-pkg',
        versionMapping: { '*': '4.0.0' },
        requiresCodeChanges: false,
        codeChangeDescription: undefined,
        importMappings: {},
      },
    ];
    const updateBatches: UpdateBatch[] = [];

    const analysisResult = {
      blockingDependencies: [],
      deadUrls: [],
      replacements,
      updateBatches,
      initialPlanItems: planItems,
    };

    replacementExecutorStub.executeReplacement.withArgs(replacements).resolves([
      { packageName: 'new-pkg', oldVersion: '1.0.0', newVersion: '3.0.0', requiresManualReview: true },
      { packageName: 'another-new-pkg', oldVersion: '1.0.0', newVersion: '4.0.0', requiresManualReview: false },
    ]);

    const result = await updater.execute(projectPath, analysisResult);

    assert.ok(result.overallSuccess, 'Overall execution should be successful');
    assert.strictEqual(result.manualInterventionRequired.length, 1);
    assert.strictEqual(result.manualInterventionRequired[0].packageName, 'new-pkg');
    assert.strictEqual(result.successfulUpdates.length, 0);
    assert.strictEqual(result.failedUpdates.length, 0);
  });
});