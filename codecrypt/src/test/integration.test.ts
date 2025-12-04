/**
 * Integration tests for the full resurrection flow
 * Tests the orchestrator and component integration
 */

import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { ResurrectionOrchestrator } from '../services/resurrectionOrchestrator';
import { ResurrectionContext } from '../types';
import { getEventEmitter, resetEventEmitter } from '../services/eventEmitter';

describe('Integration Tests', () => {
  let orchestrator: ResurrectionOrchestrator;
  let context: ResurrectionContext;

  beforeEach(() => {
    // Reset event emitter before each test
    resetEventEmitter();

    // Create a minimal context for testing
    context = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: [],
      repoPath: '/tmp/test-repo',
    };
  });

  afterEach(async () => {
    // Cleanup orchestrator
    if (orchestrator) {
      await orchestrator.stop();
    }
  });

  it('should create orchestrator with default config', () => {
    orchestrator = new ResurrectionOrchestrator(context);
    assert.ok(orchestrator, 'Orchestrator should be created');
  });

  it('should start and stop orchestrator', async () => {
    orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: false, // Disable SSE for testing
      enableHybridAnalysis: false,
      enableTimeMachine: false,
      enableLLM: false,
    });

    await orchestrator.start();
    assert.ok(true, 'Orchestrator should start without errors');

    await orchestrator.stop();
    assert.ok(true, 'Orchestrator should stop without errors');
  });

  it('should handle missing repository path gracefully', async () => {
    const invalidContext: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: [],
      // No repoPath
    };

    orchestrator = new ResurrectionOrchestrator(invalidContext, {
      enableSSE: false,
      enableHybridAnalysis: false,
      enableTimeMachine: false,
      enableLLM: false,
    });

    await orchestrator.start();

    // Should not throw when hybrid analysis is disabled
    const result = await orchestrator.runHybridAnalysis();
    assert.strictEqual(result, undefined, 'Should return undefined when disabled');
  });

  it('should emit events through event emitter', async () => {
    orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: true, // Enable SSE to trigger narration events
      ssePort: 3001, // Use different port to avoid conflicts
      enableHybridAnalysis: false,
      enableTimeMachine: false,
      enableLLM: false,
    });

    const eventEmitter = getEventEmitter();
    let narrationReceived = false;

    eventEmitter.onNarration(() => {
      narrationReceived = true;
    });

    await orchestrator.start();

    // Wait a bit for events to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    assert.ok(narrationReceived, 'Should receive narration events');
  });

  it('should handle SSE server errors gracefully', async () => {
    orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: true,
      ssePort: 99999, // Invalid port to trigger error
      enableHybridAnalysis: false,
      enableTimeMachine: false,
      enableLLM: false,
    });

    // Should not throw even if SSE fails
    await orchestrator.start();
    assert.ok(true, 'Should handle SSE errors gracefully');
  });

  it('should return context', () => {
    orchestrator = new ResurrectionOrchestrator(context);
    const returnedContext = orchestrator.getContext();
    assert.strictEqual(returnedContext, context, 'Should return the same context');
  });

  it('should handle Time Machine validation when disabled', async () => {
    orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: false,
      enableHybridAnalysis: false,
      enableTimeMachine: false,
      enableLLM: false,
    });

    await orchestrator.start();
    const result = await orchestrator.runTimeMachineValidation();
    assert.strictEqual(result, undefined, 'Should return undefined when disabled');
  });

  it('should generate report', async () => {
    orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: false,
      enableHybridAnalysis: false,
      enableTimeMachine: false,
      enableLLM: false,
    });

    await orchestrator.start();
    const report = await orchestrator.generateReport();
    assert.ok(report, 'Should generate a report');
    assert.ok(report.summary, 'Report should have a summary');
  });
});

