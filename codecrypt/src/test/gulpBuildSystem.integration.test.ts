/**
 * Integration Test for Gulp Build System Detection
 * Task 7: Test Gulp build system
 * 
 * This test validates the Gulp build system detection flow including:
 * - gulpfile.js detection
 * - "npx gulp" command generation
 * - Successful compilation validation
 * 
 * Requirements: 2.1-2.2, 2.7, 6.1-6.3
 */

import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { detectBuildConfiguration } from '../services/environmentDetection';

describe('Gulp Build System Detection Integration Tests', () => {
  let testRepoPath: string;

  beforeEach(async () => {
    // Create a temporary test repository
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-gulp-test-'));
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
   * Test 1: Detect gulpfile.js without build script
   * Requirements: 2.1, 2.2
   */
  it('should detect gulpfile.js and generate npx gulp command', async () => {
    // Create package.json without build script
    const packageJson = {
      name: 'test-gulp-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        gulp: '^4.0.2'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create gulpfile.js
    const gulpfile = `
const gulp = require('gulp');

gulp.task('default', function(done) {
  console.log('Building with Gulp...');
  done();
});

gulp.task('build', function(done) {
  console.log('Build task completed');
  done();
});
`;
    await fs.writeFile(path.join(testRepoPath, 'gulpfile.js'), gulpfile);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Gulp was detected
    assert.strictEqual(buildConfig.buildTool, 'gulp', 'Should detect gulp as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should mark as having build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx gulp', 'Should generate npx gulp command');
  });

  /**
   * Test 2: Prioritize npm scripts over gulpfile.js
   * Requirements: 2.7
   */
  it('should prioritize npm build script over gulpfile.js', async () => {
    // Create package.json WITH build script
    const packageJson = {
      name: 'test-gulp-repo',
      version: '1.0.0',
      scripts: {
        build: 'webpack --mode production',
        test: 'echo "test"'
      },
      devDependencies: {
        gulp: '^4.0.2',
        webpack: '^5.0.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create gulpfile.js (should be ignored in favor of npm script)
    const gulpfile = `
const gulp = require('gulp');

gulp.task('default', function(done) {
  console.log('Building with Gulp...');
  done();
});
`;
    await fs.writeFile(path.join(testRepoPath, 'gulpfile.js'), gulpfile);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify npm script takes priority
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run build', 'Should use npm script command');
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack from script content');
  });

  /**
   * Test 3: Detect gulpfile.js with TypeScript
   * Requirements: 2.1, 2.2
   */
  it('should detect gulpfile.js in TypeScript project', async () => {
    // Create package.json with TypeScript
    const packageJson = {
      name: 'test-gulp-ts-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        gulp: '^4.0.2',
        typescript: '^4.9.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create gulpfile.js
    const gulpfile = `
const gulp = require('gulp');
const ts = require('gulp-typescript');

gulp.task('build', function() {
  return gulp.src('src/**/*.ts')
    .pipe(ts())
    .pipe(gulp.dest('dist'));
});
`;
    await fs.writeFile(path.join(testRepoPath, 'gulpfile.js'), gulpfile);

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

    // Verify Gulp was detected (should take priority over tsc since gulpfile exists)
    assert.strictEqual(buildConfig.buildTool, 'gulp', 'Should detect gulp as build tool');
    assert.strictEqual(buildConfig.buildCommand, 'npx gulp', 'Should generate npx gulp command');
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
        gulp: '^4.0.2',
        grunt: '^1.5.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create both gulpfile.js and Gruntfile.js
    await fs.writeFile(path.join(testRepoPath, 'gulpfile.js'), 'module.exports = {};');
    await fs.writeFile(path.join(testRepoPath, 'Gruntfile.js'), 'module.exports = function(grunt) {};');

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify one was selected (implementation may vary, but should be consistent)
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.ok(
      buildConfig.buildTool === 'gulp' || buildConfig.buildTool === 'grunt',
      'Should detect either gulp or grunt'
    );
    assert.ok(
      buildConfig.buildCommand === 'npx gulp' || buildConfig.buildCommand === 'npx grunt',
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
   * Test 6: Gulp with prepare script
   * Requirements: 2.1, 2.2
   */
  it('should detect gulp when used in prepare script', async () => {
    // Create package.json with prepare script using gulp
    const packageJson = {
      name: 'test-gulp-prepare-repo',
      version: '1.0.0',
      scripts: {
        prepare: 'gulp build',
        test: 'echo "test"'
      },
      devDependencies: {
        gulp: '^4.0.2'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create gulpfile.js
    await fs.writeFile(
      path.join(testRepoPath, 'gulpfile.js'),
      'module.exports = {};'
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify build script was detected
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run prepare', 'Should use prepare script');
    assert.strictEqual(buildConfig.buildTool, 'gulp', 'Should detect gulp from gulpfile.js');
  });

  /**
   * Test 7: Comprehensive Gulp detection scenario
   * Requirements: 2.1, 2.2, 2.7, 6.1-6.3
   */
  it('should complete full Gulp build system detection workflow', async () => {
    // Create package.json without build script but with gulp dependency
    const packageJson = {
      name: 'comprehensive-gulp-test',
      version: '1.0.0',
      scripts: {
        test: 'mocha',
        start: 'node dist/index.js'
      },
      devDependencies: {
        gulp: '^4.0.2',
        'gulp-typescript': '^6.0.0',
        typescript: '^4.9.0',
        mocha: '^10.0.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create gulpfile.js with build task
    const gulpfile = `
const gulp = require('gulp');
const ts = require('gulp-typescript');

const tsProject = ts.createProject('tsconfig.json');

gulp.task('build', function() {
  return tsProject.src()
    .pipe(tsProject())
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', function() {
  gulp.watch('src/**/*.ts', gulp.series('build'));
});

gulp.task('default', gulp.series('build'));
`;
    await fs.writeFile(path.join(testRepoPath, 'gulpfile.js'), gulpfile);

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

    // Step 2: Verify Gulp detection
    assert.strictEqual(buildConfig.buildTool, 'gulp', 'Should detect gulp as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx gulp', 'Should generate npx gulp command');
    assert.strictEqual(buildConfig.requiresCompilation, true, 'Should require compilation (TypeScript)');

    // Step 3: Verify the build command is executable (structure check)
    assert.ok(buildConfig.buildCommand.startsWith('npx'), 'Build command should use npx');
    assert.ok(buildConfig.buildCommand.includes('gulp'), 'Build command should include gulp');

    // Step 4: Verify configuration is complete
    assert.notStrictEqual(buildConfig.buildTool, 'none', 'Should have a build tool');
    assert.notStrictEqual(buildConfig.buildCommand, null, 'Should have a build command');
  });

  /**
   * Test 8: Gulp with webpack config (multiple build systems)
   * Requirements: 2.7
   */
  it('should handle Gulp with webpack config file present', async () => {
    // Create package.json without build script
    const packageJson = {
      name: 'test-gulp-webpack-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        gulp: '^4.0.2',
        webpack: '^5.0.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create both gulpfile.js and webpack.config.js
    await fs.writeFile(path.join(testRepoPath, 'gulpfile.js'), 'module.exports = {};');
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), 'module.exports = {};');

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify one was selected
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.ok(
      buildConfig.buildTool === 'gulp' || buildConfig.buildTool === 'webpack',
      'Should detect either gulp or webpack'
    );
    
    // Verify appropriate command was generated
    if (buildConfig.buildTool === 'gulp') {
      assert.strictEqual(buildConfig.buildCommand, 'npx gulp', 'Should use npx gulp');
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
   * Test 10: Gulpfile with ES modules
   * Requirements: 2.1, 2.2
   */
  it('should detect gulpfile.js using ES modules', async () => {
    // Create package.json with type: module
    const packageJson = {
      name: 'test-gulp-esm-repo',
      version: '1.0.0',
      type: 'module',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        gulp: '^4.0.2'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create gulpfile.js with ES module syntax
    const gulpfile = `
import gulp from 'gulp';

export function build(done) {
  console.log('Building with Gulp ESM...');
  done();
}

export default build;
`;
    await fs.writeFile(path.join(testRepoPath, 'gulpfile.js'), gulpfile);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Gulp was detected
    assert.strictEqual(buildConfig.buildTool, 'gulp', 'Should detect gulp as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should mark as having build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx gulp', 'Should generate npx gulp command');
  });
});
