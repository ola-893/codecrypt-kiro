/**
 * Reporting Service
 * Generates resurrection reports in Markdown format
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  ResurrectionContext, 
  TransformationLogEntry, 
  VulnerabilityInfo,
  HybridAnalysis,
  MetricsSnapshot,
  TimeMachineValidationResult,
  ResurrectionVerdict,
  ErrorCategory,
  CategorizedError,
  FixSuggestion,
  PostResurrectionValidationResult,
  AppliedFix,
  AnalyzedError,
  FixHistory,
  FixStrategy,
  PostResurrectionErrorCategory,
  BatchExecutionResult,
  PackageUpdateResult,
  LLMAnalysis
} from '../types';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';
import { DeadUrlHandlingSummary } from './deadUrlHandler';

const logger = getLogger();

/**
 * Resurrection report data structure
 */
export interface ResurrectionReport {
  /** Summary of the resurrection process */
  summary: string;
  /** List of updated dependencies */
  updatedDependencies: DependencyUpdate[];
  /** List of security vulnerabilities fixed */
  vulnerabilitiesFixed: VulnerabilityFix[];
  /** Link to the resurrection branch */
  branchUrl?: string;
  /** Statistics about the resurrection */
  statistics: ResurrectionStatistics;
  /** Hybrid analysis insights */
  hybridAnalysis?: HybridAnalysis;
  /** Metrics before and after resurrection */
  metricsComparison?: {
    before: MetricsSnapshot;
    after: MetricsSnapshot;
  };
  /** Time Machine validation results */
  timeMachineResults?: TimeMachineValidationResult;
  /** Resurrection verdict with compilation proof */
  resurrectionVerdict?: ResurrectionVerdict;
  /** Path to 3D Ghost Tour HTML file */
  ghostTourPath?: string;
  /** Path to Resurrection Symphony audio file */
  symphonyPath?: string;
  /** Path to dashboard screenshots */
  dashboardScreenshots?: string[];
  /** Post-resurrection validation summary */
  validationSummary?: ValidationSummary;
  /** Batch execution summary */
  batchExecutionSummary?: BatchExecutionSummary;
  /** LLM analysis summary */
  llmAnalysisSummary?: LLMAnalysisSummary;
  /** Dead URL handling summary */
  deadUrlSummary?: DeadUrlReportSummary;
  /** Markdown formatted report */
  markdown: string;
}

/**
 * Information about a dependency update
 */
export interface DependencyUpdate {
  /** Package name */
  packageName: string;
  /** Old version */
  oldVersion: string;
  /** New version */
  newVersion: string;
  /** Whether this update fixed vulnerabilities */
  fixedVulnerabilities: boolean;
  /** Number of vulnerabilities fixed */
  vulnerabilityCount: number;
}

/**
 * Information about a fixed vulnerability
 */
export interface VulnerabilityFix {
  /** Package name */
  packageName: string;
  /** Vulnerability details */
  vulnerability: VulnerabilityInfo;
}

/**
 * Statistics about the resurrection
 */
export interface ResurrectionStatistics {
  /** Total dependencies updated */
  totalUpdates: number;
  /** Successful updates */
  successfulUpdates: number;
  /** Failed updates */
  failedUpdates: number;
  /** Total vulnerabilities fixed */
  totalVulnerabilitiesFixed: number;
  /** Critical vulnerabilities fixed */
  criticalVulnerabilitiesFixed: number;
  /** High vulnerabilities fixed */
  highVulnerabilitiesFixed: number;
}

/**
 * Summary of post-resurrection validation results
 * Includes iteration count, applied fixes, remaining errors, and fix history
 * 
 * _Requirements: 6.4_
 */
export interface ValidationSummary {
  /** Whether validation succeeded */
  success: boolean;
  /** Number of iterations performed */
  iterationCount: number;
  /** Maximum iterations allowed */
  maxIterations: number;
  /** Total duration in milliseconds */
  duration: number;
  /** List of fixes that were applied during validation */
  appliedFixes: AppliedFixSummary[];
  /** Errors that remain unresolved after validation */
  remainingErrors: ErrorSummary[];
  /** Fix history for the repository */
  fixHistory?: FixHistorySummary;
}

/**
 * Summary of an applied fix for reporting
 */
export interface AppliedFixSummary {
  /** Iteration number when fix was applied */
  iteration: number;
  /** Error category that triggered the fix */
  errorCategory: PostResurrectionErrorCategory;
  /** Package name if applicable */
  packageName?: string;
  /** Description of the fix strategy */
  strategyDescription: string;
  /** Whether the fix was successful */
  success: boolean;
  /** Error message if fix failed */
  error?: string;
}

/**
 * Summary of an error for reporting
 */
export interface ErrorSummary {
  /** Error category */
  category: PostResurrectionErrorCategory;
  /** Error message */
  message: string;
  /** Package name if applicable */
  packageName?: string;
  /** Priority score */
  priority: number;
}

/**
 * Summary of fix history for reporting
 */
export interface FixHistorySummary {
  /** Repository identifier */
  repoId: string;
  /** Number of historical fixes recorded */
  totalFixes: number;
  /** Most successful fix strategies */
  topStrategies: {
    errorPattern: string;
    strategyType: string;
    successCount: number;
  }[];
  /** Last resurrection timestamp */
  lastResurrection?: Date;
}

/**
 * Summary of batch execution results for reporting
 * 
 * _Requirements: 1.5_
 */
export interface BatchExecutionSummary {
  /** Total number of batches executed */
  totalBatches: number;
  /** Total number of packages attempted across all batches */
  totalPackagesAttempted: number;
  /** Total number of packages successfully updated */
  totalPackagesSucceeded: number;
  /** Total number of packages that failed to update */
  totalPackagesFailed: number;
  /** Detailed results for each batch */
  batchResults: BatchExecutionResult[];
  /** Total duration of all batch executions in milliseconds */
  totalDuration: number;
}

/**
 * Summary of LLM analysis results for reporting
 * 
 * _Requirements: 3.4_
 */
export interface LLMAnalysisSummary {
  /** Total number of files in the repository */
  totalFiles: number;
  /** Number of files successfully analyzed */
  filesAnalyzed: number;
  /** Number of files skipped due to timeouts or errors */
  filesSkipped: number;
  /** Number of timeout occurrences */
  timeoutCount: number;
  /** Whether partial results were returned */
  partialResults: boolean;
  /** Reason for partial results if applicable */
  partialResultsReason?: string;
}

/**
 * Summary of dead URL handling for reporting
 * 
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
 */
export interface DeadUrlReportSummary {
  /** Total number of URL-based dependencies checked */
  totalChecked: number;
  /** Number of dead URLs found */
  deadUrlsFound: number;
  /** Number resolved via npm registry */
  resolvedViaNpm: number;
  /** Number removed (unresolvable) */
  removed: number;
  /** Results grouped by status */
  byStatus: {
    kept: DeadUrlResultDetail[];
    replaced: DeadUrlResultDetail[];
    removed: DeadUrlResultDetail[];
  };
}

/**
 * Detailed result for a single dead URL for reporting
 */
export interface DeadUrlResultDetail {
  /** Package name */
  packageName: string;
  /** Dead URL */
  deadUrl: string;
  /** Replacement version if applicable */
  npmAlternative?: string;
  /** Warning message */
  warning?: string;
  /** Parent dependency chain (for transitive dependencies) */
  parentChain?: string[];
  /** Depth in dependency tree */
  depth?: number;
}

/**
 * Options for generating a resurrection report
 */
export interface ReportGenerationOptions {
  /** Hybrid analysis results */
  hybridAnalysis?: HybridAnalysis;
  /** Metrics before resurrection */
  metricsBefore?: MetricsSnapshot;
  /** Metrics after resurrection */
  metricsAfter?: MetricsSnapshot;
  /** Time Machine validation results */
  timeMachineResults?: TimeMachineValidationResult;
  /** Resurrection verdict with compilation proof */
  resurrectionVerdict?: ResurrectionVerdict;
  /** Path to 3D Ghost Tour HTML file */
  ghostTourPath?: string;
  /** Path to Resurrection Symphony audio file */
  symphonyPath?: string;
  /** Paths to dashboard screenshots */
  dashboardScreenshots?: string[];
  /** Post-resurrection validation results */
  validationResult?: PostResurrectionValidationResult;
  /** Fix history for the repository */
  fixHistory?: FixHistory;
  /** Batch execution results */
  batchExecutionResults?: BatchExecutionResult[];
  /** LLM analysis results */
  llmAnalysis?: LLMAnalysis;
  /** Dead URL handling summary */
  deadUrlHandlingSummary?: DeadUrlHandlingSummary;
}

/**
 * Generate a resurrection report from the context
 * 
 * @param context The resurrection context
 * @param options Optional additional data for enhanced reporting
 * @returns ResurrectionReport with formatted data
 */
