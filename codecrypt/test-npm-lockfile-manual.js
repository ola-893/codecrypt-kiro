/**
 * Manual Test Script for npm Lockfile Parsing
 * Task 9: Test npm lockfile parsing
 * 
 * This script manually tests the lockfile parser with various npm lockfile scenarios.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { createLockfileParser } = require('./out/services/lockfileParser');

async function runTests() {
  console.log('=== npm Lockfile Parsing Manual Test ===\n');
  
  let testRepoPath;
  let passedTests = 0;
  let failedTests = 0;
  
  try {
    // Create temporary test directory
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-npm-lockfile-test-'));
    console.log(`✓ Created test repo at: ${testRepoPath}\n`);
    
    const lockfileParser = createLockfileParser();
    
    // Test 1: Parse npm v7+ lockfile with URL-based dependency
    console.log('Test 1: Parse npm v7+ lockfile with URL-based dependency');
    try {
      const lockfileContent = {
        name: 'test-repo',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-repo',
            version: '1.0.0'
          },
          'node_modules/querystring': {
            version: '0.2.0',
            resolved: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
            integrity: 'sha512-test123'
          }
        }
      };
      
      await fs.writeFile(
        path.join(testRepoPath, 'package-lock.json'),
        JSON.stringify(lockfileContent, null, 2)
      );
      
      const lockfileType = await lockfileParser.detectLockfileType(testRepoPath);
      if (lockfileType !== 'npm') {
        throw new Error(`Expected 'npm', got '${lockfileType}'`);
      }
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      if (transitiveDeps.length === 0) {
        throw new Error('Expected to find URL-based dependencies');
      }
      
      const querystringDep = transitiveDeps.find(dep => dep.name === 'querystring');
      if (!querystringDep) {
        throw new Error('Expected to find querystring dependency');
      }
      
      if (querystringDep.resolvedUrl !== 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz') {
        throw new Error(`Unexpected URL: ${querystringDep.resolvedUrl}`);
      }
      
      console.log('  ✓ Detected npm lockfile');
      console.log('  ✓ Extracted URL-based dependency');
      console.log(`  ✓ Found querystring with correct URL`);
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up for next test
      await fs.unlink(path.join(testRepoPath, 'package-lock.json'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 2: Parse lockfile with multiple URL-based dependencies
    console.log('Test 2: Parse lockfile with multiple URL-based dependencies');
    try {
      const lockfileContent = {
        name: 'test-repo',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          'node_modules/package-a': {
            version: '1.0.0',
            resolved: 'https://github.com/user/package-a/archive/v1.0.0.tar.gz'
          },
          'node_modules/package-b': {
            version: '2.0.0',
            resolved: 'https://github.com/user/package-b/archive/v2.0.0.tar.gz'
          },
          'node_modules/package-c': {
            version: '3.0.0',
            resolved: 'git+https://github.com/user/package-c.git#abc123'
          },
          'node_modules/normal-package': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/normal-package/-/normal-package-1.0.0.tgz'
          }
        }
      };
      
      await fs.writeFile(
        path.join(testRepoPath, 'package-lock.json'),
        JSON.stringify(lockfileContent, null, 2)
      );
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      
      if (transitiveDeps.length !== 3) {
        throw new Error(`Expected 3 URL-based dependencies, got ${transitiveDeps.length}`);
      }
      
      const packageNames = transitiveDeps.map(dep => dep.name).sort();
      const expected = ['package-a', 'package-b', 'package-c'];
      if (JSON.stringify(packageNames) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(packageNames)}`);
      }
      
      const normalPackage = transitiveDeps.find(dep => dep.name === 'normal-package');
      if (normalPackage) {
        throw new Error('Should not include npm registry packages');
      }
      
      console.log('  ✓ Extracted 3 URL-based dependencies');
      console.log('  ✓ Filtered out npm registry package');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up for next test
      await fs.unlink(path.join(testRepoPath, 'package-lock.json'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 3: Delete lockfiles
    console.log('Test 3: Delete lockfiles');
    try {
      await fs.writeFile(
        path.join(testRepoPath, 'package-lock.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
      );
      
      // Verify lockfile exists
      await fs.access(path.join(testRepoPath, 'package-lock.json'));
      
      // Delete lockfiles
      await lockfileParser.deleteLockfiles(testRepoPath);
      
      // Verify lockfile was deleted
      try {
        await fs.access(path.join(testRepoPath, 'package-lock.json'));
        throw new Error('Lockfile should have been deleted');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      console.log('  ✓ Lockfile deleted successfully');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 4: Handle missing lockfile gracefully
    console.log('Test 4: Handle missing lockfile gracefully');
    try {
      const lockfileType = await lockfileParser.detectLockfileType(testRepoPath);
      if (lockfileType !== null) {
        throw new Error(`Expected null, got '${lockfileType}'`);
      }
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      if (transitiveDeps.length !== 0) {
        throw new Error(`Expected empty array, got ${transitiveDeps.length} items`);
      }
      
      console.log('  ✓ Detected no lockfile');
      console.log('  ✓ Returned empty array');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 5: Handle malformed lockfile gracefully
    console.log('Test 5: Handle malformed lockfile gracefully');
    try {
      await fs.writeFile(
        path.join(testRepoPath, 'package-lock.json'),
        'this is not valid JSON {'
      );
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      if (transitiveDeps.length !== 0) {
        throw new Error(`Expected empty array for malformed lockfile, got ${transitiveDeps.length} items`);
      }
      
      console.log('  ✓ Handled malformed lockfile gracefully');
      console.log('  ✓ Returned empty array');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up
      await fs.unlink(path.join(testRepoPath, 'package-lock.json'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 6: Extract scoped package names correctly
    console.log('Test 6: Extract scoped package names correctly');
    try {
      const lockfileContent = {
        name: 'test-repo',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          'node_modules/@babel/core': {
            version: '7.0.0',
            resolved: 'https://github.com/babel/babel/archive/v7.0.0.tar.gz'
          },
          'node_modules/@types/node': {
            version: '14.0.0',
            resolved: 'https://github.com/DefinitelyTyped/DefinitelyTyped/archive/node-14.0.0.tar.gz'
          }
        }
      };
      
      await fs.writeFile(
        path.join(testRepoPath, 'package-lock.json'),
        JSON.stringify(lockfileContent, null, 2)
      );
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      
      if (transitiveDeps.length !== 2) {
        throw new Error(`Expected 2 scoped packages, got ${transitiveDeps.length}`);
      }
      
      const babelDep = transitiveDeps.find(dep => dep.name === '@babel/core');
      const typesDep = transitiveDeps.find(dep => dep.name === '@types/node');
      
      if (!babelDep) {
        throw new Error('Expected to find @babel/core');
      }
      if (!typesDep) {
        throw new Error('Expected to find @types/node');
      }
      
      console.log('  ✓ Extracted @babel/core');
      console.log('  ✓ Extracted @types/node');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up
      await fs.unlink(path.join(testRepoPath, 'package-lock.json'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 7: Handle various URL protocols
    console.log('Test 7: Handle various URL protocols');
    try {
      const lockfileContent = {
        name: 'test-repo',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          'node_modules/https-package': {
            version: '1.0.0',
            resolved: 'https://example.com/package.tar.gz'
          },
          'node_modules/http-package': {
            version: '1.0.0',
            resolved: 'http://example.com/package.tar.gz'
          },
          'node_modules/git-package': {
            version: '1.0.0',
            resolved: 'git://github.com/user/package.git'
          },
          'node_modules/git-https-package': {
            version: '1.0.0',
            resolved: 'git+https://github.com/user/package.git'
          },
          'node_modules/git-http-package': {
            version: '1.0.0',
            resolved: 'git+http://github.com/user/package.git'
          }
        }
      };
      
      await fs.writeFile(
        path.join(testRepoPath, 'package-lock.json'),
        JSON.stringify(lockfileContent, null, 2)
      );
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      
      if (transitiveDeps.length !== 5) {
        throw new Error(`Expected 5 URL-based dependencies, got ${transitiveDeps.length}`);
      }
      
      console.log('  ✓ Recognized all 5 URL protocols');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up
      await fs.unlink(path.join(testRepoPath, 'package-lock.json'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
  } finally {
    // Clean up test directory
    if (testRepoPath) {
      try {
        await fs.rm(testRepoPath, { recursive: true, force: true });
        console.log(`✓ Cleaned up test repo: ${testRepoPath}\n`);
      } catch (error) {
        console.log(`✗ Failed to clean up test repo: ${error.message}\n`);
      }
    }
  }
  
  // Print summary
  console.log('=== Test Summary ===');
  console.log(`Total: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  
  if (failedTests === 0) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } else {
    console.log(`\n✗ ${failedTests} test(s) failed`);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
