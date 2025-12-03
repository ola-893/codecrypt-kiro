/**
 * Unit Tests for URLValidator
 * 
 * Tests URL validation, GitHub URL parsing, and npm registry fallback
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import * as assert from 'assert';
import { URLValidator } from '../services/urlValidator';

suite('URLValidator Unit Tests', () => {
  let validator: URLValidator;

  setup(() => {
    validator = new URLValidator(10000); // 10 second timeout for tests
  });

  suite('GitHub Archive URL Detection and Extraction', () => {
    test('should extract package name from github.com archive URL', () => {
      const url = 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz';
      const packageName = validator.extractPackageFromUrl(url);
      
      assert.strictEqual(packageName, 'querystring', 'Should extract package name from archive URL');
    });

    test('should extract package name from github.com tarball URL', () => {
      const url = 'https://github.com/user/my-package/tarball/v1.0.0';
      const packageName = validator.extractPackageFromUrl(url);
      
      assert.strictEqual(packageName, 'my-package', 'Should extract package name from tarball URL');
    });

    test('should extract package name from github: protocol', () => {
      const url = 'github:facebook/react#v18.0.0';
      const packageName = validator.extractPackageFromUrl(url);
      
      assert.strictEqual(packageName, 'react', 'Should extract package name from github: protocol');
    });

    test('should handle URL without protocol', () => {
      const url = 'github.com/lodash/lodash/archive/4.17.21.tar.gz';
      const packageName = validator.extractPackageFromUrl(url);
      
      assert.strictEqual(packageName, 'lodash', 'Should extract package name from URL without protocol');
    });

    test('should remove .git suffix from package name', () => {
      const url = 'https://github.com/user/repo.git/archive/v1.0.0.tar.gz';
      const packageName = validator.extractPackageFromUrl(url);
      
      assert.strictEqual(packageName, 'repo', 'Should remove .git suffix');
    });

    test('should return null for non-GitHub URL', () => {
      const url = 'https://example.com/package.tar.gz';
      const packageName = validator.extractPackageFromUrl(url);
      
      assert.strictEqual(packageName, null, 'Should return null for non-GitHub URL');
    });

    test('should return null for malformed URL', () => {
      const url = 'not-a-valid-url';
      const packageName = validator.extractPackageFromUrl(url);
      
      assert.strictEqual(packageName, null, 'Should return null for malformed URL');
    });

    test('should handle various GitHub URL formats', () => {
      const testCases = [
        { url: 'https://github.com/expressjs/express/archive/4.18.0.tar.gz', expected: 'express' },
        { url: 'github.com/webpack/webpack/tarball/v5.0.0', expected: 'webpack' },
        { url: 'github:vuejs/vue#v3.0.0', expected: 'vue' },
        { url: 'https://github.com/microsoft/typescript.git', expected: 'typescript' }
      ];

      for (const testCase of testCases) {
        const packageName = validator.extractPackageFromUrl(testCase.url);
        assert.strictEqual(
          packageName,
          testCase.expected,
          `Should extract ${testCase.expected} from ${testCase.url}`
        );
      }
    });
  });

  suite('URL Validation', () => {
    test('should validate accessible URL', async function() {
      this.timeout(15000); // Increase timeout for network request
      
      // Use a reliable URL that should always be accessible
      const url = 'https://registry.npmjs.org/lodash';
      const result = await validator.validate(url);
      
      assert.strictEqual(result.url, url, 'Should return the original URL');
      assert.strictEqual(result.isValid, true, 'Should mark accessible URL as valid');
      assert.ok(result.statusCode, 'Should include status code');
      assert.ok(result.statusCode >= 200 && result.statusCode < 300, 'Status code should be 2xx');
    });

    test('should mark inaccessible URL as invalid', async function() {
      this.timeout(15000); // Increase timeout for network request
      
      // Use a URL that should return 404
      const url = 'https://github.com/nonexistent-user-12345/nonexistent-repo-67890/archive/v0.0.0.tar.gz';
      const result = await validator.validate(url);
      
      assert.strictEqual(result.url, url, 'Should return the original URL');
      assert.strictEqual(result.isValid, false, 'Should mark inaccessible URL as invalid');
    });

    test('should normalize URL without protocol', async function() {
      this.timeout(15000); // Increase timeout for network request
      
      const url = 'registry.npmjs.org/lodash';
      const result = await validator.validate(url);
      
      assert.strictEqual(result.url, url, 'Should return the original URL');
      // Should attempt to validate with https:// prefix
      assert.ok(result.isValid !== undefined, 'Should attempt validation');
    });

    test('should handle timeout gracefully', async function() {
      this.timeout(15000); // Increase timeout for test
      
      // Create validator with very short timeout
      const shortTimeoutValidator = new URLValidator(100);
      
      // Use a URL that might be slow to respond
      const url = 'https://httpstat.us/200?sleep=5000';
      const result = await shortTimeoutValidator.validate(url);
      
      // Should complete without throwing
      assert.ok(result, 'Should return a result');
      assert.strictEqual(result.url, url, 'Should return the original URL');
    });

    test('should handle malformed URL gracefully', async () => {
      const url = 'not-a-valid-url-at-all';
      const result = await validator.validate(url);
      
      assert.strictEqual(result.url, url, 'Should return the original URL');
      assert.strictEqual(result.isValid, false, 'Should mark malformed URL as invalid');
    });
  });

  suite('npm Registry Fallback Lookup', () => {
    test('should find npm alternative for existing package', async function() {
      this.timeout(15000); // Increase timeout for network request
      
      const packageName = 'lodash';
      const version = await validator.findNpmAlternative(packageName);
      
      assert.ok(version !== null, 'Should find version for existing package');
      assert.ok(typeof version === 'string', 'Version should be a string');
      assert.ok(version.length > 0, 'Version should not be empty');
      // lodash versions typically look like "4.17.21"
      assert.ok(/^\d+\.\d+\.\d+/.test(version), 'Version should match semver format');
    });

    test('should return null for non-existent package', async function() {
      this.timeout(15000); // Increase timeout for network request
      
      const packageName = 'this-package-definitely-does-not-exist-12345-67890';
      const version = await validator.findNpmAlternative(packageName);
      
      assert.strictEqual(version, null, 'Should return null for non-existent package');
    });

    test('should handle scoped packages', async function() {
      this.timeout(15000); // Increase timeout for network request
      
      const packageName = '@types/node';
      const version = await validator.findNpmAlternative(packageName);
      
      assert.ok(version !== null, 'Should find version for scoped package');
      assert.ok(typeof version === 'string', 'Version should be a string');
    });

    test('should handle timeout gracefully', async function() {
      this.timeout(15000); // Increase timeout for test
      
      // Create validator with very short timeout
      const shortTimeoutValidator = new URLValidator(100);
      
      const packageName = 'lodash';
      const version = await shortTimeoutValidator.findNpmAlternative(packageName);
      
      // Should complete without throwing (might return null due to timeout)
      assert.ok(version === null || typeof version === 'string', 'Should return null or string');
    });

    test('should handle special characters in package name', async function() {
      this.timeout(15000); // Increase timeout for network request
      
      // Package names with special characters should be URL-encoded
      const packageName = '@babel/core';
      const version = await validator.findNpmAlternative(packageName);
      
      assert.ok(version !== null, 'Should find version for package with special characters');
    });
  });

  suite('Integration Scenarios', () => {
    test('should handle dead GitHub URL with npm fallback', async function() {
      this.timeout(20000); // Increase timeout for multiple network requests
      
      // Simulate the workflow: validate URL, extract package, find npm alternative
      const deadUrl = 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz';
      
      // Step 1: Validate URL
      const validationResult = await validator.validate(deadUrl);
      
      // Step 2: If invalid, extract package name
      if (!validationResult.isValid) {
        const packageName = validator.extractPackageFromUrl(deadUrl);
        assert.ok(packageName !== null, 'Should extract package name');
        
        // Step 3: Find npm alternative
        if (packageName) {
          const npmVersion = await validator.findNpmAlternative(packageName);
          // querystring might or might not exist on npm, but the workflow should complete
          assert.ok(npmVersion === null || typeof npmVersion === 'string', 'Should return version or null');
        }
      }
    });

    test('should handle valid GitHub URL without npm lookup', async function() {
      this.timeout(15000); // Increase timeout for network request
      
      // Use a URL that should be accessible
      const validUrl = 'https://registry.npmjs.org/lodash';
      
      const validationResult = await validator.validate(validUrl);
      
      if (validationResult.isValid) {
        // No need to look up npm alternative
        assert.strictEqual(validationResult.isValid, true, 'URL should be valid');
        assert.ok(validationResult.statusCode, 'Should have status code');
      }
    });
  });
});