export function generateResurrectionReport(
  context: ResurrectionContext,
  options: ReportGenerationOptions = {}
): ResurrectionReport {
  logger.info('Generating resurrection report');
  
  // Extract dependency updates from transformation log
  const updatedDependencies = extractDependencyUpdates(context.transformationLog);
  
  // Extract vulnerability fixes
  const vulnerabilitiesFixed = extractVulnerabilityFixes(context);
  
  // Calculate statistics
  const statistics = calculateStatistics(context.transformationLog, vulnerabilitiesFixed);
  
  // Generate summary
  const summary = generateSummary(statistics, context, options);
  
  // Generate branch URL if available
  const branchUrl = context.resurrectionBranch 
    ? generateBranchUrl(context.repoUrl, context.resurrectionBranch)
    : undefined;
  
  // Prepare metrics comparison if available
  const metricsComparison = options.metricsBefore && options.metricsAfter
    ? { before: options.metricsBefore, after: options.metricsAfter }
    : undefined;
  
  // Generate validation summary if validation result is available
  const validationSummary = options.validationResult
    ? createValidationSummary(options.validationResult, options.fixHistory)
    : undefined;
  
  // Generate batch execution summary if batch results are available
  const batchExecutionSummary = options.batchExecutionResults && options.batchExecutionResults.length > 0
    ? createBatchExecutionSummary(options.batchExecutionResults)
    : undefined;
  
  // Generate LLM analysis summary if LLM analysis is available
  const llmAnalysisSummary = options.llmAnalysis && options.hybridAnalysis
    ? createLLMAnalysisSummary(options.llmAnalysis, options.hybridAnalysis.astAnalysis.files.length)
    : undefined;
  
  // Generate dead URL summary if dead URL handling results are available
  const deadUrlSummary = options.deadUrlHandlingSummary
    ? createDeadUrlReportSummary(options.deadUrlHandlingSummary)
    : undefined;
  
  // Generate markdown report
  const markdown = formatMarkdownReport({
    summary,
    updatedDependencies,
    vulnerabilitiesFixed,
    branchUrl,
    statistics,
    context,
    hybridAnalysis: options.hybridAnalysis,
    metricsComparison,
    timeMachineResults: options.timeMachineResults,
    resurrectionVerdict: options.resurrectionVerdict,
    ghostTourPath: options.ghostTourPath,
    symphonyPath: options.symphonyPath,
    dashboardScreenshots: options.dashboardScreenshots,
    validationSummary,
    batchExecutionSummary,
    llmAnalysisSummary,
    deadUrlSummary
  });
  
  logger.info('Resurrection report generated');
  logger.info(`  Total updates: ${statistics.totalUpdates}`);
  logger.info(`  Successful: ${statistics.successfulUpdates}`);
  logger.info(`  Failed: ${statistics.failedUpdates}`);
  logger.info(`  Vulnerabilities fixed: ${statistics.totalVulnerabilitiesFixed}`);
  
  if (options.hybridAnalysis) {
    logger.info(`  AST analysis: ${options.hybridAnalysis.astAnalysis.files.length} files analyzed`);
    logger.info(`  LLM insights: ${options.hybridAnalysis.llmAnalysis.insights.length} insights generated`);
  }
  
  if (options.timeMachineResults) {
    logger.info(`  Time Machine validation: ${options.timeMachineResults.success ? 'PASSED' : 'FAILED'}`);
  }
  
  if (options.validationResult) {
    logger.info(`  Post-resurrection validation: ${options.validationResult.success ? 'PASSED' : 'FAILED'}`);
    logger.info(`  Validation iterations: ${options.validationResult.iterations}`);
    logger.info(`  Fixes applied: ${options.validationResult.appliedFixes.length}`);
  }
  
  if (batchExecutionSummary) {
    logger.info(`  Batch execution: ${batchExecutionSummary.totalBatches} batches, ${batchExecutionSummary.totalPackagesSucceeded}/${batchExecutionSummary.totalPackagesAttempted} packages succeeded`);
  }
  
  if (llmAnalysisSummary) {
    logger.info(`  LLM analysis: ${llmAnalysisSummary.filesAnalyzed}/${llmAnalysisSummary.totalFiles} files analyzed`);
    if (llmAnalysisSummary.partialResults) {
      logger.info(`  LLM analysis: ${llmAnalysisSummary.partialResultsReason}`);
    }
  }
  
  return {
    summary,
    updatedDependencies,
    vulnerabilitiesFixed,
    branchUrl,
    statistics,
    hybridAnalysis: options.hybridAnalysis,
    metricsComparison,
    timeMachineResults: options.timeMachineResults,
    resurrectionVerdict: options.resurrectionVerdict,
    ghostTourPath: options.ghostTourPath,
    symphonyPath: options.symphonyPath,
    dashboardScreenshots: options.dashboardScreenshots,
    validationSummary,
    batchExecutionSummary,
    llmAnalysisSummary,
    deadUrlSummary,
    markdown
  };
}

/**
 * Extract dependency updates from transformation log
 */
function extractDependencyUpdates(log: TransformationLogEntry[]): DependencyUpdate[] {
  const updates: DependencyUpdate[] = [];
  
  for (const entry of log) {
    if (entry.type === 'dependency_update' && entry.details) {
      updates.push({
        packageName: entry.details.packageName,
        oldVersion: entry.details.oldVersion,
        newVersion: entry.details.newVersion,
        fixedVulnerabilities: (entry.details.fixedVulnerabilities || 0) > 0,
        vulnerabilityCount: entry.details.fixedVulnerabilities || 0
      });
    }
  }
  
  return updates;
}

/**
 * Extract vulnerability fixes from context
 */
function extractVulnerabilityFixes(context: ResurrectionContext): VulnerabilityFix[] {
  const fixes: VulnerabilityFix[] = [];
  
  for (const dependency of context.dependencies) {
    if (dependency.updateStatus === 'success' && dependency.vulnerabilities.length > 0) {
      for (const vulnerability of dependency.vulnerabilities) {
        fixes.push({
          packageName: dependency.name,
          vulnerability
        });
      }
    }
  }
  
  return fixes;
}

/**
 * Calculate statistics from transformation log
 */
function calculateStatistics(
  log: TransformationLogEntry[],
  vulnerabilitiesFixed: VulnerabilityFix[]
): ResurrectionStatistics {
  const updateEntries = log.filter(e => e.type === 'dependency_update');
  const errorEntries = log.filter(e => e.type === 'error' && e.message.includes('Failed to update'));
  
  const criticalCount = vulnerabilitiesFixed.filter(v => v.vulnerability.severity === 'critical').length;
  const highCount = vulnerabilitiesFixed.filter(v => v.vulnerability.severity === 'high').length;
  
  return {
    totalUpdates: updateEntries.length + errorEntries.length,
    successfulUpdates: updateEntries.length,
    failedUpdates: errorEntries.length,
    totalVulnerabilitiesFixed: vulnerabilitiesFixed.length,
    criticalVulnerabilitiesFixed: criticalCount,
    highVulnerabilitiesFixed: highCount
  };
}

/**
 * Generate summary text
 */
function generateSummary(
  statistics: ResurrectionStatistics, 
  context: ResurrectionContext,
  options: ReportGenerationOptions
): string {
  const parts: string[] = [];
  
  // Determine if this is a partial success
  const isPartialSuccess = statistics.successfulUpdates > 0 && statistics.failedUpdates > 0;
  const isFullSuccess = statistics.successfulUpdates > 0 && statistics.failedUpdates === 0;
  const isFullFailure = statistics.successfulUpdates === 0 && statistics.failedUpdates > 0;
  
  // Add status indicator
  if (isPartialSuccess) {
    parts.push('⚠️ **Partial Success**');
  } else if (isFullSuccess) {
    parts.push('✅ **Success**');
  } else if (isFullFailure) {
    parts.push('❌ **Failed**');
  }
  
  if (statistics.successfulUpdates > 0) {
    parts.push(`Successfully updated ${statistics.successfulUpdates} dependenc${statistics.successfulUpdates === 1 ? 'y' : 'ies'}`);
  }
  
  if (statistics.failedUpdates > 0) {
    parts.push(`${statistics.failedUpdates} update${statistics.failedUpdates === 1 ? '' : 's'} failed`);
  }
  
  if (statistics.totalVulnerabilitiesFixed > 0) {
    parts.push(`fixed ${statistics.totalVulnerabilitiesFixed} security vulnerabilit${statistics.totalVulnerabilitiesFixed === 1 ? 'y' : 'ies'}`);
  }
  
  if (options.hybridAnalysis) {
    const fileCount = options.hybridAnalysis.astAnalysis.files.length;
    parts.push(`analyzed ${fileCount} file${fileCount === 1 ? '' : 's'} using hybrid AST + LLM analysis`);
  }
  
  // Add validation status
  if (options.validationResult) {
    if (options.validationResult.iterations === 0 && options.validationResult.success) {
      parts.push('ℹ️ compilation validation skipped (no build script)');
    } else if (options.validationResult.success) {
      parts.push('✅ compilation validation passed');
    } else {
      parts.push(`⚠️ compilation validation incomplete (${options.validationResult.remainingErrors.length} errors remain)`);
    }
  }
  
  if (options.timeMachineResults?.success) {
    parts.push('validated functional equivalence using Time Machine testing');
  }
  
  if (parts.length === 0) {
    return 'No updates were performed';
  }
  
  return parts.join(', ') + '.';
}

/**
 * Generate GitHub branch URL
 */
function generateBranchUrl(repoUrl: string, branchName: string): string {
  // Remove trailing slash if present
  const cleanUrl = repoUrl.replace(/\/$/, '');
  return `${cleanUrl}/tree/${branchName}`;
}

/**
 * Create a validation summary from post-resurrection validation results
 * 
 * _Requirements: 6.4_
 * 
 * @param validationResult The post-resurrection validation result
 * @param fixHistory Optional fix history for the repository
 * @returns ValidationSummary for reporting
 */
