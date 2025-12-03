/**
 * Unit Tests for PackageReplacementRegistry
 * 
 * Tests registry loading, fallback behavior, and JSON validation
 * Requirements: 8.1, 8.5
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PackageReplacementRegistry } from '../services/packageReplacementRegistry';

suite('PackageReplacementRegistry Unit Tests', () => {
  let tempDir: string;

  setup(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'registry-unit-test-'));
  });

  teardown(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  suite('Registry Loading', () => {
    test('should load from valid JSON file', async () => {
      const registryPath = path.join(tempDir, 'valid-registry.json');
      
      // Create a valid registry file
      const validRegistry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [
          {
            oldName: 'test-package',
            newName: 'new-package',
            versionMapping: { '*': '^1.0.0' },
            requiresCodeChanges: false
          }
        ],
        architectureIncompatible: [],
        knownDeadUrls: []
      };
      
      await fs.writeFile(registryPath, JSON.stringify(validRegistry, null, 2), 'utf-8');
      
      // Load the registry
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();
      
      // Verify it loaded correctly
      const replacement = registry.lookup('test-package');
      assert.ok(replacement !== null, 'Replacement should exist');
      assert.strictEqual(replacement?.oldName, 'test-package');
      assert.strictEqual(replacement?.newName, 'new-package');
    });

    test('should fallback to default when file missing', async () => {
      const registryPath = path.join(tempDir, 'non-existent-registry.json');
      
      // Load the registry (file doesn't exist)
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();
      
      // Verify it loaded the default registry
      const nodeSassReplacement = registry.lookup('node-sass');
      assert.ok(nodeSassReplacement !== null, 'Default node-sass replacement should exist');
      assert.strictEqual(nodeSassReplacement?.newName, 'sass');
      
      const requestReplacement = registry.lookup('request');
      assert.ok(requestReplacement !== null, 'Default request replacement should exist');
      assert.strictEqual(requestReplacement?.newName, 'node-fetch');
    });

    test('should fallback to default when file is invalid JSON', async () => {
      const registryPath = path.join(tempDir, 'invalid-json.json');
      
      // Create an invalid JSON file
      await fs.writeFile(registryPath, '{ invalid json }', 'utf-8');
      
      // Load the registry
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();
      
      // Verify it loaded the default registry
      const nodeSassReplacement = registry.lookup('node-sass');
      assert.ok(nodeSassReplacement !== null, 'Default node-sass replacement should exist');
    });
  });

  suite('JSON Validation', () => {
    test('should reject registry with missing version field', async () => {
      const registryPath = path.join(tempDir, 'no-version.json');
      
      // Create registry without version
      const invalidRegistry = {
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: []
      };
      
      await fs.writeFile(registryPath, JSON.stringify(invalidRegistry, null, 2), 'utf-8');
      
      // Load the registry
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();
      
      // Should fallback to default
      const nodeSassReplacement = registry.lookup('node-sass');
      assert.ok(nodeSassReplacement !== null, 'Should fallback to default registry');
    });

    test('should reject registry with non-array replacements', async () => {
      const registryPath = path.join(tempDir, 'invalid-replacements.json');
      
      // Create registry with invalid replacements
      const invalidRegistry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: 'not an array',
        architectureIncompatible: [],
        knownDeadUrls: []
      };
      
      await fs.writeFile(registryPath, JSON.stringify(invalidRegistry, null, 2), 'utf-8');
      
      // Load the registry
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();
      
      // Should fallback to default
      const nodeSassReplacement = registry.lookup('node-sass');
      assert.ok(nodeSassReplacement !== null, 'Should fallback to default registry');
    });

    test('should reject replacement with missing required fields', async () => {
      const registryPath = path.join(tempDir, 'incomplete-replacement.json');
      
      // Create registry with incomplete replacement
      const invalidRegistry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [
          {
            oldName: 'test-package',
            // Missing newName, versionMapping, requiresCodeChanges
          }
        ],
        architectureIncompatible: [],
        knownDeadUrls: []
      };
      
      await fs.writeFile(registryPath, JSON.stringify(invalidRegistry, null, 2), 'utf-8');
      
      // Load the registry
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();
      
      // Should fallback to default
      const nodeSassReplacement = registry.lookup('node-sass');
      assert.ok(nodeSassReplacement !== null, 'Should fallback to default registry');
    });

    test('should accept valid registry with all fields', async () => {
      const registryPath = path.join(tempDir, 'complete-registry.json');
      
      // Create a complete valid registry
      const validRegistry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [
          {
            oldName: 'old-package',
            newName: 'new-package',
            versionMapping: { '1.0.0': '2.0.0', '*': '^2.0.0' },
            requiresCodeChanges: true,
            codeChangeDescription: 'Update API calls',
            importMappings: { 'old/path': 'new/path' }
          }
        ],
        architectureIncompatible: [
          {
            packageName: 'native-package',
            incompatibleArchitectures: ['arm64'],
            replacement: 'pure-js-package',
            reason: 'Native bindings not available'
          }
        ],
        knownDeadUrls: ['github.com/old/repo']
      };
      
      await fs.writeFile(registryPath, JSON.stringify(validRegistry, null, 2), 'utf-8');
      
      // Load the registry
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();
      
      // Verify it loaded correctly
      const replacement = registry.lookup('old-package');
      assert.ok(replacement !== null, 'Replacement should exist');
      assert.strictEqual(replacement?.oldName, 'old-package');
      assert.strictEqual(replacement?.newName, 'new-package');
      assert.strictEqual(replacement?.requiresCodeChanges, true);
      assert.strictEqual(replacement?.codeChangeDescription, 'Update API calls');
      assert.deepStrictEqual(replacement?.importMappings, { 'old/path': 'new/path' });
    });
  });

  suite('Registry Operations', () => {
    test('should return null for non-existent package', async () => {
      const registry = new PackageReplacementRegistry();
      await registry.load();
      
      const replacement = registry.lookup('non-existent-package');
      assert.strictEqual(replacement, null, 'Should return null for non-existent package');
    });

    test('should add new replacement', async () => {
      const registry = new PackageReplacementRegistry();
      await registry.load();
      
      registry.add({
        oldName: 'custom-package',
        newName: 'modern-package',
        versionMapping: { '*': '^3.0.0' },
        requiresCodeChanges: false
      });
      
      const replacement = registry.lookup('custom-package');
      assert.ok(replacement !== null, 'Added replacement should exist');
      assert.strictEqual(replacement?.newName, 'modern-package');
    });

    test('should replace existing replacement when adding duplicate', async () => {
      const registry = new PackageReplacementRegistry();
      await registry.load();
      
      // Add first replacement
      registry.add({
        oldName: 'test-package',
        newName: 'first-replacement',
        versionMapping: { '*': '^1.0.0' },
        requiresCodeChanges: false
      });
      
      // Add second replacement with same original package
      registry.add({
        oldName: 'test-package',
        newName: 'second-replacement',
        versionMapping: { '*': '^2.0.0' },
        requiresCodeChanges: true
      });
      
      const replacement = registry.lookup('test-package');
      assert.ok(replacement !== null, 'Replacement should exist');
      assert.strictEqual(replacement?.newName, 'second-replacement', 'Should use latest replacement');
      assert.strictEqual(replacement?.requiresCodeChanges, true);
    });

    test('should get all replacements', async () => {
      const registry = new PackageReplacementRegistry();
      await registry.load();
      
      const allReplacements = registry.getAll();
      assert.ok(Array.isArray(allReplacements), 'Should return an array');
      assert.ok(allReplacements.length >= 2, 'Should have at least default replacements');
      
      // Verify default replacements are present
      const hasNodeSass = allReplacements.some(r => r.oldName === 'node-sass');
      const hasRequest = allReplacements.some(r => r.oldName === 'request');
      assert.ok(hasNodeSass, 'Should include node-sass replacement');
      assert.ok(hasRequest, 'Should include request replacement');
    });
  });

  suite('Registry Persistence', () => {
    test('should save and reload registry', async () => {
      const registryPath = path.join(tempDir, 'save-test.json');
      
      // Create and populate registry
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();
      
      registry.add({
        oldName: 'save-test-package',
        newName: 'save-test-replacement',
        versionMapping: { '*': '^1.0.0' },
        requiresCodeChanges: false
      });
      
      await registry.save();
      
      // Load in a new registry instance
      const reloadedRegistry = new PackageReplacementRegistry(registryPath);
      await reloadedRegistry.load();
      
      const replacement = reloadedRegistry.lookup('save-test-package');
      assert.ok(replacement !== null, 'Saved replacement should exist after reload');
      assert.strictEqual(replacement?.newName, 'save-test-replacement');
    });

    test('should update lastUpdated timestamp on save', async () => {
      const registryPath = path.join(tempDir, 'timestamp-test.json');
      
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();
      
      const beforeSave = new Date();
      await registry.save();
      
      // Read the file and check timestamp
      const content = await fs.readFile(registryPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      assert.ok(parsed.lastUpdated, 'lastUpdated should exist');
      const lastUpdated = new Date(parsed.lastUpdated);
      assert.ok(lastUpdated >= beforeSave, 'lastUpdated should be recent');
    });
  });
});
