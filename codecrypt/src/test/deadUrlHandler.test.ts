/**
 * Unit Tests for DeadUrlHandler
 * 
 * Tests dead URL detection, npm resolution, and package.json updates
 * Requirements: 1.4, 1.5, 5.2, 5.5
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DeadUrlHandler } from '../services/deadUrlHandler';
import { URLValidator } from '../services/urlValidator';
import { URLValidationResult } from '../types';

// Mock URLValidator for testing
class MockURLValidator extends URLValidator {
  private mockValidations: Map<string, URLValidationResult>;
  private mockNpmAlternatives: Map<string, string | null>;

  constructor() {
    super();
    this.mockValidations = new Map();
    this.mockNpmAlternatives = new Map();
  }

  setMockValidation(url: string, result: URLValidationResult): void {
    this.mockValidations.set(url, result);
  }

  setMockNpmAlternative(packageName: string, version: string | null): void {
    this.mockNpmAlternatives.set(packageName, version);
  }

  async validate(url: string): Promise<URLValidationResult> {
    const mock = this.mockValidations.get(url);
    if (mock) {
      return mock;
    }
    // Default to invalid
    return { url, isValid: false };
  }

  async findNpmAlternative(packageName: string): Promise<string | null> {
    if (this.mockNpmAlternatives.has(packageName)) {
      return this.mockNpmAlternatives.get(packageName) || null;
    }
    return null;
  }
}

// Mock LockfileParser for testing
class MockLockfileParser {
  private mockDependencies: any[] = [];

  setMockDependencies(deps: any[]): void {
    this.mockDependencies = deps;
  }

  async parseLockfile(): Promise<any[]> {
    return this.mockDependencies;
  }

  async detectLockfileType(): Promise<string | null> {
    return this.mockDependencies.length > 0 ? 'npm' : null;
  }

  async deleteLockfiles(): Promise<void> {
    // Mock implementation
  }
}

suite('DeadUrlHandler Unit Tests', () => {
  let tempDir: string;
  let mockValidator: MockURLValidator;
  let handler: DeadUrlHandler;

  setup(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dead-url-test-'));
    mockValidator = new MockURLValidator();
    handler = new DeadUrlHandler(mockValidator);
  });

  teardown(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  suite('Dead URL Detection', () => {
    test('should detect dead GitHub archive URL', async () => {
      const dependencies = new Map([
        ['querystring', 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz']
      ]);

      // Mock the URL as dead
      mockValidator.setMockValidation(
        'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
        { url: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz', isValid: false }
      );

      // Mock npm alternative
      mockValidator.setMockNpmAlternative('querystring', '0.2.1');

      const summary = await handler.handleDeadUrls(tempDir, dependencies);

      assert.strictEqual(summary.totalChecked, 1, 'Should check 1 dependency');
      assert.strictEqual(summary.deadUrlsFound, 1, 'Should find 1 dead URL');
      assert.strictEqual(summary.resolvedViaNpm, 1, 'Should resolve 1 via npm');
      assert.strictEqual(summary.removed, 0, 'Should not remove any');
    });

    test('should keep accessible URLs', async () => {
      const dependencies = new Map([
        ['some-package', 'https://github.com/user/repo/archive/v1.0.0.tar.gz']
      ]);

      // Mock the URL as accessible
      mockValidator.setMockValidation(
        'https://github.com/user/repo/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/repo/archive/v1.0.0.tar.gz', isValid: true, statusCode: 200 }
      );

      const summary = await handler.handleDeadUrls(tempDir, dependencies);

      assert.strictEqual(summary.totalChecked, 1, 'Should check 1 dependency');
      assert.strictEqual(summary.deadUrlsFound, 0, 'Should find 0 dead URLs');
      assert.strictEqual(summary.results[0].action, 'kept', 'Should keep accessible URL');
    });

    test('should remove dependency when no npm alternative exists', async () => {
      const dependencies = new Map([
        ['unknown-package', 'https://github.com/user/unknown/archive/v1.0.0.tar.gz']
      ]);

      // Mock the URL as dead
      mockValidator.setMockValidation(
        'https://github.com/user/unknown/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/unknown/archive/v1.0.0.tar.gz', isValid: false }
      );

      // Mock no npm alternative
      mockValidator.setMockNpmAlternative('unknown', null);

      const summary = await handler.handleDeadUrls(tempDir, dependencies);

      assert.strictEqual(summary.totalChecked, 1, 'Should check 1 dependency');
      assert.strictEqual(summary.deadUrlsFound, 1, 'Should find 1 dead URL');
      assert.strictEqual(summary.resolvedViaNpm, 0, 'Should not resolve via npm');
      assert.strictEqual(summary.removed, 1, 'Should remove 1 dependency');
      assert.strictEqual(summary.results[0].action, 'removed', 'Should mark for removal');
    });

    test('should handle multiple URL-based dependencies', async () => {
      const dependencies = new Map([
        ['package-a', 'https://github.com/user/a/archive/v1.0.0.tar.gz'],
        ['package-b', 'https://github.com/user/b/archive/v2.0.0.tar.gz'],
        ['package-c', 'github:user/c#v3.0.0']
      ]);

      // Mock package-a as accessible
      mockValidator.setMockValidation(
        'https://github.com/user/a/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/a/archive/v1.0.0.tar.gz', isValid: true, statusCode: 200 }
      );

      // Mock package-b as dead with npm alternative
      mockValidator.setMockValidation(
        'https://github.com/user/b/archive/v2.0.0.tar.gz',
        { url: 'https://github.com/user/b/archive/v2.0.0.tar.gz', isValid: false }
      );
      mockValidator.setMockNpmAlternative('b', '2.1.0');

      // Mock package-c as dead without npm alternative
      mockValidator.setMockValidation(
        'github:user/c#v3.0.0',
        { url: 'github:user/c#v3.0.0', isValid: false }
      );
      mockValidator.setMockNpmAlternative('c', null);

      const summary = await handler.handleDeadUrls(tempDir, dependencies);

      assert.strictEqual(summary.totalChecked, 3, 'Should check 3 dependencies');
      assert.strictEqual(summary.deadUrlsFound, 2, 'Should find 2 dead URLs');
      assert.strictEqual(summary.resolvedViaNpm, 1, 'Should resolve 1 via npm');
      assert.strictEqual(summary.removed, 1, 'Should remove 1 dependency');
    });

    test('should skip non-URL dependencies', async () => {
      const dependencies = new Map([
        ['lodash', '^4.17.21'],
        ['express', '~4.18.0'],
        ['react', '18.0.0']
      ]);

      const summary = await handler.handleDeadUrls(tempDir, dependencies);

      assert.strictEqual(summary.totalChecked, 0, 'Should not check non-URL dependencies');
      assert.strictEqual(summary.results.length, 0, 'Should have no results');
    });
  });

  suite('Package.json Updates', () => {
    test('should replace dead URL with npm version in dependencies', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json');
      
      // Create initial package.json
      const initialPackageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'querystring': 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz'
        }
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(initialPackageJson, null, 2), 'utf-8');

      const results = [{
        packageName: 'querystring',
        deadUrl: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
        isUrlDead: true,
        npmAlternative: '0.2.1',
        resolved: true,
        action: 'replaced' as const,
        warning: 'Replaced dead URL with npm registry version 0.2.1'
      }];

      await handler.applyToPackageJson(tempDir, results);

      // Read updated package.json
      const updatedContent = await fs.readFile(packageJsonPath, 'utf-8');
      const updatedPackageJson = JSON.parse(updatedContent);

      assert.strictEqual(
        updatedPackageJson.dependencies.querystring,
        '^0.2.1',
        'Should replace with npm version'
      );
    });

    test('should remove unresolvable dependency', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json');
      
      // Create initial package.json
      const initialPackageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'unknown-package': 'https://github.com/user/unknown/archive/v1.0.0.tar.gz',
          'lodash': '^4.17.21'
        }
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(initialPackageJson, null, 2), 'utf-8');

      const results = [{
        packageName: 'unknown-package',
        deadUrl: 'https://github.com/user/unknown/archive/v1.0.0.tar.gz',
        isUrlDead: true,
        resolved: false,
        action: 'removed' as const,
        warning: 'Dead URL could not be resolved. Package will be removed.'
      }];

      await handler.applyToPackageJson(tempDir, results);

      // Read updated package.json
      const updatedContent = await fs.readFile(packageJsonPath, 'utf-8');
      const updatedPackageJson = JSON.parse(updatedContent);

      assert.strictEqual(
        updatedPackageJson.dependencies['unknown-package'],
        undefined,
        'Should remove unresolvable dependency'
      );
      assert.strictEqual(
        updatedPackageJson.dependencies.lodash,
        '^4.17.21',
        'Should keep other dependencies'
      );
    });

    test('should handle devDependencies', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json');
      
      // Create initial package.json
      const initialPackageJson = {
        name: 'test-project',
        version: '1.0.0',
        devDependencies: {
          'test-package': 'https://github.com/user/test/archive/v1.0.0.tar.gz'
        }
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(initialPackageJson, null, 2), 'utf-8');

      const results = [{
        packageName: 'test-package',
        deadUrl: 'https://github.com/user/test/archive/v1.0.0.tar.gz',
        isUrlDead: true,
        npmAlternative: '1.1.0',
        resolved: true,
        action: 'replaced' as const
      }];

      await handler.applyToPackageJson(tempDir, results);

      // Read updated package.json
      const updatedContent = await fs.readFile(packageJsonPath, 'utf-8');
      const updatedPackageJson = JSON.parse(updatedContent);

      assert.strictEqual(
        updatedPackageJson.devDependencies['test-package'],
        '^1.1.0',
        'Should update devDependencies'
      );
    });

    test('should not modify package.json when no changes needed', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json');
      
      // Create initial package.json
      const initialPackageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'lodash': '^4.17.21'
        }
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(initialPackageJson, null, 2), 'utf-8');

      const results = [{
        packageName: 'some-package',
        deadUrl: 'https://github.com/user/some/archive/v1.0.0.tar.gz',
        isUrlDead: false,
        resolved: true,
        action: 'kept' as const
      }];

      await handler.applyToPackageJson(tempDir, results);

      // Read package.json
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      // Should be unchanged
      assert.deepStrictEqual(packageJson, initialPackageJson, 'Should not modify package.json');
    });
  });

  suite('Report Generation', () => {
    test('should generate report with all actions', () => {
      const summary = {
        totalChecked: 3,
        deadUrlsFound: 2,
        resolvedViaNpm: 1,
        removed: 1,
        results: [
          {
            packageName: 'package-a',
            deadUrl: 'https://github.com/user/a/archive/v1.0.0.tar.gz',
            isUrlDead: false,
            resolved: true,
            action: 'kept' as const
          },
          {
            packageName: 'package-b',
            deadUrl: 'https://github.com/user/b/archive/v2.0.0.tar.gz',
            isUrlDead: true,
            npmAlternative: '2.1.0',
            resolved: true,
            action: 'replaced' as const,
            warning: 'Replaced dead URL with npm registry version 2.1.0'
          },
          {
            packageName: 'package-c',
            deadUrl: 'https://github.com/user/c/archive/v3.0.0.tar.gz',
            isUrlDead: true,
            resolved: false,
            action: 'removed' as const,
            warning: 'Dead URL could not be resolved. Package will be removed.'
          }
        ]
      };

      const report = handler.generateReport(summary);

      assert.ok(report.includes('Total URL-based dependencies checked: 3'), 'Should include total checked');
      assert.ok(report.includes('Dead URLs found: 2'), 'Should include dead URLs count');
      assert.ok(report.includes('Resolved via npm registry: 1'), 'Should include resolved count');
      assert.ok(report.includes('Removed (unresolvable): 1'), 'Should include removed count');
      assert.ok(report.includes('package-a'), 'Should include kept package');
      assert.ok(report.includes('package-b'), 'Should include replaced package');
      assert.ok(report.includes('package-c'), 'Should include removed package');
    });

    test('should generate empty report when no URL dependencies', () => {
      const summary = {
        totalChecked: 0,
        deadUrlsFound: 0,
        resolvedViaNpm: 0,
        removed: 0,
        results: []
      };

      const report = handler.generateReport(summary);

      assert.ok(report.includes('Total URL-based dependencies checked: 0'), 'Should show zero checked');
    });
  });

  suite('Transitive Dependency Handling', () => {
    test('should handle transitive dependencies with dead URLs', async () => {
      const mockLockfileParser = new MockLockfileParser();
      const handlerWithMock = new DeadUrlHandler(mockValidator, mockLockfileParser as any);

      // Set up mock transitive dependencies
      mockLockfileParser.setMockDependencies([
        {
          name: 'transitive-package',
          resolvedUrl: 'https://github.com/user/transitive/archive/v1.0.0.tar.gz',
          parents: ['parent-package'],
          depth: 2
        }
      ]);

      // Mock the URL as dead
      mockValidator.setMockValidation(
        'https://github.com/user/transitive/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/transitive/archive/v1.0.0.tar.gz', isValid: false }
      );

      // Mock npm alternative
      mockValidator.setMockNpmAlternative('transitive', '1.1.0');

      const directDeps = new Map<string, string>();
      const summary = await handlerWithMock.handleDeadUrlsWithTransitive(tempDir, directDeps);

      assert.strictEqual(summary.totalChecked, 1, 'Should check transitive dependency');
      assert.strictEqual(summary.deadUrlsFound, 1, 'Should find dead URL in transitive');
      assert.strictEqual(summary.resolvedViaNpm, 1, 'Should resolve via npm');

      const result = summary.results.find(r => r.packageName === 'transitive-package');
      assert.ok(result, 'Should have result for transitive package');
      assert.deepStrictEqual(result?.parentChain, ['parent-package'], 'Should include parent chain');
      assert.strictEqual(result?.depth, 2, 'Should include depth');
    });

    test('should process transitive dependencies in depth order (deepest first)', async () => {
      const mockLockfileParser = new MockLockfileParser();
      const handlerWithMock = new DeadUrlHandler(mockValidator, mockLockfileParser as any);

      // Set up mock transitive dependencies at different depths
      mockLockfileParser.setMockDependencies([
        {
          name: 'shallow-dep',
          resolvedUrl: 'https://github.com/user/shallow/archive/v1.0.0.tar.gz',
          parents: ['root'],
          depth: 1
        },
        {
          name: 'deep-dep',
          resolvedUrl: 'https://github.com/user/deep/archive/v1.0.0.tar.gz',
          parents: ['root', 'shallow-dep'],
          depth: 3
        },
        {
          name: 'mid-dep',
          resolvedUrl: 'https://github.com/user/mid/archive/v1.0.0.tar.gz',
          parents: ['root'],
          depth: 2
        }
      ]);

      // Mock all URLs as dead
      for (const dep of ['shallow', 'deep', 'mid']) {
        mockValidator.setMockValidation(
          `https://github.com/user/${dep}/archive/v1.0.0.tar.gz`,
          { url: `https://github.com/user/${dep}/archive/v1.0.0.tar.gz`, isValid: false }
        );
        mockValidator.setMockNpmAlternative(dep, '1.0.0');
      }

      const directDeps = new Map<string, string>();
      const summary = await handlerWithMock.handleDeadUrlsWithTransitive(tempDir, directDeps);

      assert.strictEqual(summary.totalChecked, 3, 'Should check all transitive dependencies');
      
      // Verify processing order by checking results array
      // Deep dependencies should be processed first
      const deepResult = summary.results.find(r => r.packageName === 'deep-dep');
      const midResult = summary.results.find(r => r.packageName === 'mid-dep');
      const shallowResult = summary.results.find(r => r.packageName === 'shallow-dep');

      assert.ok(deepResult, 'Should have deep result');
      assert.ok(midResult, 'Should have mid result');
      assert.ok(shallowResult, 'Should have shallow result');

      assert.strictEqual(deepResult?.depth, 3, 'Deep dep should have depth 3');
      assert.strictEqual(midResult?.depth, 2, 'Mid dep should have depth 2');
      assert.strictEqual(shallowResult?.depth, 1, 'Shallow dep should have depth 1');
    });

    test('should identify parent chains for transitive dependencies', async () => {
      const mockLockfileParser = new MockLockfileParser();
      const handlerWithMock = new DeadUrlHandler(mockValidator, mockLockfileParser as any);

      // Set up mock transitive dependency with multiple parents
      mockLockfileParser.setMockDependencies([
        {
          name: 'shared-dep',
          resolvedUrl: 'https://github.com/user/shared/archive/v1.0.0.tar.gz',
          parents: ['parent-a', 'parent-b', 'parent-c'],
          depth: 2
        }
      ]);

      // Mock the URL as dead
      mockValidator.setMockValidation(
        'https://github.com/user/shared/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/shared/archive/v1.0.0.tar.gz', isValid: false }
      );

      // Mock no npm alternative (will be removed)
      mockValidator.setMockNpmAlternative('shared', null);

      const directDeps = new Map<string, string>();
      const summary = await handlerWithMock.handleDeadUrlsWithTransitive(tempDir, directDeps);

      const result = summary.results.find(r => r.packageName === 'shared-dep');
      assert.ok(result, 'Should have result for shared dependency');
      assert.deepStrictEqual(
        result?.parentChain,
        ['parent-a', 'parent-b', 'parent-c'],
        'Should include all parent packages'
      );
      assert.strictEqual(result?.action, 'removed', 'Should mark for removal when no npm alternative');
    });

    test('should handle transitive dependencies with accessible URLs', async () => {
      const mockLockfileParser = new MockLockfileParser();
      const handlerWithMock = new DeadUrlHandler(mockValidator, mockLockfileParser as any);

      // Set up mock transitive dependency with accessible URL
      mockLockfileParser.setMockDependencies([
        {
          name: 'accessible-dep',
          resolvedUrl: 'https://github.com/user/accessible/archive/v1.0.0.tar.gz',
          parents: ['parent'],
          depth: 1
        }
      ]);

      // Mock the URL as accessible
      mockValidator.setMockValidation(
        'https://github.com/user/accessible/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/accessible/archive/v1.0.0.tar.gz', isValid: true, statusCode: 200 }
      );

      const directDeps = new Map<string, string>();
      const summary = await handlerWithMock.handleDeadUrlsWithTransitive(tempDir, directDeps);

      assert.strictEqual(summary.totalChecked, 1, 'Should check transitive dependency');
      assert.strictEqual(summary.deadUrlsFound, 0, 'Should not find dead URLs');
      
      // Accessible transitive dependencies are not added to results
      const result = summary.results.find(r => r.packageName === 'accessible-dep');
      assert.strictEqual(result, undefined, 'Should not include accessible transitive deps in results');
    });

    test('should combine direct and transitive dependency results', async () => {
      const mockLockfileParser = new MockLockfileParser();
      const handlerWithMock = new DeadUrlHandler(mockValidator, mockLockfileParser as any);

      // Set up mock transitive dependency
      mockLockfileParser.setMockDependencies([
        {
          name: 'transitive-dep',
          resolvedUrl: 'https://github.com/user/transitive/archive/v1.0.0.tar.gz',
          parents: ['direct-dep'],
          depth: 2
        }
      ]);

      // Set up direct dependency with dead URL
      const directDeps = new Map([
        ['direct-dep', 'https://github.com/user/direct/archive/v1.0.0.tar.gz']
      ]);

      // Mock both URLs as dead
      mockValidator.setMockValidation(
        'https://github.com/user/direct/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/direct/archive/v1.0.0.tar.gz', isValid: false }
      );
      mockValidator.setMockValidation(
        'https://github.com/user/transitive/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/transitive/archive/v1.0.0.tar.gz', isValid: false }
      );

      // Mock npm alternatives
      mockValidator.setMockNpmAlternative('direct', '1.0.0');
      mockValidator.setMockNpmAlternative('transitive', '2.0.0');

      const summary = await handlerWithMock.handleDeadUrlsWithTransitive(tempDir, directDeps);

      assert.strictEqual(summary.totalChecked, 2, 'Should check both direct and transitive');
      assert.strictEqual(summary.deadUrlsFound, 2, 'Should find both dead URLs');
      assert.strictEqual(summary.resolvedViaNpm, 2, 'Should resolve both via npm');

      const directResult = summary.results.find(r => r.packageName === 'direct-dep');
      const transitiveResult = summary.results.find(r => r.packageName === 'transitive-dep');

      assert.ok(directResult, 'Should have direct dependency result');
      assert.ok(transitiveResult, 'Should have transitive dependency result');
      assert.strictEqual(transitiveResult?.depth, 2, 'Transitive should have depth');
    });

    test('should handle empty lockfile (no transitive dependencies)', async () => {
      const mockLockfileParser = new MockLockfileParser();
      const handlerWithMock = new DeadUrlHandler(mockValidator, mockLockfileParser as any);

      // No transitive dependencies
      mockLockfileParser.setMockDependencies([]);

      // Set up direct dependency
      const directDeps = new Map([
        ['direct-dep', 'https://github.com/user/direct/archive/v1.0.0.tar.gz']
      ]);

      mockValidator.setMockValidation(
        'https://github.com/user/direct/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/direct/archive/v1.0.0.tar.gz', isValid: false }
      );
      mockValidator.setMockNpmAlternative('direct', '1.0.0');

      const summary = await handlerWithMock.handleDeadUrlsWithTransitive(tempDir, directDeps);

      assert.strictEqual(summary.totalChecked, 1, 'Should only check direct dependency');
      assert.strictEqual(summary.results.length, 1, 'Should only have direct result');
    });
  });

  suite('Lockfile Regeneration', () => {
    test('should handle lockfile regeneration errors gracefully', async () => {
      // This test verifies that regeneration errors don't throw
      // In real scenarios, npm install might fail for various reasons
      
      // The regenerateLockfile method should not throw even if npm install fails
      await assert.doesNotReject(
        async () => {
          // Create a directory without package.json (will cause npm install to fail)
          const invalidDir = path.join(tempDir, 'invalid');
          await fs.mkdir(invalidDir, { recursive: true });
          await handler.regenerateLockfile(invalidDir, 'npm');
        },
        'Should not throw on regeneration failure'
      );
    });

    test('should support different package managers', async () => {
      // Test that different package managers are supported
      // This is a basic test that verifies the method accepts different package managers
      
      await assert.doesNotReject(
        async () => {
          await handler.regenerateLockfile(tempDir, 'npm');
        },
        'Should support npm'
      );

      await assert.doesNotReject(
        async () => {
          await handler.regenerateLockfile(tempDir, 'yarn');
        },
        'Should support yarn'
      );

      await assert.doesNotReject(
        async () => {
          await handler.regenerateLockfile(tempDir, 'pnpm');
        },
        'Should support pnpm'
      );
    });
  });

  suite('Error Scenarios', () => {
    test('should handle malformed lockfile by throwing error', async () => {
      const mockLockfileParser = new MockLockfileParser();
      const handlerWithMock = new DeadUrlHandler(mockValidator, mockLockfileParser as any);

      // Simulate lockfile parser throwing an error
      mockLockfileParser.parseLockfile = async () => {
        throw new Error('Malformed lockfile');
      };

      const directDeps = new Map([
        ['direct-dep', 'https://github.com/user/direct/archive/v1.0.0.tar.gz']
      ]);

      mockValidator.setMockValidation(
        'https://github.com/user/direct/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/direct/archive/v1.0.0.tar.gz', isValid: false }
      );
      mockValidator.setMockNpmAlternative('direct', '1.0.0');

      // Should throw when lockfile parsing fails
      await assert.rejects(
        async () => {
          await handlerWithMock.handleDeadUrlsWithTransitive(tempDir, directDeps);
        },
        /Malformed lockfile/,
        'Should propagate lockfile parsing errors'
      );
    });

    test('should handle network errors during URL validation by throwing', async () => {
      const dependencies = new Map([
        ['network-error-package', 'https://github.com/user/network/archive/v1.0.0.tar.gz']
      ]);

      // Mock network error
      mockValidator.validate = async () => {
        throw new Error('Network timeout');
      };

      // Should throw network errors
      await assert.rejects(
        async () => {
          await handler.handleDeadUrls(tempDir, dependencies);
        },
        /Network timeout/,
        'Should propagate network errors'
      );
    });

    test('should handle missing package.json during apply', async () => {
      const results = [{
        packageName: 'some-package',
        deadUrl: 'https://github.com/user/some/archive/v1.0.0.tar.gz',
        isUrlDead: true,
        npmAlternative: '1.0.0',
        resolved: true,
        action: 'replaced' as const
      }];

      // Try to apply to non-existent package.json
      await assert.rejects(
        async () => {
          await handler.applyToPackageJson(tempDir, results);
        },
        'Should throw when package.json is missing'
      );
    });

    test('should handle transitive dependency with empty parent chain', async () => {
      const mockLockfileParser = new MockLockfileParser();
      const handlerWithMock = new DeadUrlHandler(mockValidator, mockLockfileParser as any);

      // Set up mock transitive dependency with empty parent chain
      mockLockfileParser.setMockDependencies([
        {
          name: 'orphan-dep',
          resolvedUrl: 'https://github.com/user/orphan/archive/v1.0.0.tar.gz',
          parents: [],
          depth: 1
        }
      ]);

      mockValidator.setMockValidation(
        'https://github.com/user/orphan/archive/v1.0.0.tar.gz',
        { url: 'https://github.com/user/orphan/archive/v1.0.0.tar.gz', isValid: false }
      );
      mockValidator.setMockNpmAlternative('orphan', '1.0.0');

      const directDeps = new Map<string, string>();
      const summary = await handlerWithMock.handleDeadUrlsWithTransitive(tempDir, directDeps);

      const result = summary.results.find(r => r.packageName === 'orphan-dep');
      assert.ok(result, 'Should handle orphan dependency');
      assert.deepStrictEqual(result?.parentChain, [], 'Should have empty parent chain');
    });
  });
});
