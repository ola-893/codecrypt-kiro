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

/**
 * Error category for compilation errors
 */
export type ErrorCategory = 'type' | 'import' | 'syntax' | 'dependency' | 'config';

/**
 * Compilation result from backend
 */
export interface CompilationResult {
  timestamp: number;
  success: boolean;
  errorCount: number;
  errorsByCategory: Record<ErrorCategory, number>;
  projectType: 'typescript' | 'javascript' | 'unknown';
}

/**
 * Resurrection verdict comparing baseline and final compilation
 */
export interface ResurrectionVerdict {
  resurrected: boolean;
  errorsFixed: number;
  errorsRemaining: number;
  errorsFixedByCategory: Record<ErrorCategory, number>;
  errorsRemainingByCategory: Record<ErrorCategory, number>;
}

/**
 * Compilation status for dashboard display
 */
export interface CompilationStatus {
  baseline: CompilationResult | null;
  final: CompilationResult | null;
  verdict: ResurrectionVerdict | null;
}

export type EventType = 
  | 'metric_updated'
  | 'transformation_applied'
  | 'narration'
  | 'ast_analysis_complete'
  | 'llm_insight'
  | 'validation_complete'
  | 'baseline_compilation_complete'
  | 'final_compilation_complete'
  | 'resurrection_verdict';

export interface SSEEvent {
  type: EventType;
  data: MetricsSnapshot | TransformationEvent | NarrationEvent | ASTAnalysisResult | LLMInsight | ValidationResult | CompilationResult | ResurrectionVerdict;
}

// Re-export ghost tour types
export type { Building, BuildingSnapshot, FileHistory, GitCommit } from './ghostTour';
export type { TimelinePoint } from '../utils/gitHistoryProcessor';
