import { IBlockingDependencyDetector, BlockingDependency, IURLValidator, URLValidationResult, IPackageReplacementRegistry, PackageReplacement } from '../types';
import { BatchPlanner, UpdateBatch, IBatchPlanner } from './batchPlanner';
import { BatchExecutor, BatchExecutionResult } from './batchExecutor';
import { PackageReplacementExecutor, PackageReplacementResult, IPackageReplacementExecutor } from './packageReplacementExecutor';
import { ResurrectionPlanItem } from './resurrectionPlanning';

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
}

export class SmartDependencyUpdaterImpl implements SmartDependencyUpdater {
  constructor(
    private blockingDependencyDetector: IBlockingDependencyDetector,
    private urlValidator: IURLValidator,
    private batchPlanner: IBatchPlanner,
    private batchExecutor: BatchExecutor,
    private packageReplacementRegistry: IPackageReplacementRegistry,
    private packageReplacementExecutor: IPackageReplacementExecutor
  ) {}

  async analyze(projectPath: string, planItems: ResurrectionPlanItem[]): Promise<SmartDependencyAnalysisResult> {
    const blockingDependencies: BlockingDependency[] = [];
    const deadUrls: URLValidationResult[] = [];
    const replacements: PackageReplacement[] = [];

    // 1. Detect blocking dependencies and dead URLs
    const detectedBlockingDependencies = await this.blockingDependencyDetector.detect(new Map(planItems.map(p => [p.packageName, p.currentVersion])));
    blockingDependencies.push(...detectedBlockingDependencies);

    for (const item of planItems) {
      // Check for dead URLs (if the package name looks like a URL)
      if (item.packageName.startsWith('http://') || item.packageName.startsWith('https://') || item.packageName.startsWith('github:')) {
        const urlValidationResult = await this.urlValidator.validate(item.packageName);
        if (!urlValidationResult.isValid) {
          deadUrls.push(urlValidationResult);
        }
      }

      // Look up package replacements
      const replacement = this.packageReplacementRegistry.lookup(item.packageName);
      if (replacement) {
        replacements.push(replacement);
      }
    }

    // 2. Create update batches
    const updateBatches: UpdateBatch[] = this.batchPlanner.createBatches(planItems);

    return {
      blockingDependencies,
      deadUrls,
      replacements,
      updateBatches,
      initialPlanItems: planItems,
    };
  }

  async execute(projectPath: string, analysisResult: SmartDependencyAnalysisResult): Promise<SmartDependencyExecutionResult> {
    const successfulUpdates: ResurrectionPlanItem[] = [];
    const failedUpdates: { item: ResurrectionPlanItem; error: string }[] = [];
    const manualInterventionRequired: PackageReplacementResult[] = [];

    // 1. Apply package replacements first
    const replacementResults = await this.packageReplacementExecutor.executeReplacement(analysisResult.replacements);
    manualInterventionRequired.push(...replacementResults.filter((r: PackageReplacementResult) => r.requiresManualReview));

    // 2. Execute update batches
    for (const batch of analysisResult.updateBatches) {
      const batchResult = await this.batchExecutor.executeWithFallback(batch, projectPath);

      if (batchResult.success) {
        successfulUpdates.push(...batch.packages);
      } else {
        for (const pkg of batch.packages) {
          failedUpdates.push({
            item: pkg,
            error: batchResult.error?.message || 'Unknown batch execution error',
          });
        }
      }
    }

    return {
      successfulUpdates,
      failedUpdates,
      manualInterventionRequired,
      overallSuccess: failedUpdates.length === 0,
    };
  }
}
