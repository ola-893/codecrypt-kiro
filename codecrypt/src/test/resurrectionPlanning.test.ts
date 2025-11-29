import * as assert from 'assert';
import {
	generateResurrectionPlan,
	generateEnhancedResurrectionPlan,
	prioritizeByComplexity,
	identifyRefactoringOpportunities,
	generateChangeExplanations,
	generateModernizationStrategy,
	prioritizeBySemanticInsights,
	generatePlanSummary
} from '../services/resurrectionPlanning';
import { DependencyReport, DependencyInfo, ASTAnalysis, HybridAnalysis, LLMAnalysis } from '../types';

suite('Resurrection Planning Test Suite', () => {
	
	test('generateResurrectionPlan - empty dependencies', () => {
		const report: DependencyReport = {
			totalDependencies: 0,
			outdatedDependencies: 0,
			vulnerableDependencies: 0,
			totalVulnerabilities: 0,
			dependencies: [],
			generatedAt: new Date()
		};
		
		const plan = generateResurrectionPlan(report);
		
		assert.strictEqual(plan.items.length, 0);
		assert.strictEqual(plan.totalUpdates, 0);
		assert.strictEqual(plan.securityPatches, 0);
		assert.strictEqual(plan.strategy, 'moderate');
	});

	test('generateResurrectionPlan - single outdated dependency', () => {
		const dependency: DependencyInfo = {
			name: 'express',
			currentVersion: '3.0.0',
			latestVersion: '4.18.0',
			vulnerabilities: [],
			updateStatus: 'pending'
		};
		
		const report: DependencyReport = {
			totalDependencies: 1,
			outdatedDependencies: 1,
			vulnerableDependencies: 0,
			totalVulnerabilities: 0,
			dependencies: [dependency],
			generatedAt: new Date()
		};
		
		const plan = generateResurrectionPlan(report);
		
		assert.strictEqual(plan.items.length, 1);
		assert.strictEqual(plan.totalUpdates, 1);
		assert.strictEqual(plan.securityPatches, 0);
		assert.strictEqual(plan.items[0].packageName, 'express');
		assert.strictEqual(plan.items[0].currentVersion, '3.0.0');
		assert.strictEqual(plan.items[0].targetVersion, '4.18.0');
		assert.strictEqual(plan.items[0].fixesVulnerabilities, false);
	});

	test('generateResurrectionPlan - prioritizes security vulnerabilities', () => {
		const vulnerableDep: DependencyInfo = {
			name: 'lodash',
			currentVersion: '4.17.15',
			latestVersion: '4.17.21',
			vulnerabilities: [
				{ id: 'CVE-2021-1234', severity: 'high', description: 'Prototype pollution' }
			],
			updateStatus: 'pending'
		};
		
		const outdatedDep: DependencyInfo = {
			name: 'express',
			currentVersion: '3.0.0',
			latestVersion: '4.18.0',
			vulnerabilities: [],
			updateStatus: 'pending'
		};
		
		const report: DependencyReport = {
			totalDependencies: 2,
			outdatedDependencies: 2,
			vulnerableDependencies: 1,
			totalVulnerabilities: 1,
			dependencies: [outdatedDep, vulnerableDep],
			generatedAt: new Date()
		};
		
		const plan = generateResurrectionPlan(report);
		
		assert.strictEqual(plan.items.length, 2);
		assert.strictEqual(plan.securityPatches, 1);
		// Vulnerable dependency should be first (higher priority)
		assert.strictEqual(plan.items[0].packageName, 'lodash');
		assert.strictEqual(plan.items[0].fixesVulnerabilities, true);
		assert.strictEqual(plan.items[0].vulnerabilityCount, 1);
		assert.strictEqual(plan.items[1].packageName, 'express');
	});

	test('generateResurrectionPlan - skips up-to-date dependencies', () => {
		const upToDateDep: DependencyInfo = {
			name: 'react',
			currentVersion: '18.2.0',
			latestVersion: '18.2.0',
			vulnerabilities: [],
			updateStatus: 'pending'
		};
		
		const outdatedDep: DependencyInfo = {
			name: 'express',
			currentVersion: '3.0.0',
			latestVersion: '4.18.0',
			vulnerabilities: [],
			updateStatus: 'pending'
		};
		
		const report: DependencyReport = {
			totalDependencies: 2,
			outdatedDependencies: 1,
			vulnerableDependencies: 0,
			totalVulnerabilities: 0,
			dependencies: [upToDateDep, outdatedDep],
			generatedAt: new Date()
		};
		
		const plan = generateResurrectionPlan(report);
		
		assert.strictEqual(plan.items.length, 1);
		assert.strictEqual(plan.items[0].packageName, 'express');
	});

	test('generateResurrectionPlan - handles critical vulnerabilities with highest priority', () => {
		const criticalDep: DependencyInfo = {
			name: 'axios',
			currentVersion: '0.21.0',
			latestVersion: '1.6.0',
			vulnerabilities: [
				{ id: 'CVE-2021-5678', severity: 'critical', description: 'Remote code execution' }
			],
			updateStatus: 'pending'
		};
		
		const highDep: DependencyInfo = {
			name: 'lodash',
			currentVersion: '4.17.15',
			latestVersion: '4.17.21',
			vulnerabilities: [
				{ id: 'CVE-2021-1234', severity: 'high', description: 'Prototype pollution' }
			],
			updateStatus: 'pending'
		};
		
		const report: DependencyReport = {
			totalDependencies: 2,
			outdatedDependencies: 2,
			vulnerableDependencies: 2,
			totalVulnerabilities: 2,
			dependencies: [highDep, criticalDep],
			generatedAt: new Date()
		};
		
		const plan = generateResurrectionPlan(report);
		
		assert.strictEqual(plan.items.length, 2);
		// Critical vulnerability should be first
		assert.strictEqual(plan.items[0].packageName, 'axios');
		assert.strictEqual(plan.items[1].packageName, 'lodash');
		assert.ok(plan.items[0].priority > plan.items[1].priority);
	});

	test('generateResurrectionPlan - includes structural insights with AST analysis', () => {
		const dependency: DependencyInfo = {
			name: 'express',
			currentVersion: '3.0.0',
			latestVersion: '4.18.0',
			vulnerabilities: [],
			updateStatus: 'pending'
		};
		
		const report: DependencyReport = {
			totalDependencies: 1,
			outdatedDependencies: 1,
			vulnerableDependencies: 0,
			totalVulnerabilities: 0,
			dependencies: [dependency],
			generatedAt: new Date()
		};
		
		const astAnalysis: ASTAnalysis = {
			files: [
				{
					filePath: 'test.ts',
					fileType: 'ts',
					linesOfCode: 100,
					structure: { classes: [], functions: [], imports: [], exports: [] },
					complexity: { cyclomatic: 20, decisionPoints: 15 },
					callGraph: []
				}
			],
			totalLOC: 100,
			averageComplexity: 20,
			dependencyGraph: [],
			analyzedAt: new Date()
		};
		
		const plan = generateResurrectionPlan(report, astAnalysis);
		
		assert.ok(plan.structuralInsights);
		assert.ok(plan.structuralInsights.highComplexityFiles);
		assert.strictEqual(typeof plan.structuralInsights.codeSmells, 'number');
		assert.strictEqual(typeof plan.structuralInsights.antiPatterns, 'number');
	});

	test('prioritizeByComplexity - boosts security updates in high complexity codebases', () => {
		const securityItem = {
			packageName: 'axios',
			currentVersion: '0.21.0',
			targetVersion: '1.6.0',
			priority: 100,
			reason: 'security',
			fixesVulnerabilities: true,
			vulnerabilityCount: 1
		};
		
		const regularItem = {
			packageName: 'express',
			currentVersion: '3.0.0',
			targetVersion: '4.18.0',
			priority: 10,
			reason: 'outdated',
			fixesVulnerabilities: false,
			vulnerabilityCount: 0
		};
		
		const astAnalysis: ASTAnalysis = {
			files: [
				{
					filePath: 'test.ts',
					fileType: 'ts',
					linesOfCode: 100,
					structure: { classes: [], functions: [], imports: [], exports: [] },
					complexity: { cyclomatic: 20, decisionPoints: 15 },
					callGraph: []
				}
			],
			totalLOC: 100,
			averageComplexity: 20,
			dependencyGraph: [],
			analyzedAt: new Date()
		};
		
		const prioritized = prioritizeByComplexity([regularItem, securityItem], astAnalysis);
		
		// Security item should have boosted priority
		assert.ok(prioritized[0].fixesVulnerabilities);
		assert.ok(prioritized[0].priority > 100);
	});

	test('identifyRefactoringOpportunities - finds high complexity files', () => {
		const astAnalysis: ASTAnalysis = {
			files: [
				{
					filePath: 'complex.ts',
					fileType: 'ts',
					linesOfCode: 500,
					structure: {
						classes: [],
						functions: [
							{ name: 'func1', parameters: [], returnType: 'void', isAsync: false, isExported: true, location: { start: 0, end: 100 } }
						],
						imports: [],
						exports: []
					},
					complexity: { cyclomatic: 25, decisionPoints: 20 },
					callGraph: []
				}
			],
			totalLOC: 500,
			averageComplexity: 25,
			dependencyGraph: [],
			analyzedAt: new Date()
		};
		
		const opportunities = identifyRefactoringOpportunities(astAnalysis);
		
		assert.ok(opportunities.length > 0);
		assert.ok(opportunities.some(o => o.description.includes('complexity')));
	});

	test('generateEnhancedResurrectionPlan - includes priority files and refactoring opportunities', () => {
		const dependency: DependencyInfo = {
			name: 'express',
			currentVersion: '3.0.0',
			latestVersion: '4.18.0',
			vulnerabilities: [],
			updateStatus: 'pending'
		};
		
		const report: DependencyReport = {
			totalDependencies: 1,
			outdatedDependencies: 1,
			vulnerableDependencies: 0,
			totalVulnerabilities: 0,
			dependencies: [dependency],
			generatedAt: new Date()
		};
		
		const hybridAnalysis: HybridAnalysis = {
			astAnalysis: {
				files: [],
				totalLOC: 100,
				averageComplexity: 10,
				dependencyGraph: [],
				analyzedAt: new Date()
			},
			llmAnalysis: {
				insights: [],
				keyDomainConcepts: ['authentication'],
				analyzedAt: new Date()
			},
			combinedInsights: {
				priorityFiles: [
					{ filePath: 'auth.ts', reason: 'High complexity', priority: 100 }
				],
				refactoringOpportunities: [
					{ filePath: 'auth.ts', description: 'Reduce complexity', impact: 'high' }
				],
				recommendations: ['Focus on security']
			},
			analyzedAt: new Date()
		};
		
		const plan = generateEnhancedResurrectionPlan(report, hybridAnalysis);
		
		assert.ok(plan.priorityFiles);
		assert.ok(plan.priorityFiles.length > 0);
		assert.ok(plan.refactoringOpportunities);
		assert.ok(plan.refactoringOpportunities.length > 0);
	});

	test('generateModernizationStrategy - extracts key focus areas from LLM insights', () => {
		const hybridAnalysis: HybridAnalysis = {
			astAnalysis: {
				files: [],
				totalLOC: 100,
				averageComplexity: 10,
				dependencyGraph: [],
				analyzedAt: new Date()
			},
			llmAnalysis: {
				insights: [
					{
						filePath: 'test.ts',
						developerIntent: 'Handle authentication',
						domainConcepts: ['auth'],
						idiomaticPatterns: [],
						antiPatterns: ['callback hell'],
						modernizationSuggestions: ['Use async/await', 'Add TypeScript types'],
						confidence: 0.9
					}
				],
				keyDomainConcepts: ['authentication'],
				modernizationStrategy: 'Incremental updates',
				analyzedAt: new Date()
			},
			combinedInsights: {
				priorityFiles: [],
				refactoringOpportunities: [],
				recommendations: ['Focus on async patterns']
			},
			analyzedAt: new Date()
		};
		
		const strategy = generateModernizationStrategy(hybridAnalysis);
		
		assert.ok(strategy.strategy);
		assert.ok(Array.isArray(strategy.keyFocus));
		assert.ok(Array.isArray(strategy.riskAreas));
		assert.ok(Array.isArray(strategy.recommendations));
	});

	test('prioritizeBySemanticInsights - boosts priority for packages mentioned in LLM insights', () => {
		const item = {
			packageName: 'axios',
			currentVersion: '0.21.0',
			targetVersion: '1.6.0',
			priority: 10,
			reason: 'outdated',
			fixesVulnerabilities: false,
			vulnerabilityCount: 0
		};
		
		const hybridAnalysis: HybridAnalysis = {
			astAnalysis: {
				files: [],
				totalLOC: 100,
				averageComplexity: 10,
				dependencyGraph: [],
				analyzedAt: new Date()
			},
			llmAnalysis: {
				insights: [
					{
						filePath: 'api.ts',
						developerIntent: 'Make API calls',
						domainConcepts: ['http'],
						idiomaticPatterns: [],
						antiPatterns: ['Using outdated axios version'],
						modernizationSuggestions: ['Update axios to latest version'],
						confidence: 0.9
					}
				],
				keyDomainConcepts: ['http'],
				analyzedAt: new Date()
			},
			combinedInsights: {
				priorityFiles: [],
				refactoringOpportunities: [],
				recommendations: []
			},
			analyzedAt: new Date()
		};
		
		const prioritized = prioritizeBySemanticInsights([item], hybridAnalysis);
		
		assert.ok(prioritized[0].priority > 10);
	});

	test('generatePlanSummary - creates comprehensive markdown summary', () => {
		const plan = {
			items: [
				{
					packageName: 'axios',
					currentVersion: '0.21.0',
					targetVersion: '1.6.0',
					priority: 1000,
					reason: 'security',
					fixesVulnerabilities: true,
					vulnerabilityCount: 1
				}
			],
			totalUpdates: 1,
			securityPatches: 1,
			strategy: 'moderate' as const,
			generatedAt: new Date(),
			priorityFiles: ['auth.ts'],
			refactoringOpportunities: [
				{ filePath: 'auth.ts', description: 'Reduce complexity', impact: 'high' }
			]
		};
		
		const hybridAnalysis: HybridAnalysis = {
			astAnalysis: {
				files: [],
				totalLOC: 100,
				averageComplexity: 10,
				dependencyGraph: [],
				analyzedAt: new Date()
			},
			llmAnalysis: {
				insights: [],
				keyDomainConcepts: ['authentication'],
				projectIntent: 'Authentication service',
				modernizationStrategy: 'Incremental updates',
				analyzedAt: new Date()
			},
			combinedInsights: {
				priorityFiles: [{ filePath: 'auth.ts', reason: 'High complexity', priority: 100 }],
				refactoringOpportunities: [
					{ filePath: 'auth.ts', description: 'Reduce complexity', impact: 'high' }
				],
				recommendations: ['Focus on security']
			},
			analyzedAt: new Date()
		};
		
		const summary = generatePlanSummary(plan, hybridAnalysis);
		
		assert.ok(summary.includes('# Resurrection Plan Summary'));
		assert.ok(summary.includes('Project Context'));
		assert.ok(summary.includes('Modernization Strategy'));
		assert.ok(summary.includes('Plan Overview'));
	});
});
