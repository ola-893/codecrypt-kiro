import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  MetricsSnapshot,
  TransformationEvent,
  NarrationEvent,
  ASTAnalysisResult,
  LLMInsight,
  ValidationResult,
} from '../types';

/**
 * Global state for the resurrection process
 */
export interface ResurrectionState {
  // Current metrics
  currentMetrics: MetricsSnapshot | null;
  
  // Historical metrics for time-series visualization
  metricsHistory: MetricsSnapshot[];
  
  // Transformation events
  transformations: TransformationEvent[];
  
  // Narration events
  narrations: NarrationEvent[];
  
  // AST analysis results
  astAnalysis: ASTAnalysisResult | null;
  
  // LLM insights
  llmInsights: LLMInsight[];
  
  // Validation results
  validationResult: ValidationResult | null;
  
  // Connection status
  isConnected: boolean;
  
  // Overall resurrection status
  status: 'idle' | 'analyzing' | 'resurrecting' | 'validating' | 'complete' | 'error';
}

/**
 * Actions for updating state
 */
export type ResurrectionAction =
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_STATUS'; payload: ResurrectionState['status'] }
  | { type: 'UPDATE_METRICS'; payload: MetricsSnapshot }
  | { type: 'ADD_TRANSFORMATION'; payload: TransformationEvent }
  | { type: 'ADD_NARRATION'; payload: NarrationEvent }
  | { type: 'SET_AST_ANALYSIS'; payload: ASTAnalysisResult }
  | { type: 'ADD_LLM_INSIGHT'; payload: LLMInsight }
  | { type: 'SET_VALIDATION_RESULT'; payload: ValidationResult }
  | { type: 'RESET_STATE' };

/**
 * Initial state
 */
const initialState: ResurrectionState = {
  currentMetrics: null,
  metricsHistory: [],
  transformations: [],
  narrations: [],
  astAnalysis: null,
  llmInsights: [],
  validationResult: null,
  isConnected: false,
  status: 'idle',
};

/**
 * Reducer function
 */
function resurrectionReducer(
  state: ResurrectionState,
  action: ResurrectionAction
): ResurrectionState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return {
        ...state,
        isConnected: action.payload,
      };

    case 'SET_STATUS':
      return {
        ...state,
        status: action.payload,
      };

    case 'UPDATE_METRICS':
      return {
        ...state,
        currentMetrics: action.payload,
        metricsHistory: [...state.metricsHistory, action.payload],
      };

    case 'ADD_TRANSFORMATION':
      return {
        ...state,
        transformations: [...state.transformations, action.payload],
      };

    case 'ADD_NARRATION':
      return {
        ...state,
        narrations: [...state.narrations, action.payload],
      };

    case 'SET_AST_ANALYSIS':
      return {
        ...state,
        astAnalysis: action.payload,
      };

    case 'ADD_LLM_INSIGHT':
      return {
        ...state,
        llmInsights: [...state.llmInsights, action.payload],
      };

    case 'SET_VALIDATION_RESULT':
      return {
        ...state,
        validationResult: action.payload,
        status: 'complete',
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

/**
 * Context type
 */
interface ResurrectionContextType {
  state: ResurrectionState;
  dispatch: React.Dispatch<ResurrectionAction>;
}

/**
 * Create context
 */
const ResurrectionContext = createContext<ResurrectionContextType | undefined>(undefined);

/**
 * Provider component
 */
export function ResurrectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(resurrectionReducer, initialState);

  return (
    <ResurrectionContext.Provider value={{ state, dispatch }}>
      {children}
    </ResurrectionContext.Provider>
  );
}

/**
 * Hook to use the resurrection context
 */
export function useResurrection() {
  const context = useContext(ResurrectionContext);
  
  if (context === undefined) {
    throw new Error('useResurrection must be used within a ResurrectionProvider');
  }
  
  return context;
}
