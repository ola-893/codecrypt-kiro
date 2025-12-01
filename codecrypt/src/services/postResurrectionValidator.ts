/**
 * PostResurrectionValidator - Orchestrates the validation loop
 * 
 * This service implements the iterative "fix until it works" approach to
 * post-resurrection validation. It runs a loop: compile → analyze errors →
 * apply fix → retry, continuing until compilation succeeds or max iterations
 * is reached.
 * 
 * **Feature: post-resurrection-validation**
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import {
  IPostResurrectionValidator,
  ICompilationRunner,
  IErrorAnalyzer,
  IFixStrategyEngine,
  IFixHistoryStore,
  ValidationOptions,
  PostResurrectionValidationResult,
  PostResurrectionCompilationProof,
  FixHistory,
  AppliedFix,
  AnalyzedError,
  FixStrategy,
  PackageManager,
  PostResurrectionErrorCategory,
  ValidationIterationStartEventData,
  ValidationErrorAnalysisEventData,
  ValidationFixAppliedEventData,
  ValidationFixOutcomeEventData,
  PostResurrectionValidationCompleteEventData
} from '../types';
import { CompilationRunner, createCompilationRunner } from './compilationRunner';
import { ErrorAnalyzer, createErrorAnalyzer } from './errorAnalyzer';
import { FixStrategyEngine, createFixStrategyEngine } from './fixStrategyEngine';
import { FixHistoryStore, createFixHistoryStore } from './fixHistoryStore';
import { getLogger } from '../utils/logger';

/** Default maximum iterations for the validation loop */
const DEFAULT_MAX_ITERATIONS = 10;

/** Default timeout for compilation (5 minutes) */
const DEFAULT_TIMEOUT = 300000;

/**
 * PostResurrectionValidator class that orchestrates the validation loop
 */
export class PostResurrectionValidator extends EventEmitter implements IPostResurrectionValidator {
  private logger = getLogger();
  private compilationRunner: ICompilationRunner;
  private errorAnalyzer: IErrorAnalyzer;
  private fixStrategyEngine: IFixStrategyEngine & { 
    markStrategyAttempted: (error: AnalyzedError, strategy: FixStrategy) => void;
    resetAttemptedStrategies: () => void;
    hasUntriedStrategies: (error: AnalyzedError) => boolean;
  };
  private fixHistoryStore: IFixHistoryStore & {
    loadHistory: (repoId: string) => Promise<FixHistory | null>;
  };

  /**
   * Create a new PostResurrectionValidator
   * 
   * @param compilationRunner - Optional custom CompilationRunner
   * @param errorAnalyzer - Optional custom ErrorAnalyzer
   * @param fixStrategyEngine - Optional custom FixStrategyEngine
   * @param fixHistoryStore - Optional custom FixHistoryStore
   */
  constructor(
    compilationRunner?: ICompilationRunner,
    errorAnalyzer?: IErrorAnalyzer,
    fixStrategyEngine?: IFixStrategyEngine,
    fixHistoryStore?: IFixHistoryStore
  ) {
    super();
    this.compilationRunner = compilationRunner || createCompilationRunner();
    this.errorAnalyzer = errorAnalyzer || createErrorAnalyzer();
    this.fixStrategyEngine = (fixStrategyEngine || createFixStrategyEngine()) as any;
    this.fixHistoryStore = (fixHistoryStore || createFixHistoryStore()) as any;
  }


