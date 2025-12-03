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
  /** Baseline compilation result (before resurrection) */
  baselineCompilation?: BaselineCompilationResult;
  /** Final compilation result (after resurrection) */
  finalCompilation?: BaselineCompilationResult;
  /** Resurrection verdict comparing baseline and final */
  resurrectionVerdict?: ResurrectionVerdict;
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
  | 'validation_complete'
  | 'baseline_compilation_complete'
  | 'final_compilation_complete'
  | 'resurrection_verdict'
  // Post-resurrection validation events
  | 'validation_iteration_start'
  | 'validation_error_analysis'
  | 'validation_fix_applied'
  | 'validation_fix_outcome';

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

/**
 * Baseline compilation complete event payload
 */
export interface BaselineCompilationCompleteEventData {
  /** Compilation result */
  result: BaselineCompilationResult;
  /** Summary message */
  summary: string;
}

/**
 * Final compilation complete event payload
 */
export interface FinalCompilationCompleteEventData {
  /** Compilation result */
  result: BaselineCompilationResult;
  /** Summary message */
  summary: string;
}

/**
 * Resurrection verdict event payload
 */
export interface ResurrectionVerdictEventData {
  /** Resurrection verdict */
  verdict: ResurrectionVerdict;
  /** Summary message */
  summary: string;
}

// ============================================================================
// Compilation Proof Engine Types
// ============================================================================

/**
 * Error category for compilation errors
 */
export type ErrorCategory = 'type' | 'import' | 'syntax' | 'dependency' | 'config';

/**
 * Compilation strategy based on project type
 */
export type CompilationStrategy = 'typescript' | 'npm-build' | 'webpack' | 'vite' | 'custom';

/**
 * A single compilation error
 */
export interface CompilationError {
  /** File path where the error occurred */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Error message */
  message: string;
  /** Error code (e.g., "TS2307") */
  code: string;
}

/**
 * Compilation error with category classification
 */
export interface CategorizedError extends CompilationError {
  /** Error category */
  category: ErrorCategory;
  /** Suggested fix for this error */
  suggestedFix?: string;
}

/**
 * Suggestion for fixing compilation errors
 */
export interface FixSuggestion {
  /** Category of errors this fix addresses */
  errorCategory: ErrorCategory;
  /** Human-readable description of the fix */
  description: string;
  /** Whether this fix can be automatically applied */
  autoApplicable: boolean;
  /** Number of errors this fix would address */
  errorCount: number;
  /** Specific details for the fix (e.g., packages to install) */
  details?: string[];
}

/**
 * Result of a compilation check (baseline or final)
 */
export interface BaselineCompilationResult {
  /** Timestamp when compilation was run */
  timestamp: Date;
  /** Whether compilation succeeded */
  success: boolean;
  /** Total number of errors */
  errorCount: number;
  /** List of all errors with categories */
  errors: CategorizedError[];
  /** Error count grouped by category */
  errorsByCategory: Record<ErrorCategory, number>;
  /** Raw compilation output */
  output: string;
  /** Detected project type */
  projectType: 'typescript' | 'javascript' | 'unknown';
  /** Compilation strategy used */
  strategy: CompilationStrategy;
  /** Suggested fixes based on error analysis */
  suggestedFixes: FixSuggestion[];
}

/**
 * Verdict comparing baseline and final compilation results
 */
export interface ResurrectionVerdict {
  /** Baseline compilation result */
  baselineCompilation: BaselineCompilationResult;
  /** Final compilation result */
  finalCompilation: BaselineCompilationResult;
  /** True if baseline failed AND final passed */
  resurrected: boolean;
  /** Number of errors that were fixed */
  errorsFixed: number;
  /** Number of errors remaining */
  errorsRemaining: number;
  /** Errors fixed by category */
  errorsFixedByCategory: Record<ErrorCategory, number>;
  /** Errors remaining by category */
  errorsRemainingByCategory: Record<ErrorCategory, number>;
  /** List of specific errors that were fixed */
  fixedErrors: CategorizedError[];
  /** List of new errors introduced during resurrection */
  newErrors: CategorizedError[];
}


