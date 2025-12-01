/**
 * Property-Based Tests for FixHistoryStore
 * 
 * **Feature: post-resurrection-validation, Property 5: Fix History Persistence**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FixHistoryStore, createFixHistoryStore } from '../services/fixHistoryStore';
import {
  FixStrategy,
  FixHistory,
  HistoricalFix,
  PostResurrectionErrorCategory
} from '../types';

suite('FixHistoryStore Property Tests', () => {
  let store: FixHistoryStore;
  let tempDir: string;

  setup(() => {
    // Create a temp directory for testing file operations
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-history-test-'));
    store = createFixHistoryStore(tempDir);
  });

  teardown(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Generator for error categories
  const errorCategoryArb = fc.constantFrom<PostResurrectionErrorCategory>(
    'dependency_not_found',
    'dependency_version_conflict',
    'peer_dependency_conflict',
    'native_module_failure',
    'lockfile_conflict',
    'git_dependency_failure',
    'syntax_error',
    'type_error',
    'unknown'
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

  // Generator for fix strategies
  const fixStrategyArb: fc.Arbitrary<FixStrategy> = fc.oneof(
    fc.record({
      type: fc.constant('adjust_version' as const),
      package: packageNameArb,
      newVersion: versionArb
    }),
    fc.constant({ type: 'legacy_peer_deps' as const }),
    fc.record({
      type: fc.constant('remove_lockfile' as const),
      lockfile: fc.constantFrom('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml')
    }),
    fc.record({
      type: fc.constant('substitute_package' as const),
      original: packageNameArb,
      replacement: packageNameArb
    }),
    fc.record({
      type: fc.constant('remove_package' as const),
      package: packageNameArb
    }),
    fc.record({
      type: fc.constant('add_resolution' as const),
      package: packageNameArb,
      version: versionArb
    }),
    fc.constant({ type: 'force_install' as const })
  );

  // Generator for error patterns
  const errorPatternArb = fc.tuple(errorCategoryArb, fc.option(packageNameArb, { nil: undefined }))
    .map(([category, pkg]) => `${category}:${pkg || 'none'}`);

  // Generator for repo IDs
  const repoIdArb = fc.oneof(
    fc.constantFrom('test-repo', 'my-project', 'awesome-lib'),
    fc.string({ minLength: 8, maxLength: 12 }).map((h: string) => `repo-${h.replace(/[^a-zA-Z0-9]/g, 'x')}`)
  );

  /**
   * **Feature: post-resurrection-validation, Property 5: Fix History Persistence**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
   * 
   * Property: For any successful fix:
   * 1. The error pattern and strategy should be recorded (6.1)
   * 2. When the same error pattern is encountered, the previously successful strategy should be prioritized (6.2)
   * 3. Fix history should be stored for the repository (6.3)
   * 4. Reports should include all fixes applied (6.4)
   * 5. Same repository resurrections should apply learned fixes proactively (6.5)
   */
  suite('Property 5: Fix History Persistence', () => {

    test('should record and retrieve successful fixes (6.1, 6.2)', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          repoIdArb,
          errorPatternArb,
          fixStrategyArb,
          (repoId, errorPattern, strategy) => {
            // Clear store for clean test
            store.clearAll();

            // Record a fix
            store.recordFix(repoId, errorPattern, strategy);

            // Retrieve the fix
            const retrievedFix = store.getSuccessfulFix(errorPattern);

            // Should retrieve the same strategy type
            assert.ok(retrievedFix, 'Should retrieve recorded fix');
            assert.strictEqual(
              retrievedFix!.type,
              strategy.type,
              'Retrieved strategy type should match recorded'
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should increment success count on repeated fixes (6.1)', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          repoIdArb,
          errorPatternArb,
          fixStrategyArb,
          fc.integer({ min: 2, max: 10 }),
          (repoId, errorPattern, strategy, repeatCount) => {
            // Clear store for clean test
            store.clearAll();

            // Record the same fix multiple times
            for (let i = 0; i < repeatCount; i++) {
              store.recordFix(repoId, errorPattern, strategy);
            }

            // Get history and check success count
            const history = store.getHistory(repoId);
            const fix = history.fixes.find(f => f.errorPattern === errorPattern);

            assert.ok(fix, 'Fix should be in history');
            assert.strictEqual(
              fix!.successCount,
              repeatCount,
              `Success count should be ${repeatCount}`
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should store fix history per repository (6.3)', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          fc.array(repoIdArb, { minLength: 2, maxLength: 5 }),
          errorPatternArb,
          fixStrategyArb,
          (repoIds, errorPattern, strategy) => {
            // Clear store for clean test
            store.clearAll();

            // Ensure unique repo IDs
            const uniqueRepoIds = [...new Set(repoIds)];
            if (uniqueRepoIds.length < 2) {
              return true; // Skip if not enough unique IDs
            }

            // Record fix for each repo
            for (const repoId of uniqueRepoIds) {
              store.recordFix(repoId, errorPattern, strategy);
            }

            // Each repo should have its own history
            for (const repoId of uniqueRepoIds) {
              const history = store.getHistory(repoId);
              assert.strictEqual(history.repoId, repoId, 'History should have correct repoId');
              assert.ok(history.fixes.length > 0, 'History should have fixes');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should prioritize fixes by success count (6.2, 6.5)', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          repoIdArb,
          fc.array(
            fc.tuple(errorPatternArb, fixStrategyArb, fc.integer({ min: 1, max: 20 })),
            { minLength: 2, maxLength: 5 }
          ),
          (repoId, fixesWithCounts) => {
            // Clear store for clean test
            store.clearAll();

            // Record fixes with different success counts
            for (const [errorPattern, strategy, count] of fixesWithCounts) {
              for (let i = 0; i < count; i++) {
                store.recordFix(repoId, errorPattern, strategy);
              }
            }

            // Get prioritized fixes
            const prioritized = store.getPrioritizedFixes(repoId);

            // Should be sorted by success count (descending)
            for (let i = 1; i < prioritized.length; i++) {
              assert.ok(
                prioritized[i - 1].successCount >= prioritized[i].successCount,
                'Fixes should be sorted by success count descending'
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should persist and load history correctly (6.3)', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          repoIdArb,
          fc.array(fc.tuple(errorPatternArb, fixStrategyArb), { minLength: 1, maxLength: 5 }),
          async (repoId, fixes) => {
            // Clear store for clean test
            store.clearAll();

            // Record fixes
            for (const [errorPattern, strategy] of fixes) {
              store.recordFix(repoId, errorPattern, strategy);
            }

            // Get history before save
            const historyBefore = store.getHistory(repoId);

            // Save history
            await store.saveHistory(repoId, historyBefore);

            // Create new store instance to simulate restart
            const newStore = createFixHistoryStore(tempDir);

            // Load history
            const loadedHistory = await newStore.loadHistory(repoId);

            // Should load successfully
            assert.ok(loadedHistory, 'Should load history');
            assert.strictEqual(loadedHistory!.repoId, repoId, 'Repo ID should match');
            assert.strictEqual(
              loadedHistory!.fixes.length,
              historyBefore.fixes.length,
              'Fix count should match'
            );

            // Verify each fix was persisted
            for (const fix of historyBefore.fixes) {
              const loadedFix: HistoricalFix | undefined = loadedHistory!.fixes.find(f => f.errorPattern === fix.errorPattern);
              assert.ok(loadedFix, `Fix for ${fix.errorPattern} should be loaded`);
              assert.strictEqual(
                loadedFix!.strategy.type,
                fix.strategy.type,
                'Strategy type should match'
              );
              assert.strictEqual(
                loadedFix!.successCount,
                fix.successCount,
                'Success count should match'
              );
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should find best fix prioritizing repo-specific over global (6.5)', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          repoIdArb,
          repoIdArb,
          errorPatternArb,
          fixStrategyArb,
          fixStrategyArb,
          (repoId1, repoId2, errorPattern, strategy1, strategy2) => {
            // Skip if same repo ID
            if (repoId1 === repoId2) {
              return true;
            }

            // Clear store for clean test
            store.clearAll();

            // Record fix for repo1 (this becomes global pattern too)
            store.recordFix(repoId1, errorPattern, strategy1);

            // Record different fix for repo2
            store.recordFix(repoId2, errorPattern, strategy2);

            // Find best fix for repo2 - should return repo2's fix
            const bestFix = store.findBestFix(repoId2, errorPattern);

            assert.ok(bestFix, 'Should find a fix');
            assert.strictEqual(
              bestFix!.type,
              strategy2.type,
              'Should prioritize repo-specific fix'
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should return null for unknown error patterns', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          errorPatternArb,
          (errorPattern) => {
            // Clear store for clean test
            store.clearAll();

            // Try to get fix for unknown pattern
            const fix = store.getSuccessfulFix(errorPattern);

            assert.strictEqual(fix, null, 'Should return null for unknown pattern');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle empty history gracefully', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          repoIdArb,
          (repoId) => {
            // Clear store for clean test
            store.clearAll();

            // Get history for repo that has no fixes
            const history = store.getHistory(repoId);

            assert.ok(history, 'Should return history object');
            assert.strictEqual(history.repoId, repoId, 'Repo ID should match');
            assert.deepStrictEqual(history.fixes, [], 'Fixes should be empty array');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should update lastResurrection timestamp on recordFix', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          repoIdArb,
          errorPatternArb,
          fixStrategyArb,
          (repoId, errorPattern, strategy) => {
            // Clear store for clean test
            store.clearAll();

            const beforeRecord = new Date();

            // Record a fix
            store.recordFix(repoId, errorPattern, strategy);

            const afterRecord = new Date();

            // Get history
            const history = store.getHistory(repoId);

            // lastResurrection should be between before and after
            const lastResurrection = new Date(history.lastResurrection);
            assert.ok(
              lastResurrection >= beforeRecord && lastResurrection <= afterRecord,
              'lastResurrection should be updated to current time'
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle loading non-existent history', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          repoIdArb,
          async (repoId) => {
            // Create new store with clean temp dir
            const cleanTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-history-clean-'));
            const cleanStore = createFixHistoryStore(cleanTempDir);

            try {
              // Try to load history that doesn't exist
              const history = await cleanStore.loadHistory(repoId);

              assert.strictEqual(history, null, 'Should return null for non-existent history');
            } finally {
              fs.rmSync(cleanTempDir, { recursive: true, force: true });
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should replace strategy when different strategy succeeds for same error', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          repoIdArb,
          errorPatternArb,
          fixStrategyArb,
          fixStrategyArb,
          (repoId, errorPattern, strategy1, strategy2) => {
            // Skip if same strategy type
            if (strategy1.type === strategy2.type) {
              return true;
            }

            // Clear store for clean test
            store.clearAll();

            // Record first strategy
            store.recordFix(repoId, errorPattern, strategy1);

            // Record different strategy for same error
            store.recordFix(repoId, errorPattern, strategy2);

            // Get history
            const history = store.getHistory(repoId);
            const fix = history.fixes.find(f => f.errorPattern === errorPattern);

            // Should have the newer strategy
            assert.ok(fix, 'Fix should exist');
            assert.strictEqual(
              fix!.strategy.type,
              strategy2.type,
              'Should have newer strategy type'
            );
            // Success count should be reset to 1 for new strategy
            assert.strictEqual(fix!.successCount, 1, 'Success count should be 1 for new strategy');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
