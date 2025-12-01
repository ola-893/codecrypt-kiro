/**
 * Property-Based Tests for FixStrategyEngine
 * 
 * **Feature: post-resurrection-validation, Property 3: Fix Strategy Application**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 4.4**
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FixStrategyEngine, createFixStrategyEngine } from '../services/fixStrategyEngine';
import {
  AnalyzedError,
  FixHistory,
  FixStrategy,
  PostResurrectionErrorCategory,
  DEFAULT_FIX_STRATEGIES,
  NATIVE_MODULE_ALTERNATIVES
} from '../types';

suite('FixStrategyEngine Property Tests', () => {
  let engine: FixStrategyEngine;
  let tempDir: string;

  setup(() => {
    engine = createFixStrategyEngine();
    // Create a temp directory for testing file operations
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-strategy-test-'));
  });

  teardown(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Helper to create a basic package.json in temp dir
  function createPackageJson(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}): void {
    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: deps,
      devDependencies: devDeps
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  }

  // Generator for error categories that have fix strategies
  const errorCategoryWithStrategiesArb = fc.constantFrom<PostResurrectionErrorCategory>(
    'dependency_version_conflict',
    'peer_dependency_conflict',
    'native_module_failure',
    'lockfile_conflict',
    'git_dependency_failure'
  );


  // Generator for package names
  const packageNameArb = fc.oneof(
    fc.constantFrom('lodash', 'express', 'react', 'axios', 'moment', 'webpack'),
    fc.tuple(
      fc.constantFrom('@types', '@babel', '@testing-library'),
      fc.constantFrom('node', 'core', 'react')
    ).map(([scope, name]) => `${scope}/${name}`)
  );

  // Generator for version strings
  const versionArb = fc.oneof(
    fc.constantFrom('^17.0.0', '>=4.0.0', '~5.0.0', '18.0.0', 'latest', '*'),
    fc.tuple(
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 0, max: 20 }),
      fc.integer({ min: 0, max: 20 })
    ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`)
  );

  // Generator for analyzed errors
  const analyzedErrorArb = fc.record({
    category: errorCategoryWithStrategiesArb,
    message: fc.string({ minLength: 1, maxLength: 200 }),
    packageName: fc.option(packageNameArb, { nil: undefined }),
    versionConstraint: fc.option(versionArb, { nil: undefined }),
    conflictingPackages: fc.option(fc.array(packageNameArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
    priority: fc.integer({ min: 10, max: 100 })
  }) as fc.Arbitrary<AnalyzedError>;

  // Generator for empty fix history
  const emptyFixHistoryArb = fc.constant<FixHistory>({
    repoId: 'test-repo',
    fixes: [],
    lastResurrection: new Date()
  });

  /**
   * **Feature: post-resurrection-validation, Property 3: Fix Strategy Application**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 4.4**
   * 
   * Property: For any analyzed error with a known category:
   * 1. The Fix Strategy Engine should select at least one fix strategy
   * 2. If the fix fails, an alternative strategy should be attempted
   */
  suite('Property 3: Fix Strategy Application', () => {

    test('should select a valid strategy for any error with known category', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          analyzedErrorArb,
          emptyFixHistoryArb,
          (error, history) => {
            const strategy = engine.selectStrategy(error, history);

            // 1. Strategy should be defined
            assert.ok(strategy, 'Should select a strategy');

            // 2. Strategy should have a valid type
            const validTypes = [
              'adjust_version',
              'legacy_peer_deps',
              'remove_lockfile',
              'substitute_package',
              'remove_package',
              'add_resolution',
              'force_install'
            ];
            assert.ok(
              validTypes.includes(strategy.type),
              `Strategy type "${strategy.type}" should be valid`
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return different strategies on subsequent calls after marking as attempted', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          analyzedErrorArb,
          emptyFixHistoryArb,
          (error, history) => {
            // Reset attempted strategies for clean test
            engine.resetAttemptedStrategies();

            // Get available strategies for this error
            const allStrategies = engine.getAlternativeStrategies(error);
            
            if (allStrategies.length <= 1) {
              // Skip if only one strategy available
              return true;
            }

            // Get first strategy
            const firstStrategy = engine.selectStrategy(error, history);
            engine.markStrategyAttempted(error, firstStrategy);

            // Get second strategy
            const secondStrategy = engine.selectStrategy(error, history);

            // Strategies should be different (unless all have been tried)
            if (engine.hasUntriedStrategies(error)) {
              assert.notDeepStrictEqual(
                firstStrategy,
                secondStrategy,
                'Should select different strategy after first is marked as attempted'
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });


    test('should prioritize historical fixes when available', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          analyzedErrorArb,
          (error) => {
            // Reset for clean test
            engine.resetAttemptedStrategies();

            // Create a history with a known fix for this error
            const historicalStrategy: FixStrategy = { type: 'force_install' };
            const historyWithFix: FixHistory = {
              repoId: 'test-repo',
              fixes: [{
                errorPattern: `${error.category}:${error.packageName || 'none'}`,
                strategy: historicalStrategy,
                successCount: 5,
                lastUsed: new Date()
              }],
              lastResurrection: new Date()
            };

            const selectedStrategy = engine.selectStrategy(error, historyWithFix);

            // Should select the historical strategy
            assert.strictEqual(
              selectedStrategy.type,
              historicalStrategy.type,
              'Should prioritize historical fix'
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should correctly track untried strategies', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          analyzedErrorArb,
          emptyFixHistoryArb,
          (error, history) => {
            // Reset for clean test
            engine.resetAttemptedStrategies();

            const allStrategies = engine.getAlternativeStrategies(error);
            
            // Initially should have untried strategies
            assert.ok(
              engine.hasUntriedStrategies(error),
              'Should have untried strategies initially'
            );

            // Mark all strategies as attempted
            for (const strategy of allStrategies) {
              engine.markStrategyAttempted(error, strategy);
            }

            // Now should have no untried strategies
            assert.ok(
              !engine.hasUntriedStrategies(error),
              'Should have no untried strategies after all are attempted'
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should apply version adjustment correctly to package.json', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          packageNameArb,
          versionArb,
          versionArb,
          async (packageName, oldVersion, newVersion) => {
            // Create package.json with the package
            createPackageJson({ [packageName]: oldVersion });

            const strategy: FixStrategy = {
              type: 'adjust_version',
              package: packageName,
              newVersion
            };

            const result = await engine.applyFix(tempDir, strategy);

            // Should succeed
            assert.ok(result.success, `Should apply version adjustment: ${result.error}`);

            // Verify package.json was updated
            const updatedPkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
            assert.strictEqual(
              updatedPkg.dependencies[packageName],
              newVersion,
              'Package version should be updated'
            );

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should apply legacy-peer-deps correctly', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Create empty package.json
            createPackageJson();

            const strategy: FixStrategy = { type: 'legacy_peer_deps' };
            const result = await engine.applyFix(tempDir, strategy);

            // Should succeed
            assert.ok(result.success, `Should apply legacy-peer-deps: ${result.error}`);

            // Verify .npmrc was created/updated
            const npmrcPath = path.join(tempDir, '.npmrc');
            assert.ok(fs.existsSync(npmrcPath), '.npmrc should exist');
            
            const npmrcContent = fs.readFileSync(npmrcPath, 'utf-8');
            assert.ok(
              npmrcContent.includes('legacy-peer-deps=true'),
              '.npmrc should contain legacy-peer-deps=true'
            );

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });


    test('should remove lockfile correctly', async function() {
      this.timeout(30000);

      const lockfileArb = fc.constantFrom('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml');

      await fc.assert(
        fc.asyncProperty(
          lockfileArb,
          async (lockfile) => {
            // Create package.json and lockfile
            createPackageJson();
            fs.writeFileSync(path.join(tempDir, lockfile), '{}');

            const strategy: FixStrategy = { type: 'remove_lockfile', lockfile };
            const result = await engine.applyFix(tempDir, strategy);

            // Should succeed
            assert.ok(result.success, `Should remove lockfile: ${result.error}`);

            // Verify lockfile was removed
            assert.ok(
              !fs.existsSync(path.join(tempDir, lockfile)),
              `Lockfile ${lockfile} should be removed`
            );

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should substitute package correctly', async function() {
      this.timeout(30000);

      // Use known native module alternatives
      const substitutionArb = fc.constantFrom(
        { original: 'bcrypt', replacement: 'bcryptjs' },
        { original: 'node-sass', replacement: 'sass' }
      );

      await fc.assert(
        fc.asyncProperty(
          substitutionArb,
          versionArb,
          async ({ original, replacement }, version) => {
            // Create package.json with the original package
            createPackageJson({ [original]: version });

            const strategy: FixStrategy = {
              type: 'substitute_package',
              original,
              replacement
            };

            const result = await engine.applyFix(tempDir, strategy);

            // Should succeed
            assert.ok(result.success, `Should substitute package: ${result.error}`);

            // Verify package.json was updated
            const updatedPkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
            
            // Original should be removed
            assert.ok(
              !updatedPkg.dependencies[original],
              `Original package ${original} should be removed`
            );
            
            // Replacement should be added
            assert.ok(
              updatedPkg.dependencies[replacement],
              `Replacement package ${replacement} should be added`
            );

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should remove package correctly', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          packageNameArb,
          versionArb,
          async (packageName, version) => {
            // Create package.json with the package
            createPackageJson({ [packageName]: version });

            const strategy: FixStrategy = {
              type: 'remove_package',
              package: packageName
            };

            const result = await engine.applyFix(tempDir, strategy);

            // Should succeed
            assert.ok(result.success, `Should remove package: ${result.error}`);

            // Verify package was removed
            const updatedPkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
            assert.ok(
              !updatedPkg.dependencies[packageName],
              `Package ${packageName} should be removed`
            );

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should add resolution correctly', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          packageNameArb,
          versionArb,
          async (packageName, version) => {
            // Create package.json
            createPackageJson();

            const strategy: FixStrategy = {
              type: 'add_resolution',
              package: packageName,
              version
            };

            const result = await engine.applyFix(tempDir, strategy);

            // Should succeed
            assert.ok(result.success, `Should add resolution: ${result.error}`);

            // Verify resolutions and overrides were added
            const updatedPkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
            
            assert.strictEqual(
              updatedPkg.resolutions[packageName],
              version,
              'Resolution should be added'
            );
            
            assert.strictEqual(
              updatedPkg.overrides[packageName],
              version,
              'Override should be added'
            );

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should apply force install correctly', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Create empty package.json
            createPackageJson();

            const strategy: FixStrategy = { type: 'force_install' };
            const result = await engine.applyFix(tempDir, strategy);

            // Should succeed
            assert.ok(result.success, `Should apply force install: ${result.error}`);

            // Verify .npmrc was created/updated
            const npmrcPath = path.join(tempDir, '.npmrc');
            assert.ok(fs.existsSync(npmrcPath), '.npmrc should exist');
            
            const npmrcContent = fs.readFileSync(npmrcPath, 'utf-8');
            assert.ok(
              npmrcContent.includes('force=true'),
              '.npmrc should contain force=true'
            );

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should handle missing package.json gracefully', async function() {
      this.timeout(30000);

      const strategyArb = fc.oneof(
        fc.constant<FixStrategy>({ type: 'adjust_version', package: 'test', newVersion: '1.0.0' }),
        fc.constant<FixStrategy>({ type: 'remove_package', package: 'test' }),
        fc.constant<FixStrategy>({ type: 'substitute_package', original: 'test', replacement: 'test2' }),
        fc.constant<FixStrategy>({ type: 'add_resolution', package: 'test', version: '1.0.0' })
      );

      await fc.assert(
        fc.asyncProperty(
          strategyArb,
          async (strategy) => {
            // Don't create package.json - use empty temp dir
            const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-strategy-empty-'));
            
            try {
              const result = await engine.applyFix(emptyDir, strategy);

              // Should fail gracefully
              assert.ok(!result.success, 'Should fail when package.json is missing');
              assert.ok(result.error, 'Should have error message');
              assert.ok(
                result.error!.includes('package.json'),
                'Error should mention package.json'
              );
            } finally {
              fs.rmSync(emptyDir, { recursive: true, force: true });
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should handle package not found in package.json gracefully', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          packageNameArb,
          async (packageName) => {
            // Create package.json WITHOUT the package
            createPackageJson({ 'other-package': '1.0.0' });

            const strategy: FixStrategy = {
              type: 'adjust_version',
              package: packageName,
              newVersion: '2.0.0'
            };

            const result = await engine.applyFix(tempDir, strategy);

            // Should fail gracefully (package not found)
            assert.ok(!result.success, 'Should fail when package not in package.json');
            assert.ok(result.error, 'Should have error message');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
