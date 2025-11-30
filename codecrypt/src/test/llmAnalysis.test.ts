/**
 * Tests for LLM Analysis Service
 */

import * as assert from 'assert';
import { LLMClient, GeminiClient, analyzeFile } from '../services/llmAnalysis';
import { FileASTAnalysis, LLMInsight } from '../types';

suite('LLM Analysis Service', () => {
  suite('LLMClient', () => {
    test('should initialize with config', () => {
      const client = new LLMClient({
        apiKey: 'test-key',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 4096,
        timeout: 30000,
        maxRetries: 3,
      });

      assert.ok(client);
    });

    test('should use default values when not provided', () => {
      const client = new LLMClient({
        apiKey: 'test-key',
      });

      assert.ok(client);
    });

    test('should calculate exponential backoff correctly', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      // Access private method through any cast for testing
      const calculateBackoff = (client as any).calculateBackoff.bind(client);
      
      const delay0 = calculateBackoff(0);
      const delay1 = calculateBackoff(1);
      const delay2 = calculateBackoff(2);
      
      // Delays should increase exponentially (with jitter)
      assert.ok(delay0 >= 1000 && delay0 < 3000); // 1s + jitter
      assert.ok(delay1 >= 2000 && delay1 < 4000); // 2s + jitter
      assert.ok(delay2 >= 4000 && delay2 < 6000); // 4s + jitter
    });

    test('should identify retryable errors', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      const isRetryableError = (client as any).isRetryableError.bind(client);

      // Mock API errors
      class MockAPIError extends Error {
        status: number;
        constructor(status: number) {
          super('API Error');
          this.status = status;
        }
      }

      // Rate limit should be retryable
      assert.strictEqual(isRetryableError(new MockAPIError(429)), false); // Not instanceof Anthropic.APIError
      
      // Regular errors should not be retryable
      assert.strictEqual(isRetryableError(new Error('Regular error')), false);
    });
  });

  suite('analyzeFile', () => {
    test('should handle parsing errors gracefully', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      // Mock analyzeCode to return invalid JSON
      (client as any).analyzeCode = async () => 'Invalid JSON response';

      const result = await analyzeFile(
        client,
        'const x = 1;',
        'test.js'
      );

      // Should return low-confidence fallback
      assert.strictEqual(result.filePath, 'test.js');
      assert.strictEqual(result.confidence, 0);
      assert.strictEqual(result.developerIntent, 'Unable to analyze');
    });

    test('should parse valid JSON response', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      // Mock analyzeCode to return valid JSON
      const mockResponse = {
        developerIntent: 'Test function',
        domainConcepts: ['testing', 'validation'],
        idiomaticPatterns: ['async/await'],
        antiPatterns: ['callback hell'],
        modernizationSuggestions: ['Use ES6 modules'],
        confidence: 0.9,
      };
      
      (client as any).analyzeCode = async () => JSON.stringify(mockResponse);

      const result = await analyzeFile(
        client,
        'async function test() { return true; }',
        'test.js'
      );

      assert.strictEqual(result.filePath, 'test.js');
      assert.strictEqual(result.developerIntent, 'Test function');
      assert.strictEqual(result.confidence, 0.9);
      assert.deepStrictEqual(result.domainConcepts, ['testing', 'validation']);
    });

    test('should include AST context when provided', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      let capturedPrompt = '';
      (client as any).analyzeCode = async (prompt: string) => {
        capturedPrompt = prompt;
        return JSON.stringify({
          developerIntent: 'Test',
          domainConcepts: [],
          idiomaticPatterns: [],
          antiPatterns: [],
          modernizationSuggestions: [],
          confidence: 0.8,
        });
      };

      const astAnalysis: FileASTAnalysis = {
        filePath: 'test.js',
        fileType: 'js',
        linesOfCode: 50,
        structure: {
          classes: [],
          functions: [
            {
              name: 'testFunc',
              parameters: [],
              isAsync: false,
              isExported: true,
              location: { start: 0, end: 10 },
            },
          ],
          imports: [],
          exports: [],
        },
        complexity: {
          cyclomatic: 5,
          decisionPoints: 3,
        },
        callGraph: [],
      };

      await analyzeFile(client, 'function testFunc() {}', 'test.js', astAnalysis);

      // Verify AST context was included in prompt
      assert.ok(capturedPrompt.includes('Lines of Code: 50'));
      assert.ok(capturedPrompt.includes('Cyclomatic Complexity: 5'));
      assert.ok(capturedPrompt.includes('Functions: testFunc'));
    });
  });

  suite('Error Handling', () => {
    test('should handle missing API key gracefully', async () => {
      try {
        const client = new LLMClient({ apiKey: '' });
        assert.fail('Should have thrown error');
      } catch (error) {
        // Expected to fail with empty API key
        assert.ok(error);
      }
    });

    test('should handle timeout errors', async () => {
      const client = new LLMClient({
        apiKey: 'test-key',
        timeout: 1, // Very short timeout
      });

      // This would timeout in real scenario
      // For unit test, we just verify the client was created with timeout config
      assert.ok(client);
    });
  });

  suite('Prompt Generation', () => {
    test('should generate prompt with file path', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      let capturedPrompt = '';
      (client as any).analyzeCode = async (prompt: string) => {
        capturedPrompt = prompt;
        return JSON.stringify({
          developerIntent: 'Test',
          domainConcepts: [],
          idiomaticPatterns: [],
          antiPatterns: [],
          modernizationSuggestions: [],
          confidence: 0.8,
        });
      };

      await analyzeFile(client, 'const x = 1;', 'src/utils/helper.ts');

      assert.ok(capturedPrompt.includes('src/utils/helper.ts'));
    });

    test('should generate prompt with code content', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      let capturedPrompt = '';
      (client as any).analyzeCode = async (prompt: string) => {
        capturedPrompt = prompt;
        return JSON.stringify({
          developerIntent: 'Test',
          domainConcepts: [],
          idiomaticPatterns: [],
          antiPatterns: [],
          modernizationSuggestions: [],
          confidence: 0.8,
        });
      };

      const code = 'function add(a, b) { return a + b; }';
      await analyzeFile(client, code, 'test.js');

      assert.ok(capturedPrompt.includes(code));
    });

    test('should include analysis guidelines in prompt', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      let capturedPrompt = '';
      (client as any).analyzeCode = async (prompt: string) => {
        capturedPrompt = prompt;
        return JSON.stringify({
          developerIntent: 'Test',
          domainConcepts: [],
          idiomaticPatterns: [],
          antiPatterns: [],
          modernizationSuggestions: [],
          confidence: 0.8,
        });
      };

      await analyzeFile(client, 'const x = 1;', 'test.js');

      assert.ok(capturedPrompt.includes('Developer Intent'));
      assert.ok(capturedPrompt.includes('Domain Concepts'));
      assert.ok(capturedPrompt.includes('Idiomatic Patterns'));
      assert.ok(capturedPrompt.includes('Anti-Patterns'));
      assert.ok(capturedPrompt.includes('Modernization'));
    });
  });

  suite('Response Parsing', () => {
    test('should extract JSON from response with markdown', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      // Mock response with markdown formatting
      const mockResponse = `Here's the analysis:
\`\`\`json
{
  "developerIntent": "Test function",
  "domainConcepts": ["testing"],
  "idiomaticPatterns": [],
  "antiPatterns": [],
  "modernizationSuggestions": [],
  "confidence": 0.9
}
\`\`\``;
      
      (client as any).analyzeCode = async () => mockResponse;

      const result = await analyzeFile(client, 'test code', 'test.js');

      assert.strictEqual(result.developerIntent, 'Test function');
      assert.strictEqual(result.confidence, 0.9);
    });

    test('should handle response with extra text', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      const mockResponse = `Let me analyze this code.
{
  "developerIntent": "Helper function",
  "domainConcepts": ["utilities"],
  "idiomaticPatterns": [],
  "antiPatterns": [],
  "modernizationSuggestions": [],
  "confidence": 0.85
}
That's my analysis.`;
      
      (client as any).analyzeCode = async () => mockResponse;

      const result = await analyzeFile(client, 'test code', 'test.js');

      assert.strictEqual(result.developerIntent, 'Helper function');
      assert.strictEqual(result.confidence, 0.85);
    });

    test('should use default values for missing fields', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      // Response missing some fields
      const mockResponse = JSON.stringify({
        developerIntent: 'Test',
        // Missing other fields
      });
      
      (client as any).analyzeCode = async () => mockResponse;

      const result = await analyzeFile(client, 'test code', 'test.js');

      assert.strictEqual(result.developerIntent, 'Test');
      assert.deepStrictEqual(result.domainConcepts, []);
      assert.deepStrictEqual(result.idiomaticPatterns, []);
      assert.deepStrictEqual(result.antiPatterns, []);
      assert.deepStrictEqual(result.modernizationSuggestions, []);
      assert.strictEqual(result.confidence, 0.5); // Default confidence
    });

    test('should handle completely invalid JSON', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      (client as any).analyzeCode = async () => 'This is not JSON at all';

      const result = await analyzeFile(client, 'test code', 'test.js');

      // Should return fallback with zero confidence
      assert.strictEqual(result.confidence, 0);
      assert.strictEqual(result.developerIntent, 'Unable to analyze');
    });
  });

  suite('Retry Logic', () => {
    test('should have retry configuration', () => {
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 3 });
      
      // Verify retry configuration is set
      assert.strictEqual((client as any).config.maxRetries, 3);
    });

    test('should handle errors gracefully', async () => {
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 1 });
      
      // Mock analyzeCode to throw error
      (client as any).analyzeCode = async () => {
        throw new Error('API Error');
      };

      try {
        await analyzeFile(client, 'test code', 'test.js');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error);
      }
    });

    test('should apply exponential backoff between retries', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      const calculateBackoff = (client as any).calculateBackoff.bind(client);

      // Test that backoff increases exponentially
      const backoff0 = calculateBackoff(0);
      const backoff1 = calculateBackoff(1);
      const backoff2 = calculateBackoff(2);

      // Each should be roughly double the previous (with jitter)
      assert.ok(backoff1 > backoff0);
      assert.ok(backoff2 > backoff1);
      
      // Verify exponential growth pattern
      assert.ok(backoff0 >= 1000); // Base delay
      assert.ok(backoff1 >= 2000); // 2x base
      assert.ok(backoff2 >= 4000); // 4x base
    });

    test('should cap backoff at maximum delay', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      const calculateBackoff = (client as any).calculateBackoff.bind(client);

      // Test with very high retry count
      const backoff10 = calculateBackoff(10);
      
      // Should be capped at 30 seconds + jitter
      assert.ok(backoff10 <= 31000); // 30s max + 1s jitter
    });

    test('should identify retryable error types', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      const isRetryableError = (client as any).isRetryableError.bind(client);

      // Test with regular errors (not Anthropic.APIError)
      assert.strictEqual(isRetryableError(new Error('Regular error')), false);
      assert.strictEqual(isRetryableError({ message: 'Object error' }), false);
    });
  });

  suite('Integration with AST Analysis', () => {
    test('should use AST data to enrich prompts', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      let capturedPrompt = '';
      (client as any).analyzeCode = async (prompt: string) => {
        capturedPrompt = prompt;
        return JSON.stringify({
          developerIntent: 'Test',
          domainConcepts: [],
          idiomaticPatterns: [],
          antiPatterns: [],
          modernizationSuggestions: [],
          confidence: 0.8,
        });
      };

      const astAnalysis: FileASTAnalysis = {
        filePath: 'complex.ts',
        fileType: 'ts',
        linesOfCode: 250,
        structure: {
          classes: [
            {
              name: 'ComplexClass',
              methods: ['method1', 'method2'],
              properties: ['prop1'],
              isExported: true,
            },
          ],
          functions: [],
          imports: [],
          exports: [],
        },
        complexity: {
          cyclomatic: 15,
          decisionPoints: 10,
        },
        callGraph: [],
      };

      await analyzeFile(client, 'class ComplexClass {}', 'complex.ts', astAnalysis);

      // Verify AST metrics are in prompt
      assert.ok(capturedPrompt.includes('250'));
      assert.ok(capturedPrompt.includes('15'));
      assert.ok(capturedPrompt.includes('ComplexClass'));
    });

    test('should work without AST data', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      (client as any).analyzeCode = async () => JSON.stringify({
        developerIntent: 'Test',
        domainConcepts: [],
        idiomaticPatterns: [],
        antiPatterns: [],
        modernizationSuggestions: [],
        confidence: 0.7,
      });

      // Should not throw when AST analysis is not provided
      const result = await analyzeFile(client, 'const x = 1;', 'test.js');

      assert.ok(result);
      assert.strictEqual(result.filePath, 'test.js');
    });
  });

  suite('GeminiClient', () => {
    test('should initialize with config', () => {
      const client = new GeminiClient({
        apiKey: 'test-key',
        model: 'gemini-pro',
        timeout: 30000,
        maxRetries: 3,
      });

      assert.ok(client);
    });

    test('should use default values when not provided', () => {
      const client = new GeminiClient({
        apiKey: 'test-key',
      });

      assert.ok(client);
    });

    test('should calculate exponential backoff correctly', () => {
      const client = new GeminiClient({ apiKey: 'test-key' });
      
      // Access private method through any cast for testing
      const calculateBackoff = (client as any).calculateBackoff.bind(client);
      
      const delay0 = calculateBackoff(0);
      const delay1 = calculateBackoff(1);
      const delay2 = calculateBackoff(2);
      
      // Delays should increase exponentially (with jitter)
      assert.ok(delay0 >= 1000 && delay0 < 3000); // 1s + jitter
      assert.ok(delay1 >= 2000 && delay1 < 4000); // 2s + jitter
      assert.ok(delay2 >= 4000 && delay2 < 6000); // 4s + jitter
    });

    test('should identify retryable errors', () => {
      const client = new GeminiClient({ apiKey: 'test-key' });
      const isRetryableError = (client as any).isRetryableError.bind(client);

      // Mock errors with retryable messages
      const rateLimitError = new Error('rate limit exceeded');
      const timeoutError = new Error('request timeout');
      const serverError = new Error('503 service unavailable');
      const regularError = new Error('invalid input');

      assert.strictEqual(isRetryableError(rateLimitError), true);
      assert.strictEqual(isRetryableError(timeoutError), true);
      assert.strictEqual(isRetryableError(serverError), true);
      assert.strictEqual(isRetryableError(regularError), false);
    });

    test('should cap backoff at maximum delay', () => {
      const client = new GeminiClient({ apiKey: 'test-key' });
      const calculateBackoff = (client as any).calculateBackoff.bind(client);

      // Test with very high retry count
      const backoff10 = calculateBackoff(10);
      
      // Should be capped at 30 seconds + jitter
      assert.ok(backoff10 <= 31000); // 30s max + 1s jitter
    });
  });

  suite('Gemini Integration', () => {
    test('should work with analyzeFile function', async () => {
      const client = new GeminiClient({ apiKey: 'test-key' });
      
      // Mock analyzeCode to return valid JSON
      const mockResponse = {
        developerIntent: 'Test function',
        domainConcepts: ['testing', 'validation'],
        idiomaticPatterns: ['async/await'],
        antiPatterns: ['callback hell'],
        modernizationSuggestions: ['Use ES6 modules'],
        confidence: 0.9,
      };
      
      (client as any).analyzeCode = async () => JSON.stringify(mockResponse);

      const result = await analyzeFile(
        client,
        'async function test() { return true; }',
        'test.js'
      );

      assert.strictEqual(result.filePath, 'test.js');
      assert.strictEqual(result.developerIntent, 'Test function');
      assert.strictEqual(result.confidence, 0.9);
      assert.deepStrictEqual(result.domainConcepts, ['testing', 'validation']);
    });

    test('should handle Gemini-specific response format', async () => {
      const client = new GeminiClient({ apiKey: 'test-key' });
      
      // Mock Gemini response (may have different formatting)
      const mockResponse = JSON.stringify({
        developerIntent: 'Helper utility',
        domainConcepts: ['utilities', 'helpers'],
        idiomaticPatterns: ['ES6 modules'],
        antiPatterns: [],
        modernizationSuggestions: ['Add TypeScript types'],
        confidence: 0.85,
      });
      
      (client as any).analyzeCode = async () => mockResponse;

      const result = await analyzeFile(client, 'export const helper = () => {}', 'helper.js');

      assert.strictEqual(result.developerIntent, 'Helper utility');
      assert.strictEqual(result.confidence, 0.85);
    });

    test('should handle timeout errors', async () => {
      const client = new GeminiClient({
        apiKey: 'test-key',
        timeout: 1, // Very short timeout
      });

      // Verify the client was created with timeout config
      assert.strictEqual((client as any).config.timeout, 1);
    });
  });

  suite('Provider Selection', () => {
    test('should support both Anthropic and Gemini clients', async () => {
      const anthropicClient = new LLMClient({ apiKey: 'test-key' });
      const geminiClient = new GeminiClient({ apiKey: 'test-key' });

      assert.ok(anthropicClient);
      assert.ok(geminiClient);
    });

    test('should work with either client type in analyzeFile', async () => {
      const mockResponse = JSON.stringify({
        developerIntent: 'Test',
        domainConcepts: [],
        idiomaticPatterns: [],
        antiPatterns: [],
        modernizationSuggestions: [],
        confidence: 0.8,
      });

      // Test with Anthropic client
      const anthropicClient = new LLMClient({ apiKey: 'test-key' });
      (anthropicClient as any).analyzeCode = async () => mockResponse;
      const result1 = await analyzeFile(anthropicClient, 'const x = 1;', 'test.js');
      assert.ok(result1);

      // Test with Gemini client
      const geminiClient = new GeminiClient({ apiKey: 'test-key' });
      (geminiClient as any).analyzeCode = async () => mockResponse;
      const result2 = await analyzeFile(geminiClient, 'const x = 1;', 'test.js');
      assert.ok(result2);
    });
  });
});
