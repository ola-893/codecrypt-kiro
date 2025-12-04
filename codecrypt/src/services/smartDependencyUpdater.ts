import { IBlockingDependencyDetector, BlockingDependency, IURLValidator, URLValidationResult, IPackageReplacementRegistry, PackageReplacement, BatchExecutionResult as NewBatchExecutionResult } from '../types';
import { BatchPlanner, UpdateBatch, IBatchPlanner } from './batchPlanner';
import { BatchExecutor, BatchExecutionResult } from './batchExecutor';
import { NpmBatchExecutor } from './batchExecutor';
import { PackageReplacementExecutor, PackageReplacementResult, IPackageReplacementExecutor } from './packageReplacementExecutor';
import { ResurrectionPlanItem } from './resurrectionPlanning';
import { getLogger } from '../utils/logger';
import { getEventEmitter } from './eventEmitter';
import { DeadUrlHandler, DeadUrlHandlingSummary } from './deadUrlHandler';

const logger = getLogger();

export interface SmartDependencyUpdater {
  analyze(projectPath: string, planItems: ResurrectionPlanItem[]): Promise<SmartDependencyAnalysisResult>;
  execute(projectPath: string, analysisResult: SmartDependencyAnalysisResult): Promise<SmartDependencyExecutionResult>;
}

export interface SmartDependencyAnalysisResult {
  blockingDependencies: BlockingDependency[];
  deadUrls: URLValidationResult[];
  replacements: PackageReplacement[];
  updateBatches: UpdateBatch[];
  initialPlanItems: ResurrectionPlanItem[];
}

export interface SmartDependencyExecutionResult {
  successfulUpdates: ResurrectionPlanItem[];
  failedUpdates: { item: ResurrectionPlanItem; error: string }[];
  manualInterventionRequired: PackageReplacementResult[];
  overallSuccess: boolean;
  batchResults?: NewBatchExecutionResult[];
  deadUrlHandlingSummary?: DeadUrlHandlingSummary;
}

export class SmartDependencyUpdaterImpl implements SmartDependencyUpdater {
  private deadUrlHandler: DeadUrlHandler;

  constructor(
    private blockingDependencyDetector: IBlockingDependencyDetector,
    private urlValidator: IURLValidator,
    private batchPlanner: IBatchPlanner,
    private batchExecutor: BatchExecutor | NpmBatchExecutor,
    private packageReplacementRegistry: IPackageReplacementRegistry,
    private packageReplacementExecutor: IPackageReplacementExecutor
  ) {
    this.deadUrlHandler = new DeadUrlHandler(urlValidator);
  }

  async analyze(projectPath: string, planItems: ResurrectionPlanItem[]): Promise<SmartDependencyAnalysisResult> {
    logger.info(`[SmartDependencyUpdater] Analyzing ${planItems.length} plan items for ${projectPath}`);
    
    const blockingDependencies: BlockingDependency[] = [];
    const deadUrls: URLValidationResult[] = [];
    const replacements: PackageReplacement[] = [];

    // 1. Handle dead URLs first
    logger.info(`[SmartDependencyUpdater] Checking for dead URLs in dependencies`);
    const dependencyMap = new Map(planItems.map(p => [p.packageName, p.currentVersion]));
    const deadUrlSummary = await this.deadUrlHandler.handleDeadUrls(projectPath, dependencyMap);
    logger.info(`[SmartDependencyUpdater] Dead URL handling complete: ${deadUrlSummary.deadUrlsFound} dead URLs found, ${deadUrlSummary.resolvedViaNpm} resolved via npm`);

    // 2. Detect blocking dependencies
    logger.info(`[SmartDependencyUpdater] Detecting blocking dependencies`);
    const detectedBlockingDependencies = await this.blockingDependencyDetector.detect(new Map(planItems.map(p => [p.packageName, p.currentVersion])));
    blockingDependencies.push(...detectedBlockingDependencies);
    logger.info(`[SmartDependencyUpdater] Found ${blockingDependencies.length} blocking dependencies`);

    for (const item of planItems) {
      // Check for dead URLs (if the package name looks like a URL)
      if (item.packageName.startsWith('http://') || item.packageName.startsWith('https://') || item.packageName.startsWith('github:')) {
        const urlValidationResult = await this.urlValidator.validate(item.packageName);
        if (!urlValidationResult.isValid) {
          deadUrls.push(urlValidationResult);
          logger.warn(`[SmartDependencyUpdater] Dead URL detected: ${item.packageName}`);
        }
      }

      // Look up package replacements
      const replacement = this.packageReplacementRegistry.lookup(item.packageName);
      if (replacement) {
        replacements.push(replacement);
        logger.info(`[SmartDependencyUpdater] Replacement found: ${item.packageName} → ${replacement.newName || 'remove'}`);
      }
    }

    // 2. Create update batches
    logger.info(`[SmartDependencyUpdater] Creating update batches`);
    const updateBatches: UpdateBatch[] = this.batchPlanner.createBatches(planItems);
    logger.info(`[SmartDependencyUpdater] Created ${updateBatches.length} batches`);

    return {
      blockingDependencies,
      deadUrls,
      replacements,
      updateBatches,
      initialPlanItems: planItems,
    };
  }

