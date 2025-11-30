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
