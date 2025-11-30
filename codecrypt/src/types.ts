/**
 * Core types for CodeCrypt Resurrection Flow
 */

/**
 * Status of a dependency update operation
 */
export type UpdateStatus = 'pending' | 'success' | 'failed';

/**
 * Information about a single dependency
 */
export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Current version installed */
  currentVersion: string;
  /** Latest stable version available */
  latestVersion: string;
  /** Known security vulnerabilities */
  vulnerabilities: VulnerabilityInfo[];
  /** Status of the update operation */
  updateStatus: UpdateStatus;
}

/**
 * Security vulnerability information
 */
export interface VulnerabilityInfo {
  /** Vulnerability ID (e.g., CVE number) */
  id: string;
  /** Severity level */
  severity: 'low' | 'moderate' | 'high' | 'critical';
  /** Description of the vulnerability */
  description?: string;
}

/**
 * Entry in the transformation log
 */
export interface TransformationLogEntry {
  /** Timestamp of the operation */
  timestamp: Date;
  /** Type of operation performed */
  type: 'dependency_update' | 'code_transformation' | 'test_run' | 'rollback' | 'error';
  /** Description of the operation */
  message: string;
  /** Additional details */
  details?: any;
}

/**
 * Resurrection plan item representing a single update operation
 */
export interface ResurrectionPlanItem {
  /** Package name to update */
  packageName: string;
  /** Current version */
  currentVersion: string;
  /** Target version to update to */
  targetVersion: string;
  /** Priority level (higher = more important) */
  priority: number;
  /** Reason for the update */
  reason: string;
  /** Whether this update fixes security vulnerabilities */
  fixesVulnerabilities: boolean;
  /** Number of vulnerabilities fixed */
  vulnerabilityCount: number;
}

/**
 * Complete resurrection plan
 */
export interface ResurrectionPlan {
  /** Ordered list of updates to perform */
  items: ResurrectionPlanItem[];
  /** Total number of updates */
  totalUpdates: number;
  /** Number of security patches */
  securityPatches: number;
  /** Strategy used for planning */
  strategy: 'conservative' | 'moderate' | 'aggressive';
  /** Timestamp when plan was generated */
  generatedAt: Date;
}

/**
 * Main context object for the resurrection process
 */
export interface ResurrectionContext {
  /** GitHub repository URL */
  repoUrl: string;
  /** Whether the repository is classified as dead */
  isDead: boolean;
  /** Date of last commit */
  lastCommitDate?: Date;
  /** List of dependencies to be updated */
  dependencies: DependencyInfo[];
  /** Log of all transformation operations */
  transformationLog: TransformationLogEntry[];
  /** Path to the cloned repository */
  repoPath?: string;
  /** Name of the resurrection branch */
  resurrectionBranch?: string;
  /** Resurrection plan with ordered updates */
  resurrectionPlan?: ResurrectionPlan;
}

/**
 * Configuration options for the resurrection process
 */
export interface ResurrectionConfig {
  /** Strategy for dependency updates */
  strategy: 'conservative' | 'moderate' | 'aggressive';
  /** Whether to create a pull request */
  createPullRequest: boolean;
  /** Maximum number of retry attempts for network operations */
  maxRetries: number;
}

/**
 * Dependency analysis report
 */
export interface DependencyReport {
  /** Total number of dependencies analyzed */
  totalDependencies: number;
  /** Number of outdated dependencies */
  outdatedDependencies: number;
  /** Number of dependencies with security vulnerabilities */
  vulnerableDependencies: number;
  /** Total number of security vulnerabilities */
  totalVulnerabilities: number;
  /** List of all dependencies */
  dependencies: DependencyInfo[];
  /** Timestamp when the report was generated */
  generatedAt: Date;
}

/**
 * Result of a resurrection operation
 */
export interface ResurrectionResult {
  /** Whether the resurrection was successful */
  success: boolean;
  /** Summary message */
  message: string;
  /** Number of dependencies updated */
  dependenciesUpdated: number;
  /** Number of vulnerabilities fixed */
  vulnerabilitiesFixed: number;
  /** URL to the resurrection branch or PR */
  branchUrl?: string;
  /** URL to the pull request (if created) */
  pullRequestUrl?: string;
  /** Any errors encountered */
  errors?: string[];
}

/**
 * Function signature extracted from AST
 */
