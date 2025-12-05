/**
 * Integration Test for Rollup Build System Detection
 * Task 25: Test Rollup build system
 * 
 * This test validates the Rollup build system detection flow including:
 * - rollup.config.js detection
 * - "npx rollup build" command generation
 * - Successful compilation validation
 * 
 * Requirements: 2.1, 2.5, 2.7, 6.1-6.3
 */

import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { detectBuildConfiguration } from '../services/environmentDetection';

describe('Rollup Build System Detection Integration Tests', () => {
  let testRepoPath: string;

  beforeEach(async () => {
    // Create a temporary test repository
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-rollup-test-'));
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
   * Test 1: Detect rollup.config.js without build script
   * Requirements: 2.1, 2.5
   */
  it('should detect rollup.config.js and generate npx rollup build command', async () => {
    // Create package.json without build script
    const packageJson = {
      name: 'test-rollup-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        rollup: '^3.28.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create rollup.config.js
    const rollupConfig = `
export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'esm'
  }
};
`;
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.js'), rollupConfig);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Rollup was detected
    assert.strictEqual(buildConfig.buildTool, 'rollup', 'Should detect rollup as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should mark as having build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx rollup build', 'Should generate npx rollup build command');
  });

  /**
   * Test 2: Prioritize npm scripts over rollup.config.js
   * Requirements: 2.7
   */
  it('should prioritize npm build script over rollup.config.js', async () => {
    // Create package.json WITH build script
    const packageJson = {
      name: 'test-rollup-repo',
      version: '1.0.0',
      scripts: {
        build: 'rollup -c rollup.config.prod.js',
        test: 'echo "test"'
      },
      devDependencies: {
        rollup: '^3.28.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create rollup.config.js (should be ignored in favor of npm script)
    const rollupConfig = `export default {};`;
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.js'), rollupConfig);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify npm script takes priority
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run build', 'Should use npm script command');
    assert.strictEqual(buildConfig.buildTool, 'rollup', 'Should detect rollup from script content');
  });

  /**
   * Test 3: Detect rollup.config.js in TypeScript project
   * Requirements: 2.1, 2.5
   */
  it('should detect rollup.config.js in TypeScript project', async () => {
    // Create package.json with TypeScript
    const packageJson = {
      name: 'test-rollup-ts-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        rollup: '^3.28.0',
        '@rollup/plugin-typescript': '^11.1.0',
        typescript: '^5.0.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create rollup.config.js with TypeScript plugin
    const rollupConfig = `
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'esm'
  },
  plugins: [typescript()]
};
`;
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.js'), rollupConfig);

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        outDir: './dist'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Rollup was detected (should take priority over tsc since rollup.config.js exists)
    assert.strictEqual(buildConfig.buildTool, 'rollup', 'Should detect rollup as build tool');
    assert.strictEqual(buildConfig.buildCommand, 'npx rollup build', 'Should generate npx rollup build command');
    assert.strictEqual(buildConfig.requiresCompilation, true, 'Should require compilation (TypeScript present)');
  });

  /**
   * Test 4: Detect multiple build tools with priority
   * Requirements: 2.7
   */
  it('should handle multiple build tools with correct priority', async () => {
    // Create package.json without build script
    const packageJson = {
      name: 'test-multi-tool-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        rollup: '^3.28.0',
        webpack: '^5.88.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create both rollup.config.js and webpack.config.js
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.js'), 'export default {};');
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), 'module.exports = {};');

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify one was selected (implementation may vary, but should be consistent)
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.ok(
      buildConfig.buildTool === 'rollup' || buildConfig.buildTool === 'webpack',
      'Should detect either rollup or webpack'
    );
    assert.ok(
      buildConfig.buildCommand === 'npx rollup build' || buildConfig.buildCommand === 'npx webpack build',
      'Should generate appropriate npx command'
    );
  });

  /**
   * Test 5: Rollup with library build
   * Requirements: 2.1, 2.5
   */
  it('should detect rollup in library project', async () => {
    // Create package.json for a library
    const packageJson = {
      name: 'test-rollup-library',
      version: '1.0.0',
      main: 'dist/index.js',
      module: 'dist/index.esm.js',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        rollup: '^3.28.0',
        '@rollup/plugin-node-resolve': '^15.1.0',
        '@rollup/plugin-commonjs': '^25.0.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create rollup.config.js with multiple outputs
    const rollupConfig = `
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs'
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm'
    }
  ],
  plugins: [resolve(), commonjs()]
};
`;
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.js'), rollupConfig);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Rollup was detected
    assert.strictEqual(buildConfig.buildTool, 'rollup', 'Should detect rollup as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should mark as having build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx rollup build', 'Should generate npx rollup build command');
  });

  /**
   * Test 6: Rollup with prepare script
   * Requirements: 2.1, 2.5
   */
  it('should detect rollup when used in prepare script', async () => {
    // Create package.json with prepare script using rollup
    const packageJson = {
      name: 'test-rollup-prepare-repo',
      version: '1.0.0',
      scripts: {
        prepare: 'rollup -c',
        test: 'echo "test"'
      },
      devDependencies: {
        rollup: '^3.28.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create rollup.config.js
    await fs.writeFile(
      path.join(testRepoPath, 'rollup.config.js'),
      'export default {};'
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify build script was detected
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run prepare', 'Should use prepare script');
    assert.strictEqual(buildConfig.buildTool, 'rollup', 'Should detect rollup from rollup.config.js');
  });

  /**
   * Test 7: Comprehensive Rollup detection scenario
   * Requirements: 2.1, 2.5, 2.7, 6.1-6.3
   */
  it('should complete full Rollup build system detection workflow', async () => {
    // Create package.json without build script but with rollup dependency
    const packageJson = {
      name: 'comprehensive-rollup-test',
      version: '1.0.0',
      type: 'module',
      scripts: {
        test: 'vitest',
        dev: 'rollup -c -w'
      },
      devDependencies: {
        rollup: '^3.28.0',
        '@rollup/plugin-typescript': '^11.1.0',
        '@rollup/plugin-node-resolve': '^15.1.0',
        typescript: '^5.0.0',
        vitest: '^0.34.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create rollup.config.js with comprehensive setup
    const rollupConfig = `
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/bundle.cjs.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/bundle.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json'
    })
  ],
  external: ['lodash']
};
`;
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.js'), rollupConfig);

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        declaration: true,
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
      'export const hello = () => console.log("Hello from Rollup");'
    );

    // Step 1: Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Step 2: Verify Rollup detection
    assert.strictEqual(buildConfig.buildTool, 'rollup', 'Should detect rollup as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx rollup build', 'Should generate npx rollup build command');
    assert.strictEqual(buildConfig.requiresCompilation, true, 'Should require compilation (TypeScript)');

    // Step 3: Verify the build command is executable (structure check)
    assert.ok(buildConfig.buildCommand.startsWith('npx'), 'Build command should use npx');
    assert.ok(buildConfig.buildCommand.includes('rollup'), 'Build command should include rollup');

    // Step 4: Verify configuration is complete
    assert.notStrictEqual(buildConfig.buildTool, 'none', 'Should have a build tool');
    assert.notStrictEqual(buildConfig.buildCommand, null, 'Should have a build command');
  });

  /**
   * Test 8: Rollup with multiple config files
   * Requirements: 2.5, 2.7
   */
  it('should handle Rollup with multiple config files', async () => {
    // Create package.json with environment-specific builds
    const packageJson = {
      name: 'test-rollup-multi-config-repo',
      version: '1.0.0',
      scripts: {
        'build:dev': 'rollup -c rollup.config.dev.js',
        'build:prod': 'rollup -c rollup.config.prod.js',
        test: 'echo "test"'
      },
      devDependencies: {
        rollup: '^3.28.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create rollup.config.js (base config)
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.js'), 'export default {};');
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.dev.js'), 'export default {};');
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.prod.js'), 'export default {};');

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify rollup was detected with one of the build scripts
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildTool, 'rollup', 'Should detect rollup');
    assert.ok(
      buildConfig.buildCommand === 'npm run build:dev' || buildConfig.buildCommand === 'npm run build:prod',
      'Should use one of the build scripts'
    );
  });

  /**
   * Test 9: Rollup with React library
   * Requirements: 2.1, 2.5
   */
  it('should detect rollup in React library project', async () => {
    // Create package.json for React library
    const packageJson = {
      name: 'test-rollup-react-lib',
      version: '1.0.0',
      main: 'dist/index.js',
      module: 'dist/index.esm.js',
      scripts: {
        test: 'echo "test"'
      },
      peerDependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0'
      },
      devDependencies: {
        rollup: '^3.28.0',
        '@rollup/plugin-babel': '^6.0.0',
        '@rollup/plugin-node-resolve': '^15.1.0',
        '@babel/core': '^7.22.0',
        '@babel/preset-react': '^7.22.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create rollup.config.js with React setup
    const rollupConfig = `
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.jsx',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs'
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm'
    }
  ],
  plugins: [
    resolve(),
    babel({
      babelHelpers: 'bundled',
      presets: ['@babel/preset-react']
    })
  ],
  external: ['react', 'react-dom']
};
`;
    await fs.writeFile(path.join(testRepoPath, 'rollup.config.js'), rollupConfig);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Rollup was detected
    assert.strictEqual(buildConfig.buildTool, 'rollup', 'Should detect rollup as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should mark as having build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx rollup build', 'Should generate npx rollup build command');
  });

  /**
   * Test 10: Rollup with compile script alias
   * Requirements: 2.1, 2.5
   */
  it('should detect rollup when used in compile script', async () => {
    // Create package.json with compile script
    const packageJson = {
      name: 'test-rollup-compile-repo',
      version: '1.0.0',
      scripts: {
        compile: 'rollup -c',
        test: 'echo "test"'
      },
      devDependencies: {
        rollup: '^3.28.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create rollup.config.js
    await fs.writeFile(
      path.join(testRepoPath, 'rollup.config.js'),
      'export default {};'
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify build script was detected
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run compile', 'Should use compile script');
    assert.strictEqual(buildConfig.buildTool, 'rollup', 'Should detect rollup');
  });
});
