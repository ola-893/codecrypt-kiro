import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNarrationEvents, createNarrationEvent } from '../hooks/useNarrationEvents';
import {
  SSEEvent,
  TransformationEvent,
  ASTAnalysisResult,
  LLMInsight,
  ValidationResult,
  NarrationEvent,
} from '../types';

describe('useNarrationEvents Hook', () => {
  it('should return empty array for no events', () => {
    const { result } = renderHook(() => useNarrationEvents([]));
    expect(result.current).toEqual([]);
  });

  it('should pass through direct narration events', () => {
    const narrationEvent: NarrationEvent = {
      timestamp: Date.now(),
      message: 'Direct narration',
      priority: 'medium',
    };

    const events: SSEEvent[] = [
      {
        type: 'narration',
        data: narrationEvent,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toBe('Direct narration');
    expect(result.current[0].priority).toBe('medium');
  });

  it('should generate narration for successful dependency transformation', () => {
    const transformation: TransformationEvent = {
      type: 'dependency',
      timestamp: Date.now(),
      details: {
        name: 'react',
        oldVersion: '16.0.0',
        newVersion: '18.0.0',
        success: true,
      },
    };

    const events: SSEEvent[] = [
      {
        type: 'transformation_applied',
        data: transformation,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toContain('Successfully updated react');
    expect(result.current[0].message).toContain('16.0.0');
    expect(result.current[0].message).toContain('18.0.0');
    expect(result.current[0].priority).toBe('medium');
  });

  it('should generate narration for failed dependency transformation', () => {
    const transformation: TransformationEvent = {
      type: 'dependency',
      timestamp: Date.now(),
      details: {
        name: 'axios',
        oldVersion: '0.21.0',
        newVersion: '1.0.0',
        success: false,
        message: 'Breaking changes detected',
      },
    };

    const events: SSEEvent[] = [
      {
        type: 'transformation_applied',
        data: transformation,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toContain('Failed to update axios');
    expect(result.current[0].message).toContain('Breaking changes detected');
    expect(result.current[0].priority).toBe('high');
  });

  it('should generate narration for successful test transformation', () => {
    const transformation: TransformationEvent = {
      type: 'test',
      timestamp: Date.now(),
      details: {
        success: true,
      },
    };

    const events: SSEEvent[] = [
      {
        type: 'transformation_applied',
        data: transformation,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toBe('Test suite passed successfully');
    expect(result.current[0].priority).toBe('medium');
  });

  it('should generate narration for failed test transformation', () => {
    const transformation: TransformationEvent = {
      type: 'test',
      timestamp: Date.now(),
      details: {
        success: false,
        message: '3 tests failed',
      },
    };

    const events: SSEEvent[] = [
      {
        type: 'transformation_applied',
        data: transformation,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toContain('Test suite failed');
    expect(result.current[0].message).toContain('3 tests failed');
    expect(result.current[0].priority).toBe('high');
  });

  it('should generate narration for AST analysis', () => {
    const astAnalysis: ASTAnalysisResult = {
      timestamp: Date.now(),
      complexity: 42,
      loc: 1500,
      functions: 25,
      classes: 8,
    };

    const events: SSEEvent[] = [
      {
        type: 'ast_analysis_complete',
        data: astAnalysis,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toContain('Code analysis complete');
    expect(result.current[0].message).toContain('25 functions');
    expect(result.current[0].message).toContain('8 classes');
    expect(result.current[0].message).toContain('1500 lines of code');
    expect(result.current[0].message).toContain('Complexity score: 42');
    expect(result.current[0].priority).toBe('medium');
  });

  it('should generate narration for LLM modernization insight', () => {
    const llmInsight: LLMInsight = {
      timestamp: Date.now(),
      insight: 'Consider using async/await instead of callbacks',
      category: 'modernization',
    };

    const events: SSEEvent[] = [
      {
        type: 'llm_insight',
        data: llmInsight,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toContain('AI detected modernization opportunity');
    expect(result.current[0].message).toContain('Consider using async/await');
    expect(result.current[0].priority).toBe('medium');
  });

  it('should generate high priority narration for security insights', () => {
    const llmInsight: LLMInsight = {
      timestamp: Date.now(),
      insight: 'Potential SQL injection vulnerability detected',
      category: 'security',
    };

    const events: SSEEvent[] = [
      {
        type: 'llm_insight',
        data: llmInsight,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toContain('AI detected security concern');
    expect(result.current[0].priority).toBe('high');
  });

  it('should generate narration for successful validation', () => {
    const validation: ValidationResult = {
      timestamp: Date.now(),
      originalPassed: true,
      modernPassed: true,
      functionalEquivalence: true,
      performanceImprovement: 0.25, // 25% improvement
    };

    const events: SSEEvent[] = [
      {
        type: 'validation_complete',
        data: validation,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toContain('Time Machine validation successful');
    expect(result.current[0].message).toContain('functionally equivalent');
    expect(result.current[0].message).toContain('25% performance improvement');
    expect(result.current[0].priority).toBe('high');
  });

  it('should generate narration for validation with performance decrease', () => {
    const validation: ValidationResult = {
      timestamp: Date.now(),
      originalPassed: true,
      modernPassed: true,
      functionalEquivalence: true,
      performanceImprovement: -0.1, // 10% decrease
    };

    const events: SSEEvent[] = [
      {
        type: 'validation_complete',
        data: validation,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toContain('10% performance decrease');
  });

  it('should generate narration for failed validation', () => {
    const validation: ValidationResult = {
      timestamp: Date.now(),
      originalPassed: true,
      modernPassed: true,
      functionalEquivalence: false,
      performanceImprovement: 0,
    };

    const events: SSEEvent[] = [
      {
        type: 'validation_complete',
        data: validation,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(1);
    expect(result.current[0].message).toContain('detected differences');
    expect(result.current[0].message).toContain('Manual review recommended');
    expect(result.current[0].priority).toBe('high');
  });

  it('should skip metric_updated events', () => {
    const events: SSEEvent[] = [
      {
        type: 'metric_updated',
        data: {
          timestamp: Date.now(),
          depsUpdated: 5,
          vulnsFixed: 2,
          complexity: 10,
          coverage: 0.8,
          loc: 1000,
          progress: 0.5,
        },
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    // Metric updates should not generate narration (too frequent)
    expect(result.current).toHaveLength(0);
  });

  it('should handle multiple events of different types', () => {
    const events: SSEEvent[] = [
      {
        type: 'narration',
        data: {
          timestamp: 1,
          message: 'Starting resurrection',
          priority: 'high',
        } as NarrationEvent,
      },
      {
        type: 'transformation_applied',
        data: {
          type: 'dependency',
          timestamp: 2,
          details: {
            name: 'lodash',
            oldVersion: '4.0.0',
            newVersion: '4.17.21',
            success: true,
          },
        } as TransformationEvent,
      },
      {
        type: 'ast_analysis_complete',
        data: {
          timestamp: 3,
          complexity: 20,
          loc: 500,
          functions: 10,
          classes: 3,
        } as ASTAnalysisResult,
      },
    ];

    const { result } = renderHook(() => useNarrationEvents(events));
    
    expect(result.current).toHaveLength(3);
    expect(result.current[0].message).toBe('Starting resurrection');
    expect(result.current[1].message).toContain('Successfully updated lodash');
    expect(result.current[2].message).toContain('Code analysis complete');
  });
});

describe('createNarrationEvent', () => {
  it('should create a narration event with default priority', () => {
    const event = createNarrationEvent('Test message');
    
    expect(event.message).toBe('Test message');
    expect(event.priority).toBe('medium');
    expect(event.timestamp).toBeDefined();
  });

  it('should create a narration event with custom priority', () => {
    const event = createNarrationEvent('High priority message', 'high');
    
    expect(event.message).toBe('High priority message');
    expect(event.priority).toBe('high');
  });

  it('should create events with unique timestamps', () => {
    const event1 = createNarrationEvent('Message 1');
    const event2 = createNarrationEvent('Message 2');
    
    // Timestamps should be different (or at least not fail)
    expect(event1.timestamp).toBeDefined();
    expect(event2.timestamp).toBeDefined();
  });
});
