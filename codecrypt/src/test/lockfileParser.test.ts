/**
 * Unit Tests for Lockfile Parser
 * 
 * Tests each lockfile format with samples, error handling for malformed files,
 * and edge cases.
 * 
 * Requirements: 1.1
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LockfileParser, TransitiveDependency } from '../services/lockfileParser';

suite('Lockfile Parser Unit Tests', () => {
  let tempDir: string;
  let parser: LockfileParser;

  setup(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockfile-unit-test-'));
    parser = new LockfileParser();
  });

  teardown(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  suite('NPM Lockfile (package-lock.json)', () => {
    test('should parse npm v7+ lockfile with URL dependencies', async () => {
      const lockfile = {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-project',
            version: '1.0.0'
          },
          'node_modules/querystring': {
            version: '0.2.0',
            resolved: 'https://github.com/Gozala/querystring/archive/v0.2.0.tar.gz'
          },
          'node_modules/@babel/core': {
            version: '7.0.0',
            resolved: 'git+https://github.com/babel/babel.git#abc123'
          }
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 2);
      assert.ok(result.find(d => d.name === 'querystring'));
      assert.ok(result.find(d => d.name === '@babel/core'));
    });

    test('should parse npm v6 lockfile with URL dependencies', async () => {
      const lockfile = {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 1,
        dependencies: {
          'querystring': {
            version: '0.2.0',
            resolved: 'https://github.com/Gozala/querystring/archive/v0.2.0.tar.gz'
          },
          'parent-package': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/parent-package/-/parent-package-1.0.0.tgz',
            dependencies: {
              'nested-dep': {
                version: '2.0.0',
                resolved: 'git+https://github.com/user/nested-dep.git#def456'
              }
            }
          }
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 2);
      
      const querystring = result.find(d => d.name === 'querystring');
      assert.ok(querystring);
      assert.strictEqual(querystring.depth, 0);
      
      const nested = result.find(d => d.name === 'nested-dep');
      assert.ok(nested);
      assert.strictEqual(nested.depth, 1);
      assert.deepStrictEqual(nested.parents, ['parent-package']);
    });

    test('should exclude npm registry URLs', async () => {
      const lockfile = {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-project',
            version: '1.0.0'
          },
          'node_modules/express': {
            version: '4.18.0',
            resolved: 'https://registry.npmjs.org/express/-/express-4.18.0.tgz'
          },
          'node_modules/lodash': {
            version: '4.17.21',
            resolved: 'https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz'
          }
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle malformed JSON', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        '{ invalid json content'
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle empty lockfile', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        '{}'
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle lockfile with no packages field', async () => {
      const lockfile = {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 3
      };

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle packages with missing resolved field', async () => {
      const lockfile = {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-project',
            version: '1.0.0'
          },
          'node_modules/some-package': {
            version: '1.0.0'
            // No resolved field
          }
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should calculate depth correctly for nested dependencies', async () => {
      const lockfile = {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-project',
            version: '1.0.0'
          },
          'node_modules/level1': {
            version: '1.0.0',
            resolved: 'https://github.com/user/level1/archive/v1.0.0.tar.gz'
          },
          'node_modules/parent/node_modules/level2': {
            version: '2.0.0',
            resolved: 'https://github.com/user/level2/archive/v2.0.0.tar.gz'
          }
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 2);
      
      const level1 = result.find(d => d.name === 'level1');
      assert.ok(level1);
      assert.strictEqual(level1.depth, 1);
      
      const level2 = result.find(d => d.name === 'level2');
      assert.ok(level2);
      assert.strictEqual(level2.depth, 2);
    });
  });

  suite('Yarn Lockfile (yarn.lock)', () => {
    test('should parse yarn lockfile with URL dependencies', async () => {
      const lockfileContent = `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

querystring@https://github.com/Gozala/querystring/archive/v0.2.0.tar.gz:
  version "0.2.0"
  resolved "https://github.com/Gozala/querystring/archive/v0.2.0.tar.gz"

"@babel/core@git+https://github.com/babel/babel.git#abc123":
  version "7.0.0"
  resolved "git+https://github.com/babel/babel.git#abc123"
`;

      await fs.writeFile(path.join(tempDir, 'yarn.lock'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 2);
      assert.ok(result.find(d => d.name === 'querystring'));
      assert.ok(result.find(d => d.name === '@babel/core'));
    });

    test('should parse yarn lockfile with scoped packages', async () => {
      const lockfileContent = `# yarn lockfile v1

"@scope/package@https://github.com/scope/package/archive/v1.0.0.tar.gz":
  version "1.0.0"
  resolved "https://github.com/scope/package/archive/v1.0.0.tar.gz"
`;

      await fs.writeFile(path.join(tempDir, 'yarn.lock'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, '@scope/package');
    });

    test('should exclude yarn registry URLs', async () => {
      const lockfileContent = `# yarn lockfile v1

express@^4.18.0:
  version "4.18.0"
  resolved "https://registry.yarnpkg.com/express/-/express-4.18.0.tgz"
`;

      await fs.writeFile(path.join(tempDir, 'yarn.lock'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle empty yarn lockfile', async () => {
      const lockfileContent = `# yarn lockfile v1\n`;

      await fs.writeFile(path.join(tempDir, 'yarn.lock'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle malformed yarn lockfile', async () => {
      const lockfileContent = `# yarn lockfile v1

package@version
  this is not valid format
`;

      await fs.writeFile(path.join(tempDir, 'yarn.lock'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle yarn lockfile with missing resolved field', async () => {
      const lockfileContent = `# yarn lockfile v1

querystring@https://github.com/Gozala/querystring/archive/v0.2.0.tar.gz:
  version "0.2.0"
`;

      await fs.writeFile(path.join(tempDir, 'yarn.lock'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle yarn lockfile with git protocol URLs', async () => {
      const lockfileContent = `# yarn lockfile v1

package@git://github.com/user/repo.git#abc123:
  version "1.0.0"
  resolved "git://github.com/user/repo.git#abc123"

package2@git+http://github.com/user/repo2.git:
  version "2.0.0"
  resolved "git+http://github.com/user/repo2.git"
`;

      await fs.writeFile(path.join(tempDir, 'yarn.lock'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 2);
    });
  });

  suite('PNPM Lockfile (pnpm-lock.yaml)', () => {
    test('should parse pnpm lockfile with URL dependencies', async () => {
      const lockfileContent = `lockfileVersion: '6.0'

packages:
  /querystring/0.2.0:
    resolution: {tarball: https://github.com/Gozala/querystring/archive/v0.2.0.tar.gz}
    name: querystring
    version: 0.2.0

  /@babel/core/7.0.0:
    resolution: {tarball: git+https://github.com/babel/babel.git#abc123}
    name: '@babel/core'
    version: 7.0.0
`;

      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 2);
      assert.ok(result.find(d => d.name === 'querystring'));
      assert.ok(result.find(d => d.name === '@babel/core'));
    });

    test('should exclude pnpm registry URLs', async () => {
      const lockfileContent = `lockfileVersion: '6.0'

packages:
  /express/4.18.0:
    resolution: {tarball: https://registry.npmjs.org/express/-/express-4.18.0.tgz}
    name: express
    version: 4.18.0
`;

      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle empty pnpm lockfile', async () => {
      const lockfileContent = `lockfileVersion: '6.0'\n`;

      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle pnpm lockfile with missing tarball field', async () => {
      const lockfileContent = `lockfileVersion: '6.0'

packages:
  /querystring/0.2.0:
    resolution: {integrity: sha512-abc123}
    name: querystring
    version: 0.2.0
`;

      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle malformed pnpm lockfile', async () => {
      const lockfileContent = `lockfileVersion: '6.0'

packages:
  this is not valid yaml format
    resolution: broken
`;

      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      // Should not throw, just return empty array
      assert.strictEqual(result.length, 0);
    });

    test('should handle pnpm lockfile with git protocol URLs', async () => {
      const lockfileContent = `lockfileVersion: '6.0'

packages:
  /package/1.0.0:
    resolution: {tarball: git://github.com/user/repo.git#abc123}
    name: package
    version: 1.0.0

  /package2/2.0.0:
    resolution: {tarball: git+http://github.com/user/repo2.git}
    name: package2
    version: 2.0.0
`;

      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 2);
    });
  });

  suite('Lockfile Detection', () => {
    test('should detect npm lockfile', async () => {
      await fs.writeFile(path.join(tempDir, 'package-lock.json'), '{}');

      const type = await parser.detectLockfileType(tempDir);

      assert.strictEqual(type, 'npm');
    });

    test('should detect yarn lockfile', async () => {
      await fs.writeFile(path.join(tempDir, 'yarn.lock'), '');

      const type = await parser.detectLockfileType(tempDir);

      assert.strictEqual(type, 'yarn');
    });

    test('should detect pnpm lockfile', async () => {
      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), '');

      const type = await parser.detectLockfileType(tempDir);

      assert.strictEqual(type, 'pnpm');
    });

    test('should return null when no lockfile exists', async () => {
      const type = await parser.detectLockfileType(tempDir);

      assert.strictEqual(type, null);
    });

    test('should prioritize npm lockfile when multiple exist', async () => {
      await fs.writeFile(path.join(tempDir, 'package-lock.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'yarn.lock'), '');
      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), '');

      const type = await parser.detectLockfileType(tempDir);

      assert.strictEqual(type, 'npm');
    });
  });

  suite('Lockfile Deletion', () => {
    test('should delete npm lockfile', async () => {
      const lockfilePath = path.join(tempDir, 'package-lock.json');
      await fs.writeFile(lockfilePath, '{}');

      await parser.deleteLockfiles(tempDir);

      await assert.rejects(
        () => fs.access(lockfilePath),
        'Lockfile should be deleted'
      );
    });

    test('should delete yarn lockfile', async () => {
      const lockfilePath = path.join(tempDir, 'yarn.lock');
      await fs.writeFile(lockfilePath, '');

      await parser.deleteLockfiles(tempDir);

      await assert.rejects(
        () => fs.access(lockfilePath),
        'Lockfile should be deleted'
      );
    });

    test('should delete pnpm lockfile', async () => {
      const lockfilePath = path.join(tempDir, 'pnpm-lock.yaml');
      await fs.writeFile(lockfilePath, '');

      await parser.deleteLockfiles(tempDir);

      await assert.rejects(
        () => fs.access(lockfilePath),
        'Lockfile should be deleted'
      );
    });

    test('should delete all lockfiles when multiple exist', async () => {
      const npmLockfile = path.join(tempDir, 'package-lock.json');
      const yarnLockfile = path.join(tempDir, 'yarn.lock');
      const pnpmLockfile = path.join(tempDir, 'pnpm-lock.yaml');

      await fs.writeFile(npmLockfile, '{}');
      await fs.writeFile(yarnLockfile, '');
      await fs.writeFile(pnpmLockfile, '');

      await parser.deleteLockfiles(tempDir);

      await assert.rejects(() => fs.access(npmLockfile));
      await assert.rejects(() => fs.access(yarnLockfile));
      await assert.rejects(() => fs.access(pnpmLockfile));
    });

    test('should not throw when no lockfiles exist', async () => {
      await assert.doesNotReject(
        () => parser.deleteLockfiles(tempDir),
        'Should not throw when no lockfiles exist'
      );
    });
  });

  suite('Edge Cases', () => {
    test('should handle lockfile with only root package', async () => {
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

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 0);
    });

    test('should handle package names with special characters', async () => {
      const lockfile = {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-project',
            version: '1.0.0'
          },
          'node_modules/@org-name/package-name': {
            version: '1.0.0',
            resolved: 'https://github.com/org/package/archive/v1.0.0.tar.gz'
          }
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, '@org-name/package-name');
    });

    test('should handle very long URLs', async () => {
      const longUrl = 'https://github.com/user/repo/archive/' + 'a'.repeat(500) + '.tar.gz';
      const lockfile = {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-project',
            version: '1.0.0'
          },
          'node_modules/package': {
            version: '1.0.0',
            resolved: longUrl
          }
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].resolvedUrl, longUrl);
    });

    test('should handle lockfile with unicode characters', async () => {
      const lockfileContent = `# yarn lockfile v1

"package-名前@https://github.com/user/repo/archive/v1.0.0.tar.gz":
  version "1.0.0"
  resolved "https://github.com/user/repo/archive/v1.0.0.tar.gz"
`;

      await fs.writeFile(path.join(tempDir, 'yarn.lock'), lockfileContent);

      const result = await parser.parseLockfile(tempDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'package-名前');
    });

    test('should handle empty package path', async () => {
      const lockfile = {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-project',
            version: '1.0.0',
            resolved: 'https://github.com/user/repo/archive/v1.0.0.tar.gz'
          }
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify(lockfile, null, 2)
      );

      const result = await parser.parseLockfile(tempDir);

      // Root package should not be included (empty path)
      assert.strictEqual(result.length, 0);
    });

    test('should handle non-existent directory', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');

      const result = await parser.parseLockfile(nonExistentDir);

      assert.strictEqual(result.length, 0);
    });
  });
});