export interface FunctionSignature {
  /** Function name */
  name: string;
  /** Parameter names and types */
  parameters: Array<{ name: string; type?: string }>;
  /** Return type if available */
  returnType?: string;
  /** Whether function is async */
  isAsync: boolean;
  /** Whether function is exported */
  isExported: boolean;
  /** Location in source file */
  location: { start: number; end: number };
}

/**
 * Module dependency relationship
 */
export interface ModuleDependency {
  /** Source module path */
  source: string;
  /** Target module path */
  target: string;
  /** Type of import (default, named, namespace) */
  importType: 'default' | 'named' | 'namespace' | 'dynamic';
  /** Imported identifiers */
  identifiers: string[];
}

/**
 * Cyclomatic complexity metrics
 */
export interface ComplexityMetrics {
  /** Cyclomatic complexity score */
  cyclomatic: number;
  /** Cognitive complexity score */
  cognitive?: number;
  /** Number of decision points */
  decisionPoints: number;
}

/**
 * Code structure information
 */
export interface CodeStructure {
  /** Classes defined in the file */
  classes: Array<{
    name: string;
    methods: string[];
    properties: string[];
    isExported: boolean;
  }>;
  /** Functions defined in the file */
  functions: FunctionSignature[];
  /** Imports in the file */
  imports: ModuleDependency[];
  /** Exports from the file */
  exports: Array<{ name: string; type: 'default' | 'named' }>;
}

/**
 * AST analysis result for a single file
 */
export interface FileASTAnalysis {
  /** File path relative to repository root */
  filePath: string;
  /** File type (js, ts, jsx, tsx) */
  fileType: 'js' | 'ts' | 'jsx' | 'tsx';
  /** Lines of code */
  linesOfCode: number;
  /** Code structure */
  structure: CodeStructure;
  /** Complexity metrics */
  complexity: ComplexityMetrics;
  /** Call graph (function calls within this file) */
  callGraph: Array<{ caller: string; callee: string }>;
  /** Any parsing errors */
  errors?: string[];
}

/**
 * Complete AST analysis for a repository
 */
export interface ASTAnalysis {
  /** Analysis results for each file */
  files: FileASTAnalysis[];
  /** Total lines of code */
  totalLOC: number;
  /** Average complexity */
  averageComplexity: number;
  /** Module dependency graph */
  dependencyGraph: ModuleDependency[];
  /** Timestamp when analysis was performed */
  analyzedAt: Date;
}

/**
 * LLM semantic insight for a code snippet
 */
