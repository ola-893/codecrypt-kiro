/**
 * CodeCrypt VS Code Extension
 * Resurrects abandoned repositories with AI-powered modernization
 */

import * as vscode from 'vscode';
import { initializeLogger, disposeLogger } from './utils/logger';
import { formatErrorForUser } from './utils/errors';
import { parseGitHubUrl, fetchRepositoryMetadata, cloneRepository, createResurrectionBranch } from './services/github';
import { analyzeRepositoryDeath, generateDeathCertificate } from './services/deathDetection';
import { analyzeDependencies } from './services/dependencyAnalysis';
import { generateResurrectionPlan } from './services/resurrectionPlanning';
import { ResurrectionContext, DependencyReport } from './types';
import { withProgressReporter, ResurrectionStage } from './services/progress';

/**
 * Extension activation
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
	// Initialize logger
	const logger = initializeLogger('CodeCrypt');
	logger.section('🧟 CODECRYPT EXTENSION ACTIVATED');
	logger.info('CodeCrypt is ready to resurrect your code!');

	// Register the resurrect repository command
	const resurrectCommand = vscode.commands.registerCommand(
		'codecrypt.resurrectRepository',
		async () => {
			try {
				logger.info('Resurrect repository command invoked');
				
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
							const { owner, repo } = parseGitHubUrl(context.repoUrl);
							logger.info(`Parsed repository: ${owner}/${repo}`);
							
							// Fetch repository metadata
							reporter.reportProgress('Fetching repository metadata');
							const metadata = await fetchRepositoryMetadata(owner, repo);
							logger.info(`Repository: ${metadata.fullName}`);
							logger.info(`Language: ${metadata.language || 'Unknown'}`);
							logger.info(`Stars: ${metadata.stars}`);
							logger.info(`Last pushed: ${metadata.lastPushedAt}`);
							
							// Stage 2: Clone repository
							logger.subsection('Stage 2: Cloning Repository');
							reporter.reportStage(ResurrectionStage.CLONING, `Cloning ${owner}/${repo}`);
							const repoPath = await cloneRepository(owner, repo);
							context.repoPath = repoPath;
							logger.info(`Repository cloned to: ${repoPath}`);
							
							// Stage 3: Analyze repository
							logger.subsection('Stage 3: Death Detection & Analysis');
							reporter.reportStage(ResurrectionStage.ANALYZING, 'Checking repository activity');
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
							
							// Analyze dependencies
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
									
									const resurrectionPlan = generateResurrectionPlan(dependencyReport);
									context.resurrectionPlan = resurrectionPlan;
									
									logger.info('Resurrection plan generated');
									logger.info(`  Total updates: ${resurrectionPlan.totalUpdates}`);
									logger.info(`  Security patches: ${resurrectionPlan.securityPatches}`);
									
									// Create resurrection branch
									reporter.reportProgress('Creating resurrection branch');
									const branchName = await createResurrectionBranch(repoPath);
									context.resurrectionBranch = branchName;
									
									logger.info(`Resurrection branch created: ${branchName}`);
								} else {
									logger.info('No updates needed - repository is up to date');
									reporter.reportProgress('Repository is up to date');
								}
								
							} catch (error) {
								logger.warn('Dependency analysis failed - repository may not be npm-based', error);
								reporter.reportProgress('Skipping dependency analysis (not an npm project)');
							}
							
							// Report completion
							logger.subsection('Resurrection Process Complete');
							reporter.reportComplete(true, `${statusEmoji} Analysis complete`);
							
							// TODO: Implement automated resurrection in subsequent tasks
							
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

	// Add commands to subscriptions
	context.subscriptions.push(resurrectCommand, helloCommand);
	
	logger.info('CodeCrypt commands registered successfully');
}

/**
 * Extension deactivation
 * Called when the extension is deactivated
 */
export function deactivate() {
	disposeLogger();
}
