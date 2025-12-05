/**
 * Manual test script for Webpack build system detection
 * Run with: node test-webpack-detection-manual.js
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Import the detectBuildConfiguration function (duplicated to avoid vscode dependency)
async function detectBuildConfiguration(repoPath) {
  const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    debug: (...args) => console.log('[DEBUG]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
  };

  let hasBuildScript = false;
  let buildCommand = null;
  let buildTool = null;
  let requiresCompilation = false;

  try {
    // Check package.json for build scripts
    const packageJsonPath = path.join(repoPath, 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      if (packageJson.scripts) {
        const scripts = packageJson.scripts;

        // Check for common build script names
        const buildScriptNames = ['build', 'compile', 'prepare', 'prepublish', 'prepublishOnly'];
        
        for (const scriptName of buildScriptNames) {
          if (scripts[scriptName]) {
            hasBuildScript = true;
            buildCommand = `npm run ${scriptName}`;
            
            // Detect build tool from script content
            const scriptContent = scripts[scriptName];
            if (scriptContent.includes('webpack')) {
              buildTool = 'webpack';
            } else if (scriptContent.includes('vite')) {
              buildTool = 'vite';
            } else if (scriptContent.includes('tsc')) {
              buildTool = 'tsc';
            } else if (scriptContent.includes('rollup')) {
              buildTool = 'rollup';
            } else if (scriptContent.includes('esbuild')) {
              buildTool = 'esbuild';
            } else if (scriptContent.includes('parcel')) {
              buildTool = 'parcel';
            }

            logger.info(`Found build script: ${scriptName} -> ${scriptContent}`);
            break;
          }
        }
      }

      // Check if TypeScript is present (requires compilation)
      if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
        requiresCompilation = true;
        if (!buildTool) {
          buildTool = 'tsc';
        }
        // If TypeScript is present but no build script, infer one
        if (!hasBuildScript) {
          hasBuildScript = true;
          buildCommand = 'npx tsc';
        }
      }
    } catch (error) {
      logger.debug('Could not parse package.json for build scripts', error);
    }

    // Check for task runner configuration files
    const taskRunnerFiles = [
      { file: 'webpack.config.js', tool: 'webpack' },
      { file: 'webpack.config.ts', tool: 'webpack' },
      { file: 'vite.config.js', tool: 'vite' },
      { file: 'vite.config.ts', tool: 'vite' },
      { file: 'rollup.config.js', tool: 'rollup' },
      { file: 'gulpfile.js', tool: 'gulp' },
      { file: 'Gruntfile.js', tool: 'grunt' },
      { file: 'Gruntfile.coffee', tool: 'grunt' },
      { file: 'tsconfig.json', tool: 'tsc' },
    ];

    for (const { file, tool } of taskRunnerFiles) {
      try {
        await fs.access(path.join(repoPath, file));
        logger.info(`Found task runner file: ${file}`);
        
        if (!buildTool) {
          buildTool = tool;
        }
        
        // If we found a config file but no build script, mark as requiring compilation
        if (tool === 'tsc' || tool === 'webpack' || tool === 'vite' || tool === 'rollup') {
          requiresCompilation = true;
        }
        
        // If we have a build tool but no build command, try to infer it
        if (!hasBuildScript && (tool === 'webpack' || tool === 'vite' || tool === 'rollup')) {
          hasBuildScript = true;
          buildCommand = `npx ${tool} build`;
        } else if (!hasBuildScript && tool === 'tsc') {
          hasBuildScript = true;
          buildCommand = 'npx tsc';
        } else if (!hasBuildScript && (tool === 'gulp' || tool === 'grunt')) {
          hasBuildScript = true;
          buildCommand = `npx ${tool}`;
        }
      } catch (error) {
        // File doesn't exist, continue
      }
    }

  } catch (error) {
    logger.error('Error detecting build configuration', error);
  }

  const config = {
    hasBuildScript,
    buildCommand,
    buildTool: buildTool || 'none',
    requiresCompilation,
  };

  logger.info(`Build configuration detected:`, config);

  return config;
}

async function runTests() {
  console.log('=== Testing Webpack Build System Detection ===\n');

  // Test 1: Webpack without build script
  console.log('Test 1: Detect webpack.config.js without build script');
  const testDir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'webpack-test-1-'));
  try {
    await fs.writeFile(
      path.join(testDir1, 'package.json'),
      JSON.stringify({
        name: 'test-webpack',
        version: '1.0.0',
        scripts: { test: 'echo test' },
        devDependencies: { webpack: '^5.88.0', 'webpack-cli': '^5.1.0' }
      }, null, 2)
    );
    await fs.writeFile(
      path.join(testDir1, 'webpack.config.js'),
      'module.exports = { entry: "./src/index.js", output: { filename: "bundle.js" } };'
    );

    const config1 = await detectBuildConfiguration(testDir1);
    console.log('Result:', config1);
    console.log('✓ Expected: buildTool=webpack, buildCommand=npx webpack build');
    console.log(`✓ Actual: buildTool=${config1.buildTool}, buildCommand=${config1.buildCommand}`);
    console.log(config1.buildTool === 'webpack' && config1.buildCommand === 'npx webpack build' ? '✅ PASS' : '❌ FAIL');
  } finally {
    await fs.rm(testDir1, { recursive: true, force: true });
  }

  console.log('\n---\n');

  // Test 2: npm script priority over webpack.config.js
  console.log('Test 2: npm script priority over webpack.config.js');
  const testDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'webpack-test-2-'));
  try {
    await fs.writeFile(
      path.join(testDir2, 'package.json'),
      JSON.stringify({
        name: 'test-webpack',
        version: '1.0.0',
        scripts: { build: 'webpack --mode production' },
        devDependencies: { webpack: '^5.88.0', 'webpack-cli': '^5.1.0' }
      }, null, 2)
    );
    await fs.writeFile(path.join(testDir2, 'webpack.config.js'), 'module.exports = {};');

    const config2 = await detectBuildConfiguration(testDir2);
    console.log('Result:', config2);
    console.log('✓ Expected: buildCommand=npm run build (npm script takes priority)');
    console.log(`✓ Actual: buildCommand=${config2.buildCommand}`);
    console.log(config2.buildCommand === 'npm run build' ? '✅ PASS' : '❌ FAIL');
  } finally {
    await fs.rm(testDir2, { recursive: true, force: true });
  }

  console.log('\n---\n');

  // Test 3: Webpack with React (no TypeScript to avoid conflict)
  console.log('Test 3: Webpack with React');
  const testDir3 = await fs.mkdtemp(path.join(os.tmpdir(), 'webpack-test-3-'));
  try {
    await fs.writeFile(
      path.join(testDir3, 'package.json'),
      JSON.stringify({
        name: 'test-webpack-react',
        version: '1.0.0',
        scripts: { test: 'echo test' },
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
      }, null, 2)
    );
    await fs.writeFile(path.join(testDir3, 'webpack.config.js'), 'module.exports = {};');

    const config3 = await detectBuildConfiguration(testDir3);
    console.log('Result:', config3);
    console.log('✓ Expected: buildTool=webpack, requiresCompilation=true');
    console.log(`✓ Actual: buildTool=${config3.buildTool}, requiresCompilation=${config3.requiresCompilation}`);
    console.log(config3.buildTool === 'webpack' && config3.requiresCompilation ? '✅ PASS' : '❌ FAIL');
  } finally {
    await fs.rm(testDir3, { recursive: true, force: true });
  }

  console.log('\n---\n');

  // Test 4: Webpack with prepare script
  console.log('Test 4: Webpack with prepare script');
  const testDir4 = await fs.mkdtemp(path.join(os.tmpdir(), 'webpack-test-4-'));
  try {
    await fs.writeFile(
      path.join(testDir4, 'package.json'),
      JSON.stringify({
        name: 'test-webpack-prepare',
        version: '1.0.0',
        scripts: { 
          prepare: 'webpack --mode production',
          test: 'echo test'
        },
        devDependencies: { 
          webpack: '^5.88.0', 
          'webpack-cli': '^5.1.0'
        }
      }, null, 2)
    );
    await fs.writeFile(path.join(testDir4, 'webpack.config.js'), 'module.exports = {};');

    const config4 = await detectBuildConfiguration(testDir4);
    console.log('Result:', config4);
    console.log('✓ Expected: buildCommand=npm run prepare, buildTool=webpack');
    console.log(`✓ Actual: buildCommand=${config4.buildCommand}, buildTool=${config4.buildTool}`);
    console.log(config4.buildCommand === 'npm run prepare' && config4.buildTool === 'webpack' ? '✅ PASS' : '❌ FAIL');
  } finally {
    await fs.rm(testDir4, { recursive: true, force: true });
  }

  console.log('\n=== All Tests Complete ===');
}

runTests().catch(console.error);
