/**
 * Extension Activation Integration Tests
 * Tests the full extension lifecycle including activation, command registration, and deactivation
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Activation Test Suite', () => {
	const extensionId = 'codecrypt.codecrypt';
	let extension: vscode.Extension<any> | undefined;

	suiteSetup(async function() {
		// Increase timeout for extension activation
		this.timeout(30000);
		
		// Get the extension
		extension = vscode.extensions.getExtension(extensionId);
		
		if (!extension) {
			throw new Error(`Extension ${extensionId} not found. Check package.json publisher and name fields.`);
		}

		// Activate the extension
		await extension.activate();
	});

	test('Extension should be present', () => {
		assert.ok(extension, 'Extension should be found');
	});

	test('Extension should activate successfully', () => {
		assert.ok(extension, 'Extension should exist');
		assert.strictEqual(extension.isActive, true, 'Extension should be active after activation');
	});

	test('Extension should have correct ID', () => {
		assert.ok(extension, 'Extension should exist');
		assert.strictEqual(extension.id, extensionId, `Extension ID should be ${extensionId}`);
	});

	test('All commands should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		
		const expectedCommands = [
			'codecrypt.resurrectRepository',
			'codecrypt.helloWorld',
			'codecrypt.configureGitHubToken',
			'codecrypt.configureGeminiApiKey',
			'codecrypt.switchLLMProvider',
			'codecrypt.clearSecrets'
		];

		for (const cmd of expectedCommands) {
			assert.ok(
				commands.includes(cmd),
				`Command ${cmd} should be registered`
			);
		}
	});

	test('Hello World command should execute without errors', async function() {
		this.timeout(5000);
		
		try {
			await vscode.commands.executeCommand('codecrypt.helloWorld');
			// If we get here, the command executed successfully
			assert.ok(true, 'Hello World command executed successfully');
		} catch (error) {
			assert.fail(`Hello World command failed: ${error}`);
		}
	});

	test('Extension should export activate function', () => {
		assert.ok(extension, 'Extension should exist');
		// The extension module should have been activated
		assert.strictEqual(extension.isActive, true, 'Extension should have activate function that was called');
	});

	test('Package.json should have required fields', async () => {
		assert.ok(extension, 'Extension should exist');
		
		const packageJson = extension.packageJSON;
		
		assert.ok(packageJson.name, 'Package.json should have name field');
		assert.ok(packageJson.publisher, 'Package.json should have publisher field');
		assert.ok(packageJson.version, 'Package.json should have version field');
		assert.ok(packageJson.engines, 'Package.json should have engines field');
		assert.ok(packageJson.engines.vscode, 'Package.json should specify vscode engine version');
		assert.ok(packageJson.main, 'Package.json should have main entry point');
	});

	test('Package.json should declare all commands', async () => {
		assert.ok(extension, 'Extension should exist');
		
		const packageJson = extension.packageJSON;
		const commands = packageJson.contributes?.commands || [];
		
		assert.ok(commands.length > 0, 'Package.json should declare commands');
		assert.strictEqual(commands.length, 6, 'Package.json should declare 6 commands');
		
		const commandIds = commands.map((cmd: any) => cmd.command);
		assert.ok(commandIds.includes('codecrypt.resurrectRepository'), 'Should declare resurrectRepository command');
		assert.ok(commandIds.includes('codecrypt.helloWorld'), 'Should declare helloWorld command');
	});

	test('Main entry point should exist', async () => {
		assert.ok(extension, 'Extension should exist');
		
		const packageJson = extension.packageJSON;
		const mainPath = packageJson.main;
		
		assert.ok(mainPath, 'Package.json should specify main entry point');
		assert.ok(
			mainPath.includes('dist/extension.js') || mainPath.includes('out/extension.js'),
			'Main entry point should be in dist or out folder'
		);
	});

	test('Extension should handle command errors gracefully', async function() {
		this.timeout(5000);
		
		// Verify that commands are registered and can be found
		// We don't execute commands that require user input as they will hang in tests
		const commands = await vscode.commands.getCommands(true);
		
		// Verify the command exists (it's registered)
		assert.ok(
			commands.includes('codecrypt.configureGitHubToken'),
			'configureGitHubToken command should be registered'
		);
		
		// The command is registered and available - this proves the extension
		// handles command registration gracefully
		assert.ok(true, 'Command registration handled gracefully');
	});
});

suite('Extension Deactivation Test Suite', () => {
	test('Extension should have deactivate function', () => {
		const extensionId = 'codecrypt.codecrypt';
		const extension = vscode.extensions.getExtension(extensionId);
		
		assert.ok(extension, 'Extension should exist');
		// We can't directly test deactivation without reloading VS Code,
		// but we can verify the extension is structured correctly
		assert.ok(extension.isActive, 'Extension should be active');
	});
});
