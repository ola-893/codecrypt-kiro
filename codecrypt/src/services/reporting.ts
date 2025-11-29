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
  TimeMachineValidationResult
} from '../types';
import { getLogger } from '../utils/logger';
import { CodeCryptError } from '../utils/errors';

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
  /** Path to 3D Ghost Tour HTML file */
  ghostTourPath?: string;
  /** Path to Resurrection Symphony audio file */
  symphonyPath?: string;
  /** Path to dashboard screenshots */
  dashboardScreenshots?: string[];
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
  /** Path to 3D Ghost Tour HTML file */
  ghostTourPath?: string;
  /** Path to Resurrection Symphony audio file */
  symphonyPath?: string;
  /** Paths to dashboard screenshots */
  dashboardScreenshots?: string[];
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
    ghostTourPath: options.ghostTourPath,
    symphonyPath: options.symphonyPath,
    dashboardScreenshots: options.dashboardScreenshots
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
  
  return {
    summary,
    updatedDependencies,
    vulnerabilitiesFixed,
    branchUrl,
    statistics,
    hybridAnalysis: options.hybridAnalysis,
    metricsComparison,
    timeMachineResults: options.timeMachineResults,
    ghostTourPath: options.ghostTourPath,
    symphonyPath: options.symphonyPath,
    dashboardScreenshots: options.dashboardScreenshots,
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
  
  if (statistics.successfulUpdates > 0) {
    parts.push(`Successfully updated ${statistics.successfulUpdates} dependenc${statistics.successfulUpdates === 1 ? 'y' : 'ies'}`);
  }
  
  if (statistics.totalVulnerabilitiesFixed > 0) {
    parts.push(`fixed ${statistics.totalVulnerabilitiesFixed} security vulnerabilit${statistics.totalVulnerabilitiesFixed === 1 ? 'y' : 'ies'}`);
  }
  
  if (options.hybridAnalysis) {
    const fileCount = options.hybridAnalysis.astAnalysis.files.length;
    parts.push(`analyzed ${fileCount} file${fileCount === 1 ? '' : 's'} using hybrid AST + LLM analysis`);
  }
  
  if (options.timeMachineResults?.success) {
    parts.push('validated functional equivalence using Time Machine testing');
  }
  
  if (statistics.failedUpdates > 0) {
    parts.push(`${statistics.failedUpdates} update${statistics.failedUpdates === 1 ? '' : 's'} failed`);
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
  ghostTourPath?: string;
  symphonyPath?: string;
  dashboardScreenshots?: string[];
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