  /**
   * Run the validation loop
   * 
   * @param repoPath - Path to the repository to validate
   * @param options - Validation options
   * @returns Promise resolving to validation result
   */
  async validate(
    repoPath: string,
    options: ValidationOptions = {}
  ): Promise<PostResurrectionValidationResult> {
    const startTime = Date.now();
    const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    // Reset attempted strategies for this validation run
    this.fixStrategyEngine.resetAttemptedStrategies();

    // Load fix history for this repository
    const history = await this.loadOrCreateHistory(repoPath);

    // Detect package manager and build command
    const packageManager = await this.detectPackageManager(repoPath, options);
    const buildCommand = await this.detectBuildCommand(repoPath, options);

    const appliedFixes: AppliedFix[] = [];
    let iteration = 0;
    let lastErrors: AnalyzedError[] = [];

    // Main validation loop
    while (iteration < maxIterations) {
      iteration++;

      // Emit iteration start event
      this.emitIterationStart(iteration, maxIterations, repoPath);

      // Attempt compilation
      const compilationResult = await this.compilationRunner.compile(repoPath, {
        packageManager,
        buildCommand,
        timeout
      });

      // If compilation succeeds, we're done!
      if (compilationResult.success) {
        const proof = (this.compilationRunner as CompilationRunner).generateCompilationProof(
          compilationResult,
          { packageManager, buildCommand, timeout },
          iteration
        );

        // Record successful fixes in history
        await this.recordSuccessfulFixes(repoPath, appliedFixes, history);

        const result: PostResurrectionValidationResult = {
          success: true,
          iterations: iteration,
          compilationProof: proof,
          appliedFixes,
          remainingErrors: [],
          duration: Date.now() - startTime
        };

        // Emit completion event
        this.emitValidationComplete(result);

        return result;
      }

      // Analyze errors
      const errors = this.errorAnalyzer.analyze(compilationResult);
      lastErrors = errors;

      // Emit error analysis event
      this.emitErrorAnalysis(iteration, errors);

      // If no errors found but compilation failed, we can't proceed
      if (errors.length === 0) {
        this.logger.warn('Compilation failed but no errors could be parsed');
        break;
      }

      // Select and apply a fix for the highest priority error
      const targetError = errors[0]; // Already sorted by priority
      const strategy = this.fixStrategyEngine.selectStrategy(targetError, history);

      // Emit fix applied event
      this.emitFixApplied(iteration, strategy, targetError);

      // Apply the fix
      const fixResult = await this.fixStrategyEngine.applyFix(repoPath, strategy);

      // Mark strategy as attempted
      this.fixStrategyEngine.markStrategyAttempted(targetError, strategy);

      // Record the applied fix
      appliedFixes.push({
        iteration,
        error: targetError,
        strategy,
        result: fixResult
      });

      // Emit fix outcome event
      this.emitFixOutcome(iteration, fixResult, false);

      // If fix failed and no more strategies available, try next error
      if (!fixResult.success && !this.fixStrategyEngine.hasUntriedStrategies(targetError)) {
        this.logger.warn(`All strategies exhausted for error: ${targetError.category}`);
        // Continue to next iteration to try other errors
      }
    }

    // Max iterations reached without success
    const result: PostResurrectionValidationResult = {
      success: false,
      iterations: iteration,
      appliedFixes,
      remainingErrors: lastErrors,
      duration: Date.now() - startTime
    };

    // Emit completion event
    this.emitValidationComplete(result);

    return result;
  }

  /**
   * Get fix history for a repository
   * 
   * @param repoPath - Path to the repository
   * @returns Fix history for the repository
   */
  getFixHistory(repoPath: string): FixHistory {
    return this.fixHistoryStore.getHistory(repoPath);
  }


  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Load or create fix history for a repository
   */
  private async loadOrCreateHistory(repoPath: string): Promise<FixHistory> {
    const loaded = await this.fixHistoryStore.loadHistory(repoPath);
    if (loaded) {
      return loaded;
    }
    return this.fixHistoryStore.getHistory(repoPath);
  }

  /**
   * Detect package manager from options or repository
   */
  private async detectPackageManager(
    repoPath: string,
    options: ValidationOptions
  ): Promise<PackageManager> {
    if (options.packageManager && options.packageManager !== 'auto') {
      return options.packageManager;
    }
    return this.compilationRunner.detectPackageManager(repoPath);
  }

