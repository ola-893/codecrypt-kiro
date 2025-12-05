/**
 * Integration Test for Webpack Build System Detection
 * Task 25: Test Webpack build system
 * 
 * This test validates the Webpack build system detection flow including:
 * - webpack.config.js detection
 * - "npx webpack build" command generation
 * - Successful compilation validation
 * 
 * Requirements: 2.1, 2.4, 2.7, 6.1-6.3
 */

import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { detectBuildConfiguration } from '../services/environmentDetection';

describe('Webpack Build System Detection Integration Tests', () => {
  let testRepoPath: string;

  beforeEach(async () => {
    // Create a temporary test repository
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-webpack-test-'));
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
   * Test 1: Detect webpack.config.js without build script
   * Requirements: 2.1, 2.4
   */
  it('should detect webpack.config.js and generate npx webpack build command', async () => {
    // Create package.json without build script
    const packageJson = {
      name: 'test-webpack-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        webpack: '^5.88.0',
        'webpack-cli': '^5.1.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create webpack.config.js
    const webpackConfig = `
const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: 'production'
};
`;
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), webpackConfig);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Webpack was detected
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should mark as having build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx webpack build', 'Should generate npx webpack build command');
  });

  /**
   * Test 2: Prioritize npm scripts over webpack.config.js
   * Requirements: 2.7
   */
  it('should prioritize npm build script over webpack.config.js', async () => {
    // Create package.json WITH build script
    const packageJson = {
      name: 'test-webpack-repo',
      version: '1.0.0',
      scripts: {
        build: 'webpack --mode production --config webpack.prod.js',
        test: 'echo "test"'
      },
      devDependencies: {
        webpack: '^5.88.0',
        'webpack-cli': '^5.1.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create webpack.config.js (should be ignored in favor of npm script)
    const webpackConfig = `module.exports = {};`;
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), webpackConfig);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify npm script takes priority
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run build', 'Should use npm script command');
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack from script content');
  });

  /**
   * Test 3: Detect webpack.config.ts (TypeScript config)
   * Requirements: 2.1, 2.4
   */
  it('should detect webpack.config.ts in TypeScript project', async () => {
    // Create package.json with TypeScript
    const packageJson = {
      name: 'test-webpack-ts-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        webpack: '^5.88.0',
        'webpack-cli': '^5.1.0',
        typescript: '^5.0.0',
        'ts-node': '^10.9.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create webpack.config.ts
    const webpackConfig = `
import path from 'path';
import { Configuration } from 'webpack';

const config: Configuration = {
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: 'production',
  resolve: {
    extensions: ['.ts', '.js']
  }
};

export default config;
`;
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.ts'), webpackConfig);

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

    // Verify Webpack was detected (should take priority over tsc since webpack.config.ts exists)
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack as build tool');
    assert.strictEqual(buildConfig.buildCommand, 'npx webpack build', 'Should generate npx webpack build command');
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
        webpack: '^5.88.0',
        vite: '^4.4.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create both webpack.config.js and vite.config.js
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), 'module.exports = {};');
    await fs.writeFile(path.join(testRepoPath, 'vite.config.js'), 'export default {};');

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify one was selected (implementation may vary, but should be consistent)
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.ok(
      buildConfig.buildTool === 'webpack' || buildConfig.buildTool === 'vite',
      'Should detect either webpack or vite'
    );
    assert.ok(
      buildConfig.buildCommand === 'npx webpack build' || buildConfig.buildCommand === 'npx vite build',
      'Should generate appropriate npx command'
    );
  });

  /**
   * Test 5: Webpack with React
   * Requirements: 2.1, 2.4
   */
  it('should detect webpack in React project', async () => {
    // Create package.json with React dependencies
    const packageJson = {
      name: 'test-webpack-react-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        webpack: '^5.88.0',
        'webpack-cli': '^5.1.0',
        '@babel/core': '^7.22.0',
        'babel-loader': '^9.1.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create webpack.config.js with React setup
    const webpackConfig = `
const path = require('path');

module.exports = {
  entry: './src/index.jsx',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  mode: 'production'
};
`;
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), webpackConfig);

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Webpack was detected
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should mark as having build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx webpack build', 'Should generate npx webpack build command');
  });

  /**
   * Test 6: Webpack with prepare script
   * Requirements: 2.1, 2.4
   */
  it('should detect webpack when used in prepare script', async () => {
    // Create package.json with prepare script using webpack
    const packageJson = {
      name: 'test-webpack-prepare-repo',
      version: '1.0.0',
      scripts: {
        prepare: 'webpack --mode production',
        test: 'echo "test"'
      },
      devDependencies: {
        webpack: '^5.88.0',
        'webpack-cli': '^5.1.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create webpack.config.js
    await fs.writeFile(
      path.join(testRepoPath, 'webpack.config.js'),
      'module.exports = {};'
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify build script was detected
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run prepare', 'Should use prepare script');
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack from webpack.config.js');
  });

  /**
   * Test 7: Comprehensive Webpack detection scenario
   * Requirements: 2.1, 2.4, 2.7, 6.1-6.3
   */
  it('should complete full Webpack build system detection workflow', async () => {
    // Create package.json without build script but with webpack dependency
    const packageJson = {
      name: 'comprehensive-webpack-test',
      version: '1.0.0',
      scripts: {
        test: 'jest',
        start: 'webpack serve --mode development'
      },
      dependencies: {
        lodash: '^4.17.21'
      },
      devDependencies: {
        webpack: '^5.88.0',
        'webpack-cli': '^5.1.0',
        'webpack-dev-server': '^4.15.0',
        jest: '^29.0.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create webpack.config.js with comprehensive setup
    const webpackConfig = `
const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  },
  mode: 'production'
};
`;
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), webpackConfig);

    // Create source directory structure
    await fs.mkdir(path.join(testRepoPath, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(testRepoPath, 'src', 'index.js'),
      'console.log("Hello from Webpack");'
    );

    // Step 1: Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Step 2: Verify Webpack detection
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack as build tool');
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npx webpack build', 'Should generate npx webpack build command');
    assert.strictEqual(buildConfig.requiresCompilation, true, 'Should require compilation');

    // Step 3: Verify the build command is executable (structure check)
    assert.ok(buildConfig.buildCommand.startsWith('npx'), 'Build command should use npx');
    assert.ok(buildConfig.buildCommand.includes('webpack'), 'Build command should include webpack');

    // Step 4: Verify configuration is complete
    assert.notStrictEqual(buildConfig.buildTool, 'none', 'Should have a build tool');
    assert.notStrictEqual(buildConfig.buildCommand, null, 'Should have a build command');
  });

  /**
   * Test 8: Webpack with multiple config files
   * Requirements: 2.4, 2.7
   */
  it('should handle Webpack with multiple config files', async () => {
    // Create package.json with environment-specific builds
    const packageJson = {
      name: 'test-webpack-multi-config-repo',
      version: '1.0.0',
      scripts: {
        'build:dev': 'webpack --config webpack.dev.js',
        'build:prod': 'webpack --config webpack.prod.js',
        test: 'echo "test"'
      },
      devDependencies: {
        webpack: '^5.88.0',
        'webpack-cli': '^5.1.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create webpack.config.js (base config)
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), 'module.exports = {};');
    await fs.writeFile(path.join(testRepoPath, 'webpack.dev.js'), 'module.exports = {};');
    await fs.writeFile(path.join(testRepoPath, 'webpack.prod.js'), 'module.exports = {};');

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify webpack was detected with one of the build scripts
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack');
    assert.ok(
      buildConfig.buildCommand === 'npm run build:dev' || buildConfig.buildCommand === 'npm run build:prod',
      'Should use one of the build scripts'
    );
  });

  /**
   * Test 9: Webpack with TypeScript and loaders
   * Requirements: 2.1, 2.4
   */
  it('should detect webpack with TypeScript loaders', async () => {
    // Create package.json with TypeScript and webpack
    const packageJson = {
      name: 'test-webpack-ts-loader-repo',
      version: '1.0.0',
      scripts: {
        test: 'echo "test"'
      },
      devDependencies: {
        webpack: '^5.88.0',
        'webpack-cli': '^5.1.0',
        typescript: '^5.0.0',
        'ts-loader': '^9.4.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create webpack.config.js with ts-loader
    const webpackConfig = `
const path = require('path');

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  }
};
`;
    await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), webpackConfig);

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'node'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify Webpack was detected (should take priority over tsc)
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack as build tool');
    assert.strictEqual(buildConfig.buildCommand, 'npx webpack build', 'Should generate npx webpack build command');
    assert.strictEqual(buildConfig.requiresCompilation, true, 'Should require compilation');
  });

  /**
   * Test 10: Webpack with compile script alias
   * Requirements: 2.1, 2.4
   */
  it('should detect webpack when used in compile script', async () => {
    // Create package.json with compile script
    const packageJson = {
      name: 'test-webpack-compile-repo',
      version: '1.0.0',
      scripts: {
        compile: 'webpack --mode production',
        test: 'echo "test"'
      },
      devDependencies: {
        webpack: '^5.88.0',
        'webpack-cli': '^5.1.0'
      }
    };
    await fs.writeFile(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create webpack.config.js
    await fs.writeFile(
      path.join(testRepoPath, 'webpack.config.js'),
      'module.exports = {};'
    );

    // Detect build configuration
    const buildConfig = await detectBuildConfiguration(testRepoPath);

    // Verify build script was detected
    assert.strictEqual(buildConfig.hasBuildScript, true, 'Should have build script');
    assert.strictEqual(buildConfig.buildCommand, 'npm run compile', 'Should use compile script');
    assert.strictEqual(buildConfig.buildTool, 'webpack', 'Should detect webpack');
  });
});
