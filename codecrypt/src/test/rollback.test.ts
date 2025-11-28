/**
 * Tests for Rollback Service
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  rollbackLastCommit,
  createRollbackLogEntry,
  markDependencyAsProblematic,
  recoverFromFailedUpdate
} from '../services/rollback';
import { DependencyInfo } from '../types';

suite('Rollback Service', () => {
  let testRepoPath: string;
  
  setup(async () => {
    // Create a temporary directory for testing
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-rollback-test-'));
    
    // Initialize a git repository
    execSync('git init', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.email "test@codecrypt.test"', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.name "CodeCrypt Test"', { cwd: testRepoPath, stdio: 'pipe' });
    
    // Create initial commit
    await fs.writeFile(path.join(testRepoPath, 'file1.txt'), 'initial content');
    execSync('git add .', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'pipe' });
    
    // Create second commit
    await fs.writeFile(path.join(testRepoPath, 'file2.txt'), 'second commit');
    execSync('git add .', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git commit -m "Second commit"', { cwd: testRepoPath, stdio: 'pipe' });
  });
  
  teardown(async () => {
    // Clean up test directory
    if (testRepoPath) {
      try {
        await fs.rm(testRepoPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
  
  test('should rollback last commit successfully', async () => {
    // Get commit hash before rollback
    const beforeCommit = execSync('git rev-parse HEAD', {
      cwd: testRepoPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    
    const result = await rollbackLastCommit(testRepoPath);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.rolledBackCommit);
    assert.strictEqual(result.rolledBackCommit, beforeCommit);
    assert.ok(result.rolledBackMessage);
    assert.ok(result.currentCommit);
    
    // Verify file2.txt no longer exists
    try {
      await fs.access(path.join(testRepoPath, 'file2.txt'));
      assert.fail('file2.txt should not exist after rollback');
    } catch (error: any) {
      assert.strictEqual(error.code, 'ENOENT');
    }
    
    // Verify file1.txt still exists
    await fs.access(path.join(testRepoPath, 'file1.txt'));
  });
  
  test('should detect uncommitted changes', async () => {
    // Modify an existing tracked file
    await fs.writeFile(path.join(testRepoPath, 'file2.txt'), 'modified content');
    
    const result = await rollbackLastCommit(testRepoPath);
    
    // Rollback should still succeed
    assert.strictEqual(result.success, true);
    
    // Verify file2.txt no longer exists (it was added in the second commit which we rolled back)
    let fileExists = true;
    try {
      await fs.access(path.join(testRepoPath, 'file2.txt'));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        fileExists = false;
      }
    }
    
    // The file should not exist after rollback
    assert.strictEqual(fileExists, false, 'file2.txt should not exist after rollback');
  });
  
  test('should get current commit hash', async () => {
    const result = await rollbackLastCommit(testRepoPath);
    
    assert.ok(result.currentCommit);
    assert.strictEqual(result.currentCommit.length, 40); // Git SHA-1 hash length
  });
  
  test('should get commit message', async () => {
    const result = await rollbackLastCommit(testRepoPath);
    
    assert.ok(result.rolledBackMessage);
    assert.ok(result.rolledBackMessage.includes('Second commit'));
  });
  
  test('should create rollback log entry for successful rollback', () => {
    const result = {
      success: true,
      rolledBackCommit: 'abc123',
      rolledBackMessage: 'Update package',
      currentCommit: 'def456'
    };
    
    const logEntry = createRollbackLogEntry(result, 'test-package');
    
    assert.strictEqual(logEntry.type, 'rollback');
    assert.ok(logEntry.message.includes('test-package'));
    assert.strictEqual(logEntry.details.rolledBackCommit, 'abc123');
  });
  
  test('should create error log entry for failed rollback', () => {
    const result = {
      success: false,
      error: 'Git error'
    };
    
    const logEntry = createRollbackLogEntry(result, 'test-package');
    
    assert.strictEqual(logEntry.type, 'error');
    assert.ok(logEntry.message.includes('Failed'));
    assert.ok(logEntry.message.includes('test-package'));
  });
  
  test('should mark dependency as problematic', () => {
    const dependencies: DependencyInfo[] = [
      {
        name: 'test-package',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        vulnerabilities: [],
        updateStatus: 'pending'
      }
    ];
    
    markDependencyAsProblematic(dependencies, 'test-package');
    
    assert.strictEqual(dependencies[0].updateStatus, 'failed');
  });
  
  test('should recover from failed update', async () => {
    const dependencies: DependencyInfo[] = [
      {
        name: 'test-package',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        vulnerabilities: [],
        updateStatus: 'pending'
      }
    ];
    
    const result = await recoverFromFailedUpdate(testRepoPath, 'test-package', dependencies);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(dependencies[0].updateStatus, 'failed');
  });
  
  test('should handle rollback when there is only one commit', async () => {
    // Create a new repo with only one commit
    const singleCommitRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-single-commit-'));
    
    try {
      execSync('git init', { cwd: singleCommitRepo, stdio: 'pipe' });
      execSync('git config user.email "test@codecrypt.test"', { cwd: singleCommitRepo, stdio: 'pipe' });
      execSync('git config user.name "CodeCrypt Test"', { cwd: singleCommitRepo, stdio: 'pipe' });
      
      await fs.writeFile(path.join(singleCommitRepo, 'file.txt'), 'content');
      execSync('git add .', { cwd: singleCommitRepo, stdio: 'pipe' });
      execSync('git commit -m "Only commit"', { cwd: singleCommitRepo, stdio: 'pipe' });
      
      const result = await rollbackLastCommit(singleCommitRepo);
      
      // Rollback should fail because there's no previous commit
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      
    } finally {
      await fs.rm(singleCommitRepo, { recursive: true, force: true });
    }
  });
});
