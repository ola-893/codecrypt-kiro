/**
 * Metrics calculation service for tracking resurrection progress
 */

import {
  MetricsSnapshot,
  MetricsHistory,
  ResurrectionContext,
  ASTAnalysis,
  ResurrectionEvent,
  TransformationAppliedEventData,
  ASTAnalysisCompleteEventData,
  TestCompletedEventData,
} from '../types';
import { ResurrectionEventEmitter } from './eventEmitter';

/**
 * Service for calculating and managing metrics throughout the resurrection process
 */
export class MetricsService {
  private metricsHistory: MetricsSnapshot[] = [];
  private baseline: MetricsSnapshot | null = null;
  private eventEmitter: ResurrectionEventEmitter;
  private context: ResurrectionContext | null = null;
  private astAnalysis: ASTAnalysis | null = null;
  private testCoverage: number = 0;

  constructor(eventEmitter: ResurrectionEventEmitter) {
    this.eventEmitter = eventEmitter;
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for transformation events
   */
  private setupEventListeners(): void {
    // Listen for transformation_applied events
    this.eventEmitter.onTransformationApplied((event: ResurrectionEvent<TransformationAppliedEventData>) => {
      this.handleTransformationApplied(event);
    });

    // Listen for AST analysis complete events
    this.eventEmitter.onASTAnalysisComplete((event: ResurrectionEvent<ASTAnalysisCompleteEventData>) => {
      this.astAnalysis = event.data.analysis;
      this.recalculateAndEmitMetrics();
    });

    // Listen for test completion events
    this.eventEmitter.onTestCompleted((event: ResurrectionEvent<TestCompletedEventData>) => {
      if (event.data.coverage !== undefined) {
        this.testCoverage = event.data.coverage;
        this.recalculateAndEmitMetrics();
      }
    });
  }

  /**
   * Handle transformation applied events
   */
  private handleTransformationApplied(event: ResurrectionEvent<TransformationAppliedEventData>): void {
    this.recalculateAndEmitMetrics();
  }

  /**
   * Recalculate metrics and emit metric_updated event
   */
  private recalculateAndEmitMetrics(): void {
    if (!this.context) {
      return;
    }

    const newMetrics = this.calculateMetrics(
      this.context,
      this.astAnalysis ?? undefined,
      this.testCoverage
    );

    this.addSnapshot(newMetrics);
    
    // Calculate delta from baseline
    const delta = this.baseline ? {
      depsUpdated: newMetrics.depsUpdated - this.baseline.depsUpdated,
      vulnsFixed: newMetrics.vulnsFixed - this.baseline.vulnsFixed,
      complexityChange: newMetrics.complexity - this.baseline.complexity,
      coverageChange: newMetrics.coverage - this.baseline.coverage,
    } : undefined;

    this.eventEmitter.emitMetricUpdated({
      ...newMetrics,
      delta,
    });
  }

  /**
   * Set the resurrection context
   */
  setContext(context: ResurrectionContext): void {
    this.context = context;
  }

  /**
   * Calculate current metrics from resurrection context
   */
  calculateMetrics(
    context: ResurrectionContext,
    astAnalysis?: ASTAnalysis,
    testCoverage?: number
  ): MetricsSnapshot {
    const timestamp = Date.now();

    // Calculate dependencies updated
    const depsUpdated = context.dependencies.filter(
      (dep) => dep.updateStatus === 'success'
    ).length;

    // Calculate vulnerabilities fixed
    const vulnsFixed = context.dependencies
      .filter((dep) => dep.updateStatus === 'success')
      .reduce((sum, dep) => sum + dep.vulnerabilities.length, 0);

    // Calculate complexity from AST analysis
    const complexity = astAnalysis?.averageComplexity ?? 0;

    // Get test coverage (default to 0 if not provided)
    const coverage = testCoverage ?? 0;

    // Calculate lines of code from AST analysis
    const loc = astAnalysis?.totalLOC ?? 0;

    // Calculate progress based on resurrection plan
    const totalUpdates = context.resurrectionPlan?.totalUpdates ?? 0;
    const progress = totalUpdates > 0 ? (depsUpdated / totalUpdates) * 100 : 0;

    return {
      timestamp,
      depsUpdated,
      vulnsFixed,
      complexity,
      coverage,
      loc,
      progress,
    };
  }

  /**
   * Set the baseline metrics (initial state before resurrection)
   */
  setBaseline(snapshot: MetricsSnapshot): void {
    this.baseline = snapshot;
    this.metricsHistory = [snapshot];
    this.eventEmitter.emitMetricUpdated(snapshot);
  }

  /**
   * Initialize metrics with context and calculate baseline
   */
  initialize(
    context: ResurrectionContext,
    astAnalysis?: ASTAnalysis,
    testCoverage?: number
  ): void {
    this.context = context;
    this.astAnalysis = astAnalysis ?? null;
    this.testCoverage = testCoverage ?? 0;

    const baseline = this.calculateMetrics(context, astAnalysis, testCoverage);
    this.setBaseline(baseline);
  }

  /**
   * Add a new metrics snapshot to the history
   */
  addSnapshot(snapshot: MetricsSnapshot): void {
    this.metricsHistory.push(snapshot);
  }

  /**
   * Get the complete metrics history
   */
  getHistory(): MetricsHistory {
    if (!this.baseline) {
      throw new Error('Baseline metrics not set');
    }

    const current =
      this.metricsHistory.length > 0
        ? this.metricsHistory[this.metricsHistory.length - 1]
        : this.baseline;

    return {
      snapshots: this.metricsHistory,
      baseline: this.baseline,
      current,
    };
  }

  /**
   * Get the current metrics snapshot
   */
  getCurrentMetrics(): MetricsSnapshot {
    if (this.metricsHistory.length === 0) {
      throw new Error('No metrics snapshots available');
    }
    return this.metricsHistory[this.metricsHistory.length - 1];
  }

  /**
   * Calculate metrics delta between current and baseline
   */
  getMetricsDelta(): {
    depsUpdated: number;
    vulnsFixed: number;
    complexityChange: number;
    coverageChange: number;
    locChange: number;
    progressChange: number;
  } {
    if (!this.baseline) {
      throw new Error('Baseline metrics not set');
    }

    const current = this.getCurrentMetrics();

    return {
      depsUpdated: current.depsUpdated - this.baseline.depsUpdated,
      vulnsFixed: current.vulnsFixed - this.baseline.vulnsFixed,
      complexityChange: current.complexity - this.baseline.complexity,
      coverageChange: current.coverage - this.baseline.coverage,
      locChange: current.loc - this.baseline.loc,
      progressChange: current.progress - this.baseline.progress,
    };
  }

  /**
   * Reset the metrics service
   */
  reset(): void {
    this.metricsHistory = [];
    this.baseline = null;
  }
}

/**
 * Create a new metrics service instance
 */
export function createMetricsService(eventEmitter: ResurrectionEventEmitter): MetricsService {
  return new MetricsService(eventEmitter);
}
