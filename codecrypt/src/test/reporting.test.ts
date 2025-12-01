/**
 * Tests for Reporting Service
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { 
  generateResurrectionReport, 
  saveResurrectionReport,
  generateInteractiveHTMLReport,
  ReportGenerationOptions
} from '../services/reporting';
import { 
  ResurrectionContext,
  HybridAnalysis,
  MetricsSnapshot,
  TimeMachineValidationResult,
  ResurrectionVerdict
} from '../types';

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
      assert.ok(report.markdown.includes('## 📦 Updated Dependencies'));
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

      assert.ok(report.markdown.includes('## 🔒 Security Vulnerabilities Fixed'));
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

  suite('Enhanced Reporting Features', () => {
    test('should include hybrid analysis insights in report', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const hybridAnalysis: HybridAnalysis = {
        astAnalysis: {
          files: [
            {
              filePath: 'src/index.ts',
              fileType: 'ts',
              linesOfCode: 150,
              structure: {
                classes: [],
                functions: [],
                imports: [],
                exports: []
              },
              complexity: {
                cyclomatic: 15,
                decisionPoints: 8
              },
              callGraph: []
            }
          ],
          totalLOC: 150,
          averageComplexity: 15,
          dependencyGraph: [],
          analyzedAt: new Date()
        },
        llmAnalysis: {
          insights: [],
          keyDomainConcepts: ['authentication', 'data processing'],
          analyzedAt: new Date()
        },
        combinedInsights: {
          priorityFiles: [],
          refactoringOpportunities: [],
          recommendations: ['Consider refactoring complex functions']
        },
        analyzedAt: new Date()
      };

      const options: ReportGenerationOptions = {
        hybridAnalysis
      };

      const report = generateResurrectionReport(context, options);

      assert.ok(report.markdown.includes('## 🔍 AST Analysis Insights'));
      assert.ok(report.markdown.includes('**Files Analyzed:** 1'));
      assert.ok(report.markdown.includes('**Total Lines of Code:** 150'));
      assert.ok(report.markdown.includes('## 🤖 LLM Semantic Insights'));
      assert.ok(report.markdown.includes('authentication'));
    });

    test('should include metrics comparison in report', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const metricsBefore: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 25.5,
        coverage: 45.0,
        loc: 1000,
        progress: 0
      };

      const metricsAfter: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 5,
        vulnsFixed: 3,
        complexity: 18.2,
        coverage: 72.5,
        loc: 950,
        progress: 100
      };

      const options: ReportGenerationOptions = {
        metricsBefore,
        metricsAfter
      };

      const report = generateResurrectionReport(context, options);

      assert.ok(report.markdown.includes('## 📊 Metrics Comparison'));
      assert.ok(report.markdown.includes('Code Complexity'));
      assert.ok(report.markdown.includes('Test Coverage'));
      assert.ok(report.markdown.includes('25.50'));
      assert.ok(report.markdown.includes('18.20'));
    });

    test('should include Time Machine validation results', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const timeMachineResults: TimeMachineValidationResult = {
        success: true,
        originalResults: {
          passed: true,
          exitCode: 0,
          stdout: 'All tests passed',
          stderr: '',
          executionTime: 5000,
          testsRun: 50,
          testsPassed: 50,
          testsFailed: 0
        },
        modernResults: {
          passed: true,
          exitCode: 0,
          stdout: 'All tests passed',
          stderr: '',
          executionTime: 3500,
          testsRun: 50,
          testsPassed: 50,
          testsFailed: 0
        },
        functionalEquivalence: true,
        performanceImprovement: 30.0,
        comparisonReport: 'Tests are functionally equivalent'
      };

      const options: ReportGenerationOptions = {
        timeMachineResults
      };

      const report = generateResurrectionReport(context, options);

      assert.ok(report.markdown.includes('## ⏰ Time Machine Validation'));
      assert.ok(report.markdown.includes('✅ PASSED'));
      assert.ok(report.markdown.includes('30.0% faster'));
      assert.ok(report.markdown.includes('Functional Equivalence'));
    });

    test('should include visualization links', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const options: ReportGenerationOptions = {
        ghostTourPath: './ghost-tour.html',
        symphonyPath: './symphony.mp3',
        dashboardScreenshots: ['./dashboard-1.png', './dashboard-2.png']
      };

      const report = generateResurrectionReport(context, options);

      assert.ok(report.markdown.includes('## 🎨 Interactive Visualizations'));
      assert.ok(report.markdown.includes('3D Ghost Tour'));
      assert.ok(report.markdown.includes('Resurrection Symphony'));
      assert.ok(report.markdown.includes('./ghost-tour.html'));
      assert.ok(report.markdown.includes('./symphony.mp3'));
    });
  });

  suite('generateInteractiveHTMLReport', () => {
    let tempDir: string;

    setup(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-test-'));
    });

    test('should generate interactive HTML report', async () => {
      const report = {
        summary: 'Test summary',
        updatedDependencies: [
          {
            packageName: 'express',
            oldVersion: '3.0.0',
            newVersion: '4.18.0',
            fixedVulnerabilities: false,
            vulnerabilityCount: 0
          }
        ],
        vulnerabilitiesFixed: [],
        statistics: {
          totalUpdates: 1,
          successfulUpdates: 1,
          failedUpdates: 0,
          totalVulnerabilitiesFixed: 0,
          criticalVulnerabilitiesFixed: 0,
          highVulnerabilitiesFixed: 0
        },
        markdown: '# Test Report'
      };

      const htmlPath = await generateInteractiveHTMLReport(tempDir, report);

      assert.strictEqual(htmlPath, path.join(tempDir, 'RESURRECTION_REPORT.html'));
      
      const content = await fs.readFile(htmlPath, 'utf-8');
      assert.ok(content.includes('<!DOCTYPE html>'));
      assert.ok(content.includes('CodeCrypt Resurrection Report'));
      assert.ok(content.includes('express'));
      assert.ok(content.includes('3.0.0'));
      assert.ok(content.includes('4.18.0'));
    });

    test('should include metrics comparison in HTML', async () => {
      const metricsBefore: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 25.5,
        coverage: 45.0,
        loc: 1000,
        progress: 0
      };

      const metricsAfter: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 5,
        vulnsFixed: 3,
        complexity: 18.2,
        coverage: 72.5,
        loc: 950,
        progress: 100
      };

      const report = {
        summary: 'Test summary',
        updatedDependencies: [],
        vulnerabilitiesFixed: [],
        statistics: {
          totalUpdates: 5,
          successfulUpdates: 5,
          failedUpdates: 0,
          totalVulnerabilitiesFixed: 3,
          criticalVulnerabilitiesFixed: 0,
          highVulnerabilitiesFixed: 0
        },
        metricsComparison: {
          before: metricsBefore,
          after: metricsAfter
        },
        markdown: '# Test Report'
      };

      const htmlPath = await generateInteractiveHTMLReport(tempDir, report);
      const content = await fs.readFile(htmlPath, 'utf-8');

      assert.ok(content.includes('Metrics Comparison'));
      assert.ok(content.includes('25.50'));
      assert.ok(content.includes('18.20'));
      assert.ok(content.includes('45.0%'));
      assert.ok(content.includes('72.5%'));
    });

    test('should include Time Machine validation in HTML', async () => {
      const timeMachineResults: TimeMachineValidationResult = {
        success: true,
        originalResults: {
          passed: true,
          exitCode: 0,
          stdout: 'All tests passed',
          stderr: '',
          executionTime: 5000,
          testsRun: 50,
          testsPassed: 50,
          testsFailed: 0
        },
        modernResults: {
          passed: true,
          exitCode: 0,
          stdout: 'All tests passed',
          stderr: '',
          executionTime: 3500,
          testsRun: 50,
          testsPassed: 50,
          testsFailed: 0
        },
        functionalEquivalence: true,
        performanceImprovement: 30.0,
        comparisonReport: 'Tests are functionally equivalent'
      };

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
        timeMachineResults,
        markdown: '# Test Report'
      };

      const htmlPath = await generateInteractiveHTMLReport(tempDir, report);
      const content = await fs.readFile(htmlPath, 'utf-8');

      assert.ok(content.includes('Time Machine Validation'));
      assert.ok(content.includes('✅ PASSED'));
      assert.ok(content.includes('30.0%'));
      assert.ok(content.includes('Functional Equivalence'));
    });

    test('should include Ghost Tour visualization link in HTML', async () => {
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
        ghostTourPath: './ghost-tour.html',
        markdown: '# Test Report'
      };

      const htmlPath = await generateInteractiveHTMLReport(tempDir, report);
      const content = await fs.readFile(htmlPath, 'utf-8');

      assert.ok(content.includes('3D Ghost Tour'));
      assert.ok(content.includes('./ghost-tour.html'));
      assert.ok(content.includes('Open Ghost Tour'));
    });

    test('should include Symphony audio player in HTML', async () => {
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
        symphonyPath: './symphony.mp3',
        markdown: '# Test Report'
      };

      const htmlPath = await generateInteractiveHTMLReport(tempDir, report);
      const content = await fs.readFile(htmlPath, 'utf-8');

      assert.ok(content.includes('Resurrection Symphony'));
      assert.ok(content.includes('./symphony.mp3'));
      assert.ok(content.includes('<audio'));
      assert.ok(content.includes('Download Symphony'));
    });

    test('should generate complete HTML report with all sections', async () => {
      const hybridAnalysis: HybridAnalysis = {
        astAnalysis: {
          files: [
            {
              filePath: 'src/index.ts',
              fileType: 'ts',
              linesOfCode: 150,
              structure: {
                classes: [],
                functions: [],
                imports: [],
                exports: []
              },
              complexity: {
                cyclomatic: 15,
                decisionPoints: 8
              },
              callGraph: []
            }
          ],
          totalLOC: 150,
          averageComplexity: 15,
          dependencyGraph: [],
          analyzedAt: new Date()
        },
        llmAnalysis: {
          insights: [],
          keyDomainConcepts: ['authentication', 'data processing'],
          analyzedAt: new Date()
        },
        combinedInsights: {
          priorityFiles: [],
          refactoringOpportunities: [],
          recommendations: ['Consider refactoring complex functions']
        },
        analyzedAt: new Date()
      };

      const metricsBefore: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 25.5,
        coverage: 45.0,
        loc: 1000,
        progress: 0
      };

      const metricsAfter: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 5,
        vulnsFixed: 3,
        complexity: 18.2,
        coverage: 72.5,
        loc: 950,
        progress: 100
      };

      const timeMachineResults: TimeMachineValidationResult = {
        success: true,
        originalResults: {
          passed: true,
          exitCode: 0,
          stdout: 'All tests passed',
          stderr: '',
          executionTime: 5000,
          testsRun: 50,
          testsPassed: 50,
          testsFailed: 0
        },
        modernResults: {
          passed: true,
          exitCode: 0,
          stdout: 'All tests passed',
          stderr: '',
          executionTime: 3500,
          testsRun: 50,
          testsPassed: 50,
          testsFailed: 0
        },
        functionalEquivalence: true,
        performanceImprovement: 30.0,
        comparisonReport: 'Tests are functionally equivalent'
      };

      const report = {
        summary: 'Successfully updated 5 dependencies, fixed 3 security vulnerabilities',
        updatedDependencies: [
          {
            packageName: 'express',
            oldVersion: '3.0.0',
            newVersion: '4.18.0',
            fixedVulnerabilities: true,
            vulnerabilityCount: 2
          }
        ],
        vulnerabilitiesFixed: [
          {
            packageName: 'express',
            vulnerability: {
              id: 'CVE-2021-1234',
              severity: 'high' as const,
              description: 'Security vulnerability'
            }
          }
        ],
        statistics: {
          totalUpdates: 5,
          successfulUpdates: 5,
          failedUpdates: 0,
          totalVulnerabilitiesFixed: 3,
          criticalVulnerabilitiesFixed: 1,
          highVulnerabilitiesFixed: 2
        },
        hybridAnalysis,
        metricsComparison: {
          before: metricsBefore,
          after: metricsAfter
        },
        timeMachineResults,
        ghostTourPath: './ghost-tour.html',
        symphonyPath: './symphony.mp3',
        dashboardScreenshots: ['./dashboard-1.png'],
        markdown: '# Test Report'
      };

      const htmlPath = await generateInteractiveHTMLReport(tempDir, report);
      const content = await fs.readFile(htmlPath, 'utf-8');

      // Verify all major sections are present
      assert.ok(content.includes('<!DOCTYPE html>'));
      assert.ok(content.includes('CodeCrypt Resurrection Report'));
      assert.ok(content.includes('Statistics Overview'));
      assert.ok(content.includes('Metrics Comparison'));
      assert.ok(content.includes('Time Machine Validation'));
      assert.ok(content.includes('3D Ghost Tour'));
      assert.ok(content.includes('Resurrection Symphony'));
      assert.ok(content.includes('Updated Dependencies'));
      
      // Verify data is present
      assert.ok(content.includes('express'));
      assert.ok(content.includes('25.50'));
      assert.ok(content.includes('18.20'));
      assert.ok(content.includes('✅ PASSED'));
      assert.ok(content.includes('./ghost-tour.html'));
      assert.ok(content.includes('./symphony.mp3'));
    });

    test('should handle HTML report with missing optional sections', async () => {
      const report = {
        summary: 'No updates performed',
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
        markdown: '# Test Report'
      };

      const htmlPath = await generateInteractiveHTMLReport(tempDir, report);
      const content = await fs.readFile(htmlPath, 'utf-8');

      // Should still have basic structure
      assert.ok(content.includes('<!DOCTYPE html>'));
      assert.ok(content.includes('CodeCrypt Resurrection Report'));
      assert.ok(content.includes('Statistics Overview'));
      
      // Should not have optional sections
      assert.ok(!content.includes('Metrics Comparison'));
      assert.ok(!content.includes('Time Machine Validation'));
      assert.ok(!content.includes('3D Ghost Tour'));
      assert.ok(!content.includes('Resurrection Symphony'));
    });
  });

  suite('Complete Report Generation with All Features', () => {
    test('should generate markdown report with all enhanced sections', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [
          {
            name: 'express',
            currentVersion: '3.0.0',
            latestVersion: '4.18.0',
            vulnerabilities: [
              {
                id: 'CVE-2021-1234',
                severity: 'high',
                description: 'Security vulnerability'
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
              fixedVulnerabilities: 1
            }
          }
        ],
        resurrectionBranch: 'codecrypt/resurrection-123'
      };

      const hybridAnalysis: HybridAnalysis = {
        astAnalysis: {
          files: [
            {
              filePath: 'src/index.ts',
              fileType: 'ts',
              linesOfCode: 150,
              structure: {
                classes: [],
                functions: [],
                imports: [],
                exports: []
              },
              complexity: {
                cyclomatic: 15,
                decisionPoints: 8
              },
              callGraph: []
            },
            {
              filePath: 'src/utils.ts',
              fileType: 'ts',
              linesOfCode: 200,
              structure: {
                classes: [],
                functions: [],
                imports: [],
                exports: []
              },
              complexity: {
                cyclomatic: 25,
                decisionPoints: 12
              },
              callGraph: []
            }
          ],
          totalLOC: 350,
          averageComplexity: 20,
          dependencyGraph: [],
          analyzedAt: new Date()
        },
        llmAnalysis: {
          insights: [],
          projectIntent: 'A web server for handling API requests',
          keyDomainConcepts: ['authentication', 'data processing', 'REST API'],
          modernizationStrategy: 'Update to modern async/await patterns',
          analyzedAt: new Date()
        },
        combinedInsights: {
          priorityFiles: [],
          refactoringOpportunities: [],
          recommendations: [
            'Consider refactoring complex functions',
            'Update to ES6+ syntax',
            'Add TypeScript types'
          ]
        },
        analyzedAt: new Date()
      };

      const metricsBefore: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 25.5,
        coverage: 45.0,
        loc: 1000,
        progress: 0
      };

      const metricsAfter: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 1,
        vulnsFixed: 1,
        complexity: 18.2,
        coverage: 72.5,
        loc: 950,
        progress: 100
      };

      const timeMachineResults: TimeMachineValidationResult = {
        success: true,
        originalResults: {
          passed: true,
          exitCode: 0,
          stdout: 'All tests passed',
          stderr: '',
          executionTime: 5000,
          testsRun: 50,
          testsPassed: 50,
          testsFailed: 0
        },
        modernResults: {
          passed: true,
          exitCode: 0,
          stdout: 'All tests passed',
          stderr: '',
          executionTime: 3500,
          testsRun: 50,
          testsPassed: 50,
          testsFailed: 0
        },
        functionalEquivalence: true,
        performanceImprovement: 30.0,
        comparisonReport: 'Tests are functionally equivalent'
      };

      const options: ReportGenerationOptions = {
        hybridAnalysis,
        metricsBefore,
        metricsAfter,
        timeMachineResults,
        ghostTourPath: './ghost-tour.html',
        symphonyPath: './symphony.mp3',
        dashboardScreenshots: ['./dashboard-1.png', './dashboard-2.png']
      };

      const report = generateResurrectionReport(context, options);

      // Verify all sections are present in markdown
      assert.ok(report.markdown.includes('# 🧟 CodeCrypt Resurrection Report'));
      assert.ok(report.markdown.includes('## Summary'));
      assert.ok(report.markdown.includes('## Statistics'));
      assert.ok(report.markdown.includes('## 🔍 AST Analysis Insights'));
      assert.ok(report.markdown.includes('## 🤖 LLM Semantic Insights'));
      assert.ok(report.markdown.includes('## 📊 Metrics Comparison'));
      assert.ok(report.markdown.includes('## ⏰ Time Machine Validation'));
      assert.ok(report.markdown.includes('## 📦 Updated Dependencies'));
      assert.ok(report.markdown.includes('## 🔒 Security Vulnerabilities Fixed'));
      assert.ok(report.markdown.includes('## 🎨 Interactive Visualizations'));
      
      // Verify AST analysis content
      assert.ok(report.markdown.includes('**Files Analyzed:** 2'));
      assert.ok(report.markdown.includes('**Total Lines of Code:** 350'));
      assert.ok(report.markdown.includes('**Average Complexity:** 20.00'));
      assert.ok(report.markdown.includes('### Most Complex Files'));
      assert.ok(report.markdown.includes('src/utils.ts'));
      
      // Verify LLM analysis content
      assert.ok(report.markdown.includes('### Project Intent'));
      assert.ok(report.markdown.includes('A web server for handling API requests'));
      assert.ok(report.markdown.includes('### Key Domain Concepts'));
      assert.ok(report.markdown.includes('authentication'));
      assert.ok(report.markdown.includes('### Modernization Strategy'));
      assert.ok(report.markdown.includes('Update to modern async/await patterns'));
      assert.ok(report.markdown.includes('### Recommendations'));
      assert.ok(report.markdown.includes('Consider refactoring complex functions'));
      
      // Verify metrics comparison
      assert.ok(report.markdown.includes('| Code Complexity | 25.50 | 18.20 |'));
      assert.ok(report.markdown.includes('| Test Coverage | 45.0% | 72.5% |'));
      
      // Verify Time Machine results
      assert.ok(report.markdown.includes('**Status:** ✅ PASSED'));
      assert.ok(report.markdown.includes('**Performance:** 🚀 30.0% faster'));
      assert.ok(report.markdown.includes('### Test Results Comparison'));
      
      // Verify visualization links
      assert.ok(report.markdown.includes('### 3D Ghost Tour'));
      assert.ok(report.markdown.includes('[Open Ghost Tour](./ghost-tour.html)'));
      assert.ok(report.markdown.includes('### Resurrection Symphony'));
      assert.ok(report.markdown.includes('[Download Symphony](./symphony.mp3)'));
      assert.ok(report.markdown.includes('### Live Metrics Dashboard'));
      assert.ok(report.markdown.includes('![Dashboard](./dashboard-1.png)'));
      
      // Verify summary includes all features
      assert.ok(report.summary.includes('Successfully updated 1 dependency'));
      assert.ok(report.summary.includes('fixed 1 security vulnerability'));
      assert.ok(report.summary.includes('analyzed 2 files using hybrid AST + LLM analysis'));
      assert.ok(report.summary.includes('validated functional equivalence using Time Machine testing'));
    });

    test('should handle report with failed Time Machine validation', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const timeMachineResults: TimeMachineValidationResult = {
        success: false,
        originalResults: {
          passed: true,
          exitCode: 0,
          stdout: 'All tests passed',
          stderr: '',
          executionTime: 5000,
          testsRun: 50,
          testsPassed: 50,
          testsFailed: 0
        },
        modernResults: {
          passed: false,
          exitCode: 1,
          stdout: 'Some tests failed',
          stderr: 'Error in test suite',
          executionTime: 3500,
          testsRun: 50,
          testsPassed: 45,
          testsFailed: 5
        },
        functionalEquivalence: false,
        performanceImprovement: 0,
        comparisonReport: 'Tests show differences',
        errors: ['5 tests failed in modernized version']
      };

      const options: ReportGenerationOptions = {
        timeMachineResults
      };

      const report = generateResurrectionReport(context, options);

      assert.ok(report.markdown.includes('**Status:** ❌ FAILED'));
      assert.ok(report.markdown.includes('**Functional Equivalence:** ⚠️ Differences detected'));
      assert.ok(report.markdown.includes('### Validation Errors'));
      assert.ok(report.markdown.includes('5 tests failed in modernized version'));
    });
  });

  suite('Resurrection Verdict Reporting', () => {
    test('should include resurrection proof section when verdict is provided', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const resurrectionVerdict = {
        baselineCompilation: {
          timestamp: new Date(),
          success: false,
          errorCount: 15,
          errors: [
            { file: 'src/index.ts', line: 10, column: 5, code: 'TS2307', message: "Cannot find module 'express'", category: 'import' as const },
            { file: 'src/utils.ts', line: 20, column: 10, code: 'TS2345', message: 'Type error', category: 'type' as const }
          ],
          errorsByCategory: { type: 5, import: 8, syntax: 1, dependency: 1, config: 0 },
          output: 'Compilation failed',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: [
            { errorCategory: 'import' as const, description: 'Install missing packages: npm install express', autoApplicable: true, errorCount: 8, details: ['express'] }
          ]
        },
        finalCompilation: {
          timestamp: new Date(),
          success: true,
          errorCount: 0,
          errors: [],
          errorsByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
          output: 'Compilation successful',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: []
        },
        resurrected: true,
        errorsFixed: 15,
        errorsRemaining: 0,
        errorsFixedByCategory: { type: 5, import: 8, syntax: 1, dependency: 1, config: 0 },
        errorsRemainingByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
        fixedErrors: [
          { file: 'src/index.ts', line: 10, column: 5, code: 'TS2307', message: "Cannot find module 'express'", category: 'import' as const }
        ],
        newErrors: []
      };

      const options: ReportGenerationOptions = {
        resurrectionVerdict
      };

      const report = generateResurrectionReport(context, options);

      // Verify resurrection proof section exists
      assert.ok(report.markdown.includes('## 🔬 Resurrection Proof'));
      assert.ok(report.markdown.includes('### Verdict: 🧟 RESURRECTED'));
      
      // Verify compilation status table
      assert.ok(report.markdown.includes('| Baseline | ❌ Failed | 15 |'));
      assert.ok(report.markdown.includes('| Final | ✅ Passed | 0 |'));
      
      // Verify error breakdown by category
      assert.ok(report.markdown.includes('### Error Breakdown by Category'));
      assert.ok(report.markdown.includes('| Type | 5 | 0 | ✅ 5 |'));
      assert.ok(report.markdown.includes('| Import | 8 | 0 | ✅ 8 |'));
      
      // Verify errors fixed count
      assert.ok(report.markdown.includes('**Errors Fixed:** 15'));
      
      // Verify fixed errors list
      assert.ok(report.markdown.includes('### Errors Fixed'));
      assert.ok(report.markdown.includes("[IMPORT] `src/index.ts:10` - Cannot find module 'express'"));
      
      // Verify fix suggestions
      assert.ok(report.markdown.includes('### Fix Suggestions'));
      assert.ok(report.markdown.includes('Install missing packages: npm install express'));
    });

    test('should show NOT RESURRECTED verdict when final compilation still fails', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const resurrectionVerdict = {
        baselineCompilation: {
          timestamp: new Date(),
          success: false,
          errorCount: 10,
          errors: [],
          errorsByCategory: { type: 5, import: 3, syntax: 2, dependency: 0, config: 0 },
          output: 'Compilation failed',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: []
        },
        finalCompilation: {
          timestamp: new Date(),
          success: false,
          errorCount: 3,
          errors: [
            { file: 'src/index.ts', line: 15, column: 5, code: 'TS2345', message: 'Type mismatch', category: 'type' as const }
          ],
          errorsByCategory: { type: 3, import: 0, syntax: 0, dependency: 0, config: 0 },
          output: 'Compilation failed',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: []
        },
        resurrected: false,
        errorsFixed: 7,
        errorsRemaining: 3,
        errorsFixedByCategory: { type: 2, import: 3, syntax: 2, dependency: 0, config: 0 },
        errorsRemainingByCategory: { type: 3, import: 0, syntax: 0, dependency: 0, config: 0 },
        fixedErrors: [],
        newErrors: []
      };

      const options: ReportGenerationOptions = {
        resurrectionVerdict
      };

      const report = generateResurrectionReport(context, options);

      assert.ok(report.markdown.includes('### Verdict: ❌ NOT RESURRECTED'));
      assert.ok(report.markdown.includes('**Errors Fixed:** 7'));
      assert.ok(report.markdown.includes('**Errors Remaining:** 3'));
      assert.ok(report.markdown.includes('### Remaining Errors'));
    });

    test('should show ALREADY COMPILING verdict when baseline passes', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const resurrectionVerdict = {
        baselineCompilation: {
          timestamp: new Date(),
          success: true,
          errorCount: 0,
          errors: [],
          errorsByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
          output: 'Compilation successful',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: []
        },
        finalCompilation: {
          timestamp: new Date(),
          success: true,
          errorCount: 0,
          errors: [],
          errorsByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
          output: 'Compilation successful',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: []
        },
        resurrected: false,
        errorsFixed: 0,
        errorsRemaining: 0,
        errorsFixedByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
        errorsRemainingByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
        fixedErrors: [],
        newErrors: []
      };

      const options: ReportGenerationOptions = {
        resurrectionVerdict
      };

      const report = generateResurrectionReport(context, options);

      assert.ok(report.markdown.includes('### Verdict: ✅ ALREADY COMPILING'));
      assert.ok(report.markdown.includes('| Baseline | ✅ Passed | 0 |'));
      assert.ok(report.markdown.includes('| Final | ✅ Passed | 0 |'));
    });

    test('should show new errors introduced during resurrection', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const resurrectionVerdict = {
        baselineCompilation: {
          timestamp: new Date(),
          success: false,
          errorCount: 5,
          errors: [],
          errorsByCategory: { type: 3, import: 2, syntax: 0, dependency: 0, config: 0 },
          output: 'Compilation failed',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: []
        },
        finalCompilation: {
          timestamp: new Date(),
          success: false,
          errorCount: 2,
          errors: [],
          errorsByCategory: { type: 1, import: 0, syntax: 1, dependency: 0, config: 0 },
          output: 'Compilation failed',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: []
        },
        resurrected: false,
        errorsFixed: 5,
        errorsRemaining: 2,
        errorsFixedByCategory: { type: 3, import: 2, syntax: 0, dependency: 0, config: 0 },
        errorsRemainingByCategory: { type: 1, import: 0, syntax: 1, dependency: 0, config: 0 },
        fixedErrors: [],
        newErrors: [
          { file: 'src/new.ts', line: 5, column: 1, code: 'TS1005', message: 'Unexpected token', category: 'syntax' as const }
        ]
      };

      const options: ReportGenerationOptions = {
        resurrectionVerdict
      };

      const report = generateResurrectionReport(context, options);

      assert.ok(report.markdown.includes('### ⚠️ New Errors Introduced'));
      assert.ok(report.markdown.includes('[SYNTAX] `src/new.ts:5` - Unexpected token'));
    });

    test('should include resurrection verdict in report object', () => {
      const context: ResurrectionContext = {
        repoUrl: 'https://github.com/test/repo',
        isDead: true,
        dependencies: [],
        transformationLog: []
      };

      const resurrectionVerdict = {
        baselineCompilation: {
          timestamp: new Date(),
          success: false,
          errorCount: 10,
          errors: [],
          errorsByCategory: { type: 5, import: 5, syntax: 0, dependency: 0, config: 0 },
          output: 'Compilation failed',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: []
        },
        finalCompilation: {
          timestamp: new Date(),
          success: true,
          errorCount: 0,
          errors: [],
          errorsByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
          output: 'Compilation successful',
          projectType: 'typescript' as const,
          strategy: 'typescript' as const,
          suggestedFixes: []
        },
        resurrected: true,
        errorsFixed: 10,
        errorsRemaining: 0,
        errorsFixedByCategory: { type: 5, import: 5, syntax: 0, dependency: 0, config: 0 },
        errorsRemainingByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
        fixedErrors: [],
        newErrors: []
      };

      const options: ReportGenerationOptions = {
        resurrectionVerdict
      };

      const report = generateResurrectionReport(context, options);

      assert.ok(report.resurrectionVerdict);
      assert.strictEqual(report.resurrectionVerdict?.resurrected, true);
      assert.strictEqual(report.resurrectionVerdict?.errorsFixed, 10);
      assert.strictEqual(report.resurrectionVerdict?.errorsRemaining, 0);
    });
  });
});
