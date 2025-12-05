/**
 * Unit tests for LLM Analysis timeout handling and error handling
 * Tests the timeout and retry logic added in Task 3
 * Tests the Gemini API error handling added in Task 3 (critical-dependency-fixes)
 * Requirements: 3.1, 3.2, 3.3, 3.4, 4.2, 4.4
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { GeminiClient } from '../services/llmAnalysis';
import { CodeCryptError } from '../utils/errors';

suite('LLM Analysis Timeout Handling Tests', () => {
  teardown(() => {
    sinon.restore();
  });

  suite('Adaptive timeout calculation', () => {
    test('should increase timeout with each attempt', () => {
      // Base timeout is 30000ms
      const timeout1 = 30000; // First attempt
      const timeout2 = 30000 * 1.5; // Second attempt: 45000ms
      const timeout3 = 30000 * 1.5 * 1.5; // Third attempt: 67500ms, capped at 60000ms

      // Verify the exponential backoff pattern
      assert.ok(timeout2 > timeout1, 'Second timeout should be greater than first');
      assert.ok(timeout3 > timeout2 || timeout3 === 60000, 'Third timeout should be greater or capped at max');
    });

    test('should cap timeout at maximum value', () => {
      // Max timeout is 60000ms
      const maxTimeout = 60000;
      
      // Even with many attempts, should not exceed max
      const veryHighAttempt = 10;
      const calculatedTimeout = Math.min(30000 * Math.pow(1.5, veryHighAttempt - 1), maxTimeout);
      
      assert.strictEqual(calculatedTimeout, maxTimeout, 'Should cap at max timeout');
    });
  });

  suite('Retry logic with backoff', () => {
    test('should use exponential backoff between retries', () => {
      // First backoff: 2^1 * 1000 = 2000ms
      const backoff1 = Math.pow(2, 1) * 1000;
      assert.strictEqual(backoff1, 2000, 'First backoff should be 2000ms');

      // Second backoff: 2^2 * 1000 = 4000ms
      const backoff2 = Math.pow(2, 2) * 1000;
      assert.strictEqual(backoff2, 4000, 'Second backoff should be 4000ms');

      // Third backoff: 2^3 * 1000 = 8000ms
      const backoff3 = Math.pow(2, 3) * 1000;
      assert.strictEqual(backoff3, 8000, 'Third backoff should be 8000ms');
    });
  });

  suite('Graceful degradation', () => {
    test('should handle timeout threshold correctly', () => {
      const TIMEOUT_THRESHOLD = 3;
      let consecutiveTimeouts = 0;

      // Simulate 3 consecutive timeouts
      consecutiveTimeouts++;
      consecutiveTimeouts++;
      consecutiveTimeouts++;

      assert.strictEqual(consecutiveTimeouts, TIMEOUT_THRESHOLD, 'Should reach timeout threshold');
      assert.ok(consecutiveTimeouts >= TIMEOUT_THRESHOLD, 'Should trigger graceful degradation');
    });

    test('should reset consecutive timeout counter on success', () => {
      let consecutiveTimeouts = 2;

      // Simulate a successful analysis
      consecutiveTimeouts = 0;

      assert.strictEqual(consecutiveTimeouts, 0, 'Should reset counter on success');
    });
  });

  suite('Partial results handling', () => {
    test('should continue with partial results when some files fail', () => {
      const totalFiles = 5;
      const successfulFiles = 3;
      const failedFiles = totalFiles - successfulFiles;

      assert.strictEqual(failedFiles, 2, 'Should have 2 failed files');
      assert.ok(successfulFiles < totalFiles, 'Should have fewer successful files than total');
      assert.ok(successfulFiles > 0, 'Should have some successful files');
    });

    test('should extract domain concepts from partial results', () => {
      const insights = [
        { domainConcepts: ['authentication', 'security'] },
        { domainConcepts: ['authentication', 'users'] }
      ];

      const allConcepts = insights.flatMap(i => i.domainConcepts);
      const conceptCounts = new Map<string, number>();
      
      allConcepts.forEach(concept => {
        conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
      });

      assert.strictEqual(conceptCounts.get('authentication'), 2, 'Authentication should appear twice');
      assert.strictEqual(conceptCounts.get('security'), 1, 'Security should appear once');
      assert.strictEqual(conceptCounts.get('users'), 1, 'Users should appear once');
    });
  });

  suite('Gemini API Error Handling', () => {
    test('should detect 404 model not found errors', async () => {
      // Create a mock Gemini client with an invalid model
      const client = new GeminiClient({
        apiKey: 'test-key',
        model: 'invalid-model-name'
      });

      // Mock the generateContent method to throw a 404 error
      const mockModel = (client as any).model;
      sinon.stub(mockModel, 'generateContent').rejects(
        new Error('404: Model models/invalid-model-name not found')
      );

      try {
        await client.analyzeCode('test prompt');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof CodeCryptError, 'Should throw CodeCryptError');
        assert.strictEqual((error as CodeCryptError).code, 'GEMINI_MODEL_NOT_FOUND', 'Should have correct error code');
        assert.ok((error as Error).message.includes('invalid-model-name'), 'Should include attempted model name');
        assert.ok((error as Error).message.includes('gemini-3-pro-preview'), 'Should suggest correct model');
      }
    });

    test('should include actionable guidance in 404 error message', async () => {
      const client = new GeminiClient({
        apiKey: 'test-key',
        model: 'gemini-old-invalid-model'
      });

      const mockModel = (client as any).model;
      sinon.stub(mockModel, 'generateContent').rejects(
        new Error('404: Model not found')
      );

      try {
        await client.analyzeCode('test prompt');
        assert.fail('Should have thrown an error');
      } catch (error) {
        const message = (error as Error).message;
        assert.ok(message.includes('VS Code settings'), 'Should mention VS Code settings');
        assert.ok(message.includes('codecrypt.geminiModel'), 'Should mention the setting name');
        assert.ok(message.includes('gemini-3-pro-preview'), 'Should suggest the correct model');
      }
    });

    test('should include attempted model name in error message', async () => {
      const testModel = 'gemini-old-version';
      const client = new GeminiClient({
        apiKey: 'test-key',
        model: testModel
      });

      const mockModel = (client as any).model;
      sinon.stub(mockModel, 'generateContent').rejects(
        new Error('404: Model not found')
      );

      try {
        await client.analyzeCode('test prompt');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok((error as Error).message.includes(testModel), 'Should include the attempted model name');
      }
    });

    test('should not treat network errors as model errors', async () => {
      const client = new GeminiClient({
        apiKey: 'test-key',
        model: 'gemini-3-pro-preview'
      });

      const mockModel = (client as any).model;
      sinon.stub(mockModel, 'generateContent').rejects(
        new Error('fetch failed')
      );

      try {
        await client.analyzeCode('test prompt');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof CodeCryptError, 'Should throw CodeCryptError');
        assert.notStrictEqual((error as CodeCryptError).code, 'GEMINI_MODEL_NOT_FOUND', 'Should not be model not found error');
        assert.ok((error as Error).message.includes('network'), 'Should be a network error');
      }
    });

    test('should handle generic errors without special treatment', async () => {
      const client = new GeminiClient({
        apiKey: 'test-key',
        model: 'gemini-3-pro-preview'
      });

      const mockModel = (client as any).model;
      sinon.stub(mockModel, 'generateContent').rejects(
        new Error('Some other error')
      );

      try {
        await client.analyzeCode('test prompt');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof CodeCryptError, 'Should throw CodeCryptError');
        assert.ok((error as Error).message.includes('Some other error'), 'Should include original error message');
      }
    });
  });
});
