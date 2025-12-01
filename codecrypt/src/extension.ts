/**
 * CodeCrypt VS Code Extension
 * Resurrects abandoned repositories with AI-powered modernization
 */

import * as vscode from 'vscode';
import { initializeLogger, disposeLogger } from './utils/logger.js';
import { formatErrorForUser } from './utils/errors.js';
import { initializeSecureConfig } from './services/secureConfig.js';
import { ResurrectionContext, DependencyReport } from './types.js';
import { ResurrectionStage } from './services/progress.js';
// Heavy service dependencies are loaded dynamically to prevent activation failures

/**
 * Extension activation
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
	try {
		console.log('[CodeCrypt] Starting extension activation...');
		
		// Initialize logger
		const logger = initializeLogger('CodeCrypt');
		logger.section('🧟 CODECRYPT EXTENSION ACTIVATED');
		logger.info('CodeCrypt is ready to resurrect your code!');
		console.log('[CodeCrypt] Logger initialized');
		
		// Initialize secure configuration manager
		initializeSecureConfig(context);
		logger.info('Secure configuration initialized');
		console.log('[CodeCrypt] Secure configuration initialized');

	// Register the resurrect repository command
	const resurrectCommand = vscode.commands.registerCommand(
		'codecrypt.resurrectRepository',
		async () => {
			try {
				logger.info('Resurrect repository command invoked');
				
				// Dynamically import heavy dependencies
				logger.info('Loading resurrection services...');
				const { parseGitHubUrl, fetchRepositoryMetadata, cloneRepository, createResurrectionBranch } = await import('./services/github.js');
				const { analyzeRepositoryDeath, generateDeathCertificate } = await import('./services/deathDetection.js');
				const { analyzeDependencies } = await import('./services/dependencyAnalysis.js');
				const { generateResurrectionPlan } = await import('./services/resurrectionPlanning.js');
				const { withProgressReporter } = await import('./services/progress.js');
				const { createResurrectionOrchestrator } = await import('./services/resurrectionOrchestrator.js');
				logger.info('Resurrection services loaded successfully');
				
				// Prompt user for GitHub repository URL
				const repoUrl = await vscode.window.showInputBox({
					prompt: '🧟 Enter the GitHub repository URL to resurrect',
					placeHolder: 'https://github.com/owner/repo',
					validateInput: (value) => {
						if (!value) {
							return 'Repository URL is required';
						}
						// Basic GitHub URL validation
						const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
						if (!githubUrlPattern.test(value.trim())) {
							return 'Please enter a valid GitHub repository URL';
						}
						return null;
					}
				});

				if (!repoUrl) {
					logger.info('User cancelled repository input');
					return;
				}

				logger.section('🧟 STARTING RESURRECTION PROCESS');
				logger.info(`Repository URL: ${repoUrl}`);
				
				// Initialize resurrection context
				const context: ResurrectionContext = {
					repoUrl: repoUrl.trim(),
					isDead: false,
					dependencies: [],
					transformationLog: []
				};
				
				// Execute resurrection with enhanced progress reporting
				await withProgressReporter(
					'🧟 CodeCrypt Resurrection',
					async (reporter) => {
						try {
							// Stage 1: Initialize and parse URL
							logger.subsection('Stage 1: Initialization');
							reporter.reportStage(ResurrectionStage.INITIALIZING, 'Parsing repository URL');
							
							let owner: string;
							let repo: string;
							
							try {
								const parsed = parseGitHubUrl(context.repoUrl);
								owner = parsed.owner;
								repo = parsed.repo;
								logger.info(`Parsed repository: ${owner}/${repo}`);
							} catch (error) {
								throw new Error(`Invalid GitHub URL: ${formatErrorForUser(error)}`);
							}
							
							// Fetch repository metadata with error handling
							reporter.reportProgress('Fetching repository metadata');
							let metadata;
							
							try {
								metadata = await fetchRepositoryMetadata(owner, repo);
								logger.info(`Repository: ${metadata.fullName}`);
								logger.info(`Language: ${metadata.language || 'Unknown'}`);
								logger.info(`Stars: ${metadata.stars}`);
								logger.info(`Last pushed: ${metadata.lastPushedAt}`);
							} catch (error) {
								throw new Error(`Failed to fetch repository metadata: ${formatErrorForUser(error)}`);
							}
							
							// Stage 2: Clone repository with error handling
							logger.subsection('Stage 2: Cloning Repository');
							reporter.reportStage(ResurrectionStage.CLONING, `Cloning ${owner}/${repo}`);
							
							let repoPath: string;
							
							try {
								// Get the current workspace folder
								const workspaceFolders = vscode.workspace.workspaceFolders;
								const workspaceDir = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;

								repoPath = await cloneRepository(owner, repo, workspaceDir);
								context.repoPath = repoPath;
								logger.info(`Repository cloned to: ${repoPath}`);
								
								// Open the cloned repository in a new window
								const { openClonedRepository } = await import('./services/github.js');
								await openClonedRepository(repoPath);

							} catch (error) {
								throw new Error(`Failed to clone repository: ${formatErrorForUser(error)}`);
							}
							
							// Stage 3: Analyze repository with error handling
							logger.subsection('Stage 3: Death Detection & Analysis');
							reporter.reportStage(ResurrectionStage.ANALYZING, 'Checking repository activity');
							
							try {
								const deathAnalysis = await analyzeRepositoryDeath(repoPath);
								context.isDead = deathAnalysis.isDead;
								context.lastCommitDate = deathAnalysis.lastCommitDate;
								
								const statusEmoji = deathAnalysis.isDead ? '💀' : '✅';
								logger.info(`Death analysis: ${deathAnalysis.isDead ? 'DEAD' : 'ALIVE'}`);
								logger.info(`Last commit: ${deathAnalysis.lastCommitDate.toISOString()}`);
								logger.info(`Days since last commit: ${deathAnalysis.daysSinceLastCommit}`);
								
								// Generate death certificate
								reporter.reportProgress('Generating death certificate');
								const certificatePath = await generateDeathCertificate(
									repoPath,
									metadata.fullName,
									deathAnalysis
								);
								logger.info(`Death certificate generated: ${certificatePath}`);
							} catch (error) {
								logger.warn('Death detection failed, continuing with analysis', error);
								reporter.reportProgress('Death detection skipped due to error');
							}
							
							// Analyze dependencies with comprehensive error handling
							logger.subsection('Dependency Analysis');
							reporter.reportProgress('Analyzing dependencies');
							let dependencyReport: DependencyReport | undefined;
							
							try {
								dependencyReport = await analyzeDependencies(repoPath);
								
								// Update context with dependency information
								context.dependencies = dependencyReport.dependencies;
								
								logger.info('Dependency analysis complete');
								logger.info(`  Total: ${dependencyReport.totalDependencies}`);
								logger.info(`  Outdated: ${dependencyReport.outdatedDependencies}`);
								logger.info(`  Vulnerable: ${dependencyReport.vulnerableDependencies}`);
								
								// Stage 4: Generate resurrection plan
								if (dependencyReport.outdatedDependencies > 0 || dependencyReport.vulnerableDependencies > 0) {
									logger.subsection('Stage 4: Resurrection Planning');
									reporter.reportStage(
										ResurrectionStage.PLANNING,
										`Planning updates for ${dependencyReport.outdatedDependencies} dependencies`
									);
									
									try {
										const resurrectionPlan = generateResurrectionPlan(dependencyReport);
										context.resurrectionPlan = resurrectionPlan;
										
										logger.info('Resurrection plan generated');
										logger.info(`  Total updates: ${resurrectionPlan.totalUpdates}`);
										logger.info(`  Security patches: ${resurrectionPlan.securityPatches}`);
										
									} catch (error) {
										logger.error('Failed to create resurrection plan', error);
										throw new Error(`Failed to create resurrection plan: ${formatErrorForUser(error)}`);
									}
								} else {
									logger.info('No updates needed - repository is up to date');
									reporter.reportProgress('Repository is up to date');
								}
								
							} catch (error) {
								logger.warn('Dependency analysis failed - repository may not be npm-based', error);
								reporter.reportProgress('Skipping dependency analysis (not an npm project)');
							}

							// Always create a resurrection branch if the repo is dead
							if (context.isDead) {
								try {
									reporter.reportProgress('Creating resurrection branch');
									const branchName = await createResurrectionBranch(repoPath);
									context.resurrectionBranch = branchName;
									logger.info(`Resurrection branch created: ${branchName}`);
								} catch (error) {
									logger.error('Failed to create resurrection branch', error);
									// Don't throw, as we can still proceed with analysis
								}
							}
							
							// Stage 5: Execute resurrection with orchestrator
							// The orchestrator can run even without a dependency report for code analysis and modernization
							logger.subsection('Stage 5: Executing Resurrection');
							reporter.reportStage(
								ResurrectionStage.UPDATING,
								'Executing resurrection analysis and modernization'
							);

							try {
								// Create orchestrator
								const orchestrator = await createResurrectionOrchestrator(context, {
									enableSSE: true,
									ssePort: 3000,
									enableHybridAnalysis: true,
									enableTimeMachine: true,
									enableLLM: true,
								});

								// Show SSE server URL
								const sseURL = orchestrator.getSSEServerURL();
								if (sseURL) {
									logger.info(`Frontend can connect to: ${sseURL}`);
								}

								// Run baseline compilation check FIRST (before any modifications)
								reporter.reportProgress('Running baseline compilation check');
								const baselineResult = await orchestrator.runBaselineCompilationCheck();
								if (baselineResult) {
									logger.info(`Baseline compilation: ${baselineResult.success ? 'PASSED' : 'FAILED'} (${baselineResult.errorCount} errors)`);
									if (!baselineResult.success) {
										logger.info(`  Error breakdown: ${Object.entries(baselineResult.errorsByCategory)
											.filter(([_, count]) => count > 0)
											.map(([cat, count]) => `${cat}: ${count}`)
											.join(', ')}`);
									}
								}

								// Run hybrid analysis (works without dependencies)
								reporter.reportProgress('Running hybrid analysis');
								const hybridAnalysis = await orchestrator.runHybridAnalysis();
								if (hybridAnalysis) {
									logger.info('Hybrid analysis complete');
									logger.info(`Priority files: ${hybridAnalysis.combinedInsights.priorityFiles.length}`);
								}

								// Execute resurrection plan only if dependencies were found
								if (context.resurrectionPlan && dependencyReport) {
									reporter.reportProgress('Executing resurrection plan for dependencies');
									await orchestrator.executeResurrectionPlan(dependencyReport);
								}

								// Run final compilation check and generate verdict
								reporter.reportProgress('Running final compilation verification');
								const verdict = await orchestrator.runFinalCompilationCheckAndVerdict();
								if (verdict) {
									if (verdict.resurrected) {
										logger.info(`🎉 RESURRECTION SUCCESSFUL! Fixed ${verdict.errorsFixed} compilation errors`);
									} else if (baselineResult?.success) {
										logger.info('Repository was already compiling - no resurrection needed');
									} else {
										logger.info(`Resurrection incomplete: ${verdict.errorsRemaining} errors remain`);
									}
								}

								// Run Time Machine validation
								reporter.reportProgress('Running Time Machine validation');
								const timeMachineResults = await orchestrator.runTimeMachineValidation();
								if (timeMachineResults) {
									logger.info(`Time Machine validation: ${timeMachineResults.success ? 'PASSED' : 'FAILED'}`);
								}

								// Generate final report
								reporter.reportProgress('Generating final report');
								const report = await orchestrator.generateReport();
								logger.info('Final report generated');

								// Stop orchestrator
								await orchestrator.stop();

								logger.info('Resurrection execution complete');
							} catch (error) {
								logger.error('Failed to execute resurrection', error);
								throw error;
							}
							
							// Report completion
							logger.subsection('Resurrection Process Complete');
							const statusEmoji = context.isDead ? '💀' : '✅';
							reporter.reportComplete(true, `${statusEmoji} Resurrection complete`);
							
						} catch (error) {
							logger.error('Failed during resurrection process', error);
							reporter.reportComplete(false, 'Resurrection failed');
							throw error;
						}
					}
				);

				// Show appropriate message based on analysis
				const statusEmoji = context.isDead ? '💀' : '✅';
				const statusText = context.isDead ? 'DEAD - Ready for resurrection!' : 'ALIVE - Recent activity detected';
				
				let message = `${statusEmoji} Repository analyzed: ${statusText}`;
				
				// Add dependency info if available
				if (context.dependencies.length > 0) {
					const outdated = context.dependencies.filter(d => 
						d.latestVersion !== 'unknown' && d.currentVersion !== d.latestVersion
					).length;
					const vulnerable = context.dependencies.filter(d => 
						d.vulnerabilities.length > 0
					).length;
					
					message += `\n📦 Dependencies: ${context.dependencies.length} total`;
					if (outdated > 0) {
						message += `, ${outdated} outdated`;
					}
					if (vulnerable > 0) {
						message += `, ${vulnerable} vulnerable`;
					}
				}
				
				// Add resurrection plan info if available
				if (context.resurrectionPlan) {
					message += `\n🧟 Resurrection plan: ${context.resurrectionPlan.totalUpdates} updates planned`;
					if (context.resurrectionPlan.securityPatches > 0) {
						message += ` (${context.resurrectionPlan.securityPatches} security patches)`;
					}
					if (context.resurrectionBranch) {
						message += `\n🌿 Branch: ${context.resurrectionBranch}`;
					}
				}
				
				vscode.window.showInformationMessage(message);
				logger.show();

			} catch (error) {
				logger.error('Failed to resurrect repository', error);
				vscode.window.showErrorMessage(
					`Failed to resurrect repository: ${formatErrorForUser(error)}`
				);
			}
		}
	);

	// Register the hello world command (for testing)
	const helloCommand = vscode.commands.registerCommand('codecrypt.helloWorld', () => {
		logger.info('Hello World command invoked');
		vscode.window.showInformationMessage('🧟 CodeCrypt is ready to resurrect your code!');
	});

	// Register secure configuration commands
	const configureGitHubTokenCommand = vscode.commands.registerCommand(
		'codecrypt.configureGitHubToken',
		async () => {
			try {
				const { getSecureConfig } = await import('./services/secureConfig.js');
				const secureConfig = getSecureConfig();
				await secureConfig.promptAndStoreGitHubToken();
			} catch (error) {
				logger.error('Failed to configure GitHub token', error);
				vscode.window.showErrorMessage(
					`Failed to configure GitHub token: ${formatErrorForUser(error)}`
				);
			}
		}
	);

	const configureGeminiApiKeyCommand = vscode.commands.registerCommand(
		'codecrypt.configureGeminiApiKey',
		async () => {
			try {
				const { getSecureConfig } = await import('./services/secureConfig.js');
				const secureConfig = getSecureConfig();
				await secureConfig.promptAndStoreGeminiApiKey();
			} catch (error) {
				logger.error('Failed to configure Gemini API key', error);
				vscode.window.showErrorMessage(
					`Failed to configure Gemini API key: ${formatErrorForUser(error)}`
				);
			}
		}
	);

	const switchLLMProviderCommand = vscode.commands.registerCommand(
		'codecrypt.switchLLMProvider',
		async () => {
			try {
				const config = vscode.workspace.getConfiguration('codecrypt');
				const currentProvider = config.get<string>('llmProvider', 'anthropic');
				
				const newProvider = await vscode.window.showQuickPick(
					[
						{
							label: 'Anthropic (Claude)',
							description: currentProvider === 'anthropic' ? 'Currently selected' : '',
							value: 'anthropic'
						},
						{
							label: 'Google Gemini',
							description: currentProvider === 'gemini' ? 'Currently selected' : '',
							value: 'gemini'
						}
					],
					{
						placeHolder: 'Select LLM provider for semantic code analysis',
						title: 'Switch LLM Provider'
					}
				);

				if (newProvider) {
					await config.update('llmProvider', newProvider.value, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(
						`LLM provider switched to ${newProvider.label}`
					);
					logger.info(`LLM provider switched to ${newProvider.value}`);
				}
			} catch (error) {
				logger.error('Failed to switch LLM provider', error);
				vscode.window.showErrorMessage(
					`Failed to switch LLM provider: ${formatErrorForUser(error)}`
				);
			}
		}
	);

	const clearSecretsCommand = vscode.commands.registerCommand(
		'codecrypt.clearSecrets',
		async () => {
			try {
				const confirm = await vscode.window.showWarningMessage(
					'Are you sure you want to clear all stored secrets?',
					{ modal: true },
					'Yes, clear all secrets'
				);

				if (confirm) {
					const { getSecureConfig } = await import('./services/secureConfig.js');
					const secureConfig = getSecureConfig();
					await secureConfig.clearAllSecrets();
				}
			} catch (error) {
				logger.error('Failed to clear secrets', error);
				vscode.window.showErrorMessage(
					`Failed to clear secrets: ${formatErrorForUser(error)}`
				);
			}
		}
	);

	// Add commands to subscriptions
	context.subscriptions.push(
		resurrectCommand,
		helloCommand,
		configureGitHubTokenCommand,
		configureGeminiApiKeyCommand,
		switchLLMProviderCommand,
		clearSecretsCommand
	);
	
	logger.info('CodeCrypt commands registered successfully');
	console.log('[CodeCrypt] All commands registered successfully');
	console.log('[CodeCrypt] Extension activation complete ✓');
	} catch (error) {
		// Log activation error with full details
		console.error('[CodeCrypt] Extension activation FAILED:', error);
		if (error instanceof Error) {
			console.error('[CodeCrypt] Error stack:', error.stack);
		}
		vscode.window.showErrorMessage(
			`CodeCrypt failed to activate: ${error instanceof Error ? error.message : String(error)}`
		);
		// Re-throw to let VS Code know activation failed
		throw error;
	}
}

/**
 * Extension deactivation
 * Called when the extension is deactivated
 */
export function deactivate() {
	disposeLogger();
}
