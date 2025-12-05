/**
 * Manual test script for transitive dead URL detection
 * This script can be run directly with Node.js to test the functionality
 * without the VS Code extension host environment
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock the vscode module for testing outside VS Code
global.vscode = {
  window: {
    showInformationMessage: () => {},
    showErrorMessage: () => {},
    showWarningMessage: () => {},
  },
};

async function runTests() {
  console.log('🧪 Starting Transitive Dead URL Detection Tests\n');
  
  let testRepoPath;
  let passed = 0;
  let failed = 0;
  
  try {
    // Create temporary test directory
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-test-'));
    console.log(`📁 Created test directory: ${testRepoPath}\n`);
    
    // Import services (after vscode mock is set up)
    const { LockfileParser } = require('./out/services/lockfileParser');
    const { DeadUrlHandler } = require('./out/services/deadUrlHandler');
    const { URLValidator } = require('./out/services/urlValidator');
    const { PackageReplacementRegistry } = require('./out/services/packageReplacementRegistry');
    
    const lockfileParser = new LockfileParser();
    const urlValidator = new URLValidator();
    const registry = new PackageReplacementRegistry();
    const deadUrlHandler = new DeadUrlHandler(urlValidator, lockfileParser, registry);
    
    // Test 1: npm lockfile parsing
    console.log('Test 1: npm lockfile parsing with transitive dead URLs');
    try {
      const packageJson = {
        name: 'test-repo',
        version: '1.0.0',
        dependencies: {
          'express': '^4.17.1'
        }
      };
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      const packageLock = {
        name: 'test-repo',
        version: '1.0.0',
        lockfileVersion: 2,
        requires: true,
        packages: {
          '': {
            name: 'test-repo',
            version: '1.0.0',
            dependencies: {
              'express': '^4.17.1'
            }
          },
          'node_modules/querystring': {
            version: '0.2.0',
            resolved: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
            integrity: 'sha512-...'
          }
        }
      };
      await fs.writeFile(
        path.join(testRepoPath, 'package-lock.json'),
        JSON.stringify(packageLock, null, 2)
      );
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      
      if (transitiveDeps.length > 0) {
        const querystringDep = transitiveDeps.find(dep => dep.name === 'querystring');
        if (querystringDep && querystringDep.resolvedUrl.includes('github.com/substack/querystring')) {
          console.log('  ✅ PASSED: Found querystring transitive dependency with dead URL\n');
          passed++;
        } else {
          console.log('  ❌ FAILED: querystring dependency not found or URL incorrect\n');
          failed++;
        }
      } else {
        console.log('  ❌ FAILED: No transitive dependencies found\n');
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}\n`);
      failed++;
    }
    
    // Test 2: Lockfile type detection
    console.log('Test 2: Lockfile type detection');
    try {
      const lockfileType = await lockfileParser.detectLockfileType(testRepoPath);
      if (lockfileType === 'npm') {
        console.log('  ✅ PASSED: Correctly detected npm lockfile\n');
        passed++;
      } else {
        console.log(`  ❌ FAILED: Expected 'npm', got '${lockfileType}'\n`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}\n`);
      failed++;
    }
    
    // Test 3: Dead URL handling with transitive dependencies
    console.log('Test 3: Dead URL handling with transitive dependencies');
    try {
      const directDeps = new Map([
        ['express', '^4.17.1']
      ]);
      
      const summary = await deadUrlHandler.handleDeadUrlsWithTransitive(
        testRepoPath,
        directDeps
      );
      
      if (summary.totalChecked > 0) {
        console.log(`  ✅ PASSED: Checked ${summary.totalChecked} dependencies\n`);
        passed++;
      } else {
        console.log('  ❌ FAILED: No dependencies checked\n');
        failed++;
      }
      
      // Check if querystring was processed
      const querystringResult = summary.results.find(r => r.packageName === 'querystring');
      if (querystringResult) {
        console.log(`  ℹ️  querystring action: ${querystringResult.action}`);
        if (querystringResult.resolved || querystringResult.action === 'replaced') {
          console.log(`  ℹ️  querystring resolved: ${querystringResult.npmAlternative || 'via registry'}`);
        }
      }
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}\n`);
      failed++;
    }
    
    // Test 4: Report generation
    console.log('\nTest 4: Report generation');
    try {
      const directDeps = new Map([
        ['express', '^4.17.1']
      ]);
      
      const summary = await deadUrlHandler.handleDeadUrlsWithTransitive(
        testRepoPath,
        directDeps
      );
      
      const report = deadUrlHandler.generateReport(summary);
      
      if (report && report.includes('Dead URL Handling Report')) {
        console.log('  ✅ PASSED: Report generated successfully\n');
        passed++;
      } else {
        console.log('  ❌ FAILED: Report missing or incomplete\n');
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}\n`);
      failed++;
    }
    
    // Test 5: Lockfile deletion
    console.log('Test 5: Lockfile deletion');
    try {
      await lockfileParser.deleteLockfiles(testRepoPath);
      
      try {
        await fs.access(path.join(testRepoPath, 'package-lock.json'));
        console.log('  ❌ FAILED: Lockfile still exists after deletion\n');
        failed++;
      } catch {
        console.log('  ✅ PASSED: Lockfile successfully deleted\n');
        passed++;
      }
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}\n`);
      failed++;
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    failed++;
  } finally {
    // Cleanup
    if (testRepoPath) {
      try {
        await fs.rm(testRepoPath, { recursive: true, force: true });
        console.log(`\n🧹 Cleaned up test directory`);
      } catch (error) {
        console.error('Warning: Failed to clean up test directory:', error.message);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${passed + failed}`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
