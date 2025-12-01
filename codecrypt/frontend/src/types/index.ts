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
  | 'resurrection_verdict'
  // Post-resurrection validation events
  | 'validation_iteration_start'
  | 'validation_error_analysis'
  | 'validation_fix_applied'
  | 'validation_fix_outcome';

// ============================================================================
// Post-Resurrection Validation Types
// ============================================================================

/**
 * Error category for post-resurrection validation errors
 */
export type PostResurrectionErrorCategory =
  | 'dependency_not_found'
  | 'dependency_version_conflict'
  | 'peer_dependency_conflict'
  | 'native_module_failure'
  | 'lockfile_conflict'
  | 'git_dependency_failure'
  | 'syntax_error'
  | 'type_error'
  | 'unknown';

/**
 * Fix strategy types for resolving post-resurrection errors
 */
export type FixStrategy =
  | { type: 'adjust_version'; package: string; newVersion: string }
  | { type: 'legacy_peer_deps' }
  | { type: 'remove_lockfile'; lockfile: string }
  | { type: 'substitute_package'; original: string; replacement: string }
  | { type: 'remove_package'; package: string }
  | { type: 'add_resolution'; package: string; version: string }
  | { type: 'force_install' };

/**
 * An analyzed error with category and metadata
 */
export interface AnalyzedError {
  category: PostResurrectionErrorCategory;
  message: string;
  packageName?: string;
  versionConstraint?: string;
  conflictingPackages?: string[];
  priority: number;
}

/**
 * Payload for validation iteration start event
 */
export interface ValidationIterationStartEvent {
  iteration: number;
  maxIterations: number;
  repoPath: string;
}

/**
 * Payload for validation error analysis event
 */
export interface ValidationErrorAnalysisEvent {
  iteration: number;
  errorCount: number;
  errorsByCategory: Record<PostResurrectionErrorCategory, number>;
  topErrors: AnalyzedError[];
}

/**
 * Payload for validation fix applied event
 */
export interface ValidationFixAppliedEvent {
  iteration: number;
  strategy: FixStrategy;
  targetError: AnalyzedError;
  description: string;
}

/**
 * Payload for validation fix outcome event
 */
export interface ValidationFixOutcomeEvent {
  iteration: number;
  success: boolean;
  strategy: FixStrategy;
  error?: string;
  compilationSucceeds: boolean;
}

/**
 * Post-resurrection validation status for dashboard display
 */
export interface PostResurrectionValidationStatus {
  isRunning: boolean;
  currentIteration: number;
  maxIterations: number;
  errorCount: number;
  errorsByCategory: Record<PostResurrectionErrorCategory, number>;
  appliedFixes: Array<{
    iteration: number;
    description: string;
    success: boolean;
  }>;
  success: boolean | null;
}

export interface SSEEvent {
  type: EventType;
  data: MetricsSnapshot | TransformationEvent | NarrationEvent | ASTAnalysisResult | LLMInsight | ValidationResult | CompilationResult | ResurrectionVerdict | ValidationIterationStartEvent | ValidationErrorAnalysisEvent | ValidationFixAppliedEvent | ValidationFixOutcomeEvent;
}

// Re-export ghost tour types
export type { Building, BuildingSnapshot, FileHistory, GitCommit } from './ghostTour';
export type { TimelinePoint } from '../utils/gitHistoryProcessor';
