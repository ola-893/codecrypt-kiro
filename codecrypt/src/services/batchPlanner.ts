/**
 * Batch Planner Service
 * Groups compatible dependency updates into batches for efficient installation
 */

import { ResurrectionPlanItem } from './resurrectionPlanning';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Update batch containing grouped packages
 */
export interface UpdateBatch {
  /** Unique batch identifier */
  id: string;
  /** Packages in this batch */
  packages: ResurrectionPlanItem[];
  /** Priority level (higher = more important) */
  priority: number;
  /** Estimated risk level */
  estimatedRisk: 'low' | 'medium' | 'high';
}

/**
 * Interface for the BatchPlanner component
 */
export interface IBatchPlanner {
  /** Create batches from plan items */
  createBatches(planItems: ResurrectionPlanItem[]): UpdateBatch[];
  /** Estimate risk level for a batch */
  estimateBatchRisk(batch: UpdateBatch): 'low' | 'medium' | 'high';
  /** Reorder batches for safety */
  reorderForSafety(batches: UpdateBatch[]): UpdateBatch[];
}

/**
 * Batch Planner implementation
 * Groups compatible updates into batches to minimize npm install cycles
 */
export class BatchPlanner implements IBatchPlanner {
  private readonly maxBatchSize: number;

  constructor(maxBatchSize: number = 10) {
    this.maxBatchSize = maxBatchSize;
  }

  /**
   * Create batches from resurrection plan items
   * Groups updates by type and risk level
   * 
   * Property 3: Replacement priority ordering
   * Ensures all replacement items (priority >= 1000) appear before non-replacement items
   */
  createBatches(planItems: ResurrectionPlanItem[]): UpdateBatch[] {
    logger.info(`Creating batches from ${planItems.length} plan items`);

    const batches: UpdateBatch[] = [];
    let batchCounter = 0;

    // Sort items by priority (descending) to ensure replacement items come first
    const sortedItems = [...planItems].sort((a, b) => b.priority - a.priority);

    // Separate items by category based on priority
    // Replacement items have priority >= 1000
    // Security updates typically have priority >= 1000 (from calculatePriority in resurrectionPlanning)
    const replacementItems = sortedItems.filter(item => item.priority >= 1000);
    const majorUpdates = sortedItems.filter(
      item => item.priority < 1000 && this.isMajorVersionUpdate(item)
    );
    const minorPatchUpdates = sortedItems.filter(
      item => item.priority < 1000 && !this.isMajorVersionUpdate(item)
    );

    // Create replacement/security update batches (separate, highest priority)
    if (replacementItems.length > 0) {
      logger.info(`Creating ${Math.ceil(replacementItems.length / this.maxBatchSize)} replacement/security batch(es)`);
      
      for (let i = 0; i < replacementItems.length; i += this.maxBatchSize) {
        const batchPackages = replacementItems.slice(i, i + this.maxBatchSize);
        const batch: UpdateBatch = {
          id: `batch-${++batchCounter}`,
          packages: batchPackages,
          priority: 1000, // Highest priority for replacements
          estimatedRisk: this.estimateBatchRisk({ 
            id: '', 
            packages: batchPackages, 
            priority: 0, 
            estimatedRisk: 'low' 
          })
        };
        batches.push(batch);
        logger.info(`Created replacement batch ${batch.id} with ${batchPackages.length} packages`);
      }
    }

    // Create major update batches (separate, medium priority)
    if (majorUpdates.length > 0) {
      logger.info(`Creating ${majorUpdates.length} major update batch(es)`);
      
      // Each major update gets its own batch due to higher risk
      for (const item of majorUpdates) {
        const batch: UpdateBatch = {
          id: `batch-${++batchCounter}`,
          packages: [item],
          priority: 500, // Medium priority
          estimatedRisk: 'high'
        };
        batches.push(batch);
        logger.info(`Created major update batch ${batch.id} for ${item.packageName}`);
      }
    }

    // Create minor/patch update batches (grouped, lower priority)
    if (minorPatchUpdates.length > 0) {
      logger.info(`Creating ${Math.ceil(minorPatchUpdates.length / this.maxBatchSize)} minor/patch batch(es)`);
      
      for (let i = 0; i < minorPatchUpdates.length; i += this.maxBatchSize) {
        const batchPackages = minorPatchUpdates.slice(i, i + this.maxBatchSize);
        const batch: UpdateBatch = {
          id: `batch-${++batchCounter}`,
          packages: batchPackages,
          priority: 100, // Lower priority
          estimatedRisk: this.estimateBatchRisk({ 
            id: '', 
            packages: batchPackages, 
            priority: 0, 
            estimatedRisk: 'low' 
          })
        };
        batches.push(batch);
        logger.info(`Created minor/patch batch ${batch.id} with ${batchPackages.length} packages`);
      }
    }

    logger.info(`Created ${batches.length} total batches`);
    return batches;
  }

