/**
 * Unit Tests for PackageReplacementRegistry Pattern Matching
 * 
 * Tests exact matches, wildcards, priority, and no-match cases
 * Requirements: 3.2, 3.4
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PackageReplacementRegistry } from '../services/packageReplacementRegistry';

suite('PackageReplacementRegistry Pattern Matching Unit Tests', () => {
  let tempDir: string;

  setup(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pattern-matching-test-'));
  });

  teardown(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  suite('Exact Pattern Matches', () => {
    test('should match exact URL without wildcards', async () => {
      const registryPath = path.join(tempDir, 'exact-match.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/user/repo/archive/v1.0.0.tar.gz',
            replacementPackage: 'exact-package',
            replacementVersion: '^1.0.0',
            reason: 'Exact match test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match exact URL
      const match = registryInstance.matchesDeadUrlPattern('github.com/user/repo/archive/v1.0.0.tar.gz');
      assert.ok(match !== null, 'Should match exact URL');
      assert.strictEqual(match?.replacementPackage, 'exact-package');
    });

    test('should not match URL that differs from exact pattern', async () => {
      const registryPath = path.join(tempDir, 'exact-no-match.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/user/repo/archive/v1.0.0.tar.gz',
            replacementPackage: 'exact-package',
            replacementVersion: '^1.0.0',
            reason: 'Exact match test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should not match different URL
      const match = registryInstance.matchesDeadUrlPattern('github.com/user/repo/archive/v2.0.0.tar.gz');
      assert.strictEqual(match, null, 'Should not match different URL');
    });

    test('should match URL with protocol prefix', async () => {
      const registryPath = path.join(tempDir, 'protocol-match.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/user/repo',
            replacementPackage: 'test-package',
            replacementVersion: '^1.0.0',
            reason: 'Protocol test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match with or without protocol
      const match1 = registryInstance.matchesDeadUrlPattern('github.com/user/repo');
      const match2 = registryInstance.matchesDeadUrlPattern('https://github.com/user/repo');
      
      assert.ok(match1 !== null, 'Should match without protocol');
      assert.ok(match2 !== null, 'Should match with protocol');
    });
  });

  suite('Single Wildcard (*) Matching', () => {
    test('should match single wildcard in path segment', async () => {
      const registryPath = path.join(tempDir, 'single-wildcard.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/substack/*/archive/v1.0.0.tar.gz',
            replacementPackage: 'wildcard-package',
            replacementVersion: '^1.0.0',
            reason: 'Single wildcard test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match with any single path segment
      const match1 = registryInstance.matchesDeadUrlPattern('github.com/substack/querystring/archive/v1.0.0.tar.gz');
      const match2 = registryInstance.matchesDeadUrlPattern('github.com/substack/another-repo/archive/v1.0.0.tar.gz');
      
      assert.ok(match1 !== null, 'Should match first URL');
      assert.ok(match2 !== null, 'Should match second URL');
      assert.strictEqual(match1?.replacementPackage, 'wildcard-package');
    });

    test('should not match wildcard across path separators', async () => {
      const registryPath = path.join(tempDir, 'wildcard-no-slash.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/*/repo',
            replacementPackage: 'test-package',
            replacementVersion: '^1.0.0',
            reason: 'Wildcard boundary test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match single segment
      const match1 = registryInstance.matchesDeadUrlPattern('github.com/user/repo');
      assert.ok(match1 !== null, 'Should match single segment');
      
      // Should not match multiple segments
      const match2 = registryInstance.matchesDeadUrlPattern('github.com/user/org/repo');
      assert.strictEqual(match2, null, 'Should not match multiple segments');
    });

    test('should match wildcard at end of pattern', async () => {
      const registryPath = path.join(tempDir, 'wildcard-end.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/substack/querystring/*',
            replacementPackage: 'querystring',
            replacementVersion: '^0.2.1',
            reason: 'End wildcard test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match any ending
      const match1 = registryInstance.matchesDeadUrlPattern('github.com/substack/querystring/archive');
      const match2 = registryInstance.matchesDeadUrlPattern('github.com/substack/querystring/v1.0.0');
      
      assert.ok(match1 !== null, 'Should match first ending');
      assert.ok(match2 !== null, 'Should match second ending');
    });

    test('should match multiple wildcards in pattern', async () => {
      const registryPath = path.join(tempDir, 'multiple-wildcards.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/*/*/archive/*.tar.gz',
            replacementPackage: 'generic-package',
            replacementVersion: null,
            reason: 'Multiple wildcards test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match with multiple wildcards
      const match = registryInstance.matchesDeadUrlPattern('github.com/user/repo/archive/v1.0.0.tar.gz');
      assert.ok(match !== null, 'Should match with multiple wildcards');
      assert.strictEqual(match?.replacementPackage, 'generic-package');
    });
  });

  suite('Double Wildcard (**) Matching', () => {
    test('should match double wildcard across multiple path segments', async () => {
      const registryPath = path.join(tempDir, 'double-wildcard.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/**/archive/*.tar.gz',
            replacementPackage: 'double-wildcard-package',
            replacementVersion: null,
            reason: 'Double wildcard test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match across multiple segments
      const match1 = registryInstance.matchesDeadUrlPattern('github.com/user/repo/archive/v1.tar.gz');
      const match2 = registryInstance.matchesDeadUrlPattern('github.com/org/team/project/archive/v2.tar.gz');
      const match3 = registryInstance.matchesDeadUrlPattern('github.com/a/b/c/d/archive/v3.tar.gz');
      
      assert.ok(match1 !== null, 'Should match 2 segments');
      assert.ok(match2 !== null, 'Should match 3 segments');
      assert.ok(match3 !== null, 'Should match 4 segments');
    });

    test('should match double wildcard at end of pattern', async () => {
      const registryPath = path.join(tempDir, 'double-wildcard-end.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/user/**',
            replacementPackage: 'user-package',
            replacementVersion: null,
            reason: 'Double wildcard end test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match any path after user
      const match1 = registryInstance.matchesDeadUrlPattern('github.com/user/repo');
      const match2 = registryInstance.matchesDeadUrlPattern('github.com/user/repo/archive/v1.0.0.tar.gz');
      
      assert.ok(match1 !== null, 'Should match short path');
      assert.ok(match2 !== null, 'Should match long path');
    });
  });

  suite('Pattern Priority', () => {
    test('should return first matching pattern', async () => {
      const registryPath = path.join(tempDir, 'priority.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/substack/querystring/*',
            replacementPackage: 'specific-querystring',
            replacementVersion: '^0.2.1',
            reason: 'Specific pattern'
          },
          {
            pattern: 'github.com/**/archive/*.tar.gz',
            replacementPackage: 'generic-archive',
            replacementVersion: null,
            reason: 'Generic pattern'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match first (more specific) pattern
      const match = registryInstance.matchesDeadUrlPattern('github.com/substack/querystring/archive/v1.0.0.tar.gz');
      assert.ok(match !== null, 'Should find a match');
      assert.strictEqual(match?.replacementPackage, 'specific-querystring', 'Should use first matching pattern');
    });

    test('should fall through to second pattern if first does not match', async () => {
      const registryPath = path.join(tempDir, 'fallthrough.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/substack/querystring/*',
            replacementPackage: 'specific-querystring',
            replacementVersion: '^0.2.1',
            reason: 'Specific pattern'
          },
          {
            pattern: 'github.com/**/archive/*.tar.gz',
            replacementPackage: 'generic-archive',
            replacementVersion: null,
            reason: 'Generic pattern'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match second pattern (first doesn't match)
      const match = registryInstance.matchesDeadUrlPattern('github.com/otheruser/otherrepo/archive/v1.0.0.tar.gz');
      assert.ok(match !== null, 'Should find a match');
      assert.strictEqual(match?.replacementPackage, 'generic-archive', 'Should use second pattern');
    });

    test('should respect pattern order for overlapping patterns', async () => {
      const registryPath = path.join(tempDir, 'overlap.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/user/repo/archive/v1.0.0.tar.gz',
            replacementPackage: 'exact-match',
            replacementVersion: '^1.0.0',
            reason: 'Exact match'
          },
          {
            pattern: 'github.com/user/*/archive/*.tar.gz',
            replacementPackage: 'wildcard-match',
            replacementVersion: '^2.0.0',
            reason: 'Wildcard match'
          },
          {
            pattern: 'github.com/**/archive/*.tar.gz',
            replacementPackage: 'double-wildcard-match',
            replacementVersion: '^3.0.0',
            reason: 'Double wildcard match'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match most specific (first) pattern
      const match = registryInstance.matchesDeadUrlPattern('github.com/user/repo/archive/v1.0.0.tar.gz');
      assert.ok(match !== null, 'Should find a match');
      assert.strictEqual(match?.replacementPackage, 'exact-match', 'Should use most specific pattern');
    });
  });

  suite('No Match Cases', () => {
    test('should return null when no patterns match', async () => {
      const registryPath = path.join(tempDir, 'no-match.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/substack/querystring/*',
            replacementPackage: 'querystring',
            replacementVersion: '^0.2.1',
            reason: 'Specific pattern'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should not match different URL
      const match = registryInstance.matchesDeadUrlPattern('npmjs.org/package/some-package');
      assert.strictEqual(match, null, 'Should return null for non-matching URL');
    });

    test('should return null when pattern list is empty', async () => {
      const registryPath = path.join(tempDir, 'empty-patterns.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: []
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should return null with empty pattern list
      const match = registryInstance.matchesDeadUrlPattern('github.com/user/repo');
      assert.strictEqual(match, null, 'Should return null with empty patterns');
    });

    test('should return null when deadUrlPatterns field is missing', async () => {
      const registryPath = path.join(tempDir, 'no-patterns-field.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: []
        // No deadUrlPatterns field
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should return null when field is missing
      const match = registryInstance.matchesDeadUrlPattern('github.com/user/repo');
      assert.strictEqual(match, null, 'Should return null when deadUrlPatterns field is missing');
    });

    test('should not match partial pattern', async () => {
      const registryPath = path.join(tempDir, 'partial-match.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/user/repo/archive',
            replacementPackage: 'test-package',
            replacementVersion: '^1.0.0',
            reason: 'Partial match test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should not match if URL is shorter than pattern
      const match1 = registryInstance.matchesDeadUrlPattern('github.com/user/repo');
      assert.strictEqual(match1, null, 'Should not match shorter URL');
      
      // Should match exact pattern
      const match2 = registryInstance.matchesDeadUrlPattern('github.com/user/repo/archive');
      assert.ok(match2 !== null, 'Should match exact pattern');
    });
  });

  suite('Special Characters in Patterns', () => {
    test('should handle dots in domain names', async () => {
      const registryPath = path.join(tempDir, 'dots.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'raw.githubusercontent.com/*/master/*',
            replacementPackage: 'raw-content',
            replacementVersion: null,
            reason: 'Raw content test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match with dots in domain
      const match = registryInstance.matchesDeadUrlPattern('raw.githubusercontent.com/user/master/file.js');
      assert.ok(match !== null, 'Should match domain with dots');
    });

    test('should handle hyphens in URLs', async () => {
      const registryPath = path.join(tempDir, 'hyphens.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/my-org/my-repo/*',
            replacementPackage: 'hyphen-package',
            replacementVersion: '^1.0.0',
            reason: 'Hyphen test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match with hyphens
      const match = registryInstance.matchesDeadUrlPattern('github.com/my-org/my-repo/archive');
      assert.ok(match !== null, 'Should match URLs with hyphens');
    });

    test('should handle underscores in URLs', async () => {
      const registryPath = path.join(tempDir, 'underscores.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/my_org/my_repo/*',
            replacementPackage: 'underscore-package',
            replacementVersion: '^1.0.0',
            reason: 'Underscore test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match with underscores
      const match = registryInstance.matchesDeadUrlPattern('github.com/my_org/my_repo/archive');
      assert.ok(match !== null, 'Should match URLs with underscores');
    });
  });

  suite('Edge Cases', () => {
    test('should handle empty URL', async () => {
      const registryPath = path.join(tempDir, 'empty-url.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/*',
            replacementPackage: 'test-package',
            replacementVersion: '^1.0.0',
            reason: 'Empty URL test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should not match empty URL
      const match = registryInstance.matchesDeadUrlPattern('');
      assert.strictEqual(match, null, 'Should not match empty URL');
    });

    test('should handle very long URLs', async () => {
      const registryPath = path.join(tempDir, 'long-url.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/**',
            replacementPackage: 'test-package',
            replacementVersion: '^1.0.0',
            reason: 'Long URL test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Create a very long URL
      const longPath = 'a/'.repeat(100);
      const longUrl = `github.com/${longPath}file.tar.gz`;
      
      // Should match long URL
      const match = registryInstance.matchesDeadUrlPattern(longUrl);
      assert.ok(match !== null, 'Should match very long URL');
    });

    test('should handle URL with query parameters', async () => {
      const registryPath = path.join(tempDir, 'query-params.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/user/repo/*',
            replacementPackage: 'test-package',
            replacementVersion: '^1.0.0',
            reason: 'Query params test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match URL with query parameters
      const match = registryInstance.matchesDeadUrlPattern('github.com/user/repo/file?ref=main&token=abc123');
      assert.ok(match !== null, 'Should match URL with query parameters');
    });

    test('should handle URL with fragment', async () => {
      const registryPath = path.join(tempDir, 'fragment.json');
      
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        replacements: [],
        architectureIncompatible: [],
        knownDeadUrls: [],
        deadUrlPatterns: [
          {
            pattern: 'github.com/user/repo/*',
            replacementPackage: 'test-package',
            replacementVersion: '^1.0.0',
            reason: 'Fragment test'
          }
        ]
      };
      
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
      
      const registryInstance = new PackageReplacementRegistry(registryPath);
      await registryInstance.load();
      
      // Should match URL with fragment
      const match = registryInstance.matchesDeadUrlPattern('github.com/user/repo/file#section');
      assert.ok(match !== null, 'Should match URL with fragment');
    });
  });
});