function createValidationSummary(
  validationResult: PostResurrectionValidationResult,
  fixHistory?: FixHistory
): ValidationSummary {
  // Convert applied fixes to summary format
  const appliedFixes: AppliedFixSummary[] = validationResult.appliedFixes.map(fix => ({
    iteration: fix.iteration,
    errorCategory: fix.error.category,
    packageName: fix.error.packageName,
    strategyDescription: describeFixStrategy(fix.strategy),
    success: fix.result.success,
    error: fix.result.error
  }));

  // Convert remaining errors to summary format
  const remainingErrors: ErrorSummary[] = validationResult.remainingErrors.map(error => ({
    category: error.category,
    message: error.message,
    packageName: error.packageName,
    priority: error.priority
  }));

  // Create fix history summary if available
  let fixHistorySummary: FixHistorySummary | undefined;
  if (fixHistory) {
    // Get top strategies by success count
    const topStrategies = [...fixHistory.fixes]
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, 5)
      .map(fix => ({
        errorPattern: fix.errorPattern,
        strategyType: fix.strategy.type,
        successCount: fix.successCount
      }));

    fixHistorySummary = {
      repoId: fixHistory.repoId,
      totalFixes: fixHistory.fixes.length,
      topStrategies,
      lastResurrection: fixHistory.lastResurrection
    };
  }

  return {
    success: validationResult.success,
    iterationCount: validationResult.iterations,
    maxIterations: 10, // Default max iterations
    duration: validationResult.duration,
    appliedFixes,
    remainingErrors,
    fixHistory: fixHistorySummary
  };
}

/**
 * Generate human-readable description of a fix strategy
 * 
 * @param strategy The fix strategy to describe
 * @returns Human-readable description
 */
function describeFixStrategy(strategy: FixStrategy): string {
  switch (strategy.type) {
    case 'adjust_version':
      return `Adjusted ${strategy.package} to version ${strategy.newVersion}`;
    case 'legacy_peer_deps':
      return 'Enabled legacy peer deps mode';
    case 'remove_lockfile':
      return `Removed lockfile: ${strategy.lockfile}`;
    case 'substitute_package':
      return strategy.replacement
        ? `Substituted ${strategy.original} with ${strategy.replacement}`
        : `Removed ${strategy.original}`;
    case 'remove_package':
      return `Removed package: ${strategy.package}`;
    case 'add_resolution':
      return `Added resolution for ${strategy.package}@${strategy.version}`;
    case 'force_install':
      return 'Enabled force install mode';
    default:
      return 'Applied fix';
  }
}

/**
 * Create a batch execution summary from batch execution results
 * 
 * _Requirements: 1.5_
 * 
 * @param batchResults Array of batch execution results
 * @returns BatchExecutionSummary for reporting
 */
function createBatchExecutionSummary(
  batchResults: BatchExecutionResult[]
): BatchExecutionSummary {
  const totalBatches = batchResults.length;
  let totalPackagesAttempted = 0;
  let totalPackagesSucceeded = 0;
  let totalPackagesFailed = 0;
  let totalDuration = 0;

  for (const batch of batchResults) {
    totalPackagesAttempted += batch.packagesAttempted;
    totalPackagesSucceeded += batch.packagesSucceeded;
    totalPackagesFailed += batch.packagesFailed;
    totalDuration += batch.duration;
  }

  return {
    totalBatches,
    totalPackagesAttempted,
    totalPackagesSucceeded,
    totalPackagesFailed,
    batchResults,
    totalDuration
  };
}

/**
 * Create an LLM analysis summary from LLM analysis results
 * 
 * _Requirements: 3.4_
 * 
 * @param llmAnalysis LLM analysis results
 * @param totalFiles Total number of files in the repository
 * @returns LLMAnalysisSummary for reporting
 */
function createLLMAnalysisSummary(
  llmAnalysis: LLMAnalysis,
  totalFiles: number
): LLMAnalysisSummary {
  const filesAnalyzed = llmAnalysis.insights.length;
  const filesSkipped = totalFiles - filesAnalyzed;
  
  // Check if there were timeouts by looking for timeout indicators in the analysis
  // This is a heuristic - in a real implementation, we'd track this explicitly
  const partialResults = filesSkipped > 0;
  const timeoutCount = filesSkipped; // Approximate - actual timeout count would be tracked separately
  
  let partialResultsReason: string | undefined;
  if (partialResults) {
    if (timeoutCount > 0) {
      partialResultsReason = `${timeoutCount} file(s) skipped due to LLM timeouts or errors`;
    } else {
      partialResultsReason = 'Some files were not analyzed';
    }
  }

  return {
    totalFiles,
    filesAnalyzed,
    filesSkipped,
    timeoutCount,
    partialResults,
    partialResultsReason
  };
}

/**
 * Create a dead URL report summary from dead URL handling results
 * 
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
 * 
 * @param deadUrlSummary Dead URL handling summary
 * @returns DeadUrlReportSummary for reporting
 */
function createDeadUrlReportSummary(
  deadUrlSummary: DeadUrlHandlingSummary
): DeadUrlReportSummary {
  // Group results by status
  const kept: DeadUrlResultDetail[] = [];
  const replaced: DeadUrlResultDetail[] = [];
  const removed: DeadUrlResultDetail[] = [];

  for (const result of deadUrlSummary.results) {
    const detail: DeadUrlResultDetail = {
      packageName: result.packageName,
      deadUrl: result.deadUrl,
      npmAlternative: result.npmAlternative,
      warning: result.warning,
      parentChain: result.parentChain,
      depth: result.depth
    };

    if (result.action === 'kept') {
      kept.push(detail);
    } else if (result.action === 'replaced') {
      replaced.push(detail);
    } else if (result.action === 'removed') {
      removed.push(detail);
    }
  }

  return {
    totalChecked: deadUrlSummary.totalChecked,
    deadUrlsFound: deadUrlSummary.deadUrlsFound,
    resolvedViaNpm: deadUrlSummary.resolvedViaNpm,
    removed: deadUrlSummary.removed,
    byStatus: {
      kept,
      replaced,
      removed
    }
  };
}

/**
 * Format the complete markdown report
 */
