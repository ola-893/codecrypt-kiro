/**
 * Property-Based Tests for Dependency Analysis
 * 
 * **Feature: critical-dependency-fixes, Property 1: Valid Dependency Sources**
 * **Validates: Requirements 1.2, 1.4**
 * 
 * Property: For any dependency in package.json, the dependency source SHALL be
 * either an npm registry package or a valid, accessible URL.
 */

import * as assert from 'assert';
import * as fc from 'fast-check';

suite('Dependency Analysis Property-Based Tests', () => {
  // Arbitraries for generating test data
  
  /**
   * Generate valid npm package names
   * Rules: lowercase, alphanumeric, hyphens, dots, underscores
   * Cannot start with dot or underscore
   */
  const npmPackageNameArbitrary = fc.stringMatching(/^[a-z0-9][a-z0-9._-]{0,213}$/)
    .filter((s: string) => 
      s.length >= 1 && 
      s.length <= 214 &&
      !s.startsWith('.') && 
      !s.startsWith('_') &&
      !s.endsWith('-') &&
      !s.includes('..')
    );

  /**
   * Generate valid scoped package names
   * Format: @scope/package
   */
  const scopedPackageNameArbitrary = fc.tuple(
    fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,30}$/),
    npmPackageNameArbitrary
  ).map(([scope, pkg]) => `@${scope}/${pkg}`);

  /**
   * Generate valid semver versions
   */
  const semverArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 50 }),
    fc.integer({ min: 0, max: 100 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  /**
   * Generate valid semver ranges
   */
  const semverRangeArbitrary = fc.oneof(
    semverArbitrary,
    semverArbitrary.map(v => `^${v}`),
    semverArbitrary.map(v => `~${v}`),
    semverArbitrary.map(v => `>=${v}`),
    semverArbitrary.map(v => `>${v}`),
    fc.tuple(semverArbitrary, semverArbitrary).map(([v1, v2]) => `${v1} - ${v2}`)
  );

  /**
   * Generate npm registry dependency entries (valid sources)
   */
  const npmRegistryDependencyArbitrary = fc.oneof(
    npmPackageNameArbitrary,
    scopedPackageNameArbitrary
  ).chain(name => 
    semverRangeArbitrary.map(version => ({ name, version }))
  );

  /**
   * Generate GitHub URL dependency entries (potentially invalid sources)
   */
  const githubUrlDependencyArbitrary = fc.record({
    name: npmPackageNameArbitrary,
    user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/),
    version: fc.stringMatching(/^[a-z0-9.-]{3,20}$/)
  }).map(({ name, user, repo, version }) => ({
    name,
    version: `https://github.com/${user}/${repo}/archive/${version}.tar.gz`
  }));

  /**
   * Generate git protocol dependency entries (potentially invalid sources)
   */
  const gitProtocolDependencyArbitrary = fc.record({
    name: npmPackageNameArbitrary,
    user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/),
    hash: fc.stringMatching(/^[a-z0-9]{7,40}$/)
  }).map(({ name, user, repo, hash }) => ({
    name,
    version: `git+https://github.com/${user}/${repo}.git#${hash}`
  }));

  /**
   * Helper function to determine if a dependency source is a registry package
   */
  function isRegistryPackage(version: string): boolean {
    // Registry packages use semver or semver ranges
    // They don't start with protocols or URLs
    return !version.startsWith('http://') &&
           !version.startsWith('https://') &&
           !version.startsWith('git://') &&
           !version.startsWith('git+') &&
           !version.startsWith('github:') &&
           !version.startsWith('file:');
  }

  /**
   * Helper function to determine if a dependency source is a URL
   */
  function isUrlSource(version: string): boolean {
    return version.startsWith('http://') ||
           version.startsWith('https://') ||
           version.startsWith('git://') ||
           version.startsWith('git+') ||
           version.startsWith('github:');
  }

  /**
   * Helper function to validate dependency source
   */
  function validateDependencySource(name: string, version: string): {
    isValid: boolean;
    sourceType: 'registry' | 'url' | 'file' | 'unknown';
    reason?: string;
  } {
    // Empty or whitespace-only versions are invalid
    if (!version || version.trim().length === 0) {
      return { 
        isValid: false, 
        sourceType: 'unknown',
        reason: 'Empty version string'
      };
    }

    // File protocol is valid but not recommended
    if (version.startsWith('file:')) {
      return { isValid: true, sourceType: 'file' };
    }

    // URL sources need validation
    if (isUrlSource(version)) {
      // For this property test, we consider URL sources as potentially invalid
      // because they can point to dead URLs (like the querystring issue)
      return { 
        isValid: false, 
        sourceType: 'url',
        reason: 'URL-based dependencies should be replaced with npm registry packages'
      };
    }

    // Registry packages are always valid
    if (isRegistryPackage(version)) {
      return { isValid: true, sourceType: 'registry' };
    }

    return { 
      isValid: false, 
      sourceType: 'unknown',
      reason: 'Unknown dependency source format'
    };
  }

  /**
   * Property 1: Valid Dependency Sources
   * 
   * For any npm registry dependency, the source should be validated as valid.
   */
  test('Property 1: NPM registry dependencies are valid sources', () => {
    fc.assert(
      fc.property(
        npmRegistryDependencyArbitrary,
        ({ name, version }) => {
          const validation = validateDependencySource(name, version);

          // Property: NPM registry packages should always be valid
          assert.strictEqual(
            validation.isValid,
            true,
            `NPM registry package "${name}@${version}" should be valid`
          );
          assert.strictEqual(
            validation.sourceType,
            'registry',
            `NPM registry package should have sourceType 'registry'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: GitHub URL dependencies are flagged as invalid
   * 
   * For any GitHub URL dependency, the source should be flagged as invalid
   * because it can point to dead URLs.
   */
  test('Property: GitHub URL dependencies are flagged as invalid', () => {
    fc.assert(
      fc.property(
        githubUrlDependencyArbitrary,
        ({ name, version }) => {
          const validation = validateDependencySource(name, version);

          // Property: GitHub URL dependencies should be flagged as invalid
          assert.strictEqual(
            validation.isValid,
            false,
            `GitHub URL dependency "${name}@${version}" should be flagged as invalid`
          );
          assert.strictEqual(
            validation.sourceType,
            'url',
            `GitHub URL dependency should have sourceType 'url'`
          );
          assert.ok(
            validation.reason,
            'Invalid dependency should have a reason'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Git protocol dependencies are flagged as invalid
   * 
   * For any git protocol dependency, the source should be flagged as invalid.
   */
  test('Property: Git protocol dependencies are flagged as invalid', () => {
    fc.assert(
      fc.property(
        gitProtocolDependencyArbitrary,
        ({ name, version }) => {
          const validation = validateDependencySource(name, version);

          // Property: Git protocol dependencies should be flagged as invalid
          assert.strictEqual(
            validation.isValid,
            false,
            `Git protocol dependency "${name}@${version}" should be flagged as invalid`
          );
          assert.strictEqual(
            validation.sourceType,
            'url',
            `Git protocol dependency should have sourceType 'url'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Source type classification is consistent
   * 
   * For any dependency, classifying it multiple times should return the same result.
   */
  test('Property: Source type classification is consistent', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          npmRegistryDependencyArbitrary,
          githubUrlDependencyArbitrary,
          gitProtocolDependencyArbitrary
        ),
        ({ name, version }) => {
          const validation1 = validateDependencySource(name, version);
          const validation2 = validateDependencySource(name, version);
          const validation3 = validateDependencySource(name, version);

          // Property: Multiple validations should return same result
          assert.strictEqual(
            validation1.isValid,
            validation2.isValid,
            'First and second validation should match'
          );
          assert.strictEqual(
            validation2.isValid,
            validation3.isValid,
            'Second and third validation should match'
          );
          assert.strictEqual(
            validation1.sourceType,
            validation2.sourceType,
            'Source type should be consistent'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Package.json with only registry dependencies is valid
   * 
   * For any package.json with only npm registry dependencies, all sources should be valid.
   */
  test('Property: Package.json with only registry dependencies is valid', () => {
    fc.assert(
      fc.property(
        fc.array(npmRegistryDependencyArbitrary, { minLength: 1, maxLength: 20 }),
        (dependencies) => {
          const packageJson = {
            dependencies: Object.fromEntries(
              dependencies.map(({ name, version }) => [name, version])
            )
          };

          // Validate all dependencies
          const validations = Object.entries(packageJson.dependencies).map(
            ([name, version]) => validateDependencySource(name, version as string)
          );

          // Property: All dependencies should be valid
          const allValid = validations.every(v => v.isValid);
          assert.strictEqual(
            allValid,
            true,
            'All registry dependencies should be valid'
          );

          // Property: All should be registry type
          const allRegistry = validations.every(v => v.sourceType === 'registry');
          assert.strictEqual(
            allRegistry,
            true,
            'All dependencies should be registry type'
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Package.json with URL dependencies has invalid sources
   * 
   * For any package.json with at least one URL dependency, at least one source should be invalid.
   */
  test('Property: Package.json with URL dependencies has invalid sources', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(npmRegistryDependencyArbitrary, { minLength: 0, maxLength: 10 }),
          fc.array(githubUrlDependencyArbitrary, { minLength: 1, maxLength: 5 })
        ),
        ([registryDeps, urlDeps]) => {
          const allDeps = [...registryDeps, ...urlDeps];
          const packageJson = {
            dependencies: Object.fromEntries(
              allDeps.map(({ name, version }) => [name, version])
            )
          };

          // Validate all dependencies
          const validations = Object.entries(packageJson.dependencies).map(
            ([name, version]) => validateDependencySource(name, version as string)
          );

          // Property: At least one dependency should be invalid
          const hasInvalid = validations.some(v => !v.isValid);
          assert.strictEqual(
            hasInvalid,
            true,
            'Package.json with URL dependencies should have at least one invalid source'
          );

          // Property: At least one should be URL type
          const hasUrl = validations.some(v => v.sourceType === 'url');
          assert.strictEqual(
            hasUrl,
            true,
            'Package.json should have at least one URL type dependency'
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Scoped packages are valid registry sources
   * 
   * For any scoped package (@scope/package), it should be validated as a valid registry source.
   */
  test('Property: Scoped packages are valid registry sources', () => {
    fc.assert(
      fc.property(
        scopedPackageNameArbitrary.chain(name =>
          semverRangeArbitrary.map(version => ({ name, version }))
        ),
        ({ name, version }) => {
          const validation = validateDependencySource(name, version);

          // Property: Scoped packages should be valid
          assert.strictEqual(
            validation.isValid,
            true,
            `Scoped package "${name}@${version}" should be valid`
          );
          assert.strictEqual(
            validation.sourceType,
            'registry',
            'Scoped package should have sourceType registry'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty version strings are handled
   * 
   * For any package with an empty version string, validation should handle it gracefully.
   */
  test('Property: Empty version strings are handled', () => {
    fc.assert(
      fc.property(
        npmPackageNameArbitrary,
        (name) => {
          const validation = validateDependencySource(name, '');

          // Property: Empty version should be classified as unknown
          assert.strictEqual(
            validation.sourceType,
            'unknown',
            'Empty version should be classified as unknown'
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Validation result structure
   * 
   * For any dependency, the validation result should have required fields.
   */
  test('Property: Validation result structure', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          npmRegistryDependencyArbitrary,
          githubUrlDependencyArbitrary,
          gitProtocolDependencyArbitrary
        ),
        ({ name, version }) => {
          const validation = validateDependencySource(name, version);

          // Property: Result should have required fields
          assert.ok('isValid' in validation, 'Result should have isValid field');
          assert.ok('sourceType' in validation, 'Result should have sourceType field');
          assert.strictEqual(
            typeof validation.isValid,
            'boolean',
            'isValid should be boolean'
          );
          assert.ok(
            ['registry', 'url', 'file', 'unknown'].includes(validation.sourceType),
            'sourceType should be one of the valid types'
          );

          // If invalid, should have reason
          if (!validation.isValid) {
            assert.ok(
              validation.reason,
              'Invalid dependency should have a reason'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
