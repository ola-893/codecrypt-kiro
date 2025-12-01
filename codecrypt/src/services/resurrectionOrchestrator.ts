/**
 * Resurrection Orchestrator
 * Integrates all components of the resurrection pipeline
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { ResurrectionContext, DependencyReport, HybridAnalysis, TimeMachineValidationResult, BaselineCompilationResult, ResurrectionVerdict } from '../types';
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
}

/**
 * Orchestrator state
 */
interface OrchestratorState {
  sseServer?: SSEServer;
  context: ResurrectionContext;
  hybridAnalysis?: HybridAnalysis;
  timeMachineResults?: TimeMachineValidationResult;
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
    };

    this.state = {
      context,
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
        logger.info('Running LLM analysis');
        this.eventEmitter.emitNarration({
          message: 'Analyzing code semantics with AI...',
        });

        try {
          const secureConfig = getSecureConfig();
          const config = vscode.workspace.getConfiguration('codecrypt');
          const preferredProvider = config.get<string>('llmProvider', 'anthropic');

          let llmClient: LLMClient | GeminiClient | undefined;
          let usedProvider: string | undefined;

          const anthropicApiKey = await secureConfig.getAnthropicApiKey();
          const geminiApiKey = await secureConfig.getGeminiApiKey();

          // Determine which client to use based on preference and available keys
          if (preferredProvider === 'gemini' && geminiApiKey) {
            logger.info('Using configured Gemini provider.');
            llmClient = new GeminiClient({ apiKey: geminiApiKey });
            usedProvider = 'gemini';
          } else if (preferredProvider === 'anthropic' && anthropicApiKey) {
            logger.info('Using configured Anthropic provider.');
            llmClient = new LLMClient({ apiKey: anthropicApiKey });
            usedProvider = 'anthropic';
          } else if (geminiApiKey) {
            // Fallback to Gemini if its key is available
            logger.info('Falling back to Gemini provider because its API key is configured.');
            llmClient = new GeminiClient({ apiKey: geminiApiKey });
            usedProvider = 'gemini';
          } else if (anthropicApiKey) {
            // Fallback to Anthropic if its key is available
            logger.info('Falling back to Anthropic provider because its API key is configured.');
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
            } else {
              logger.info(`Performing fresh LLM analysis with ${usedProvider}`);
              llmAnalysis = await analyzeLLMRepository(llmClient, this.state.context.repoPath, astAnalysis);
              llmCache.set(cacheKey, llmAnalysis);
            }
            
            for (const insight of llmAnalysis.insights) {
              this.eventEmitter.emitLLMInsight({
                filePath: insight.filePath,
                insight: insight,
                summary: `Analyzed ${insight.filePath}: ${insight.modernizationSuggestions.length} suggestions`,
              });
            }
            logger.info(`LLM analysis complete: ${llmAnalysis.insights.length} files analyzed`);
          } else {
            logger.warn('No LLM API keys are configured, skipping LLM analysis.');
            this.eventEmitter.emitNarration({
              message: 'AI analysis skipped: No API key configured for Anthropic or Gemini.',
              category: 'info',
            });
          }
        } catch (error: any) {
          logger.warn('LLM analysis failed, continuing with AST only', error);
          const errorMessage = error.message || String(error);
          this.eventEmitter.emitNarration({
            message: `AI analysis unavailable (${errorMessage}). Using structural analysis only.`,
            category: 'warning',
          });
        }
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
      const plan = generateResurrectionPlan(dependencyReport);
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

      let successCount = 0;
      let failureCount = 0;

      // Execute each update in the plan
      for (const planItem of plan.items) {
        try {
          logger.info(`Updating ${planItem.packageName} from ${planItem.currentVersion} to ${planItem.targetVersion}`);
          
          this.eventEmitter.emitNarration({
            message: `Updating ${planItem.packageName} to version ${planItem.targetVersion}...`,
          });

          // Execute the update with timeout protection
          const updateResult = await Promise.race([
            updateDependency(this.state.context.repoPath, planItem),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Update timeout')), 300000) // 5 minute timeout
            )
          ]);

          this.eventEmitter.emitDependencyUpdated({
            packageName: planItem.packageName,
            previousVersion: planItem.currentVersion,
            newVersion: planItem.targetVersion,
            success: updateResult.success,
            vulnerabilitiesFixed: planItem.vulnerabilityCount,
          });

          if (!updateResult.success) {
            logger.warn(`Update failed: ${planItem.packageName}`);
            failureCount++;
            this.eventEmitter.emitNarration({
              message: `Failed to update ${planItem.packageName}. Continuing with next update.`,
              category: 'warning',
            });
            continue;
          }

          // Validate the update with error handling
          let validationResult;
          try {
            validationResult = await validateAfterUpdate(this.state.context.repoPath);
          } catch (error: any) {
            logger.error('Validation failed with error', error);
            validationResult = {
              success: false,
              compilationChecked: false,
              testsRun: false,
              error: error.message || String(error),
            };
          }
          
          this.eventEmitter.emitTestCompleted({
            testType: 'unit',
            passed: validationResult.success,
            testsRun: validationResult.testsRun ? 1 : 0,
            testsPassed: validationResult.testsPassed ? 1 : 0,
            testsFailed: validationResult.testsRun && !validationResult.testsPassed ? 1 : 0,
            executionTime: 0,
          });

          if (!validationResult.success) {
            logger.warn(`Update failed validation: ${planItem.packageName}`);
            failureCount++;
            this.eventEmitter.emitNarration({
              message: `Update to ${planItem.packageName} failed validation. Rolling back...`,
              category: 'warning',
            });

            // Rollback the update with error handling
            try {
              await rollbackLastCommit(this.state.context.repoPath);
              logger.info('Rollback successful');
            } catch (rollbackError) {
              logger.error('Rollback failed', rollbackError);
              this.eventEmitter.emitNarration({
                message: 'Warning: Rollback failed. Manual intervention may be required.',
                category: 'error',
              });
            }
            
            // Log the failure
            this.state.context.transformationLog.push({
              timestamp: new Date(),
              type: 'dependency_update',
              message: `Failed to update ${planItem.packageName} to ${planItem.targetVersion}`,
              details: {
                packageName: planItem.packageName,
                targetVersion: planItem.targetVersion,
                reason: validationResult.error || 'Validation failed',
              },
            });

            continue;
          }

          // Log successful update
          successCount++;
          this.state.context.transformationLog.push({
            timestamp: new Date(),
            type: 'dependency_update',
            message: `Updated ${planItem.packageName} from ${planItem.currentVersion} to ${planItem.targetVersion}`,
            details: {
              packageName: planItem.packageName,
              oldVersion: planItem.currentVersion,
              newVersion: planItem.targetVersion,
            },
          });

          // Emit transformation applied
          this.eventEmitter.emitTransformationApplied({
            transformationType: 'dependency_update',
            packageName: planItem.packageName,
            version: {
              from: planItem.currentVersion,
              to: planItem.targetVersion,
            },
            details: planItem,
            success: true,
          });

          this.eventEmitter.emitNarration({
            message: `Successfully updated ${planItem.packageName}. Tests passing.`,
            category: 'success',
          });

        } catch (error: any) {
          failureCount++;
          const errorMessage = error.message || String(error);
          logger.error(`Failed to update ${planItem.packageName}`, error);
          
          this.eventEmitter.emitNarration({
            message: `Failed to update ${planItem.packageName}: ${errorMessage}. Continuing with next update.`,
            category: 'error',
          });

          // Log the error
          this.state.context.transformationLog.push({
            timestamp: new Date(),
            type: 'error',
            message: `Error updating ${planItem.packageName}: ${errorMessage}`,
            details: {
              packageName: planItem.packageName,
              error: errorMessage,
            },
          });
        }
      }

      // Final summary
      const totalAttempted = successCount + failureCount;
      this.eventEmitter.emitNarration({
        message: `Resurrection plan execution complete. ${successCount}/${totalAttempted} updates successful.`,
        category: successCount === totalAttempted ? 'success' : 'info',
      });

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
   */
  async generateReport(): Promise<ResurrectionReport> {
    logger.info('Generating resurrection report');
    
    this.eventEmitter.emitNarration({
      message: 'Generating final resurrection report...',
    });

    const report = generateResurrectionReport(this.state.context, {
      hybridAnalysis: this.state.hybridAnalysis,
      timeMachineResults: this.state.timeMachineResults,
    });

    this.eventEmitter.emitNarration({
      message: 'Resurrection complete! Report generated.',
    });

    return report;
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
