/**
 * Property-Based Tests for DeadUrlHandler
 * 
 * **Feature: demo-critical-fixes, Property 2: Dead URL Detection Accuracy**
 * **Validates: Requirements 2.1**
 * 
 * Property: For any URL-based dependency, if the URL returns a 404 or is inaccessible,
 * the dead URL detector should correctly identify it as a dead URL.
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as fc from 'fast-check';
import { DeadUrlHandler } from '../services/deadUrlHandler';
import { URLValidator } from '../services/urlValidator';
import { URLValidationResult } from '../types';

// Mock URLValidator for property testing
class MockURLValidator extends URLValidator {
  private mockValidations: Map<string, URLValidationResult>;
  private mockNpmAlternatives: Map<string, string | null>;

  constructor() {
    super();
    this.mockValidations = new Map();
    this.mockNpmAlternatives = new Map();
  }

  setMockValidation(url: string, result: URLValidationResult): void {
    this.mockValidations.set(url, result);
  }

  setMockNpmAlternative(packageName: string, version: string | null): void {
    this.mockNpmAlternatives.set(packageName, version);
  }

  async validate(url: string): Promise<URLValidationResult> {
    const mock = this.mockValidations.get(url);
    if (mock) {
      return mock;
    }
    // Default to invalid
    return { url, isValid: false };
  }

  async findNpmAlternative(packageName: string): Promise<string | null> {
    if (this.mockNpmAlternatives.has(packageName)) {
      return this.mockNpmAlternatives.get(packageName) || null;
    }
    return null;
  }

  extractPackageFromUrl(url: string): string | null {
    return super.extractPackageFromUrl(url);
  }
}

suite('DeadUrlHandler Property-Based Tests', () => {
  let tempDir: string;

  setup(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dead-url-prop-test-'));
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

  const urlBasedDependencyArbitrary = fc.oneof(
    githubUrlArbitrary,
    fc.tuple(
      fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
      packageNameArbitrary,
      fc.stringMatching(/^[a-z0-9]{7,40}$/)
    ).map(([user, repo, hash]) => `github:${user}/${repo}#${hash}`)
  );

  /**
   * Property 2: Dead URL Detection Accuracy
   * 
   * For any URL-based dependency, if the URL is marked as inaccessible (404 or other error),
   * the dead URL detector should correctly identify it as a dead URL.
   */
  test('Property 2: Dead URL Detection Accuracy', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          packageName: packageNameArbitrary,
          url: urlBasedDependencyArbitrary,
          isAccessible: fc.boolean(),
          hasNpmAlternative: fc.boolean(),
          npmVersion: versionArbitrary
        }),
        async ({ packageName, url, isAccessible, hasNpmAlternative, npmVersion }) => {
          const mockValidator = new MockURLValidator();
          const handler = new DeadUrlHandler(mockValidator);

          // Set up mock validation
          mockValidator.setMockValidation(url, {
            url,
            isValid: isAccessible,
            statusCode: isAccessible ? 200 : 404
          });

          // Set up npm alternative if applicable
          if (hasNpmAlternative) {
            mockValidator.setMockNpmAlternative(packageName, npmVersion);
          } else {
            mockValidator.setMockNpmAlternative(packageName, null);
          }

          const dependencies = new Map([[packageName, url]]);
          const summary = await handler.handleDeadUrls(tempDir, dependencies);

          // Property: Dead URL detection accuracy
          // If URL is inaccessible, it should be detected as dead
          if (!isAccessible) {
            assert.strictEqual(
              summary.deadUrlsFound,
              1,
              `Dead URL should be detected for inaccessible URL: ${url}`
            );

            // Find the result for this package
            const result = summary.results.find(r => r.packageName === packageName);
            assert.ok(result, 'Result should exist for the package');
            assert.strictEqual(result.isUrlDead, true, 'URL should be marked as dead');

            // If npm alternative exists, should be resolved
            if (hasNpmAlternative) {
              assert.strictEqual(
                summary.resolvedViaNpm,
                1,
                'Should resolve via npm when alternative exists'
              );
              assert.strictEqual(result.action, 'replaced', 'Action should be replaced');
              assert.strictEqual(result.npmAlternative, npmVersion, 'Should have npm alternative');
            } else {
              // No npm alternative, should be removed
              assert.strictEqual(
                summary.removed,
                1,
                'Should remove when no npm alternative exists'
              );
              assert.strictEqual(result.action, 'removed', 'Action should be removed');
            }
          } else {
            // URL is accessible, should not be detected as dead
            assert.strictEqual(
              summary.deadUrlsFound,
              0,
              `Accessible URL should not be detected as dead: ${url}`
            );

            const result = summary.results.find(r => r.packageName === packageName);
            assert.ok(result, 'Result should exist for the package');
            assert.strictEqual(result.isUrlDead, false, 'URL should not be marked as dead');
            assert.strictEqual(result.action, 'kept', 'Action should be kept');
          }

          // Invariant: totalChecked should always be 1 (we only checked one dependency)
          assert.strictEqual(summary.totalChecked, 1, 'Should check exactly 1 dependency');

          // Invariant: deadUrlsFound + accessible URLs = totalChecked
          const accessibleCount = summary.results.filter(r => !r.isUrlDead).length;
          assert.strictEqual(
            summary.deadUrlsFound + accessibleCount,
            summary.totalChecked,
            'Dead URLs + accessible URLs should equal total checked'
          );

          // Invariant: resolvedViaNpm + removed = deadUrlsFound
          assert.strictEqual(
            summary.resolvedViaNpm + summary.removed,
            summary.deadUrlsFound,
            'Resolved + removed should equal dead URLs found'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple dependencies handling consistency
   * 
   * For any collection of URL-based dependencies, the handler should correctly
   * categorize each one independently.
   */
  test('Property: Multiple dependencies handling consistency', () => {
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
          { minLength: 0, maxLength: 10 }
        ),
        async (dependencyConfigs) => {
          const mockValidator = new MockURLValidator();
          const handler = new DeadUrlHandler(mockValidator);

          const dependencies = new Map<string, string>();
          let expectedDeadCount = 0;
          let expectedResolvedCount = 0;
          let expectedRemovedCount = 0;

          // Filter out duplicate package names (Map will only keep last one)
          const uniqueConfigs = new Map<string, typeof dependencyConfigs[0]>();
          for (const config of dependencyConfigs) {
            uniqueConfigs.set(config.packageName, config);
          }
          const uniqueDependencyConfigs = Array.from(uniqueConfigs.values());

          // Set up mocks and calculate expected counts
          for (const config of uniqueDependencyConfigs) {
            dependencies.set(config.packageName, config.url);

            mockValidator.setMockValidation(config.url, {
              url: config.url,
              isValid: config.isAccessible,
              statusCode: config.isAccessible ? 200 : 404
            });

            if (config.hasNpmAlternative) {
              mockValidator.setMockNpmAlternative(config.packageName, config.npmVersion);
            } else {
              mockValidator.setMockNpmAlternative(config.packageName, null);
            }

            if (!config.isAccessible) {
              expectedDeadCount++;
              if (config.hasNpmAlternative) {
                expectedResolvedCount++;
              } else {
                expectedRemovedCount++;
              }
            }
          }

          const summary = await handler.handleDeadUrls(tempDir, dependencies);

          // Property: Counts should match expectations
          assert.strictEqual(
            summary.totalChecked,
            uniqueDependencyConfigs.length,
            'Should check all unique dependencies'
          );
          assert.strictEqual(
            summary.deadUrlsFound,
            expectedDeadCount,
            'Dead URL count should match expected'
          );
          assert.strictEqual(
            summary.resolvedViaNpm,
            expectedResolvedCount,
            'Resolved count should match expected'
          );
          assert.strictEqual(
            summary.removed,
            expectedRemovedCount,
            'Removed count should match expected'
          );

          // Invariant: results length should equal totalChecked
          assert.strictEqual(
            summary.results.length,
            summary.totalChecked,
            'Results length should equal total checked'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-URL dependencies are ignored
   * 
   * For any collection of dependencies, only URL-based ones should be checked.
   */
  test('Property: Non-URL dependencies are ignored', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            packageName: packageNameArbitrary,
            version: fc.oneof(
              versionArbitrary.map(v => `^${v}`),
              versionArbitrary.map(v => `~${v}`),
              versionArbitrary
            )
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (dependencyConfigs) => {
          const mockValidator = new MockURLValidator();
          const handler = new DeadUrlHandler(mockValidator);

          const dependencies = new Map<string, string>();
          for (const config of dependencyConfigs) {
            dependencies.set(config.packageName, config.version);
          }

          const summary = await handler.handleDeadUrls(tempDir, dependencies);

          // Property: Non-URL dependencies should not be checked
          assert.strictEqual(
            summary.totalChecked,
            0,
            'Should not check non-URL dependencies'
          );
          assert.strictEqual(
            summary.deadUrlsFound,
            0,
            'Should find no dead URLs in non-URL dependencies'
          );
          assert.strictEqual(
            summary.results.length,
            0,
            'Should have no results for non-URL dependencies'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
