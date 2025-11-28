import * as assert from 'assert';
import { 
  ResurrectionContext, 
  DependencyInfo, 
  TransformationLogEntry,
  UpdateStatus 
} from '../types';

suite('Core Types Test Suite', () => {
  
  test('DependencyInfo structure is valid', () => {
    const dependency: DependencyInfo = {
      name: 'express',
      currentVersion: '3.0.0',
      latestVersion: '4.18.0',
      vulnerabilities: [
        {
          id: 'CVE-2021-1234',
          severity: 'high',
          description: 'Test vulnerability'
        }
      ],
      updateStatus: 'pending'
    };
    
    assert.strictEqual(dependency.name, 'express');
    assert.strictEqual(dependency.currentVersion, '3.0.0');
    assert.strictEqual(dependency.latestVersion, '4.18.0');
    assert.strictEqual(dependency.vulnerabilities.length, 1);
    assert.strictEqual(dependency.updateStatus, 'pending');
  });

  test('ResurrectionContext structure is valid', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      lastCommitDate: new Date('2020-01-01'),
      dependencies: [],
      transformationLog: []
    };
    
    assert.strictEqual(context.repoUrl, 'https://github.com/test/repo');
    assert.strictEqual(context.isDead, true);
    assert.ok(context.lastCommitDate instanceof Date);
    assert.strictEqual(context.dependencies.length, 0);
    assert.strictEqual(context.transformationLog.length, 0);
  });

  test('TransformationLogEntry structure is valid', () => {
    const logEntry: TransformationLogEntry = {
      timestamp: new Date(),
      type: 'dependency_update',
      message: 'Updated express to 4.18.0',
      details: { package: 'express', version: '4.18.0' }
    };
    
    assert.ok(logEntry.timestamp instanceof Date);
    assert.strictEqual(logEntry.type, 'dependency_update');
    assert.strictEqual(logEntry.message, 'Updated express to 4.18.0');
    assert.ok(logEntry.details);
  });

  test('UpdateStatus type accepts valid values', () => {
    const statuses: UpdateStatus[] = ['pending', 'success', 'failed'];
    
    statuses.forEach(status => {
      const dependency: DependencyInfo = {
        name: 'test',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        vulnerabilities: [],
        updateStatus: status
      };
      
      assert.strictEqual(dependency.updateStatus, status);
    });
  });
});
