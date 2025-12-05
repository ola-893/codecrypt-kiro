#!/usr/bin/env node

/**
 * Manual test script for no build system detection
 * Tests Requirements 2.6, 6.1-6.5
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function createTestRepo(testDir) {
  logSection('Creating Test Repository');

  const packageJson = {
    name: 'test-no-build-system',
    version: '1.0.0',
    description: 'Test repository without build system',
    main: 'index.js',
    scripts: {
      start: 'node index.js',
    },
    dependencies: {
      express: '^4.18.0',
    },
  };

  await fs.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  log('✓ Created package.json without build scripts', 'green');

  await fs.writeFile(
    path.join(testDir, 'index.js'),
    `console.log('Hello World!');`
  );

  log('✓ Created index.js', 'green');
}

async function testBuildDetection(testDir) {
  logSection('Testing Build System Detection');

  const { detectBuildConfiguration } = require('./out/services/environmentDetection.js');
  const buildConfig = await detectBuildConfiguration(testDir);

  log('Build Configuration:', 'blue');
  console.log(JSON.stringify(buildConfig, null, 2));

  const checks = [
    {
      name: 'hasBuildScript should be false',
      condition: buildConfig.hasBuildScript === false,
      requirement: '2.6',
    },
    {
      name: 'buildCommand should be null',
      condition: buildConfig.buildCommand === null,
      requirement: '2.6',
    },
    {
      name: 'buildTool should be "none"',
      condition: buildConfig.buildTool === 'none',
      requirement: '2.6',
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    if (check.condition) {
      log(`✓ ${check.name} (Req ${check.requirement})`, 'green');
    } else {
      log(`✗ ${check.name} (Req ${check.requirement})`, 'red');
      allPassed = false;
    }
  }

  return allPassed;
}

async function testCompilationRunner(testDir) {
  logSection('Testing Compilation Runner');

  const { CompilationRunner } = require('./out/services/compilationRunner.js');
  const runner = new CompilationRunner();

  const result = await runner.compile(testDir, {
    packageManager: 'npm',
    buildCommand: 'build',
  });

  log('Compilation Result:', 'blue');
  console.log(JSON.stringify(result, null, 2));

  const checks = [
    {
      name: 'success should be true',
      condition: result.success === true,
      requirement: '6.1',
    },
    {
      name: 'compilationStatus should be "not_applicable"',
      condition: result.compilationStatus === 'not_applicable',
      requirement: '6.1',
    },
    {
      name: 'stdout should mention "No build script detected"',
      condition: result.stdout.includes('No build script detected'),
      requirement: '6.3',
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    if (check.condition) {
      log(`✓ ${check.name} (Req ${check.requirement})`, 'green');
    } else {
      log(`✗ ${check.name} (Req ${check.requirement})`, 'red');
      allPassed = false;
    }
  }

  return allPassed;
}

async function main() {
  log('No Build System Detection - Manual Integration Test', 'cyan');
  log('Testing Requirements 2.6, 6.1-6.5\n', 'yellow');

  let testDir;
  let allTestsPassed = true;

  try {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-no-build-test-'));
    log(`Created test directory: ${testDir}\n`, 'blue');

    await createTestRepo(testDir);
    
    const buildDetectionPassed = await testBuildDetection(testDir);
    allTestsPassed = allTestsPassed && buildDetectionPassed;

    const compilationRunnerPassed = await testCompilationRunner(testDir);
    allTestsPassed = allTestsPassed && compilationRunnerPassed;

    logSection('Test Summary');
    if (allTestsPassed) {
      log('✓ All tests passed!', 'green');
    } else {
      log('✗ Some tests failed', 'red');
      process.exit(1);
    }
  } catch (error) {
    log(`\n✗ Test failed with error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    if (testDir) {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
        log(`\nCleaned up test directory: ${testDir}`, 'blue');
      } catch (error) {
        log(`Warning: Could not clean up: ${error.message}`, 'yellow');
      }
    }
  }
}

main();
