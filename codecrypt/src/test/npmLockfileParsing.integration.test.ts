/**
 * Integration Test: npm Lockfile Parsing
 * 
 * Tests npm lockfile (package-lock.json) parsing with URL-based dependencies.
 * Validates parsing, extraction, and regeneration functionality.
 * 
 * Requirements: 1.1, 4.1-4.2
 */

import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createLockfileParser } from '../services/lockfileParser';
import { getLogger } from '../utils/logger';

const logger = getLogger();

describe('npm Lockfile Parsing Integration Tests', () => {
  let testRepoPath: string;
  let lockfileParser: ReturnType<typeof createLockfileParser>;

  beforeEach(async () => {
    // Create temporary test directory
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-npm-lockfile-test-'));
    lockfileParser = createLockfileParser();
    logger.info(`Created test repo at: ${testRepoPath}`);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
      logger.info(`Cleaned up test repo: ${testRepoPath}`);
    } catch (error) {
      logger.error('Failed to clean up test repo', error);
    }
  });

  /**
   * Test 1: Parse npm v7+ lockfile with URL-based dependency
   * Validates: Requirements 1.1, 4.1
   */
  it('should parse npm v7+ lockfile and extract URL-based dependencies', async () => {
    // Create package.json
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      dependencies: {
        'querystring': 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create npm v7+ lockfile with URL dependency
    const lockfileContent = {
      name: 'test-repo',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: 'test-repo',
          version: '1.0.0',
          dependencies: {
            'querystring': 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz'
          }
        },
        'node_modules/querystring': {
          version: '0.2.0',
          resolved: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
          integrity: 'sha512-test123'
        }
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package-lock.json'),
      JSON.stringify(lockfileContent, null, 2)
    );

    // Detect lockfile type
    const lockfileType = await lockfileParser.detectLockfileType(testRepoPath);
    assert.strictEqual(lockfileType, 'npm', 'Should detect npm lockfile');

    // Parse lockfile
    const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);

    // Verify URL-based dependency was extracted
    assert.ok(transitiveDeps.length > 0, 'Should find at least one URL-based dependency');
    
    const querystringDep = transitiveDeps.find(dep => dep.name === 'querystring');
    assert.ok(querystringDep, 'Should find querystring dependency');
    assert.strictEqual(
      querystringDep.resolvedUrl,
      'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
      'Should extract correct URL'
    );
    assert.ok(querystringDep.depth >= 0, 'Should have valid depth');

    logger.info('✓ npm v7+ lockfile parsing successful');
  });

  /**
   * Test 2: Parse npm v6 lockfile with URL-based dependency
   * Validates: Requirements 1.1
   */
  it('should parse npm v6 lockfile and extract URL-based dependencies', async () => {
    // Create package.json
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      dependencies: {
        'old-package': 'https://github.com/user/old-package/archive/v1.0.0.tar.gz'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create npm v6 lockfile (uses "dependencies" field instead of "packages")
    const lockfileContent = {
      name: 'test-repo',
      version: '1.0.0',
      lockfileVersion: 1,
      requires: true,
      dependencies: {
        'old-package': {
          version: '1.0.0',
          resolved: 'https://github.com/user/old-package/archive/v1.0.0.tar.gz',
          integrity: 'sha512-test456'
        }
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package-lock.json'),
      JSON.stringify(lockfileContent, null, 2)
    );

    // Parse lockfile
    const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);

    // Verify URL-based dependency was extracted
    assert.ok(transitiveDeps.length > 0, 'Should find at least one URL-based dependency');
    
    const oldPackageDep = transitiveDeps.find(dep => dep.name === 'old-package');
    assert.ok(oldPackageDep, 'Should find old-package dependency');
    assert.strictEqual(
      oldPackageDep.resolvedUrl,
      'https://github.com/user/old-package/archive/v1.0.0.tar.gz',
      'Should extract correct URL'
    );

    logger.info('✓ npm v6 lockfile parsing successful');
  });

  /**
   * Test 3: Parse lockfile with multiple URL-based dependencies
   * Validates: Requirements 1.1
   */
  it('should extract multiple URL-based dependencies from lockfile', async () => {
    // Create lockfile with multiple URL dependencies
    const lockfileContent = {
      name: 'test-repo',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'test-repo',
          version: '1.0.0'
        },
        'node_modules/package-a': {
          version: '1.0.0',
          resolved: 'https://github.com/user/package-a/archive/v1.0.0.tar.gz'
        },
        'node_modules/package-b': {
          version: '2.0.0',
          resolved: 'https://github.com/user/package-b/archive/v2.0.0.tar.gz'
        },
        'node_modules/package-c': {
          version: '3.0.0',
          resolved: 'git+https://github.com/user/package-c.git#abc123'
        },
        'node_modules/normal-package': {
          version: '1.0.0',
          resolved: 'https://registry.npmjs.org/normal-package/-/normal-package-1.0.0.tgz'
        }
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package-lock.json'),
      JSON.stringify(lockfileContent, null, 2)
    );

    // Parse lockfile
    const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);

    // Verify all URL-based dependencies were extracted (but not npm registry ones)
    assert.strictEqual(transitiveDeps.length, 3, 'Should find exactly 3 URL-based dependencies');
    
    const packageNames = transitiveDeps.map(dep => dep.name).sort();
    assert.deepStrictEqual(
      packageNames,
      ['package-a', 'package-b', 'package-c'],
      'Should extract correct package names'
    );

    // Verify npm registry package was excluded
    const normalPackage = transitiveDeps.find(dep => dep.name === 'normal-package');
    assert.strictEqual(normalPackage, undefined, 'Should not include npm registry packages');

    logger.info('✓ Multiple URL-based dependencies extracted successfully');
  });

  /**
   * Test 4: Parse lockfile with nested transitive dependencies
   * Validates: Requirements 1.1
   */
  it('should handle nested transitive dependencies with correct depth', async () => {
    // Create npm v6 lockfile with nested dependencies
    const lockfileContent = {
      name: 'test-repo',
      version: '1.0.0',
      lockfileVersion: 1,
      dependencies: {
        'parent-package': {
          version: '1.0.0',
          resolved: 'https://registry.npmjs.org/parent-package/-/parent-package-1.0.0.tgz',
          dependencies: {
            'child-package': {
              version: '1.0.0',
              resolved: 'https://github.com/user/child-package/archive/v1.0.0.tar.gz',
              dependencies: {
                'grandchild-package': {
                  version: '1.0.0',
                  resolved: 'https://github.com/user/grandchild-package/archive/v1.0.0.tar.gz'
                }
              }
            }
          }
        }
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package-lock.json'),
      JSON.stringify(lockfileContent, null, 2)
    );

    // Parse lockfile
    const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);

    // Verify nested dependencies were extracted
    assert.ok(transitiveDeps.length >= 2, 'Should find at least 2 URL-based dependencies');
    
    const childDep = transitiveDeps.find(dep => dep.name === 'child-package');
    const grandchildDep = transitiveDeps.find(dep => dep.name === 'grandchild-package');
    
    assert.ok(childDep, 'Should find child-package');
    assert.ok(grandchildDep, 'Should find grandchild-package');
    
    // Verify depth is tracked
    assert.ok(childDep.depth >= 0, 'Child should have valid depth');
    assert.ok(grandchildDep.depth > childDep.depth, 'Grandchild should have greater depth than child');

    logger.info('✓ Nested transitive dependencies handled correctly');
  });

  /**
   * Test 5: Delete lockfiles
   * Validates: Requirements 4.1
   */
  it('should delete npm lockfile when requested', async () => {
    // Create lockfile
    await fs.writeFile(
      path.join(testRepoPath, 'package-lock.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
    );

    // Verify lockfile exists
    await fs.access(path.join(testRepoPath, 'package-lock.json'));

    // Delete lockfiles
    await lockfileParser.deleteLockfiles(testRepoPath);

    // Verify lockfile was deleted
    try {
      await fs.access(path.join(testRepoPath, 'package-lock.json'));
      assert.fail('Lockfile should have been deleted');
    } catch (error: any) {
      assert.strictEqual(error.code, 'ENOENT', 'Lockfile should not exist');
    }

    logger.info('✓ Lockfile deletion successful');
  });

  /**
   * Test 6: Handle missing lockfile gracefully
   * Validates: Requirements 1.1
   */
  it('should handle missing lockfile gracefully', async () => {
    // Don't create any lockfile

    // Detect lockfile type
    const lockfileType = await lockfileParser.detectLockfileType(testRepoPath);
    assert.strictEqual(lockfileType, null, 'Should detect no lockfile');

    // Parse lockfile (should return empty array)
    const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
    assert.strictEqual(transitiveDeps.length, 0, 'Should return empty array for missing lockfile');

    logger.info('✓ Missing lockfile handled gracefully');
  });

  /**
   * Test 7: Handle malformed lockfile gracefully
   * Validates: Requirements 1.1
   */
  it('should handle malformed lockfile gracefully', async () => {
    // Create malformed lockfile
    await fs.writeFile(
      path.join(testRepoPath, 'package-lock.json'),
      'this is not valid JSON {'
    );

    // Parse lockfile (should return empty array and not throw)
    const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
    assert.strictEqual(transitiveDeps.length, 0, 'Should return empty array for malformed lockfile');

    logger.info('✓ Malformed lockfile handled gracefully');
  });

  /**
   * Test 8: Extract scoped package names correctly
   * Validates: Requirements 1.1
   */
  it('should extract scoped package names correctly', async () => {
    // Create lockfile with scoped packages
    const lockfileContent = {
      name: 'test-repo',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        'node_modules/@babel/core': {
          version: '7.0.0',
          resolved: 'https://github.com/babel/babel/archive/v7.0.0.tar.gz'
        },
        'node_modules/@types/node': {
          version: '14.0.0',
          resolved: 'https://github.com/DefinitelyTyped/DefinitelyTyped/archive/node-14.0.0.tar.gz'
        }
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package-lock.json'),
      JSON.stringify(lockfileContent, null, 2)
    );

    // Parse lockfile
    const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);

    // Verify scoped packages were extracted correctly
    assert.strictEqual(transitiveDeps.length, 2, 'Should find 2 scoped packages');
    
    const babelDep = transitiveDeps.find(dep => dep.name === '@babel/core');
    const typesDep = transitiveDeps.find(dep => dep.name === '@types/node');
    
    assert.ok(babelDep, 'Should find @babel/core');
    assert.ok(typesDep, 'Should find @types/node');

    logger.info('✓ Scoped package names extracted correctly');
  });

  /**
   * Test 9: Filter out npm registry URLs
   * Validates: Requirements 1.1
   */
  it('should filter out npm registry URLs and only extract non-registry URLs', async () => {
    // Create lockfile with mix of registry and non-registry URLs
    const lockfileContent = {
      name: 'test-repo',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        'node_modules/registry-package': {
          version: '1.0.0',
          resolved: 'https://registry.npmjs.org/registry-package/-/registry-package-1.0.0.tgz'
        },
        'node_modules/yarn-registry-package': {
          version: '1.0.0',
          resolved: 'https://registry.yarnpkg.com/yarn-registry-package/-/yarn-registry-package-1.0.0.tgz'
        },
        'node_modules/github-package': {
          version: '1.0.0',
          resolved: 'https://github.com/user/github-package/archive/v1.0.0.tar.gz'
        }
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package-lock.json'),
      JSON.stringify(lockfileContent, null, 2)
    );

    // Parse lockfile
    const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);

    // Verify only non-registry URLs were extracted
    assert.strictEqual(transitiveDeps.length, 1, 'Should find only 1 non-registry URL');
    assert.strictEqual(transitiveDeps[0].name, 'github-package', 'Should extract github-package');

    logger.info('✓ npm registry URLs filtered correctly');
  });

  /**
   * Test 10: Handle various URL protocols
   * Validates: Requirements 1.1
   */
  it('should extract dependencies with various URL protocols', async () => {
    // Create lockfile with different URL protocols
    const lockfileContent = {
      name: 'test-repo',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        'node_modules/https-package': {
          version: '1.0.0',
          resolved: 'https://example.com/package.tar.gz'
        },
        'node_modules/http-package': {
          version: '1.0.0',
          resolved: 'http://example.com/package.tar.gz'
        },
        'node_modules/git-package': {
          version: '1.0.0',
          resolved: 'git://github.com/user/package.git'
        },
        'node_modules/git-https-package': {
          version: '1.0.0',
          resolved: 'git+https://github.com/user/package.git'
        },
        'node_modules/git-http-package': {
          version: '1.0.0',
          resolved: 'git+http://github.com/user/package.git'
        }
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package-lock.json'),
      JSON.stringify(lockfileContent, null, 2)
    );

    // Parse lockfile
    const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);

    // Verify all URL protocols were recognized
    assert.strictEqual(transitiveDeps.length, 5, 'Should find all 5 URL-based dependencies');
    
    const protocols = transitiveDeps.map(dep => {
      if (dep.resolvedUrl.startsWith('https://')) {
        return 'https';
      }
      if (dep.resolvedUrl.startsWith('http://')) {
        return 'http';
      }
      if (dep.resolvedUrl.startsWith('git+https://')) {
        return 'git+https';
      }
      if (dep.resolvedUrl.startsWith('git+http://')) {
        return 'git+http';
      }
      if (dep.resolvedUrl.startsWith('git://')) {
        return 'git';
      }
      return 'unknown';
    }).sort();

    assert.deepStrictEqual(
      protocols,
      ['git', 'git+http', 'git+https', 'http', 'https'],
      'Should recognize all URL protocols'
    );

    logger.info('✓ Various URL protocols handled correctly');
  });
});