export interface LLMInsight {
  /** File path being analyzed */
  filePath: string;
  /** Developer intent extracted from code */
  developerIntent: string;
  /** Domain concepts identified */
  domainConcepts: string[];
  /** Idiomatic patterns found */
  idiomaticPatterns: string[];
  /** Anti-patterns identified */
  antiPatterns: string[];
  /** Modernization suggestions */
  modernizationSuggestions: string[];
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Complete LLM analysis for a repository
 */
export interface LLMAnalysis {
  /** Insights for each analyzed file */
  insights: LLMInsight[];
  /** Overall project intent/purpose */
  projectIntent?: string;
  /** Key domain concepts across the project */
  keyDomainConcepts: string[];
  /** Overall modernization strategy */
  modernizationStrategy?: string;
  /** Timestamp when analysis was performed */
  analyzedAt: Date;
}

/**
 * Combined analysis merging AST and LLM insights
 */
export interface HybridAnalysis {
  /** AST structural analysis */
  astAnalysis: ASTAnalysis;
  /** LLM semantic analysis */
  llmAnalysis: LLMAnalysis;
  /** Combined insights for planning */
  combinedInsights: {
    /** Files prioritized for modernization */
    priorityFiles: Array<{
      filePath: string;
      reason: string;
      priority: number;
    }>;
    /** Recommended refactoring opportunities */
    refactoringOpportunities: Array<{
      filePath: string;
      description: string;
      impact: 'low' | 'medium' | 'high';
    }>;
    /** Overall modernization recommendations */
    recommendations: string[];
  };
  /** Timestamp when combined analysis was performed */
  analyzedAt: Date;
}

/**
 * Snapshot of metrics at a specific point in time
 */
export interface MetricsSnapshot {
  /** Timestamp when metrics were captured */
  timestamp: number;
  /** Number of dependencies updated */
  depsUpdated: number;
  /** Number of security vulnerabilities fixed */
  vulnsFixed: number;
  /** Code complexity score */
  complexity: number;
  /** Test coverage percentage (0-100) */
  coverage: number;
  /** Lines of code */
  loc: number;
  /** Overall progress percentage (0-100) */
  progress: number;
}

/**
 * Complete metrics history for visualization
 */
export interface MetricsHistory {
  /** Array of metric snapshots over time */
  snapshots: MetricsSnapshot[];
  /** Initial baseline metrics */
  baseline: MetricsSnapshot;
  /** Current metrics */
  current: MetricsSnapshot;
}

/**
 * Time Machine validation configuration
 */
export interface TimeMachineConfig {
  /** Node.js version to use for original environment */
  originalNodeVersion: string;
  /** Path to repository */
  repoPath: string;
  /** Whether to run validation */
  enabled: boolean;
}

/**
 * Test execution result
 */
export interface TestExecutionResult {
  /** Whether tests passed */
  passed: boolean;
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Number of tests run */
  testsRun?: number;
  /** Number of tests passed */
  testsPassed?: number;
  /** Number of tests failed */
  testsFailed?: number;
}

/**
 * Time Machine validation result
 */
export interface TimeMachineValidationResult {
  /** Whether validation was successful */
  success: boolean;
  /** Original environment test results */
  originalResults: TestExecutionResult;
  /** Modernized environment test results */
  modernResults: TestExecutionResult;
  /** Whether the two versions are functionally equivalent */
  functionalEquivalence: boolean;
  /** Performance improvement percentage (positive = faster) */
  performanceImprovement: number;
  /** Detailed comparison report */
  comparisonReport: string;
  /** Any errors encountered */
  errors?: string[];
}

/**
 * Event types for the resurrection process
 */
export type ResurrectionEventType =
  | 'transformation_applied'
  | 'dependency_updated'
  | 'test_completed'
  | 'metric_updated'
  | 'narration'
  | 'ast_analysis_complete'
  | 'llm_insight'
  | 'validation_complete';

/**
 * Base event interface
 */
export interface ResurrectionEvent<T = any> {
  /** Event type */
  type: ResurrectionEventType;
  /** Event timestamp */
  timestamp: number;
  /** Event payload */
  data: T;
}

/**
 * Transformation applied event payload
 */
export interface TransformationAppliedEventData {
  /** Type of transformation */
  transformationType: 'dependency_update' | 'code_transformation' | 'test_run';
  /** Package name (for dependency updates) */
  packageName?: string;
  /** Version information (for dependency updates) */
  version?: {
    from: string;
    to: string;
  };
  /** Transformation details */
  details: any;
  /** Whether the transformation was successful */
  success: boolean;
}

/**
 * Dependency updated event payload
 */
export interface DependencyUpdatedEventData {
  /** Package name */
  packageName: string;
  /** Previous version */
  previousVersion: string;
  /** New version */
  newVersion: string;
  /** Whether the update was successful */
  success: boolean;
  /** Number of vulnerabilities fixed */
  vulnerabilitiesFixed: number;
}

/**
 * Test completed event payload
 */
export interface TestCompletedEventData {
  /** Test type */
  testType: 'unit' | 'integration' | 'e2e';
  /** Whether tests passed */
  passed: boolean;
  /** Test coverage percentage */
  coverage?: number;
  /** Number of tests run */
  testsRun?: number;
  /** Number of tests passed */
  testsPassed?: number;
  /** Number of tests failed */
  testsFailed?: number;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Metric updated event payload
 */
export interface MetricUpdatedEventData extends MetricsSnapshot {
  /** Delta from baseline */
  delta?: {
    depsUpdated: number;
    vulnsFixed: number;
    complexityChange: number;
    coverageChange: number;
  };
}

/**
 * Narration event payload
 */
export interface NarrationEventData {
  /** Message to narrate */
  message: string;
  /** Priority level */
  priority?: 'low' | 'medium' | 'high';
  /** Category of narration */
  category?: 'info' | 'success' | 'warning' | 'error';
}

/**
 * AST analysis complete event payload
 */
export interface ASTAnalysisCompleteEventData {
  /** AST analysis results */
  analysis: ASTAnalysis;
  /** Summary message */
  summary: string;
}

/**
 * LLM insight event payload
 */
export interface LLMInsightEventData {
  /** File path being analyzed */
  filePath: string;
  /** Insight from LLM */
  insight: LLMInsight;
  /** Summary message */
  summary: string;
}

/**
 * Validation complete event payload
 */
export interface ValidationCompleteEventData {
  /** Validation results */
  results: TimeMachineValidationResult;
  /** Summary message */
  summary: string;
}
