/**
 * Resurrection Orchestrator
 * Integrates all components of the resurrection pipeline
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { ResurrectionContext, DependencyReport, HybridAnalysis, TimeMachineValidationResult, BaselineCompilationResult, ResurrectionVerdict, PostResurrectionValidationResult, ValidationOptions, MetricsSnapshot } from '../types';
import { getLogger } from '../utils/logger';
import { getEventEmitter } from './eventEmitter';
import { createSSEServer, SSEServer } from './sseServer';
import { analyzeRepository } from './astAnalysis';
import { analyzeRepository as analyzeLLMRepository, LLMClient, GeminiClient, createLLMClient } from './llmAnalysis';
import { getSecureConfig } from './secureConfig';
import { combineInsights } from './hybridAnalysis';
import { runTimeMachineValidation, hasTestScript } from './timeMachine';
import { MetricsService } from './metrics';
import { generateResurrectionPlan } from './resurrectionPlanning';
import { updateDependency } from './dependencyUpdater';
import { validateAfterUpdate } from './validation';
import { rollbackLastCommit } from './rollback';
import { generateResurrectionReport, ResurrectionReport } from './reporting';
import { getLLMCache, getASTCache } from './cache';
import { runBaselineCompilationCheck, runFinalCompilationCheck, generateResurrectionVerdict } from './compilationProof';
import { createPostResurrectionValidator, PostResurrectionValidator } from './postResurrectionValidator';
import { SmartDependencyUpdaterImpl } from './smartDependencyUpdater';
import { BlockingDependencyDetector } from './blockingDependencyDetector';
import { URLValidator } from './urlValidator';
import { BatchPlanner } from './batchPlanner';
import { NpmBatchExecutor } from './batchExecutor';
import { PackageReplacementRegistry } from './packageReplacementRegistry';
import { PackageReplacementExecutor } from './packageReplacementExecutor';

const logger = getLogger();

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Enable SSE server for frontend */
  enableSSE?: boolean;
  /** SSE server port */
  ssePort?: number;
  /** Enable hybrid analysis */
  enableHybridAnalysis?: boolean;
  /** Enable Time Machine validation */
  enableTimeMachine?: boolean;
  /** Enable LLM analysis */
  enableLLM?: boolean;
  /** Enable post-resurrection validation */
  enablePostResurrectionValidation?: boolean;
  /** Post-resurrection validation options */
  postResurrectionValidationOptions?: ValidationOptions;
}

/**
 * Orchestrator state
 */
interface OrchestratorState {
  sseServer?: SSEServer;
  context: ResurrectionContext;
  hybridAnalysis?: HybridAnalysis;
  timeMachineResults?: TimeMachineValidationResult;
  postResurrectionValidationResult?: PostResurrectionValidationResult;
  smartDependencyUpdater?: SmartDependencyUpdaterImpl;
  /** LLM provider used for analysis (gemini/anthropic/none) */
  llmProvider?: 'anthropic' | 'gemini' | 'none';
  /** Status of LLM analysis (success/partial/failed/skipped) */
  llmAnalysisStatus?: 'success' | 'partial' | 'failed' | 'skipped';
  /** Summary of dependency update operations */
  dependencyUpdateSummary?: {
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  /** Summary of validation results */
  validationSummary?: {
    compilationStatus: string;
    testsStatus: string;
  };
}

/**
 * Main resurrection orchestrator
 * Coordinates all components of the resurrection pipeline
 */
export class ResurrectionOrchestrator {
  private config: Required<OrchestratorConfig>;
  private state: OrchestratorState;
  private eventEmitter = getEventEmitter();
  private metricsService: MetricsService;

  constructor(context: ResurrectionContext, config: OrchestratorConfig = {}) {
    this.config = {
      enableSSE: config.enableSSE ?? true,
      ssePort: config.ssePort ?? 3000,
      enableHybridAnalysis: config.enableHybridAnalysis ?? true,
      enableTimeMachine: config.enableTimeMachine ?? true,
      enableLLM: config.enableLLM ?? true,
      enablePostResurrectionValidation: config.enablePostResurrectionValidation ?? true,
      postResurrectionValidationOptions: config.postResurrectionValidationOptions ?? {},
    };

    this.state = {
      context,
      smartDependencyUpdater: new SmartDependencyUpdaterImpl(
        new BlockingDependencyDetector(),
        new URLValidator(),
        new BatchPlanner(),
        new NpmBatchExecutor(),
        new PackageReplacementRegistry(),
        new PackageReplacementExecutor(context.repoPath!)
      ),
    };

    this.metricsService = new MetricsService(this.eventEmitter);
  }

  /**
   * Start the orchestrator and SSE server
   */
  async start(): Promise<void> {
    logger.info('Starting Resurrection Orchestrator');

    // Start SSE server if enabled (with graceful degradation)
    if (this.config.enableSSE) {
      try {
        this.state.sseServer = await createSSEServer(this.eventEmitter, {
          port: this.config.ssePort,
        });
        logger.info(`SSE server started on port ${this.config.ssePort}`);
        
        // Note: SSE events are already throttled by the event emitter
        // High-frequency events (like metric updates) are batched automatically
        
        // Emit initial narration
        this.eventEmitter.emitNarration({
          message: 'Resurrection process initiated. Analyzing repository...',
        });
      } catch (error: any) {
        logger.warn('Failed to start SSE server, continuing without real-time updates', error);
        // Continue without SSE - the process can still complete
        this.eventEmitter.emitNarration({
          message: 'Real-time updates unavailable. Process will continue without live dashboard.',
          category: 'warning',
        });
      }
    }
  }

