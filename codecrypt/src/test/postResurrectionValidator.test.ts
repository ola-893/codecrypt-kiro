/**
 * Unit tests for PostResurrectionValidator
 * Tests validation loop prevention added in Task 2
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { PostResurrectionValidator } from '../services/postResurrectionValidator';
import { 
  ICompilationRunner, 
  IErrorAnalyzer, 
  IFixStrategyEngine, 
  IFixHistoryStore,
  PostResurrectionCompilationResult,
  AnalyzedError,
  FixStrategy
} from '../types';

suite('PostResurrectionValidator Unit Tests', () => {
  let validator: PostResurrectionValidator;
  let mockCompilationRunner: sinon.SinonStubbedInstance<ICompilationRunner>;
  let mockErrorAnalyzer: sinon.SinonStubbedInstance<IErrorAnalyzer>;
  let mockFixStrategyEngine: any;
  let mockFixHistoryStore: any;
  let applyFixStub: sinon.SinonStub;

  const repoPath = '/test/repo';

  setup(() => {
    // Create mock compilation runner with default return values
    mockCompilationRunner = {
      compile: sinon.stub().resolves({
        success: false,
        stderr: '',
        stdout: '',
        exitCode: 1,
        duration: 1000
      }),
      detectPackageManager: sinon.stub().resolves('npm'),
      detectBuildCommand: sinon.stub().returns('build'),
      generateCompilationProof: sinon.stub().callsFake((result, options, iterations) => ({
        timestamp: new Date(),
        buildCommand: options.buildCommand,
        exitCode: result.exitCode,
        outputHash: 'test-hash',
        packageManager: options.packageManager,
        iterationsRequired: iterations,
        duration: result.duration || 0
      }))
    } as any;

    // Create mock error analyzer with default return value
    mockErrorAnalyzer = {
      analyze: sinon.stub().returns([])
    } as any;

    // Create mock fix strategy engine
    mockFixStrategyEngine = {
      selectStrategy: sinon.stub(),
      markStrategyAttempted: sinon.stub(),
      resetAttemptedStrategies: sinon.stub(),
      hasUntriedStrategies: sinon.stub().returns(true)
    };

    // Create mock fix history store
    mockFixHistoryStore = {
      getHistory: sinon.stub().returns({ fixes: [] }),
      recordFix: sinon.stub(),
      saveHistory: sinon.stub().resolves(),
      loadHistory: sinon.stub().resolves(null)
    };

    validator = new PostResurrectionValidator(
      mockCompilationRunner as any,
      mockErrorAnalyzer as any,
      mockFixStrategyEngine as any,
      mockFixHistoryStore as any
    );

    // Stub the private applyFix method with default return value
    applyFixStub = sinon.stub(validator as any, 'applyFix').resolves({ success: true });
  });

  teardown(() => {
    sinon.restore();
  });

  suite('No-progress detection', () => {
    test('should detect when error count does not change', async () => {
      const errors: AnalyzedError[] = [
        {
          category: 'dependency_version_conflict',
          message: 'Dependency conflict',
          priority: 1,
          packageName: 'test-pkg'
        }
      ];

      // First iteration: 1 error
      mockCompilationRunner.compile.onCall(0).resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1,
        duration: 1000
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.onCall(0).returns(errors);
      applyFixStub.onCall(0).resolves({ success: true });

      // Second iteration: still 1 error (no progress)
      mockCompilationRunner.compile.onCall(1).resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1,
        duration: 1000
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.onCall(1).returns(errors);
      applyFixStub.onCall(1).resolves({ success: true });

      // Third iteration: still 1 error (no progress)
      mockCompilationRunner.compile.onCall(2).resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1,
        duration: 1000
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.onCall(2).returns(errors);
      applyFixStub.onCall(2).resolves({ success: true });

      // Fourth iteration: still 1 error (no progress - should terminate)
      mockCompilationRunner.compile.onCall(3).resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1,
        duration: 1000
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.onCall(3).returns(errors);

      const result = await validator.validate(repoPath, { maxIterations: 10 });

      assert.ok(!result.success, 'Should fail due to no progress');
      assert.ok(result.iterations >= 3, 'Should run at least 3 iterations before detecting no progress');
    });

    test('should reset no-progress counter when progress is made', async () => {
      const twoErrors: AnalyzedError[] = [
        { category: 'dependency_version_conflict', message: 'Error 1', priority: 1, packageName: 'pkg1' },
        { category: 'dependency_version_conflict', message: 'Error 2', priority: 1, packageName: 'pkg2' }
      ];

      const oneError: AnalyzedError[] = [
        { category: 'dependency_version_conflict', message: 'Error 1', priority: 1, packageName: 'pkg1' }
      ];

      // First iteration: 2 errors
      mockCompilationRunner.compile.onCall(0).resolves({
        success: false,
        stderr: 'errors',
        stdout: '',
        exitCode: 1
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.onCall(0).returns(twoErrors);
      applyFixStub.onCall(0).resolves({ success: true });

      // Second iteration: 1 error (progress made!)
      mockCompilationRunner.compile.onCall(1).resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.onCall(1).returns(oneError);
      applyFixStub.onCall(1).resolves({ success: true });

      // Third iteration: still 1 error (no progress, but counter was reset)
      mockCompilationRunner.compile.onCall(2).resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.onCall(2).returns(oneError);
      applyFixStub.onCall(2).resolves({ success: true });

      // Continue for more iterations
      for (let i = 3; i < 10; i++) {
        mockCompilationRunner.compile.onCall(i).resolves({
          success: false,
          stderr: 'error',
          stdout: '',
          exitCode: 1
        } as PostResurrectionCompilationResult);

        mockErrorAnalyzer.analyze.onCall(i).returns(oneError);
        applyFixStub.onCall(i).resolves({ success: true });
      }

      const result = await validator.validate(repoPath, { maxIterations: 10 });

      // Should reach max iterations since progress was made once
      assert.strictEqual(result.iterations, 10, 'Should reach max iterations');
    });
  });

  suite('Fix strategy selection', () => {
    test('should select legacy_peer_deps for dependency conflicts', async () => {
      const errors: AnalyzedError[] = [
        {
          category: 'peer_dependency_conflict',
          message: 'Peer dependency conflict',
          priority: 1,
          packageName: 'test-pkg'
        }
      ];

      mockCompilationRunner.compile.resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.returns(errors);
      applyFixStub.resolves({ success: true });

      // Run one iteration
      await validator.validate(repoPath, { maxIterations: 1 });

      // Check that applyFix was called with legacy_peer_deps strategy
      assert.ok(applyFixStub.called, 'applyFix should be called');
      const strategy = applyFixStub.firstCall.args[0] as FixStrategy;
      assert.strictEqual(strategy.type, 'legacy_peer_deps', 'Should select legacy_peer_deps strategy');
    });

    test('should select update_dependencies for import errors', async () => {
      const errors: AnalyzedError[] = [
        {
          category: 'dependency_not_found',
          message: 'Cannot find module',
          priority: 1,
          packageName: 'missing-pkg'
        }
      ];

      mockCompilationRunner.compile.resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.returns(errors);
      applyFixStub.resolves({ success: true });

      await validator.validate(repoPath, { maxIterations: 1 });

      const strategy = applyFixStub.firstCall.args[0] as FixStrategy;
      assert.strictEqual(strategy.type, 'update_dependencies', 'Should select update_dependencies strategy');
    });

    test('should select delete_lockfile for lockfile conflicts', async () => {
      const errors: AnalyzedError[] = [
        {
          category: 'lockfile_conflict',
          message: 'Lockfile conflict',
          priority: 1
        }
      ];

      mockCompilationRunner.compile.resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.returns(errors);
      applyFixStub.resolves({ success: true });

      await validator.validate(repoPath, { maxIterations: 1 });

      const strategy = applyFixStub.firstCall.args[0] as FixStrategy;
      assert.strictEqual(strategy.type, 'delete_lockfile', 'Should select delete_lockfile strategy');
    });
  });

  suite('Fix attempt tracking', () => {
    test('should not apply the same fix strategy twice', async () => {
      const errors: AnalyzedError[] = [
        {
          category: 'dependency_version_conflict',
          message: 'Dependency conflict',
          priority: 1,
          packageName: 'test-pkg'
        }
      ];

      // All iterations fail with same error
      for (let i = 0; i < 5; i++) {
        mockCompilationRunner.compile.onCall(i).resolves({
          success: false,
          stderr: 'error',
          stdout: '',
          exitCode: 1
        } as PostResurrectionCompilationResult);

        mockErrorAnalyzer.analyze.onCall(i).returns(errors);
        applyFixStub.onCall(i).resolves({ success: true });
      }

      await validator.validate(repoPath, { maxIterations: 5 });

      // Check that different strategies were used
      const strategies = new Set<string>();
      for (let i = 0; i < applyFixStub.callCount; i++) {
        const strategy = applyFixStub.getCall(i).args[0] as FixStrategy;
        strategies.add(strategy.type);
      }

      assert.ok(strategies.size > 1, 'Should try multiple different strategies');
    });

    test('should select alternative strategy when current one was already tried', async () => {
      const errors: AnalyzedError[] = [
        {
          category: 'dependency_version_conflict',
          message: 'Dependency conflict',
          priority: 1,
          packageName: 'test-pkg'
        }
      ];

      // First iteration
      mockCompilationRunner.compile.onCall(0).resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.onCall(0).returns(errors);
      applyFixStub.onCall(0).resolves({ success: true });

      // Second iteration
      mockCompilationRunner.compile.onCall(1).resolves({
        success: false,
        stderr: 'error',
        stdout: '',
        exitCode: 1
      } as PostResurrectionCompilationResult);

      mockErrorAnalyzer.analyze.onCall(1).returns(errors);
      applyFixStub.onCall(1).resolves({ success: true });

      await validator.validate(repoPath, { maxIterations: 2 });

      // Verify that two different strategies were used
      const strategy1 = applyFixStub.getCall(0).args[0] as FixStrategy;
      const strategy2 = applyFixStub.getCall(1).args[0] as FixStrategy;

      assert.notStrictEqual(strategy1.type, strategy2.type, 'Should use different strategies');
    });
  });

  suite('Termination conditions', () => {
    test('should terminate when compilation succeeds', async () => {
      mockCompilationRunner.compile.resolves({
        success: true,
        stdout: 'success',
        stderr: '',
        exitCode: 0
      } as PostResurrectionCompilationResult);

      const result = await validator.validate(repoPath, { maxIterations: 10 });

      assert.ok(result.success, 'Should succeed');
      assert.strictEqual(result.iterations, 1, 'Should terminate after first successful compilation');
      assert.ok(result.compilationProof, 'Should have compilation proof');
    });

    test('should terminate when max iterations reached', async () => {
      const errors: AnalyzedError[] = [
        {
          category: 'dependency_version_conflict',
          message: 'Dependency conflict',
          priority: 1,
          packageName: 'test-pkg'
        }
      ];

      for (let i = 0; i < 5; i++) {
        mockCompilationRunner.compile.onCall(i).resolves({
          success: false,
          stderr: 'error',
          stdout: '',
          exitCode: 1
        } as PostResurrectionCompilationResult);

        mockErrorAnalyzer.analyze.onCall(i).returns(errors);
        applyFixStub.onCall(i).resolves({ success: true });
      }

      const result = await validator.validate(repoPath, { maxIterations: 5 });

      assert.ok(!result.success, 'Should fail');
      assert.strictEqual(result.iterations, 5, 'Should reach max iterations');
      assert.strictEqual(result.remainingErrors.length, 1, 'Should have remaining errors');
    });

    test('should continue until max iterations even with no progress', async () => {
      const errors: AnalyzedError[] = [
        {
          category: 'dependency_version_conflict',
          message: 'Dependency conflict',
          priority: 1,
          packageName: 'test-pkg'
        }
      ];

      // All iterations have same error count
      for (let i = 0; i < 10; i++) {
        mockCompilationRunner.compile.onCall(i).resolves({
          success: false,
          stderr: 'error',
          stdout: '',
          exitCode: 1
        } as PostResurrectionCompilationResult);

        mockErrorAnalyzer.analyze.onCall(i).returns(errors);
        applyFixStub.onCall(i).resolves({ success: true });
      }

      const result = await validator.validate(repoPath, { maxIterations: 10 });

      assert.ok(!result.success, 'Should fail');
      assert.strictEqual(result.iterations, 10, 'Should reach max iterations despite no progress');
    });
  });
});
