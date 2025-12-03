/**
 * Property-Based Tests for BatchPlanner
 * 
 * **Feature: smart-dependency-updates, Property 3: Replacement priority ordering**
 * **Validates: Requirements 1.3**
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import { BatchPlanner } from '../services/batchPlanner';
import { ResurrectionPlanItem } from '../services/resurrectionPlanning';

suite('BatchPlanner Property Tests', () => {
  /**
   * Arbitrary generator for package names
   */
  const packageNameArb: fc.Arbitrary<string> = fc.string({ 
    minLength: 1, 
    maxLength: 30 
  }).filter(s => /^[a-z0-9-]+$/.test(s));

  /**
   * Arbitrary generator for version strings
   */
  const versionArb: fc.Arbitrary<string> = fc.oneof(
    fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20))
      .map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
    fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20))
      .map(([major, minor, patch]) => `^${major}.${minor}.${patch}`),
    fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20))
      .map(([major, minor, patch]) => `~${major}.${minor}.${patch}`)
  );

  /**
   * Arbitrary generator for resurrection plan items
   */
  const planItemArb: fc.Arbitrary<ResurrectionPlanItem> = fc.record({
    packageName: packageNameArb,
    currentVersion: versionArb,
    targetVersion: versionArb,
    priority: fc.integer({ min: 0, max: 2000 }),
    reason: fc.constantFrom(
      'security vulnerability',
      'outdated version',
      'deprecated package',
      'architecture incompatible'
    ),
    fixesVulnerabilities: fc.boolean(),
    vulnerabilityCount: fc.integer({ min: 0, max: 10 })
  });

  /**
   * Arbitrary generator for resurrection plan items that are replacements
   * (indicated by high priority >= 1000 and specific reasons)
   */
  const replacementPlanItemArb: fc.Arbitrary<ResurrectionPlanItem> = fc.record({
    packageName: packageNameArb,
    currentVersion: versionArb,
    targetVersion: versionArb,
    priority: fc.integer({ min: 1000, max: 2000 }), // High priority for replacements
    reason: fc.constantFrom(
      'deprecated package',
      'architecture incompatible',
      'blocking dependency replacement'
    ),
    fixesVulnerabilities: fc.boolean(),
    vulnerabilityCount: fc.integer({ min: 0, max: 10 })
  });

  /**
   * Arbitrary generator for resurrection plan items that are NOT replacements
   * (indicated by lower priority < 1000)
   */
  const nonReplacementPlanItemArb: fc.Arbitrary<ResurrectionPlanItem> = fc.record({
    packageName: packageNameArb,
    currentVersion: versionArb,
    targetVersion: versionArb,
    priority: fc.integer({ min: 0, max: 999 }), // Lower priority for non-replacements
    reason: fc.constantFrom(
      'outdated version',
      'minor update available',
      'patch update available'
    ),
    fixesVulnerabilities: fc.boolean(),
    vulnerabilityCount: fc.integer({ min: 0, max: 5 })
  });

  /**
   * Arbitrary generator for mixed resurrection plans with both replacements and non-replacements
   */
  const mixedPlanItemsArb: fc.Arbitrary<ResurrectionPlanItem[]> = fc.record({
    replacements: fc.array(replacementPlanItemArb, { minLength: 1, maxLength: 10 }),
    nonReplacements: fc.array(nonReplacementPlanItemArb, { minLength: 1, maxLength: 20 })
  }).chain(({ replacements, nonReplacements }) => {
    // Shuffle to create a mixed list
    const all = [...replacements, ...nonReplacements];
    return fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length });
  });

  /**
   * **Feature: smart-dependency-updates, Property 3: Replacement priority ordering**
   * **Validates: Requirements 1.3**
   * 
   * Property: For any resurrection plan containing package replacements,
   * all replacement items SHALL appear before non-replacement items when sorted by priority.
   */
  suite('Property 3: Replacement priority ordering', () => {
    test('should place all replacement items before non-replacement items in batches', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.property(
          mixedPlanItemsArb,
          (planItems) => {
            const planner = new BatchPlanner();
            const batches = planner.createBatches(planItems);

            // Identify replacement items (high priority >= 1000)
            const replacementItems = planItems.filter(item => item.priority >= 1000);
            const nonReplacementItems = planItems.filter(item => item.priority < 1000);

            if (replacementItems.length === 0 || nonReplacementItems.length === 0) {
              // Property only applies when we have both types
              return true;
            }

            // Flatten all packages from all batches in order
            const allPackagesInOrder: ResurrectionPlanItem[] = [];
            for (const batch of batches) {
              allPackagesInOrder.push(...batch.packages);
            }

            // Find the last index of any replacement item
            let lastReplacementIndex = -1;
            for (let i = 0; i < allPackagesInOrder.length; i++) {
              if (allPackagesInOrder[i].priority >= 1000) {
                lastReplacementIndex = i;
              }
            }

            // Find the first index of any non-replacement item
            let firstNonReplacementIndex = -1;
            for (let i = 0; i < allPackagesInOrder.length; i++) {
              if (allPackagesInOrder[i].priority < 1000) {
                firstNonReplacementIndex = i;
                break;
              }
            }

            // If both exist, last replacement should come before first non-replacement
            if (lastReplacementIndex >= 0 && firstNonReplacementIndex >= 0) {
              assert.ok(
                lastReplacementIndex < firstNonReplacementIndex,
                `All replacement items (priority >= 1000) should appear before non-replacement items (priority < 1000). ` +
                `Last replacement at index ${lastReplacementIndex}, first non-replacement at index ${firstNonReplacementIndex}`
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should maintain priority ordering within replacement items', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.property(
          fc.array(replacementPlanItemArb, { minLength: 2, maxLength: 15 }),
          (planItems) => {
            const planner = new BatchPlanner();
            const batches = planner.createBatches(planItems);

            // Flatten all packages from all batches in order
            const allPackagesInOrder: ResurrectionPlanItem[] = [];
            for (const batch of batches) {
              allPackagesInOrder.push(...batch.packages);
            }

            // Check that replacement items are in descending priority order
            for (let i = 0; i < allPackagesInOrder.length - 1; i++) {
              const current = allPackagesInOrder[i];
              const next = allPackagesInOrder[i + 1];

              // Current should have >= priority than next (descending order)
              assert.ok(
                current.priority >= next.priority,
                `Replacement items should be in descending priority order. ` +
                `Item at index ${i} has priority ${current.priority}, ` +
                `item at index ${i + 1} has priority ${next.priority}`
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle plans with only replacement items', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.property(
          fc.array(replacementPlanItemArb, { minLength: 1, maxLength: 20 }),
          (planItems) => {
            const planner = new BatchPlanner();
            const batches = planner.createBatches(planItems);

            // Should create batches successfully
            assert.ok(batches.length > 0, 'Should create at least one batch');

            // All batches should have high priority
            for (const batch of batches) {
              assert.ok(
                batch.priority >= 500,
                `Replacement batches should have high priority (>= 500), got ${batch.priority}`
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle plans with only non-replacement items', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.property(
          fc.array(nonReplacementPlanItemArb, { minLength: 1, maxLength: 20 }),
          (planItems) => {
            const planner = new BatchPlanner();
            const batches = planner.createBatches(planItems);

            // Should create batches successfully
            assert.ok(batches.length > 0, 'Should create at least one batch');

            // All batches should have lower priority
            for (const batch of batches) {
              assert.ok(
                batch.priority <= 500,
                `Non-replacement batches should have lower priority (<= 500), got ${batch.priority}`
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should preserve all plan items in batches', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.property(
          fc.array(planItemArb, { minLength: 1, maxLength: 30 }),
          (planItems) => {
            const planner = new BatchPlanner();
            const batches = planner.createBatches(planItems);

            // Flatten all packages from all batches
            const allPackagesInBatches: ResurrectionPlanItem[] = [];
            for (const batch of batches) {
              allPackagesInBatches.push(...batch.packages);
            }

            // Should have same number of items
            assert.strictEqual(
              allPackagesInBatches.length,
              planItems.length,
              'All plan items should be included in batches'
            );

            // Every plan item should appear in batches
            for (const item of planItems) {
              const found = allPackagesInBatches.find(
                p => p.packageName === item.packageName && 
                     p.currentVersion === item.currentVersion
              );
              assert.ok(
                found !== undefined,
                `Plan item ${item.packageName} should appear in batches`
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should respect batch size limits', async function() {
      this.timeout(30000);

      const maxBatchSize = 10;

      await fc.assert(
        fc.property(
          fc.array(planItemArb, { minLength: 1, maxLength: 50 }),
          (planItems) => {
            const planner = new BatchPlanner(maxBatchSize);
            const batches = planner.createBatches(planItems);

            // Check that no batch exceeds the max size
            for (const batch of batches) {
              assert.ok(
                batch.packages.length <= maxBatchSize,
                `Batch ${batch.id} should not exceed max size of ${maxBatchSize}, ` +
                `but has ${batch.packages.length} packages`
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should assign higher priority to security update batches', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.property(
          fc.record({
            securityUpdates: fc.array(
              fc.record({
                packageName: packageNameArb,
                currentVersion: versionArb,
                targetVersion: versionArb,
                // Security updates should have high priority (>= 1000) as per calculatePriority
                priority: fc.integer({ min: 1000, max: 2000 }),
                reason: fc.constant('security vulnerability'),
                fixesVulnerabilities: fc.constant(true),
                vulnerabilityCount: fc.integer({ min: 1, max: 10 })
              }),
              { minLength: 1, maxLength: 10 }
            ),
            regularUpdates: fc.array(
              fc.record({
                packageName: packageNameArb,
                currentVersion: versionArb,
                targetVersion: versionArb,
                // Regular updates have lower priority (< 1000)
                priority: fc.integer({ min: 0, max: 999 }),
                reason: fc.constant('outdated version'),
                fixesVulnerabilities: fc.constant(false),
                vulnerabilityCount: fc.constant(0)
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          ({ securityUpdates, regularUpdates }) => {
            const allItems = [...securityUpdates, ...regularUpdates];
            const planner = new BatchPlanner();
            const batches = planner.createBatches(allItems);

            // Find batches containing security updates
            const securityBatches = batches.filter(batch =>
              batch.packages.some(pkg => pkg.fixesVulnerabilities)
            );

            // Find batches containing only regular updates
            const regularBatches = batches.filter(batch =>
              batch.packages.every(pkg => !pkg.fixesVulnerabilities)
            );

            if (securityBatches.length > 0 && regularBatches.length > 0) {
              // Security batches should have higher priority than regular batches
              const minSecurityPriority = Math.min(...securityBatches.map(b => b.priority));
              const maxRegularPriority = Math.max(...regularBatches.map(b => b.priority));

              assert.ok(
                minSecurityPriority > maxRegularPriority,
                `Security batches should have higher priority than regular batches. ` +
                `Min security priority: ${minSecurityPriority}, max regular priority: ${maxRegularPriority}`
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
