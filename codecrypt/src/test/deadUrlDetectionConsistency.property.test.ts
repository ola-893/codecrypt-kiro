/**
 * Property-Based Tests for Dead URL Detection Consistency
 * 
 * **Feature: demo-readiness-fixes, Property 2: Dead URL Detection Consistency**
 * **Validates: Requirements 1.2**
 * 
 * Property: For any dependency (direct or transitive) with a URL-based resolution,
 * the dead URL detection should produce the same result when run multiple times
 * on the same URL.
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as fc from 'fast-check';
import { DeadUrlHandler } from '../services/deadUrlHandler';
import { URLValidator } from '../services/urlValidator';
import { LockfileParser } from '../services/lockfileParser';
import { PackageReplacementRegistry } from '../services/packageReplacementRegistry';
import { URLValidationResult } from '../types';

// Mock URLValidator for consistent testing
class ConsistentMockURLValidator extends URLValidator {
  private validationResults: Map<string, URLValidationResult>;
  private npmAlternatives: Map<string, string | null>;
  private callCounts: Map<string, number>;

  constructor() {
    super();
    this.validationResults = new Map();
    this.npmAlternatives = new Map();
    this.callCounts = new Map();
  }

  setValidationResult(url: string, result: URLValidationResult): void {
    this.validationResults.set(url, result);
  }

  setNpmAlternative(packageName: string, version: string | null): void {
    this.npmAlternatives.set(packageName, version);
  }

  getCallCount(url: string): number {
    return this.callCounts.get(url) || 0;
  }

  async validate(url: string): Promise<URLValidationResult> {
    // Track call count
    this.callCounts.set(url, (this.callCounts.get(url) || 0) + 1);
    
    const result = this.validationResults.get(url);
    if (result) {
      // Return the same result every time (consistency)
      return result;
    }
    
    // Default to invalid
    return { url, isValid: false };
  }

  async findNpmAlternative(packageName: string): Promise<string | null> {
    if (this.npmAlternatives.has(packageName)) {
      return this.npmAlternatives.get(packageName) || null;
    }
    return null;
  }

  extractPackageFromUrl(url: string): string | null {
    return super.extractPackageFromUrl(url);
  }
}

// Mock LockfileParser that returns empty results
class MockLockfileParser extends LockfileParser {
  async parseLockfile(): Promise<any[]> {
    return [];
  }

  async detectLockfileType(): Promise<'npm' | 'yarn' | 'pnpm' | null> {
    return null;
  }

  async deleteLockfiles(): Promise<void> {
    // No-op
  }
}

// Mock PackageReplacementRegistry that returns no matches
class MockPackageReplacementRegistry extends PackageReplacementRegistry {
  async load(): Promise<void> {
    // No-op
  }

  matchesDeadUrlPattern(): null {
    return null;
  }
}

suite('Dead URL Detection Consistency Property Tests', () => {
  let tempDir: string;

  setup(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dead-url-consistency-test-'));
  });

  teardown(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Arbitraries for generating test data
  const packageNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{1,30}$/)
    .filter((s: string) => s.length >= 2 && !s.endsWith('-') && !s.includes('--'));

  const versionArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 10 }),
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 50 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  const githubUrlArbitrary = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    packageNameArbitrary,
    versionArbitrary
  ).map(([user, repo, version]) => 
    `https://github.com/${user}/${repo}/archive/${version}.tar.gz`
  );

  const gitProtocolUrlArbitrary = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    packageNameArbitrary,
    fc.stringMatching(/^[a-z0-9]{7,40}$/)
  ).map(([user, repo, hash]) => `github:${user}/${repo}#${hash}`);

  const urlBasedDependencyArbitrary = fc.oneof(
    githubUrlArbitrary,
    gitProtocolUrlArbitrary
  );

  /**
   * Property 2: Dead URL Detection Consistency
   * 
   * For any dependency with a URL-based resolution, the dead URL detection
   * should produce the same result when run multiple times on the same URL.
   */
  test('Property 2: Dead URL Detection Consistency - Single URL multiple runs', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          packageName: packageNameArbitrary,
          url: urlBasedDependencyArbitrary,
          isAccessible: fc.boolean(),
          hasNpmAlternative: fc.boolean(),
          npmVersion: versionArbitrary,
          numRuns: fc.integer({ min: 2, max: 5 })
        }),
        async ({ packageName, url, isAccessible, hasNpmAlternative, npmVersion, numRuns }) => {
          const mockValidator = new ConsistentMockURLValidator();
          const mockLockfileParser = new MockLockfileParser();
          const mockRegistry = new MockPackageReplacementRegistry();
          
          // Set up mock validation result (same for all runs)
          mockValidator.setValidationResult(url, {
            url,
            isValid: isAccessible,
            statusCode: isAccessible ? 200 : 404
          });

          // Set up npm alternative
          if (hasNpmAlternative) {
            mockValidator.setNpmAlternative(packageName, npmVersion);
          } else {
            mockValidator.setNpmAlternative(packageName, null);
          }

          const dependencies = new Map([[packageName, url]]);
          const results: any[] = [];

          // Run dead URL detection multiple times
          for (let i = 0; i < numRuns; i++) {
            const handler = new DeadUrlHandler(mockValidator, mockLockfileParser, mockRegistry);
            const summary = await handler.handleDeadUrls(tempDir, dependencies);
            results.push(summary);
          }

          // Property: All runs should produce identical results
          for (let i = 1; i < numRuns; i++) {
            assert.strictEqual(
              results[i].totalChecked,
              results[0].totalChecked,
              `Run ${i}: totalChecked should be consistent`
            );
            assert.strictEqual(
              results[i].deadUrlsFound,
              results[0].deadUrlsFound,
              `Run ${i}: deadUrlsFound should be consistent`
            );
            assert.strictEqual(
              results[i].resolvedViaNpm,
              results[0].resolvedViaNpm,
              `Run ${i}: resolvedViaNpm should be consistent`
            );
            assert.strictEqual(
              results[i].removed,
              results[0].removed,
              `Run ${i}: removed should be consistent`
            );

            // Check individual result consistency
            assert.strictEqual(
              results[i].results.length,
              results[0].results.length,
              `Run ${i}: results length should be consistent`
            );

            if (results[i].results.length > 0) {
              const result0 = results[0].results[0];
              const resultI = results[i].results[0];

              assert.strictEqual(
                resultI.packageName,
                result0.packageName,
                `Run ${i}: packageName should be consistent`
              );
              assert.strictEqual(
                resultI.isUrlDead,
                result0.isUrlDead,
                `Run ${i}: isUrlDead should be consistent`
              );
              assert.strictEqual(
                resultI.action,
                result0.action,
                `Run ${i}: action should be consistent`
              );
              assert.strictEqual(
                resultI.npmAlternative,
                result0.npmAlternative,
                `Run ${i}: npmAlternative should be consistent`
              );
            }
          }

          // Verify the validator was called consistently
          const callCount = mockValidator.getCallCount(url);
          assert.strictEqual(
            callCount,
            numRuns,
            'URL validator should be called once per run'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Consistency across different URL formats for same package
   * 
   * Different URL formats pointing to the same package should be handled
   * consistently (both detected as dead or both as accessible).
   */
  test('Property: Consistency across URL formats', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
          repo: packageNameArbitrary,
          version: versionArbitrary,
          hash: fc.stringMatching(/^[a-z0-9]{7,40}$/),
          isAccessible: fc.boolean(),
          hasNpmAlternative: fc.boolean(),
          npmVersion: versionArbitrary
        }),
        async ({ user, repo, version, hash, isAccessible, hasNpmAlternative, npmVersion }) => {
          // Generate different URL formats for the same package
          const archiveUrl = `https://github.com/${user}/${repo}/archive/${version}.tar.gz`;
          const tarballUrl = `https://github.com/${user}/${repo}/tarball/${version}`;
          const gitProtocolUrl = `github:${user}/${repo}#${hash}`;

          const mockValidator = new ConsistentMockURLValidator();
          const mockLockfileParser = new MockLockfileParser();
          const mockRegistry = new MockPackageReplacementRegistry();

          // Set up mock validation results (all should have same accessibility)
          for (const url of [archiveUrl, tarballUrl, gitProtocolUrl]) {
            mockValidator.setValidationResult(url, {
              url,
              isValid: isAccessible,
              statusCode: isAccessible ? 200 : 404
            });
          }

          // Set up npm alternative
          if (hasNpmAlternative) {
            mockValidator.setNpmAlternative(repo, npmVersion);
          } else {
            mockValidator.setNpmAlternative(repo, null);
          }

          // Test each URL format
          const results: any[] = [];
          for (const url of [archiveUrl, tarballUrl, gitProtocolUrl]) {
            const handler = new DeadUrlHandler(mockValidator, mockLockfileParser, mockRegistry);
            const dependencies = new Map([[repo, url]]);
            const summary = await handler.handleDeadUrls(tempDir, dependencies);
            results.push(summary);
          }

          // Property: All URL formats should produce consistent detection results
          for (let i = 1; i < results.length; i++) {
            assert.strictEqual(
              results[i].deadUrlsFound,
              results[0].deadUrlsFound,
              `URL format ${i}: deadUrlsFound should be consistent across formats`
            );
            assert.strictEqual(
              results[i].resolvedViaNpm,
              results[0].resolvedViaNpm,
              `URL format ${i}: resolvedViaNpm should be consistent across formats`
            );
            assert.strictEqual(
              results[i].removed,
              results[0].removed,
              `URL format ${i}: removed should be consistent across formats`
            );

            if (results[i].results.length > 0 && results[0].results.length > 0) {
              assert.strictEqual(
                results[i].results[0].isUrlDead,
                results[0].results[0].isUrlDead,
                `URL format ${i}: isUrlDead should be consistent across formats`
              );
              assert.strictEqual(
                results[i].results[0].action,
                results[0].results[0].action,
                `URL format ${i}: action should be consistent across formats`
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Consistency with multiple dependencies
   * 
   * When checking multiple dependencies, each should be detected consistently
   * regardless of the order or presence of other dependencies.
   */
  test('Property: Consistency with multiple dependencies', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            packageName: packageNameArbitrary,
            url: urlBasedDependencyArbitrary,
            isAccessible: fc.boolean(),
            hasNpmAlternative: fc.boolean(),
            npmVersion: versionArbitrary
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (dependencyConfigs) => {
          // Remove duplicates by package name
          const uniqueConfigs = new Map<string, typeof dependencyConfigs[0]>();
          for (const config of dependencyConfigs) {
            uniqueConfigs.set(config.packageName, config);
          }
          const configs = Array.from(uniqueConfigs.values());

          if (configs.length < 2) {
            // Skip if we don't have at least 2 unique packages
            return;
          }

          const mockValidator = new ConsistentMockURLValidator();
          const mockLockfileParser = new MockLockfileParser();
          const mockRegistry = new MockPackageReplacementRegistry();

          // Set up mock validation results
          for (const config of configs) {
            mockValidator.setValidationResult(config.url, {
              url: config.url,
              isValid: config.isAccessible,
              statusCode: config.isAccessible ? 200 : 404
            });

            if (config.hasNpmAlternative) {
              mockValidator.setNpmAlternative(config.packageName, config.npmVersion);
            } else {
              mockValidator.setNpmAlternative(config.packageName, null);
            }
          }

          // Test 1: Check all dependencies together
          const allDependencies = new Map(configs.map(c => [c.packageName, c.url]));
          const handler1 = new DeadUrlHandler(mockValidator, mockLockfileParser, mockRegistry);
          const summaryAll = await handler1.handleDeadUrls(tempDir, allDependencies);

          // Test 2: Check each dependency individually
          const individualResults = new Map<string, any>();
          for (const config of configs) {
            const handler = new DeadUrlHandler(mockValidator, mockLockfileParser, mockRegistry);
            const dependencies = new Map([[config.packageName, config.url]]);
            const summary = await handler.handleDeadUrls(tempDir, dependencies);
            individualResults.set(config.packageName, summary.results[0]);
          }

          // Property: Each dependency should be detected the same way individually
          // as when checked together with others
          for (const config of configs) {
            const resultFromAll = summaryAll.results.find(r => r.packageName === config.packageName);
            const resultIndividual = individualResults.get(config.packageName);

            assert.ok(resultFromAll, `Result should exist for ${config.packageName} in batch check`);
            assert.ok(resultIndividual, `Result should exist for ${config.packageName} in individual check`);

            assert.strictEqual(
              resultFromAll.isUrlDead,
              resultIndividual.isUrlDead,
              `${config.packageName}: isUrlDead should be consistent between batch and individual checks`
            );
            assert.strictEqual(
              resultFromAll.action,
              resultIndividual.action,
              `${config.packageName}: action should be consistent between batch and individual checks`
            );
            assert.strictEqual(
              resultFromAll.npmAlternative,
              resultIndividual.npmAlternative,
              `${config.packageName}: npmAlternative should be consistent between batch and individual checks`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Idempotency - Running detection twice produces same results
   * 
   * Running dead URL detection twice on the same dependencies should produce
   * identical results (idempotent operation).
   */
  test('Property: Idempotency of dead URL detection', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            packageName: packageNameArbitrary,
            url: urlBasedDependencyArbitrary,
            isAccessible: fc.boolean(),
            hasNpmAlternative: fc.boolean(),
            npmVersion: versionArbitrary
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (dependencyConfigs) => {
          // Remove duplicates
          const uniqueConfigs = new Map<string, typeof dependencyConfigs[0]>();
          for (const config of dependencyConfigs) {
            uniqueConfigs.set(config.packageName, config);
          }
          const configs = Array.from(uniqueConfigs.values());

          const mockValidator = new ConsistentMockURLValidator();
          const mockLockfileParser = new MockLockfileParser();
          const mockRegistry = new MockPackageReplacementRegistry();

          // Set up mock validation results
          for (const config of configs) {
            mockValidator.setValidationResult(config.url, {
              url: config.url,
              isValid: config.isAccessible,
              statusCode: config.isAccessible ? 200 : 404
            });

            if (config.hasNpmAlternative) {
              mockValidator.setNpmAlternative(config.packageName, config.npmVersion);
            } else {
              mockValidator.setNpmAlternative(config.packageName, null);
            }
          }

          const dependencies = new Map(configs.map(c => [c.packageName, c.url]));

          // Run detection twice
          const handler1 = new DeadUrlHandler(mockValidator, mockLockfileParser, mockRegistry);
          const summary1 = await handler1.handleDeadUrls(tempDir, dependencies);

          const handler2 = new DeadUrlHandler(mockValidator, mockLockfileParser, mockRegistry);
          const summary2 = await handler2.handleDeadUrls(tempDir, dependencies);

          // Property: Both runs should produce identical results (idempotency)
          assert.strictEqual(
            summary2.totalChecked,
            summary1.totalChecked,
            'totalChecked should be identical on second run'
          );
          assert.strictEqual(
            summary2.deadUrlsFound,
            summary1.deadUrlsFound,
            'deadUrlsFound should be identical on second run'
          );
          assert.strictEqual(
            summary2.resolvedViaNpm,
            summary1.resolvedViaNpm,
            'resolvedViaNpm should be identical on second run'
          );
          assert.strictEqual(
            summary2.removed,
            summary1.removed,
            'removed should be identical on second run'
          );
          assert.strictEqual(
            summary2.results.length,
            summary1.results.length,
            'results length should be identical on second run'
          );

          // Check each result
          for (let i = 0; i < summary1.results.length; i++) {
            const result1 = summary1.results[i];
            const result2 = summary2.results.find(r => r.packageName === result1.packageName);

            assert.ok(result2, `Result should exist for ${result1.packageName} in second run`);
            assert.strictEqual(
              result2.isUrlDead,
              result1.isUrlDead,
              `${result1.packageName}: isUrlDead should be identical on second run`
            );
            assert.strictEqual(
              result2.action,
              result1.action,
              `${result1.packageName}: action should be identical on second run`
            );
            assert.strictEqual(
              result2.npmAlternative,
              result1.npmAlternative,
              `${result1.packageName}: npmAlternative should be identical on second run`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
