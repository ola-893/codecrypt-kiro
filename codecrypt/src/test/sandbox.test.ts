/**
 * Tests for Sandbox Service
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  validateFilePath,
  safeReadFile,
  safeWriteFile,
  executeSandboxedNpm,
  sandboxedNpmInstall,
  cleanupSandbox
} from '../services/sandbox';
import { CodeCryptError } from '../utils/errors';

suite('Sandbox Service Tests', () => {
  let testRepoPath: string;

  setup(async () => {
    // Create a temporary test repository
    testRepoPath = path.join(os.tmpdir(), `codecrypt-test-${Date.now()}`);
    await fs.mkdir(testRepoPath, { recursive: true });
  });

  teardown(async () => {
    // Clean up test repository
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  suite('validateFilePath', () => {
    test('should allow paths within repository', () => {
      const validPath = path.join(testRepoPath, 'package.json');
      assert.doesNotThrow(() => {
        validateFilePath(validPath, testRepoPath);
      });
    });

    test('should allow nested paths within repository', () => {
      const validPath = path.join(testRepoPath, 'src', 'index.ts');
      assert.doesNotThrow(() => {
        validateFilePath(validPath, testRepoPath);
      });
    });

    test('should block path traversal attempts', () => {
      const maliciousPath = path.join(testRepoPath, '..', '..', 'etc', 'passwd');
      assert.throws(
        () => validateFilePath(maliciousPath, testRepoPath),
        (error: any) => {
          return error instanceof CodeCryptError && 
                 error.code === 'PATH_TRAVERSAL_BLOCKED';
        }
      );
    });

    test('should block absolute paths outside repository', () => {
      const outsidePath = '/etc/passwd';
      assert.throws(
        () => validateFilePath(outsidePath, testRepoPath),
        (error: any) => {
          return error instanceof CodeCryptError && 
                 error.code === 'PATH_TRAVERSAL_BLOCKED';
        }
      );
    });
  });

  suite('safeReadFile', () => {
    test('should read file within repository', async () => {
      const testFile = path.join(testRepoPath, 'test.txt');
      const testContent = 'Hello, CodeCrypt!';
      await fs.writeFile(testFile, testContent);

      const content = await safeReadFile(testFile, testRepoPath);
      assert.strictEqual(content, testContent);
    });

    test('should throw error for file outside repository', async () => {
      const outsideFile = '/etc/passwd';
      await assert.rejects(
        async () => await safeReadFile(outsideFile, testRepoPath),
        (error: any) => {
          return error instanceof CodeCryptError && 
                 error.code === 'PATH_TRAVERSAL_BLOCKED';
        }
      );
    });

    test('should throw error for non-existent file', async () => {
      const nonExistentFile = path.join(testRepoPath, 'does-not-exist.txt');
      await assert.rejects(
        async () => await safeReadFile(nonExistentFile, testRepoPath),
        (error: any) => {
          return error instanceof CodeCryptError && 
                 error.code === 'FILE_READ_ERROR';
        }
      );
    });
  });

  suite('safeWriteFile', () => {
    test('should write file within repository', async () => {
      const testFile = path.join(testRepoPath, 'output.txt');
      const testContent = 'Test output';

      await safeWriteFile(testFile, testContent, testRepoPath);

      const content = await fs.readFile(testFile, 'utf-8');
      assert.strictEqual(content, testContent);
    });

    test('should throw error for file outside repository', async () => {
      const outsideFile = '/tmp/malicious.txt';
      await assert.rejects(
        async () => await safeWriteFile(outsideFile, 'bad content', testRepoPath),
        (error: any) => {
          return error instanceof CodeCryptError && 
                 error.code === 'PATH_TRAVERSAL_BLOCKED';
        }
      );
    });
  });

  suite('executeSandboxedNpm', () => {
    test('should reject disallowed npm commands', () => {
      assert.throws(
        () => executeSandboxedNpm('publish', {
          cwd: testRepoPath,
          repoPath: testRepoPath
        }),
        (error: any) => {
          return error instanceof CodeCryptError && 
                 error.code === 'COMMAND_NOT_ALLOWED';
        }
      );
    });

    test('should reject commands with path traversal in cwd', () => {
      const maliciousCwd = path.join(testRepoPath, '..', '..');
      assert.throws(
        () => executeSandboxedNpm('install', {
          cwd: maliciousCwd,
          repoPath: testRepoPath
        }),
        (error: any) => {
          return error instanceof CodeCryptError && 
                 error.code === 'PATH_TRAVERSAL_BLOCKED';
        }
      );
    });
  });

  suite('cleanupSandbox', () => {
    test('should remove npm cache directory', async () => {
      const cachePath = path.join(testRepoPath, '.npm-cache');
      await fs.mkdir(cachePath, { recursive: true });
      await fs.writeFile(path.join(cachePath, 'test.txt'), 'cache data');

      await cleanupSandbox(testRepoPath);

      // Verify cache directory is removed
      await assert.rejects(
        async () => await fs.access(cachePath),
        'Cache directory should be removed'
      );
    });

    test('should not throw error if cache does not exist', async () => {
      await assert.doesNotReject(async () => {
        await cleanupSandbox(testRepoPath);
      });
    });
  });
});