  /**
   * Stop the orchestrator and cleanup
   */
  async stop(): Promise<void> {
    logger.info('Stopping Resurrection Orchestrator');

    if (this.state.sseServer) {
      try {
        await this.state.sseServer.stop();
        logger.info('SSE server stopped successfully');
      } catch (error) {
        logger.warn('Error stopping SSE server', error);
        // Continue cleanup even if SSE server fails to stop
      }
    }
  }

  /**
   * Run baseline compilation check to establish the initial state
   * This proves the repository is "dead" (doesn't compile)
   */
  async runBaselineCompilationCheck(): Promise<BaselineCompilationResult | undefined> {
    if (!this.state.context.repoPath) {
      logger.warn('No repository path set, skipping baseline compilation check');
      return undefined;
    }

    logger.info('Running baseline compilation check');
    this.eventEmitter.emitNarration({
      message: 'Running baseline compilation check to establish initial state...',
    });

    try {
      const result = await runBaselineCompilationCheck(this.state.context.repoPath);
      this.state.context.baselineCompilation = result;

      // Emit event for frontend
      this.eventEmitter.emit('baseline_compilation_complete', {
        type: 'baseline_compilation_complete',
        timestamp: Date.now(),
        data: result,
      });

      if (result.success) {
        this.eventEmitter.emitNarration({
          message: 'Repository compiles successfully! No compilation resurrection needed.',
          category: 'success',
        });
      } else {
        const categoryBreakdown = Object.entries(result.errorsByCategory)
          .filter(([_, count]) => count > 0)
          .map(([cat, count]) => `${count} ${cat}`)
          .join(', ');
        
        this.eventEmitter.emitNarration({
          message: `Compilation FAILED with ${result.errorCount} errors (${categoryBreakdown}). Beginning resurrection...`,
          category: 'warning',
        });
      }

      return result;
    } catch (error: any) {
      logger.error('Baseline compilation check failed', error);
      this.eventEmitter.emitNarration({
        message: `Baseline compilation check failed: ${error.message || String(error)}`,
        category: 'error',
      });
      return undefined;
    }
  }

  /**
   * Run final compilation check and generate resurrection verdict
   */
  async runFinalCompilationCheckAndVerdict(): Promise<ResurrectionVerdict | undefined> {
    if (!this.state.context.repoPath) {
      logger.warn('No repository path set, skipping final compilation check');
      return undefined;
    }

    if (!this.state.context.baselineCompilation) {
      logger.warn('No baseline compilation result, skipping final check');
      return undefined;
    }

    logger.info('Running final compilation verification');
    this.eventEmitter.emitNarration({
      message: 'Running final compilation verification...',
    });

    try {
      const finalResult = await runFinalCompilationCheck(this.state.context.repoPath);
      this.state.context.finalCompilation = finalResult;

      // Emit event for frontend
      this.eventEmitter.emit('final_compilation_complete', {
        type: 'final_compilation_complete',
        timestamp: Date.now(),
        data: finalResult,
      });

      // Generate resurrection verdict
      const verdict = generateResurrectionVerdict(
        this.state.context.baselineCompilation,
        finalResult
      );
      this.state.context.resurrectionVerdict = verdict;

      // Emit verdict event
      this.eventEmitter.emit('resurrection_verdict', {
        type: 'resurrection_verdict',
        timestamp: Date.now(),
        data: verdict,
      });

      // Narrate the verdict
      if (verdict.resurrected) {
        const fixedByCategory = Object.entries(verdict.errorsFixedByCategory)
          .filter(([_, count]) => count > 0)
          .map(([cat, count]) => `${count} ${cat}`)
          .join(', ');
        
        this.eventEmitter.emitNarration({
          message: `🎉 RESURRECTION SUCCESSFUL! Fixed ${verdict.errorsFixed} compilation errors (${fixedByCategory}).`,
          category: 'success',
        });
      } else if (finalResult.success && this.state.context.baselineCompilation.success) {
        this.eventEmitter.emitNarration({
          message: 'Repository was already compiling. No compilation resurrection needed.',
          category: 'info',
        });
      } else {
        const remainingByCategory = Object.entries(verdict.errorsRemainingByCategory)
          .filter(([_, count]) => count > 0)
          .map(([cat, count]) => `${count} ${cat}`)
          .join(', ');
        
        this.eventEmitter.emitNarration({
          message: `Resurrection incomplete. ${verdict.errorsRemaining} errors remain (${remainingByCategory}).`,
          category: 'warning',
        });
      }

      return verdict;
    } catch (error: any) {
      logger.error('Final compilation check failed', error);
      this.eventEmitter.emitNarration({
        message: `Final compilation check failed: ${error.message || String(error)}`,
        category: 'error',
      });
      return undefined;
    }
  }