// ============================================================================
// Post-Resurrection Validation Types
// ============================================================================

/**
 * Error category for post-resurrection validation errors
 * These are different from compilation errors - they focus on dependency/installation issues
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
 * Package manager types supported by the validation system
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/**
 * Options for the post-resurrection validation process
 */
export interface ValidationOptions {
  /** Maximum number of fix-retry iterations (default: 10) */
  maxIterations?: number;
  /** Package manager to use (default: auto-detect) */
  packageManager?: PackageManager | 'auto';
  /** Override auto-detected build command */
  buildCommand?: string;
  /** Skip native module fixes */
  skipNativeModules?: boolean;
  /** Timeout for compilation in milliseconds (default: 300000 = 5 min) */
  timeout?: number;
}

/**
 * Result of a compilation attempt
 */
export interface PostResurrectionCompilationResult {
  /** Whether compilation succeeded */
  success: boolean;
  /** Process exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Proof artifact generated on successful compilation
 */
export interface PostResurrectionCompilationProof {
  /** Timestamp when compilation succeeded */
  timestamp: Date;
  /** Build command that was executed */
  buildCommand: string;
  /** Exit code (should be 0) */
  exitCode: number;
  /** Duration in milliseconds */
  duration: number;
  /** SHA-256 hash of the combined output */
  outputHash: string;
  /** Package manager used */
  packageManager: PackageManager;
  /** Number of iterations required */
  iterationsRequired: number;
}

/**
 * Package information extracted from errors
 */
export interface PackageInfo {
  /** Package name */
  name: string;
  /** Requested version constraint */
  requestedVersion?: string;
  /** Currently installed version */
  installedVersion?: string;
  /** Packages this conflicts with */
  conflictsWith?: string[];
}

/**
 * An analyzed error with category and metadata
 */
export interface AnalyzedError {
  /** Error category */
  category: PostResurrectionErrorCategory;
  /** Original error message */
  message: string;
  /** Package name if applicable */
  packageName?: string;
  /** Version constraint if applicable */
  versionConstraint?: string;
  /** Conflicting packages if applicable */
  conflictingPackages?: string[];
  /** Suggested fix strategy */
  suggestedFix?: FixStrategy;
  /** Priority score (higher = more likely root cause) */
  priority: number;
}

/**
 * Result of applying a fix strategy
 */
export interface FixResult {
  /** Whether the fix was applied successfully */
  success: boolean;
  /** The strategy that was applied */
  strategy: FixStrategy;
  /** Error message if fix failed */
  error?: string;
}

/**
 * Record of a fix applied during validation
 */
export interface AppliedFix {
  /** Iteration number when fix was applied */
  iteration: number;
  /** The error that triggered this fix */
  error: AnalyzedError;
  /** The strategy that was applied */
  strategy: FixStrategy;
  /** Result of applying the fix */
  result: FixResult;
}

/**
 * Historical record of a successful fix
 */
export interface HistoricalFix {
  /** Pattern that identifies the error */
  errorPattern: string;
  /** Strategy that successfully fixed it */
  strategy: FixStrategy;
  /** Number of times this fix has succeeded */
  successCount: number;
  /** Last time this fix was used */
  lastUsed: Date;
}

/**
 * Fix history for a repository
 */
export interface FixHistory {
  /** Repository identifier */
  repoId: string;
  /** List of historical fixes */
  fixes: HistoricalFix[];
  /** Last resurrection timestamp */
  lastResurrection: Date;
}

/**
 * Result of the post-resurrection validation process
 */
export interface PostResurrectionValidationResult {
  /** Whether validation succeeded (compilation works) */
  success: boolean;
  /** Number of iterations performed */
  iterations: number;
  /** Compilation proof if successful */
  compilationProof?: PostResurrectionCompilationProof;
  /** List of fixes that were applied */
  appliedFixes: AppliedFix[];
  /** Errors that remain unresolved */
  remainingErrors: AnalyzedError[];
  /** Total duration in milliseconds */
  duration: number;
}

/**
 * Options for compilation
 */
export interface CompileOptions {
  /** Package manager to use */
  packageManager: PackageManager;
  /** Build command to execute */
  buildCommand: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Interface for the CompilationRunner component
 */
export interface ICompilationRunner {
  /** Execute compilation and return result */
  compile(repoPath: string, options: CompileOptions): Promise<PostResurrectionCompilationResult>;
  /** Detect the build command from package.json */
  detectBuildCommand(packageJson: Record<string, unknown>): string;
  /** Detect the package manager from lockfiles */
  detectPackageManager(repoPath: string): Promise<PackageManager>;
}

/**
 * Interface for the ErrorAnalyzer component
 */
export interface IErrorAnalyzer {
  /** Analyze compilation result and extract errors */
  analyze(compilationResult: PostResurrectionCompilationResult): AnalyzedError[];
  /** Categorize a single error message */
  categorize(errorMessage: string): PostResurrectionErrorCategory;
  /** Extract package info from an error */
  extractPackageInfo(error: AnalyzedError): PackageInfo | null;
  /** Prioritize errors by likelihood of being root cause */
  prioritize(errors: AnalyzedError[]): AnalyzedError[];
}

/**
 * Interface for the FixStrategyEngine component
 */
export interface IFixStrategyEngine {
  /** Select the best fix strategy for an error */
  selectStrategy(error: AnalyzedError, history: FixHistory): FixStrategy;
  /** Apply a fix strategy to the repository */
  applyFix(repoPath: string, strategy: FixStrategy): Promise<FixResult>;
  /** Get alternative strategies for an error */
  getAlternativeStrategies(error: AnalyzedError): FixStrategy[];
}

/**
 * Interface for the FixHistoryStore component
 */
export interface IFixHistoryStore {
  /** Record a successful fix */
  recordFix(repoId: string, errorPattern: string, strategy: FixStrategy): void;
  /** Get a previously successful fix for an error pattern */
  getSuccessfulFix(errorPattern: string): FixStrategy | null;
  /** Get the full fix history for a repository */
  getHistory(repoId: string): FixHistory;
  /** Save fix history to persistent storage */
  saveHistory(repoId: string, history: FixHistory): Promise<void>;
  /** Load fix history from persistent storage */
  loadHistory(repoId: string): Promise<FixHistory | null>;
}

/**
 * Interface for the PostResurrectionValidator component
 */
export interface IPostResurrectionValidator {
  /** Run the validation loop */
  validate(repoPath: string, options?: ValidationOptions): Promise<PostResurrectionValidationResult>;
  /** Get fix history for a repository */
  getFixHistory(repoPath: string): FixHistory;
}

// ============================================================================
// Post-Resurrection Validation Event Types
// ============================================================================

/**
 * Event types specific to post-resurrection validation
 */
export type PostResurrectionEventType =
  | 'validation_iteration_start'
  | 'validation_error_analysis'
  | 'validation_fix_applied'
  | 'validation_fix_outcome'
  | 'validation_complete';

/**
 * Payload for validation iteration start event
 */
export interface ValidationIterationStartEventData {
  /** Current iteration number (1-based) */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations: number;
  /** Repository path being validated */
  repoPath: string;
}

/**
 * Payload for validation error analysis event
 */
export interface ValidationErrorAnalysisEventData {
  /** Current iteration number */
  iteration: number;
  /** Number of errors found */
  errorCount: number;
  /** Errors grouped by category */
  errorsByCategory: Record<PostResurrectionErrorCategory, number>;
  /** Top priority errors */
  topErrors: AnalyzedError[];
}

/**
 * Payload for validation fix applied event
 */
export interface ValidationFixAppliedEventData {
  /** Current iteration number */
  iteration: number;
  /** The fix strategy being applied */
  strategy: FixStrategy;
  /** The error being addressed */
  targetError: AnalyzedError;
  /** Human-readable description of the fix */
  description: string;
}

/**
 * Payload for validation fix outcome event
 */
export interface ValidationFixOutcomeEventData {
  /** Current iteration number */
  iteration: number;
  /** Whether the fix was successful */
  success: boolean;
  /** The strategy that was applied */
  strategy: FixStrategy;
  /** Error message if fix failed */
  error?: string;
  /** Whether compilation now succeeds */
  compilationSucceeds: boolean;
}

/**
 * Payload for post-resurrection validation complete event
 */
export interface PostResurrectionValidationCompleteEventData {
  /** Whether validation succeeded */
  success: boolean;
  /** Total iterations performed */
  totalIterations: number;
  /** Total fixes applied */
  totalFixesApplied: number;
  /** Number of successful fixes */
  successfulFixes: number;
  /** Number of remaining errors */
  remainingErrors: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Summary message */
  summary: string;
}

/**
 * Union type for all post-resurrection validation events
 */
export type PostResurrectionValidationEvent =
  | { type: 'validation_iteration_start'; data: ValidationIterationStartEventData }
  | { type: 'validation_error_analysis'; data: ValidationErrorAnalysisEventData }
  | { type: 'validation_fix_applied'; data: ValidationFixAppliedEventData }
  | { type: 'validation_fix_outcome'; data: ValidationFixOutcomeEventData }
  | { type: 'validation_complete'; data: PostResurrectionValidationCompleteEventData };

// ============================================================================
// Post-Resurrection Validation Constants
// ============================================================================

/**
 * Regular expressions for identifying error categories
 */
export const POST_RESURRECTION_ERROR_PATTERNS: Record<PostResurrectionErrorCategory, RegExp> = {
  dependency_not_found: /Cannot find module ['"]([^'"]+)['"]/,
  dependency_version_conflict: /ERESOLVE.*Could not resolve dependency/s,
  peer_dependency_conflict: /npm ERR! peer dep missing|peerDependencies|ERESOLVE.*peer/s,
  native_module_failure: /node-gyp|gyp ERR!|binding\.gyp|prebuild-install/,
  lockfile_conflict: /npm ERR! code ENOLOCK|lockfile version|npm ERR! Invalid: lock/,
  git_dependency_failure: /git dep preparation failed|Permission denied \(publickey\)|Could not resolve git/,
  syntax_error: /SyntaxError:|Unexpected token|Parse error/,
  type_error: /TypeError:|TS\d+:/,
  unknown: /.*/
};

/**
 * Default fix strategies for each error category
 */
export const DEFAULT_FIX_STRATEGIES: Partial<Record<PostResurrectionErrorCategory, FixStrategy[]>> = {
  dependency_version_conflict: [
    { type: 'legacy_peer_deps' },
    { type: 'remove_lockfile', lockfile: 'package-lock.json' },
    { type: 'force_install' }
  ],
  peer_dependency_conflict: [
    { type: 'legacy_peer_deps' },
    { type: 'add_resolution', package: '', version: '' }
  ],
  native_module_failure: [
    { type: 'remove_package', package: '' },
    { type: 'substitute_package', original: '', replacement: '' }
  ],
  lockfile_conflict: [
    { type: 'remove_lockfile', lockfile: 'package-lock.json' }
  ],
  git_dependency_failure: [
    { type: 'substitute_package', original: '', replacement: '' },
    { type: 'remove_package', package: '' }
  ]
};

/**
 * Known substitutions for problematic native modules
 */
export const NATIVE_MODULE_ALTERNATIVES: Record<string, string> = {
  'bcrypt': 'bcryptjs',
  'node-sass': 'sass',
  'fibers': '',  // Remove, no alternative
  'deasync': '',  // Remove, no alternative
  'sharp': '',    // Skip, optional
  'canvas': '',   // Skip, optional
  'sqlite3': 'better-sqlite3',
  'node-canvas': '',  // Skip, optional
  'fsevents': ''  // macOS only, skip on other platforms
};

/**
 * Priority scores for error categories (higher = more likely root cause)
 */
export const ERROR_CATEGORY_PRIORITIES: Record<PostResurrectionErrorCategory, number> = {
  lockfile_conflict: 100,
  dependency_version_conflict: 90,
  peer_dependency_conflict: 80,
  native_module_failure: 70,
  git_dependency_failure: 60,
  dependency_not_found: 50,
  syntax_error: 40,
  type_error: 30,
  unknown: 10
};

// ============================================================================
// Smart Dependency Updates Types
// ============================================================================

/**
 * Package replacement mapping from deprecated to modern package
 */
export interface PackageReplacement {
  /** Original deprecated package name */
  oldName: string;
  /** Modern replacement package name */
  newName: string;
  /** Version mapping from original to replacement versions */
  versionMapping: Record<string, string>;
  /** Whether this replacement requires code changes */
  requiresCodeChanges: boolean;
  /** Description of required code changes */
  codeChangeDescription?: string;
  /** Import path mappings (old import → new import) */
  importMappings?: Record<string, string>;
}

/**
 * Architecture incompatibility entry
 */
export interface ArchitectureIncompatibleEntry {
  /** Package name */
  packageName: string;
  /** List of incompatible architectures (e.g., 'arm64', 'arm') */
  incompatibleArchitectures: string[];
  /** Replacement package if available */
  replacement?: string;
  /** Reason for incompatibility */
  reason: string;
}

/**
 * Complete replacement registry schema
 */
export interface ReplacementRegistrySchema {
  /** Schema version */
  version: string;
  /** Last update timestamp */
  lastUpdated: string;
  /** List of package replacements */
  replacements: PackageReplacement[];
  /** List of architecture-incompatible packages */
  architectureIncompatible: ArchitectureIncompatibleEntry[];
  /** List of known dead URLs */
  knownDeadUrls: string[];
}

/**
 * Interface for the PackageReplacementRegistry component
 */
export interface IPackageReplacementRegistry {
  /** Load registry from file */
  load(): Promise<void>;
  /** Save registry to file */
  save(): Promise<void>;
  /** Look up replacement for a package */
  lookup(packageName: string): PackageReplacement | null;
  /** Add a new replacement to the registry */
  add(replacement: PackageReplacement): void;
  /** Get all replacements */
  getAll(): PackageReplacement[];
}

/**
 * Reason why a dependency is blocking
 */
export type BlockingReason =
  | 'architecture_incompatible'  // e.g., node-sass on ARM64
  | 'dead_url'                   // GitHub archive URL 404
  | 'deprecated_no_replacement'  // Package deprecated with no alternative
  | 'build_failure'              // Known build issues
  | 'peer_conflict';             // Unresolvable peer dependencies

/**
 * A dependency that blocks npm install from completing
 */
export interface BlockingDependency {
  /** Package name */
  name: string;
  /** Package version */
  version: string;
  /** Reason why this dependency is blocking */
  reason: BlockingReason;
  /** Replacement package if available */
  replacement?: PackageReplacement;
}

/**
 * Interface for the BlockingDependencyDetector component
 */
export interface IBlockingDependencyDetector {
  /** Detect all blocking dependencies in a dependency map */
  detect(dependencies: Map<string, string>): Promise<BlockingDependency[]>;
  /** Check if a package is known to be blocking */
  isKnownBlocking(packageName: string): boolean;
  /** Get the blocking reason for a package */
  getBlockingReason(packageName: string): BlockingReason | null;
}

/**
 * Result of URL validation
 */
export interface URLValidationResult {
  /** The URL that was validated */
  url: string;
  /** Whether the URL is valid and accessible */
  isValid: boolean;
  /** HTTP status code if available */
  statusCode?: number;
  /** Alternative npm registry version if URL is dead */
  alternativeVersion?: string;
  /** Any error message if validation failed */
  error?: string;
}

/**
 * Interface for the URLValidator component
 */
export interface IURLValidator {
  /** Validate a URL-based package version */
  validate(url: string): Promise<URLValidationResult>;
  /** Find npm registry alternative for a package */
  findNpmAlternative(packageName: string): Promise<string | null>;
  /** Extract package name from a GitHub archive URL */
  extractPackageFromUrl(url: string): string | null;
}