function formatMarkdownReport(data: {
  summary: string;
  updatedDependencies: DependencyUpdate[];
  vulnerabilitiesFixed: VulnerabilityFix[];
  branchUrl?: string;
  statistics: ResurrectionStatistics;
  context: ResurrectionContext;
  hybridAnalysis?: HybridAnalysis;
  metricsComparison?: { before: MetricsSnapshot; after: MetricsSnapshot };
  timeMachineResults?: TimeMachineValidationResult;
  resurrectionVerdict?: ResurrectionVerdict;
  ghostTourPath?: string;
  symphonyPath?: string;
  dashboardScreenshots?: string[];
  validationSummary?: ValidationSummary;
  batchExecutionSummary?: BatchExecutionSummary;
  llmAnalysisSummary?: LLMAnalysisSummary;
  deadUrlSummary?: DeadUrlReportSummary;
}): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# 🧟 CodeCrypt Resurrection Report');
  lines.push('');
  lines.push(`**Repository:** ${data.context.repoUrl}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  if (data.branchUrl) {
    lines.push(`**Branch:** [${data.context.resurrectionBranch}](${data.branchUrl})`);
  }
  lines.push('');
  
  // Resurrection Proof Section (at the top)
  if (data.resurrectionVerdict) {
    lines.push('## 🔬 Resurrection Proof');
    lines.push('');
    
    const verdict = data.resurrectionVerdict;
    const baseline = verdict.baselineCompilation;
    const final = verdict.finalCompilation;
    
    // Determine verdict status
    let verdictStatus: string;
    let verdictIcon: string;
    if (baseline.success && final.success) {
      verdictStatus = 'ALREADY COMPILING';
      verdictIcon = '✅';
    } else if (verdict.resurrected) {
      verdictStatus = 'RESURRECTED';
      verdictIcon = '🧟';
    } else {
      verdictStatus = 'NOT RESURRECTED';
      verdictIcon = '❌';
    }
    
    lines.push(`### Verdict: ${verdictIcon} ${verdictStatus}`);
    lines.push('');
    
    // Compilation status summary
    lines.push('| Stage | Status | Error Count |');
    lines.push('|-------|--------|-------------|');
    lines.push(`| Baseline | ${baseline.success ? '✅ Passed' : '❌ Failed'} | ${baseline.errorCount} |`);
    lines.push(`| Final | ${final.success ? '✅ Passed' : '❌ Failed'} | ${final.errorCount} |`);
    lines.push('');
    
    // Error breakdown by category
    if (baseline.errorCount > 0 || final.errorCount > 0) {
      lines.push('### Error Breakdown by Category');
      lines.push('');
      lines.push('| Category | Baseline | Final | Fixed |');
      lines.push('|----------|----------|-------|-------|');
      
      const categories: ErrorCategory[] = ['type', 'import', 'syntax', 'dependency', 'config'];
      for (const category of categories) {
        const baselineCount = baseline.errorsByCategory[category] || 0;
        const finalCount = final.errorsByCategory[category] || 0;
        const fixedCount = verdict.errorsFixedByCategory[category] || 0;
        
        if (baselineCount > 0 || finalCount > 0) {
          const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
          const fixedIndicator = fixedCount > 0 ? `✅ ${fixedCount}` : '-';
          lines.push(`| ${categoryLabel} | ${baselineCount} | ${finalCount} | ${fixedIndicator} |`);
        }
      }
      lines.push('');
    }
    
    // Summary of fixes
    if (verdict.errorsFixed > 0) {
      lines.push(`**Errors Fixed:** ${verdict.errorsFixed}`);
      lines.push('');
    }
    
    if (verdict.errorsRemaining > 0) {
      lines.push(`**Errors Remaining:** ${verdict.errorsRemaining}`);
      lines.push('');
    }
    
    // Fixed errors list (limited to first 10)
    if (verdict.fixedErrors.length > 0) {
      lines.push('### Errors Fixed');
      lines.push('');
      
      const displayErrors = verdict.fixedErrors.slice(0, 10);
      for (const error of displayErrors) {
        const categoryBadge = `[${error.category.toUpperCase()}]`;
        lines.push(`- ${categoryBadge} \`${error.file}:${error.line}\` - ${error.message}`);
      }
      
      if (verdict.fixedErrors.length > 10) {
        lines.push(`- ... and ${verdict.fixedErrors.length - 10} more`);
      }
      lines.push('');
    }
    
    // Remaining errors list (limited to first 10)
    if (verdict.errorsRemaining > 0 && final.errors.length > 0) {
      lines.push('### Remaining Errors');
      lines.push('');
      
      const displayErrors = final.errors.slice(0, 10);
      for (const error of displayErrors) {
        const categoryBadge = `[${error.category.toUpperCase()}]`;
        lines.push(`- ${categoryBadge} \`${error.file}:${error.line}\` - ${error.message}`);
      }
      
      if (final.errors.length > 10) {
        lines.push(`- ... and ${final.errors.length - 10} more`);
      }
      lines.push('');
    }
    
    // New errors introduced (if any)
    if (verdict.newErrors.length > 0) {
      lines.push('### ⚠️ New Errors Introduced');
      lines.push('');
      
      const displayErrors = verdict.newErrors.slice(0, 5);
      for (const error of displayErrors) {
        const categoryBadge = `[${error.category.toUpperCase()}]`;
        lines.push(`- ${categoryBadge} \`${error.file}:${error.line}\` - ${error.message}`);
      }
      
      if (verdict.newErrors.length > 5) {
        lines.push(`- ... and ${verdict.newErrors.length - 5} more`);
      }
      lines.push('');
    }
    
    // Fix suggestions that were applied
    if (baseline.suggestedFixes.length > 0) {
      lines.push('### Fix Suggestions');
      lines.push('');
      
      for (const fix of baseline.suggestedFixes) {
        const autoIcon = fix.autoApplicable ? '🔧' : '📝';
        lines.push(`- ${autoIcon} **${fix.errorCategory.toUpperCase()}**: ${fix.description}`);
        if (fix.details && fix.details.length > 0) {
          for (const detail of fix.details.slice(0, 3)) {
            lines.push(`  - ${detail}`);
          }
        }
      }
      lines.push('');
    }
  }
  
  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(data.summary);
  lines.push('');
  
  // Statistics
  lines.push('## Statistics');
  lines.push('');
  lines.push(`- **Total Updates:** ${data.statistics.totalUpdates}`);
  lines.push(`- **Successful:** ${data.statistics.successfulUpdates}`);
  lines.push(`- **Failed:** ${data.statistics.failedUpdates}`);
  lines.push(`- **Vulnerabilities Fixed:** ${data.statistics.totalVulnerabilitiesFixed}`);
  if (data.statistics.criticalVulnerabilitiesFixed > 0) {
    lines.push(`  - Critical: ${data.statistics.criticalVulnerabilitiesFixed}`);
  }
  if (data.statistics.highVulnerabilitiesFixed > 0) {
    lines.push(`  - High: ${data.statistics.highVulnerabilitiesFixed}`);
  }
  lines.push('');
  
  // Batch Execution Summary
  // _Requirements: 1.5_
  if (data.batchExecutionSummary) {
    lines.push('## 📦 Batch Execution Summary');
    lines.push('');
    
    const bs = data.batchExecutionSummary;
    
    lines.push(`**Total Batches Executed:** ${bs.totalBatches}`);
    lines.push(`**Total Packages Attempted:** ${bs.totalPackagesAttempted}`);
    lines.push(`**Successful Updates:** ${bs.totalPackagesSucceeded}`);
    lines.push(`**Failed Updates:** ${bs.totalPackagesFailed}`);
    lines.push(`**Total Duration:** ${(bs.totalDuration / 1000).toFixed(2)}s`);
    lines.push('');
    
    // Batch results table
    if (bs.batchResults.length > 0) {
      lines.push('### Batch Results');
      lines.push('');
      lines.push('| Batch ID | Packages Attempted | Succeeded | Failed | Duration (s) |');
      lines.push('|----------|-------------------|-----------|--------|--------------|');
      
      for (const batch of bs.batchResults) {
        const duration = (batch.duration / 1000).toFixed(2);
        lines.push(`| ${batch.batchId} | ${batch.packagesAttempted} | ${batch.packagesSucceeded} | ${batch.packagesFailed} | ${duration} |`);
      }
      lines.push('');
      
      // Package update details
      lines.push('### Package Update Details');
      lines.push('');
      
      for (const batch of bs.batchResults) {
        if (batch.results.length > 0) {
          lines.push(`#### Batch ${batch.batchId}`);
          lines.push('');
          lines.push('| Package | From Version | To Version | Result | Validation |');
          lines.push('|---------|--------------|------------|--------|------------|');
          
          for (const result of batch.results) {
            const resultIcon = result.success ? '✅' : '❌';
            const validationIcon = result.validationPassed === true ? '✅' : result.validationPassed === false ? '❌' : '-';
            const errorInfo = result.error ? ` (${result.error.substring(0, 50)}...)` : '';
            lines.push(`| ${result.packageName} | ${result.fromVersion} | ${result.toVersion} | ${resultIcon}${errorInfo} | ${validationIcon} |`);
          }
          lines.push('');
        }
      }
    }
  }
  
  // Post-Resurrection Validation Summary
  // _Requirements: 6.4_
  if (data.validationSummary) {
    lines.push('## 🔧 Post-Resurrection Validation');
    lines.push('');
    
    const vs = data.validationSummary;
    const statusIcon = vs.success ? '✅' : '❌';
    const statusText = vs.success ? 'PASSED' : 'FAILED';
    
    lines.push(`**Status:** ${statusIcon} ${statusText}`);
    lines.push(`**Iterations:** ${vs.iterationCount}/${vs.maxIterations}`);
    lines.push(`**Duration:** ${(vs.duration / 1000).toFixed(2)}s`);
    lines.push('');
    
    // Applied Fixes
    if (vs.appliedFixes.length > 0) {
      lines.push('### Applied Fixes');
      lines.push('');
      lines.push('| Iteration | Error Category | Package | Strategy | Result |');
      lines.push('|-----------|----------------|---------|----------|--------|');
      
      for (const fix of vs.appliedFixes) {
        const resultIcon = fix.success ? '✅' : '❌';
        const packageName = fix.packageName || '-';
        const categoryLabel = fix.errorCategory.replace(/_/g, ' ');
        lines.push(`| ${fix.iteration} | ${categoryLabel} | ${packageName} | ${fix.strategyDescription} | ${resultIcon} |`);
      }
      lines.push('');
      
      // Summary of fix results
      const successfulFixes = vs.appliedFixes.filter(f => f.success).length;
      const failedFixes = vs.appliedFixes.filter(f => !f.success).length;
      lines.push(`**Successful Fixes:** ${successfulFixes}`);
      if (failedFixes > 0) {
        lines.push(`**Failed Fixes:** ${failedFixes}`);
      }
      lines.push('');
      
      // Summary of strategies that succeeded
      const successfulStrategies = vs.appliedFixes
        .filter(f => f.success)
        .map(f => f.strategyDescription);
      
      if (successfulStrategies.length > 0) {
        lines.push('### Successful Fix Strategies');
        lines.push('');
        // Group by strategy description and count
        const strategyCounts = new Map<string, number>();
        for (const strategy of successfulStrategies) {
          strategyCounts.set(strategy, (strategyCounts.get(strategy) || 0) + 1);
        }
        
        for (const [strategy, count] of strategyCounts) {
          lines.push(`- ${strategy} (${count}x)`);
        }
        lines.push('');
      }
    }
    
    // Remaining Errors
    if (vs.remainingErrors.length > 0) {
      lines.push('### Remaining Errors');
      lines.push('');
      
      // Group by category
      const errorsByCategory = new Map<PostResurrectionErrorCategory, ErrorSummary[]>();
      for (const error of vs.remainingErrors) {
        const existing = errorsByCategory.get(error.category) || [];
        existing.push(error);
        errorsByCategory.set(error.category, existing);
      }
      
      for (const [category, errors] of errorsByCategory) {
        const categoryLabel = category.replace(/_/g, ' ');
        lines.push(`#### ${categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1)} (${errors.length})`);
        lines.push('');
        
        // Show first 5 errors per category
        const displayErrors = errors.slice(0, 5);
        for (const error of displayErrors) {
          const packageInfo = error.packageName ? ` (${error.packageName})` : '';
          lines.push(`- ${error.message}${packageInfo}`);
        }
        
        if (errors.length > 5) {
          lines.push(`- ... and ${errors.length - 5} more`);
        }
        lines.push('');
      }
    }
    
    // Fix History
    if (vs.fixHistory) {
      lines.push('### Fix History');
      lines.push('');
      lines.push(`**Repository:** ${vs.fixHistory.repoId}`);
      lines.push(`**Total Historical Fixes:** ${vs.fixHistory.totalFixes}`);
      
      if (vs.fixHistory.lastResurrection) {
        lines.push(`**Last Resurrection:** ${new Date(vs.fixHistory.lastResurrection).toISOString()}`);
      }
      lines.push('');
      
      if (vs.fixHistory.topStrategies.length > 0) {
        lines.push('#### Most Successful Strategies');
        lines.push('');
        lines.push('| Error Pattern | Strategy | Success Count |');
        lines.push('|---------------|----------|---------------|');
        
        for (const strategy of vs.fixHistory.topStrategies) {
          lines.push(`| ${strategy.errorPattern} | ${strategy.strategyType} | ${strategy.successCount} |`);
        }
        lines.push('');
      }
    }
  }
  
  // AST Analysis Insights
  if (data.hybridAnalysis) {
    lines.push('## 🔍 AST Analysis Insights');
    lines.push('');
    
    const ast = data.hybridAnalysis.astAnalysis;
    lines.push(`**Files Analyzed:** ${ast.files.length}`);
    lines.push(`**Total Lines of Code:** ${ast.totalLOC.toLocaleString()}`);
    lines.push(`**Average Complexity:** ${ast.averageComplexity.toFixed(2)}`);
    lines.push('');
    
    // Top complex files
    const complexFiles = [...ast.files]
      .sort((a, b) => b.complexity.cyclomatic - a.complexity.cyclomatic)
      .slice(0, 5);
    
    if (complexFiles.length > 0) {
      lines.push('### Most Complex Files');
      lines.push('');
      lines.push('| File | Complexity | LOC |');
      lines.push('|------|------------|-----|');
      
      for (const file of complexFiles) {
        lines.push(`| ${file.filePath} | ${file.complexity.cyclomatic} | ${file.linesOfCode} |`);
      }
      
      lines.push('');
    }
    
    // Module dependencies
    if (ast.dependencyGraph.length > 0) {
      lines.push(`**Module Dependencies:** ${ast.dependencyGraph.length} relationships identified`);
      lines.push('');
    }
  }
  
  // LLM Semantic Insights
  if (data.hybridAnalysis?.llmAnalysis) {
    lines.push('## 🤖 LLM Semantic Insights');
    lines.push('');
    
    const llm = data.hybridAnalysis.llmAnalysis;
    
    if (llm.projectIntent) {
      lines.push('### Project Intent');
      lines.push('');
      lines.push(llm.projectIntent);
      lines.push('');
    }
    
    if (llm.keyDomainConcepts.length > 0) {
      lines.push('### Key Domain Concepts');
      lines.push('');
      for (const concept of llm.keyDomainConcepts) {
        lines.push(`- ${concept}`);
      }
      lines.push('');
    }
    
    if (llm.modernizationStrategy) {
      lines.push('### Modernization Strategy');
      lines.push('');
      lines.push(llm.modernizationStrategy);
      lines.push('');
    }
    
    // Combined recommendations
    if (data.hybridAnalysis.combinedInsights.recommendations.length > 0) {
      lines.push('### Recommendations');
      lines.push('');
      for (const rec of data.hybridAnalysis.combinedInsights.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }
  }
  
  // LLM Analysis Summary
  // _Requirements: 3.4_
  if (data.llmAnalysisSummary) {
    lines.push('## 🔬 LLM Analysis Summary');
    lines.push('');
    
    const ls = data.llmAnalysisSummary;
    
    lines.push(`**Total Files:** ${ls.totalFiles}`);
    lines.push(`**Files Analyzed:** ${ls.filesAnalyzed}`);
    lines.push(`**Files Skipped:** ${ls.filesSkipped}`);
    lines.push(`**Timeout Count:** ${ls.timeoutCount}`);
    lines.push('');
    
    if (ls.partialResults) {
      lines.push('### ⚠️ Partial Results');
      lines.push('');
      lines.push(`**Status:** Analysis completed with partial results`);
      if (ls.partialResultsReason) {
        lines.push(`**Reason:** ${ls.partialResultsReason}`);
      }
      lines.push('');
      lines.push('Some files could not be analyzed due to LLM timeouts or errors. The resurrection process continued with available insights from AST analysis and successfully analyzed files.');
      lines.push('');
    } else {
      lines.push('**Status:** ✅ All files analyzed successfully');
      lines.push('');
    }
    
    // Analysis coverage
    const coveragePercent = ((ls.filesAnalyzed / ls.totalFiles) * 100).toFixed(1);
    lines.push(`**Analysis Coverage:** ${coveragePercent}%`);
    lines.push('');
  }
  
  // Metrics Comparison
  if (data.metricsComparison) {
    lines.push('## 📊 Metrics Comparison');
    lines.push('');
    
    const { before, after } = data.metricsComparison;
    
    lines.push('| Metric | Before | After | Change |');
    lines.push('|--------|--------|-------|--------|');
    
    // Complexity
    const complexityChange = ((after.complexity - before.complexity) / before.complexity * 100).toFixed(1);
    const complexityIcon = after.complexity < before.complexity ? '✅' : '⚠️';
    lines.push(`| Code Complexity | ${before.complexity.toFixed(2)} | ${after.complexity.toFixed(2)} | ${complexityIcon} ${complexityChange}% |`);
    
    // Test Coverage
    const coverageChangeNum = after.coverage - before.coverage;
    const coverageChange = coverageChangeNum.toFixed(1);
    const coverageIcon = after.coverage > before.coverage ? '✅' : after.coverage === before.coverage ? '➖' : '⚠️';
    lines.push(`| Test Coverage | ${before.coverage.toFixed(1)}% | ${after.coverage.toFixed(1)}% | ${coverageIcon} ${coverageChangeNum > 0 ? '+' : ''}${coverageChange}% |`);
    
    // Lines of Code
    const locChangeNum = (after.loc - before.loc) / before.loc * 100;
    const locChange = locChangeNum.toFixed(1);
    lines.push(`| Lines of Code | ${before.loc.toLocaleString()} | ${after.loc.toLocaleString()} | ${locChangeNum > 0 ? '+' : ''}${locChange}% |`);
    
    // Dependencies Updated
    lines.push(`| Dependencies Updated | ${before.depsUpdated} | ${after.depsUpdated} | +${after.depsUpdated - before.depsUpdated} |`);
    
    // Vulnerabilities Fixed
    lines.push(`| Vulnerabilities Fixed | ${before.vulnsFixed} | ${after.vulnsFixed} | +${after.vulnsFixed - before.vulnsFixed} |`);
    
    lines.push('');
  }
  
  // Time Machine Validation Results
  if (data.timeMachineResults) {
    lines.push('## ⏰ Time Machine Validation');
    lines.push('');
    
    const tm = data.timeMachineResults;
    const statusIcon = tm.success ? '✅' : '❌';
    const equivalenceIcon = tm.functionalEquivalence ? '✅' : '⚠️';
    
    lines.push(`**Status:** ${statusIcon} ${tm.success ? 'PASSED' : 'FAILED'}`);
    lines.push(`**Functional Equivalence:** ${equivalenceIcon} ${tm.functionalEquivalence ? 'Verified' : 'Differences detected'}`);
    lines.push('');
    
    // Performance comparison
    if (tm.performanceImprovement !== 0) {
      const perfIcon = tm.performanceImprovement > 0 ? '🚀' : '🐌';
      const perfText = tm.performanceImprovement > 0 
        ? `${tm.performanceImprovement.toFixed(1)}% faster` 
        : `${Math.abs(tm.performanceImprovement).toFixed(1)}% slower`;
      lines.push(`**Performance:** ${perfIcon} ${perfText}`);
      lines.push('');
    }
    
    // Test results comparison
    lines.push('### Test Results Comparison');
    lines.push('');
    lines.push('| Environment | Tests Run | Passed | Failed | Exit Code | Time (ms) |');
    lines.push('|-------------|-----------|--------|--------|-----------|-----------|');
    
    const orig = tm.originalResults;
    const mod = tm.modernResults;
    
    lines.push(`| Original | ${orig.testsRun || 'N/A'} | ${orig.testsPassed || 'N/A'} | ${orig.testsFailed || 'N/A'} | ${orig.exitCode} | ${orig.executionTime} |`);
    lines.push(`| Modernized | ${mod.testsRun || 'N/A'} | ${mod.testsPassed || 'N/A'} | ${mod.testsFailed || 'N/A'} | ${mod.exitCode} | ${mod.executionTime} |`);
    
    lines.push('');
    
    // Detailed comparison report
    if (tm.comparisonReport) {
      lines.push('### Detailed Comparison');
      lines.push('');
      lines.push('```');
      lines.push(tm.comparisonReport);
      lines.push('```');
      lines.push('');
    }
    
    // Errors if any
    if (tm.errors && tm.errors.length > 0) {
      lines.push('### Validation Errors');
      lines.push('');
      for (const error of tm.errors) {
        lines.push(`- ${error}`);
      }
      lines.push('');
    }
  }
  
  // Updated Dependencies Table
  if (data.updatedDependencies.length > 0) {
    lines.push('## 📦 Updated Dependencies');
    lines.push('');
    lines.push('| Package | Old Version | New Version | Security Fix |');
    lines.push('|---------|-------------|-------------|--------------|');
    
    for (const dep of data.updatedDependencies) {
      const securityIcon = dep.fixedVulnerabilities ? '🔒 Yes' : '-';
      lines.push(`| ${dep.packageName} | ${dep.oldVersion} | ${dep.newVersion} | ${securityIcon} |`);
    }
    
    lines.push('');
  }
  
  // Dead URL Resolution Section
  // _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  if (data.deadUrlSummary && data.deadUrlSummary.totalChecked > 0) {
    lines.push('## 🔗 Dead URL Resolution');
    lines.push('');
    
    const ds = data.deadUrlSummary;
    
    lines.push(`**Total URL-based dependencies checked:** ${ds.totalChecked}`);
    lines.push(`**Dead URLs found:** ${ds.deadUrlsFound}`);
    lines.push(`**Resolved via npm registry:** ${ds.resolvedViaNpm}`);
    lines.push(`**Removed (unresolvable):** ${ds.removed}`);
    lines.push('');
    
    // Resolved (Replaced) URLs
    if (ds.byStatus.replaced.length > 0) {
      lines.push('### ✅ Resolved Dead URLs');
      lines.push('');
      lines.push('These dependencies had dead URLs that were successfully replaced with npm registry versions:');
      lines.push('');
      lines.push('| Package | Dead URL | Replacement | Type |');
      lines.push('|---------|----------|-------------|------|');
      
      for (const result of ds.byStatus.replaced) {
        const type = result.parentChain && result.parentChain.length > 0 ? 'Transitive' : 'Direct';
        const replacement = result.npmAlternative || 'N/A';
        const urlShort = result.deadUrl.length > 50 ? result.deadUrl.substring(0, 47) + '...' : result.deadUrl;
        lines.push(`| ${result.packageName} | \`${urlShort}\` | ${replacement} | ${type} |`);
      }
      lines.push('');
      
      // Show parent chains for transitive dependencies
      const transitiveReplaced = ds.byStatus.replaced.filter(r => r.parentChain && r.parentChain.length > 0);
      if (transitiveReplaced.length > 0) {
        lines.push('#### Transitive Dependency Chains');
        lines.push('');
        for (const result of transitiveReplaced) {
          lines.push(`**${result.packageName}** (depth ${result.depth || 0}):`);
          if (result.parentChain && result.parentChain.length > 0) {
            lines.push(`- Parent chain: ${result.parentChain.join(' → ')}`);
          }
          if (result.warning) {
            lines.push(`- ${result.warning}`);
          }
          lines.push('');
        }
      }
    }
    
    // Removed URLs
    if (ds.byStatus.removed.length > 0) {
      lines.push('### ❌ Unresolvable Dead URLs');
      lines.push('');
      lines.push('These dependencies had dead URLs that could not be resolved and were removed:');
      lines.push('');
      lines.push('| Package | Dead URL | Type | Reason |');
      lines.push('|---------|----------|------|--------|');
      
      for (const result of ds.byStatus.removed) {
        const type = result.parentChain && result.parentChain.length > 0 ? 'Transitive' : 'Direct';
        const urlShort = result.deadUrl.length > 50 ? result.deadUrl.substring(0, 47) + '...' : result.deadUrl;
        const reason = result.warning || 'No npm alternative found';
        lines.push(`| ${result.packageName} | \`${urlShort}\` | ${type} | ${reason} |`);
      }
      lines.push('');
      
      // Show parent chains for transitive dependencies
      const transitiveRemoved = ds.byStatus.removed.filter(r => r.parentChain && r.parentChain.length > 0);
      if (transitiveRemoved.length > 0) {
        lines.push('#### Transitive Dependency Chains');
        lines.push('');
        lines.push('These transitive dependencies were removed. You may need to update or remove their parent dependencies:');
        lines.push('');
        for (const result of transitiveRemoved) {
          lines.push(`**${result.packageName}** (depth ${result.depth || 0}):`);
          if (result.parentChain && result.parentChain.length > 0) {
            lines.push(`- Parent chain: ${result.parentChain.join(' → ')}`);
          }
          if (result.warning) {
            lines.push(`- ${result.warning}`);
          }
          lines.push('');
        }
      }
      
      // Add helpful explanation for common problematic sources
      lines.push('#### 💡 Common Dead URL Sources');
      lines.push('');
      lines.push('Dead URLs often come from:');
      lines.push('- **Old GitHub tarballs**: Packages that moved to npm registry');
      lines.push('- **Deprecated repositories**: Projects that were archived or deleted');
      lines.push('- **Changed URLs**: Repositories that moved to different hosting');
      lines.push('');
      lines.push('**Recommended Actions:**');
      lines.push('1. Check if removed packages are still needed');
      lines.push('2. Search npm registry for alternative packages');
      lines.push('3. Update parent dependencies to versions that don\'t require these packages');
      lines.push('4. Consider adding entries to the package replacement registry for future resurrections');
      lines.push('');
    }
    
    // Kept (Accessible) URLs
    if (ds.byStatus.kept.length > 0) {
      lines.push('### ✓ Accessible URLs');
      lines.push('');
      lines.push(`${ds.byStatus.kept.length} URL-based ${ds.byStatus.kept.length === 1 ? 'dependency' : 'dependencies'} ${ds.byStatus.kept.length === 1 ? 'remains' : 'remain'} accessible and ${ds.byStatus.kept.length === 1 ? 'was' : 'were'} kept unchanged.`);
      lines.push('');
    }
  }
  
  // Security Vulnerabilities Fixed
  if (data.vulnerabilitiesFixed.length > 0) {
    lines.push('## 🔒 Security Vulnerabilities Fixed');
    lines.push('');
    
    // Group by severity
    const bySeverity = {
      critical: data.vulnerabilitiesFixed.filter(v => v.vulnerability.severity === 'critical'),
      high: data.vulnerabilitiesFixed.filter(v => v.vulnerability.severity === 'high'),
      moderate: data.vulnerabilitiesFixed.filter(v => v.vulnerability.severity === 'moderate'),
      low: data.vulnerabilitiesFixed.filter(v => v.vulnerability.severity === 'low')
    };
    
    for (const [severity, fixes] of Object.entries(bySeverity)) {
      if (fixes.length > 0) {
        const emoji = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'moderate' ? '🟡' : '🟢';
        lines.push(`### ${emoji} ${severity.charAt(0).toUpperCase() + severity.slice(1)} (${fixes.length})`);
        lines.push('');
        
        for (const fix of fixes) {
          lines.push(`- **${fix.packageName}**: ${fix.vulnerability.id}`);
          if (fix.vulnerability.description) {
            lines.push(`  - ${fix.vulnerability.description}`);
          }
        }
        
        lines.push('');
      }
    }
  }
  
  // Interactive Visualizations
  lines.push('## 🎨 Interactive Visualizations');
  lines.push('');
  
  if (data.ghostTourPath) {
    lines.push('### 3D Ghost Tour');
    lines.push('');
    lines.push(`Explore the codebase evolution in 3D: [Open Ghost Tour](${data.ghostTourPath})`);
    lines.push('');
    lines.push('The Ghost Tour provides an interactive 3D visualization of your codebase as a city, where:');
    lines.push('- Each file is represented as a building');
    lines.push('- Building height represents lines of code or complexity');
    lines.push('- Building color indicates change frequency');
    lines.push('- Timeline slider shows code evolution over time');
    lines.push('- Hotspots highlight frequently changed files');
    lines.push('');
  }
  
  if (data.symphonyPath) {
    lines.push('### Resurrection Symphony');
    lines.push('');
    lines.push(`Listen to the sound of your code: [Download Symphony](${data.symphonyPath})`);
    lines.push('');
    lines.push('The Resurrection Symphony translates code metrics into music:');
    lines.push('- Complexity → Tempo and dissonance');
    lines.push('- Test coverage → Harmony and consonance');
    lines.push('- Vulnerabilities → Tension and minor keys');
    lines.push('- Progress → Key modulation (minor → major)');
    lines.push('');
  }
  
  if (data.dashboardScreenshots && data.dashboardScreenshots.length > 0) {
    lines.push('### Live Metrics Dashboard');
    lines.push('');
    lines.push('Real-time metrics captured during resurrection:');
    lines.push('');
    for (const screenshot of data.dashboardScreenshots) {
      lines.push(`![Dashboard](${screenshot})`);
      lines.push('');
    }
  }
  
  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*This report was automatically generated by CodeCrypt 🧟*');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Save resurrection report to file
 * 
 * @param repoPath Path to the repository
 * @param report The resurrection report
 * @returns Path to the saved report file
 */