  /**
   * Run hybrid analysis (AST + LLM)
   */
  async runHybridAnalysis(): Promise<HybridAnalysis | undefined> {
    if (!this.config.enableHybridAnalysis || !this.state.context.repoPath) {
      logger.info('Hybrid analysis disabled or no repository path');
      return undefined;
    }

    logger.info('Running hybrid analysis');
    this.eventEmitter.emitNarration({
      message: 'Performing deep code analysis using AST and AI...',
    });

    try {
      // Run AST analysis with caching
      logger.info('Running AST analysis');
      let astAnalysis;
      try {
        const astCache = getASTCache();
        const cacheKey = `ast:${this.state.context.repoPath}`;
        
        // Check cache first
        const cachedAST = astCache.get(cacheKey);
        if (cachedAST) {
          logger.info('Using cached AST analysis');
          astAnalysis = cachedAST;
        } else {
          logger.info('Performing fresh AST analysis');
          astAnalysis = await analyzeRepository(this.state.context.repoPath);
          astCache.set(cacheKey, astAnalysis);
        }
        
        this.eventEmitter.emitASTAnalysisComplete({
          analysis: astAnalysis,
          summary: `Analyzed ${astAnalysis.files.length} files with ${astAnalysis.totalLOC} lines of code`,
        });
        logger.info(`AST analysis complete: ${astAnalysis.files.length} files analyzed`);
      } catch (error) {
        logger.error('AST analysis failed completely', error);
        this.eventEmitter.emitNarration({
          message: 'Code structure analysis failed. Continuing without advanced analysis.',
          category: 'warning',
        });
        return undefined;
      }

      // Run LLM analysis if enabled (graceful degradation)
      let llmAnalysis;
      if (this.config.enableLLM) {
        const llmStartTime = Date.now();
        logger.info('Running LLM analysis');
        this.eventEmitter.emitNarration({
          message: 'Analyzing code semantics with AI...',
        });

        try {
          const secureConfig = getSecureConfig();
          const config = vscode.workspace.getConfiguration('codecrypt');
          const preferredProvider = config.get<string>('llmProvider', 'anthropic');
          const geminiModel = config.get<string>('geminiModel', 'gemini-3.0-pro'); // Support custom Gemini model

          let llmClient: LLMClient | GeminiClient | undefined;
          let usedProvider: string | undefined;

          const anthropicApiKey = await secureConfig.getAnthropicApiKey();
          const geminiApiKey = await secureConfig.getGeminiApiKey();

          // Determine which client to use based on preference and available keys
          if (preferredProvider === 'gemini' && geminiApiKey) {
            logger.info(`Using configured Gemini provider with model: ${geminiModel}`);
            this.eventEmitter.emitNarration({
              message: `Using Gemini AI (${geminiModel}) for semantic code analysis...`,
            });
            llmClient = new GeminiClient({ apiKey: geminiApiKey, model: geminiModel });
            usedProvider = 'gemini';
          } else if (preferredProvider === 'anthropic' && anthropicApiKey) {
            logger.info('Using configured Anthropic provider.');
            this.eventEmitter.emitNarration({
              message: 'Using Anthropic AI for semantic code analysis...',
            });
            llmClient = new LLMClient({ apiKey: anthropicApiKey });
            usedProvider = 'anthropic';
          } else if (geminiApiKey) {
            // Fallback to Gemini if its key is available
            logger.info(`Falling back to Gemini provider with model: ${geminiModel}`);
            this.eventEmitter.emitNarration({
              message: `Preferred provider unavailable. Falling back to Gemini AI (${geminiModel})...`,
              category: 'info',
            });
            llmClient = new GeminiClient({ apiKey: geminiApiKey, model: geminiModel });
            usedProvider = 'gemini';
          } else if (anthropicApiKey) {
            // Fallback to Anthropic if its key is available
            logger.info('Falling back to Anthropic provider because its API key is configured.');
            this.eventEmitter.emitNarration({
              message: 'Preferred provider unavailable. Falling back to Anthropic AI...',
              category: 'info',
            });
            llmClient = new LLMClient({ apiKey: anthropicApiKey });
            usedProvider = 'anthropic';
          }
          
          if (llmClient && usedProvider) {
            const llmCache = getLLMCache();
            const cacheKey = `llm:${this.state.context.repoPath}:${usedProvider}`;
            
            const cachedLLM = llmCache.get(cacheKey);
            if (cachedLLM) {
              logger.info('Using cached LLM analysis');
              llmAnalysis = cachedLLM;
              // Track successful LLM analysis from cache
              this.state.llmProvider = usedProvider as 'anthropic' | 'gemini';
              this.state.llmAnalysisStatus = 'success';
            } else {
              logger.info(`Performing fresh LLM analysis with ${usedProvider}`);
              logger.info(`Analyzing ${astAnalysis.files.length} files (will prioritize top 10 by complexity)`);
              
              try {
                const analysisStartTime = Date.now();
                llmAnalysis = await analyzeLLMRepository(llmClient, this.state.context.repoPath, astAnalysis);
                const analysisElapsed = Date.now() - analysisStartTime;
                
                logger.info(`LLM analysis completed in ${analysisElapsed}ms`);
                llmCache.set(cacheKey, llmAnalysis);
                
                // Track successful LLM analysis
                this.state.llmProvider = usedProvider as 'anthropic' | 'gemini';
                this.state.llmAnalysisStatus = 'success';
              } catch (analysisError: any) {
                // If primary provider fails, try fallback
                const errorMessage = analysisError.message || String(analysisError);
                logger.warn(`${usedProvider} analysis failed: ${errorMessage}`);
                
                // Try fallback provider
                let fallbackProvider: string | undefined;
                let fallbackClient: LLMClient | GeminiClient | undefined;
                
                if (usedProvider === 'gemini' && anthropicApiKey) {
                  fallbackProvider = 'anthropic';
                  fallbackClient = new LLMClient({ apiKey: anthropicApiKey });
                  logger.info('Gemini failed, falling back to Anthropic');
                  this.eventEmitter.emitNarration({
                    message: `Gemini AI failed (${errorMessage}). Falling back to Anthropic AI...`,
                    category: 'warning',
                  });
                } else if (usedProvider === 'anthropic' && geminiApiKey) {
                  fallbackProvider = 'gemini';
                  fallbackClient = new GeminiClient({ apiKey: geminiApiKey, model: geminiModel });
                  logger.info('Anthropic failed, falling back to Gemini');
                  this.eventEmitter.emitNarration({
                    message: `Anthropic AI failed (${errorMessage}). Falling back to Gemini AI (${geminiModel})...`,
                    category: 'warning',
                  });
                }
                
                if (fallbackClient && fallbackProvider) {
                  try {
                    const fallbackCacheKey = `llm:${this.state.context.repoPath}:${fallbackProvider}`;
                    const cachedFallback = llmCache.get(fallbackCacheKey);
                    
                    if (cachedFallback) {
                      logger.info('Using cached fallback LLM analysis');
                      llmAnalysis = cachedFallback;
                    } else {
                      logger.info(`Performing fresh LLM analysis with fallback provider ${fallbackProvider}`);
                      const fallbackStartTime = Date.now();
                      llmAnalysis = await analyzeLLMRepository(fallbackClient, this.state.context.repoPath, astAnalysis);
                      const fallbackElapsed = Date.now() - fallbackStartTime;
                      logger.info(`Fallback LLM analysis completed in ${fallbackElapsed}ms`);
                      llmCache.set(fallbackCacheKey, llmAnalysis);
                    }
                    
                    // Track successful fallback
                    this.state.llmProvider = fallbackProvider as 'anthropic' | 'gemini';
                    this.state.llmAnalysisStatus = 'success';
                    this.eventEmitter.emitNarration({
                      message: `Successfully switched to ${fallbackProvider === 'gemini' ? 'Gemini' : 'Anthropic'} AI for analysis.`,
                      category: 'success',
                    });
                  } catch (fallbackError: any) {
                    const fallbackErrorMessage = fallbackError.message || String(fallbackError);
                    logger.error(`Fallback provider ${fallbackProvider} also failed: ${fallbackErrorMessage}`);
                    this.eventEmitter.emitNarration({
                      message: `${fallbackProvider === 'gemini' ? 'Gemini' : 'Anthropic'} AI also failed (${fallbackErrorMessage}). Falling back to AST-only analysis.`,
                      category: 'warning',
                    });
                    // Track that both providers failed
                    this.state.llmProvider = 'none';
                    this.state.llmAnalysisStatus = 'failed';
                  }
                } else {
                  // No fallback available
                  logger.warn('No fallback provider available');
                  this.eventEmitter.emitNarration({
                    message: `${usedProvider === 'gemini' ? 'Gemini' : 'Anthropic'} AI failed and no fallback available. Continuing with AST-only analysis.`,
                    category: 'warning',
                  });
                  this.state.llmProvider = 'none';
                  this.state.llmAnalysisStatus = 'failed';
                }
              }
            }
            
            if (llmAnalysis) {
              for (const insight of llmAnalysis.insights) {
                this.eventEmitter.emitLLMInsight({
                  filePath: insight.filePath,
                  insight: insight,
                  summary: `Analyzed ${insight.filePath}: ${insight.modernizationSuggestions.length} suggestions`,
                });
              }
              
              const llmElapsed = Date.now() - llmStartTime;
              logger.info(`LLM analysis complete: ${llmAnalysis.insights.length} files analyzed in ${llmElapsed}ms`);
            }
          } else {
            logger.warn('No LLM API keys are configured, skipping LLM analysis.');
            this.eventEmitter.emitNarration({
              message: 'AI analysis skipped: No API key configured for Anthropic or Gemini.',
              category: 'info',
            });
            // Track that LLM was skipped
            this.state.llmProvider = 'none';
            this.state.llmAnalysisStatus = 'skipped';
          }
        } catch (error: any) {
          const llmElapsed = Date.now() - llmStartTime;
          logger.warn(`LLM analysis failed after ${llmElapsed}ms, continuing with AST only`, error);
          const errorMessage = error.message || String(error);
          logger.error(`LLM error details: ${errorMessage}`);
          if (error.stack) {
            logger.debug(`LLM error stack: ${error.stack}`);
          }
          this.eventEmitter.emitNarration({
            message: `AI analysis encountered unexpected errors. Continuing with AST-only analysis.`,
            category: 'warning',
          });
          // Track that LLM failed
          this.state.llmProvider = 'none';
          this.state.llmAnalysisStatus = 'failed';
        }
      } else {
        // LLM disabled in config
        this.state.llmProvider = 'none';
        this.state.llmAnalysisStatus = 'skipped';
      }

      // Combine insights if LLM analysis succeeded
      if (llmAnalysis) {
        try {
          const hybridAnalysis = combineInsights(astAnalysis, llmAnalysis);
          this.state.hybridAnalysis = hybridAnalysis;
          
          this.eventEmitter.emitNarration({
            message: `Analysis complete. Identified ${hybridAnalysis.combinedInsights.priorityFiles.length} priority files for modernization.`,
          });

          return hybridAnalysis;
        } catch (error) {
          logger.error('Failed to combine AST and LLM insights', error);
          this.eventEmitter.emitNarration({
            message: 'Failed to combine analysis results. Continuing with basic analysis.',
            category: 'warning',
          });
        }
      }

      return undefined;
    } catch (error) {
      logger.error('Hybrid analysis failed unexpectedly', error);
      this.eventEmitter.emitNarration({
        message: 'Code analysis encountered unexpected errors. Continuing without advanced analysis.',
        category: 'error',
      });
      return undefined;
    }
  }

