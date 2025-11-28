import * as assert from 'assert';
import { parseGitHubUrl } from '../services/github';

suite('GitHub Service Test Suite', () => {
	
	test('parseGitHubUrl - valid HTTPS URL', () => {
		const result = parseGitHubUrl('https://github.com/owner/repo');
		assert.strictEqual(result.owner, 'owner');
		assert.strictEqual(result.repo, 'repo');
	});

	test('parseGitHubUrl - valid HTTPS URL with trailing slash', () => {
		const result = parseGitHubUrl('https://github.com/owner/repo/');
		assert.strictEqual(result.owner, 'owner');
		assert.strictEqual(result.repo, 'repo');
	});

	test('parseGitHubUrl - valid HTTP URL', () => {
		const result = parseGitHubUrl('http://github.com/owner/repo');
		assert.strictEqual(result.owner, 'owner');
		assert.strictEqual(result.repo, 'repo');
	});

	test('parseGitHubUrl - valid URL with www', () => {
		const result = parseGitHubUrl('https://www.github.com/owner/repo');
		assert.strictEqual(result.owner, 'owner');
		assert.strictEqual(result.repo, 'repo');
	});

	test('parseGitHubUrl - invalid URL throws error', () => {
		assert.throws(() => {
			parseGitHubUrl('https://gitlab.com/owner/repo');
		}, /Invalid GitHub URL format/);
	});

	test('parseGitHubUrl - malformed URL throws error', () => {
		assert.throws(() => {
			parseGitHubUrl('not-a-url');
		}, /Invalid GitHub URL format/);
	});
});

suite('GitHub PR Creation', () => {
	const { generatePRTitle } = require('../services/github');
	
	test('generatePRTitle - with vulnerabilities fixed', () => {
		const title = generatePRTitle({
			updatesCount: 5,
			vulnerabilitiesFixed: 3
		});
		
		assert.ok(title.includes('🧟'));
		assert.ok(title.includes('5 updates'));
		assert.ok(title.includes('3 vulnerabilities fixed'));
	});
	
	test('generatePRTitle - without vulnerabilities', () => {
		const title = generatePRTitle({
			updatesCount: 2,
			vulnerabilitiesFixed: 0
		});
		
		assert.ok(title.includes('🧟'));
		assert.ok(title.includes('2 dependency updates'));
		assert.ok(!title.includes('vulnerabilities'));
	});
	
	test('generatePRTitle - single update', () => {
		const title = generatePRTitle({
			updatesCount: 1,
			vulnerabilitiesFixed: 0
		});
		
		assert.ok(title.includes('1 dependency updates'));
	});
});
