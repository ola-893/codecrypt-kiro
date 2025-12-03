/**
 * Tests for Validation Service
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { validateAfterUpdate, createValidationLogEntry } from '../services/validation';

suite('Validation Service', () => {
  let testRepoPath: string;
  
  setup(async () => {
    // Create a temporary directory for testing
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-validation-test-'));
    
    // Initialize a git repository
    execSync('git init', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.email "test@codecrypt.test"', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.name "CodeCrypt Test"', { cwd: testRepoPath, stdio: 'pipe' });
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
  
  test('should pass validation for non-TypeScript project without tests', async () => {
    // Create a basic package.json without test script
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      scripts: {}
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    const result = await validateAfterUpdate(testRepoPath);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.compilationChecked, false);
    assert.strictEqual(result.testsRun, false);
  });
  
  test('should detect TypeScript project', async function() {
    this.timeout(60000); // 60 second timeout for npm install and TypeScript compilation
    
    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs'
      }
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );
    
    // Create a valid TypeScript file
    await fs.writeFile(
      path.join(testRepoPath, 'index.ts'),
      'const x: number = 42;\nexport { x };'
    );
    
    // Create package.json with TypeScript dependency
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      devDependencies: {
        typescript: '^5.0.0'
      }
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Install TypeScript
    try {
      execSync('npm install', { cwd: testRepoPath, stdio: 'pipe', timeout: 30000 });
    } catch (error) {
      // Skip test if npm install fails
      this.skip();
      return;
    }
    
    const result = await validateAfterUpdate(testRepoPath);
    
    assert.strictEqual(result.compilationChecked, true);
    assert.strictEqual(result.compilationPassed, true);
    assert.strictEqual(result.success, true);
  });
  
  test('should detect test script', async () => {
    // Create package.json with test script
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "Tests passed" && exit 0'
      }
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    const result = await validateAfterUpdate(testRepoPath);
    
    assert.strictEqual(result.testsRun, true);
    assert.strictEqual(result.testsPassed, true);
    assert.strictEqual(result.success, true);
  });
  
  test('should handle test script that exits with success', async () => {
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      scripts: {
        test: 'exit 0'
      }
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    const result = await validateAfterUpdate(testRepoPath);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.testsPassed, true);
  });
  
  test('should handle test script that fails', async () => {
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      scripts: {
        test: 'exit 1'
      }
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    const result = await validateAfterUpdate(testRepoPath);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.testsRun, true);
    assert.strictEqual(result.testsPassed, false);
    assert.strictEqual(result.error, 'Tests failed');
  });
  
  test('should run both compilation and tests for TypeScript project with tests', async function() {
    this.timeout(60000); // 60 second timeout for npm install and TypeScript compilation
    
    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs'
      }
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );
    
    // Create a valid TypeScript file
    await fs.writeFile(
      path.join(testRepoPath, 'index.ts'),
      'const x: number = 42;\nexport { x };'
    );
    
    // Create package.json with test script and TypeScript dependency
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "Tests passed"'
      },
      devDependencies: {
        typescript: '^5.0.0'
      }
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Install TypeScript
    try {
      execSync('npm install', { cwd: testRepoPath, stdio: 'pipe', timeout: 30000 });
    } catch (error) {
      // Skip test if npm install fails
      this.skip();
      return;
    }
    
    const result = await validateAfterUpdate(testRepoPath);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.compilationChecked, true);
    assert.strictEqual(result.compilationPassed, true);
    assert.strictEqual(result.testsRun, true);
    assert.strictEqual(result.testsPassed, true);
  });
  
  test('should fail validation if compilation fails', async function() {
    this.timeout(60000); // 60 second timeout for npm install and TypeScript compilation
    
    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        strict: true
      }
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );
    
    // Create an invalid TypeScript file
    await fs.writeFile(
      path.join(testRepoPath, 'index.ts'),
      'const x: number = "not a number"; // Type error'
    );
    
    // Create package.json with TypeScript dependency
    const packageJson = {
      name: 'test-repo',
      version: '1.0.0',
      devDependencies: {
        typescript: '^5.0.0'
      }
    };
    
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Install TypeScript
    try {
      execSync('npm install', { cwd: testRepoPath, stdio: 'pipe', timeout: 30000 });
    } catch (error) {
      // Skip test if npm install fails
      this.skip();
      return;
    }
    
    const result = await validateAfterUpdate(testRepoPath);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.compilationChecked, true);
    assert.strictEqual(result.compilationPassed, false);
    assert.strictEqual(result.error, 'Compilation failed');
    assert.ok(result.output);
  });
  
  test('should create correct log entry for successful validation', () => {
    const result = {
      success: true,
      compilationChecked: true,
      compilationPassed: true,
      testsRun: true,
      testsPassed: true
    };
    
    const logEntry = createValidationLogEntry(result);
    
    assert.strictEqual(logEntry.type, 'test_run');
    assert.ok(logEntry.message.includes('passed'));
    assert.strictEqual(logEntry.details.compilationPassed, true);
    assert.strictEqual(logEntry.details.testsPassed, true);
  });
  
  test('should create correct log entry for failed validation', () => {
    const result = {
      success: false,
      compilationChecked: true,
      compilationPassed: false,
      testsRun: false,
      error: 'Compilation failed',
      output: 'Type error on line 5'
    };
    
    const logEntry = createValidationLogEntry(result);
    
    assert.strictEqual(logEntry.type, 'error');
    assert.ok(logEntry.message.includes('failed'));
    assert.strictEqual(logEntry.details.compilationPassed, false);
    assert.strictEqual(logEntry.details.output, 'Type error on line 5');
  });
});
