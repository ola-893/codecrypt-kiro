/**
 * Property-Based Tests for Lockfile Parser
 * 
 * **Feature: demo-readiness-fixes, Property 1: Lockfile Parsing Completeness**
 * 
 * For any valid npm lockfile (package-lock.json, yarn.lock, or pnpm-lock.yaml),
 * parsing should extract all URL-based dependencies without missing any entries.
 * 
 * **Validates: Requirements 1.1**
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LockfileParser } from '../services/lockfileParser';

suite('Lockfile Parser Property-Based Tests', () => {
  let tempDir: string;
  let parser: LockfileParser;

  setup(async () => {
    // Create a temporary directory for test lockfiles
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockfile-test-'));
    parser = new LockfileParser();
  });

  teardown(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Arbitraries for generating test data

  /**
   * Generate valid package names
   */
  const packageNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{1,30}$/)
    .filter((s: string) => s.length >= 2 && !s.endsWith('-') && !s.includes('--'));

  /**
   * Generate valid scoped package names
   */
  const scopedPackageNameArbitrary = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9-]{1,20}$/),
    packageNameArbitrary
  ).map(([scope, pkg]) => `@${scope}/${pkg}`);

  /**
   * Generate any valid package name (scoped or unscoped)
   */
  const anyPackageNameArbitrary = fc.oneof(
    packageNameArbitrary,
    scopedPackageNameArbitrary
  );

  /**
   * Generate valid semver versions
   */
  const semverArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 50 }),
    fc.integer({ min: 0, max: 100 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  /**
   * Generate GitHub tarball URLs
   */
  const githubTarballUrlArbitrary = fc.record({
    user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/),
    version: semverArbitrary
  }).map(({ user, repo, version }) => 
    `https://github.com/${user}/${repo}/archive/${version}.tar.gz`
  );

  /**
   * Generate git protocol URLs
   */
  const gitUrlArbitrary = fc.record({
    user: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
    repo: fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/),
    hash: fc.stringMatching(/^[a-z0-9]{40}$/)
  }).map(({ user, repo, hash }) => 
    `git+https://github.com/${user}/${repo}.git#${hash}`
  );

  /**
   * Generate any URL-based dependency
   */
  const urlDependencyArbitrary = fc.oneof(
    githubTarballUrlArbitrary,
    gitUrlArbitrary
  );

  /**
   * Generate a URL-based dependency entry with package name
   */
  const urlDependencyEntryArbitrary = fc.record({
    name: anyPackageNameArbitrary,
    url: urlDependencyArbitrary
  });

  /**
   * Property 1: NPM lockfile parsing completeness
   * 
   * For any valid npm lockfile with URL-based dependencies,
   * all URL dependencies should be extracted.
   */
  test('Property 1: NPM lockfile parsing extracts all URL dependencies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(urlDependencyEntryArbitrary, { minLength: 1, maxLength: 10 }),
        async (dependencies) => {
          // Generate npm v7+ lockfile
          const lockfile = {
            name: 'test-project',
            version: '1.0.0',
            lockfileVersion: 3,
            packages: {
              '': {
                name: 'test-project',
                version: '1.0.0'
              }
            } as Record<string, any>
          };

          // Add URL-based dependencies
          for (const dep of dependencies) {
            lockfile.packages[`node_modules/${dep.name}`] = {
              version: '1.0.0',
              resolved: dep.url
            };
          }

          // Write lockfile
          const lockfilePath = path.join(tempDir, 'package-lock.json');
          await fs.writeFile(lockfilePath, JSON.stringify(lockfile, null, 2));

          // Parse lockfile
          const parsed = await parser.parseLockfile(tempDir);

          // Verify all URL dependencies were extracted
          assert.strictEqual(
            parsed.length,
            dependencies.length,
            `Expected ${dependencies.length} dependencies, got ${parsed.length}`
          );

          // Verify each dependency is present
          for (const dep of dependencies) {
            const found = parsed.find(p => p.name === dep.name && p.resolvedUrl === dep.url);
            assert.ok(
              found,
              `Dependency ${dep.name} with URL ${dep.url} not found in parsed results`
            );
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Yarn lockfile parsing completeness
   * 
   * For any valid yarn lockfile with URL-based dependencies,
   * all URL dependencies should be extracted.
   */
  test('Property 2: Yarn lockfile parsing extracts all URL dependencies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(urlDependencyEntryArbitrary, { minLength: 1, maxLength: 10 }),
        async (dependencies) => {
          // Generate yarn lockfile content
          let lockfileContent = '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n';
          lockfileContent += '# yarn lockfile v1\n\n';

          for (const dep of dependencies) {
            lockfileContent += `${dep.name}@${dep.url}:\n`;
            lockfileContent += `  version "1.0.0"\n`;
            lockfileContent += `  resolved "${dep.url}"\n\n`;
          }

          // Write lockfile
          const lockfilePath = path.join(tempDir, 'yarn.lock');
          await fs.writeFile(lockfilePath, lockfileContent);

          // Parse lockfile
          const parsed = await parser.parseLockfile(tempDir);

          // Verify all URL dependencies were extracted
          assert.strictEqual(
            parsed.length,
            dependencies.length,
            `Expected ${dependencies.length} dependencies, got ${parsed.length}`
          );

          // Verify each dependency is present
          for (const dep of dependencies) {
            const found = parsed.find(p => p.name === dep.name && p.resolvedUrl === dep.url);
            assert.ok(
              found,
              `Dependency ${dep.name} with URL ${dep.url} not found in parsed results`
            );
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: PNPM lockfile parsing completeness
   * 
   * For any valid pnpm lockfile with URL-based dependencies,
   * all URL dependencies should be extracted.
   */
  test('Property 3: PNPM lockfile parsing extracts all URL dependencies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(urlDependencyEntryArbitrary, { minLength: 1, maxLength: 10 }),
        async (dependencies) => {
          // Generate pnpm lockfile content
          let lockfileContent = 'lockfileVersion: \'6.0\'\n\n';
          lockfileContent += 'packages:\n';

          for (const dep of dependencies) {
            lockfileContent += `  /${dep.name}/1.0.0:\n`;
            lockfileContent += `    resolution: {tarball: ${dep.url}}\n`;
            lockfileContent += `    name: ${dep.name}\n`;
            lockfileContent += `    version: 1.0.0\n\n`;
          }

          // Write lockfile
          const lockfilePath = path.join(tempDir, 'pnpm-lock.yaml');
          await fs.writeFile(lockfilePath, lockfileContent);

          // Parse lockfile
          const parsed = await parser.parseLockfile(tempDir);

          // Verify all URL dependencies were extracted
          assert.strictEqual(
            parsed.length,
            dependencies.length,
            `Expected ${dependencies.length} dependencies, got ${parsed.length}`
          );

          // Verify each dependency is present
          for (const dep of dependencies) {
            const found = parsed.find(p => p.name === dep.name && p.resolvedUrl === dep.url);
            assert.ok(
              found,
              `Dependency ${dep.name} with URL ${dep.url} not found in parsed results`
            );
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: NPM registry URLs are excluded
   * 
   * For any lockfile with npm registry URLs,
   * those URLs should NOT be extracted (they're not "URL-based" for our purposes).
   */
  test('Property 4: NPM registry URLs are correctly excluded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(anyPackageNameArbitrary, { minLength: 1, maxLength: 10 }),
        async (packageNames) => {
          // Generate npm lockfile with registry URLs
          const lockfile = {
            name: 'test-project',
            version: '1.0.0',
            lockfileVersion: 3,
            packages: {
              '': {
                name: 'test-project',
                version: '1.0.0'
              }
            } as Record<string, any>
          };

          // Add registry-based dependencies (should be excluded)
          for (const name of packageNames) {
            lockfile.packages[`node_modules/${name}`] = {
              version: '1.0.0',
              resolved: `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`
            };
          }

          // Write lockfile
          const lockfilePath = path.join(tempDir, 'package-lock.json');
          await fs.writeFile(lockfilePath, JSON.stringify(lockfile, null, 2));

          // Parse lockfile
          const parsed = await parser.parseLockfile(tempDir);

          // Verify NO dependencies were extracted (all are registry URLs)
          assert.strictEqual(
            parsed.length,
            0,
            `Expected 0 dependencies (all registry URLs), got ${parsed.length}`
          );

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Mixed lockfile parsing
   * 
   * For any lockfile with both URL-based and registry-based dependencies,
   * only URL-based dependencies should be extracted.
   */
  test('Property 5: Mixed lockfile correctly filters URL dependencies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.array(urlDependencyEntryArbitrary, { minLength: 1, maxLength: 5 }),
          fc.array(anyPackageNameArbitrary, { minLength: 1, maxLength: 5 })
        ),
        async ([urlDeps, registryPackages]) => {
          // Generate npm lockfile with both types
          const lockfile = {
            name: 'test-project',
            version: '1.0.0',
            lockfileVersion: 3,
            packages: {
              '': {
                name: 'test-project',
                version: '1.0.0'
              }
            } as Record<string, any>
          };

          // Add URL-based dependencies
          for (const dep of urlDeps) {
            lockfile.packages[`node_modules/${dep.name}`] = {
              version: '1.0.0',
              resolved: dep.url
            };
          }

          // Add registry-based dependencies
          for (const name of registryPackages) {
            lockfile.packages[`node_modules/${name}`] = {
              version: '1.0.0',
              resolved: `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`
            };
          }

          // Write lockfile
          const lockfilePath = path.join(tempDir, 'package-lock.json');
          await fs.writeFile(lockfilePath, JSON.stringify(lockfile, null, 2));

          // Parse lockfile
          const parsed = await parser.parseLockfile(tempDir);

          // Verify only URL dependencies were extracted
          assert.strictEqual(
            parsed.length,
            urlDeps.length,
            `Expected ${urlDeps.length} URL dependencies, got ${parsed.length}`
          );

          // Verify each URL dependency is present
          for (const dep of urlDeps) {
            const found = parsed.find(p => p.name === dep.name && p.resolvedUrl === dep.url);
            assert.ok(
              found,
              `URL dependency ${dep.name} not found in parsed results`
            );
          }

          // Verify no registry dependencies were included
          for (const name of registryPackages) {
            const found = parsed.find(p => p.name === name);
            assert.ok(
              !found,
              `Registry dependency ${name} should not be in parsed results`
            );
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Empty lockfile handling
   * 
   * For any lockfile with no URL-based dependencies,
   * parsing should return an empty array.
   */
  test('Property 6: Empty lockfile returns empty array', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Generate empty npm lockfile
          const lockfile = {
            name: 'test-project',
            version: '1.0.0',
            lockfileVersion: 3,
            packages: {
              '': {
                name: 'test-project',
                version: '1.0.0'
              }
            }
          };

          // Write lockfile
          const lockfilePath = path.join(tempDir, 'package-lock.json');
          await fs.writeFile(lockfilePath, JSON.stringify(lockfile, null, 2));

          // Parse lockfile
          const parsed = await parser.parseLockfile(tempDir);

          // Verify empty result
          assert.strictEqual(
            parsed.length,
            0,
            'Expected empty array for lockfile with no URL dependencies'
          );

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7: No lockfile returns empty array
   * 
   * When no lockfile exists, parsing should return an empty array
   * without throwing an error.
   */
  test('Property 7: Missing lockfile returns empty array', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Create a fresh temp directory with no lockfile
          const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-test-'));

          try {
            // Parse non-existent lockfile
            const parsed = await parser.parseLockfile(emptyDir);

            // Verify empty result
            assert.strictEqual(
              parsed.length,
              0,
              'Expected empty array when no lockfile exists'
            );

            return true;
          } finally {
            // Clean up
            await fs.rm(emptyDir, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