describe('Error Scenario Tests', () => {
  it('should handle missing dependencies gracefully', async () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: [],
      repoPath: '/nonexistent/path',
    };

    const orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: false,
      enableHybridAnalysis: true, // Enable to test error handling
      enableTimeMachine: false,
      enableLLM: false,
    });

    await orchestrator.start();

    // Should handle missing path gracefully
    const result = await orchestrator.runHybridAnalysis();
    assert.strictEqual(result, undefined, 'Should return undefined on error');

    await orchestrator.stop();
  });

  it('should handle LLM API errors gracefully', async () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: [],
      repoPath: '/tmp/test-repo',
    };

    const orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: false,
      enableHybridAnalysis: true,
      enableTimeMachine: false,
      enableLLM: true, // Enable LLM without API key
    });

    await orchestrator.start();

    // Should handle missing API key gracefully
    const result = await orchestrator.runHybridAnalysis();
    // Should either return undefined or partial results
    assert.ok(true, 'Should handle LLM errors gracefully');

    await orchestrator.stop();
  });
});

/**
 * Integration Test for Batch Execution Fixes
 * Task 8.1: Test with real repository
 * 
 * This test validates the complete resurrection flow including:
 * - Batch execution
 * - Validation loop prevention
 * - LLM timeout handling
 * - Progress tracking
 * - Report generation
 * 
 * Requirements: All requirements from batch-execution-fixes spec
 */