  /**
   * Estimate risk level for a batch based on update types
   */
  estimateBatchRisk(batch: UpdateBatch): 'low' | 'medium' | 'high' {
    const packages = batch.packages;

    // Empty batch is low risk
    if (packages.length === 0) {
      return 'low';
    }

    // Check for major version updates
    const hasMajorUpdate = packages.some(item => this.isMajorVersionUpdate(item));
    if (hasMajorUpdate) {
      return 'high';
    }

    // Check for security updates
    const hasSecurityUpdate = packages.some(item => item.fixesVulnerabilities);
    
    // Large batches with security updates are medium risk
    if (hasSecurityUpdate && packages.length > 5) {
      return 'medium';
    }

    // Small batches with only minor/patch updates are low risk
    if (packages.length <= 5) {
      return 'low';
    }

    // Default to medium risk for larger batches
    return 'medium';
  }

  /**
   * Reorder batches for safety
   * Ensures high-priority batches are executed first
   */
  reorderForSafety(batches: UpdateBatch[]): UpdateBatch[] {
    logger.info('Reordering batches for safety');
    
    // Sort by priority (highest first), then by risk (lowest first for same priority)
    const reordered = [...batches].sort((a, b) => {
      // First, sort by priority (descending)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // For same priority, prefer lower risk first
      const riskOrder = { low: 0, medium: 1, high: 2 };
      return riskOrder[a.estimatedRisk] - riskOrder[b.estimatedRisk];
    });

    logger.info('Batch execution order:');
    reordered.forEach((batch, index) => {
      logger.info(
        `  ${index + 1}. ${batch.id}: ${batch.packages.length} packages, ` +
        `priority=${batch.priority}, risk=${batch.estimatedRisk}`
      );
    });

    return reordered;
  }

  /**
   * Check if an update is a major version update
   * Major version updates have higher risk of breaking changes
   */
  private isMajorVersionUpdate(item: ResurrectionPlanItem): boolean {
    const currentMajor = this.extractMajorVersion(item.currentVersion);
    const targetMajor = this.extractMajorVersion(item.targetVersion);

    if (currentMajor === null || targetMajor === null) {
      // If we can't parse versions, assume it's not a major update
      return false;
    }

    return targetMajor > currentMajor;
  }

  /**
   * Extract major version number from a version string
   * Handles various version formats (1.2.3, ^1.2.3, ~1.2.3, etc.)
   */
  private extractMajorVersion(version: string): number | null {
    // Remove common prefixes
    const cleaned = version.replace(/^[\^~>=<]+/, '');
    
    // Extract first number
    const match = cleaned.match(/^(\d+)/);
    if (!match) {
      return null;
    }

    return parseInt(match[1], 10);
  }
}

/**
 * Create a default BatchPlanner instance
 */
export function createBatchPlanner(maxBatchSize?: number): IBatchPlanner {
  return new BatchPlanner(maxBatchSize);
}