  /**
   * Execute the resurrection plan
   */
  async executeResurrectionPlan(dependencyReport: DependencyReport): Promise<void> {
    if (!this.state.context.repoPath) {
      throw new Error('Repository path not set');
    }

    logger.info('Executing resurrection plan');
    
    try {
      const plan = this.state.context.resurrectionPlan ?? generateResurrectionPlan(dependencyReport);
      this.state.context.resurrectionPlan = plan;

      if (plan.items.length === 0) {
        logger.info('No updates needed');
        this.eventEmitter.emitNarration({
          message: 'No dependency updates needed. Repository is up to date!',
          category: 'success',
        });
        return;
      }

      this.eventEmitter.emitNarration({
        message: `Beginning resurrection with ${plan.totalUpdates} planned updates.`,
      });

      if (this.state.smartDependencyUpdater) {
        const analysisResult = await this.state.smartDependencyUpdater.analyze(this.state.context.repoPath, plan.items);
        const executionResult = await this.state.smartDependencyUpdater.execute(this.state.context.repoPath, analysisResult);
        
        // Handle dead URL narration
        if (executionResult.deadUrlHandlingSummary) {
          const summary = executionResult.deadUrlHandlingSummary;
          
          if (summary.deadUrlsFound > 0) {
            logger.info(`[ResurrectionOrchestrator] Dead URL handling: ${summary.deadUrlsFound} dead URLs found`);
            
            // Emit narration for dead URLs
            if (summary.resolvedViaNpm > 0 && summary.removed > 0) {
              this.eventEmitter.emitNarration({
                message: `Found ${summary.deadUrlsFound} dead dependency URLs. Resolved ${summary.resolvedViaNpm} via npm registry, removed ${summary.removed} unresolvable packages.`,
                category: 'warning',
              });
            } else if (summary.resolvedViaNpm > 0) {
              this.eventEmitter.emitNarration({
                message: `Found ${summary.deadUrlsFound} dead dependency URLs. Successfully resolved all via npm registry.`,
                category: 'info',
              });
            } else if (summary.removed > 0) {
              this.eventEmitter.emitNarration({
                message: `Found ${summary.deadUrlsFound} dead dependency URLs. Removed ${summary.removed} unresolvable packages.`,
                category: 'warning',
              });
            }
            
            // Log to transformation log
            this.state.context.transformationLog.push({
              timestamp: new Date(),
              type: 'dependency_update',
              message: `Dead URL handling: ${summary.deadUrlsFound} dead URLs found, ${summary.resolvedViaNpm} resolved, ${summary.removed} removed`,
              details: {
                deadUrlSummary: summary
              }
            });
          }
        }
        
        // Store batch execution results in context for reporting
        if (executionResult.batchResults) {
          const totalAttempted = executionResult.batchResults.reduce((sum, r) => sum + r.packagesAttempted, 0);
          const totalSucceeded = executionResult.batchResults.reduce((sum, r) => sum + r.packagesSucceeded, 0);
          const totalFailed = executionResult.batchResults.reduce((sum, r) => sum + r.packagesFailed, 0);
          const totalSkipped = plan.items.length - totalAttempted; // Items that were skipped (e.g., blocking dependencies)
          
          logger.info(`[ResurrectionOrchestrator] Batch execution complete: ${totalSucceeded}/${totalAttempted} packages succeeded, ${totalFailed} failed`);
          
          // Store dependency update summary in state
          this.state.dependencyUpdateSummary = {
            attempted: totalAttempted,
            succeeded: totalSucceeded,
            failed: totalFailed,
            skipped: totalSkipped
          };
          
          // Log to transformation log
          this.state.context.transformationLog.push({
            timestamp: new Date(),
            type: 'dependency_update',
            message: `Batch execution complete: ${totalSucceeded}/${totalAttempted} packages updated successfully`,
            details: {
              batchResults: executionResult.batchResults,
              totalAttempted,
              totalSucceeded,
              totalFailed,
              totalSkipped
            }
          });
          
          // Emit narration
          this.eventEmitter.emitNarration({
            message: `Batch execution complete: ${totalSucceeded} of ${totalAttempted} packages updated successfully.`,
            category: totalFailed === 0 ? 'success' : 'warning',
          });
        }
      }

    } catch (error: any) {
      logger.error('Failed to execute resurrection plan', error);
      this.eventEmitter.emitNarration({
        message: `Resurrection plan execution failed: ${error.message || String(error)}`,
        category: 'error',
      });
      throw error;
    }
  }

