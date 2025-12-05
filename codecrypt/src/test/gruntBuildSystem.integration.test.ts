/**
 * Integration Test for Grunt Build System Detection
 * Task 8: Test Grunt build system
 * 
 * This test validates the Grunt build system detection flow including:
 * - Gruntfile.js detection
 * - "npx grunt" command generation
 * - Successful compilation validation
 * 
 * Requirements: 2.1, 2.3, 2.7, 6.1-6.3
 */

import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { detectBuildConfiguration } from '../services/environmentDetection';

describe('Grunt Build System Detection Integration Tests', () => {
  let testRepoPath: string;

  beforeEach(async () => {
    // Create a temporary test repository
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-grunt-test-'));
  });

  afterEach(async () => {
    // Clean up test repository
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Test 1: Detect Gruntfile.js without build script
   * Requirements: 2.1, 2.3
   */
  it('should detect Gruntfile.js and generate npx grunt command', async () => {
    // Create package.json without build script
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
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create Gruntfile.js
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
    await fs.writeFile(path.join(testRepoPath, 'Gruntfile.js'), gruntfile);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Grunt was detected
    assert.strictEqual(buildConfig.buildTool, 'grunt', 'Should detect grunt as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should mark as having build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx grunt', 'Should generate npx grunt command');
  });

  /**
   * Test 2: Prioritize npm scripts over Gruntfile.js
   * Requirements: 2.7
   */
  it('should prioritize npm build script over Gruntfile.js', async () => {
    // Create package.json WITH build script
    const packageJson = {
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
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create Gruntfile.js (should be ignored in favor of npm script)
    const gruntfile = `
module.exports = function(grunt) {
  grunt.registerTask('default', function() {
    grunt.log.writeln('Building with Grunt...');
  });
};
`;
    await fs.writeFile(path.join(testRepoPath, 'Gruntfile.js'), gruntfile);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify npm script takes priority
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run build', 'Should use npm script command');
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack from script content');
  });

  /**
   * Test 3: Detect Gruntfile.js with TypeScript
   * Requirements: 2.1, 2.3
   */
  it('should detect Gruntfile.js in TypeScript project', async () => {
    // Create package.json with TypeScript
    const packageJson = {
      name: 'test-grunt-ts-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        grunt: '^1.5.0',
        'grunt-ts': '^6.0.0',
        typescript: '^4.9.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create Gruntfile.js
    const gruntfile = `
module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-ts');

  grunt.initConfig({
    ts: {
      default: {
        src: ['src/**/*.ts'],
        outDir: 'dist'
      }
    }
  });

  grunt.registerTask('build', ['ts']);
  grunt.registerTask('default', ['build']);
};
`;
    await fs.writeFile(path.join(testRepoPath, 'Gruntfile.js'), gruntfile);

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        outDir: './dist'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Grunt was detected (should take priority over tsc since Gruntfile exists)
    assert.strictEqual(buildConfig.buildTool, 'grunt', 'Should detect grunt as build tool');
    assert.strictEqual(buildConfig.buildCommand, 'npx grunt', 'Should generate npx grunt command');
    assert.strictEqual(buildConfig.requiresCompilation, true, 'Should require compilation (TypeScript present)');
  });

  /**
   * Test 4: Detect multiple task runners with priority
   * Requirements: 2.7
   */
  it('should handle multiple task runners with correct priority', async () => {
    // Create package.json without build script
    const packageJson = {
      name: 'test-multi-runner-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        grunt: '^1.5.0',
        gulp: '^4.0.2'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create both Gruntfile.js and gulpfile.js
    await fs.writeFile(path.join(testRepoPath, 'Gruntfile.js'), 'module.exports = function(grunt) {};');
    await fs.writeFile(path.join(testRepoPath, 'gulpfile.js'), 'module.exports = {};');

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify one was selected (implementation may vary, but should be consistent)
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.ok(
      buildConfig.buildTool === 'grunt' || buildConfig.buildTool === 'gulp',
      'Should detect either grunt or gulp'
    );
    assert.ok(
      buildConfig.buildCommand === 'npx grunt' || buildConfig.buildCommand === 'npx gulp',
      'Should generate appropriate npx command'
    );
  });

  /**
   * Test 5: No build system detected
   * Requirements: 6.1, 6.2, 6.3
   */
  it('should mark as not requiring compilation when no build system exists', async () => {
    // Create package.json without build script or task runners
    const packageJson = {
      name: 'test-no-build-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"',
        start: 'node index.js'
      },
      dependencies: {
        express: '^4.17.1'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create a simple JavaScript file (no compilation needed)
    await fs.writeFile(
      path.join(testRepoPath, 'index.js'),
      'console.log("Hello World");'
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify no build system detected
    assert.strictEqual(buildConfig.hasBuildScript, false, 'Should not have build script');
    assert.strictEqual(buildConfig.buildCommand, null, 'Should have no build command');
    assert.strictEqual(buildConfig.buildTool, 'none', 'Should have no build tool');
    assert.strictEqual(buildConfig.requiresCompilation, false, 'Should not require compilation');
  });

  /**
   * Test 6: Grunt with prepare script
   * Requirements: 2.1, 2.3
   */
  it('should detect grunt when used in prepare script', async () => {
    // Create package.json with prepare script using grunt
    const packageJson = {
      name: 'test-grunt-prepare-repo',
      version: '1.0.0',
      scripts: {
        prepare: 'grunt build',
        test: 'echo "test"'
      },
      devDependencies: {
        grunt: '^1.5.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create Gruntfile.js
    await fs.writeFile(
      path.join(testRepoPath, 'Gruntfile.js'),
      'module.exports = function(grunt) {};'
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify build script was detected
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run prepare', 'Should use prepare script');
    assert.strictEqual(buildConfig.buildTool, 'grunt', 'Should detect grunt from Gruntfile.js');
  });

  /**
   * Test 7: Comprehensive Grunt detection scenario
   * Requirements: 2.1, 2.3, 2.7, 6.1-6.3
   */
  it('should complete full Grunt build system detection workflow', async () => {
    // Create package.json without build script but with grunt dependency
    const packageJson = {
      name: 'comprehensive-grunt-test',
      version: '1.0.0',
      scripts: {
        test: 'mocha',
        start: 'node dist/index.js'
      },
      devDependencies: {
        grunt: '^1.5.0',
        'grunt-ts': '^6.0.0',
        typescript: '^4.9.0',
        mocha: '^10.0.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create Gruntfile.js with build task
    const gruntfile = `
module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-ts');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    ts: {
      default: {
        src: ['src/**/*.ts'],
        outDir: 'dist',
        options: {
          module: 'commonjs',
          target: 'es2020'
        }
      }
    }
  });

  grunt.registerTask('build', ['ts']);
  grunt.registerTask('watch', function() {
    grunt.log.writeln('Watching files...');
  });
  grunt.registerTask('default', ['build']);
};
`;
    await fs.writeFile(path.join(testRepoPath, 'Gruntfile.js'), gruntfile);

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        outDir: './dist',
        rootDir: './src'
      },
      include: ['src/**/*']
    };
    await fs.writeFile(
      path.join(testRepoPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    // Create source directory structure
    await fs.mkdir(path.join(testRepoPath, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(testRepoPath, 'src', 'index.ts'),
      'console.log("Hello from TypeScript");'
    );

    // Step 1: Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Step 2: Verify Grunt detection
    assert.strictEqual(buildConfig.buildTool, 'grunt', 'Should detect grunt as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx grunt', 'Should generate npx grunt command');
    assert.strictEqual(buildConfig.requiresCompilation, true, 'Should require compilation (TypeScript)');

    // Step 3: Verify the build command is executable (structure check)
    assert.ok(buildConfig.buildCommand.startsWith('npx'), 'Build command should use npx');
    assert.ok(buildConfig.buildCommand.includes('grunt'), 'Build command should include grunt');

    // Step 4: Verify configuration is complete
    assert.notStrictEqual(buildConfig.buildTool, 'none', 'Should have a build tool');
    assert.notStrictEqual(buildConfig.buildCommand, null, 'Should have a build command');
  });

  /**
   * Test 8: Grunt with webpack config (multiple build systems)
   * Requirements: 2.7
   */
  it('should handle Grunt with webpack config file present', async () => {
    // Create package.json without build script
    const packageJson = {
      name: 'test-grunt-webpack-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        grunt: '^1.5.0',
        webpack: '^5.0.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create both Gruntfile.js and webpack.config.js
    await fs.writeFile(path.join(testRepoPath, 'Gruntfile.js'), 'module.exports = function(grunt) {};');
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), 'module.exports = {};');

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify one was selected
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.ok(
      buildConfig.buildTool === 'grunt' || buildConfig.buildTool === 'webpack',
      'Should detect either grunt or webpack'
    );
    
    // Verify appropriate command was generated
    if (buildConfig.buildTool === 'grunt') {
      assert.strictEqual(buildConfig.buildCommand, 'npx grunt', 'Should use npx grunt');
    } else if (buildConfig.buildTool === 'webpack') {
      assert.strictEqual(buildConfig.buildCommand, 'npx webpack build', 'Should use npx webpack');
    }
  });

  /**
   * Test 9: Test script fallback when no build script exists
   * Requirements: 6.5
   */
  it('should use test script as fallback validation when no build exists', async () => {
    // Create package.json with only test script
    const packageJson = {
      name: 'test-only-repo',
      version: '1.0.0',
      scripts: {
        test: 'jest'
      },
      devDependencies: {
        jest: '^29.0.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify no build system detected
    assert.strictEqual(buildConfig.hasBuildScript, false, 'Should not have build script');
    assert.strictEqual(buildConfig.buildCommand, null, 'Should have no build command');
    assert.strictEqual(buildConfig.buildTool, 'none', 'Should have no build tool');
    
    // Note: The test script fallback is handled at a higher level (CompilationRunner)
    // This test verifies that detectBuildConfiguration correctly reports no build system
  });

  /**
   * Test 10: Gruntfile with CoffeeScript
   * Requirements: 2.1, 2.3
   */
  it('should detect Gruntfile.coffee (CoffeeScript variant)', async () => {
    // Create package.json
    const packageJson = {
      name: 'test-grunt-coffee-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        grunt: '^1.5.0',
        'coffee-script': '^1.12.7'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create Gruntfile.coffee
    const gruntfile = `
module.exports = (grunt) ->
  grunt.initConfig
    pkg: grunt.file.readJSON('package.json')

  grunt.registerTask 'default', ->
    grunt.log.writeln 'Building with Grunt (CoffeeScript)...'

  grunt.registerTask 'build', ->
    grunt.log.writeln 'Build task completed'
`;
    await fs.writeFile(path.join(testRepoPath, 'Gruntfile.coffee'), gruntfile);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Grunt was detected (Gruntfile.coffee should be recognized)
    assert.strictEqual(buildConfig.buildTool, 'grunt', 'Should detect grunt as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should mark as having build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx grunt', 'Should generate npx grunt command');
  });
});
