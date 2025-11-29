import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  ResurrectionProvider,
  useResurrection,
} from '../context/ResurrectionContext';
import {
  setConnected,
  setStatus,
  updateMetrics,
  addTransformation,
  addNarration,
  setASTAnalysis,
  addLLMInsight,
  setValidationResult,
  resetState,
} from '../context/actions';
import {
  MetricsSnapshot,
  TransformationEvent,
  NarrationEvent,
  ASTAnalysisResult,
  LLMInsight,
  ValidationResult,
} from '../types';

// Wrapper component for testing
const wrapper = ({ children }: { children: ReactNode }) => (
  <ResurrectionProvider>{children}</ResurrectionProvider>
);

describe('ResurrectionContext', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    expect(result.current.state.currentMetrics).toBe(null);
    expect(result.current.state.metricsHistory).toEqual([]);
    expect(result.current.state.transformations).toEqual([]);
    expect(result.current.state.narrations).toEqual([]);
    expect(result.current.state.astAnalysis).toBe(null);
    expect(result.current.state.llmInsights).toEqual([]);
    expect(result.current.state.validationResult).toBe(null);
    expect(result.current.state.isConnected).toBe(false);
    expect(result.current.state.status).toBe('idle');
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => useResurrection());
    }).toThrow('useResurrection must be used within a ResurrectionProvider');

    console.error = consoleError;
  });

  it('should update connection state', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    act(() => {
      result.current.dispatch(setConnected(true));
    });

    expect(result.current.state.isConnected).toBe(true);

    act(() => {
      result.current.dispatch(setConnected(false));
    });

    expect(result.current.state.isConnected).toBe(false);
  });

  it('should update status', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    act(() => {
      result.current.dispatch(setStatus('analyzing'));
    });

    expect(result.current.state.status).toBe('analyzing');

    act(() => {
      result.current.dispatch(setStatus('resurrecting'));
    });

    expect(result.current.state.status).toBe('resurrecting');
  });

  it('should update metrics and add to history', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    const metrics1: MetricsSnapshot = {
      timestamp: Date.now(),
      depsUpdated: 5,
      vulnsFixed: 3,
      complexity: 10,
      coverage: 0.8,
      loc: 1000,
      progress: 0.5,
    };

    act(() => {
      result.current.dispatch(updateMetrics(metrics1));
    });

    expect(result.current.state.currentMetrics).toEqual(metrics1);
    expect(result.current.state.metricsHistory).toHaveLength(1);
    expect(result.current.state.metricsHistory[0]).toEqual(metrics1);

    const metrics2: MetricsSnapshot = {
      timestamp: Date.now() + 1000,
      depsUpdated: 10,
      vulnsFixed: 5,
      complexity: 8,
      coverage: 0.85,
      loc: 950,
      progress: 0.75,
    };

    act(() => {
      result.current.dispatch(updateMetrics(metrics2));
    });

    expect(result.current.state.currentMetrics).toEqual(metrics2);
    expect(result.current.state.metricsHistory).toHaveLength(2);
    expect(result.current.state.metricsHistory[1]).toEqual(metrics2);
  });

  it('should add transformation events', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    const transformation1: TransformationEvent = {
      type: 'dependency',
      timestamp: Date.now(),
      details: {
        name: 'react',
        oldVersion: '17.0.0',
        newVersion: '18.0.0',
        success: true,
      },
    };

    act(() => {
      result.current.dispatch(addTransformation(transformation1));
    });

    expect(result.current.state.transformations).toHaveLength(1);
    expect(result.current.state.transformations[0]).toEqual(transformation1);

    const transformation2: TransformationEvent = {
      type: 'code',
      timestamp: Date.now() + 1000,
      details: {
        message: 'Refactored component',
        success: true,
      },
    };

    act(() => {
      result.current.dispatch(addTransformation(transformation2));
    });

    expect(result.current.state.transformations).toHaveLength(2);
    expect(result.current.state.transformations[1]).toEqual(transformation2);
  });

  it('should add narration events', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    const narration1: NarrationEvent = {
      timestamp: Date.now(),
      message: 'Starting resurrection process',
      priority: 'high',
    };

    act(() => {
      result.current.dispatch(addNarration(narration1));
    });

    expect(result.current.state.narrations).toHaveLength(1);
    expect(result.current.state.narrations[0]).toEqual(narration1);

    const narration2: NarrationEvent = {
      timestamp: Date.now() + 1000,
      message: 'Updating dependencies',
      priority: 'medium',
    };

    act(() => {
      result.current.dispatch(addNarration(narration2));
    });

    expect(result.current.state.narrations).toHaveLength(2);
    expect(result.current.state.narrations[1]).toEqual(narration2);
  });

  it('should set AST analysis result', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    const astAnalysis: ASTAnalysisResult = {
      timestamp: Date.now(),
      complexity: 15,
      loc: 2000,
      functions: 50,
      classes: 10,
    };

    act(() => {
      result.current.dispatch(setASTAnalysis(astAnalysis));
    });

    expect(result.current.state.astAnalysis).toEqual(astAnalysis);
  });

  it('should add LLM insights', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    const insight1: LLMInsight = {
      timestamp: Date.now(),
      insight: 'Consider using async/await instead of callbacks',
      category: 'modernization',
    };

    act(() => {
      result.current.dispatch(addLLMInsight(insight1));
    });

    expect(result.current.state.llmInsights).toHaveLength(1);
    expect(result.current.state.llmInsights[0]).toEqual(insight1);

    const insight2: LLMInsight = {
      timestamp: Date.now() + 1000,
      insight: 'Potential security vulnerability in authentication',
      category: 'security',
    };

    act(() => {
      result.current.dispatch(addLLMInsight(insight2));
    });

    expect(result.current.state.llmInsights).toHaveLength(2);
    expect(result.current.state.llmInsights[1]).toEqual(insight2);
  });

  it('should set validation result and update status to complete', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    const validationResult: ValidationResult = {
      timestamp: Date.now(),
      originalPassed: true,
      modernPassed: true,
      functionalEquivalence: true,
      performanceImprovement: 0.25,
    };

    act(() => {
      result.current.dispatch(setValidationResult(validationResult));
    });

    expect(result.current.state.validationResult).toEqual(validationResult);
    expect(result.current.state.status).toBe('complete');
  });

  it('should reset state to initial values', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    // Add some data
    act(() => {
      result.current.dispatch(setConnected(true));
      result.current.dispatch(setStatus('resurrecting'));
      result.current.dispatch(
        updateMetrics({
          timestamp: Date.now(),
          depsUpdated: 5,
          vulnsFixed: 3,
          complexity: 10,
          coverage: 0.8,
          loc: 1000,
          progress: 0.5,
        })
      );
      result.current.dispatch(
        addTransformation({
          type: 'dependency',
          timestamp: Date.now(),
          details: { name: 'test', success: true },
        })
      );
    });

    expect(result.current.state.isConnected).toBe(true);
    expect(result.current.state.status).toBe('resurrecting');
    expect(result.current.state.metricsHistory).toHaveLength(1);
    expect(result.current.state.transformations).toHaveLength(1);

    // Reset
    act(() => {
      result.current.dispatch(resetState());
    });

    expect(result.current.state.currentMetrics).toBe(null);
    expect(result.current.state.metricsHistory).toEqual([]);
    expect(result.current.state.transformations).toEqual([]);
    expect(result.current.state.narrations).toEqual([]);
    expect(result.current.state.astAnalysis).toBe(null);
    expect(result.current.state.llmInsights).toEqual([]);
    expect(result.current.state.validationResult).toBe(null);
    expect(result.current.state.isConnected).toBe(false);
    expect(result.current.state.status).toBe('idle');
  });

  it('should handle complex state updates in sequence', () => {
    const { result } = renderHook(() => useResurrection(), { wrapper });

    act(() => {
      // Simulate a resurrection flow
      result.current.dispatch(setConnected(true));
      result.current.dispatch(setStatus('analyzing'));
      
      result.current.dispatch(
        setASTAnalysis({
          timestamp: Date.now(),
          complexity: 20,
          loc: 3000,
          functions: 75,
          classes: 15,
        })
      );

      result.current.dispatch(
        addLLMInsight({
          timestamp: Date.now(),
          insight: 'Code uses outdated patterns',
          category: 'modernization',
        })
      );

      result.current.dispatch(setStatus('resurrecting'));

      result.current.dispatch(
        updateMetrics({
          timestamp: Date.now(),
          depsUpdated: 3,
          vulnsFixed: 1,
          complexity: 18,
          coverage: 0.75,
          loc: 2900,
          progress: 0.3,
        })
      );

      result.current.dispatch(
        addTransformation({
          type: 'dependency',
          timestamp: Date.now(),
          details: {
            name: 'lodash',
            oldVersion: '3.0.0',
            newVersion: '4.17.21',
            success: true,
          },
        })
      );

      result.current.dispatch(
        addNarration({
          timestamp: Date.now(),
          message: 'Updated lodash to latest version',
          priority: 'medium',
        })
      );

      result.current.dispatch(setStatus('validating'));

      result.current.dispatch(
        setValidationResult({
          timestamp: Date.now(),
          originalPassed: true,
          modernPassed: true,
          functionalEquivalence: true,
          performanceImprovement: 0.15,
        })
      );
    });

    expect(result.current.state.isConnected).toBe(true);
    expect(result.current.state.status).toBe('complete');
    expect(result.current.state.astAnalysis).not.toBe(null);
    expect(result.current.state.llmInsights).toHaveLength(1);
    expect(result.current.state.metricsHistory).toHaveLength(1);
    expect(result.current.state.transformations).toHaveLength(1);
    expect(result.current.state.narrations).toHaveLength(1);
    expect(result.current.state.validationResult).not.toBe(null);
  });
});