  /**
   * Run post-resurrection validation
   * 
   * This method runs after dependency updates to ensure the resurrected codebase
   * compiles successfully. It implements an iterative fix-retry loop that:
   * 1. Attempts compilation
   * 2. Analyzes any errors
   * 3. Applies targeted fixes
   * 4. Retries until success or max iterations reached
   * 
   * @param options - Optional validation options to override defaults
   * @returns Validation result or undefined if disabled/no repo path
   * 
   * Requirements: 1.1, 4.5
   */
  async runPostResurrectionValidation(
    options?: ValidationOptions
  ): Promise<PostResurrectionValidationResult | undefined> {
    if (!this.config.enablePostResurrectionValidation || !this.state.context.repoPath) {
      logger.info('Post-resurrection validation disabled or no repository path');
      return undefined;
    }

    logger.info('Running post-resurrection validation');
    this.eventEmitter.emitNarration({
      message: 'Starting post-resurrection validation. Checking if the resurrected code compiles...',
    });

    try {
      // Create the validator
      const validator = createPostResurrectionValidator();

      // Merge options with config defaults
      const validationOptions: ValidationOptions = {
        ...this.config.postResurrectionValidationOptions,
        ...options,
      };

      // Forward validation events to the main event emitter
      this.setupValidationEventForwarding(validator);

      // Run validation
      const result = await validator.validate(
        this.state.context.repoPath,
        validationOptions
      );

      // Store result in state
      this.state.postResurrectionValidationResult = result;

      // Extract validation summary
      const compilationStatus = result.success ? 'passed' : 
        (result.compilationProof ? 'passed' : 'failed');
      
      // For tests, check if repository has test script
      const hasTests = await hasTestScript(this.state.context.repoPath);
      const testsStatus = hasTests ? 'not_applicable' : 'not_applicable'; // Tests are not run in post-resurrection validation
      
      // Store validation summary in state
      this.state.validationSummary = {
        compilationStatus,
        testsStatus
      };

      // Log the result
      this.state.context.transformationLog.push({
        timestamp: new Date(),
        type: result.success ? 'dependency_update' : 'error',
        message: result.success
          ? `Post-resurrection validation succeeded after ${result.iterations} iteration(s)`
          : `Post-resurrection validation failed after ${result.iterations} iteration(s)`,
        details: {
          success: result.success,
          iterations: result.iterations,
          appliedFixes: result.appliedFixes.length,
          remainingErrors: result.remainingErrors.length,
          duration: result.duration,
          compilationStatus,
          testsStatus
        },
      });

      // Emit narration based on result
      if (result.success) {
        this.eventEmitter.emitNarration({
          message: `🎉 Post-resurrection validation passed! Code compiles successfully after ${result.iterations} iteration(s) with ${result.appliedFixes.length} fix(es) applied.`,
          category: 'success',
        });
      } else {
        const errorSummary = result.remainingErrors
          .slice(0, 3)
          .map(e => e.category)
          .join(', ');
        this.eventEmitter.emitNarration({
          message: `Post-resurrection validation incomplete after ${result.iterations} iteration(s). ${result.remainingErrors.length} error(s) remain (${errorSummary}).`,
          category: 'warning',
        });
      }

      return result;
    } catch (error: any) {
      logger.error('Post-resurrection validation failed', error);
      const errorMessage = error.message || String(error);
      this.eventEmitter.emitNarration({
        message: `Post-resurrection validation encountered errors: ${errorMessage}`,
        category: 'error',
      });

      // Log the error
      this.state.context.transformationLog.push({
        timestamp: new Date(),
        type: 'error',
        message: `Post-resurrection validation error: ${errorMessage}`,
        details: { error: errorMessage },
      });

      return undefined;
    }
  }

