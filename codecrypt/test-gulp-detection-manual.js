/**
 * Manual test script for Gulp build system detection
 * Run with: node test-gulp-detection-manual.js
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Import the detectBuildConfiguration function
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
  console.log('=== Testing Gulp Build System Detection ===\n');

  // Test 1: Gulp without build script
  console.log('Test 1: Detect gulpfile.js without build script');
  const testDir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'gulp-test-1-'));
  try {
    await fs.writeFile(
      path.join(testDir1, 'package.json'),
      JSON.stringify({
        name: 'test-gulp',
        version: '1.0.0',
        scripts: { test: 'echo test' },
        devDependencies: { gulp: '^4.0.2' }
      }, null, 2)
    );
    await fs.writeFile(
      path.join(testDir1, 'gulpfile.js'),
      'const gulp = require("gulp"); gulp.task("default", done => done());'
    );

    const config1 = await detectBuildConfiguration(testDir1);
    console.log('Result:', config1);
    console.log('✓ Expected: buildTool=gulp, buildCommand=npx gulp');
    console.log(`✓ Actual: buildTool=${config1.buildTool}, buildCommand=${config1.buildCommand}`);
    console.log(config1.buildTool === 'gulp' && config1.buildCommand === 'npx gulp' ? '✅ PASS' : '❌ FAIL');
  } finally {
    await fs.rm(testDir1, { recursive: true, force: true });
  }

  console.log('\n---\n');

  // Test 2: npm script priority over gulpfile
  console.log('Test 2: npm script priority over gulpfile.js');
  const testDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'gulp-test-2-'));
  try {
    await fs.writeFile(
      path.join(testDir2, 'package.json'),
      JSON.stringify({
        name: 'test-gulp',
        version: '1.0.0',
        scripts: { build: 'webpack --mode production' },
        devDependencies: { gulp: '^4.0.2', webpack: '^5.0.0' }
      }, null, 2)
    );
    await fs.writeFile(path.join(testDir2, 'gulpfile.js'), 'module.exports = {};');

    const config2 = await detectBuildConfiguration(testDir2);
    console.log('Result:', config2);
    console.log('✓ Expected: buildCommand=npm run build (npm script takes priority)');
    console.log(`✓ Actual: buildCommand=${config2.buildCommand}`);
    console.log(config2.buildCommand === 'npm run build' ? '✅ PASS' : '❌ FAIL');
  } finally {
    await fs.rm(testDir2, { recursive: true, force: true });
  }

  console.log('\n---\n');

  // Test 3: No build system
  console.log('Test 3: No build system detected');
  const testDir3 = await fs.mkdtemp(path.join(os.tmpdir(), 'gulp-test-3-'));
  try {
    await fs.writeFile(
      path.join(testDir3, 'package.json'),
      JSON.stringify({
        name: 'test-no-build',
        version: '1.0.0',
        scripts: { test: 'echo test', start: 'node index.js' },
        dependencies: { express: '^4.17.1' }
      }, null, 2)
    );
    await fs.writeFile(path.join(testDir3, 'index.js'), 'console.log("Hello");');

    const config3 = await detectBuildConfiguration(testDir3);
    console.log('Result:', config3);
    console.log('✓ Expected: buildTool=none, requiresCompilation=false');
    console.log(`✓ Actual: buildTool=${config3.buildTool}, requiresCompilation=${config3.requiresCompilation}`);
    console.log(config3.buildTool === 'none' && !config3.requiresCompilation ? '✅ PASS' : '❌ FAIL');
  } finally {
    await fs.rm(testDir3, { recursive: true, force: true });
  }

  console.log('\n=== All Tests Complete ===');
}

runTests().catch(console.error);
