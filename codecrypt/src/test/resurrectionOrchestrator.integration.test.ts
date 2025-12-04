import * as assert from 'assert';
import * as sinon from 'sinon';
import { ResurrectionOrchestrator } from '../services/resurrectionOrchestrator';
import { getEventEmitter, resetEventEmitter } from '../services/eventEmitter';
import { ResurrectionEvent, ResurrectionPlan, ResurrectionContext, ResurrectionConfig, DependencyReport } from '../types';
import { SmartDependencyUpdaterImpl } from '../services/smartDependencyUpdater';

suite('ResurrectionOrchestrator Integration Tests', () => {

  let orchestrator: ResurrectionOrchestrator;
  let eventEmitter: any;
  let smartDependencyUpdaterStub: sinon.SinonStubbedInstance<SmartDependencyUpdaterImpl>;
  let context: ResurrectionContext;
  let config: ResurrectionConfig;

  setup(() => {
    resetEventEmitter();
    eventEmitter = getEventEmitter();
    context = {
      repoUrl: 'test',
      isDead: false,
      dependencies: [],
      transformationLog: [],
      repoPath: '/fake/repo',
    };
    config = {
      strategy: 'conservative',
      createPullRequest: false,
      maxRetries: 3,
    };
    orchestrator = new ResurrectionOrchestrator(context, {
      ...config,
      enableSSE: false,
      enableLLM: false,
    });

    // Stub SmartDependencyUpdater
    smartDependencyUpdaterStub = sinon.createStubInstance(SmartDependencyUpdaterImpl);
  });

  teardown(() => {
    sinon.restore();
  });

  test('should execute resurrection plan and use SmartDependencyUpdater', async () => {
    const repoPath = '/fake/repo';
    const resurrectionPlan: ResurrectionPlan = {
      items: [
        { packageName: 'test-pkg', currentVersion: '1.0.0', targetVersion: '2.0.0', priority: 100, reason: 'test', fixesVulnerabilities: false, vulnerabilityCount: 0 },
      ],
      totalUpdates: 1,
      securityPatches: 0,
      strategy: 'conservative',
      generatedAt: new Date(),
    };

    // Configure stubs for SmartDependencyUpdater
    const analysisResult = {
      blockingDependencies: [],
      deadUrls: [],
      replacements: [],
      updateBatches: [],
      initialPlanItems: resurrectionPlan.items,
    };
    smartDependencyUpdaterStub.analyze.resolves(analysisResult);

    const executionResult = {
      overallSuccess: true,
      manualInterventionRequired: [],
      successfulUpdates: [],
      failedUpdates: [],
    };
    smartDependencyUpdaterStub.execute.resolves(executionResult);
    
    (orchestrator as any).state.smartDependencyUpdater = smartDependencyUpdaterStub;
    (orchestrator as any).state.context.resurrectionPlan = resurrectionPlan;


    // Execute the plan
    await orchestrator.executeResurrectionPlan({
      dependencies: [],
      totalDependencies: 0,
      outdatedDependencies: 0,
      vulnerableDependencies: 0,
      totalVulnerabilities: 0,
      generatedAt: new Date(),
    });

    // Assertions
    assert.ok(smartDependencyUpdaterStub.analyze.calledOnceWith(repoPath, resurrectionPlan.items), 'analyze should be called once with the correct arguments');
    assert.ok(smartDependencyUpdaterStub.execute.calledOnceWith(repoPath, analysisResult), 'execute should be called once with the correct arguments');
  });
});