  /**
   * Set up event forwarding from PostResurrectionValidator to the main event emitter
   * This allows validation events to be streamed to the frontend via SSE
   */
  private setupValidationEventForwarding(validator: PostResurrectionValidator): void {
    // Forward iteration start events
    validator.on('validation_iteration_start', (event) => {
      this.eventEmitter.emit('validation_iteration_start', {
        type: 'validation_iteration_start',
        timestamp: Date.now(),
        data: event.data,
      });
      this.eventEmitter.emitNarration({
        message: `Validation iteration ${event.data.iteration}/${event.data.maxIterations}...`,
        category: 'info',
      });
    });

    // Forward error analysis events
    validator.on('validation_error_analysis', (event) => {
      this.eventEmitter.emit('validation_error_analysis', {
        type: 'validation_error_analysis',
        timestamp: Date.now(),
        data: event.data,
      });
      if (event.data.errorCount > 0) {
        const topCategories = Object.entries(event.data.errorsByCategory)
          .filter(([_, count]) => (count as number) > 0)
          .map(([cat, count]) => `${count} ${cat}`)
          .slice(0, 3)
          .join(', ');
        this.eventEmitter.emitNarration({
          message: `Found ${event.data.errorCount} error(s): ${topCategories}`,
          category: 'info',
        });
      }
    });

    // Forward fix applied events
    validator.on('validation_fix_applied', (event) => {
      this.eventEmitter.emit('validation_fix_applied', {
        type: 'validation_fix_applied',
        timestamp: Date.now(),
        data: event.data,
      });
      this.eventEmitter.emitNarration({
        message: `Applying fix: ${event.data.description}`,
        category: 'info',
      });
    });

    // Forward fix outcome events
    validator.on('validation_fix_outcome', (event) => {
      this.eventEmitter.emit('validation_fix_outcome', {
        type: 'validation_fix_outcome',
        timestamp: Date.now(),
        data: event.data,
      });
    });

    // Forward validation complete events
    validator.on('validation_complete', (event) => {
      this.eventEmitter.emit('validation_complete', {
        type: 'validation_complete',
        timestamp: Date.now(),
        data: event.data,
      });
    });

    // Forward no build script events
    validator.on('validation_no_build_script', (event) => {
      this.eventEmitter.emit('validation_no_build_script', {
        type: 'validation_no_build_script',
        timestamp: Date.now(),
        data: event.data,
      });
      this.eventEmitter.emitNarration({
        message: 'No build script detected in package.json. Compilation validation skipped - this is normal for projects without build requirements.',
        category: 'info',
      });
    });
  }

