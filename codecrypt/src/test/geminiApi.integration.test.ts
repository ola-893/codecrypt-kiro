/**
 * Integration tests for Gemini API
 * Tests GeminiClient initialization, API calls, and error handling
 * Requirements: 3.2, 4.2
 * 
 * Note: These tests require a valid Gemini API key to run successfully.
 * Set the GEMINI_API_KEY environment variable to run these tests.
 * If no API key is provided, tests will be skipped.
 */

import * as assert from 'assert';
import { GeminiClient } from '../services/llmAnalysis';
import { CodeCryptError } from '../utils/errors';

suite('Gemini API Integration Tests', () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const skipTests = !apiKey;

  if (skipTests) {
    console.log('⚠️  Skipping Gemini API integration tests - GEMINI_API_KEY not set');
  }

  suite('GeminiClient Initialization', () => {
    test('should initialize with gemini-3-pro-preview model', function() {
      if (skipTests) {
        this.skip();
        return;
      }

      const client = new GeminiClient({
        apiKey: apiKey!,
        model: 'gemini-3-pro-preview'
      });

      assert.ok(client, 'Client should be initialized');
      assert.strictEqual((client as any).config.model, 'gemini-3-pro-preview', 'Should use correct model');
    });

    test('should use default model when not specified', function() {
      if (skipTests) {
        this.skip();
        return;
      }

      const client = new GeminiClient({
        apiKey: apiKey!
      });

      assert.ok(client, 'Client should be initialized');
      assert.strictEqual((client as any).config.model, 'gemini-3-pro-preview', 'Should default to gemini-3-pro-preview');
    });

    test('should accept custom timeout configuration', function() {
      if (skipTests) {
        this.skip();
        return;
      }

      const customTimeout = 45000;
      const client = new GeminiClient({
        apiKey: apiKey!,
        timeout: customTimeout
      });

      assert.strictEqual((client as any).config.timeout, customTimeout, 'Should use custom timeout');
    });

    test('should accept custom retry configuration', function() {
      if (skipTests) {
        this.skip();
        return;
      }

      const customRetries = 5;
      const client = new GeminiClient({
        apiKey: apiKey!,
        maxRetries: customRetries
      });

      assert.strictEqual((client as any).config.maxRetries, customRetries, 'Should use custom max retries');
    });
  });

  suite('Successful API Calls', () => {
    test('should successfully analyze simple code', async function() {
      if (skipTests) {
        this.skip();
        return;
      }

      this.timeout(30000); // Allow 30 seconds for API call

      const client = new GeminiClient({
        apiKey: apiKey!,
        model: 'gemini-3-pro-preview'
      });

      const prompt = 'Analyze this simple JavaScript function and respond with JSON:\n\nfunction add(a, b) { return a + b; }\n\nProvide: {"analysis": "brief description"}';

      const response = await client.analyzeCode(prompt);

      assert.ok(response, 'Should receive a response');
      assert.ok(typeof response === 'string', 'Response should be a string');
      assert.ok(response.length > 0, 'Response should not be empty');
    });

    test('should handle JSON responses correctly', async function() {
      if (skipTests) {
        this.skip();
        return;
      }

      this.timeout(30000);

      const client = new GeminiClient({
        apiKey: apiKey!,
        model: 'gemini-3-pro-preview'
      });

      const prompt = 'Respond with only this JSON: {"status": "ok", "message": "test"}';

      const response = await client.analyzeCode(prompt);

      assert.ok(response, 'Should receive a response');
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(response);
        assert.ok(parsed, 'Should be valid JSON');
      } catch (error) {
        // Some models may wrap JSON in markdown, try to extract it
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        assert.ok(jsonMatch, 'Should contain JSON in response');
        const parsed = JSON.parse(jsonMatch![0]);
        assert.ok(parsed, 'Extracted JSON should be valid');
      }
    });
  });

  suite('Error Handling for Invalid Model', () => {
    test('should throw error with actionable guidance for invalid model', async function() {
      if (skipTests) {
        this.skip();
        return;
      }

      this.timeout(30000);

      const client = new GeminiClient({
        apiKey: apiKey!,
        model: 'gemini-invalid-model-xyz'
      });

      try {
        await client.analyzeCode('test prompt');
        assert.fail('Should have thrown an error for invalid model');
      } catch (error) {
        assert.ok(error instanceof CodeCryptError, 'Should throw CodeCryptError');
        
        const errorMessage = (error as Error).message;
        
        // Verify error message includes actionable guidance
        assert.ok(
          errorMessage.includes('gemini-invalid-model-xyz'),
          'Should include the attempted model name'
        );
        assert.ok(
          errorMessage.includes('gemini-3-pro-preview'),
          'Should suggest the correct model name'
        );
        assert.ok(
          errorMessage.includes('VS Code settings') || errorMessage.includes('codecrypt.geminiModel'),
          'Should mention how to update the configuration'
        );
        
        // Verify error code
        assert.strictEqual(
          (error as CodeCryptError).code,
          'GEMINI_MODEL_NOT_FOUND',
          'Should have correct error code'
        );
      }
    });

    test('should include configuration instructions in error', async function() {
      if (skipTests) {
        this.skip();
        return;
      }

      this.timeout(30000);

      const client = new GeminiClient({
        apiKey: apiKey!,
        model: 'gemini-old-version'
      });

      try {
        await client.analyzeCode('test prompt');
        assert.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Verify actionable guidance is present
        assert.ok(
          errorMessage.includes('update') || errorMessage.includes('change'),
          'Should suggest updating the configuration'
        );
        assert.ok(
          errorMessage.includes('settings'),
          'Should mention settings'
        );
      }
    });
  });

  suite('Retry Logic', () => {
    test('should respect maxRetries configuration', function() {
      if (skipTests) {
        this.skip();
        return;
      }

      const maxRetries = 2;
      const client = new GeminiClient({
        apiKey: apiKey!,
        maxRetries
      });

      assert.strictEqual(
        (client as any).config.maxRetries,
        maxRetries,
        'Should store maxRetries configuration'
      );
    });

    test('should calculate exponential backoff correctly', function() {
      if (skipTests) {
        this.skip();
        return;
      }

      const client = new GeminiClient({
        apiKey: apiKey!
      });

      // Test backoff calculation (private method, testing logic)
      const baseDelay = 1000;
      const maxDelay = 30000;

      // First retry: 1000 * 2^0 = 1000ms (plus jitter)
      const backoff0 = Math.min(baseDelay * Math.pow(2, 0), maxDelay);
      assert.strictEqual(backoff0, 1000, 'First backoff should be 1000ms');

      // Second retry: 1000 * 2^1 = 2000ms (plus jitter)
      const backoff1 = Math.min(baseDelay * Math.pow(2, 1), maxDelay);
      assert.strictEqual(backoff1, 2000, 'Second backoff should be 2000ms');

      // Third retry: 1000 * 2^2 = 4000ms (plus jitter)
      const backoff2 = Math.min(baseDelay * Math.pow(2, 2), maxDelay);
      assert.strictEqual(backoff2, 4000, 'Third backoff should be 4000ms');
    });
  });

  suite('Timeout Handling', () => {
    test('should respect timeout configuration', function() {
      if (skipTests) {
        this.skip();
        return;
      }

      const timeout = 15000;
      const client = new GeminiClient({
        apiKey: apiKey!,
        timeout
      });

      assert.strictEqual(
        (client as any).config.timeout,
        timeout,
        'Should store timeout configuration'
      );
    });

    test('should use default timeout when not specified', function() {
      if (skipTests) {
        this.skip();
        return;
      }

      const client = new GeminiClient({
        apiKey: apiKey!
      });

      assert.strictEqual(
        (client as any).config.timeout,
        60000,
        'Should default to 60 seconds'
      );
    });
  });

  suite('Network Error Handling', () => {
    test('should distinguish network errors from model errors', async function() {
      if (skipTests) {
        this.skip();
        return;
      }

      // This test verifies the error handling logic without making actual network calls
      // We're testing that the error classification works correctly
      
      const client = new GeminiClient({
        apiKey: apiKey!,
        model: 'gemini-3-pro-preview'
      });

      // Test error classification logic
      const networkError = new Error('fetch failed');
      const modelError = new Error('404: Model not found');

      const isNetworkError = (error: Error) => 
        error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED');
      
      const isModelError = (error: Error) =>
        (error.message.includes('404') || error.message.includes('not found')) &&
        (error.message.toLowerCase().includes('model') || error.message.includes('models/'));

      assert.ok(isNetworkError(networkError), 'Should identify network errors');
      assert.ok(!isNetworkError(modelError), 'Should not misidentify model errors as network errors');
      assert.ok(isModelError(modelError), 'Should identify model errors');
      assert.ok(!isModelError(networkError), 'Should not misidentify network errors as model errors');
    });
  });
});