export async function saveResurrectionReport(
  repoPath: string,
  report: ResurrectionReport
): Promise<string> {
  logger.info('Saving resurrection report to file');
  
  try {
    const reportPath = path.join(repoPath, 'RESURRECTION_REPORT.md');
    await fs.writeFile(reportPath, report.markdown, 'utf-8');
    
    logger.info(`Resurrection report saved: ${reportPath}`);
    return reportPath;
    
  } catch (error: any) {
    logger.error('Failed to save resurrection report', error);
    throw new CodeCryptError(
      `Failed to save resurrection report: ${error.message}`,
      'REPORT_SAVE_FAILED'
    );
  }
}

/**
 * Generate an interactive HTML report with embedded visualizations
 * 
 * @param repoPath Path to the repository
 * @param report The resurrection report
 * @returns Path to the saved HTML report file
 */
export async function generateInteractiveHTMLReport(
  repoPath: string,
  report: ResurrectionReport
): Promise<string> {
  logger.info('Generating interactive HTML report');
  
  try {
    const htmlContent = await formatHTMLReport(report);
    const reportPath = path.join(repoPath, 'RESURRECTION_REPORT.html');
    await fs.writeFile(reportPath, htmlContent, 'utf-8');
    
    logger.info(`Interactive HTML report saved: ${reportPath}`);
    return reportPath;
    
  } catch (error: any) {
    logger.error('Failed to generate interactive HTML report', error);
    throw new CodeCryptError(
      `Failed to generate interactive HTML report: ${error.message}`,
      'HTML_REPORT_GENERATION_FAILED'
    );
  }
}

