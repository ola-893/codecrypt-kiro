/**
 * Property-Based Tests for Environment Detection
 * 
 * **Feature: demo-critical-fixes, Property 3: Build Script Detection Correctness**
 * **Validates: Requirements 3.1, 3.2**
 * 
 * Property: For any repository, if package.json contains no "build" script,
 * the build configuration detector should return hasBuildScript: false.
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as fc from 'fast-check';
import { detectBuildConfiguration } from '../services/environmentDetection';

suite('Environment Detection Property-Based Tests', () => {
  let tempDir: string;

  setup(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'env-detect-prop-test-'));
  });

  teardown(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Arbitraries for generating test data
  const packageNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{1,30}$/)
    .filter((s: string) => s.length >= 2 && !s.endsWith('-') && !s.includes('--'));

  const versionArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 10 }),
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 50 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  const buildScriptNameArbitrary = fc.constantFrom(
    'build',
    'compile',
    'prepare',
    'prepublish',
    'prepublishOnly'
  );

  const nonBuildScriptNameArbitrary = fc.constantFrom(
    'test',
    'start',
    'dev',
    'lint',
    'format',
    'clean'
  );

  const buildToolArbitrary = fc.constantFrom(
    'webpack',
    'vite',
    'tsc',
    'rollup',
    'esbuild',
    'parcel',
    'gulp',
    'grunt'
  );

  /**
   * Property 3: Build Script Detection Correctness
   * 
   * For any repository, if package.json contains no "build" script (or similar),
   * the build configuration detector should return hasBuildScript: false.
   */
  test('Property 3: Build Script Detection Correctness', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          hasBuildScript: fc.boolean(),
          buildScriptName: buildScriptNameArbitrary,
          buildCommand: fc.oneof(
            buildToolArbitrary,
            fc.tuple(buildToolArbitrary, fc.constantFrom('build', 'compile'))
              .map(([tool, cmd]) => `${tool} ${cmd}`)
          ),
          hasTypeScript: fc.boolean(),
          hasOtherScripts: fc.boolean()
        }),
        async ({ hasBuildScript, buildScriptName, buildCommand, hasTypeScript, hasOtherScripts }) => {
          // Create package.json
          const packageJson: any = {
            name: 'test-project',
            version: '1.0.0',
            scripts: {}
          };

          // Add build script if specified
          if (hasBuildScript) {
            packageJson.scripts[buildScriptName] = buildCommand;
          }

          // Add other non-build scripts if specified
          if (hasOtherScripts) {
            packageJson.scripts['test'] = 'jest';
            packageJson.scripts['start'] = 'node index.js';
          }

          // Add TypeScript dependency if specified
          if (hasTypeScript) {
            packageJson.devDependencies = {
              typescript: '^5.0.0'
            };
          }

          await fs.writeFile(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
            'utf-8'
          );

          const config = await detectBuildConfiguration(tempDir);

          // Property: Build script detection accuracy
          if (hasBuildScript) {
            assert.strictEqual(
              config.hasBuildScript,
              true,
              `Should detect build script "${buildScriptName}"`
            );
            assert.ok(
              config.buildCommand,
              'Should have build command when build script exists'
            );
            assert.ok(
              config.buildCommand?.includes(buildScriptName),
              `Build command should reference script name "${buildScriptName}"`
            );
          } else if (hasTypeScript) {
            // TypeScript projects should be detected as requiring compilation
            // even without explicit build script
            assert.strictEqual(
              config.requiresCompilation,
              true,
              'TypeScript projects should require compilation'
            );
          } else {
            // No build script and no TypeScript
            assert.strictEqual(
              config.hasBuildScript,
              false,
              'Should not detect build script when none exists'
            );
          }

          // Invariant: If hasBuildScript is true, buildCommand should be set
          if (config.hasBuildScript) {
            assert.ok(
              config.buildCommand,
              'Build command should be set when hasBuildScript is true'
            );
          }

          // Invariant: If requiresCompilation is true, either hasBuildScript or hasTypeScript
          if (config.requiresCompilation) {
            assert.ok(
              config.hasBuildScript || hasTypeScript,
              'requiresCompilation should only be true if build script or TypeScript exists'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Build tool detection from config files
   * 
   * For any repository with a build tool config file, the detector should
   * identify the build tool correctly.
   */
  test('Property: Build tool detection from config files', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'webpack.config.js',
          'webpack.config.ts',
          'vite.config.js',
          'vite.config.ts',
          'rollup.config.js',
          'gulpfile.js',
          'Gruntfile.js',
          'tsconfig.json'
        ),
        async (configFile) => {
          // Always create package.json for valid test scenario
          // (most build tools require package.json)
          const packageJson = {
            name: 'test-project',
            version: '1.0.0'
          };
          await fs.writeFile(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
            'utf-8'
          );

          // Create config file
          await fs.writeFile(
            path.join(tempDir, configFile),
            '{}',
            'utf-8'
          );

          const config = await detectBuildConfiguration(tempDir);

          // Property: Config file should be detected
          assert.ok(
            config.buildTool,
            `Should detect build tool from ${configFile}`
          );

          // Verify correct tool is detected based on config file
          const expectedTool = configFile.split('.')[0].replace('file', '');
          if (configFile.includes('webpack')) {
            assert.strictEqual(config.buildTool, 'webpack');
          } else if (configFile.includes('vite')) {
            assert.strictEqual(config.buildTool, 'vite');
          } else if (configFile.includes('rollup')) {
            assert.strictEqual(config.buildTool, 'rollup');
          } else if (configFile.includes('gulp')) {
            assert.strictEqual(config.buildTool, 'gulp');
          } else if (configFile.includes('Grunt')) {
            assert.strictEqual(config.buildTool, 'grunt');
          } else if (configFile.includes('tsconfig')) {
            assert.strictEqual(config.buildTool, 'tsc');
          }

          // TypeScript and build tools should require compilation
          if (configFile.includes('tsconfig') || 
              configFile.includes('webpack') || 
              configFile.includes('vite') || 
              configFile.includes('rollup')) {
            assert.strictEqual(
              config.requiresCompilation,
              true,
              `${configFile} should indicate compilation is required`
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Empty or minimal package.json handling
   * 
   * For any repository with no build configuration, the detector should
   * return sensible defaults.
   */
  test('Property: Empty or minimal package.json handling', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          hasPackageJson: fc.boolean(),
          scriptCount: fc.integer({ min: 0, max: 5 })
        }),
        async ({ hasPackageJson, scriptCount }) => {
          if (hasPackageJson) {
            const packageJson: any = {
              name: 'test-project',
              version: '1.0.0'
            };

            if (scriptCount > 0) {
              packageJson.scripts = {};
              // Add non-build scripts
              for (let i = 0; i < scriptCount; i++) {
                packageJson.scripts[`script${i}`] = `echo "script ${i}"`;
              }
            }

            await fs.writeFile(
              path.join(tempDir, 'package.json'),
              JSON.stringify(packageJson, null, 2),
              'utf-8'
            );
          }

          const config = await detectBuildConfiguration(tempDir);

          // Property: Should not crash and return valid config
          assert.ok(config, 'Should return a config object');
          assert.strictEqual(typeof config.hasBuildScript, 'boolean');
          assert.strictEqual(typeof config.requiresCompilation, 'boolean');

          // Without build scripts or config files, should be false
          assert.strictEqual(
            config.hasBuildScript,
            false,
            'Should not detect build script in minimal config'
          );
          assert.strictEqual(
            config.requiresCompilation,
            false,
            'Should not require compilation in minimal config'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Build script priority
   * 
   * When multiple build-related scripts exist, the detector should
   * prioritize them correctly (build > compile > prepare > prepublish).
   */
  test('Property: Build script priority', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(buildScriptNameArbitrary, { minLength: 1, maxLength: 5 }),
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

          // Property: Should detect a build script
          assert.strictEqual(
            config.hasBuildScript,
            true,
            'Should detect at least one build script'
          );

          // Property: Should prioritize 'build' if it exists
          if (scriptNames.includes('build')) {
            assert.ok(
              config.buildCommand?.includes('build'),
              'Should prioritize "build" script'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Consistency across multiple calls
   * 
   * For any repository configuration, multiple calls to detectBuildConfiguration
   * should return the same result.
   */
  test('Property: Consistency across multiple calls', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          hasBuildScript: fc.boolean(),
          hasTypeScript: fc.boolean(),
          hasConfigFile: fc.boolean()
        }),
        async ({ hasBuildScript, hasTypeScript, hasConfigFile }) => {
          const packageJson: any = {
            name: 'test-project',
            version: '1.0.0',
            scripts: {}
          };

          if (hasBuildScript) {
            packageJson.scripts.build = 'webpack';
          }

          if (hasTypeScript) {
            packageJson.devDependencies = {
              typescript: '^5.0.0'
            };
          }

          await fs.writeFile(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
            'utf-8'
          );

          if (hasConfigFile) {
            await fs.writeFile(
              path.join(tempDir, 'webpack.config.js'),
              '{}',
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
