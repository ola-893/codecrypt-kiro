/**
 * Property-Based Tests for Build System Priority
 * 
 * **Feature: demo-readiness-fixes, Property 3: Build System Detection Priority**
 * **Validates: Requirements 2.7**
 * 
 * Property: For any repository with multiple build systems, npm scripts should
 * always take priority over task runner files when both exist.
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as fc from 'fast-check';
import { detectBuildConfiguration } from '../services/environmentDetection';

suite('Build System Priority Property-Based Tests', () => {
  let tempDir: string;

  setup(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'build-priority-test-'));
  });

  teardown(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Arbitraries for generating test data
  const buildScriptNameArbitrary = fc.constantFrom(
    'build',
    'compile',
    'prepare',
    'prepublish',
    'prepublishOnly'
  );

  const taskRunnerFileArbitrary = fc.constantFrom(
    'gulpfile.js',
    'Gruntfile.js',
    'webpack.config.js',
    'rollup.config.js'
  );

  const buildToolCommandArbitrary = fc.constantFrom(
    'webpack',
    'vite build',
    'tsc',
    'rollup -c',
    'esbuild src/index.ts'
  );

  /**
   * Property 3: Build System Detection Priority
   * 
   * For any repository with multiple build systems (npm scripts + task runners),
   * npm scripts should always take priority over task runner files.
   */
  test('Property 3: npm scripts take priority over task runners', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          buildScriptName: buildScriptNameArbitrary,
          buildCommand: buildToolCommandArbitrary,
          taskRunnerFiles: fc.array(taskRunnerFileArbitrary, { minLength: 1, maxLength: 4 })
        }),
        async ({ buildScriptName, buildCommand, taskRunnerFiles }) => {
          // Create package.json with build script
          const packageJson = {
            name: 'test-project',
            version: '1.0.0',
            scripts: {
              [buildScriptName]: buildCommand
            }
          };

          await fs.writeFile(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
            'utf-8'
          );

          // Create task runner files
          for (const taskRunnerFile of taskRunnerFiles) {
            await fs.writeFile(
              path.join(tempDir, taskRunnerFile),
              '// Task runner config',
              'utf-8'
            );
          }

          const config = await detectBuildConfiguration(tempDir);

          // Property: npm script should take priority
          assert.strictEqual(
            config.hasBuildScript,
            true,
            'Should detect npm build script'
          );

          assert.ok(
            config.buildCommand,
            'Should have build command'
          );

          assert.ok(
            config.buildCommand.includes('npm run'),
            `Build command should use npm script, got: ${config.buildCommand}`
          );

          assert.ok(
            config.buildCommand.includes(buildScriptName),
            `Build command should reference script name "${buildScriptName}", got: ${config.buildCommand}`
          );

          // Verify it's not using task runner commands directly
          assert.ok(
            !config.buildCommand.includes('npx gulp') &&
            !config.buildCommand.includes('npx grunt') &&
            !config.buildCommand.includes('npx webpack') &&
            !config.buildCommand.includes('npx rollup'),
            `Build command should not use task runner directly when npm script exists, got: ${config.buildCommand}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Task runners are used when no npm scripts exist
   * 
   * For any repository with task runner files but no npm build scripts,
   * the task runner should be detected and used.
   */
  test('Property: Task runners used when no npm scripts', () => {
    fc.assert(
      fc.asyncProperty(
        taskRunnerFileArbitrary,
        async (taskRunnerFile) => {
          // Create package.json WITHOUT build script
          const packageJson = {
            name: 'test-project',
            version: '1.0.0',
            scripts: {
              test: 'jest',
              start: 'node index.js'
            }
          };

          await fs.writeFile(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
            'utf-8'
          );

          // Create task runner file
          await fs.writeFile(
            path.join(tempDir, taskRunnerFile),
            '// Task runner config',
            'utf-8'
          );

          const config = await detectBuildConfiguration(tempDir);

          // Property: Task runner should be detected
          assert.strictEqual(
            config.hasBuildScript,
            true,
            `Should detect task runner from ${taskRunnerFile}`
          );

          assert.ok(
            config.buildCommand,
            'Should have build command'
          );

          // Verify correct task runner is used
          if (taskRunnerFile === 'gulpfile.js') {
            assert.ok(
              config.buildCommand.includes('gulp'),
              `Should use gulp command for gulpfile.js, got: ${config.buildCommand}`
            );
            assert.strictEqual(config.buildTool, 'gulp');
          } else if (taskRunnerFile === 'Gruntfile.js') {
            assert.ok(
              config.buildCommand.includes('grunt'),
              `Should use grunt command for Gruntfile.js, got: ${config.buildCommand}`
            );
            assert.strictEqual(config.buildTool, 'grunt');
          } else if (taskRunnerFile === 'webpack.config.js') {
            assert.ok(
              config.buildCommand.includes('webpack'),
              `Should use webpack command for webpack.config.js, got: ${config.buildCommand}`
            );
            assert.strictEqual(config.buildTool, 'webpack');
          } else if (taskRunnerFile === 'rollup.config.js') {
            assert.ok(
              config.buildCommand.includes('rollup'),
              `Should use rollup command for rollup.config.js, got: ${config.buildCommand}`
            );
            assert.strictEqual(config.buildTool, 'rollup');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Priority is consistent across different combinations
   * 
   * For any combination of build systems, the priority order should be
   * consistent: npm scripts > gulp > grunt > webpack > rollup
   */
  test('Property: Consistent priority across combinations', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          hasNpmScript: fc.boolean(),
          hasGulp: fc.boolean(),
          hasGrunt: fc.boolean(),
          hasWebpack: fc.boolean(),
          hasRollup: fc.boolean()
        }).filter(config => 
          // At least one build system must be present
          config.hasNpmScript || config.hasGulp || config.hasGrunt || 
          config.hasWebpack || config.hasRollup
        ),
        async ({ hasNpmScript, hasGulp, hasGrunt, hasWebpack, hasRollup }) => {
          // Create package.json
          const packageJson: any = {
            name: 'test-project',
            version: '1.0.0',
            scripts: {}
          };

          if (hasNpmScript) {
            packageJson.scripts.build = 'echo "building"';
          }

          await fs.writeFile(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
            'utf-8'
          );

          // Create task runner files
          if (hasGulp) {
            await fs.writeFile(
              path.join(tempDir, 'gulpfile.js'),
              '// Gulp config',
              'utf-8'
            );
          }

          if (hasGrunt) {
            await fs.writeFile(
              path.join(tempDir, 'Gruntfile.js'),
              '// Grunt config',
              'utf-8'
            );
          }

          if (hasWebpack) {
            await fs.writeFile(
              path.join(tempDir, 'webpack.config.js'),
              '// Webpack config',
              'utf-8'
            );
          }

          if (hasRollup) {
            await fs.writeFile(
              path.join(tempDir, 'rollup.config.js'),
              '// Rollup config',
              'utf-8'
            );
          }

          const config = await detectBuildConfiguration(tempDir);

          // Property: Priority order is respected
          if (hasNpmScript) {
            // npm scripts should always win
            assert.ok(
              config.buildCommand?.includes('npm run'),
              `npm script should take priority, got: ${config.buildCommand}`
            );
          } else if (hasGulp) {
            // Gulp should be next priority
            assert.ok(
              config.buildCommand?.includes('gulp'),
              `Gulp should be used when no npm script, got: ${config.buildCommand}`
            );
            assert.strictEqual(config.buildTool, 'gulp');
          } else if (hasGrunt) {
            // Grunt should be next
            assert.ok(
              config.buildCommand?.includes('grunt'),
              `Grunt should be used when no npm script or gulp, got: ${config.buildCommand}`
            );
            assert.strictEqual(config.buildTool, 'grunt');
          } else if (hasWebpack) {
            // Webpack should be next
            assert.ok(
              config.buildCommand?.includes('webpack'),
              `Webpack should be used when no npm script, gulp, or grunt, got: ${config.buildCommand}`
            );
            assert.strictEqual(config.buildTool, 'webpack');
          } else if (hasRollup) {
            // Rollup should be last
            assert.ok(
              config.buildCommand?.includes('rollup'),
              `Rollup should be used when no other build system, got: ${config.buildCommand}`
            );
            assert.strictEqual(config.buildTool, 'rollup');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple npm scripts respect priority
   * 
   * When multiple build-related npm scripts exist, they should be
   * prioritized correctly (build > compile > prepare > prepublish).
   */
  test('Property: Multiple npm scripts respect priority', () => {
    fc.assert(
      fc.asyncProperty(
        fc.shuffledSubarray(
          ['build', 'compile', 'prepare', 'prepublish', 'prepublishOnly'],
          { minLength: 2, maxLength: 5 }
        ),
        async (scriptNames) => {
          const packageJson: any = {
            name: 'test-project',
            version: '1.0.0',
            scripts: {}
          };

          // Add all scripts
          for (const scriptName of scriptNames) {
            packageJson.scripts[scriptName] = `echo "${scriptName}"`;
          }

          await fs.writeFile(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
            'utf-8'
          );

          const config = await detectBuildConfiguration(tempDir);

          // Property: Should prioritize 'build' if it exists
          if (scriptNames.includes('build')) {
            assert.ok(
              config.buildCommand?.includes('npm run build'),
              `Should prioritize "build" script, got: ${config.buildCommand}`
            );
          } else if (scriptNames.includes('compile')) {
            assert.ok(
              config.buildCommand?.includes('npm run compile'),
              `Should prioritize "compile" script when no build, got: ${config.buildCommand}`
            );
          } else if (scriptNames.includes('prepare')) {
            assert.ok(
              config.buildCommand?.includes('npm run prepare'),
              `Should prioritize "prepare" script when no build/compile, got: ${config.buildCommand}`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Detection is deterministic
   * 
   * For any repository configuration, multiple calls should return
   * the same result (same priority, same build command).
   */
  test('Property: Detection is deterministic', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          hasNpmScript: fc.boolean(),
          taskRunnerFiles: fc.array(taskRunnerFileArbitrary, { maxLength: 3 })
        }).filter(config => 
          config.hasNpmScript || config.taskRunnerFiles.length > 0
        ),
        async ({ hasNpmScript, taskRunnerFiles }) => {
          const packageJson: any = {
            name: 'test-project',
            version: '1.0.0',
            scripts: {}
          };

          if (hasNpmScript) {
            packageJson.scripts.build = 'webpack';
          }

          await fs.writeFile(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
            'utf-8'
          );

          for (const taskRunnerFile of taskRunnerFiles) {
            await fs.writeFile(
              path.join(tempDir, taskRunnerFile),
              '// Config',
              'utf-8'
            );
          }

          // Call multiple times
          const config1 = await detectBuildConfiguration(tempDir);
          const config2 = await detectBuildConfiguration(tempDir);
          const config3 = await detectBuildConfiguration(tempDir);

          // Property: All calls should return identical results
          assert.deepStrictEqual(
            config1,
            config2,
            'First and second calls should return same result'
          );
          assert.deepStrictEqual(
            config2,
            config3,
            'Second and third calls should return same result'
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});
