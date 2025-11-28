import * as assert from 'assert';
import {
  CodeCryptError,
  RepositoryError,
  DependencyError,
  NetworkError,
  ValidationError,
  retryWithBackoff,
  safeJsonParse,
  formatErrorForUser
} from '../utils/errors';

suite('Error Handling Test Suite', () => {
  
  test('CodeCryptError has correct properties', () => {
    const error = new CodeCryptError('Test error', 'TEST_CODE');
    
    assert.strictEqual(error.message, 'Test error');
    assert.strictEqual(error.code, 'TEST_CODE');
    assert.strictEqual(error.name, 'CodeCryptError');
    assert.ok(error instanceof Error);
  });

  test('RepositoryError extends CodeCryptError', () => {
    const error = new RepositoryError('Repository not found');
    
    assert.strictEqual(error.message, 'Repository not found');
    assert.strictEqual(error.code, 'REPO_ERROR');
    assert.strictEqual(error.name, 'RepositoryError');
    assert.ok(error instanceof CodeCryptError);
  });

  test('DependencyError extends CodeCryptError', () => {
    const error = new DependencyError('Dependency conflict');
    
    assert.strictEqual(error.message, 'Dependency conflict');
    assert.strictEqual(error.code, 'DEPENDENCY_ERROR');
    assert.strictEqual(error.name, 'DependencyError');
  });

  test('NetworkError extends CodeCryptError', () => {
    const error = new NetworkError('Connection timeout');
    
    assert.strictEqual(error.message, 'Connection timeout');
    assert.strictEqual(error.code, 'NETWORK_ERROR');
    assert.strictEqual(error.name, 'NetworkError');
  });

  test('ValidationError extends CodeCryptError', () => {
    const error = new ValidationError('Invalid input');
    
    assert.strictEqual(error.message, 'Invalid input');
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
    assert.strictEqual(error.name, 'ValidationError');
  });

  test('retryWithBackoff succeeds on first attempt', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return 'success';
    };
    
    const result = await retryWithBackoff(fn, 3, 10);
    
    assert.strictEqual(result, 'success');
    assert.strictEqual(callCount, 1);
  });

  test('retryWithBackoff retries on failure', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    };
    
    const result = await retryWithBackoff(fn, 3, 10);
    
    assert.strictEqual(result, 'success');
    assert.strictEqual(callCount, 3);
  });

  test('retryWithBackoff throws after max retries', async () => {
    const fn = async () => {
      throw new Error('Permanent failure');
    };
    
    await assert.rejects(
      async () => await retryWithBackoff(fn, 2, 10),
      (error: Error) => {
        assert.ok(error instanceof NetworkError);
        assert.ok(error.message.includes('failed after 3 attempts'));
        return true;
      }
    );
  });

  test('safeJsonParse parses valid JSON', () => {
    const json = '{"name": "test", "value": 123}';
    const result = safeJsonParse(json);
    
    assert.strictEqual(result.name, 'test');
    assert.strictEqual(result.value, 123);
  });

  test('safeJsonParse throws ValidationError on invalid JSON', () => {
    const invalidJson = '{invalid json}';
    
    assert.throws(
      () => safeJsonParse(invalidJson, 'test data'),
      (error: Error) => {
        assert.ok(error instanceof ValidationError);
        assert.ok(error.message.includes('Failed to parse test data'));
        return true;
      }
    );
  });

  test('formatErrorForUser formats CodeCryptError', () => {
    const error = new RepositoryError('Test error');
    const formatted = formatErrorForUser(error);
    
    assert.strictEqual(formatted, 'RepositoryError: Test error');
  });

  test('formatErrorForUser formats generic Error', () => {
    const error = new Error('Generic error');
    const formatted = formatErrorForUser(error);
    
    assert.strictEqual(formatted, 'Generic error');
  });

  test('formatErrorForUser formats non-Error values', () => {
    const formatted = formatErrorForUser('String error');
    
    assert.strictEqual(formatted, 'String error');
  });
});
