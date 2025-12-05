/**
 * Manual test script for Grunt build system detection
 * Run with: node test-grunt-detection-manual.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { detectBuildConfiguration } = require('./out/services/environmentDetection');

async function testGruntDetection() {
  console.log('=== Testing Grunt Build System Detection ===\n');

  // Create a temporary test repository
  const testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'codecrypt-grunt-test-'));
  console.log(`Created test repo at: ${testRepoPath}\n`);

  try {
    // Test 1: Detect Gruntfile.js without build script
    console.log('Test 1: Detect Gruntfile.js without build script');
    const packageJson = {
      name: 'test-grunt-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        grunt: '^1.5.0'
      }
    };
    fs.writeFileSync(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const gruntfile = `
module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json')
  });

  grunt.registerTask('default', function() {
    grunt.log.writeln('Building with Grunt...');
  });

  grunt.registerTask('build', function() {
    grunt.log.writeln('Build task completed');
  });
};
`;
    fs.writeFileSync(path.join(testRepoPath, 'Gruntfile.js'), gruntfile);

    const buildConfig = await detectBuildConfiguration(testRepoPath);

    console.log('Build Configuration:', buildConfig);
    console.log('✓ Build tool:', buildConfig.buildTool);
    console.log('✓ Has build script:', buildConfig.hasBuildScript);
    console.log('✓ Build command:', buildConfig.buildCommand);
    console.log('✓ Requires compilation:', buildConfig.requiresCompilation);

    // Verify results
    if (buildConfig.buildTool === 'grunt' &&
        buildConfig.hasBuildScript === true &&
        buildConfig.buildCommand === 'npx grunt') {
      console.log('\n✅ Test 1 PASSED: Grunt detected correctly\n');
    } else {
      console.log('\n❌ Test 1 FAILED: Grunt not detected correctly\n');
      process.exit(1);
    }

    // Test 2: Detect Gruntfile.coffee
    console.log('Test 2: Detect Gruntfile.coffee (CoffeeScript variant)');
    fs.unlinkSync(path.join(testRepoPath, 'Gruntfile.js'));
    
    const gruntfileCoffee = `
module.exports = (grunt) ->
  grunt.initConfig
    pkg: grunt.file.readJSON('package.json')

  grunt.registerTask 'default', ->
    grunt.log.writeln 'Building with Grunt (CoffeeScript)...'
`;
    fs.writeFileSync(path.join(testRepoPath, 'Gruntfile.coffee'), gruntfileCoffee);

    const buildConfig2 = await detectBuildConfiguration(testRepoPath);

    console.log('Build Configuration:', buildConfig2);
    console.log('✓ Build tool:', buildConfig2.buildTool);
    console.log('✓ Has build script:', buildConfig2.hasBuildScript);
    console.log('✓ Build command:', buildConfig2.buildCommand);

    if (buildConfig2.buildTool === 'grunt' &&
        buildConfig2.hasBuildScript === true &&
        buildConfig2.buildCommand === 'npx grunt') {
      console.log('\n✅ Test 2 PASSED: Gruntfile.coffee detected correctly\n');
    } else {
      console.log('\n❌ Test 2 FAILED: Gruntfile.coffee not detected correctly\n');
      process.exit(1);
    }

    // Test 3: npm scripts take priority over Gruntfile
    console.log('Test 3: npm scripts take priority over Gruntfile.js');
    fs.writeFileSync(path.join(testRepoPath, 'Gruntfile.js'), gruntfile);
    fs.unlinkSync(path.join(testRepoPath, 'Gruntfile.coffee'));
    
    const packageJsonWithBuild = {
      name: 'test-grunt-repo',
      version: '1.0.0',
      scripts: {
        build: 'webpack --mode production',
        test: 'echo "test"'
      },
      devDependencies: {
        grunt: '^1.5.0',
        webpack: '^5.0.0'
      }
    };
    fs.writeFileSync(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJsonWithBuild, null, 2)
    );

    const buildConfig3 = await detectBuildConfiguration(testRepoPath);

    console.log('Build Configuration:', buildConfig3);
    console.log('✓ Build tool:', buildConfig3.buildTool);
    console.log('✓ Has build script:', buildConfig3.hasBuildScript);
    console.log('✓ Build command:', buildConfig3.buildCommand);

    if (buildConfig3.hasBuildScript === true &&
        buildConfig3.buildCommand === 'npm run build' &&
        buildConfig3.buildTool === 'webpack') {
      console.log('\n✅ Test 3 PASSED: npm scripts take priority over Gruntfile\n');
    } else {
      console.log('\n❌ Test 3 FAILED: Priority not working correctly\n');
      process.exit(1);
    }

    console.log('=== All Grunt Detection Tests PASSED ===');

  } finally {
    // Clean up test repository
    fs.rmSync(testRepoPath, { recursive: true, force: true });
    console.log(`\nCleaned up test repo at: ${testRepoPath}`);
  }
}

testGruntDetection().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
