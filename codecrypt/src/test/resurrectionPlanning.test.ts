import * as assert from 'assert';
import { generateResurrectionPlan } from '../services/resurrectionPlanning';
import { DependencyReport, DependencyInfo } from '../types';

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
});
