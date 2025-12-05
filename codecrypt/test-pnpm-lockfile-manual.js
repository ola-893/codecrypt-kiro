/**
 * Manual Test Script for pnpm Lockfile Parsing
 * Task 11: Test pnpm lockfile parsing
 * 
 * This script manually tests the lockfile parser with various pnpm lockfile scenarios.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { createLockfileParser } = require('./out/services/lockfileParser');

async function runTests() {
  console.log('=== pnpm Lockfile Parsing Manual Test ===\n');
  
  let testRepoPath;
  let passedTests = 0;
  let failedTests = 0;
  
  try {
    // Create temporary test directory
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-pnpm-lockfile-test-'));
    console.log(`✓ Created test repo at: ${testRepoPath}\n`);
    
    const lockfileParser = createLockfileParser();
    
    // Test 1: Parse pnpm lockfile with URL-based dependency
    console.log('Test 1: Parse pnpm lockfile with URL-based dependency');
    try {
      const lockfileContent = `lockfileVersion: 5.4

specifiers:
  querystring: https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz

dependencies:
  querystring: 0.2.0

packages:

  /querystring/0.2.0:
    resolution: {tarball: https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz}
    dev: false
`;
      
      await fs.writeFile(
        path.join(testRepoPath, 'pnpm-lock.yaml'),
        lockfileContent
      );
      
      const lockfileType = await lockfileParser.detectLockfileType(testRepoPath);
      if (lockfileType !== 'pnpm') {
        throw new Error(`Expected 'pnpm', got '${lockfileType}'`);
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
      
      console.log('  ✓ Detected pnpm lockfile');
      console.log('  ✓ Extracted URL-based dependency');
      console.log(`  ✓ Found querystring with correct URL`);
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up for next test
      await fs.unlink(path.join(testRepoPath, 'pnpm-lock.yaml'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 2: Parse lockfile with multiple URL-based dependencies
    console.log('Test 2: Parse lockfile with multiple URL-based dependencies');
    try {
      const lockfileContent = `lockfileVersion: 5.4

packages:

  /package-a/1.0.0:
    resolution: {tarball: https://github.com/user/package-a/archive/v1.0.0.tar.gz}
    dev: false

  /package-b/2.0.0:
    resolution: {tarball: https://github.com/user/package-b/archive/v2.0.0.tar.gz}
    dev: false

  /package-c/3.0.0:
    resolution: {tarball: git+https://github.com/user/package-c.git#abc123}
    dev: false

  /normal-package/1.0.0:
    resolution: {integrity: sha512-test123, tarball: https://registry.npmjs.org/normal-package/-/normal-package-1.0.0.tgz}
    dev: false
`;
      
      await fs.writeFile(
        path.join(testRepoPath, 'pnpm-lock.yaml'),
        lockfileContent
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
      await fs.unlink(path.join(testRepoPath, 'pnpm-lock.yaml'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 3: Delete lockfiles
    console.log('Test 3: Delete lockfiles');
    try {
      await fs.writeFile(
        path.join(testRepoPath, 'pnpm-lock.yaml'),
        'lockfileVersion: 5.4\n'
      );
      
      // Verify lockfile exists
      await fs.access(path.join(testRepoPath, 'pnpm-lock.yaml'));
      
      // Delete lockfiles
      await lockfileParser.deleteLockfiles(testRepoPath);
      
      // Verify lockfile was deleted
      try {
        await fs.access(path.join(testRepoPath, 'pnpm-lock.yaml'));
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
        path.join(testRepoPath, 'pnpm-lock.yaml'),
        'lockfileVersion: 5.4\n  invalid: yaml: structure: ['
      );
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      
      // Should handle gracefully and return an array
      if (!Array.isArray(transitiveDeps)) {
        throw new Error('Expected an array to be returned');
      }
      
      console.log('  ✓ Handled malformed lockfile gracefully');
      console.log('  ✓ Returned an array');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up
      await fs.unlink(path.join(testRepoPath, 'pnpm-lock.yaml'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 6: Extract scoped package names correctly
    console.log('Test 6: Extract scoped package names correctly');
    try {
      const lockfileContent = `lockfileVersion: 5.4

packages:

  /@babel/core/7.0.0:
    resolution: {tarball: https://github.com/babel/babel/archive/v7.0.0.tar.gz}
    dev: false

  /@types/node/14.0.0:
    resolution: {tarball: https://github.com/DefinitelyTyped/DefinitelyTyped/archive/node-14.0.0.tar.gz}
    dev: false
`;
      
      await fs.writeFile(
        path.join(testRepoPath, 'pnpm-lock.yaml'),
        lockfileContent
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
      await fs.unlink(path.join(testRepoPath, 'pnpm-lock.yaml'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 7: Handle various URL protocols
    console.log('Test 7: Handle various URL protocols');
    try {
      const lockfileContent = `lockfileVersion: 5.4

packages:

  /https-package/1.0.0:
    resolution: {tarball: https://example.com/package.tar.gz}
    dev: false

  /http-package/1.0.0:
    resolution: {tarball: http://example.com/package.tar.gz}
    dev: false

  /git-package/1.0.0:
    resolution: {tarball: git://github.com/user/package.git}
    dev: false

  /git-https-package/1.0.0:
    resolution: {tarball: git+https://github.com/user/package.git}
    dev: false

  /git-http-package/1.0.0:
    resolution: {tarball: git+http://github.com/user/package.git}
    dev: false
`;
      
      await fs.writeFile(
        path.join(testRepoPath, 'pnpm-lock.yaml'),
        lockfileContent
      );
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      
      if (transitiveDeps.length !== 5) {
        throw new Error(`Expected 5 URL-based dependencies, got ${transitiveDeps.length}`);
      }
      
      console.log('  ✓ Recognized all 5 URL protocols');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up
      await fs.unlink(path.join(testRepoPath, 'pnpm-lock.yaml'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 8: Handle empty pnpm lockfile
    console.log('Test 8: Handle empty pnpm lockfile');
    try {
      const lockfileContent = `lockfileVersion: 5.4

packages: {}
`;
      
      await fs.writeFile(
        path.join(testRepoPath, 'pnpm-lock.yaml'),
        lockfileContent
      );
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      
      if (transitiveDeps.length !== 0) {
        throw new Error(`Expected empty array, got ${transitiveDeps.length} items`);
      }
      
      console.log('  ✓ Handled empty lockfile gracefully');
      console.log('  ✓ Returned empty array');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up
      await fs.unlink(path.join(testRepoPath, 'pnpm-lock.yaml'));
    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failedTests++;
    }
    
    // Test 9: Handle registry-only lockfile
    console.log('Test 9: Handle registry-only lockfile');
    try {
      const lockfileContent = `lockfileVersion: 5.4

packages:

  /express/4.18.0:
    resolution: {integrity: sha512-test123, tarball: https://registry.npmjs.org/express/-/express-4.18.0.tgz}
    dev: false

  /lodash/4.17.21:
    resolution: {integrity: sha512-test456, tarball: https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz}
    dev: false
`;
      
      await fs.writeFile(
        path.join(testRepoPath, 'pnpm-lock.yaml'),
        lockfileContent
      );
      
      const transitiveDeps = await lockfileParser.parseLockfile(testRepoPath);
      
      if (transitiveDeps.length !== 0) {
        throw new Error(`Expected empty array for registry-only deps, got ${transitiveDeps.length} items`);
      }
      
      console.log('  ✓ Handled registry-only lockfile correctly');
      console.log('  ✓ Returned empty array');
      console.log(`  ✓ PASSED\n`);
      passedTests++;
      
      // Clean up
      await fs.unlink(path.join(testRepoPath, 'pnpm-lock.yaml'));
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
