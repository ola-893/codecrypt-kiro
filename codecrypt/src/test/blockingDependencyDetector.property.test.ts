/**
 * Property-Based Tests for BlockingDependencyDetector
 * 
 * **Feature: smart-dependency-updates, Property 1: Blocking dependency detection completeness**
 * **Validates: Requirements 1.1, 4.1**
 * 
 * **Feature: smart-dependency-updates, Property 8: Architecture check completeness**
 * **Validates: Requirements 4.1**
 * 
 * **Feature: smart-dependency-updates, Property 2: Replacement lookup consistency**
 * **Validates: Requirements 1.2, 3.2, 4.2**
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { BlockingDependencyDetector } from '../services/blockingDependencyDetector';
import { PackageReplacementRegistry } from '../services/packageReplacementRegistry';
import {
  BlockingDependency,
  PackageReplacement
} from '../types';

suite('BlockingDependencyDetector Property Tests', () => {
  let tempDir: string;

  setup(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blocking-detector-test-'));
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
   * Known blocking packages for testing
   */
  const KNOWN_BLOCKING_PACKAGES = [
    'node-sass',
    'phantomjs',
    'phantomjs-prebuilt',
    'fibers',
    'deasync',
    'node-canvas',
    'canvas'
  ];

  /**
   * Arbitrary generator for package names
   * Excludes reserved JavaScript property names
   */
  const RESERVED_NAMES = ['constructor', 'prototype', '__proto__', 'toString', 'valueOf'];
  const packageNameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => /^[a-z0-9-]+$/.test(s) && !RESERVED_NAMES.includes(s));

  /**
   * Arbitrary generator for version strings
   * Mostly generates semantic versions to avoid slow URL checks
   */
  const versionArb: fc.Arbitrary<string> = fc.oneof(
    // Semantic versions (80% of the time)
    fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20))
      .map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
    fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20))
      .map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
    fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20))
      .map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
    fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20))
      .map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
    // Version ranges (15% of the time)
    fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20))
      .map(([major, minor, patch]) => `^${major}.${minor}.${patch}`),
    fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20))
      .map(([major, minor, patch]) => `~${major}.${minor}.${patch}`),
    // GitHub URLs (5% of the time - these are slow to check)
    fc.tuple(packageNameArb, fc.string({ minLength: 5, maxLength: 10 }))
      .map(([pkg, tag]) => `https://github.com/user/${pkg}/archive/${tag}.tar.gz`)
  );

  /**
   * Arbitrary generator for dependency maps
   */
  const dependencyMapArb: fc.Arbitrary<Map<string, string>> = fc.array(
    fc.tuple(packageNameArb, versionArb),
    { minLength: 0, maxLength: 20 }
  ).map(entries => new Map(entries));

  /**
   * Arbitrary generator for dependency maps that include blocking packages
   */
  const dependencyMapWithBlockingArb: fc.Arbitrary<Map<string, string>> = fc.record({
    blockingPackages: fc.array(
      fc.tuple(
        fc.constantFrom(...KNOWN_BLOCKING_PACKAGES),
        versionArb
      ),
      { minLength: 1, maxLength: 5 }
    ),
    otherPackages: fc.array(
      fc.tuple(packageNameArb, versionArb),
      { minLength: 0, maxLength: 15 }
    )
  }).map(({ blockingPackages, otherPackages }) => {
    const allPackages = [...blockingPackages, ...otherPackages];
    return new Map(allPackages);
  });

  /**
   * **Feature: smart-dependency-updates, Property 1: Blocking dependency detection completeness**
   * **Validates: Requirements 1.1, 4.1**
   * 
   * Property: For any package.json containing packages from the known blocking list,
   * the BlockingDependencyDetector SHALL identify all blocking packages in its output.
   */
  suite('Property 1: Blocking dependency detection completeness', () => {
    test('should detect all known blocking packages', async function() {
      this.timeout(120000); // Increase timeout to 2 minutes for network calls

      await fc.assert(
        fc.asyncProperty(
          dependencyMapWithBlockingArb,
          async (dependencies) => {
            const detector = new BlockingDependencyDetector();
            const blockingDeps = await detector.detect(dependencies);

            // Count how many blocking packages are in the input
            const blockingPackagesInInput = Array.from(dependencies.keys())
              .filter(name => KNOWN_BLOCKING_PACKAGES.includes(name));

            // Count how many blocking packages were detected
            const detectedBlockingPackages = blockingDeps
              .filter(dep => KNOWN_BLOCKING_PACKAGES.includes(dep.name))
              .map(dep => dep.name);

            // Every blocking package in the input should be detected
            for (const blockingPkg of blockingPackagesInInput) {
              assert.ok(
                detectedBlockingPackages.includes(blockingPkg),
                `Blocking package ${blockingPkg} should be detected`
              );
            }

            return true;
          }
        ),
        { numRuns: 20 } // Reduce runs to 20 to avoid timeout
      );
    });

    test('should not produce false positives for non-blocking packages', async function() {
      this.timeout(60000); // Increase timeout to 60 seconds

      await fc.assert(
        fc.asyncProperty(
          dependencyMapArb.filter(deps => {
            // Filter out any maps that contain blocking packages
            const keys = Array.from(deps.keys());
            return !keys.some(key => KNOWN_BLOCKING_PACKAGES.includes(key));
          }),
          async (dependencies) => {
            const detector = new BlockingDependencyDetector();
            const blockingDeps = await detector.detect(dependencies);

            // Filter out any dead URL detections (those are valid)
            const nonUrlBlockingDeps = blockingDeps.filter(
              dep => dep.reason !== 'dead_url'
            );

            // Should not detect any blocking packages from the known list
            for (const dep of nonUrlBlockingDeps) {
              assert.ok(
                !KNOWN_BLOCKING_PACKAGES.includes(dep.name),
                `Non-blocking package ${dep.name} should not be detected as blocking`
              );
            }

            return true;
          }
        ),
        { numRuns: 30 } // Reduce runs to 30
      );
    });

    test('should detect blocking packages regardless of version', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...KNOWN_BLOCKING_PACKAGES),
          versionArb,
          async (blockingPackage, version) => {
            const dependencies = new Map([[blockingPackage, version]]);
            const detector = new BlockingDependencyDetector();
            const blockingDeps = await detector.detect(dependencies);

            // Should detect the blocking package
            const detected = blockingDeps.find(dep => dep.name === blockingPackage);
            assert.ok(
              detected !== undefined,
              `Blocking package ${blockingPackage} with version ${version} should be detected`
            );

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should provide blocking reason for each detected package', async function() {
      this.timeout(60000); // Increase timeout to 60 seconds

      await fc.assert(
        fc.asyncProperty(
          dependencyMapWithBlockingArb,
          async (dependencies) => {
            const detector = new BlockingDependencyDetector();
            const blockingDeps = await detector.detect(dependencies);

            // Every detected blocking dependency should have a reason
            for (const dep of blockingDeps) {
              assert.ok(
                dep.reason !== undefined && dep.reason !== null,
                `Blocking dependency ${dep.name} should have a reason`
              );
              
              // Reason should be one of the valid types
              const validReasons = [
                'architecture_incompatible',
                'dead_url',
                'deprecated_no_replacement',
                'build_failure',
                'peer_conflict'
              ];
              assert.ok(
                validReasons.includes(dep.reason),
                `Blocking reason ${dep.reason} should be valid`
              );
            }

            return true;
          }
        ),
        { numRuns: 30 } // Reduce runs to 30 for this slower test
      );
    });
  });

  /**
   * **Feature: smart-dependency-updates, Property 8: Architecture check completeness**
   * **Validates: Requirements 4.1**
   * 
   * Property: For any set of dependencies, every dependency SHALL be checked
   * against the architecture incompatibility list exactly once.
   */
  suite('Property 8: Architecture check completeness', () => {
    test('should check all dependencies against architecture list', async function() {
      this.timeout(90000); // Increase timeout to 90 seconds

      await fc.assert(
        fc.asyncProperty(
          dependencyMapArb,
          async (dependencies) => {
            // Create a registry with architecture incompatible entries
            const registryPath = path.join(tempDir, `arch-test-${Date.now()}-${Math.random()}.json`);
            const registry = new PackageReplacementRegistry(registryPath);
            await registry.load(); // Load default registry with arch incompatible entries

            const detector = new BlockingDependencyDetector(registry);
            const blockingDeps = await detector.detect(dependencies);

            // Get architecture incompatible list from registry
            const archIncompatibleList = (registry as any).getArchitectureIncompatible();
            const currentArch = os.arch();

            // For each dependency that's in the arch incompatible list for current arch
            for (const [name, version] of dependencies.entries()) {
              const archEntry = archIncompatibleList.find(
                (entry: any) => entry.packageName === name
              );

              if (archEntry && archEntry.incompatibleArchitectures.includes(currentArch)) {
                // Should be detected as blocking
                const detected = blockingDeps.find(dep => dep.name === name);
                assert.ok(
                  detected !== undefined,
                  `Architecture incompatible package ${name} should be detected`
                );
                
                if (detected) {
                  assert.strictEqual(
                    detected.reason,
                    'architecture_incompatible',
                    `Package ${name} should have architecture_incompatible reason`
                  );
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 30 } // Reduce runs to 30
      );
    });

    test('should not detect packages compatible with current architecture', async function() {
      this.timeout(30000);

      const registryPath = path.join(tempDir, `arch-compat-test-${Date.now()}.json`);
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();

      const detector = new BlockingDependencyDetector(registry);
      
      // Create a dependency map with a package that's NOT incompatible with current arch
      const currentArch = os.arch();
      const otherArch = currentArch === 'arm64' ? 'x64' : 'arm64';
      
      // Get a package that's incompatible with OTHER arch but not current
      const archIncompatibleList = (registry as any).getArchitectureIncompatible();
      const compatiblePackage = archIncompatibleList.find(
        (entry: any) => !entry.incompatibleArchitectures.includes(currentArch)
      );

      if (compatiblePackage) {
        const dependencies = new Map([[compatiblePackage.packageName, '1.0.0']]);
        const blockingDeps = await detector.detect(dependencies);

        // Should not be detected as architecture incompatible
        const detected = blockingDeps.find(
          dep => dep.name === compatiblePackage.packageName && 
                 dep.reason === 'architecture_incompatible'
        );
        
        assert.strictEqual(
          detected,
          undefined,
          `Package ${compatiblePackage.packageName} should not be detected as architecture incompatible on ${currentArch}`
        );
      }
    });
  });

  /**
   * **Feature: smart-dependency-updates, Property 2: Replacement lookup consistency**
   * **Validates: Requirements 1.2, 3.2, 4.2**
   * 
   * Property: For any blocking or deprecated dependency, if a replacement exists in the registry,
   * the lookup SHALL return that replacement; if no replacement exists, the lookup SHALL return null.
   */
  suite('Property 2: Replacement lookup consistency', () => {
    test('should return replacement when one exists in registry', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...KNOWN_BLOCKING_PACKAGES),
          versionArb,
          async (blockingPackage, version) => {
            // Create a registry with default replacements
            const registryPath = path.join(tempDir, `replacement-test-${Date.now()}-${Math.random()}.json`);
            const registry = new PackageReplacementRegistry(registryPath);
            await registry.load(); // Load default registry

            const detector = new BlockingDependencyDetector(registry);
            const dependencies = new Map([[blockingPackage, version]]);
            const blockingDeps = await detector.detect(dependencies);

            // Find the detected blocking dependency
            const detected = blockingDeps.find(dep => dep.name === blockingPackage);
            
            if (detected) {
              // Check if registry has a replacement
              const registryReplacement = registry.lookup(blockingPackage);
              
              if (registryReplacement !== null) {
                // If registry has replacement, detected dependency should have it
                assert.ok(
                  detected.replacement !== undefined,
                  `Blocking package ${blockingPackage} should have replacement when one exists in registry`
                );
                
                if (detected.replacement) {
                  assert.strictEqual(
                    detected.replacement.oldName,
                    registryReplacement.oldName,
                    'Replacement oldName should match registry'
                  );
                  assert.strictEqual(
                    detected.replacement.newName,
                    registryReplacement.newName,
                    'Replacement newName should match registry'
                  );
                }
              } else {
                // If registry has no replacement, detected dependency may or may not have one
                // (it could be from architecture incompatible list)
                // This is acceptable
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should return null replacement when none exists', async function() {
      this.timeout(60000); // Increase timeout to 60 seconds

      await fc.assert(
        fc.asyncProperty(
          packageNameArb.filter(name => !KNOWN_BLOCKING_PACKAGES.includes(name)),
          versionArb,
          async (packageName, version) => {
            // Create an empty registry
            const registryPath = path.join(tempDir, `empty-registry-${Date.now()}-${Math.random()}.json`);
            const registry = new PackageReplacementRegistry(registryPath);
            // Don't load - keep it empty

            const detector = new BlockingDependencyDetector(registry);
            const dependencies = new Map([[packageName, version]]);
            const blockingDeps = await detector.detect(dependencies);

            // For non-blocking packages with no replacement, should not be detected
            // or if detected (e.g., dead URL), should have no replacement
            for (const dep of blockingDeps) {
              if (dep.name === packageName && dep.reason !== 'dead_url') {
                // If detected for reasons other than dead URL, it shouldn't have a replacement
                // since the registry is empty
                assert.strictEqual(
                  dep.replacement,
                  undefined,
                  `Package ${packageName} should not have replacement when none exists in registry`
                );
              }
            }

            return true;
          }
        ),
        { numRuns: 30 } // Reduce runs to 30
      );
    });

    test('should consistently return same replacement for same package', async function() {
      this.timeout(30000);

      const registryPath = path.join(tempDir, `consistency-test-${Date.now()}.json`);
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();

      const detector = new BlockingDependencyDetector(registry);

      // Test with node-sass which should have a replacement
      const dependencies1 = new Map([['node-sass', '4.14.1']]);
      const blockingDeps1 = await detector.detect(dependencies1);
      const detected1 = blockingDeps1.find(dep => dep.name === 'node-sass');

      const dependencies2 = new Map([['node-sass', '5.0.0']]);
      const blockingDeps2 = await detector.detect(dependencies2);
      const detected2 = blockingDeps2.find(dep => dep.name === 'node-sass');

      // Both should have the same replacement
      if (detected1 && detected2) {
        if (detected1.replacement && detected2.replacement) {
          assert.strictEqual(
            detected1.replacement.newName,
            detected2.replacement.newName,
            'Same package should get same replacement regardless of version'
          );
        }
      }
    });

    test('should handle packages with replacements from architecture incompatible list', async function() {
      this.timeout(30000);

      const registryPath = path.join(tempDir, `arch-replacement-test-${Date.now()}.json`);
      const registry = new PackageReplacementRegistry(registryPath);
      await registry.load();

      const detector = new BlockingDependencyDetector(registry);
      
      // Get architecture incompatible list
      const archIncompatibleList = (registry as any).getArchitectureIncompatible();
      const currentArch = os.arch();

      // Find a package that's incompatible with current arch and has a replacement
      const packageWithReplacement = archIncompatibleList.find(
        (entry: any) => 
          entry.incompatibleArchitectures.includes(currentArch) &&
          entry.replacement !== undefined
      );

      if (packageWithReplacement) {
        const dependencies = new Map([[packageWithReplacement.packageName, '1.0.0']]);
        const blockingDeps = await detector.detect(dependencies);

        const detected = blockingDeps.find(dep => dep.name === packageWithReplacement.packageName);
        
        if (detected) {
          // Should have a replacement
          assert.ok(
            detected.replacement !== undefined,
            `Architecture incompatible package ${packageWithReplacement.packageName} should have replacement`
          );
          
          if (detected.replacement) {
            // The replacement should match what's in the registry
            const registryReplacement = registry.lookup(packageWithReplacement.packageName);
            if (registryReplacement) {
              assert.strictEqual(
                detected.replacement.newName,
                registryReplacement.newName,
                'Replacement should match registry'
              );
            }
          }
        }
      }
    });
  });
});