  async execute(projectPath: string, analysisResult: SmartDependencyAnalysisResult): Promise<SmartDependencyExecutionResult> {
    logger.info(`[SmartDependencyUpdater] Executing updates for ${projectPath}`);
    logger.info(`[SmartDependencyUpdater] ${analysisResult.updateBatches.length} batches to execute`);
    logger.info(`[SmartDependencyUpdater] ${analysisResult.replacements.length} replacements to apply`);
    
    const successfulUpdates: ResurrectionPlanItem[] = [];
    const failedUpdates: { item: ResurrectionPlanItem; error: string }[] = [];
    const manualInterventionRequired: PackageReplacementResult[] = [];

    // 1. Handle dead URLs and apply fixes to package.json
    logger.info(`[SmartDependencyUpdater] Handling dead URLs`);
    const dependencyMap = new Map(analysisResult.initialPlanItems.map(p => [p.packageName, p.currentVersion]));
    const deadUrlSummary = await this.deadUrlHandler.handleDeadUrls(projectPath, dependencyMap);
    
    if (deadUrlSummary.results.length > 0) {
      logger.info(`[SmartDependencyUpdater] Applying dead URL fixes to package.json`);
      await this.deadUrlHandler.applyToPackageJson(projectPath, deadUrlSummary.results);
      
      // Log the report
      const report = this.deadUrlHandler.generateReport(deadUrlSummary);
      logger.info(`[SmartDependencyUpdater] Dead URL handling report:\n${report}`);
    }

    // 2. Apply package replacements
    if (analysisResult.replacements.length > 0) {
      logger.info(`[SmartDependencyUpdater] Applying ${analysisResult.replacements.length} package replacements`);
      const replacementResults = await this.packageReplacementExecutor.executeReplacement(analysisResult.replacements);
      manualInterventionRequired.push(...replacementResults.filter((r: PackageReplacementResult) => r.requiresManualReview));
      logger.info(`[SmartDependencyUpdater] ${manualInterventionRequired.length} replacements require manual review`);
    }

    // 2. Execute update batches using the new executeBatches method
    logger.info(`[SmartDependencyUpdater] Starting batch execution`);
    let batchResults: NewBatchExecutionResult[] = [];
    
    // Check if the executor has the new executeBatches method
    if (this.batchExecutor instanceof NpmBatchExecutor && 'executeBatches' in this.batchExecutor) {
      logger.info(`[SmartDependencyUpdater] Using new executeBatches method`);
      const eventEmitter = getEventEmitter();
      batchResults = await this.batchExecutor.executeBatches(
        analysisResult.updateBatches,
        projectPath,
        eventEmitter
      );

      // Process batch results
      for (const batchResult of batchResults) {
        for (const packageResult of batchResult.results) {
          if (packageResult.success) {
            // Find the original plan item
            const planItem = analysisResult.initialPlanItems.find(
              item => item.packageName === packageResult.packageName
            );
            if (planItem) {
              successfulUpdates.push(planItem);
            }
          } else {
            // Find the original plan item
            const planItem = analysisResult.initialPlanItems.find(
              item => item.packageName === packageResult.packageName
            );
            if (planItem) {
              failedUpdates.push({
                item: planItem,
                error: packageResult.error || 'Unknown error',
              });
            }
          }
        }
      }
    } else {
      // Fallback to old method for backward compatibility
      logger.info(`[SmartDependencyUpdater] Using legacy executeWithFallback method`);
      for (let i = 0; i < analysisResult.updateBatches.length; i++) {
        const batch = analysisResult.updateBatches[i];
        logger.info(`[SmartDependencyUpdater] Executing batch ${i + 1}/${analysisResult.updateBatches.length}: ${batch.id}`);
        
        const batchResult = await this.batchExecutor.executeWithFallback(batch, projectPath);

        if (batchResult.success) {
          logger.info(`[SmartDependencyUpdater] Batch ${batch.id} succeeded, ${batch.packages.length} packages updated`);
          successfulUpdates.push(...batch.packages);
        } else {
          logger.warn(`[SmartDependencyUpdater] Batch ${batch.id} failed`);
          for (const pkg of batch.packages) {
            failedUpdates.push({
              item: pkg,
              error: batchResult.error?.message || 'Unknown batch execution error',
            });
          }
        }
      }
    }

    logger.info(`[SmartDependencyUpdater] Execution complete: ${successfulUpdates.length} successful, ${failedUpdates.length} failed`);

    return {
      successfulUpdates,
      failedUpdates,
      manualInterventionRequired,
      overallSuccess: failedUpdates.length === 0,
      batchResults: batchResults.length > 0 ? batchResults : undefined,
      deadUrlHandlingSummary: deadUrlSummary,
    };
  }
}
