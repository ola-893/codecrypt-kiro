/**
 * Property-Based Tests for Registry Pattern Matching
 * 
 * **Feature: demo-readiness-fixes, Property 4: Registry Pattern Matching Correctness**
 * **Validates: Requirements 3.2**
 * 
 * Property: For any dead URL that matches a registry pattern, the replacement should be
 * applied consistently regardless of the order in which patterns are checked.
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PackageReplacementRegistry, DeadUrlPattern } from '../services/packageReplacementRegistry';

suite('Registry Pattern Matching Property Tests', () => {
  let tempDir: string;

  setup(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pattern-test-'));
  });

  teardown(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Arbitrary generator for URL components
   */
  const urlComponentArb = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => /^[a-z0-9-]+$/.test(s));

  /**
   * Arbitrary generator for GitHub URLs that match specific patterns
   */
  const githubUrlArb = fc.record({
    owner: urlComponentArb,
    repo: urlComponentArb,
    version: fc.string({ minLength: 1, maxLength: 10 })
      .filter(s => /^[a-z0-9.-]+$/.test(s))
  }).map(({ owner, repo, version }) => 
    `https://github.com/${owner}/${repo}/archive/${version}.tar.gz`
  );

  /**
   * Arbitrary generator for querystring-specific URLs
   */
  const querystringUrlArb = fc.record({
    version: fc.string({ minLength: 1, maxLength: 10 })
      .filter(s => /^[a-z0-9.-]+$/.test(s))
  }).map(({ version }) => 
    `https://github.com/substack/querystring/archive/${version}.tar.gz`
  );

  /**
   * **Feature: demo-readiness-fixes, Property 4: Registry Pattern Matching Correctness**
   * **Validates: Requirements 3.2**
   * 
   * Property: For any dead URL that matches a registry pattern, the replacement should be
   * applied consistently regardless of the order in which patterns are checked.
   */
  suite('Property 4: Registry Pattern Matching Correctness', () => {
    test('should match querystring URLs consistently', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          querystringUrlArb,
          async (url) => {
            // Create registry with querystring pattern
            const registryPath = path.join(tempDir, `querystring-${Date.now()}-${Math.random()}.json`);
            
            const registryData = {
              version: '1.0.0',
              lastUpdated: new Date().toISOString(),
              replacements: [],
              architectureIncompatible: [],
              knownDeadUrls: [],
              deadUrlPatterns: [
                {
                  pattern: 'github.com/substack/querystring/*',
                  replacementPackage: 'querystring',
                  replacementVersion: '^0.2.1',
                  reason: 'Old GitHub tarball URL no longer accessible'
                }
              ]
            };

            await fs.writeFile(registryPath, JSON.stringify(registryData, null, 2));

            const registry = new PackageReplacementRegistry(registryPath);
            await registry.load();

            // Test the URL matches the pattern
            const match = registry.matchesDeadUrlPattern(url);
            
            assert.ok(match !== null, `URL ${url} should match querystring pattern`);
            
            if (match) {
              assert.strictEqual(
                match.replacementPackage,
                'querystring',
                'Should return querystring as replacement'
              );
              assert.strictEqual(
                match.replacementVersion,
                '^0.2.1',
                'Should return correct version'
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should match GitHub archive URLs consistently', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          githubUrlArb,
          async (url) => {
            // Create registry with GitHub archive pattern
            const registryPath = path.join(tempDir, `github-${Date.now()}-${Math.random()}.json`);
            
            const registryData = {
              version: '1.0.0',
              lastUpdated: new Date().toISOString(),
              replacements: [],
              architectureIncompatible: [],
              knownDeadUrls: [],
              deadUrlPatterns: [
                {
                  pattern: '*/archive/*.tar.gz',
                  replacementPackage: null,
                  replacementVersion: null,
                  reason: 'Generic GitHub archive URLs are often dead'
                }
              ]
            };

            await fs.writeFile(registryPath, JSON.stringify(registryData, null, 2));

            const registry = new PackageReplacementRegistry(registryPath);
            await registry.load();

            // Test the URL matches the pattern
            const match = registry.matchesDeadUrlPattern(url);
            
            assert.ok(match !== null, `URL ${url} should match archive pattern`);
            
            if (match) {
              assert.strictEqual(
                match.replacementPackage,
                null,
                'Should return null for generic pattern'
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should match patterns consistently across multiple calls', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          querystringUrlArb,
          async (url) => {
            // Create registry with multiple patterns
            const registryPath = path.join(tempDir, `consistent-${Date.now()}-${Math.random()}.json`);
            
            const registryData = {
              version: '1.0.0',
              lastUpdated: new Date().toISOString(),
              replacements: [],
              architectureIncompatible: [],
              knownDeadUrls: [],
              deadUrlPatterns: [
                {
                  pattern: 'github.com/substack/querystring/*',
                  replacementPackage: 'querystring',
                  replacementVersion: '^0.2.1',
                  reason: 'Old GitHub tarball URL no longer accessible'
                },
                {
                  pattern: '*/archive/*.tar.gz',
                  replacementPackage: null,
                  replacementVersion: null,
                  reason: 'Generic GitHub archive URLs are often dead'
                }
              ]
            };

            await fs.writeFile(registryPath, JSON.stringify(registryData, null, 2));

            const registry = new PackageReplacementRegistry(registryPath);
            await registry.load();

            // Call matchesDeadUrlPattern multiple times with the same URL
            const match1 = registry.matchesDeadUrlPattern(url);
            const match2 = registry.matchesDeadUrlPattern(url);
            const match3 = registry.matchesDeadUrlPattern(url);

            // All calls should return the same result
            assert.ok(match1 !== null, 'First call should find a match');
            assert.ok(match2 !== null, 'Second call should find a match');
            assert.ok(match3 !== null, 'Third call should find a match');

            if (match1 && match2 && match3) {
              // All should match the same pattern (first matching one)
              assert.strictEqual(
                match1.pattern,
                match2.pattern,
                'First and second call should match same pattern'
              );
              assert.strictEqual(
                match2.pattern,
                match3.pattern,
                'Second and third call should match same pattern'
              );
              
              // All should return the same replacement
              assert.strictEqual(
                match1.replacementPackage,
                match2.replacementPackage,
                'First and second call should return same replacement package'
              );
              assert.strictEqual(
                match2.replacementPackage,
                match3.replacementPackage,
                'Second and third call should return same replacement package'
              );
              
              assert.strictEqual(
                match1.replacementVersion,
                match2.replacementVersion,
                'First and second call should return same replacement version'
              );
              assert.strictEqual(
                match2.replacementVersion,
                match3.replacementVersion,
                'Second and third call should return same replacement version'
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle wildcard patterns correctly', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            owner: urlComponentArb,
            repo: urlComponentArb,
            urlPath: fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => /^[a-z0-9/-]+$/.test(s))
          }),
          async ({ owner, repo, urlPath }) => {
            const url = `https://github.com/${owner}/${repo}/${urlPath}`;
            
            // Create registry with wildcard pattern
            const registryPath = path.join(tempDir, `wildcard-${Date.now()}-${Math.random()}.json`);
            
            const registryData = {
              version: '1.0.0',
              lastUpdated: new Date().toISOString(),
              replacements: [],
              architectureIncompatible: [],
              knownDeadUrls: [],
              deadUrlPatterns: [
                {
                  pattern: 'github.com/*/*',
                  replacementPackage: null,
                  replacementVersion: null,
                  reason: 'Generic GitHub URL pattern'
                }
              ]
            };

            await fs.writeFile(registryPath, JSON.stringify(registryData, null, 2));

            const registry = new PackageReplacementRegistry(registryPath);
            await registry.load();

            // Test the URL matches the wildcard pattern
            const match = registry.matchesDeadUrlPattern(url);
            
            // Should match because github.com/*/* matches github.com/{owner}/{repo}/...
            assert.ok(match !== null, `URL ${url} should match wildcard pattern`);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should not match URLs that do not fit the pattern', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            domain: fc.constantFrom('npmjs.com', 'registry.npmjs.org', 'example.com'),
            urlPath: fc.string({ minLength: 1, maxLength: 50 })
              .filter(s => /^[a-z0-9/-]+$/.test(s))
          }),
          async ({ domain, urlPath }) => {
            const url = `https://${domain}/${urlPath}`;
            
            // Create registry with GitHub-specific patterns
            const registryPath = path.join(tempDir, `nomatch-${Date.now()}-${Math.random()}.json`);
            
            const registryData = {
              version: '1.0.0',
              lastUpdated: new Date().toISOString(),
              replacements: [],
              architectureIncompatible: [],
              knownDeadUrls: [],
              deadUrlPatterns: [
                {
                  pattern: 'github.com/substack/querystring/*',
                  replacementPackage: 'querystring',
                  replacementVersion: '^0.2.1',
                  reason: 'Old GitHub tarball URL'
                }
              ]
            };

            await fs.writeFile(registryPath, JSON.stringify(registryData, null, 2));

            const registry = new PackageReplacementRegistry(registryPath);
            await registry.load();

            // Test the URL does not match the pattern
            const match = registry.matchesDeadUrlPattern(url);
            
            // Should not match because it's not a GitHub URL
            assert.strictEqual(match, null, `URL ${url} should not match GitHub pattern`);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle multiple matching patterns by returning first match', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          querystringUrlArb,
          async (url) => {
            // Create registry with multiple overlapping patterns
            const registryPath = path.join(tempDir, `multi-${Date.now()}-${Math.random()}.json`);
            
            const registryData = {
              version: '1.0.0',
              lastUpdated: new Date().toISOString(),
              replacements: [],
              architectureIncompatible: [],
              knownDeadUrls: [],
              deadUrlPatterns: [
                {
                  pattern: 'github.com/substack/querystring/*',
                  replacementPackage: 'querystring',
                  replacementVersion: '^0.2.1',
                  reason: 'Specific querystring pattern'
                },
                {
                  pattern: '*/archive/*.tar.gz',
                  replacementPackage: null,
                  replacementVersion: null,
                  reason: 'Generic archive pattern'
                }
              ]
            };

            await fs.writeFile(registryPath, JSON.stringify(registryData, null, 2));

            const registry = new PackageReplacementRegistry(registryPath);
            await registry.load();

            // Test the URL matches
            const match = registry.matchesDeadUrlPattern(url);
            
            assert.ok(match !== null, 'Should find a match');
            
            if (match) {
              // Should return the first matching pattern (querystring-specific)
              assert.strictEqual(
                match.pattern,
                'github.com/substack/querystring/*',
                'Should return the first matching pattern'
              );
              assert.strictEqual(
                match.replacementPackage,
                'querystring',
                'Should return querystring replacement'
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
