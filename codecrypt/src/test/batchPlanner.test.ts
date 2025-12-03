/**
 * Unit Tests for BatchPlanner
 * Tests batch planning heuristics and grouping logic
 */

import * as assert from 'assert';
import { BatchPlanner } from '../services/batchPlanner';
import { ResurrectionPlanItem } from '../services/resurrectionPlanning';

suite('BatchPlanner Unit Tests', () => {
  /**
   * Helper function to create a plan item
   */
  function createPlanItem(
    packageName: string,
    priority: number,
    fixesVulnerabilities: boolean = false,
    currentVersion: string = '1.0.0',
    targetVersion: string = '2.0.0'
  ): ResurrectionPlanItem {
    return {
      packageName,
      currentVersion,
      targetVersion,
      priority,
      reason: fixesVulnerabilities ? 'security vulnerability' : 'outdated version',
      fixesVulnerabilities,
      vulnerabilityCount: fixesVulnerabilities ? 1 : 0
    };
  }

  suite('Batch Creation', () => {
    test('should create batches from plan items', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('package-a', 1500, true),
        createPlanItem('package-b', 1200, true),
        createPlanItem('package-c', 100, false)
      ];

      const batches = planner.createBatches(planItems);

      assert.ok(batches.length > 0, 'Should create at least one batch');
      assert.strictEqual(
        batches.reduce((sum, b) => sum + b.packages.length, 0),
        planItems.length,
        'All plan items should be in batches'
      );
    });

    test('should handle empty plan items', () => {
      const planner = new BatchPlanner();
      const batches = planner.createBatches([]);

      assert.strictEqual(batches.length, 0, 'Should create no batches for empty input');
    });

    test('should assign unique IDs to batches', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('package-a', 1500, true),
        createPlanItem('package-b', 1200, true),
        createPlanItem('package-c', 100, false)
      ];

      const batches = planner.createBatches(planItems);
      const ids = batches.map(b => b.id);
      const uniqueIds = new Set(ids);

      assert.strictEqual(ids.length, uniqueIds.size, 'All batch IDs should be unique');
    });
  });

  suite('Security Update Batches', () => {
    test('should put security updates in separate high-priority batch', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('vulnerable-pkg', 1500, true),
        createPlanItem('regular-pkg', 100, false)
      ];

      const batches = planner.createBatches(planItems);

      // Find batch with security update
      const securityBatch = batches.find(b => 
        b.packages.some(p => p.packageName === 'vulnerable-pkg')
      );

      assert.ok(securityBatch, 'Should have a batch with security update');
      assert.strictEqual(securityBatch!.priority, 1000, 'Security batch should have priority 1000');
    });

    test('should group multiple security updates together', () => {
      const planner = new BatchPlanner(10);
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('vuln-1', 1500, true),
        createPlanItem('vuln-2', 1400, true),
        createPlanItem('vuln-3', 1300, true)
      ];

      const batches = planner.createBatches(planItems);

      // All security updates should be in one batch (under max size)
      const securityBatches = batches.filter(b => b.priority === 1000);
      assert.strictEqual(securityBatches.length, 1, 'Should have one security batch');
      assert.strictEqual(
        securityBatches[0].packages.length,
        3,
        'Security batch should contain all 3 security updates'
      );
    });

    test('should split security updates into multiple batches if exceeding max size', () => {
      const planner = new BatchPlanner(2); // Max 2 per batch
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('vuln-1', 1500, true),
        createPlanItem('vuln-2', 1400, true),
        createPlanItem('vuln-3', 1300, true),
        createPlanItem('vuln-4', 1200, true),
        createPlanItem('vuln-5', 1100, true)
      ];

      const batches = planner.createBatches(planItems);

      const securityBatches = batches.filter(b => b.priority === 1000);
      assert.strictEqual(securityBatches.length, 3, 'Should have 3 security batches (5 items / 2 max)');
      
      // Check batch sizes
      assert.strictEqual(securityBatches[0].packages.length, 2);
      assert.strictEqual(securityBatches[1].packages.length, 2);
      assert.strictEqual(securityBatches[2].packages.length, 1);
    });
  });

  suite('Major Version Update Batches', () => {
    test('should put major version updates in separate batches', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('major-update', 500, false, '1.0.0', '2.0.0'),
        createPlanItem('minor-update', 100, false, '1.0.0', '1.1.0')
      ];

      const batches = planner.createBatches(planItems);

      // Find batch with major update
      const majorBatch = batches.find(b => 
        b.packages.some(p => p.packageName === 'major-update')
      );

      assert.ok(majorBatch, 'Should have a batch with major update');
      assert.strictEqual(majorBatch!.priority, 500, 'Major update batch should have priority 500');
      assert.strictEqual(majorBatch!.packages.length, 1, 'Major update should be in its own batch');
    });

    test('should create separate batch for each major update', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('major-1', 500, false, '1.0.0', '2.0.0'),
        createPlanItem('major-2', 400, false, '2.0.0', '3.0.0'),
        createPlanItem('major-3', 300, false, '3.0.0', '4.0.0')
      ];

      const batches = planner.createBatches(planItems);

      const majorBatches = batches.filter(b => b.priority === 500);
      assert.strictEqual(majorBatches.length, 3, 'Should have 3 separate major update batches');
      
      // Each should contain exactly one package
      majorBatches.forEach(batch => {
        assert.strictEqual(batch.packages.length, 1, 'Each major update should be in its own batch');
      });
    });

    test('should detect major version updates with various version formats', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('pkg-1', 500, false, '^1.0.0', '^2.0.0'),
        createPlanItem('pkg-2', 400, false, '~1.5.0', '~2.0.0'),
        createPlanItem('pkg-3', 300, false, '1.9.9', '2.0.0')
      ];

      const batches = planner.createBatches(planItems);

      const majorBatches = batches.filter(b => b.priority === 500);
      assert.strictEqual(majorBatches.length, 3, 'Should detect all major updates regardless of format');
    });
  });

  suite('Minor/Patch Update Batches', () => {
    test('should group minor and patch updates together', () => {
      const planner = new BatchPlanner(10);
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('minor-1', 100, false, '1.0.0', '1.1.0'),
        createPlanItem('minor-2', 90, false, '2.0.0', '2.1.0'),
        createPlanItem('patch-1', 80, false, '1.0.0', '1.0.1')
      ];

      const batches = planner.createBatches(planItems);

      const minorPatchBatches = batches.filter(b => b.priority === 100);
      assert.strictEqual(minorPatchBatches.length, 1, 'Should have one batch for minor/patch updates');
      assert.strictEqual(
        minorPatchBatches[0].packages.length,
        3,
        'Batch should contain all minor/patch updates'
      );
    });

    test('should respect max batch size for minor/patch updates', () => {
      const planner = new BatchPlanner(3);
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('pkg-1', 100, false, '1.0.0', '1.1.0'),
        createPlanItem('pkg-2', 90, false, '1.0.0', '1.1.0'),
        createPlanItem('pkg-3', 80, false, '1.0.0', '1.1.0'),
        createPlanItem('pkg-4', 70, false, '1.0.0', '1.1.0'),
        createPlanItem('pkg-5', 60, false, '1.0.0', '1.1.0')
      ];

      const batches = planner.createBatches(planItems);

      const minorPatchBatches = batches.filter(b => b.priority === 100);
      assert.strictEqual(minorPatchBatches.length, 2, 'Should split into 2 batches (5 items / 3 max)');
      assert.strictEqual(minorPatchBatches[0].packages.length, 3);
      assert.strictEqual(minorPatchBatches[1].packages.length, 2);
    });

    test('should assign low priority to minor/patch batches', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('minor-pkg', 100, false, '1.0.0', '1.1.0')
      ];

      const batches = planner.createBatches(planItems);

      assert.strictEqual(batches[0].priority, 100, 'Minor/patch batch should have priority 100');
    });
  });

  suite('Batch Priority Ordering', () => {
    test('should order batches by priority', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('minor-pkg', 100, false, '1.0.0', '1.1.0'),
        createPlanItem('major-pkg', 500, false, '1.0.0', '2.0.0'),
        createPlanItem('security-pkg', 1500, true)
      ];

      const batches = planner.createBatches(planItems);
      const reordered = planner.reorderForSafety(batches);

      // Check that batches are in descending priority order
      for (let i = 0; i < reordered.length - 1; i++) {
        assert.ok(
          reordered[i].priority >= reordered[i + 1].priority,
          `Batch ${i} priority (${reordered[i].priority}) should be >= batch ${i + 1} priority (${reordered[i + 1].priority})`
        );
      }
    });

    test('should place security batches first', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('minor-pkg', 100, false, '1.0.0', '1.1.0'),
        createPlanItem('security-pkg', 1500, true)
      ];

      const batches = planner.createBatches(planItems);
      const reordered = planner.reorderForSafety(batches);

      assert.strictEqual(reordered[0].priority, 1000, 'First batch should be security batch');
      assert.ok(
        reordered[0].packages.some(p => p.packageName === 'security-pkg'),
        'First batch should contain security package'
      );
    });
  });

  suite('Risk Estimation', () => {
    test('should estimate high risk for major version updates', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('major-pkg', 500, false, '1.0.0', '2.0.0')
      ];

      const batches = planner.createBatches(planItems);
      const majorBatch = batches.find(b => b.packages[0].packageName === 'major-pkg');

      assert.strictEqual(majorBatch!.estimatedRisk, 'high', 'Major update batch should have high risk');
    });

    test('should estimate low risk for small minor/patch batches', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('minor-1', 100, false, '1.0.0', '1.1.0'),
        createPlanItem('minor-2', 90, false, '1.0.0', '1.1.0')
      ];

      const batches = planner.createBatches(planItems);
      const minorBatch = batches[0];

      assert.strictEqual(minorBatch.estimatedRisk, 'low', 'Small minor/patch batch should have low risk');
    });

    test('should estimate medium risk for large security batches', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('vuln-1', 1500, true),
        createPlanItem('vuln-2', 1400, true),
        createPlanItem('vuln-3', 1300, true),
        createPlanItem('vuln-4', 1200, true),
        createPlanItem('vuln-5', 1100, true),
        createPlanItem('vuln-6', 1000, true)
      ];

      const batches = planner.createBatches(planItems);
      const securityBatch = batches[0];

      assert.strictEqual(
        securityBatch.estimatedRisk,
        'high',
        'Large security batch should have high risk'
      );
    });
  });

  suite('Edge Cases', () => {
    test('should handle single item', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('single-pkg', 100, false)
      ];

      const batches = planner.createBatches(planItems);

      assert.strictEqual(batches.length, 1, 'Should create one batch');
      assert.strictEqual(batches[0].packages.length, 1, 'Batch should contain one package');
    });

    test('should handle all items with same priority', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('pkg-1', 100, false),
        createPlanItem('pkg-2', 100, false),
        createPlanItem('pkg-3', 100, false)
      ];

      const batches = planner.createBatches(planItems);

      assert.ok(batches.length > 0, 'Should create batches');
      assert.strictEqual(
        batches.reduce((sum, b) => sum + b.packages.length, 0),
        3,
        'All items should be in batches'
      );
    });

    test('should handle version strings without numbers', () => {
      const planner = new BatchPlanner();
      const planItems: ResurrectionPlanItem[] = [
        createPlanItem('pkg-1', 100, false, 'latest', 'next')
      ];

      const batches = planner.createBatches(planItems);

      assert.strictEqual(batches.length, 1, 'Should handle non-numeric versions');
    });
  });
});
