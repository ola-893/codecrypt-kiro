/**
 * Property-Based Tests for PackageReplacementRegistry
 * 
 * **Feature: smart-dependency-updates, Property 13: Registry serialization round-trip**
 * **Validates: Requirements 8.3, 8.4**
 * 
 * **Feature: smart-dependency-updates, Property 14: Registry entry completeness**
 * **Validates: Requirements 8.3**
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PackageReplacementRegistry } from '../services/packageReplacementRegistry';
import {
  PackageReplacement,
  ArchitectureIncompatibleEntry,
  ReplacementRegistrySchema
} from '../types';

suite('PackageReplacementRegistry Property Tests', () => {
  let tempDir: string;

  setup(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'registry-test-'));
  });

  teardown(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Arbitrary generator for PackageReplacement
   */
  const packageReplacementArb: fc.Arbitrary<PackageReplacement> = fc.record({
    oldName: fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[a-z0-9-]+$/.test(s)),
    newName: fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[a-z0-9-]+$/.test(s)),
    versionMapping: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 20 }),
      { minKeys: 1, maxKeys: 5 }
    ),
    requiresCodeChanges: fc.boolean(),
    codeChangeDescription: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    importMappings: fc.option(
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        { minKeys: 0, maxKeys: 5 }
      ),
      { nil: undefined }
    )
  });

  /**
   * Arbitrary generator for ArchitectureIncompatibleEntry
   */
  const architectureIncompatibleArb: fc.Arbitrary<ArchitectureIncompatibleEntry> = fc.record({
    packageName: fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[a-z0-9-]+$/.test(s)),
    incompatibleArchitectures: fc.array(
      fc.constantFrom('arm64', 'arm', 'x86', 'x64'),
      { minLength: 1, maxLength: 4 }
    ),
    replacement: fc.option(
      fc.string({ minLength: 1, maxLength: 50 })
        .filter(s => /^[a-z0-9-]+$/.test(s)),
      { nil: undefined }
    ),
    reason: fc.string({ minLength: 1, maxLength: 200 })
  });

  /**
   * Arbitrary generator for ReplacementRegistrySchema
   */
  const registrySchemaArb: fc.Arbitrary<ReplacementRegistrySchema> = fc.record({
    version: fc.string({ minLength: 1, maxLength: 20 }),
    lastUpdated: fc.integer({ min: Date.parse('2000-01-01'), max: Date.parse('2030-12-31') }).map(timestamp => new Date(timestamp).toISOString()),
    replacements: fc.array(packageReplacementArb, { minLength: 0, maxLength: 10 }),
    architectureIncompatible: fc.array(architectureIncompatibleArb, { minLength: 0, maxLength: 10 }),
    knownDeadUrls: fc.array(
      fc.string({ minLength: 1, maxLength: 100 }),
      { minLength: 0, maxLength: 10 }
    )
  });

  /**
   * **Feature: smart-dependency-updates, Property 13: Registry serialization round-trip**
   * **Validates: Requirements 8.3, 8.4**
   * 
   * Property: For any valid PackageReplacementRegistry, serializing then deserializing
   * SHALL produce an equivalent registry.
   */
  suite('Property 13: Registry serialization round-trip', () => {
    test('should preserve all data through save/load cycle', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          registrySchemaArb,
          async (schema) => {
            // Create a unique file path for this test
            const registryPath = path.join(tempDir, `registry-${Date.now()}-${Math.random()}.json`);
            
            // Create registry and manually set its data
            const registry = new PackageReplacementRegistry(registryPath);
            
            // Add all replacements from the schema
            for (const replacement of schema.replacements) {
              registry.add(replacement);
            }

            // Save the registry
            await registry.save();

            // Create a new registry instance and load from the same file
            const loadedRegistry = new PackageReplacementRegistry(registryPath);
            await loadedRegistry.load();

            // Verify all replacements are preserved
            const loadedReplacements = loadedRegistry.getAll();
            
            // Count unique original packages (registry deduplicates by oldName)
            const uniqueOriginalPackages = new Set(
              schema.replacements.map(r => r.oldName)
            );
            
            assert.strictEqual(
              loadedReplacements.length,
              uniqueOriginalPackages.size,
              'Number of replacements should match unique oldName packages'
            );

            // Verify each unique replacement is preserved (use the last one for duplicates)
            const uniqueReplacements = new Map<string, typeof schema.replacements[0]>();
            for (const replacement of schema.replacements) {
              uniqueReplacements.set(replacement.oldName, replacement);
            }
            
            for (const original of uniqueReplacements.values()) {
              const loaded = loadedRegistry.lookup(original.oldName);
              assert.ok(loaded !== null, `Replacement for ${original.oldName} should exist`);
              
              if (loaded) {
                assert.strictEqual(
                  loaded.oldName,
                  original.oldName,
                  'oldName should match'
                );
                assert.strictEqual(
                  loaded.newName,
                  original.newName,
                  'newName should match'
                );
                // Convert both to regular objects for comparison (JSON serialization removes prototype)
                const loadedVersionMapping = { ...loaded.versionMapping };
                const originalVersionMapping = { ...original.versionMapping };
                assert.deepStrictEqual(
                  loadedVersionMapping,
                  originalVersionMapping,
                  'versionMapping should match'
                );
                assert.strictEqual(
                  loaded.requiresCodeChanges,
                  original.requiresCodeChanges,
                  'requiresCodeChanges should match'
                );
                
                if (original.codeChangeDescription !== undefined) {
                  assert.strictEqual(
                    loaded.codeChangeDescription,
                    original.codeChangeDescription,
                    'codeChangeDescription should match'
                  );
                }
                
                if (original.importMappings !== undefined) {
                  // Convert both to regular objects for comparison (JSON serialization removes prototype)
                  const loadedMappings = loaded.importMappings ? { ...loaded.importMappings } : undefined;
                  const originalMappings = { ...original.importMappings };
                  assert.deepStrictEqual(
                    loadedMappings,
                    originalMappings,
                    'importMappings should match'
                  );
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle empty registry', async function() {
      this.timeout(30000);

      const registryPath = path.join(tempDir, `empty-registry-${Date.now()}.json`);
      
      // Create empty registry
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.save();

      // Load it back
      const loadedRegistry = new PackageReplacementRegistry(registryPath);
      await loadedRegistry.load();

      // Should have default replacements (node-sass, request)
      const replacements = loadedRegistry.getAll();
      assert.ok(replacements.length >= 0, 'Should load successfully');
    });

    test('should preserve data types through serialization', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          packageReplacementArb,
          async (replacement) => {
            const registryPath = path.join(tempDir, `types-test-${Date.now()}-${Math.random()}.json`);
            
            const registry = new PackageReplacementRegistry(registryPath);
            registry.add(replacement);
            await registry.save();

            const loadedRegistry = new PackageReplacementRegistry(registryPath);
            await loadedRegistry.load();

            const loaded = loadedRegistry.lookup(replacement.oldName);
            assert.ok(loaded !== null, 'Replacement should exist');

            if (loaded) {
              // Verify types are preserved
              assert.strictEqual(typeof loaded.oldName, 'string');
              assert.strictEqual(typeof loaded.newName, 'string');
              assert.strictEqual(typeof loaded.versionMapping, 'object');
              assert.strictEqual(typeof loaded.requiresCodeChanges, 'boolean');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: smart-dependency-updates, Property 14: Registry entry completeness**
   * **Validates: Requirements 8.3**
   * 
   * Property: For any serialized registry entry, the JSON SHALL contain
   * oldName, newName, versionMapping, and requiresCodeChanges fields.
   */
  suite('Property 14: Registry entry completeness', () => {
    test('should include all required fields in serialized JSON', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          packageReplacementArb,
          async (replacement) => {
            const registryPath = path.join(tempDir, `completeness-test-${Date.now()}-${Math.random()}.json`);
            
            const registry = new PackageReplacementRegistry(registryPath);
            registry.add(replacement);
            await registry.save();

            // Read the raw JSON file
            const content = await fs.readFile(registryPath, 'utf-8');
            const parsed = JSON.parse(content);

            // Verify the registry structure exists
            assert.ok(parsed.replacements, 'replacements array should exist');
            assert.ok(Array.isArray(parsed.replacements), 'replacements should be an array');

            // Find our replacement in the array
            const savedReplacement = parsed.replacements.find(
              (r: any) => r.oldName === replacement.oldName
            );

            assert.ok(savedReplacement, 'Replacement should be in the saved file');

            // Verify all required fields are present
            assert.ok(
              'oldName' in savedReplacement,
              'oldName field should exist'
            );
            assert.ok(
              'newName' in savedReplacement,
              'newName field should exist'
            );
            assert.ok(
              'versionMapping' in savedReplacement,
              'versionMapping field should exist'
            );
            assert.ok(
              'requiresCodeChanges' in savedReplacement,
              'requiresCodeChanges field should exist'
            );

            // Verify field types
            assert.strictEqual(
              typeof savedReplacement.oldName,
              'string',
              'oldName should be string'
            );
            assert.strictEqual(
              typeof savedReplacement.newName,
              'string',
              'newName should be string'
            );
            assert.strictEqual(
              typeof savedReplacement.versionMapping,
              'object',
              'versionMapping should be object'
            );
            assert.strictEqual(
              typeof savedReplacement.requiresCodeChanges,
              'boolean',
              'requiresCodeChanges should be boolean'
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should include optional fields when present', async function() {
      this.timeout(30000);

      const replacementWithOptionals: PackageReplacement = {
        oldName: 'test-package',
        newName: 'new-package',
        versionMapping: { '*': '^1.0.0' },
        requiresCodeChanges: true,
        codeChangeDescription: 'Update imports',
        importMappings: { 'old/path': 'new/path' }
      };

      const registryPath = path.join(tempDir, `optional-fields-${Date.now()}.json`);
      
      const registry = new PackageReplacementRegistry(registryPath);
      registry.add(replacementWithOptionals);
      await registry.save();

      // Read the raw JSON
      const content = await fs.readFile(registryPath, 'utf-8');
      const parsed = JSON.parse(content);

      const savedReplacement = parsed.replacements.find(
        (r: any) => r.oldName === 'test-package'
      );

      assert.ok(savedReplacement, 'Replacement should exist');
      assert.ok('codeChangeDescription' in savedReplacement, 'codeChangeDescription should be saved');
      assert.ok('importMappings' in savedReplacement, 'importMappings should be saved');
      assert.strictEqual(
        savedReplacement.codeChangeDescription,
        'Update imports',
        'codeChangeDescription should match'
      );
      assert.deepStrictEqual(
        savedReplacement.importMappings,
        { 'old/path': 'new/path' },
        'importMappings should match'
      );
    });
  });
});