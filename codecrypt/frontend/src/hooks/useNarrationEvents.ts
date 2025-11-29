import { useMemo } from 'react';
import { SSEEvent, NarrationEvent, TransformationEvent, ASTAnalysisResult, LLMInsight, ValidationResult } from '../types';

/**
 * Hook to filter and transform SSE events into narration events
 * Generates natural language messages for technical events
 */
export function useNarrationEvents(events: SSEEvent[]): NarrationEvent[] {
  return useMemo(() => {
    const narrationEvents: NarrationEvent[] = [];

    events.forEach((event) => {
      switch (event.type) {
        case 'narration':
          // Direct narration events
          narrationEvents.push(event.data as NarrationEvent);
          break;

        case 'transformation_applied':
          // Generate narration for transformation events
          const transformation = event.data as TransformationEvent;
          narrationEvents.push(
            generateTransformationNarration(transformation)
          );
          break;

        case 'ast_analysis_complete':
          // Generate narration for AST analysis
          const astAnalysis = event.data as ASTAnalysisResult;
          narrationEvents.push(
            generateASTNarration(astAnalysis)
          );
          break;

        case 'llm_insight':
          // Generate narration for LLM insights
          const llmInsight = event.data as LLMInsight;
          narrationEvents.push(
            generateLLMNarration(llmInsight)
          );
          break;

        case 'validation_complete':
          // Generate narration for validation results
          const validation = event.data as ValidationResult;
          narrationEvents.push(
            generateValidationNarration(validation)
          );
          break;

        case 'metric_updated':
          // Skip metric updates for narration (too frequent)
          break;
      }
    });

    return narrationEvents;
  }, [events]);
}

/**
 * Generate natural language narration for transformation events
 */
function generateTransformationNarration(
  transformation: TransformationEvent
): NarrationEvent {
  let message = '';
  let priority: 'low' | 'medium' | 'high' = 'medium';

  switch (transformation.type) {
    case 'dependency':
      if (transformation.details.success) {
        message = `Successfully updated ${transformation.details.name} from version ${transformation.details.oldVersion} to ${transformation.details.newVersion}`;
        priority = 'medium';
      } else {
        message = `Failed to update ${transformation.details.name}. ${transformation.details.message || 'Rolling back changes'}`;
        priority = 'high';
      }
      break;

    case 'code':
      if (transformation.details.success) {
        message = `Applied code transformation: ${transformation.details.message}`;
        priority = 'low';
      } else {
        message = `Code transformation failed: ${transformation.details.message}`;
        priority = 'high';
      }
      break;

    case 'test':
      if (transformation.details.success) {
        message = `Test suite passed successfully`;
        priority = 'medium';
      } else {
        message = `Test suite failed. ${transformation.details.message || 'Investigating issues'}`;
        priority = 'high';
      }
      break;

    case 'validation':
      if (transformation.details.success) {
        message = `Validation completed successfully`;
        priority = 'medium';
      } else {
        message = `Validation failed: ${transformation.details.message}`;
        priority = 'high';
      }
      break;

    default:
      message = transformation.details.message || 'Transformation applied';
      priority = 'low';
  }

  return {
    timestamp: transformation.timestamp,
    message,
    priority,
  };
}

/**
 * Generate natural language narration for AST analysis results
 */
function generateASTNarration(astAnalysis: ASTAnalysisResult): NarrationEvent {
  const message = `Code analysis complete. Found ${astAnalysis.functions} functions and ${astAnalysis.classes} classes across ${astAnalysis.loc} lines of code. Complexity score: ${astAnalysis.complexity}`;

  return {
    timestamp: astAnalysis.timestamp,
    message,
    priority: 'medium',
  };
}

/**
 * Generate natural language narration for LLM insights
 */
function generateLLMNarration(llmInsight: LLMInsight): NarrationEvent {
  const categoryDescriptions = {
    modernization: 'modernization opportunity',
    refactoring: 'refactoring suggestion',
    security: 'security concern',
    performance: 'performance improvement',
  };

  const categoryDescription = categoryDescriptions[llmInsight.category] || 'insight';
  const message = `AI detected ${categoryDescription}: ${llmInsight.insight}`;

  // Security insights are high priority
  const priority = llmInsight.category === 'security' ? 'high' : 'medium';

  return {
    timestamp: llmInsight.timestamp,
    message,
    priority,
  };
}

/**
 * Generate natural language narration for validation results
 */
function generateValidationNarration(
  validation: ValidationResult
): NarrationEvent {
  let message = '';
  let priority: 'low' | 'medium' | 'high' = 'high';

  if (validation.functionalEquivalence) {
    const performanceText = validation.performanceImprovement > 0
      ? `with ${Math.round(validation.performanceImprovement * 100)}% performance improvement`
      : validation.performanceImprovement < 0
      ? `with ${Math.abs(Math.round(validation.performanceImprovement * 100))}% performance decrease`
      : 'with similar performance';

    message = `Time Machine validation successful! The resurrected code is functionally equivalent to the original ${performanceText}`;
    priority = 'high';
  } else {
    message = `Time Machine validation detected differences between original and resurrected code. Manual review recommended`;
    priority = 'high';
  }

  return {
    timestamp: validation.timestamp,
    message,
    priority,
  };
}

/**
 * Helper to create custom narration events
 */
export function createNarrationEvent(
  message: string,
  priority: 'low' | 'medium' | 'high' = 'medium'
): NarrationEvent {
  return {
    timestamp: Date.now(),
    message,
    priority,
  };
}
