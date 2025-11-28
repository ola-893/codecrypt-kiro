/**
 * Resurrection Planning Service
 * Generates ordered plans for dependency updates and code transformations
 */

import { DependencyInfo, DependencyReport } from '../types';
import { getLogger } from '../utils/logger';

const logger = getLogger();

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
 * Calculate priority for a dependency update
 * Higher priority = should be updated first
 */
function calculatePriority(dependency: DependencyInfo): number {
  let priority = 0;
  
  // Security vulnerabilities get highest priority
  if (dependency.vulnerabilities.length > 0) {
    priority += 1000;
    
    // Add extra priority based on severity
    for (const vuln of dependency.vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          priority += 100;
          break;
        case 'high':
          priority += 50;
          break;
        case 'moderate':
          priority += 20;
          break;
        case 'low':
          priority += 5;
          break;
      }
    }
  }
  
  // Outdated packages get base priority
  if (dependency.latestVersion !== 'unknown' && 
      dependency.currentVersion !== dependency.latestVersion) {
    priority += 10;
  }
  
  return priority;
}

/**
 * Generate reason string for an update
 */
function generateUpdateReason(dependency: DependencyInfo): string {
  const reasons: string[] = [];
  
  if (dependency.vulnerabilities.length > 0) {
    const criticalCount = dependency.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = dependency.vulnerabilities.filter(v => v.severity === 'high').length;
    
    if (criticalCount > 0) {
      reasons.push(`${criticalCount} critical vulnerabilit${criticalCount === 1 ? 'y' : 'ies'}`);
    }
    if (highCount > 0) {
      reasons.push(`${highCount} high vulnerabilit${highCount === 1 ? 'y' : 'ies'}`);
    }
    if (criticalCount === 0 && highCount === 0) {
      reasons.push(`${dependency.vulnerabilities.length} vulnerabilit${dependency.vulnerabilities.length === 1 ? 'y' : 'ies'}`);
    }
  }
  
  if (dependency.latestVersion !== 'unknown' && 
      dependency.currentVersion !== dependency.latestVersion) {
    reasons.push('outdated version');
  }
  
  return reasons.length > 0 ? reasons.join(', ') : 'update available';
}

/**
 * Generate a resurrection plan from dependency analysis
 * Uses "moderate" strategy: update all packages to latest stable, prioritizing security
 * 
 * @param dependencyReport The dependency analysis report
 * @returns ResurrectionPlan with ordered list of updates
 */
export function generateResurrectionPlan(
  dependencyReport: DependencyReport
): ResurrectionPlan {
  logger.info('Generating resurrection plan with moderate strategy');
  
  const planItems: ResurrectionPlanItem[] = [];
  
  // Process each dependency
  for (const dependency of dependencyReport.dependencies) {
    // Skip if already up to date or version is unknown
    if (dependency.latestVersion === 'unknown') {
      logger.info(`Skipping ${dependency.name}: version unknown`);
      continue;
    }
    
    if (dependency.currentVersion === dependency.latestVersion && 
        dependency.vulnerabilities.length === 0) {
      logger.info(`Skipping ${dependency.name}: already up to date`);
      continue;
    }
    
    // Calculate priority
    const priority = calculatePriority(dependency);
    
    // Generate reason
    const reason = generateUpdateReason(dependency);
    
    // Create plan item
    const item: ResurrectionPlanItem = {
      packageName: dependency.name,
      currentVersion: dependency.currentVersion,
      targetVersion: dependency.latestVersion,
      priority,
      reason,
      fixesVulnerabilities: dependency.vulnerabilities.length > 0,
      vulnerabilityCount: dependency.vulnerabilities.length
    };
    
    planItems.push(item);
    
    logger.info(
      `Added to plan: ${item.packageName} ${item.currentVersion} → ${item.targetVersion} ` +
      `(priority: ${item.priority}, reason: ${item.reason})`
    );
  }
  
  // Sort by priority (highest first)
  planItems.sort((a, b) => b.priority - a.priority);
  
  // Count security patches
  const securityPatches = planItems.filter(item => item.fixesVulnerabilities).length;
  
  const plan: ResurrectionPlan = {
    items: planItems,
    totalUpdates: planItems.length,
    securityPatches,
    strategy: 'moderate',
    generatedAt: new Date()
  };
  
  logger.info('Resurrection plan generated:');
  logger.info(`  Total updates: ${plan.totalUpdates}`);
  logger.info(`  Security patches: ${plan.securityPatches}`);
  logger.info(`  Strategy: ${plan.strategy}`);
  
  if (plan.securityPatches > 0) {
    logger.info(`  First ${Math.min(3, plan.securityPatches)} security updates:`);
    plan.items
      .filter(item => item.fixesVulnerabilities)
      .slice(0, 3)
      .forEach(item => {
        logger.info(`    - ${item.packageName}: ${item.vulnerabilityCount} vulnerabilities`);
      });
  }
  
  return plan;
}
