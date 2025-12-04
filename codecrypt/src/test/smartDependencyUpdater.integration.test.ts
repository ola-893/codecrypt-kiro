import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SmartDependencyUpdaterImpl } from '../services/smartDependencyUpdater';
import { BlockingDependencyDetector } from '../services/blockingDependencyDetector';
import { URLValidator } from '../services/urlValidator';
import { BatchPlanner } from '../services/batchPlanner';
import { NpmBatchExecutor } from '../services/batchExecutor';
import { PackageReplacementRegistry } from '../services/packageReplacementRegistry';
import { PackageReplacementExecutor } from '../services/packageReplacementExecutor';
import { ResurrectionEvent, ResurrectionPlanItem, BlockingReason, PackageReplacement, ArchitectureIncompatibleEntry, PackageReplacement as PackageReplacementResult } from '../types';

suite('SmartDependencyUpdater Integration Tests', () => {
  let projectPath: string;
  let blockingDetectorStub: sinon.SinonStubbedInstance<BlockingDependencyDetector>;
  let urlValidatorStub: sinon.SinonStubbedInstance<URLValidator>;
  let batchPlannerStub: sinon.SinonStubbedInstance<BatchPlanner>;
  let batchExecutorStub: sinon.SinonStubbedInstance<NpmBatchExecutor>;
  let replacementRegistryStub: sinon.SinonStubbedInstance<PackageReplacementRegistry>;
  let replacementExecutorStub: sinon.SinonStubbedInstance<PackageReplacementExecutor>;
  let eventEmitterStub: any;
  let updater: SmartDependencyUpdaterImpl;

  setup(async () => {
    projectPath = await fs.mkdtemp(path.join('/tmp', 'smart-updater-test-'));

    blockingDetectorStub = sinon.createStubInstance(BlockingDependencyDetector);
    urlValidatorStub = sinon.createStubInstance(URLValidator);
    batchPlannerStub = sinon.createStubInstance(BatchPlanner);
    eventEmitterStub = {
      emit: sinon.stub(),
      on: sinon.stub(),
      emitNarration: sinon.stub(),
      emitASTAnalysisComplete: sinon.stub(),
      emitLLMInsight: sinon.stub(),
      emitValidationComplete: sinon.stub(),
      emitBaselineCompilationComplete: sinon.stub(),
      emitFinalCompilationComplete: sinon.stub(),
      emitResurrectionVerdict: sinon.stub(),
      emitTransformationApplied: sinon.stub(),
      emitDependencyUpdated: sinon.stub(),
      emitTestCompleted: sinon.stub(),
      emitMetricUpdated: sinon.stub(),
    };
    batchExecutorStub = sinon.createStubInstance(NpmBatchExecutor);
    (batchExecutorStub as any).execute.resolves();
    replacementRegistryStub = sinon.createStubInstance(PackageReplacementRegistry);
    replacementExecutorStub = sinon.createStubInstance(PackageReplacementExecutor);

    updater = new SmartDependencyUpdaterImpl(
      blockingDetectorStub,
      urlValidatorStub,
      batchPlannerStub,
      batchExecutorStub,
      replacementRegistryStub,
      replacementExecutorStub
    );

    // Configure the stub to return the expected blocking and dead URL dependencies
    blockingDetectorStub.detect.resolves([
      { name: 'blocking-pkg', version: '1.0.0', reason: 'architecture_incompatible' },
      { name: 'dead-url-pkg', version: 'http://dead.url/pkg.git', reason: 'dead_url' },
    ]);

    // Stub URLValidator methods
    urlValidatorStub.validate.resolves({
      url: 'http://dead.url/pkg.git',
      isValid: false,
      error: 'URL not accessible'
    });
    urlValidatorStub.extractPackageFromUrl.returns('dead-url-pkg');
    urlValidatorStub.findNpmAlternative.resolves(null);

    // Stub PackageReplacementRegistry methods
    replacementRegistryStub.lookup.withArgs('old-pkg').returns({
        oldName: 'old-pkg',
        newName: 'new-pkg',
        versionMapping: { '*': '3.0.0' },
        requiresCodeChanges: true,
    });
  });

  teardown(async () => {
    sinon.restore();
    await fs.rm(projectPath, { recursive: true, force: true });
  });

  test('should run end-to-end analysis and execution', async () => {
    const planItems: ResurrectionPlanItem[] = [
      { packageName: 'normal-pkg', currentVersion: '1.0.0', targetVersion: '1.1.0', priority: 50, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
      { packageName: 'blocking-pkg', currentVersion: '1.0.0', targetVersion: '2.0.0', priority: 100, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
      { packageName: 'dead-url-pkg', currentVersion: 'http://dead.url/pkg.git', targetVersion: '2.0.0', priority: 100, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
      { packageName: 'old-pkg', currentVersion: '1.0.0', targetVersion: '2.0.0', priority: 100, reason: '', fixesVulnerabilities: false, vulnerabilityCount: 0 },
    ];

    const expectedBatches = [
      {
        id: 'batch-1',
        packages: [planItems[0]],
        priority: 50,
        estimatedRisk: 'low' as 'low' | 'medium' | 'high',
      },
    ];
    batchPlannerStub.createBatches.returns(expectedBatches);

    const analysisResult = await updater.analyze(projectPath, planItems);

    assert.ok(blockingDetectorStub.detect.calledOnce, 'blockingDetector.detect should have been called once');
    assert.strictEqual(analysisResult.blockingDependencies.length, 2, 'Should detect two blocking dependencies');
    assert.strictEqual(analysisResult.deadUrls.length, 0, 'Should detect zero dead URLs');
    assert.strictEqual(analysisResult.replacements.length, 1, 'Should detect one package replacement');
    assert.deepStrictEqual(analysisResult.updateBatches, expectedBatches, 'Should return expected update batches');
  });
});