  /**
   * Detect build command from options or package.json
   */
  private async detectBuildCommand(
    repoPath: string,
    options: ValidationOptions
  ): Promise<string> {
    if (options.buildCommand) {
      return options.buildCommand;
    }

    const packageJsonPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return this.compilationRunner.detectBuildCommand(packageJson);
      } catch {
        // Fall through to default
      }
    }

    return 'build';
  }

  /**
   * Record successful fixes in history
   */
  private async recordSuccessfulFixes(
    repoPath: string,
    appliedFixes: AppliedFix[],
    history: FixHistory
  ): Promise<void> {
    // Record each successful fix
    for (const fix of appliedFixes) {
      if (fix.result.success) {
        const errorPattern = `${fix.error.category}:${fix.error.packageName || 'none'}`;
        this.fixHistoryStore.recordFix(repoPath, errorPattern, fix.strategy);
      }
    }

    // Save updated history
    await this.fixHistoryStore.saveHistory(repoPath, history);
  }

  // ============================================================================
  // Event Emission Methods
  // ============================================================================

  /**
   * Emit iteration start event
   */
  private emitIterationStart(
    iteration: number,
    maxIterations: number,
    repoPath: string
  ): void {
    const data: ValidationIterationStartEventData = {
      iteration,
      maxIterations,
      repoPath
    };
    this.emit('validation_iteration_start', { type: 'validation_iteration_start', data });
    this.logger.info(`[Validation] Starting iteration ${iteration}/${maxIterations}`);
  }

  /**
   * Emit error analysis event
   */
  private emitErrorAnalysis(iteration: number, errors: AnalyzedError[]): void {
    const errorsByCategory: Record<PostResurrectionErrorCategory, number> = {
      dependency_not_found: 0,
      dependency_version_conflict: 0,
      peer_dependency_conflict: 0,
      native_module_failure: 0,
      lockfile_conflict: 0,
      git_dependency_failure: 0,
      syntax_error: 0,
      type_error: 0,
      unknown: 0
    };

    for (const error of errors) {
      errorsByCategory[error.category]++;
    }

    const data: ValidationErrorAnalysisEventData = {
      iteration,
      errorCount: errors.length,
      errorsByCategory,
      topErrors: errors.slice(0, 3)
    };
    this.emit('validation_error_analysis', { type: 'validation_error_analysis', data });
    this.logger.info(`[Validation] Found ${errors.length} errors`);
  }

  /**
   * Emit fix applied event
   */
  private emitFixApplied(
    iteration: number,
    strategy: FixStrategy,
    targetError: AnalyzedError
  ): void {
    const data: ValidationFixAppliedEventData = {
      iteration,
      strategy,
      targetError,
      description: this.describeStrategy(strategy)
    };
    this.emit('validation_fix_applied', { type: 'validation_fix_applied', data });
    this.logger.info(`[Validation] Applying fix: ${data.description}`);
  }

  /**
   * Emit fix outcome event
   */
  private emitFixOutcome(
    iteration: number,
    fixResult: { success: boolean; strategy: FixStrategy; error?: string },
    compilationSucceeds: boolean
  ): void {
    const data: ValidationFixOutcomeEventData = {
      iteration,
      success: fixResult.success,
      strategy: fixResult.strategy,
      error: fixResult.error,
      compilationSucceeds
    };
    this.emit('validation_fix_outcome', { type: 'validation_fix_outcome', data });
    
    if (fixResult.success) {
      this.logger.info(`[Validation] Fix applied successfully`);
    } else {
      this.logger.warn(`[Validation] Fix failed: ${fixResult.error}`);
    }
  }

  /**
   * Emit validation complete event
   */
  private emitValidationComplete(result: PostResurrectionValidationResult): void {
    const successfulFixes = result.appliedFixes.filter(f => f.result.success).length;
    
    const data: PostResurrectionValidationCompleteEventData = {
      success: result.success,
      totalIterations: result.iterations,
      totalFixesApplied: result.appliedFixes.length,
      successfulFixes,
      remainingErrors: result.remainingErrors.length,
      duration: result.duration,
      summary: result.success
        ? `Validation succeeded after ${result.iterations} iteration(s) with ${successfulFixes} fix(es) applied`
        : `Validation failed after ${result.iterations} iteration(s) with ${result.remainingErrors.length} error(s) remaining`
    };
    this.emit('validation_complete', { type: 'validation_complete', data });
    this.logger.info(`[Validation] ${data.summary}`);
  }

  /**
   * Generate human-readable description of a fix strategy
   */
  private describeStrategy(strategy: FixStrategy): string {
    switch (strategy.type) {
      case 'adjust_version':
        return `Adjusting ${strategy.package} to version ${strategy.newVersion}`;
      case 'legacy_peer_deps':
        return 'Enabling legacy peer deps mode';
      case 'remove_lockfile':
        return `Removing lockfile: ${strategy.lockfile}`;
      case 'substitute_package':
        return strategy.replacement
          ? `Substituting ${strategy.original} with ${strategy.replacement}`
          : `Removing ${strategy.original}`;
      case 'remove_package':
        return `Removing package: ${strategy.package}`;
      case 'add_resolution':
        return `Adding resolution for ${strategy.package}@${strategy.version}`;
      case 'force_install':
        return 'Enabling force install mode';
      default:
        return 'Applying fix';
    }
  }
}

/**
 * Create a new PostResurrectionValidator instance
 */
export function createPostResurrectionValidator(
  compilationRunner?: ICompilationRunner,
  errorAnalyzer?: IErrorAnalyzer,
  fixStrategyEngine?: IFixStrategyEngine,
  fixHistoryStore?: IFixHistoryStore
): PostResurrectionValidator {
  return new PostResurrectionValidator(
    compilationRunner,
    errorAnalyzer,
    fixStrategyEngine,
    fixHistoryStore
  );
}
