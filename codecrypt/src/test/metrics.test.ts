/**
 * Tests for Metrics Service
 */

import * as assert from 'assert';
import { EventEmitter } from 'events';
import { MetricsService, createMetricsService } from '../services/metrics';
import {
  ResurrectionContext,
  ASTAnalysis,
  DependencyInfo,
  MetricsSnapshot,
} from '../types';

suite('Metrics Service Tests', () => {
  let eventEmitter: EventEmitter;
  let metricsService: MetricsService;

  setup(() => {
    eventEmitter = new EventEmitter();
    metricsService = createMetricsService(eventEmitter);
  });

  teardown(() => {
    eventEmitter.removeAllListeners();
  });

  suite('calculateMetrics', () => {
    test('should calculate metrics from context', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [
          {
            name: 'react',
            currentVersion: '16.0.0',
            latestVersion: '18.0.0',
            vulnerabilities: [
              { id: 'CVE-1', severity: 'high' },
              { id: 'CVE-2', severity: 'moderate' },
            ],
            updateStatus: 'success',
          },
          {
            name: 'lodash',
            currentVersion: '4.0.0',
            latestVersion: '4.17.0',
            vulnerabilities: [{ id: 'CVE-3', severity: 'low' }],
            updateStatus: 'success',
          },
          {
            name: 'axios',
            currentVersion: '0.21.0',
            latestVersion: '1.0.0',
            vulnerabilities: [],
            updateStatus: 'pending',
          },
        ],
        transformationLog: [],
        resurrectionPlan: {
          items: [],
          totalUpdates: 3,
          securityPatches: 2,
          strategy: 'moderate',
          generatedAt: new Date(),
        },
      };

      const astAnalysis: ASTAnalysis = {
        files: [],
        totalLOC: 1000,
        averageComplexity: 5.5,
        dependencyGraph: [],
        analyzedAt: new Date(),
      };

      const metrics = metricsService.calculateMetrics(context, astAnalysis, 75);

      assert.strictEqual(metrics.depsUpdated, 2);
      assert.strictEqual(metrics.vulnsFixed, 3);
      assert.strictEqual(metrics.complexity, 5.5);
      assert.strictEqual(metrics.coverage, 75);
      assert.strictEqual(metrics.loc, 1000);
      assert.strictEqual(metrics.progress, (2 / 3) * 100);
      assert.ok(metrics.timestamp > 0);
    });

    test('should handle context without AST analysis', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: [],
      };

      const metrics = metricsService.calculateMetrics(context);

      assert.strictEqual(metrics.depsUpdated, 0);
      assert.strictEqual(metrics.vulnsFixed, 0);
      assert.strictEqual(metrics.complexity, 0);
      assert.strictEqual(metrics.coverage, 0);
      assert.strictEqual(metrics.loc, 0);
      assert.strictEqual(metrics.progress, 0);
    });

    test('should calculate progress correctly', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [
          {
            name: 'pkg1',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            vulnerabilities: [],
            updateStatus: 'success',
          },
          {
            name: 'pkg2',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            vulnerabilities: [],
            updateStatus: 'success',
          },
          {
            name: 'pkg3',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            vulnerabilities: [],
            updateStatus: 'pending',
          },
          {
            name: 'pkg4',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            vulnerabilities: [],
            updateStatus: 'pending',
          },
        ],
        transformationLog: [],
        resurrectionPlan: {
          items: [],
          totalUpdates: 4,
          securityPatches: 0,
          strategy: 'moderate',
          generatedAt: new Date(),
        },
      };

      const metrics = metricsService.calculateMetrics(context);

      assert.strictEqual(metrics.progress, 50);
    });
  });

  suite('setBaseline and getHistory', () => {
    test('should set baseline and emit event', (done) => {
      const baseline: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 10,
        coverage: 50,
        loc: 500,
        progress: 0,
      };

      eventEmitter.once('metric_updated', (data) => {
        assert.deepStrictEqual(data, baseline);
        done();
      });

      metricsService.setBaseline(baseline);
    });

    test('should get history after setting baseline', () => {
      const baseline: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 10,
        coverage: 50,
        loc: 500,
        progress: 0,
      };

      metricsService.setBaseline(baseline);
      const history = metricsService.getHistory();

      assert.strictEqual(history.snapshots.length, 1);
      assert.deepStrictEqual(history.baseline, baseline);
      assert.deepStrictEqual(history.current, baseline);
    });

    test('should throw error if baseline not set', () => {
      assert.throws(() => {
        metricsService.getHistory();
      }, /Baseline metrics not set/);
    });
  });

  suite('addSnapshot', () => {
    test('should add snapshot to history', () => {
      const baseline: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 10,
        coverage: 50,
        loc: 500,
        progress: 0,
      };

      metricsService.setBaseline(baseline);

      const snapshot: MetricsSnapshot = {
        timestamp: Date.now() + 1000,
        depsUpdated: 1,
        vulnsFixed: 2,
        complexity: 9,
        coverage: 55,
        loc: 500,
        progress: 33,
      };

      metricsService.addSnapshot(snapshot);
      const history = metricsService.getHistory();

      assert.strictEqual(history.snapshots.length, 2);
      assert.deepStrictEqual(history.current, snapshot);
    });
  });

  suite('getCurrentMetrics', () => {
    test('should return current metrics', () => {
      const baseline: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 10,
        coverage: 50,
        loc: 500,
        progress: 0,
      };

      metricsService.setBaseline(baseline);
      const current = metricsService.getCurrentMetrics();

      assert.deepStrictEqual(current, baseline);
    });

    test('should throw error if no snapshots', () => {
      assert.throws(() => {
        metricsService.getCurrentMetrics();
      }, /No metrics snapshots available/);
    });
  });

  suite('getMetricsDelta', () => {
    test('should calculate delta between current and baseline', () => {
      const baseline: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 10,
        coverage: 50,
        loc: 500,
        progress: 0,
      };

      metricsService.setBaseline(baseline);

      const snapshot: MetricsSnapshot = {
        timestamp: Date.now() + 1000,
        depsUpdated: 3,
        vulnsFixed: 5,
        complexity: 8,
        coverage: 70,
        loc: 520,
        progress: 100,
      };

      metricsService.addSnapshot(snapshot);
      const delta = metricsService.getMetricsDelta();

      assert.strictEqual(delta.depsUpdated, 3);
      assert.strictEqual(delta.vulnsFixed, 5);
      assert.strictEqual(delta.complexityChange, -2);
      assert.strictEqual(delta.coverageChange, 20);
      assert.strictEqual(delta.locChange, 20);
      assert.strictEqual(delta.progressChange, 100);
    });

    test('should throw error if baseline not set', () => {
      assert.throws(() => {
        metricsService.getMetricsDelta();
      }, /Baseline metrics not set/);
    });
  });

  suite('initialize', () => {
    test('should initialize with context and set baseline', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: [],
      };

      const astAnalysis: ASTAnalysis = {
        files: [],
        totalLOC: 800,
        averageComplexity: 6,
        dependencyGraph: [],
        analyzedAt: new Date(),
      };

      metricsService.initialize(context, astAnalysis, 60);
      const history = metricsService.getHistory();

      assert.strictEqual(history.baseline.loc, 800);
      assert.strictEqual(history.baseline.complexity, 6);
      assert.strictEqual(history.baseline.coverage, 60);
    });
  });

  suite('Event Integration', () => {
    test('should listen for transformation_applied events', (done) => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [
          {
            name: 'pkg1',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            vulnerabilities: [],
            updateStatus: 'pending',
          },
        ],
        transformationLog: [],
        resurrectionPlan: {
          items: [],
          totalUpdates: 1,
          securityPatches: 0,
          strategy: 'moderate',
          generatedAt: new Date(),
        },
      };

      metricsService.initialize(context);

      // Update dependency status
      context.dependencies[0].updateStatus = 'success';

      eventEmitter.once('metric_updated', (metrics: MetricsSnapshot) => {
        assert.strictEqual(metrics.depsUpdated, 1);
        assert.strictEqual(metrics.progress, 100);
        done();
      });

      eventEmitter.emit('transformation_applied', {
        type: 'dependency_update',
        details: { package: 'pkg1' },
      });
    });

    test('should listen for ast_analysis_complete events', (done) => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: [],
      };

      metricsService.initialize(context);

      const astAnalysis: ASTAnalysis = {
        files: [],
        totalLOC: 1200,
        averageComplexity: 7.5,
        dependencyGraph: [],
        analyzedAt: new Date(),
      };

      eventEmitter.once('metric_updated', (metrics: MetricsSnapshot) => {
        assert.strictEqual(metrics.loc, 1200);
        assert.strictEqual(metrics.complexity, 7.5);
        done();
      });

      eventEmitter.emit('ast_analysis_complete', astAnalysis);
    });

    test('should listen for test_completed events', (done) => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: [],
      };

      metricsService.initialize(context);

      eventEmitter.once('metric_updated', (metrics: MetricsSnapshot) => {
        assert.strictEqual(metrics.coverage, 85);
        done();
      });

      eventEmitter.emit('test_completed', { coverage: 85 });
    });

    test('should store metrics history for visualization', (done) => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [
          {
            name: 'pkg1',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            vulnerabilities: [],
            updateStatus: 'pending',
          },
          {
            name: 'pkg2',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            vulnerabilities: [],
            updateStatus: 'pending',
          },
        ],
        transformationLog: [],
        resurrectionPlan: {
          items: [],
          totalUpdates: 2,
          securityPatches: 0,
          strategy: 'moderate',
          generatedAt: new Date(),
        },
      };

      metricsService.initialize(context);

      // Simulate two updates
      context.dependencies[0].updateStatus = 'success';
      eventEmitter.emit('transformation_applied', {
        type: 'dependency_update',
        details: {},
      });

      setTimeout(() => {
        context.dependencies[1].updateStatus = 'success';
        eventEmitter.emit('transformation_applied', {
          type: 'dependency_update',
          details: {},
        });

        setTimeout(() => {
          const history = metricsService.getHistory();
          assert.strictEqual(history.snapshots.length, 3); // baseline + 2 updates
          assert.strictEqual(history.snapshots[1].depsUpdated, 1);
          assert.strictEqual(history.snapshots[2].depsUpdated, 2);
          done();
        }, 10);
      }, 10);
    });
  });

  suite('reset', () => {
    test('should reset metrics service', () => {
      const baseline: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 10,
        coverage: 50,
        loc: 500,
        progress: 0,
      };

      metricsService.setBaseline(baseline);
      metricsService.reset();

      assert.throws(() => {
        metricsService.getHistory();
      }, /Baseline metrics not set/);
    });
  });

  suite('createMetricsService', () => {
    test('should create a new metrics service instance', () => {
      const emitter = new EventEmitter();
      const service = createMetricsService(emitter);

      assert.ok(service instanceof MetricsService);
    });
  });
});
