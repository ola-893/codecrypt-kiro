/**
 * Centralized event emitter for the resurrection process
 * Provides type-safe event emission and subscription
 */

import { EventEmitter } from 'events';
import {
  ResurrectionEventType,
  ResurrectionEvent,
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
  GitHistoryLoadedEventData,
  // Post-resurrection validation event types
  ValidationIterationStartEventData,
  ValidationErrorAnalysisEventData,
  ValidationFixAppliedEventData,
  ValidationFixOutcomeEventData,
  // Batch execution event types
  BatchStartedEventData,
  BatchCompletedEventData,
  PackageUpdateStartedEventData,
  PackageUpdatedEventData,
} from '../types';
import { getLogger } from '../utils/logger';

/**
 * Type-safe event emitter for resurrection events
 */
export class ResurrectionEventEmitter extends EventEmitter {
  private logger = getLogger();

  constructor() {
    super();
    this.setMaxListeners(50); // Allow many listeners for different components
  }

  /**
   * Emit a transformation applied event
   */
  emitTransformationApplied(data: TransformationAppliedEventData): void {
    this.emitEvent('transformation_applied', data);
  }

  /**
   * Emit a dependency updated event
   */
  emitDependencyUpdated(data: DependencyUpdatedEventData): void {
    this.emitEvent('dependency_updated', data);
  }

  /**
   * Emit a test completed event
   */
  emitTestCompleted(data: TestCompletedEventData): void {
    this.emitEvent('test_completed', data);
  }

  /**
   * Emit a metric updated event
   */
  emitMetricUpdated(data: MetricUpdatedEventData): void {
    this.emitEvent('metric_updated', data);
  }

  /**
   * Emit a narration event
   */
  emitNarration(data: NarrationEventData): void {
    this.emitEvent('narration', data);
  }

  /**
   * Emit an AST analysis complete event
   */
  emitASTAnalysisComplete(data: ASTAnalysisCompleteEventData): void {
    this.emitEvent('ast_analysis_complete', data);
  }

  /**
   * Emit an LLM insight event
   */
  emitLLMInsight(data: LLMInsightEventData): void {
    this.emitEvent('llm_insight', data);
  }

  /**
   * Emit a validation complete event
   */
  emitValidationComplete(data: ValidationCompleteEventData): void {
    this.emitEvent('validation_complete', data);
  }

  /**
   * Emit a baseline compilation complete event
   */
  emitBaselineCompilationComplete(data: BaselineCompilationCompleteEventData): void {
    this.emitEvent('baseline_compilation_complete', data);
  }

  /**
   * Emit a final compilation complete event
   */
  emitFinalCompilationComplete(data: FinalCompilationCompleteEventData): void {
    this.emitEvent('final_compilation_complete', data);
  }

  /**
   * Emit a resurrection verdict event
   */
  emitResurrectionVerdict(data: ResurrectionVerdictEventData): void {
    this.emitEvent('resurrection_verdict', data);
  }

  /**
   * Emit a git history loaded event
   */
  emitGitHistoryLoaded(data: any): void {
    this.emitEvent('git_history_loaded', data);
  }

  // ============================================================================
  // Post-Resurrection Validation Events
  // ============================================================================

  /**
   * Emit a validation iteration start event
   */
  emitValidationIterationStart(data: ValidationIterationStartEventData): void {
    this.emitEvent('validation_iteration_start', data);
  }

  /**
   * Emit a validation error analysis event
   */
  emitValidationErrorAnalysis(data: ValidationErrorAnalysisEventData): void {
    this.emitEvent('validation_error_analysis', data);
  }

  /**
   * Emit a validation fix applied event
   */
  emitValidationFixApplied(data: ValidationFixAppliedEventData): void {
    this.emitEvent('validation_fix_applied', data);
  }

  /**
   * Emit a validation fix outcome event
   */
  emitValidationFixOutcome(data: ValidationFixOutcomeEventData): void {
    this.emitEvent('validation_fix_outcome', data);
  }

  // ============================================================================
  // Batch Execution Events
  // ============================================================================

  /**
   * Emit a batch started event
   */
  emitBatchStarted(data: BatchStartedEventData): void {
    this.emitEvent('batch_started', data);
  }

  /**
   * Emit a batch completed event
   */
  emitBatchCompleted(data: BatchCompletedEventData): void {
    this.emitEvent('batch_completed', data);
  }

  /**
   * Emit a package update started event
   */
  emitPackageUpdateStarted(data: PackageUpdateStartedEventData): void {
    this.emitEvent('package_update_started', data);
  }

  /**
   * Emit a package updated event
   */
  emitPackageUpdated(data: PackageUpdatedEventData): void {
    this.emitEvent('package_updated', data);
  }

  /**
   * Generic event emission with logging
   */
  private emitEvent<T>(type: ResurrectionEventType, data: T): void {
    const event: ResurrectionEvent<T> = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.logger.debug(`[Event] ${type}`, data);
    this.emit(type, event);
  }

  /**
   * Subscribe to transformation applied events
   */
  onTransformationApplied(
    listener: (event: ResurrectionEvent<TransformationAppliedEventData>) => void
  ): void {
    this.on('transformation_applied', listener);
  }

  /**
   * Subscribe to dependency updated events
   */
  onDependencyUpdated(
    listener: (event: ResurrectionEvent<DependencyUpdatedEventData>) => void
  ): void {
    this.on('dependency_updated', listener);
  }

