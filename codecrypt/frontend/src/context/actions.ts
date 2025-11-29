import {
  ResurrectionAction,
  ResurrectionState,
} from './ResurrectionContext';
import {
  MetricsSnapshot,
  TransformationEvent,
  NarrationEvent,
  ASTAnalysisResult,
  LLMInsight,
  ValidationResult,
} from '../types';

/**
 * Action creators for cleaner dispatch calls
 */

export const setConnected = (isConnected: boolean): ResurrectionAction => ({
  type: 'SET_CONNECTED',
  payload: isConnected,
});

export const setStatus = (status: ResurrectionState['status']): ResurrectionAction => ({
  type: 'SET_STATUS',
  payload: status,
});

export const updateMetrics = (metrics: MetricsSnapshot): ResurrectionAction => ({
  type: 'UPDATE_METRICS',
  payload: metrics,
});

export const addTransformation = (transformation: TransformationEvent): ResurrectionAction => ({
  type: 'ADD_TRANSFORMATION',
  payload: transformation,
});

export const addNarration = (narration: NarrationEvent): ResurrectionAction => ({
  type: 'ADD_NARRATION',
  payload: narration,
});

export const setASTAnalysis = (analysis: ASTAnalysisResult): ResurrectionAction => ({
  type: 'SET_AST_ANALYSIS',
  payload: analysis,
});

export const addLLMInsight = (insight: LLMInsight): ResurrectionAction => ({
  type: 'ADD_LLM_INSIGHT',
  payload: insight,
});

export const setValidationResult = (result: ValidationResult): ResurrectionAction => ({
  type: 'SET_VALIDATION_RESULT',
  payload: result,
});

export const resetState = (): ResurrectionAction => ({
  type: 'RESET_STATE',
});
