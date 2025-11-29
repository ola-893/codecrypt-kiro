import { describe, it, expect } from 'vitest';
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

describe('Action Creators', () => {
  describe('setConnected', () => {
    it('should create SET_CONNECTED action with true', () => {
      const action = setConnected(true);
      expect(action).toEqual({
        type: 'SET_CONNECTED',
        payload: true,
      });
    });

    it('should create SET_CONNECTED action with false', () => {
      const action = setConnected(false);
      expect(action).toEqual({
        type: 'SET_CONNECTED',
        payload: false,
      });
    });
  });

  describe('setStatus', () => {
    it('should create SET_STATUS action with idle status', () => {
      const action = setStatus('idle');
      expect(action).toEqual({
        type: 'SET_STATUS',
        payload: 'idle',
      });
    });

    it('should create SET_STATUS action with analyzing status', () => {
      const action = setStatus('analyzing');
      expect(action).toEqual({
        type: 'SET_STATUS',
        payload: 'analyzing',
      });
    });

    it('should create SET_STATUS action with resurrecting status', () => {
      const action = setStatus('resurrecting');
      expect(action).toEqual({
        type: 'SET_STATUS',
        payload: 'resurrecting',
      });
    });

    it('should create SET_STATUS action with validating status', () => {
      const action = setStatus('validating');
      expect(action).toEqual({
        type: 'SET_STATUS',
        payload: 'validating',
      });
    });

    it('should create SET_STATUS action with complete status', () => {
      const action = setStatus('complete');
      expect(action).toEqual({
        type: 'SET_STATUS',
        payload: 'complete',
      });
    });

    it('should create SET_STATUS action with error status', () => {
      const action = setStatus('error');
      expect(action).toEqual({
        type: 'SET_STATUS',
        payload: 'error',
      });
    });
  });

  describe('updateMetrics', () => {
    it('should create UPDATE_METRICS action', () => {
      const metrics: MetricsSnapshot = {
        timestamp: 1234567890,
        depsUpdated: 5,
        vulnsFixed: 3,
        complexity: 10,
        coverage: 0.8,
        loc: 1000,
        progress: 0.5,
      };

      const action = updateMetrics(metrics);
      expect(action).toEqual({
        type: 'UPDATE_METRICS',
        payload: metrics,
      });
    });
  });

  describe('addTransformation', () => {
    it('should create ADD_TRANSFORMATION action for dependency update', () => {
      const transformation: TransformationEvent = {
        type: 'dependency',
        timestamp: 1234567890,
        details: {
          name: 'react',
          oldVersion: '17.0.0',
          newVersion: '18.0.0',
          success: true,
        },
      };

      const action = addTransformation(transformation);
      expect(action).toEqual({
        type: 'ADD_TRANSFORMATION',
        payload: transformation,
      });
    });

    it('should create ADD_TRANSFORMATION action for code transformation', () => {
      const transformation: TransformationEvent = {
        type: 'code',
        timestamp: 1234567890,
        details: {
          message: 'Refactored authentication module',
          success: true,
        },
      };

      const action = addTransformation(transformation);
      expect(action).toEqual({
        type: 'ADD_TRANSFORMATION',
        payload: transformation,
      });
    });
  });

  describe('addNarration', () => {
    it('should create ADD_NARRATION action', () => {
      const narration: NarrationEvent = {
        timestamp: 1234567890,
        message: 'Starting resurrection process',
        priority: 'high',
      };

      const action = addNarration(narration);
      expect(action).toEqual({
        type: 'ADD_NARRATION',
        payload: narration,
      });
    });

    it('should create ADD_NARRATION action with different priorities', () => {
      const lowPriority: NarrationEvent = {
        timestamp: 1234567890,
        message: 'Minor update',
        priority: 'low',
      };

      const mediumPriority: NarrationEvent = {
        timestamp: 1234567891,
        message: 'Updating dependency',
        priority: 'medium',
      };

      const highPriority: NarrationEvent = {
        timestamp: 1234567892,
        message: 'Critical security fix',
        priority: 'high',
      };

      expect((addNarration(lowPriority) as { payload: NarrationEvent }).payload.priority).toBe('low');
      expect((addNarration(mediumPriority) as { payload: NarrationEvent }).payload.priority).toBe('medium');
      expect((addNarration(highPriority) as { payload: NarrationEvent }).payload.priority).toBe('high');
    });
  });

  describe('setASTAnalysis', () => {
    it('should create SET_AST_ANALYSIS action', () => {
      const analysis: ASTAnalysisResult = {
        timestamp: 1234567890,
        complexity: 15,
        loc: 2000,
        functions: 50,
        classes: 10,
      };

      const action = setASTAnalysis(analysis);
      expect(action).toEqual({
        type: 'SET_AST_ANALYSIS',
        payload: analysis,
      });
    });
  });

  describe('addLLMInsight', () => {
    it('should create ADD_LLM_INSIGHT action for modernization', () => {
      const insight: LLMInsight = {
        timestamp: 1234567890,
        insight: 'Consider using async/await',
        category: 'modernization',
      };

      const action = addLLMInsight(insight);
      expect(action).toEqual({
        type: 'ADD_LLM_INSIGHT',
        payload: insight,
      });
    });

    it('should create ADD_LLM_INSIGHT action for different categories', () => {
      const modernization: LLMInsight = {
        timestamp: 1234567890,
        insight: 'Use modern syntax',
        category: 'modernization',
      };

      const refactoring: LLMInsight = {
        timestamp: 1234567891,
        insight: 'Extract common logic',
        category: 'refactoring',
      };

      const security: LLMInsight = {
        timestamp: 1234567892,
        insight: 'Fix SQL injection',
        category: 'security',
      };

      const performance: LLMInsight = {
        timestamp: 1234567893,
        insight: 'Optimize loop',
        category: 'performance',
      };

      expect((addLLMInsight(modernization) as { payload: LLMInsight }).payload.category).toBe('modernization');
      expect((addLLMInsight(refactoring) as { payload: LLMInsight }).payload.category).toBe('refactoring');
      expect((addLLMInsight(security) as { payload: LLMInsight }).payload.category).toBe('security');
      expect((addLLMInsight(performance) as { payload: LLMInsight }).payload.category).toBe('performance');
    });
  });

  describe('setValidationResult', () => {
    it('should create SET_VALIDATION_RESULT action with successful validation', () => {
      const result: ValidationResult = {
        timestamp: 1234567890,
        originalPassed: true,
        modernPassed: true,
        functionalEquivalence: true,
        performanceImprovement: 0.25,
      };

      const action = setValidationResult(result);
      expect(action).toEqual({
        type: 'SET_VALIDATION_RESULT',
        payload: result,
      });
    });

    it('should create SET_VALIDATION_RESULT action with failed validation', () => {
      const result: ValidationResult = {
        timestamp: 1234567890,
        originalPassed: true,
        modernPassed: false,
        functionalEquivalence: false,
        performanceImprovement: 0,
      };

      const action = setValidationResult(result);
      expect(action).toEqual({
        type: 'SET_VALIDATION_RESULT',
        payload: result,
      });
    });
  });

  describe('resetState', () => {
    it('should create RESET_STATE action', () => {
      const action = resetState();
      expect(action).toEqual({
        type: 'RESET_STATE',
      });
    });
  });
});
