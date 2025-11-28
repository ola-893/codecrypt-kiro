/**
 * Tests for Reporting Service
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { generateResurrectionReport, saveResurrectionReport } from '../services/reporting';
import { ResurrectionContext } from '../types';

suite('Reporting Service', () => {
  suite('generateResurrectionReport', () => {
    test('should generate a report with successful updates', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [
          {
            name: 'express',
            currentVersion: '3.0.0',
            latestVersion: '4.18.0',
            vulnerabilities: [],
            updateStatus: 'success'
          },
          {
            name: 'lodash',
            currentVersion: '4.0.0',
            latestVersion: '4.17.21',
            vulnerabilities: [
              {
                id: 'CVE-2021-23337',
                severity: 'high',
                description: 'Command injection vulnerability'
              }
            ],
            updateStatus: 'success'
          }
        ],
        transformationLog: [
          {
            timestamp: new Date('2024-01-01'),
            type: 'dependency_update',
            message: 'Updated express',
            details: {
              packageName: 'express',
              oldVersion: '3.0.0',
              newVersion: '4.18.0',
              fixedVulnerabilities: 0
            }
          },
          {
            timestamp: new Date('2024-01-02'),
            type: 'dependency_update',
            message: 'Updated lodash',
            details: {
              packageName: 'lodash',
              oldVersion: '4.0.0',
              newVersion: '4.17.21',
              fixedVulnerabilities: 1
            }
          }
        ],
        resurrectionBranch: 'codecrypt/resurrection-123'
      };

      const report = generateResurrectionReport(context);

      assert.ok(report.summary.includes('Successfully updated 2 dependencies'));
      assert.ok(report.summary.includes('fixed 1 security vulnerability'));
      assert.strictEqual(report.updatedDependencies.length, 2);
      assert.strictEqual(report.vulnerabilitiesFixed.length, 1);
      assert.strictEqual(report.statistics.totalUpdates, 2);
      assert.strictEqual(report.statistics.successfulUpdates, 2);
      assert.strictEqual(report.statistics.failedUpdates, 0);
      assert.strictEqual(report.statistics.totalVulnerabilitiesFixed, 1);
      assert.strictEqual(report.branchUrl, 'https://github.com/test/repo/tree/codecrypt/resurrection-123');
    });

    test('should handle failed updates', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: [
          {
            timestamp: new Date('2024-01-01'),
            type: 'dependency_update',
            message: 'Updated express',
            details: {
              packageName: 'express',
              oldVersion: '3.0.0',
              newVersion: '4.18.0'
            }
          },
          {
            timestamp: new Date('2024-01-02'),
            type: 'error',
            message: 'Failed to update lodash: npm install failed',
            details: {
              packageName: 'lodash'
            }
          }
        ]
      };

      const report = generateResurrectionReport(context);

      assert.strictEqual(report.statistics.totalUpdates, 2);
      assert.strictEqual(report.statistics.successfulUpdates, 1);
      assert.strictEqual(report.statistics.failedUpdates, 1);
      assert.ok(report.summary.includes('1 update failed'));
    });

    test('should generate markdown with dependency table', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: [
          {
            timestamp: new Date('2024-01-01'),
            type: 'dependency_update',
            message: 'Updated express',
            details: {
              packageName: 'express',
              oldVersion: '3.0.0',
              newVersion: '4.18.0',
              fixedVulnerabilities: 0
            }
          }
        ]
      };

      const report = generateResurrectionReport(context);

      assert.ok(report.markdown.includes('# 🧟 CodeCrypt Resurrection Report'));
      assert.ok(report.markdown.includes('## Updated Dependencies'));
      assert.ok(report.markdown.includes('| Package | Old Version | New Version | Security Fix |'));
      assert.ok(report.markdown.includes('| express | 3.0.0 | 4.18.0 | - |'));
    });

    test('should include security vulnerabilities section', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [
          {
            name: 'lodash',
            currentVersion: '4.0.0',
            latestVersion: '4.17.21',
            vulnerabilities: [
              {
                id: 'CVE-2021-23337',
                severity: 'critical',
                description: 'Command injection vulnerability'
              }
            ],
            updateStatus: 'success'
          }
        ],
        transformationLog: []
      };

      const report = generateResurrectionReport(context);

      assert.ok(report.markdown.includes('## Security Vulnerabilities Fixed'));
      assert.ok(report.markdown.includes('### 🔴 Critical (1)'));
      assert.ok(report.markdown.includes('**lodash**: CVE-2021-23337'));
      assert.ok(report.markdown.includes('Command injection vulnerability'));
    });

    test('should handle empty context', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: false,
        dependencies: [],
        transformationLog: []
      };

      const report = generateResurrectionReport(context);

      assert.strictEqual(report.summary, 'No updates were performed');
      assert.strictEqual(report.updatedDependencies.length, 0);
      assert.strictEqual(report.vulnerabilitiesFixed.length, 0);
      assert.strictEqual(report.statistics.totalUpdates, 0);
    });
  });

  suite('saveResurrectionReport', () => {
    let tempDir: string;

    setup(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-test-'));
    });

    test('should save report to file', async () => {
      const report = {
        summary: 'Test summary',
        updatedDependencies: [],
        vulnerabilitiesFixed: [],
        statistics: {
          totalUpdates: 0,
          successfulUpdates: 0,
          failedUpdates: 0,
          totalVulnerabilitiesFixed: 0,
          criticalVulnerabilitiesFixed: 0,
          highVulnerabilitiesFixed: 0
        },
        markdown: '# Test Report\n\nThis is a test.'
      };

      const reportPath = await saveResurrectionReport(tempDir, report);

      assert.strictEqual(reportPath, path.join(tempDir, 'RESURRECTION_REPORT.md'));
      
      const content = await fs.readFile(reportPath, 'utf-8');
      assert.strictEqual(content, '# Test Report\n\nThis is a test.');
    });
  });
});
