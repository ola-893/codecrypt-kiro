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
