/**
 * Integration test for registry pattern matching
 * 
 * Tests that a repository with a querystring GitHub URL:
 * - Matches the registry pattern
 * - Gets automatically replaced
 * - Logs the replacement action
 * - Displays correctly in the report
 * 
 * Requirements: 3.1-3.5
 */

import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DeadUrlHandler } from '../services/deadUrlHandler';
import { PackageReplacementRegistry } from '../services/packageReplacementRegistry';
import { URLValidator } from '../services/urlValidator';
import { LockfileParser } from '../services/lockfileParser';

describe('Registry Pattern Matching Integration Test', () => {
  let testRepoPath: string;
  let deadUrlHandler: DeadUrlHandler;
  let registry: PackageReplacementRegistry;

  beforeEach(async () => {
    // Create temporary test directory
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-registry-test-'));

    // Initialize services
    registry = new PackageReplacementRegistry();
    await registry.load();
    
    const urlValidator = new URLValidator();
    const lockfileParser = new LockfileParser();
    deadUrlHandler = new DeadUrlHandler(urlValidator, lockfileParser, registry);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should match querystring GitHub URL pattern and apply automatic replacement', async () => {
    // Create a package.json with querystring GitHub URL
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      dependencies: {
        querystring: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz'
      }
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );

    // Create dependencies map
    const dependencies = new Map<string, string>([
      ['querystring', 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz']
    ]);

    // Handle dead URLs
    const summary = await deadUrlHandler.handleDeadUrls(testRepoPath, dependencies);

    // Verify pattern was matched and replacement applied
    assert.strictEqual(summary.totalChecked, 1);
    assert.ok(summary.deadUrlsFound > 0);
    assert.strictEqual(summary.resolvedViaNpm, 1);
    assert.strictEqual(summary.removed, 0);

    // Verify the result details
    const result = summary.results.find(r => r.packageName === 'querystring');
    assert.ok(result, 'Result for querystring should exist');
    assert.strictEqual(result?.action, 'replaced');
    assert.strictEqual(result?.npmAlternative, '0.2.1'); // From registry pattern
    assert.ok(result?.warning?.includes('Registry pattern match'));
    assert.ok(result?.warning?.includes('Old GitHub tarball URL no longer accessible'));

    // Apply changes to package.json
    await deadUrlHandler.applyToPackageJson(testRepoPath, summary.results);

    // Verify package.json was updated
    const updatedContent = await fs.readFile(
      path.join(testRepoPath, 'package.json'),
      'utf-8'
    );
    const updatedPackageJson = JSON.parse(updatedContent);
    assert.strictEqual(updatedPackageJson.dependencies.querystring, '^0.2.1');

    // Generate and verify report
    const report = deadUrlHandler.generateReport(summary);
    assert.ok(report.includes('Dead URL Handling Report'));
    assert.ok(report.includes('querystring'));
    assert.ok(report.includes('Replaced dead URL with npm version 0.2.1'));
    assert.ok(report.includes('https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz'));
  });

  it('should match generic GitHub archive pattern and attempt npm lookup', async () => {
    // Create a package.json with a generic GitHub archive URL
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      dependencies: {
        'some-package': 'https://github.com/someuser/somepackage/archive/v1.0.0.tar.gz'
      }
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );

    // Create dependencies map
    const dependencies = new Map<string, string>([
      ['some-package', 'https://github.com/someuser/somepackage/archive/v1.0.0.tar.gz']
    ]);

    // Handle dead URLs
    const summary = await deadUrlHandler.handleDeadUrls(testRepoPath, dependencies);

    // Verify pattern was matched
    assert.strictEqual(summary.totalChecked, 1);
    assert.ok(summary.deadUrlsFound > 0);

    // Verify the result details
    const result = summary.results.find(r => r.packageName === 'some-package');
    assert.ok(result, 'Result for some-package should exist');
    assert.ok(result?.warning?.includes('Registry pattern match'));
    
    // The action depends on whether npm alternative was found
    // Either 'replaced' or 'removed' is acceptable
    assert.ok(['replaced', 'removed'].includes(result?.action || ''));
  });

  it('should log replacement actions for transparency', async () => {
    // Create a package.json with querystring GitHub URL
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      dependencies: {
        querystring: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz'
      }
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );

    // Create dependencies map
    const dependencies = new Map<string, string>([
      ['querystring', 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz']
    ]);

    // Capture console output (logger uses console)
    const originalLog = console.log;
    const originalInfo = console.info;
    const logs: string[] = [];
    
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    console.info = (...args: any[]) => {
      logs.push(args.join(' '));
      originalInfo(...args);
    };

    try {
      // Handle dead URLs
      await deadUrlHandler.handleDeadUrls(testRepoPath, dependencies);

      // Verify logging occurred
      const logString = logs.join('\n');
      assert.ok(logString.includes('URL matches registry pattern'));
      assert.ok(logString.includes('github.com/substack/querystring/*'));
      assert.ok(logString.includes('Applied registry replacement'));
    } finally {
      // Restore console
      console.log = originalLog;
      console.info = originalInfo;
    }
  });

  it('should display replacement in report with proper formatting', async () => {
    // Create a package.json with querystring GitHub URL
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      dependencies: {
        querystring: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz'
      }
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );

    // Create dependencies map
    const dependencies = new Map<string, string>([
      ['querystring', 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz']
    ]);

    // Handle dead URLs
    const summary = await deadUrlHandler.handleDeadUrls(testRepoPath, dependencies);

    // Generate report
    const report = deadUrlHandler.generateReport(summary);

    // Verify report structure
    assert.ok(report.includes('=== Dead URL Handling Report ==='));
    assert.ok(report.includes('Total URL-based dependencies checked: 1'));
    assert.ok(report.includes('Resolved via npm registry: 1'));
    
    // Verify details section
    assert.ok(report.includes('Details:'));
    assert.ok(report.includes('→ querystring: Replaced dead URL with npm version 0.2.1'));
    assert.ok(report.includes('Original: https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz'));
    assert.ok(report.includes('Warning: Registry pattern match'));
  });

  it('should handle multiple URL patterns in a single repository', async () => {
    // Create a package.json with multiple GitHub URLs
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      dependencies: {
        querystring: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
        'another-package': 'https://github.com/user/repo/archive/v2.0.0.tar.gz'
      }
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );

    // Create dependencies map
    const dependencies = new Map<string, string>([
      ['querystring', 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz'],
      ['another-package', 'https://github.com/user/repo/archive/v2.0.0.tar.gz']
    ]);

    // Handle dead URLs
    const summary = await deadUrlHandler.handleDeadUrls(testRepoPath, dependencies);

    // Verify both were checked
    assert.strictEqual(summary.totalChecked, 2);
    assert.strictEqual(summary.results.length, 2);

    // Verify querystring was replaced with specific version
    const querystringResult = summary.results.find(r => r.packageName === 'querystring');
    assert.strictEqual(querystringResult?.action, 'replaced');
    assert.strictEqual(querystringResult?.npmAlternative, '0.2.1');

    // Verify another-package was processed (either replaced or removed)
    const anotherResult = summary.results.find(r => r.packageName === 'another-package');
    assert.ok(anotherResult, 'Result for another-package should exist');
    assert.ok(['replaced', 'removed'].includes(anotherResult?.action || ''));
  });

  it('should verify registry contains the querystring pattern', async () => {
    // Load registry
    await registry.load();

    // Get dead URL patterns
    const patterns = registry.getDeadUrlPatterns();

    // Verify querystring pattern exists
    const querystringPattern = patterns.find(
      p => p.pattern === 'github.com/substack/querystring/*'
    );

    assert.ok(querystringPattern, 'Querystring pattern should exist in registry');
    assert.strictEqual(querystringPattern?.replacementPackage, 'querystring');
    assert.strictEqual(querystringPattern?.replacementVersion, '^0.2.1');
    assert.ok(querystringPattern?.reason.includes('Old GitHub tarball URL no longer accessible'));
  });

  it('should match URL against pattern correctly', async () => {
    // Load registry
    await registry.load();

    // Test various querystring URLs
    const testUrls = [
      'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
      'https://github.com/substack/querystring/archive/v1.0.0.tar.gz',
      'github.com/substack/querystring/tarball/master',
      'http://github.com/substack/querystring/archive/main.tar.gz'
    ];

    for (const url of testUrls) {
      const match = registry.matchesDeadUrlPattern(url);
      assert.ok(match, `URL should match pattern: ${url}`);
      assert.strictEqual(match?.pattern, 'github.com/substack/querystring/*');
    }

    // Test URL that should NOT match
    const nonMatchingUrl = 'https://github.com/otheruser/querystring/archive/v1.0.0.tar.gz';
    const noMatch = registry.matchesDeadUrlPattern(nonMatchingUrl);
    // This should match the generic pattern instead
    assert.ok(noMatch, 'URL should match a generic pattern');
    assert.notStrictEqual(noMatch?.pattern, 'github.com/substack/querystring/*');
  });
});