  /**
   * Get post-resurrection validation results
   */
  getPostResurrectionValidationResult(): PostResurrectionValidationResult | undefined {
    return this.state.postResurrectionValidationResult;
  }

  /**
   * Run Time Machine validation
   */
  async runTimeMachineValidation(): Promise<TimeMachineValidationResult | undefined> {
    if (!this.config.enableTimeMachine || !this.state.context.repoPath) {
      logger.info('Time Machine validation disabled or no repository path');
      return undefined;
    }

    logger.info('Running Time Machine validation');
    this.eventEmitter.emitNarration({
      message: 'Initiating Time Machine validation. Running tests in parallel environments...',
    });

    try {
      // Check if repository has tests
      const hasTests = await hasTestScript(this.state.context.repoPath);
      if (!hasTests) {
        logger.warn('Repository has no test script, skipping Time Machine validation');
        this.eventEmitter.emitNarration({
          message: 'No test script found. Skipping Time Machine validation.',
          category: 'info',
        });
        return undefined;
      }

      // Run validation with comprehensive error handling
      const results = await runTimeMachineValidation({
        repoPath: this.state.context.repoPath,
        originalNodeVersion: '14', // Will be auto-detected
        enabled: true,
      });

      this.state.timeMachineResults = results;

      // Check if Docker was unavailable
      if (results.errors && results.errors.some(e => e.includes('Docker'))) {
        logger.warn('Time Machine validation skipped due to Docker unavailability');
        this.eventEmitter.emitNarration({
          message: 'Time Machine validation skipped: Docker not available.',
          category: 'warning',
        });
        return results;
      }

      this.eventEmitter.emitValidationComplete({
        results: results,
        summary: results.success 
          ? `Validation passed with ${results.performanceImprovement}% performance improvement`
          : 'Validation detected differences',
      });

      if (results.success) {
        this.eventEmitter.emitNarration({
          message: `Time Machine validation passed! Functional equivalence verified with ${results.performanceImprovement}% performance improvement.`,
          category: 'success',
        });
      } else {
        this.eventEmitter.emitNarration({
          message: 'Time Machine validation detected differences. Review the report for details.',
          category: 'warning',
        });
      }

      return results;
    } catch (error: any) {
      logger.error('Time Machine validation failed', error);
      const errorMessage = error.message || String(error);
      this.eventEmitter.emitNarration({
        message: `Time Machine validation encountered errors: ${errorMessage}`,
        category: 'error',
      });
      
      // Return a failed result instead of undefined
      return {
        success: false,
        originalResults: {
          passed: false,
          exitCode: -1,
          stdout: '',
          stderr: errorMessage,
          executionTime: 0,
        },
        modernResults: {
          passed: false,
          exitCode: -1,
          stdout: '',
          stderr: errorMessage,
          executionTime: 0,
        },
        functionalEquivalence: false,
        performanceImprovement: 0,
        comparisonReport: `Time Machine validation failed: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Generate final resurrection report
   * 
   * This method generates a comprehensive resurrection report including:
   * - Resurrection verdict with compilation proof
   * - Hybrid analysis results (AST + LLM)
   * - Post-resurrection validation results
   * - Time Machine validation results
   * - Batch execution summary
   * - Metrics comparison (before/after)
   * 
   * Requirements: FR-010, 4.3, 4.4, 4.5
   */
  async generateReport(): Promise<ResurrectionReport> {
    logger.info('Generating resurrection report');
    
    this.eventEmitter.emitNarration({
      message: 'Generating final resurrection report...',
    });

    // Extract metrics before and after if available from MetricsService
    let metricsBefore: MetricsSnapshot | undefined;
    let metricsAfter: MetricsSnapshot | undefined;
    
    try {
      const metricsHistory = this.metricsService.getHistory();
      metricsBefore = metricsHistory.baseline;
      metricsAfter = metricsHistory.current;
    } catch (error) {
      // Metrics not available - this is okay, report will work without them
      logger.debug('Metrics history not available for report');
    }

    // Extract batch execution results from transformation log
    const batchExecutionResults: any[] = [];
    for (const entry of this.state.context.transformationLog) {
      if (entry.type === 'dependency_update' && entry.details?.batchResults) {
        batchExecutionResults.push(...entry.details.batchResults);
      }
    }

    // Extract LLM analysis from hybrid analysis
    const llmAnalysis = this.state.hybridAnalysis?.llmAnalysis;

    // Generate the report with all available data
    const report = generateResurrectionReport(this.state.context, {
      hybridAnalysis: this.state.hybridAnalysis,
      metricsBefore,
      metricsAfter,
      timeMachineResults: this.state.timeMachineResults,
      resurrectionVerdict: this.state.context.resurrectionVerdict,
      validationResult: this.state.postResurrectionValidationResult,
      batchExecutionResults: batchExecutionResults.length > 0 ? batchExecutionResults : undefined,
      llmAnalysis,
      // Note: ghostTourPath, symphonyPath, and dashboardScreenshots would be set by
      // the frontend/visualization components and passed in separately if needed
      // fixHistory is not available from PostResurrectionValidationResult - it's internal to the validator
    });

    this.eventEmitter.emitNarration({
      message: 'Resurrection complete! Report generated.',
    });

    logger.info('Resurrection report generated successfully');
    logger.info(`  Report includes: ${Object.keys(report).filter(k => report[k as keyof ResurrectionReport] !== undefined).join(', ')}`);

    return report;
  }

  /**
   * Generate ResurrectionResult summary
   * This provides a concise summary of the resurrection process for API consumers
   * 
   * Requirements: 4.3, 4.4, 4.5
   */
  generateResurrectionResult(): import('../types').ResurrectionResult {
    const plan = this.state.context.resurrectionPlan;
    const dependenciesUpdated = plan?.items.filter(item => 
      this.state.context.transformationLog.some(log => 
        log.type === 'dependency_update' && 
        log.details?.packageName === item.packageName
      )
    ).length || 0;

    const vulnerabilitiesFixed = plan?.items.reduce((sum, item) => 
      sum + (item.fixesVulnerabilities ? item.vulnerabilityCount : 0), 0
    ) || 0;

    const errors: string[] = [];
    this.state.context.transformationLog
      .filter(log => log.type === 'error')
      .forEach(log => errors.push(log.message));

    // Determine if resurrection was partially successful
    const totalAttempted = this.state.dependencyUpdateSummary?.attempted || 0;
    const totalSucceeded = this.state.dependencyUpdateSummary?.succeeded || 0;
    const totalFailed = this.state.dependencyUpdateSummary?.failed || 0;
    const partialSuccess = totalSucceeded > 0 && totalFailed > 0;

    // Determine overall success
    const success = totalFailed === 0 && 
      (this.state.postResurrectionValidationResult?.success !== false) &&
      errors.length === 0;

    // Build summary message with detailed breakdown
    let message = '';
    if (success) {
      message = `✅ Successfully resurrected repository with ${dependenciesUpdated} dependencies updated and ${vulnerabilitiesFixed} vulnerabilities fixed.`;
      
      // Add validation status
      if (this.state.validationSummary) {
        if (this.state.validationSummary.compilationStatus === 'passed') {
          message += ' Compilation validation passed.';
        } else if (this.state.validationSummary.compilationStatus === 'not_applicable') {
          message += ' Compilation validation skipped (no build script).';
        }
      }
    } else if (partialSuccess) {
      message = `⚠️ Partial success: ${totalSucceeded} of ${totalAttempted} dependencies updated successfully, ${totalFailed} failed.`;
      
      // Add details about what succeeded and what failed
      const details: string[] = [];
      
      if (vulnerabilitiesFixed > 0) {
        details.push(`${vulnerabilitiesFixed} vulnerabilities fixed`);
      }
      
      if (this.state.validationSummary) {
        if (this.state.validationSummary.compilationStatus === 'passed') {
          details.push('compilation passed');
        } else if (this.state.validationSummary.compilationStatus === 'failed') {
          details.push('compilation failed');
        } else if (this.state.validationSummary.compilationStatus === 'not_applicable') {
          details.push('compilation skipped');
        }
      }
      
      if (details.length > 0) {
        message += ` (${details.join(', ')})`;
      }
    } else {
      message = `❌ Resurrection encountered issues: ${errors.length} errors occurred.`;
      
      // Add context about what failed
      if (totalAttempted > 0) {
        message += ` ${totalFailed} of ${totalAttempted} dependency updates failed.`;
      }
    }

    return {
      success,
      message,
      dependenciesUpdated,
      vulnerabilitiesFixed,
      branchUrl: this.state.context.resurrectionBranch 
        ? `${this.state.context.repoUrl}/tree/${this.state.context.resurrectionBranch}`
        : undefined,
      errors: errors.length > 0 ? errors : undefined,
      partialSuccess,
      llmAnalysisStatus: this.state.llmAnalysisStatus || 'skipped',
      llmProvider: this.state.llmProvider || 'none',
      dependencyUpdateSummary: this.state.dependencyUpdateSummary || {
        attempted: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0
      },
      validationSummary: this.state.validationSummary || {
        compilationStatus: 'not_applicable',
        testsStatus: 'not_applicable'
      }
    };
  }

  /**
   * Get the current context
   */
  getContext(): ResurrectionContext {
    return this.state.context;
  }

  /**
   * Get hybrid analysis results
   */
  getHybridAnalysis(): HybridAnalysis | undefined {
    return this.state.hybridAnalysis;
  }

  /**
   * Get Time Machine validation results
   */
  getTimeMachineResults(): TimeMachineValidationResult | undefined {
    return this.state.timeMachineResults;
  }

  /**
   * Get SSE server URL
   */
  getSSEServerURL(): string | null {
    if (!this.state.sseServer) {
      return null;
    }
    const address = this.state.sseServer.getAddress();
    if (!address) {
      return null;
    }
    return `http://${address.host}:${address.port}/events`;
  }
}

/**
 * Create and start a resurrection orchestrator
 */
export async function createResurrectionOrchestrator(
  context: ResurrectionContext,
  config?: OrchestratorConfig
): Promise<ResurrectionOrchestrator> {
  const orchestrator = new ResurrectionOrchestrator(context, config);
  await orchestrator.start();
  return orchestrator;
}
