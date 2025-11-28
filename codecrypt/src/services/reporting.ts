/**
 * Reporting Service
 * Generates resurrection reports in Markdown format
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ResurrectionContext, TransformationLogEntry, VulnerabilityInfo } from '../types';
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
 * Generate a resurrection report from the context
 * 
 * @param context The resurrection context
 * @returns ResurrectionReport with formatted data
 */
export function generateResurrectionReport(context: ResurrectionContext): ResurrectionReport {
  logger.info('Generating resurrection report');
  
  // Extract dependency updates from transformation log
  const updatedDependencies = extractDependencyUpdates(context.transformationLog);
  
  // Extract vulnerability fixes
  const vulnerabilitiesFixed = extractVulnerabilityFixes(context);
  
  // Calculate statistics
  const statistics = calculateStatistics(context.transformationLog, vulnerabilitiesFixed);
  
  // Generate summary
  const summary = generateSummary(statistics, context);
  
  // Generate branch URL if available
  const branchUrl = context.resurrectionBranch 
    ? generateBranchUrl(context.repoUrl, context.resurrectionBranch)
    : undefined;
  
  // Generate markdown report
  const markdown = formatMarkdownReport({
    summary,
    updatedDependencies,
    vulnerabilitiesFixed,
    branchUrl,
    statistics,
    context
  });
  
  logger.info('Resurrection report generated');
  logger.info(`  Total updates: ${statistics.totalUpdates}`);
  logger.info(`  Successful: ${statistics.successfulUpdates}`);
  logger.info(`  Failed: ${statistics.failedUpdates}`);
  logger.info(`  Vulnerabilities fixed: ${statistics.totalVulnerabilitiesFixed}`);
  
  return {
    summary,
    updatedDependencies,
    vulnerabilitiesFixed,
    branchUrl,
    statistics,
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
function generateSummary(statistics: ResurrectionStatistics, context: ResurrectionContext): string {
  const parts: string[] = [];
  
  if (statistics.successfulUpdates > 0) {
    parts.push(`Successfully updated ${statistics.successfulUpdates} dependenc${statistics.successfulUpdates === 1 ? 'y' : 'ies'}`);
  }
  
  if (statistics.totalVulnerabilitiesFixed > 0) {
    parts.push(`fixed ${statistics.totalVulnerabilitiesFixed} security vulnerabilit${statistics.totalVulnerabilitiesFixed === 1 ? 'y' : 'ies'}`);
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
  
  // Updated Dependencies Table
  if (data.updatedDependencies.length > 0) {
    lines.push('## Updated Dependencies');
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
    lines.push('## Security Vulnerabilities Fixed');
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