/**
 * Format the HTML report with embedded visualizations
 */
async function formatHTMLReport(report: ResurrectionReport): Promise<string> {
  // Read Ghost Tour HTML if available
  let ghostTourHTML = '';
  if (report.ghostTourPath) {
    try {
      ghostTourHTML = await fs.readFile(report.ghostTourPath, 'utf-8');
    } catch (error) {
      logger.warn(`Failed to read Ghost Tour HTML: ${error}`);
    }
  }
  
  // Convert markdown to HTML sections
  const markdownSections = report.markdown.split('\n## ');
  const headerSection = markdownSections[0];
  const bodySections = markdownSections.slice(1);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeCrypt Resurrection Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #e0e0e0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    header {
      text-align: center;
      padding: 3rem 0;
      border-bottom: 2px solid #4a4a6a;
      margin-bottom: 3rem;
    }
    
    h1 {
      font-size: 3rem;
      color: #00ff88;
      text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
      margin-bottom: 1rem;
    }
    
    h2 {
      font-size: 2rem;
      color: #00ccff;
      margin: 2rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #4a4a6a;
    }
    
    h3 {
      font-size: 1.5rem;
      color: #ff6b9d;
      margin: 1.5rem 0 0.75rem;
    }
    
    .metadata {
      display: flex;
      justify-content: center;
      gap: 2rem;
      flex-wrap: wrap;
      margin-top: 1rem;
      font-size: 0.9rem;
      color: #a0a0c0;
    }
    
    .metadata strong {
      color: #00ccff;
    }
    
    .section {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      overflow: hidden;
    }
    
    th, td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    th {
      background: rgba(0, 204, 255, 0.2);
      color: #00ccff;
      font-weight: 600;
    }
    
    tr:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    
    ul, ol {
      margin-left: 2rem;
      margin-bottom: 1rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    code {
      background: rgba(0, 0, 0, 0.5);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      color: #00ff88;
    }
    
    pre {
      background: rgba(0, 0, 0, 0.5);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    
    pre code {
      background: none;
      padding: 0;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    
    .stat-card {
      background: rgba(0, 204, 255, 0.1);
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid rgba(0, 204, 255, 0.3);
      text-align: center;
    }
    
    .stat-value {
      font-size: 2.5rem;
      font-weight: bold;
      color: #00ff88;
      display: block;
      margin-bottom: 0.5rem;
    }
    
    .stat-label {
      color: #a0a0c0;
      font-size: 0.9rem;
    }
    
    .visualization-container {
      margin: 2rem 0;
      padding: 2rem;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      border: 2px solid rgba(0, 255, 136, 0.3);
    }
    
    .ghost-tour-embed {
      width: 100%;
      height: 600px;
      border: none;
      border-radius: 8px;
    }
    
    .audio-player {
      width: 100%;
      margin: 1rem 0;
    }
    
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, #00ccff, #00ff88);
      color: #1a1a2e;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
      margin: 0.5rem;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(0, 255, 136, 0.4);
    }
    
    .success { color: #00ff88; }
    .warning { color: #ffaa00; }
    .error { color: #ff4444; }
    .info { color: #00ccff; }
    
    footer {
      text-align: center;
      padding: 2rem 0;
      margin-top: 3rem;
      border-top: 1px solid #4a4a6a;
      color: #a0a0c0;
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }
      
      h1 {
        font-size: 2rem;
      }
      
      .metadata {
        flex-direction: column;
        gap: 0.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧟 CodeCrypt Resurrection Report</h1>
      <div class="metadata">
        <div><strong>Repository:</strong> ${report.summary}</div>
        <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
        ${report.branchUrl ? `<div><strong>Branch:</strong> <a href="${report.branchUrl}" class="info">${report.branchUrl}</a></div>` : ''}
      </div>
    </header>
    
    <main>
      ${report.resurrectionVerdict ? `
      <!-- Resurrection Proof -->
      <section class="section">
        <h2>🔬 Resurrection Proof</h2>
        ${(() => {
          const verdict = report.resurrectionVerdict!;
          const baseline = verdict.baselineCompilation;
          const final = verdict.finalCompilation;
          let verdictStatus: string;
          let verdictIcon: string;
          let verdictClass: string;
          if (baseline.success && final.success) {
            verdictStatus = 'ALREADY COMPILING';
            verdictIcon = '✅';
            verdictClass = 'info';
          } else if (verdict.resurrected) {
            verdictStatus = 'RESURRECTED';
            verdictIcon = '🧟';
            verdictClass = 'success';
          } else {
            verdictStatus = 'NOT RESURRECTED';
            verdictIcon = '❌';
            verdictClass = 'error';
          }
          return `
            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-value ${verdictClass}">${verdictIcon}</span>
                <span class="stat-label">${verdictStatus}</span>
              </div>
              <div class="stat-card">
                <span class="stat-value ${baseline.success ? 'success' : 'error'}">${baseline.success ? '✅' : '❌'}</span>
                <span class="stat-label">Baseline: ${baseline.errorCount} errors</span>
              </div>
              <div class="stat-card">
                <span class="stat-value ${final.success ? 'success' : 'error'}">${final.success ? '✅' : '❌'}</span>
                <span class="stat-label">Final: ${final.errorCount} errors</span>
              </div>
              <div class="stat-card">
                <span class="stat-value success">${verdict.errorsFixed}</span>
                <span class="stat-label">Errors Fixed</span>
              </div>
            </div>
            <h3>Error Breakdown by Category</h3>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Baseline</th>
                  <th>Final</th>
                  <th>Fixed</th>
                </tr>
              </thead>
              <tbody>
                ${['type', 'import', 'syntax', 'dependency', 'config'].map(cat => {
                  const baseCount = baseline.errorsByCategory[cat as ErrorCategory] || 0;
                  const finalCount = final.errorsByCategory[cat as ErrorCategory] || 0;
                  const fixedCount = verdict.errorsFixedByCategory[cat as ErrorCategory] || 0;
                  if (baseCount === 0 && finalCount === 0) {return '';}
                  return `
                    <tr>
                      <td>${cat.charAt(0).toUpperCase() + cat.slice(1)}</td>
                      <td>${baseCount}</td>
                      <td>${finalCount}</td>
                      <td class="${fixedCount > 0 ? 'success' : ''}">${fixedCount > 0 ? '✅ ' + fixedCount : '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `;
        })()}
      </section>
      ` : ''}
      
      <!-- Statistics Overview -->
      <section class="section">
        <h2>📊 Statistics Overview</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value success">${report.statistics.successfulUpdates}</span>
            <span class="stat-label">Successful Updates</span>
          </div>
          <div class="stat-card">
            <span class="stat-value ${report.statistics.failedUpdates > 0 ? 'warning' : 'success'}">${report.statistics.failedUpdates}</span>
            <span class="stat-label">Failed Updates</span>
          </div>
          <div class="stat-card">
            <span class="stat-value success">${report.statistics.totalVulnerabilitiesFixed}</span>
            <span class="stat-label">Vulnerabilities Fixed</span>
          </div>
          <div class="stat-card">
            <span class="stat-value info">${report.statistics.totalUpdates}</span>
            <span class="stat-label">Total Updates</span>
          </div>
        </div>
      </section>
      
      ${report.batchExecutionSummary ? `
      <!-- Batch Execution Summary -->
      <section class="section">
        <h2>📦 Batch Execution Summary</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value info">${report.batchExecutionSummary.totalBatches}</span>
            <span class="stat-label">Total Batches</span>
          </div>
          <div class="stat-card">
            <span class="stat-value success">${report.batchExecutionSummary.totalPackagesSucceeded}</span>
            <span class="stat-label">Successful Updates</span>
          </div>
          <div class="stat-card">
            <span class="stat-value ${report.batchExecutionSummary.totalPackagesFailed > 0 ? 'warning' : 'success'}">${report.batchExecutionSummary.totalPackagesFailed}</span>
            <span class="stat-label">Failed Updates</span>
          </div>
          <div class="stat-card">
            <span class="stat-value info">${(report.batchExecutionSummary.totalDuration / 1000).toFixed(2)}s</span>
            <span class="stat-label">Total Duration</span>
          </div>
        </div>
        ${report.batchExecutionSummary.batchResults.length > 0 ? `
        <h3>Batch Results</h3>
        <table>
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Packages Attempted</th>
              <th>Succeeded</th>
              <th>Failed</th>
              <th>Duration (s)</th>
            </tr>
          </thead>
          <tbody>
            ${report.batchExecutionSummary.batchResults.map(batch => `
              <tr>
                <td>${batch.batchId}</td>
                <td>${batch.packagesAttempted}</td>
                <td class="success">${batch.packagesSucceeded}</td>
                <td class="${batch.packagesFailed > 0 ? 'warning' : 'success'}">${batch.packagesFailed}</td>
                <td>${(batch.duration / 1000).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
      </section>
      ` : ''}
      
      ${report.llmAnalysisSummary ? `
      <!-- LLM Analysis Summary -->
      <section class="section">
        <h2>🔬 LLM Analysis Summary</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value info">${report.llmAnalysisSummary.totalFiles}</span>
            <span class="stat-label">Total Files</span>
          </div>
          <div class="stat-card">
            <span class="stat-value success">${report.llmAnalysisSummary.filesAnalyzed}</span>
            <span class="stat-label">Files Analyzed</span>
          </div>
          <div class="stat-card">
            <span class="stat-value ${report.llmAnalysisSummary.filesSkipped > 0 ? 'warning' : 'success'}">${report.llmAnalysisSummary.filesSkipped}</span>
            <span class="stat-label">Files Skipped</span>
          </div>
          <div class="stat-card">
            <span class="stat-value ${report.llmAnalysisSummary.timeoutCount > 0 ? 'warning' : 'success'}">${report.llmAnalysisSummary.timeoutCount}</span>
            <span class="stat-label">Timeout Count</span>
          </div>
        </div>
        ${report.llmAnalysisSummary.partialResults ? `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255, 170, 0, 0.1); border-left: 4px solid #ffaa00; border-radius: 4px;">
          <h3 style="margin-top: 0;">⚠️ Partial Results</h3>
          <p><strong>Status:</strong> Analysis completed with partial results</p>
          ${report.llmAnalysisSummary.partialResultsReason ? `<p><strong>Reason:</strong> ${report.llmAnalysisSummary.partialResultsReason}</p>` : ''}
          <p>Some files could not be analyzed due to LLM timeouts or errors. The resurrection process continued with available insights from AST analysis and successfully analyzed files.</p>
        </div>
        ` : `
        <p style="margin-top: 1rem;"><strong>Status:</strong> <span class="success">✅ All files analyzed successfully</span></p>
        `}
        <p style="margin-top: 1rem;"><strong>Analysis Coverage:</strong> ${((report.llmAnalysisSummary.filesAnalyzed / report.llmAnalysisSummary.totalFiles) * 100).toFixed(1)}%</p>
      </section>
      ` : ''}
      
      ${report.validationSummary ? `
      <!-- Post-Resurrection Validation -->
      <section class="section">
        <h2>🔧 Post-Resurrection Validation</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value ${report.validationSummary.success ? 'success' : 'error'}">
              ${report.validationSummary.success ? '✅ PASSED' : '❌ FAILED'}
            </span>
            <span class="stat-label">Validation Status</span>
          </div>
          <div class="stat-card">
            <span class="stat-value info">${report.validationSummary.iterationCount}/${report.validationSummary.maxIterations}</span>
            <span class="stat-label">Iterations</span>
          </div>
          <div class="stat-card">
            <span class="stat-value success">${report.validationSummary.appliedFixes.filter(f => f.success).length}</span>
            <span class="stat-label">Successful Fixes</span>
          </div>
          <div class="stat-card">
            <span class="stat-value ${report.validationSummary.remainingErrors.length > 0 ? 'warning' : 'success'}">${report.validationSummary.remainingErrors.length}</span>
            <span class="stat-label">Remaining Errors</span>
          </div>
        </div>
        ${report.validationSummary.appliedFixes.length > 0 ? `
        <h3>Applied Fixes</h3>
        <table>
          <thead>
            <tr>
              <th>Iteration</th>
              <th>Error Category</th>
              <th>Package</th>
              <th>Strategy</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            ${report.validationSummary.appliedFixes.map(fix => `
              <tr>
                <td>${fix.iteration}</td>
                <td>${fix.errorCategory.replace(/_/g, ' ')}</td>
                <td>${fix.packageName || '-'}</td>
                <td>${fix.strategyDescription}</td>
                <td class="${fix.success ? 'success' : 'error'}">${fix.success ? '✅' : '❌'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
        ${report.validationSummary.fixHistory ? `
        <h3>Fix History</h3>
        <p><strong>Repository:</strong> ${report.validationSummary.fixHistory.repoId}</p>
        <p><strong>Total Historical Fixes:</strong> ${report.validationSummary.fixHistory.totalFixes}</p>
        ${report.validationSummary.fixHistory.topStrategies.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Error Pattern</th>
              <th>Strategy</th>
              <th>Success Count</th>
            </tr>
          </thead>
          <tbody>
            ${report.validationSummary.fixHistory.topStrategies.map(s => `
              <tr>
                <td>${s.errorPattern}</td>
                <td>${s.strategyType}</td>
                <td class="success">${s.successCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
        ` : ''}
      </section>
      ` : ''}
      
      ${report.metricsComparison ? `
      <!-- Metrics Comparison -->
      <section class="section">
        <h2>📈 Metrics Comparison</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Before</th>
              <th>After</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Code Complexity</td>
              <td>${report.metricsComparison.before.complexity.toFixed(2)}</td>
              <td>${report.metricsComparison.after.complexity.toFixed(2)}</td>
              <td class="${report.metricsComparison.after.complexity < report.metricsComparison.before.complexity ? 'success' : 'warning'}">
                ${((report.metricsComparison.after.complexity - report.metricsComparison.before.complexity) / report.metricsComparison.before.complexity * 100).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td>Test Coverage</td>
              <td>${report.metricsComparison.before.coverage.toFixed(1)}%</td>
              <td>${report.metricsComparison.after.coverage.toFixed(1)}%</td>
              <td class="${report.metricsComparison.after.coverage > report.metricsComparison.before.coverage ? 'success' : 'warning'}">
                ${(report.metricsComparison.after.coverage - report.metricsComparison.before.coverage).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td>Lines of Code</td>
              <td>${report.metricsComparison.before.loc.toLocaleString()}</td>
              <td>${report.metricsComparison.after.loc.toLocaleString()}</td>
              <td>${((report.metricsComparison.after.loc - report.metricsComparison.before.loc) / report.metricsComparison.before.loc * 100).toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </section>
      ` : ''}
      
      ${report.timeMachineResults ? `
      <!-- Time Machine Validation -->
      <section class="section">
        <h2>⏰ Time Machine Validation</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value ${report.timeMachineResults.success ? 'success' : 'error'}">
              ${report.timeMachineResults.success ? '✅ PASSED' : '❌ FAILED'}
            </span>
            <span class="stat-label">Validation Status</span>
          </div>
          <div class="stat-card">
            <span class="stat-value ${report.timeMachineResults.functionalEquivalence ? 'success' : 'warning'}">
              ${report.timeMachineResults.functionalEquivalence ? '✅' : '⚠️'}
            </span>
            <span class="stat-label">Functional Equivalence</span>
          </div>
          <div class="stat-card">
            <span class="stat-value ${report.timeMachineResults.performanceImprovement > 0 ? 'success' : 'warning'}">
              ${report.timeMachineResults.performanceImprovement > 0 ? '🚀' : '🐌'} ${Math.abs(report.timeMachineResults.performanceImprovement).toFixed(1)}%
            </span>
            <span class="stat-label">Performance ${report.timeMachineResults.performanceImprovement > 0 ? 'Improvement' : 'Change'}</span>
          </div>
        </div>
      </section>
      ` : ''}
      
      ${report.ghostTourPath && ghostTourHTML ? `
      <!-- 3D Ghost Tour -->
      <section class="section">
        <h2>🏙️ 3D Ghost Tour</h2>
        <p>Explore the codebase evolution in 3D. Each building represents a file, with height indicating complexity or lines of code.</p>
        <div class="visualization-container">
          <iframe class="ghost-tour-embed" srcdoc="${ghostTourHTML.replace(/"/g, '&quot;')}"></iframe>
        </div>
        <a href="${report.ghostTourPath}" class="btn" target="_blank">Open in New Window</a>
      </section>
      ` : report.ghostTourPath ? `
      <!-- 3D Ghost Tour Link -->
      <section class="section">
        <h2>🏙️ 3D Ghost Tour</h2>
        <p>Explore the codebase evolution in 3D. Each building represents a file, with height indicating complexity or lines of code.</p>
        <a href="${report.ghostTourPath}" class="btn" target="_blank">Open Ghost Tour</a>
      </section>
      ` : ''}
      
      ${report.symphonyPath ? `
      <!-- Resurrection Symphony -->
      <section class="section">
        <h2>🎵 Resurrection Symphony</h2>
        <p>Listen to the sound of your code. Metrics are translated into music:</p>
        <ul>
          <li>Complexity → Tempo and dissonance</li>
          <li>Test coverage → Harmony and consonance</li>
          <li>Vulnerabilities → Tension and minor keys</li>
          <li>Progress → Key modulation (minor → major)</li>
        </ul>
        <audio class="audio-player" controls>
          <source src="${report.symphonyPath}" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
        <a href="${report.symphonyPath}" class="btn" download>Download Symphony</a>
      </section>
      ` : ''}
      
      ${report.updatedDependencies.length > 0 ? `
      <!-- Updated Dependencies -->
      <section class="section">
        <h2>📦 Updated Dependencies</h2>
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Old Version</th>
              <th>New Version</th>
              <th>Security Fix</th>
            </tr>
          </thead>
          <tbody>
            ${report.updatedDependencies.map(dep => `
              <tr>
                <td><code>${dep.packageName}</code></td>
                <td>${dep.oldVersion}</td>
                <td class="success">${dep.newVersion}</td>
                <td>${dep.fixedVulnerabilities ? '🔒 Yes' : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
      ` : ''}
    </main>
    
    <footer>
      <p>This report was automatically generated by CodeCrypt 🧟</p>
      <p>Powered by hybrid AST + LLM analysis, Time Machine validation, and real-time visualization</p>
    </footer>
  </div>
</body>
</html>`;
  
  return html;
}
