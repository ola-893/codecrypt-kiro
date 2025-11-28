/**
 * Tests for dependency analysis service
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { detectAndParsePackageJson, extractDependencies, analyzeDependency, analyzeAllDependencies, buildDependencyReport, analyzeDependencies } from '../services/dependencyAnalysis';
import { CodeCryptError } from '../utils/errors';

suite('Dependency Analysis Service', () => {
  let tempDir: string;

  setup(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-test-'));
  });

  teardown(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  suite('detectAndParsePackageJson', () => {
    test('should successfully parse valid package.json', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'express': '^4.17.1',
          'lodash': '4.17.21'
        },
        devDependencies: {
          'typescript': '^4.5.0'
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await detectAndParsePackageJson(tempDir);

      assert.strictEqual(result.name, 'test-project');
      assert.strictEqual(result.version, '1.0.0');
      assert.strictEqual(Object.keys(result.dependencies || {}).length, 2);
      assert.strictEqual(Object.keys(result.devDependencies || {}).length, 1);
    });

    test('should throw error when package.json not found', async () => {
      await assert.rejects(
        async () => await detectAndParsePackageJson(tempDir),
        (error: any) => {
          assert.ok(error instanceof CodeCryptError);
          assert.strictEqual(error.code, 'PACKAGE_JSON_NOT_FOUND');
          return true;
        }
      );
    });

    test('should throw error for malformed JSON', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        '{ invalid json }'
      );

      await assert.rejects(
        async () => await detectAndParsePackageJson(tempDir),
        (error: any) => {
          assert.ok(error instanceof CodeCryptError);
          assert.strictEqual(error.code, 'MALFORMED_PACKAGE_JSON');
          return true;
        }
      );
    });

    test('should handle package.json with no dependencies', async () => {
      const packageJson = {
        name: 'minimal-project',
        version: '1.0.0'
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const result = await detectAndParsePackageJson(tempDir);

      assert.strictEqual(result.name, 'minimal-project');
      assert.strictEqual(result.dependencies, undefined);
      assert.strictEqual(result.devDependencies, undefined);
    });
  });

  suite('extractDependencies', () => {
    test('should extract all dependencies and devDependencies', () => {
      const packageJson = {
        dependencies: {
          'express': '^4.17.1',
          'lodash': '4.17.21'
        },
        devDependencies: {
          'typescript': '^4.5.0',
          'jest': '^27.0.0'
        }
      };

      const result = extractDependencies(packageJson);

      assert.strictEqual(result.size, 4);
      assert.strictEqual(result.get('express'), '^4.17.1');
      assert.strictEqual(result.get('lodash'), '4.17.21');
      assert.strictEqual(result.get('typescript'), '^4.5.0');
      assert.strictEqual(result.get('jest'), '^27.0.0');
    });

    test('should handle package.json with only dependencies', () => {
      const packageJson = {
        dependencies: {
          'express': '^4.17.1'
        }
      };

      const result = extractDependencies(packageJson);

      assert.strictEqual(result.size, 1);
      assert.strictEqual(result.get('express'), '^4.17.1');
    });

    test('should handle package.json with only devDependencies', () => {
      const packageJson = {
        devDependencies: {
          'typescript': '^4.5.0'
        }
      };

      const result = extractDependencies(packageJson);

      assert.strictEqual(result.size, 1);
      assert.strictEqual(result.get('typescript'), '^4.5.0');
    });

    test('should return empty map for package.json with no dependencies', () => {
      const packageJson = {};

      const result = extractDependencies(packageJson);

      assert.strictEqual(result.size, 0);
    });
  });

  suite('analyzeDependency', () => {
    test('should identify outdated dependency', async () => {
      // Test with a real package that's likely to have updates
      const result = await analyzeDependency('express', '3.0.0');
      
      assert.strictEqual(result.name, 'express');
      assert.strictEqual(result.currentVersion, '3.0.0');
      assert.ok(result.latestVersion !== 'unknown');
      assert.ok(result.latestVersion !== '3.0.0'); // Should be newer
      assert.strictEqual(result.updateStatus, 'pending');
    });

    test('should handle non-existent package gracefully', async () => {
      const result = await analyzeDependency('this-package-definitely-does-not-exist-12345', '1.0.0');
      
      assert.strictEqual(result.name, 'this-package-definitely-does-not-exist-12345');
      assert.strictEqual(result.currentVersion, '1.0.0');
      assert.strictEqual(result.latestVersion, 'unknown');
      assert.strictEqual(result.updateStatus, 'failed');
    });
  });

  suite('analyzeAllDependencies', () => {
    test('should analyze multiple dependencies', async () => {
      const dependencies = new Map([
        ['lodash', '4.17.0'],
        ['express', '4.0.0']
      ]);
      
      const results = await analyzeAllDependencies(dependencies);
      
      assert.strictEqual(results.length, 2);
      assert.ok(results.some(r => r.name === 'lodash'));
      assert.ok(results.some(r => r.name === 'express'));
    });

    test('should handle empty dependencies map', async () => {
      const dependencies = new Map<string, string>();
      
      const results = await analyzeAllDependencies(dependencies);
      
      assert.strictEqual(results.length, 0);
    });
  });

  suite('buildDependencyReport', () => {
    test('should build report with correct statistics', async () => {
      const dependencies: any[] = [
        {
          name: 'express',
          currentVersion: '3.0.0',
          latestVersion: '4.18.0',
          vulnerabilities: [
            { id: 'CVE-2021-1234', severity: 'high' as const }
          ],
          updateStatus: 'pending' as const
        },
        {
          name: 'lodash',
          currentVersion: '4.17.0',
          latestVersion: '4.17.21',
          vulnerabilities: [],
          updateStatus: 'pending' as const
        },
        {
          name: 'react',
          currentVersion: '18.0.0',
          latestVersion: '18.0.0',
          vulnerabilities: [],
          updateStatus: 'pending' as const
        }
      ];

      const report = buildDependencyReport(dependencies);

      assert.strictEqual(report.totalDependencies, 3);
      assert.strictEqual(report.outdatedDependencies, 2);
      assert.strictEqual(report.vulnerableDependencies, 1);
      assert.strictEqual(report.totalVulnerabilities, 1);
      assert.ok(report.generatedAt instanceof Date);
    });

    test('should prioritize vulnerable dependencies in report', async () => {
      const dependencies: any[] = [
        {
          name: 'safe-package',
          currentVersion: '1.0.0',
          latestVersion: '2.0.0',
          vulnerabilities: [],
          updateStatus: 'pending' as const
        },
        {
          name: 'vulnerable-package',
          currentVersion: '1.0.0',
          latestVersion: '1.0.0',
          vulnerabilities: [
            { id: 'CVE-2021-1234', severity: 'critical' as const }
          ],
          updateStatus: 'pending' as const
        }
      ];

      const report = buildDependencyReport(dependencies);

      // Vulnerable package should be first
      assert.strictEqual(report.dependencies[0].name, 'vulnerable-package');
      assert.strictEqual(report.dependencies[1].name, 'safe-package');
    });

    test('should handle empty dependencies array', async () => {
      const report = buildDependencyReport([]);

      assert.strictEqual(report.totalDependencies, 0);
      assert.strictEqual(report.outdatedDependencies, 0);
      assert.strictEqual(report.vulnerableDependencies, 0);
      assert.strictEqual(report.totalVulnerabilities, 0);
    });
  });

  suite('analyzeDependencies (integration)', () => {
    test('should perform complete analysis on repository', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'lodash': '4.17.0'
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const report = await analyzeDependencies(tempDir);

      assert.ok(report.totalDependencies >= 1);
      assert.ok(report.generatedAt instanceof Date);
      assert.ok(Array.isArray(report.dependencies));
    });

    test('should handle repository with no dependencies', async () => {
      const packageJson = {
        name: 'minimal-project',
        version: '1.0.0'
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const report = await analyzeDependencies(tempDir);

      assert.strictEqual(report.totalDependencies, 0);
      assert.strictEqual(report.outdatedDependencies, 0);
    });
  });
});
