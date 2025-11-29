/**
 * Core types for CodeCrypt frontend
 */

export interface MetricsSnapshot {
  timestamp: number;
  depsUpdated: number;
  vulnsFixed: number;
  complexity: number;
  coverage: number;
  loc: number;
  progress: number;
}

export interface TransformationEvent {
  type: 'dependency' | 'code' | 'test' | 'validation';
  timestamp: number;
  details: {
    name?: string;
    oldVersion?: string;
    newVersion?: string;
    success?: boolean;
    message?: string;
  };
}

export interface NarrationEvent {
  timestamp: number;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ASTAnalysisResult {
  timestamp: number;
  complexity: number;
  loc: number;
  functions: number;
  classes: number;
}

export interface LLMInsight {
  timestamp: number;
  insight: string;
  category: 'modernization' | 'refactoring' | 'security' | 'performance';
}

export interface ValidationResult {
  timestamp: number;
  originalPassed: boolean;
  modernPassed: boolean;
  functionalEquivalence: boolean;
  performanceImprovement: number;
}

export type EventType = 
  | 'metric_updated'
  | 'transformation_applied'
  | 'narration'
  | 'ast_analysis_complete'
  | 'llm_insight'
  | 'validation_complete';

export interface SSEEvent {
  type: EventType;
  data: MetricsSnapshot | TransformationEvent | NarrationEvent | ASTAnalysisResult | LLMInsight | ValidationResult;
}
