/**
 * Tests for Secure Configuration Service
 */

import * as assert from 'assert';
import { SecureConfigManager, SecureConfigKey } from '../services/secureConfig';

suite('Secure Configuration Service Tests', () => {
  suite('looksLikeSecret detection', () => {
    test('should detect token-like values', () => {
      const manager = new SecureConfigManager({} as any);
      const result = (manager as any).looksLikeSecret(
        'GITHUB_TOKEN',
        'ghp_1234567890abcdefghijklmnopqrstuvwxyz'
      );
      assert.strictEqual(result, true);
    });

    test('should detect API key patterns', () => {
      const manager = new SecureConfigManager({} as any);
      const result = (manager as any).looksLikeSecret(
        'api_key',
        'sk_test_1234567890abcdefghijklmnopqrstuvwxyz'
      );
      assert.strictEqual(result, true);
    });

    test('should not flag short values', () => {
      const manager = new SecureConfigManager({} as any);
      const result = (manager as any).looksLikeSecret(
        'GITHUB_TOKEN',
        'short'
      );
      assert.strictEqual(result, false);
    });

    test('should not flag non-secret keys', () => {
      const manager = new SecureConfigManager({} as any);
      const result = (manager as any).looksLikeSecret(
        'NODE_ENV',
        'production'
      );
      assert.strictEqual(result, false);
    });

    test('should not flag values with special characters', () => {
      const manager = new SecureConfigManager({} as any);
      const result = (manager as any).looksLikeSecret(
        'DATABASE_URL',
        'postgresql://user:pass@localhost:5432/db'
      );
      assert.strictEqual(result, false);
    });
  });

  suite('sanitizeEnvForLogging', () => {
    test('should redact secret-like values', () => {
      const manager = new SecureConfigManager({} as any);
      const env = {
        'NODE_ENV': 'production',
        'GITHUB_TOKEN': 'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
        'API_KEY': 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz',
        'PORT': '3000'
      };

      const sanitized = manager.sanitizeEnvForLogging(env);

      assert.strictEqual(sanitized['NODE_ENV'], 'production');
      assert.strictEqual(sanitized['GITHUB_TOKEN'], '***REDACTED***');
      assert.strictEqual(sanitized['API_KEY'], '***REDACTED***');
      assert.strictEqual(sanitized['PORT'], '3000');
    });

    test('should handle empty environment', () => {
      const manager = new SecureConfigManager({} as any);
      const sanitized = manager.sanitizeEnvForLogging({});
      assert.deepStrictEqual(sanitized, {});
    });

    test('should preserve non-secret values', () => {
      const manager = new SecureConfigManager({} as any);
      const env = {
        'NODE_ENV': 'development',
        'DEBUG': 'true',
        'LOG_LEVEL': 'info'
      };

      const sanitized = manager.sanitizeEnvForLogging(env);
      assert.deepStrictEqual(sanitized, env);
    });
  });

  suite('SecureConfigKey enum', () => {
    test('should have all required keys', () => {
      assert.ok(SecureConfigKey.GITHUB_TOKEN);
      assert.ok(SecureConfigKey.NPM_TOKEN);
      assert.ok(SecureConfigKey.MCP_GITHUB_TOKEN);
      assert.ok(SecureConfigKey.MCP_REGISTRY_TOKEN);
    });

    test('should have unique values', () => {
      const values = Object.values(SecureConfigKey);
      const uniqueValues = new Set(values);
      assert.strictEqual(values.length, uniqueValues.size);
    });
  });
});