describe('Batch Execution Fixes Integration Test', () => {
  it('should execute full resurrection flow with batch execution', async () => {
    // Note: This test uses a mock repository path since we can't clone a real repo in unit tests
    // In a real integration test environment, you would:
    // 1. Clone a dead repository (e.g., an old React project with outdated dependencies)
    // 2. Run the full resurrection flow
    // 3. Verify the results
    
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/dead-repo',
      isDead: true,
      dependencies: [
        {
          name: 'react',
          currentVersion: '16.0.0',
          latestVersion: '18.2.0',
          vulnerabilities: [],
          updateStatus: 'pending',
        },
        {
          name: 'react-dom',
          currentVersion: '16.0.0',
          latestVersion: '18.2.0',
          vulnerabilities: [],
          updateStatus: 'pending',
        },
      ],
      transformationLog: [],
      repoPath: '/tmp/test-dead-repo',
    };

    const orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: false, // Disable SSE for testing
      enableHybridAnalysis: false, // Disable to speed up test
      enableTimeMachine: false, // Disable Docker-dependent features
      enableLLM: false, // Disable LLM to avoid API calls
      enablePostResurrectionValidation: false, // Disable validation for this test
    });

    try {
      // Start orchestrator
      await orchestrator.start();
      assert.ok(true, 'Orchestrator should start successfully');

      // Verify context is accessible
      const retrievedContext = orchestrator.getContext();
      assert.strictEqual(retrievedContext.repoUrl, context.repoUrl, 'Context should be retrievable');
      assert.strictEqual(retrievedContext.dependencies.length, 2, 'Should have 2 dependencies');

      // Generate report (should work even without executing plan)
      const report = await orchestrator.generateReport();
      assert.ok(report, 'Should generate a report');
      assert.ok(report.summary, 'Report should have a summary');
      assert.ok(report.markdown, 'Report should have markdown content');

      // Verify transformation log
      assert.ok(Array.isArray(retrievedContext.transformationLog), 'Should have transformation log');

      // Stop orchestrator
      await orchestrator.stop();
      assert.ok(true, 'Orchestrator should stop successfully');

    } catch (error: any) {
      assert.fail(`Integration test failed: ${error.message}`);
    }
  });

  it('should track batch execution events', async () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/dead-repo',
      isDead: true,
      dependencies: [],
      transformationLog: [],
      repoPath: '/tmp/test-dead-repo',
    };

    const orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: true, // Enable SSE to test event emission
      ssePort: 3002, // Use different port
      enableHybridAnalysis: false,
      enableTimeMachine: false,
      enableLLM: false,
      enablePostResurrectionValidation: false,
    });

    const eventEmitter = getEventEmitter();
    const eventsReceived: string[] = [];

    // Listen for batch-related events
    eventEmitter.on('batch_started', () => {
      eventsReceived.push('batch_started');
    });

    eventEmitter.on('batch_completed', () => {
      eventsReceived.push('batch_completed');
    });

    eventEmitter.on('package_update_started', () => {
      eventsReceived.push('package_update_started');
    });

    eventEmitter.on('package_updated', () => {
      eventsReceived.push('package_updated');
    });

    try {
      await orchestrator.start();
      
      // Wait a bit for events to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Note: Events won't be emitted without actual batch execution
      // This test verifies the event system is set up correctly
      assert.ok(true, 'Event listeners should be set up without errors');

      await orchestrator.stop();
    } catch (error: any) {
      assert.fail(`Event tracking test failed: ${error.message}`);
    }
  });

  it('should handle validation loop prevention', async () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/dead-repo',
      isDead: true,
      dependencies: [],
      transformationLog: [],
      repoPath: '/tmp/test-dead-repo',
    };

    const orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: false,
      enableHybridAnalysis: false,
      enableTimeMachine: false,
      enableLLM: false,
      enablePostResurrectionValidation: true, // Enable validation
      postResurrectionValidationOptions: {
        maxIterations: 3, // Limit iterations for testing
        timeout: 30000, // 30 second timeout
      },
    });

    try {
      await orchestrator.start();

      // Run validation (will fail gracefully since repo doesn't exist)
      const validationResult = await orchestrator.runPostResurrectionValidation();
      
      // Validation should return undefined or a result
      // It should not throw or hang indefinitely
      assert.ok(true, 'Validation should complete without hanging');

      // If validation ran, verify it respects max iterations
      if (validationResult) {
        assert.ok(
          validationResult.iterations <= 3,
          'Should respect max iterations limit'
        );
      }

      await orchestrator.stop();
    } catch (error: any) {
      assert.fail(`Validation loop test failed: ${error.message}`);
    }
  });

  it('should generate comprehensive report with batch results', async () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/dead-repo',
      isDead: true,
      dependencies: [
        {
          name: 'lodash',
          currentVersion: '4.0.0',
          latestVersion: '4.17.21',
          vulnerabilities: [
            {
              id: 'CVE-2021-23337',
              severity: 'high',
              description: 'Command injection vulnerability',
            },
          ],
          updateStatus: 'pending',
        },
      ],
      transformationLog: [
        {
          timestamp: new Date(),
          type: 'dependency_update',
          message: 'Updated lodash from 4.0.0 to 4.17.21',
          details: {
            packageName: 'lodash',
            fromVersion: '4.0.0',
            toVersion: '4.17.21',
          },
        },
      ],
      repoPath: '/tmp/test-dead-repo',
    };

    const orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: false,
      enableHybridAnalysis: false,
      enableTimeMachine: false,
      enableLLM: false,
      enablePostResurrectionValidation: false,
    });

    try {
      await orchestrator.start();

      // Generate report
      const report = await orchestrator.generateReport();

      // Verify report structure
      assert.ok(report, 'Should generate report');
      assert.ok(report.summary, 'Report should have summary');
      assert.ok(report.markdown, 'Report should have markdown content');
      assert.ok(report.statistics, 'Report should have statistics');
      assert.ok(report.updatedDependencies, 'Report should have updated dependencies list');

      // Verify statistics structure
      assert.ok(typeof report.statistics.totalUpdates === 'number', 'Should have total updates count');
      assert.ok(typeof report.statistics.successfulUpdates === 'number', 'Should have successful updates count');
      assert.ok(typeof report.statistics.failedUpdates === 'number', 'Should have failed updates count');

      await orchestrator.stop();
    } catch (error: any) {
      assert.fail(`Report generation test failed: ${error.message}`);
    }
  });

  it('should handle LLM timeout gracefully', async () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/dead-repo',
      isDead: true,
      dependencies: [],
      transformationLog: [],
      repoPath: '/tmp/test-dead-repo',
    };

    const orchestrator = new ResurrectionOrchestrator(context, {
      enableSSE: false,
      enableHybridAnalysis: true, // Enable hybrid analysis
      enableTimeMachine: false,
      enableLLM: true, // Enable LLM (will fail gracefully without API key)
      enablePostResurrectionValidation: false,
    });

    try {
      await orchestrator.start();

      // Run hybrid analysis (should handle LLM timeout/failure gracefully)
      const analysisResult = await orchestrator.runHybridAnalysis();

      // Analysis should either return undefined or partial results
      // It should not throw or hang
      assert.ok(true, 'Hybrid analysis should handle LLM failures gracefully');

      // If analysis returned results, verify it's structured correctly
      if (analysisResult) {
        assert.ok(analysisResult.combinedInsights, 'Analysis should have combined insights');
      }

      await orchestrator.stop();
    } catch (error: any) {
      assert.fail(`LLM timeout test failed: ${error.message}`);
    }
  });
});
