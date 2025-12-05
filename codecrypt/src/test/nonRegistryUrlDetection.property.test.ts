/**
 * Property-Based Tests for Non-Registry URL Detection
 * 
 * **Feature: critical-dependency-fixes, Property 2: Non-Registry URL Detection**
 * **Validates: Requirements 5.3**
 * 
 * Property: For any package.json file, parsing SHALL identify all dependencies
 * using non-registry URLs (GitHub, tarball, git, etc.)
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import {
  isNonRegistryUrl,
  getNonRegistrySourceType,
  detectNonRegistryDependencies,
  NonRegistryDependency
} from '../services/dependencyAnalysis';

suite('Non-Registry URL Detection Property-Based Tests', () => {
  // Arbitraries for generating test data
  
  /**
   * Generate valid npm package names
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
   * Generate valid semver versions (registry packages)
   */
  const semverArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 50 }),
    fc.integer({ min: 0, max: 100 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  /**
   * Generate valid semver ranges (registry packages)
   */
  const semverRangeArbitrary = fc.oneof(
    semverArbitrary,
    semverArbitrary.map(v => `^${v}`),
    semverArbitrary.map(v => `~${v}`),
    semverArbitrary.map(v => `>=${v}`),
    semverArbitrary.map(v => `>${v}`)
  );

  /**
   * Generate HTTP URL dependencies
   */
  const httpUrlArbitrary = fc.record({
    domain: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}\.[a-z]{2,5}$/),
    path: fc.stringMatching(/^[a-z0-9/-]{5,50}$/),
    file: fc.stringMatching(/^[a-z0-9.-]{3,20}\.tar\.gz$/)
  }).map(({ domain, path, file }) => `http://${domain}/${path}/${file}`);

  /**
   * Generate HTTPS URL dependencies
   */
  const httpsUrlArbitrary = fc.record({
    domain: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}\.[a-z]{2,5}$/),
    path: fc.stringMatching(/^[a-z0-9/-]{5,50}$/),
    file: fc.stringMatching(/^[a-z0-9.-]{3,20}\.tar\.gz$/)
  }).map(({ domain, path, file }) => `https://${domain}/${path}/${file}`);

  /**
   * Generate GitHub tarball URL dependencies
   */
  const githubTarballArbitrary = fc.record({
    user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/),
    version: fc.stringMatching(/^[a-z0-9.-]{3,20}$/)
  }).map(({ user, repo, version }) => 
    `https://github.com/${user}/${repo}/archive/${version}.tar.gz`
  );

  /**
   * Generate git:// protocol dependencies
   */
  const gitProtocolArbitrary = fc.record({
    domain: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}\.[a-z]{2,5}$/),
    user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/),
    hash: fc.stringMatching(/^[a-z0-9]{7,40}$/)
  }).map(({ domain, user, repo, hash }) => 
    `git://${domain}/${user}/${repo}.git#${hash}`
  );

  /**
   * Generate git+https:// protocol dependencies
   */
  const gitHttpsArbitrary = fc.record({
    user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/),
    hash: fc.stringMatching(/^[a-z0-9]{7,40}$/)
  }).map(({ user, repo, hash }) => 
    `git+https://github.com/${user}/${repo}.git#${hash}`
  );

  /**
   * Generate git+http:// protocol dependencies
   */
  const gitHttpArbitrary = fc.record({
    domain: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}\.[a-z]{2,5}$/),
    user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/),
    hash: fc.stringMatching(/^[a-z0-9]{7,40}$/)
  }).map(({ domain, user, repo, hash }) => 
    `git+http://${domain}/${user}/${repo}.git#${hash}`
  );

  /**
   * Generate github: protocol dependencies
   */
  const githubProtocolArbitrary = fc.record({
    user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/),
    hash: fc.stringMatching(/^[a-z0-9]{7,40}$/)
  }).map(({ user, repo, hash }) => `github:${user}/${repo}#${hash}`);

  /**
   * Generate file: protocol dependencies
   */
  const fileProtocolArbitrary = fc.stringMatching(/^[a-z0-9/-]{5,50}$/)
    .map(path => `file:${path}`);

  /**
   * Generate any non-registry URL
   */
  const nonRegistryUrlArbitrary = fc.oneof(
    httpUrlArbitrary,
    httpsUrlArbitrary,
    githubTarballArbitrary,
    gitProtocolArbitrary,
    gitHttpsArbitrary,
    gitHttpArbitrary,
    githubProtocolArbitrary,
    fileProtocolArbitrary
  );

  /**
   * Property 2: Non-Registry URL Detection
   * 
   * For any registry package (semver), isNonRegistryUrl should return false
   */
  test('Property 2.1: Registry packages are not flagged as non-registry URLs', () => {
    fc.assert(
      fc.property(
        semverRangeArbitrary,
        (version) => {
          const result = isNonRegistryUrl(version);
          
          // Property: Registry packages should NOT be flagged as non-registry
          assert.strictEqual(
            result,
            false,
            `Registry package version "${version}" should not be flagged as non-registry URL`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All HTTP URLs are detected as non-registry
   */
  test('Property 2.2: HTTP URLs are detected as non-registry', () => {
    fc.assert(
      fc.property(
        httpUrlArbitrary,
        (url) => {
          const result = isNonRegistryUrl(url);
          
          // Property: HTTP URLs should be flagged as non-registry
          assert.strictEqual(
            result,
            true,
            `HTTP URL "${url}" should be flagged as non-registry`
          );
          
          // Property: Source type should be 'http'
          const sourceType = getNonRegistrySourceType(url);
          assert.strictEqual(
            sourceType,
            'http',
            `HTTP URL should have sourceType 'http'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All HTTPS URLs are detected as non-registry
   */
  test('Property 2.3: HTTPS URLs are detected as non-registry', () => {
    fc.assert(
      fc.property(
        httpsUrlArbitrary,
        (url) => {
          const result = isNonRegistryUrl(url);
          
          // Property: HTTPS URLs should be flagged as non-registry
          assert.strictEqual(
            result,
            true,
            `HTTPS URL "${url}" should be flagged as non-registry`
          );
          
          // Property: Source type should be 'https'
          const sourceType = getNonRegistrySourceType(url);
          assert.strictEqual(
            sourceType,
            'https',
            `HTTPS URL should have sourceType 'https'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: GitHub tarball URLs are detected as non-registry
   */
  test('Property 2.4: GitHub tarball URLs are detected as non-registry', () => {
    fc.assert(
      fc.property(
        githubTarballArbitrary,
        (url) => {
          const result = isNonRegistryUrl(url);
          
          // Property: GitHub URLs should be flagged as non-registry
          assert.strictEqual(
            result,
            true,
            `GitHub tarball URL "${url}" should be flagged as non-registry`
          );
          
          // Property: Source type should be 'https' (GitHub uses HTTPS)
          const sourceType = getNonRegistrySourceType(url);
          assert.strictEqual(
            sourceType,
            'https',
            `GitHub tarball URL should have sourceType 'https'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: git:// protocol URLs are detected as non-registry
   */
  test('Property 2.5: git:// protocol URLs are detected as non-registry', () => {
    fc.assert(
      fc.property(
        gitProtocolArbitrary,
        (url) => {
          const result = isNonRegistryUrl(url);
          
          // Property: git:// URLs should be flagged as non-registry
          assert.strictEqual(
            result,
            true,
            `git:// URL "${url}" should be flagged as non-registry`
          );
          
          // Property: Source type should be 'git'
          const sourceType = getNonRegistrySourceType(url);
          assert.strictEqual(
            sourceType,
            'git',
            `git:// URL should have sourceType 'git'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: git+https:// protocol URLs are detected as non-registry
   */
  test('Property 2.6: git+https:// protocol URLs are detected as non-registry', () => {
    fc.assert(
      fc.property(
        gitHttpsArbitrary,
        (url) => {
          const result = isNonRegistryUrl(url);
          
          // Property: git+https:// URLs should be flagged as non-registry
          assert.strictEqual(
            result,
            true,
            `git+https:// URL "${url}" should be flagged as non-registry`
          );
          
          // Property: Source type should be 'git+https'
          const sourceType = getNonRegistrySourceType(url);
          assert.strictEqual(
            sourceType,
            'git+https',
            `git+https:// URL should have sourceType 'git+https'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: git+http:// protocol URLs are detected as non-registry
   */
  test('Property 2.7: git+http:// protocol URLs are detected as non-registry', () => {
    fc.assert(
      fc.property(
        gitHttpArbitrary,
        (url) => {
          const result = isNonRegistryUrl(url);
          
          // Property: git+http:// URLs should be flagged as non-registry
          assert.strictEqual(
            result,
            true,
            `git+http:// URL "${url}" should be flagged as non-registry`
          );
          
          // Property: Source type should be 'git+http'
          const sourceType = getNonRegistrySourceType(url);
          assert.strictEqual(
            sourceType,
            'git+http',
            `git+http:// URL should have sourceType 'git+http'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: github: protocol URLs are detected as non-registry
   */
  test('Property 2.8: github: protocol URLs are detected as non-registry', () => {
    fc.assert(
      fc.property(
        githubProtocolArbitrary,
        (url) => {
          const result = isNonRegistryUrl(url);
          
          // Property: github: URLs should be flagged as non-registry
          assert.strictEqual(
            result,
            true,
            `github: URL "${url}" should be flagged as non-registry`
          );
          
          // Property: Source type should be 'github'
          const sourceType = getNonRegistrySourceType(url);
          assert.strictEqual(
            sourceType,
            'github',
            `github: URL should have sourceType 'github'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: file: protocol URLs are detected as non-registry
   */
  test('Property 2.9: file: protocol URLs are detected as non-registry', () => {
    fc.assert(
      fc.property(
        fileProtocolArbitrary,
        (url) => {
          const result = isNonRegistryUrl(url);
          
          // Property: file: URLs should be flagged as non-registry
          assert.strictEqual(
            result,
            true,
            `file: URL "${url}" should be flagged as non-registry`
          );
          
          // Property: Source type should be 'file'
          const sourceType = getNonRegistrySourceType(url);
          assert.strictEqual(
            sourceType,
            'file',
            `file: URL should have sourceType 'file'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectNonRegistryDependencies finds all non-registry URLs
   */
  test('Property 2.10: detectNonRegistryDependencies finds all non-registry URLs', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(
            fc.tuple(npmPackageNameArbitrary, semverRangeArbitrary),
            { minLength: 0, maxLength: 10 }
          ),
          fc.array(
            fc.tuple(npmPackageNameArbitrary, nonRegistryUrlArbitrary),
            { minLength: 1, maxLength: 5 }
          )
        ),
        ([registryDeps, nonRegistryDeps]) => {
          // Build package.json with mixed dependencies
          const packageJson = {
            dependencies: Object.fromEntries([
              ...registryDeps.map(([name, version]) => [name, version]),
              ...nonRegistryDeps.map(([name, version]) => [name, version])
            ])
          };

          const detected = detectNonRegistryDependencies(packageJson);

          // Property: Should detect exactly the number of non-registry deps
          assert.strictEqual(
            detected.length,
            nonRegistryDeps.length,
            `Should detect ${nonRegistryDeps.length} non-registry dependencies`
          );

          // Property: All detected deps should be in the non-registry list
          detected.forEach(dep => {
            const found = nonRegistryDeps.some(([name, version]) => 
              name === dep.name && version === dep.version
            );
            assert.ok(
              found,
              `Detected dependency ${dep.name} should be in non-registry list`
            );
          });

          // Property: All detected deps should have valid source types
          detected.forEach(dep => {
            assert.ok(
              ['http', 'https', 'git', 'git+http', 'git+https', 'github', 'file'].includes(dep.sourceType),
              `Source type ${dep.sourceType} should be valid`
            );
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: detectNonRegistryDependencies returns empty for registry-only packages
   */
  test('Property 2.11: detectNonRegistryDependencies returns empty for registry-only packages', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(npmPackageNameArbitrary, semverRangeArbitrary),
          { minLength: 1, maxLength: 20 }
        ),
        (registryDeps) => {
          const packageJson = {
            dependencies: Object.fromEntries(
              registryDeps.map(([name, version]) => [name, version])
            )
          };

          const detected = detectNonRegistryDependencies(packageJson);

          // Property: Should detect zero non-registry dependencies
          assert.strictEqual(
            detected.length,
            0,
            'Registry-only package.json should have zero non-registry dependencies'
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: detectNonRegistryDependencies checks both dependencies and devDependencies
   */
  test('Property 2.12: detectNonRegistryDependencies checks both dependencies and devDependencies', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(
            fc.tuple(npmPackageNameArbitrary, nonRegistryUrlArbitrary),
            { minLength: 1, maxLength: 3 }
          ),
          fc.array(
            fc.tuple(npmPackageNameArbitrary, nonRegistryUrlArbitrary),
            { minLength: 1, maxLength: 3 }
          )
        ),
        ([deps, devDeps]) => {
          const packageJson = {
            dependencies: Object.fromEntries(
              deps.map(([name, version]) => [name, version])
            ),
            devDependencies: Object.fromEntries(
              devDeps.map(([name, version]) => [name, version])
            )
          };

          const detected = detectNonRegistryDependencies(packageJson);

          // Property: Should detect all non-registry deps from both sections
          assert.strictEqual(
            detected.length,
            deps.length + devDeps.length,
            'Should detect non-registry deps from both dependencies and devDependencies'
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Empty strings are not flagged as non-registry URLs
   */
  test('Property 2.13: Empty strings are not flagged as non-registry URLs', () => {
    const result = isNonRegistryUrl('');
    assert.strictEqual(
      result,
      false,
      'Empty string should not be flagged as non-registry URL'
    );
  });

  /**
   * Property: Detection is consistent across multiple calls
   */
  test('Property 2.14: Detection is consistent across multiple calls', () => {
    fc.assert(
      fc.property(
        fc.oneof(semverRangeArbitrary, nonRegistryUrlArbitrary),
        (version) => {
          const result1 = isNonRegistryUrl(version);
          const result2 = isNonRegistryUrl(version);
          const result3 = isNonRegistryUrl(version);

          // Property: Multiple calls should return same result
          assert.strictEqual(
            result1,
            result2,
            'First and second call should return same result'
          );
          assert.strictEqual(
            result2,
            result3,
            'Second and third call should return same result'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
