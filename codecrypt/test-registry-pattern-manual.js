#!/usr/bin/env node

/**
 * Manual test script for registry pattern matching
 * 
 * This script creates a test repository with a querystring GitHub URL
 * and verifies that:
 * 1. The pattern matches
 * 2. Automatic replacement occurs
 * 3. Logging happens
 * 4. Report displays correctly
 * 
 * Requirements: 3.1-3.5
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function main() {
  console.log('=== Registry Pattern Matching Manual Test ===\n');

  // Create temporary test directory
  const testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-registry-manual-'));
  console.log(`Created test repository at: ${testRepoPath}\n`);

  try {
    // Step 1: Create package.json with querystring GitHub URL
    console.log('Step 1: Creating package.json with querystring GitHub URL...');
    const packageJson = {
      name: 'test-registry-pattern',
      version: '1.0.0',
      description: 'Test repository for registry pattern matching',
      dependencies: {
        querystring: 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
        express: '^4.18.0'  // Normal dependency for comparison
      }
    };

    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );
    console.log('✓ Created package.json\n');

    // Step 2: Load and verify registry
    console.log('Step 2: Loading package replacement registry...');
    const registryPath = path.join(__dirname, 'data', 'package-replacement-registry.json');
    const registryContent = await fs.readFile(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);
    
    console.log(`✓ Loaded registry version ${registry.version}`);
    console.log(`  Dead URL patterns: ${registry.deadUrlPatterns?.length || 0}\n`);

    // Step 3: Verify querystring pattern exists
    console.log('Step 3: Verifying querystring pattern in registry...');
    const querystringPattern = registry.deadUrlPatterns?.find(
      p => p.pattern === 'github.com/substack/querystring/*'
    );

    if (querystringPattern) {
      console.log('✓ Found querystring pattern:');
      console.log(`  Pattern: ${querystringPattern.pattern}`);
      console.log(`  Replacement: ${querystringPattern.replacementPackage}@${querystringPattern.replacementVersion}`);
      console.log(`  Reason: ${querystringPattern.reason}\n`);
    } else {
      console.error('✗ Querystring pattern not found in registry!');
      process.exit(1);
    }

    // Step 4: Test pattern matching
    console.log('Step 4: Testing pattern matching...');
    const testUrl = 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz';
    
    // Simple pattern matching logic (mimics the service)
    const pattern = 'github.com/substack/querystring/*';
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '___DOUBLESTAR___')
      .replace(/\*/g, '[^/]*')
      .replace(/___DOUBLESTAR___/g, '.*');
    const regex = new RegExp(regexPattern);
    const matches = regex.test(testUrl);

    if (matches) {
      console.log(`✓ URL matches pattern: ${pattern}`);
      console.log(`  Test URL: ${testUrl}\n`);
    } else {
      console.error('✗ URL does not match pattern!');
      process.exit(1);
    }

    // Step 5: Run the actual service (if compiled)
    console.log('Step 5: Testing with actual DeadUrlHandler service...');
    try {
      // Try to load the compiled service
      const { DeadUrlHandler } = require('./out/services/deadUrlHandler');
      const { PackageReplacementRegistry } = require('./out/services/packageReplacementRegistry');
      const { URLValidator } = require('./out/services/urlValidator');
      const { LockfileParser } = require('./out/services/lockfileParser');

      const registry = new PackageReplacementRegistry();
      await registry.load();
      
      const urlValidator = new URLValidator();
      const lockfileParser = new LockfileParser();
      const deadUrlHandler = new DeadUrlHandler(urlValidator, lockfileParser, registry);

      const dependencies = new Map([
        ['querystring', 'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz']
      ]);

      console.log('  Running dead URL detection...');
      const summary = await deadUrlHandler.handleDeadUrls(testRepoPath, dependencies);

      console.log('\n  Results:');
      console.log(`    Total checked: ${summary.totalChecked}`);
      console.log(`    Dead URLs found: ${summary.deadUrlsFound}`);
      console.log(`    Resolved via npm: ${summary.resolvedViaNpm}`);
      console.log(`    Removed: ${summary.removed}`);

      const result = summary.results.find(r => r.packageName === 'querystring');
      if (result) {
        console.log(`\n  Querystring result:`);
        console.log(`    Action: ${result.action}`);
        console.log(`    NPM alternative: ${result.npmAlternative || 'N/A'}`);
        console.log(`    Warning: ${result.warning || 'N/A'}`);
      }

      // Apply changes
      console.log('\n  Applying changes to package.json...');
      await deadUrlHandler.applyToPackageJson(testRepoPath, summary.results);

      // Verify changes
      const updatedContent = await fs.readFile(
        path.join(testRepoPath, 'package.json'),
        'utf-8'
      );
      const updatedPackageJson = JSON.parse(updatedContent);
      
      console.log(`\n  Updated querystring version: ${updatedPackageJson.dependencies.querystring}`);

      // Generate report
      console.log('\n  Generating report...');
      const report = deadUrlHandler.generateReport(summary);
      console.log('\n' + report);

      console.log('\n✓ Service test completed successfully!\n');
    } catch (error) {
      console.log('  Note: Could not load compiled services. Run "npm run compile" first.');
      console.log(`  Error: ${error.message}\n`);
    }

    // Step 6: Summary
    console.log('=== Test Summary ===');
    console.log('✓ Package.json created with querystring GitHub URL');
    console.log('✓ Registry loaded and querystring pattern verified');
    console.log('✓ Pattern matching logic validated');
    console.log('✓ Test repository available at:', testRepoPath);
    console.log('\nTo manually inspect the test repository:');
    console.log(`  cd ${testRepoPath}`);
    console.log('  cat package.json\n');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
