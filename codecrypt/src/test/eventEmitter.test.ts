/**
 * Tests for the ResurrectionEventEmitter
 */

import * as assert from 'assert';
import {
  ResurrectionEventEmitter,
  getEventEmitter,
  resetEventEmitter,
  disposeEventEmitter,
} from '../services/eventEmitter';
import {
  TransformationAppliedEventData,
  DependencyUpdatedEventData,
  TestCompletedEventData,
  MetricUpdatedEventData,
  NarrationEventData,
  ASTAnalysisCompleteEventData,
  LLMInsightEventData,
  ValidationCompleteEventData,
  BaselineCompilationCompleteEventData,
  FinalCompilationCompleteEventData,
  ResurrectionVerdictEventData,
} from '../types';

suite('ResurrectionEventEmitter Test Suite', () => {
  let emitter: ResurrectionEventEmitter;

  setup(() => {
    emitter = new ResurrectionEventEmitter();
  });

  teardown(() => {
    emitter.removeAllListeners();
  });

  suite('Event Emission', () => {
    test('should emit transformation_applied events', (done) => {
      const data: TransformationAppliedEventData = {
        transformationType: 'dependency_update',
        packageName: 'axios',
        version: { from: '0.21.0', to: '1.2.0' },
        details: {},
        success: true,
      };

      emitter.onTransformationApplied((event) => {
        assert.strictEqual(event.type, 'transformation_applied');
        assert.deepStrictEqual(event.data, data);
        assert.ok(event.timestamp > 0);
        done();
      });

      emitter.emitTransformationApplied(data);
    });

    test('should emit dependency_updated events', (done) => {
      const data: DependencyUpdatedEventData = {
        packageName: 'react',
        previousVersion: '16.0.0',
        newVersion: '18.0.0',
        success: true,
        vulnerabilitiesFixed: 2,
      };

      emitter.onDependencyUpdated((event) => {
        assert.strictEqual(event.type, 'dependency_updated');
        assert.deepStrictEqual(event.data, data);
        assert.ok(event.timestamp > 0);
        done();
      });

      emitter.emitDependencyUpdated(data);
    });

    test('should emit test_completed events', (done) => {
      const data: TestCompletedEventData = {
        testType: 'unit',
        passed: true,
        coverage: 85,
        testsRun: 100,
        testsPassed: 95,
        testsFailed: 5,
        executionTime: 5000,
      };

      emitter.onTestCompleted((event) => {
        assert.strictEqual(event.type, 'test_completed');
        assert.deepStrictEqual(event.data, data);
        done();
      });

      emitter.emitTestCompleted(data);
    });

    test('should emit metric_updated events', (done) => {
      const data: MetricUpdatedEventData = {
        timestamp: Date.now(),
        depsUpdated: 5,
        vulnsFixed: 3,
        complexity: 10,
        coverage: 80,
        loc: 1000,
        progress: 50,
      };

      emitter.onMetricUpdated((event) => {
        assert.strictEqual(event.type, 'metric_updated');
        assert.deepStrictEqual(event.data, data);
        done();
      });

      emitter.emitMetricUpdated(data);
    });

    test('should emit narration events', (done) => {
      const data: NarrationEventData = {
        message: 'Updating axios from version 0.21 to 1.2',
        priority: 'medium',
        category: 'info',
      };

      emitter.onNarration((event) => {
        assert.strictEqual(event.type, 'narration');
        assert.deepStrictEqual(event.data, data);
        done();
      });

      emitter.emitNarration(data);
    });

    test('should emit ast_analysis_complete events', (done) => {
      const data: ASTAnalysisCompleteEventData = {
        analysis: {
          files: [],
          totalLOC: 1000,
          averageComplexity: 5,
          dependencyGraph: [],
          analyzedAt: new Date(),
        },
        summary: 'AST analysis complete',
      };

      emitter.onASTAnalysisComplete((event) => {
        assert.strictEqual(event.type, 'ast_analysis_complete');
        assert.strictEqual(event.data.summary, data.summary);
        done();
      });

      emitter.emitASTAnalysisComplete(data);
    });

    test('should emit llm_insight events', (done) => {
      const data: LLMInsightEventData = {
        filePath: 'src/index.ts',
        insight: {
          filePath: 'src/index.ts',
          developerIntent: 'Main entry point',
          domainConcepts: ['initialization'],
          idiomaticPatterns: ['module pattern'],
          antiPatterns: [],
          modernizationSuggestions: ['Use ES modules'],
          confidence: 0.9,
        },
        summary: 'LLM insight generated',
      };

      emitter.onLLMInsight((event) => {
        assert.strictEqual(event.type, 'llm_insight');
        assert.strictEqual(event.data.filePath, data.filePath);
        assert.strictEqual(event.data.summary, data.summary);
        done();
      });

      emitter.emitLLMInsight(data);
    });

    test('should emit validation_complete events', (done) => {
      const data: ValidationCompleteEventData = {
        results: {
          success: true,
          originalResults: {
            passed: true,
            exitCode: 0,
            stdout: '',
            stderr: '',
            executionTime: 1000,
          },
          modernResults: {
            passed: true,
            exitCode: 0,
            stdout: '',
            stderr: '',
            executionTime: 800,
          },
          functionalEquivalence: true,
          performanceImprovement: 20,
          comparisonReport: 'Tests passed in both environments',
        },
        summary: 'Validation complete',
      };

      emitter.onValidationComplete((event) => {
        assert.strictEqual(event.type, 'validation_complete');
        assert.strictEqual(event.data.summary, data.summary);
        assert.strictEqual(event.data.results.success, true);
        done();
      });

      emitter.emitValidationComplete(data);
    });

    test('should emit baseline_compilation_complete events', (done) => {
      const data: BaselineCompilationCompleteEventData = {
        result: {
          timestamp: new Date(),
          success: false,
          errorCount: 5,
          errors: [
            {
              file: 'src/index.ts',
              line: 10,
              column: 5,
              message: "Cannot find module 'lodash'",
              code: 'TS2307',
              category: 'import',
            },
          ],
          errorsByCategory: {
            type: 2,
            import: 2,
            syntax: 0,
            dependency: 1,
            config: 0,
          },
          output: 'tsc output...',
          projectType: 'typescript',
          strategy: 'typescript',
          suggestedFixes: [],
        },
        summary: 'Baseline compilation failed with 5 errors',
      };

      emitter.onBaselineCompilationComplete((event) => {
        assert.strictEqual(event.type, 'baseline_compilation_complete');
        assert.strictEqual(event.data.summary, data.summary);
        assert.strictEqual(event.data.result.success, false);
        assert.strictEqual(event.data.result.errorCount, 5);
        done();
      });

      emitter.emitBaselineCompilationComplete(data);
    });

    test('should emit final_compilation_complete events', (done) => {
      const data: FinalCompilationCompleteEventData = {
        result: {
          timestamp: new Date(),
          success: true,
          errorCount: 0,
          errors: [],
          errorsByCategory: {
            type: 0,
            import: 0,
            syntax: 0,
            dependency: 0,
            config: 0,
          },
          output: 'Compilation successful',
          projectType: 'typescript',
          strategy: 'typescript',
          suggestedFixes: [],
        },
        summary: 'Final compilation succeeded',
      };

      emitter.onFinalCompilationComplete((event) => {
        assert.strictEqual(event.type, 'final_compilation_complete');
        assert.strictEqual(event.data.summary, data.summary);
        assert.strictEqual(event.data.result.success, true);
        assert.strictEqual(event.data.result.errorCount, 0);
        done();
      });

      emitter.emitFinalCompilationComplete(data);
    });

    test('should emit resurrection_verdict events', (done) => {
      const baselineResult = {
        timestamp: new Date(),
        success: false,
        errorCount: 5,
        errors: [],
        errorsByCategory: {
          type: 2,
          import: 2,
          syntax: 0,
          dependency: 1,
          config: 0,
        },
        output: '',
        projectType: 'typescript' as const,
        strategy: 'typescript' as const,
        suggestedFixes: [],
      };

      const finalResult = {
        timestamp: new Date(),
        success: true,
        errorCount: 0,
        errors: [],
        errorsByCategory: {
          type: 0,
          import: 0,
          syntax: 0,
          dependency: 0,
          config: 0,
        },
        output: '',
        projectType: 'typescript' as const,
        strategy: 'typescript' as const,
        suggestedFixes: [],
      };

      const data: ResurrectionVerdictEventData = {
        verdict: {
          baselineCompilation: baselineResult,
          finalCompilation: finalResult,
          resurrected: true,
          errorsFixed: 5,
          errorsRemaining: 0,
          errorsFixedByCategory: {
            type: 2,
            import: 2,
            syntax: 0,
            dependency: 1,
            config: 0,
          },
          errorsRemainingByCategory: {
            type: 0,
            import: 0,
            syntax: 0,
            dependency: 0,
            config: 0,
          },
          fixedErrors: [],
          newErrors: [],
        },
        summary: 'RESURRECTED! Fixed 5 compilation errors',
      };

      emitter.onResurrectionVerdict((event) => {
        assert.strictEqual(event.type, 'resurrection_verdict');
        assert.strictEqual(event.data.summary, data.summary);
        assert.strictEqual(event.data.verdict.resurrected, true);
        assert.strictEqual(event.data.verdict.errorsFixed, 5);
        done();
      });

      emitter.emitResurrectionVerdict(data);
    });
  });

  suite('Event Handling', () => {
    test('should support multiple listeners for the same event', () => {
      let listener1Called = false;
      let listener2Called = false;

      emitter.onTransformationApplied(() => {
        listener1Called = true;
      });
      emitter.onTransformationApplied(() => {
        listener2Called = true;
      });

      const data: TransformationAppliedEventData = {
        transformationType: 'dependency_update',
        packageName: 'test',
        success: true,
        details: {},
      };

      emitter.emitTransformationApplied(data);

      assert.ok(listener1Called);
      assert.ok(listener2Called);
    });

    test('should allow removing all listeners for a specific event type', () => {
      let listenerCalled = false;

      emitter.onTransformationApplied(() => {
        listenerCalled = true;
      });
      emitter.removeAllListenersForType('transformation_applied');

      const data: TransformationAppliedEventData = {
        transformationType: 'dependency_update',
        packageName: 'test',
        success: true,
        details: {},
      };

      emitter.emitTransformationApplied(data);

      assert.ok(!listenerCalled);
    });

    test('should return correct listener count', () => {
      assert.strictEqual(emitter.getListenerCount('transformation_applied'), 0);

      emitter.onTransformationApplied(() => {});
      assert.strictEqual(emitter.getListenerCount('transformation_applied'), 1);

      emitter.onTransformationApplied(() => {});
      assert.strictEqual(emitter.getListenerCount('transformation_applied'), 2);

      emitter.removeAllListenersForType('transformation_applied');
      assert.strictEqual(emitter.getListenerCount('transformation_applied'), 0);
    });

    test('should handle events with timestamps', () => {
      let capturedEvent: any = null;

      emitter.onNarration((event) => {
        capturedEvent = event;
      });

      const beforeEmit = Date.now();
      emitter.emitNarration({ message: 'test' });
      const afterEmit = Date.now();

      assert.ok(capturedEvent !== null);
      assert.ok(capturedEvent.timestamp >= beforeEmit);
      assert.ok(capturedEvent.timestamp <= afterEmit);
    });
  });

  suite('Singleton Pattern', () => {
    teardown(() => {
      disposeEventEmitter();
    });

    test('should return the same instance from getEventEmitter', () => {
      const emitter1 = getEventEmitter();
      const emitter2 = getEventEmitter();

      assert.strictEqual(emitter1, emitter2);
    });

    test('should reset the global event emitter', () => {
      const emitter1 = getEventEmitter();
      let listenerCalled = false;
      emitter1.onNarration(() => {
        listenerCalled = true;
      });

      resetEventEmitter();

      const emitter2 = getEventEmitter();
      assert.notStrictEqual(emitter2, emitter1);

      emitter2.emitNarration({ message: 'test' });
      assert.ok(!listenerCalled);
    });

    test('should dispose the global event emitter', () => {
      const emitter1 = getEventEmitter();
      let listenerCalled = false;
      emitter1.onNarration(() => {
        listenerCalled = true;
      });

      disposeEventEmitter();

      const emitter2 = getEventEmitter();
      assert.notStrictEqual(emitter2, emitter1);

      emitter2.emitNarration({ message: 'test' });
      assert.ok(!listenerCalled);
    });
  });

  suite('Event Isolation', () => {
    test('should not trigger listeners for different event types', () => {
      let transformationListenerCalled = false;
      let dependencyListenerCalled = false;

      emitter.onTransformationApplied(() => {
        transformationListenerCalled = true;
      });
      emitter.onDependencyUpdated(() => {
        dependencyListenerCalled = true;
      });

      emitter.emitTransformationApplied({
        transformationType: 'dependency_update',
        packageName: 'test',
        success: true,
        details: {},
      });

      assert.ok(transformationListenerCalled);
      assert.ok(!dependencyListenerCalled);
    });
  });
});