  /**
   * Subscribe to test completed events
   */
  onTestCompleted(
    listener: (event: ResurrectionEvent<TestCompletedEventData>) => void
  ): void {
    this.on('test_completed', listener);
  }

  /**
   * Subscribe to metric updated events
   */
  onMetricUpdated(
    listener: (event: ResurrectionEvent<MetricUpdatedEventData>) => void
  ): void {
    this.on('metric_updated', listener);
  }

  /**
   * Subscribe to narration events
   */
  onNarration(
    listener: (event: ResurrectionEvent<NarrationEventData>) => void
  ): void {
    this.on('narration', listener);
  }

  /**
   * Subscribe to AST analysis complete events
   */
  onASTAnalysisComplete(
    listener: (event: ResurrectionEvent<ASTAnalysisCompleteEventData>) => void
  ): void {
    this.on('ast_analysis_complete', listener);
  }

  /**
   * Subscribe to LLM insight events
   */
  onLLMInsight(
    listener: (event: ResurrectionEvent<LLMInsightEventData>) => void
  ): void {
    this.on('llm_insight', listener);
  }

  /**
   * Subscribe to validation complete events
   */
  onValidationComplete(
    listener: (event: ResurrectionEvent<ValidationCompleteEventData>) => void
  ): void {
    this.on('validation_complete', listener);
  }

  /**
   * Subscribe to baseline compilation complete events
   */
  onBaselineCompilationComplete(
    listener: (event: ResurrectionEvent<BaselineCompilationCompleteEventData>) => void
  ): void {
    this.on('baseline_compilation_complete', listener);
  }

  /**
   * Subscribe to final compilation complete events
   */
  onFinalCompilationComplete(
    listener: (event: ResurrectionEvent<FinalCompilationCompleteEventData>) => void
  ): void {
    this.on('final_compilation_complete', listener);
  }

  /**
   * Subscribe to resurrection verdict events
   */
  onResurrectionVerdict(
    listener: (event: ResurrectionEvent<ResurrectionVerdictEventData>) => void
  ): void {
    this.on('resurrection_verdict', listener);
  }

  // ============================================================================
  // Post-Resurrection Validation Event Subscriptions
  // ============================================================================

  /**
   * Subscribe to validation iteration start events
   */
  onValidationIterationStart(
    listener: (event: ResurrectionEvent<ValidationIterationStartEventData>) => void
  ): void {
    this.on('validation_iteration_start', listener);
  }

  /**
   * Subscribe to validation error analysis events
   */
  onValidationErrorAnalysis(
    listener: (event: ResurrectionEvent<ValidationErrorAnalysisEventData>) => void
  ): void {
    this.on('validation_error_analysis', listener);
  }

  /**
   * Subscribe to validation fix applied events
   */
  onValidationFixApplied(
    listener: (event: ResurrectionEvent<ValidationFixAppliedEventData>) => void
  ): void {
    this.on('validation_fix_applied', listener);
  }

  /**
   * Subscribe to validation fix outcome events
   */
  onValidationFixOutcome(
    listener: (event: ResurrectionEvent<ValidationFixOutcomeEventData>) => void
  ): void {
    this.on('validation_fix_outcome', listener);
  }

  // ============================================================================
  // Batch Execution Event Subscriptions
  // ============================================================================

  /**
   * Subscribe to batch started events
   */
  onBatchStarted(
    listener: (event: ResurrectionEvent<BatchStartedEventData>) => void
  ): void {
    this.on('batch_started', listener);
  }

  /**
   * Subscribe to batch completed events
   */
  onBatchCompleted(
    listener: (event: ResurrectionEvent<BatchCompletedEventData>) => void
  ): void {
    this.on('batch_completed', listener);
  }

  /**
   * Subscribe to package update started events
   */
  onPackageUpdateStarted(
    listener: (event: ResurrectionEvent<PackageUpdateStartedEventData>) => void
  ): void {
    this.on('package_update_started', listener);
  }

  /**
   * Subscribe to package updated events
   */
  onPackageUpdated(
    listener: (event: ResurrectionEvent<PackageUpdatedEventData>) => void
  ): void {
    this.on('package_updated', listener);
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListenersForType(type: ResurrectionEventType): void {
    this.removeAllListeners(type);
  }

  /**
   * Get the number of listeners for a specific event type
   */
  getListenerCount(type: ResurrectionEventType): number {
    return this.listenerCount(type);
  }
}

// Singleton instance
let globalEventEmitter: ResurrectionEventEmitter | null = null;

/**
 * Get the global event emitter instance
 */
export function getEventEmitter(): ResurrectionEventEmitter {
  if (!globalEventEmitter) {
    globalEventEmitter = new ResurrectionEventEmitter();
  }
  return globalEventEmitter;
}

/**
 * Reset the global event emitter (useful for testing)
 */
export function resetEventEmitter(): void {
  if (globalEventEmitter) {
    globalEventEmitter.removeAllListeners();
  }
  globalEventEmitter = new ResurrectionEventEmitter();
}

/**
 * Dispose the global event emitter
 */
export function disposeEventEmitter(): void {
  if (globalEventEmitter) {
    globalEventEmitter.removeAllListeners();
    globalEventEmitter = null;
  }
}
