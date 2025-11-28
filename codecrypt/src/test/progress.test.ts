/**
 * Tests for Progress Reporting Service
 */

import * as assert from 'assert';
import { ResurrectionStage } from '../services/progress';

suite('Progress Service Test Suite', () => {
  test('ResurrectionStage enum has all expected stages', () => {
    assert.strictEqual(ResurrectionStage.INITIALIZING, 'Initializing');
    assert.strictEqual(ResurrectionStage.CLONING, 'Cloning repository');
    assert.strictEqual(ResurrectionStage.ANALYZING, 'Analyzing repository');
    assert.strictEqual(ResurrectionStage.PLANNING, 'Planning resurrection');
    assert.strictEqual(ResurrectionStage.UPDATING, 'Updating dependencies');
    assert.strictEqual(ResurrectionStage.VALIDATING, 'Validating changes');
    assert.strictEqual(ResurrectionStage.REPORTING, 'Generating report');
    assert.strictEqual(ResurrectionStage.COMPLETE, 'Complete');
  });
});
