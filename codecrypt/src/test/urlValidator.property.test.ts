/**
 * Property-Based Tests for URLValidator
 * 
 * **Feature: demo-critical-fixes, Property 7: Alternative Source Resolution**
 * **Validates: Requirements 2.2**
 * 
 * Property: For any dead URL pointing to a GitHub tarball, if the package exists
 * in the npm registry, the alternative source resolver should return the npm registry version.
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import { URLValidator } from '../services/urlValidator';

suite('URLValidator Property-Based Tests', () => {
  // Arbitraries for generating test data
  const packageNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{1,30}$/)
    .filter((s: string) => s.length >= 2 && !s.endsWith('-') && !s.includes('--'));

  const versionArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 10 }),
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 50 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  const githubUserArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/);

  const githubArchiveUrlArbitrary = fc.tuple(
    githubUserArbitrary,
    packageNameArbitrary,
    versionArbitrary
  ).map(([user, repo, version]) => 
    `https://github.com/${user}/${repo}/archive/${version}.tar.gz`
  );

  const githubTarballUrlArbitrary = fc.tuple(
    githubUserArbitrary,
    packageNameArbitrary,
    versionArbitrary
  ).map(([user, repo, version]) => 
    `https://github.com/${user}/${repo}/tarball/${version}`
  );

  const githubProtocolUrlArbitrary = fc.tuple(
    githubUserArbitrary,
    packageNameArbitrary,
    fc.stringMatching(/^[a-z0-9]{7,40}$/)
  ).map(([user, repo, hash]) => 
    `github:${user}/${repo}#${hash}`
  );

  const githubUrlArbitrary = fc.oneof(
    githubArchiveUrlArbitrary,
    githubTarballUrlArbitrary,
    githubProtocolUrlArbitrary
  );

  /**
   * Property 7: Alternative Source Resolution
   * 
   * For any GitHub URL, the package name should be correctly extracted,
   * and if the package exists in npm, the version should be returned.
   */
  test('Property 7: Package name extraction from GitHub URLs', () => {
    fc.assert(
      fc.property(
        fc.record({
          user: githubUserArbitrary,
          repo: packageNameArbitrary,
          version: versionArbitrary,
          urlType: fc.constantFrom('archive', 'tarball', 'protocol')
        }),
        ({ user, repo, version, urlType }) => {
          const validator = new URLValidator();
          
          let url: string;
          if (urlType === 'archive') {
            url = `https://github.com/${user}/${repo}/archive/${version}.tar.gz`;
          } else if (urlType === 'tarball') {
            url = `https://github.com/${user}/${repo}/tarball/${version}`;
          } else {
            url = `github:${user}/${repo}#${version}`;
          }

          const extractedPackage = validator.extractPackageFromUrl(url);

          // Property: Package name should be extracted correctly
          assert.strictEqual(
            extractedPackage,
            repo,
            `Should extract package name "${repo}" from URL: ${url}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Package name extraction consistency
   * 
   * For any GitHub URL format, extracting the package name multiple times
   * should return the same result.
   */
  test('Property: Package name extraction consistency', () => {
    fc.assert(
      fc.property(
        githubUrlArbitrary,
        (url) => {
          const validator = new URLValidator();

          const extracted1 = validator.extractPackageFromUrl(url);
          const extracted2 = validator.extractPackageFromUrl(url);
          const extracted3 = validator.extractPackageFromUrl(url);

          // Property: Multiple extractions should return same result
          assert.strictEqual(
            extracted1,
            extracted2,
            'First and second extraction should match'
          );
          assert.strictEqual(
            extracted2,
            extracted3,
            'Second and third extraction should match'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-GitHub URLs return null
   * 
   * For any URL that is not a GitHub URL, package extraction should return null.
   */
  test('Property: Non-GitHub URLs return null', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.webUrl().filter(url => !url.includes('github')),
          fc.string().filter(s => !s.includes('github') && s.length > 0)
        ),
        (url) => {
          const validator = new URLValidator();

          const extracted = validator.extractPackageFromUrl(url);

          // Property: Non-GitHub URLs should return null
          assert.strictEqual(
            extracted,
            null,
            `Non-GitHub URL should return null: ${url}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: URL normalization idempotence
   * 
   * For any URL, normalizing it multiple times should produce the same result.
   */
  test('Property: URL normalization idempotence', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.webUrl(),
          fc.string().filter(s => s.length > 0 && !s.includes(' '))
        ),
        (url) => {
          const validator = new URLValidator();

          // Access private method through type assertion for testing
          const normalize = (validator as any).normalizeUrl.bind(validator);

          const normalized1 = normalize(url);
          const normalized2 = normalize(normalized1);
          const normalized3 = normalize(normalized2);

          // Property: Normalization should be idempotent
          assert.strictEqual(
            normalized1,
            normalized2,
            'First and second normalization should match'
          );
          assert.strictEqual(
            normalized2,
            normalized3,
            'Second and third normalization should match'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation result structure
   * 
   * For any URL, the validation result should always have the required fields.
   */
  test('Property: Validation result structure', () => {
    fc.assert(
      fc.asyncProperty(
        fc.oneof(
          githubUrlArbitrary,
          fc.webUrl()
        ),
        async (url) => {
          const validator = new URLValidator(1000); // Short timeout for testing

          const result = await validator.validate(url);

          // Property: Result should have required fields
          assert.ok('url' in result, 'Result should have url field');
          assert.ok('isValid' in result, 'Result should have isValid field');
          assert.strictEqual(typeof result.isValid, 'boolean', 'isValid should be boolean');
          assert.strictEqual(result.url, url, 'Result URL should match input URL');

          // If invalid, should have statusCode or error
          if (!result.isValid) {
            assert.ok(
              result.statusCode !== undefined || result.error !== undefined,
              'Invalid result should have statusCode or error'
            );
          }
        }
      ),
      { numRuns: 50 } // Fewer runs since this makes network requests
    );
  });

  /**
   * Property: Package name extraction handles edge cases
   * 
   * For any GitHub URL with .git suffix, the suffix should be removed.
   */
  test('Property: Package name extraction removes .git suffix', () => {
    fc.assert(
      fc.property(
        fc.record({
          user: githubUserArbitrary,
          repo: packageNameArbitrary,
          version: versionArbitrary
        }),
        ({ user, repo, version }) => {
          const validator = new URLValidator();

          // Test with .git suffix
          const urlWithGit = `https://github.com/${user}/${repo}.git/archive/${version}.tar.gz`;
          const extracted = validator.extractPackageFromUrl(urlWithGit);

          // Property: .git suffix should be removed
          assert.strictEqual(
            extracted,
            repo,
            `Should extract "${repo}" without .git suffix from: ${urlWithGit}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or malformed URLs return null
   * 
   * For any empty or clearly malformed URL, extraction should return null.
   */
  test('Property: Empty or malformed URLs return null', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('not-a-url'),
          fc.constant('://malformed'),
          fc.constant('github:'),
          fc.constant('github://')
        ),
        (url) => {
          const validator = new URLValidator();

          const extracted = validator.extractPackageFromUrl(url);

          // Property: Malformed URLs should return null
          assert.strictEqual(
            extracted,
            null,
            `Malformed URL should return null: "${url}"`
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Alternative source resolution for known packages
   * 
   * For well-known npm packages, findNpmAlternative should return a version.
   * This tests the integration with the npm registry.
   */
  test('Property: Alternative source resolution for known packages', async () => {
    const validator = new URLValidator(5000);

    // Test with a few well-known packages
    const knownPackages = ['lodash', 'express', 'react'];

    for (const packageName of knownPackages) {
      const version = await validator.findNpmAlternative(packageName);

      // Property: Known packages should have a version
      assert.ok(
        version !== null,
        `Known package "${packageName}" should have an npm alternative`
      );

      if (version) {
        // Property: Version should be a valid semver string
        assert.ok(
          /^\d+\.\d+\.\d+/.test(version),
          `Version should be valid semver: ${version}`
        );
      }
    }
  });

  /**
   * Property: Alternative source resolution for non-existent packages
   * 
   * For packages that definitely don't exist, findNpmAlternative should return null.
   */
  test('Property: Alternative source resolution for non-existent packages', () => {
    fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^nonexistent-package-[a-z0-9]{20,40}$/),
        async (packageName) => {
          const validator = new URLValidator(3000);

          const version = await validator.findNpmAlternative(packageName);

          // Property: Non-existent packages should return null
          assert.strictEqual(
            version,
            null,
            `Non-existent package "${packageName}" should return null`
          );
        }
      ),
      { numRuns: 10 } // Fewer runs since this makes network requests
    );
  });

  /**
   * Property: Scoped package name extraction
   * 
   * For scoped packages (@scope/package), the full scoped name should be extracted.
   */
  test('Property: Scoped package name extraction', () => {
    fc.assert(
      fc.property(
        fc.record({
          scope: fc.stringMatching(/^[a-z][a-z0-9-]{1,20}$/),
          package: packageNameArbitrary,
          version: versionArbitrary
        }),
        ({ scope, package: pkg, version }) => {
          const validator = new URLValidator();

          // GitHub doesn't use @ in URLs, but the repo name might be scoped
          const url = `https://github.com/${scope}/${pkg}/archive/${version}.tar.gz`;
          const extracted = validator.extractPackageFromUrl(url);

          // Property: Should extract the package name (not the scope)
          assert.strictEqual(
            extracted,
            pkg,
            `Should extract package name "${pkg}" from scoped URL: ${url}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
