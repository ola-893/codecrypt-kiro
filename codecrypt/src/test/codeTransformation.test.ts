/**
 * Tests for Code Transformation Service
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  loadTransformationRules,
  findApplicableRules,
  applyTransformations,
  createDefaultRulesFile,
  TransformationRule
} from '../services/codeTransformation';

suite('Code Transformation Service', () => {
  let testDir: string;
  
  setup(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-transform-test-'));
  });
  
  teardown(async () => {
    if (testDir) {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
  
  test('should load transformation rules from JSON file', async () => {
    const rulesPath = path.join(testDir, 'rules.json');
    const rules: TransformationRule[] = [
      {
        package: 'test-package',
        fromVersion: '1.x',
        toVersion: '2.x',
        transformation: {
          type: 'rename_function',
          oldName: 'oldFunc',
          newName: 'newFunc'
        }
      }
    ];
    
    await fs.writeFile(rulesPath, JSON.stringify(rules, null, 2));
    
    const loadedRules = await loadTransformationRules(rulesPath);
    
    assert.strictEqual(loadedRules.length, 1);
    assert.strictEqual(loadedRules[0].package, 'test-package');
    assert.strictEqual(loadedRules[0].transformation.oldName, 'oldFunc');
  });
  
  test('should return empty array when rules file does not exist', async () => {
    const rulesPath = path.join(testDir, 'nonexistent.json');
    
    const rules = await loadTransformationRules(rulesPath);
    
    assert.strictEqual(rules.length, 0);
  });
  
  test('should find applicable rules for package update', () => {
    const rules: TransformationRule[] = [
      {
        package: 'test-package',
        fromVersion: '1.x',
        toVersion: '2.x',
        transformation: {
          type: 'rename_function',
          oldName: 'oldFunc',
          newName: 'newFunc'
        }
      },
      {
        package: 'other-package',
        fromVersion: '1.x',
        toVersion: '2.x',
        transformation: {
          type: 'rename_function',
          oldName: 'otherFunc',
          newName: 'newOtherFunc'
        }
      }
    ];
    
    const applicable = findApplicableRules(rules, 'test-package', '1.5.0', '2.0.0');
    
    assert.strictEqual(applicable.length, 1);
    assert.strictEqual(applicable[0].package, 'test-package');
  });
  
  test('should not find rules for different package', () => {
    const rules: TransformationRule[] = [
      {
        package: 'test-package',
        fromVersion: '1.x',
        toVersion: '2.x',
        transformation: {
          type: 'rename_function',
          oldName: 'oldFunc',
          newName: 'newFunc'
        }
      }
    ];
    
    const applicable = findApplicableRules(rules, 'different-package', '1.5.0', '2.0.0');
    
    assert.strictEqual(applicable.length, 0);
  });
  
  test('should apply simple text replacement', async () => {
    // Create a test file
    const testFile = path.join(testDir, 'test.ts');
    await fs.writeFile(testFile, 'function oldFunc() { return oldFunc(); }');
    
    const rules: TransformationRule[] = [
      {
        package: 'test-package',
        fromVersion: '1.x',
        toVersion: '2.x',
        transformation: {
          type: 'rename_function',
          oldName: 'oldFunc',
          newName: 'newFunc'
        }
      }
    ];
    
    const result = await applyTransformations(testDir, rules);
    
    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.filesModified, 1);
    assert.strictEqual(result.replacementsMade, 2);
    
    // Verify file content
    const content = await fs.readFile(testFile, 'utf-8');
    assert.ok(content.includes('newFunc'));
    assert.ok(!content.includes('oldFunc'));
  });
  
  test('should apply multiple replacements in same file', async () => {
    // Create a test file
    const testFile = path.join(testDir, 'test.ts');
    await fs.writeFile(testFile, 'oldFunc(); oldFunc(); oldFunc();');
    
    const rules: TransformationRule[] = [
      {
        package: 'test-package',
        fromVersion: '1.x',
        toVersion: '2.x',
        transformation: {
          type: 'rename_function',
          oldName: 'oldFunc',
          newName: 'newFunc'
        }
      }
    ];
    
    const result = await applyTransformations(testDir, rules);
    
    assert.strictEqual(result.replacementsMade, 3);
  });
  
  test('should respect file pattern filter', async () => {
    // Create test files
    await fs.writeFile(path.join(testDir, 'test.ts'), 'oldFunc();');
    await fs.writeFile(path.join(testDir, 'test.js'), 'oldFunc();');
    
    const rules: TransformationRule[] = [
      {
        package: 'test-package',
        fromVersion: '1.x',
        toVersion: '2.x',
        transformation: {
          type: 'rename_function',
          oldName: 'oldFunc',
          newName: 'newFunc'
        },
        filePattern: '*.ts'
      }
    ];
    
    const result = await applyTransformations(testDir, rules);
    
    // Should only modify .ts file
    assert.strictEqual(result.filesModified, 1);
    
    // Verify .ts file was modified
    const tsContent = await fs.readFile(path.join(testDir, 'test.ts'), 'utf-8');
    assert.ok(tsContent.includes('newFunc'));
    
    // Verify .js file was not modified
    const jsContent = await fs.readFile(path.join(testDir, 'test.js'), 'utf-8');
    assert.ok(jsContent.includes('oldFunc'));
  });
  
  test('should skip node_modules directory', async () => {
    // Create node_modules directory with a file
    const nodeModulesDir = path.join(testDir, 'node_modules');
    await fs.mkdir(nodeModulesDir);
    await fs.writeFile(path.join(nodeModulesDir, 'test.ts'), 'oldFunc();');
    
    // Create a regular file
    await fs.writeFile(path.join(testDir, 'test.ts'), 'oldFunc();');
    
    const rules: TransformationRule[] = [
      {
        package: 'test-package',
        fromVersion: '1.x',
        toVersion: '2.x',
        transformation: {
          type: 'rename_function',
          oldName: 'oldFunc',
          newName: 'newFunc'
        }
      }
    ];
    
    const result = await applyTransformations(testDir, rules);
    
    // Should only modify the file outside node_modules
    assert.strictEqual(result.filesModified, 1);
    
    // Verify node_modules file was not modified
    const nodeModulesContent = await fs.readFile(path.join(nodeModulesDir, 'test.ts'), 'utf-8');
    assert.ok(nodeModulesContent.includes('oldFunc'));
  });
  
  test('should handle empty rules array', async () => {
    await fs.writeFile(path.join(testDir, 'test.ts'), 'oldFunc();');
    
    const result = await applyTransformations(testDir, []);
    
    assert.strictEqual(result.applied, false);
    assert.strictEqual(result.filesModified, 0);
    assert.strictEqual(result.replacementsMade, 0);
  });
  
  test('should create default rules file', async () => {
    const rulesPath = path.join(testDir, 'rules.json');
    
    await createDefaultRulesFile(rulesPath);
    
    // Verify file was created
    const content = await fs.readFile(rulesPath, 'utf-8');
    const rules = JSON.parse(content);
    
    assert.ok(Array.isArray(rules));
    assert.ok(rules.length > 0);
  });
});
