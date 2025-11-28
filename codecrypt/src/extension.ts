/**
 * CodeCrypt VS Code Extension
 * Resurrects abandoned repositories with AI-powered modernization
 */

import * as vscode from 'vscode';
import { initializeLogger, disposeLogger } from './utils/logger';
import { formatErrorForUser } from './utils/errors';
import { parseGitHubUrl, fetchRepositoryMetadata, cloneRepository } from './services/github';
import { analyzeRepositoryDeath, generateDeathCertificate } from './services/deathDetection';
import { ResurrectionContext } from './types';

/**
 * Extension activation
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
	// Initialize logger
	const logger = initializeLogger('CodeCrypt');
	logger.info('🧟 CodeCrypt extension activated');

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

				logger.info(`Starting resurrection for: ${repoUrl}`);
				
				// Initialize resurrection context
				const context: ResurrectionContext = {
					repoUrl: repoUrl.trim(),
					isDead: false,
					dependencies: [],
					transformationLog: []
				};
				
				// Show progress notification
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: '🧟 CodeCrypt Resurrection',
						cancellable: false
					},
					async (progress) => {
						try {
							// Parse GitHub URL
							progress.report({ message: 'Parsing repository URL...' });
							const { owner, repo } = parseGitHubUrl(context.repoUrl);
							logger.info(`Parsed repository: ${owner}/${repo}`);
							
							// Fetch repository metadata
							progress.report({ message: 'Fetching repository metadata...' });
							const metadata = await fetchRepositoryMetadata(owner, repo);
							logger.info(`Repository: ${metadata.fullName}`);
							logger.info(`Language: ${metadata.language || 'Unknown'}`);
							logger.info(`Stars: ${metadata.stars}`);
							logger.info(`Last pushed: ${metadata.lastPushedAt}`);
							
							// Clone repository
							progress.report({ message: 'Cloning repository...' });
							const repoPath = await cloneRepository(owner, repo);
							context.repoPath = repoPath;
							logger.info(`Repository cloned to: ${repoPath}`);
							
							// Analyze repository death
							progress.report({ message: 'Analyzing repository activity...' });
							const deathAnalysis = await analyzeRepositoryDeath(repoPath);
							context.isDead = deathAnalysis.isDead;
							context.lastCommitDate = deathAnalysis.lastCommitDate;
							
							logger.info(`Death analysis: ${deathAnalysis.isDead ? 'DEAD' : 'ALIVE'}`);
							logger.info(`Last commit: ${deathAnalysis.lastCommitDate.toISOString()}`);
							logger.info(`Days since last commit: ${deathAnalysis.daysSinceLastCommit}`);
							
							// Generate death certificate
							progress.report({ message: 'Generating death certificate...' });
							const certificatePath = await generateDeathCertificate(
								repoPath,
								metadata.fullName,
								deathAnalysis
							);
							logger.info(`Death certificate generated: ${certificatePath}`);
							
							progress.report({ message: 'Death detection complete!' });
							
							// TODO: Implement dependency analysis and resurrection logic in subsequent tasks
							
						} catch (error) {
							logger.error('Failed during resurrection process', error);
							throw error;
						}
					}
				);

				// Show appropriate message based on death analysis
				const statusEmoji = context.isDead ? '💀' : '✅';
				const statusText = context.isDead ? 'DEAD - Ready for resurrection!' : 'ALIVE - Recent activity detected';
				
				vscode.window.showInformationMessage(
					`${statusEmoji} Repository analyzed: ${statusText}`
				);
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
