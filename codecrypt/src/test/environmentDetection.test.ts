/**
 * Tests for environment detection service
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  detectNodeVersion,
  validateNodeVersion,
  getNodeDockerImage,
  getMajorVersion,
  detectBuildConfiguration,
} from '../services/environmentDetection';

suite('Environment Detection Tests', () => {
  let tempDir: string;

  setup(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-env-test-'));
  });

  teardown(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should detect Node.js version from package.json engines', async () => {
    const packageJson = {
      name: 'test-package',
      engines: {
        node: '>=14.15.0',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectNodeVersion(tempDir);

    assert.strictEqual(result.source, 'package.json');
    assert.ok(result.nodeVersion.startsWith('14'));
    assert.ok(result.confidence > 0.8);
  });

  test('should detect Node.js version from .nvmrc', async () => {
    await fs.writeFile(path.join(tempDir, '.nvmrc'), '16.20.0');

    const result = await detectNodeVersion(tempDir);

    assert.strictEqual(result.source, 'nvmrc');
    assert.strictEqual(result.nodeVersion, '16.20.0');
    assert.ok(result.confidence > 0.8);
  });

  test('should detect Node.js version from .nvmrc with v prefix', async () => {
    await fs.writeFile(path.join(tempDir, '.nvmrc'), 'v18.19.0');

    const result = await detectNodeVersion(tempDir);

    assert.strictEqual(result.source, 'nvmrc');
    assert.strictEqual(result.nodeVersion, '18.19.0');
  });

  test('should detect Node.js version from .nvmrc with LTS codename', async () => {
    await fs.writeFile(path.join(tempDir, '.nvmrc'), 'lts/hydrogen');

    const result = await detectNodeVersion(tempDir);

    assert.strictEqual(result.source, 'nvmrc');
    assert.ok(result.nodeVersion.startsWith('18'));
  });

  test('should detect Node.js version from GitHub Actions workflow', async () => {
    const workflow = `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v3
        with:
          node-version: 20.11.0
      - run: npm test
`;

    await fs.mkdir(path.join(tempDir, '.github', 'workflows'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.github', 'workflows', 'ci.yml'), workflow);

    const result = await detectNodeVersion(tempDir);

    assert.strictEqual(result.source, 'git-history');
    assert.strictEqual(result.nodeVersion, '20.11.0');
  });

  test('should use default version when no detection method succeeds', async () => {
    const result = await detectNodeVersion(tempDir);

    assert.strictEqual(result.source, 'default');
    assert.ok(validateNodeVersion(result.nodeVersion));
    assert.ok(result.confidence < 0.5);
  });

  test('should use default version based on last commit date', async () => {
    // Repository from 4 years ago
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 4);

    const result = await detectNodeVersion(tempDir, oldDate);

    assert.strictEqual(result.source, 'default');
    assert.ok(result.nodeVersion.startsWith('14') || result.nodeVersion.startsWith('12'));
  });

  test('should validate Node.js version strings', () => {
    assert.strictEqual(validateNodeVersion('14.15.0'), true);
    assert.strictEqual(validateNodeVersion('16.20.2'), true);
    assert.strictEqual(validateNodeVersion('18.19.0'), true);
    assert.strictEqual(validateNodeVersion('20.11.0'), true);

    assert.strictEqual(validateNodeVersion('14'), false);
    assert.strictEqual(validateNodeVersion('14.15'), false);
    assert.strictEqual(validateNodeVersion('v14.15.0'), false);
    assert.strictEqual(validateNodeVersion('>=14.15.0'), false);
    assert.strictEqual(validateNodeVersion('invalid'), false);
  });

  test('should get Docker image name for Node.js version', () => {
    assert.strictEqual(getNodeDockerImage('14.15.0'), 'node:14.15.0-alpine');
    assert.strictEqual(getNodeDockerImage('16.20.2'), 'node:16.20.2-alpine');
    assert.strictEqual(getNodeDockerImage('18.19.0'), 'node:18.19.0-alpine');
  });

  test('should extract major version from version string', () => {
    assert.strictEqual(getMajorVersion('14.15.0'), 14);
    assert.strictEqual(getMajorVersion('16.20.2'), 16);
    assert.strictEqual(getMajorVersion('18.19.0'), 18);
    assert.strictEqual(getMajorVersion('20.11.0'), 20);
    assert.strictEqual(getMajorVersion('invalid'), 0);
  });

  test('should prioritize package.json over .nvmrc', async () => {
    const packageJson = {
      name: 'test-package',
      engines: {
        node: '>=18.0.0',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    await fs.writeFile(path.join(tempDir, '.nvmrc'), '16.20.0');

    const result = await detectNodeVersion(tempDir);

    // package.json should take precedence
    assert.strictEqual(result.source, 'package.json');
    assert.ok(result.nodeVersion.startsWith('18'));
  });

  test('should handle malformed package.json gracefully', async () => {
    await fs.writeFile(path.join(tempDir, 'package.json'), 'invalid json');

    const result = await detectNodeVersion(tempDir);

    // Should fall back to default
    assert.strictEqual(result.source, 'default');
  });

  test('should handle package.json without engines field', async () => {
    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectNodeVersion(tempDir);

    // Should fall back to other methods or default
    assert.ok(result.source !== 'package.json');
  });

  // Build Configuration Detection Tests
  test('should detect build script from package.json', async () => {
    const packageJson = {
      name: 'test-package',
      scripts: {
        build: 'webpack --mode production',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.hasBuildScript, true);
    assert.strictEqual(result.buildCommand, 'npm run build');
    assert.strictEqual(result.buildTool, 'webpack');
  });

  test('should detect compile script from package.json', async () => {
    const packageJson = {
      name: 'test-package',
      scripts: {
        compile: 'tsc',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.hasBuildScript, true);
    assert.strictEqual(result.buildCommand, 'npm run compile');
    assert.strictEqual(result.buildTool, 'tsc');
  });

  test('should detect prepare script from package.json', async () => {
    const packageJson = {
      name: 'test-package',
      scripts: {
        prepare: 'vite build',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.hasBuildScript, true);
    assert.strictEqual(result.buildCommand, 'npm run prepare');
    assert.strictEqual(result.buildTool, 'vite');
  });

  test('should detect prepublish script from package.json', async () => {
    const packageJson = {
      name: 'test-package',
      scripts: {
        prepublish: 'rollup -c',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.hasBuildScript, true);
    assert.strictEqual(result.buildCommand, 'npm run prepublish');
    assert.strictEqual(result.buildTool, 'rollup');
  });

  test('should detect webpack.config.js', async () => {
    await fs.writeFile(path.join(tempDir, 'webpack.config.js'), 'module.exports = {}');

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.buildTool, 'webpack');
    assert.strictEqual(result.requiresCompilation, true);
  });

  test('should detect vite.config.js', async () => {
    await fs.writeFile(path.join(tempDir, 'vite.config.js'), 'export default {}');

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.buildTool, 'vite');
    assert.strictEqual(result.requiresCompilation, true);
  });

  test('should detect gulpfile.js', async () => {
    await fs.writeFile(path.join(tempDir, 'gulpfile.js'), 'exports.default = () => {}');

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.buildTool, 'gulp');
    assert.strictEqual(result.hasBuildScript, true);
    assert.strictEqual(result.buildCommand, 'npx gulp');
  });

  test('should detect Gruntfile.js', async () => {
    await fs.writeFile(path.join(tempDir, 'Gruntfile.js'), 'module.exports = () => {}');

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.buildTool, 'grunt');
    assert.strictEqual(result.hasBuildScript, true);
    assert.strictEqual(result.buildCommand, 'npx grunt');
  });

  test('should detect tsconfig.json and mark as requiring compilation', async () => {
    await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.buildTool, 'tsc');
    assert.strictEqual(result.requiresCompilation, true);
  });

  test('should detect TypeScript dependency and mark as requiring compilation', async () => {
    const packageJson = {
      name: 'test-package',
      devDependencies: {
        typescript: '^5.0.0',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.requiresCompilation, true);
    assert.strictEqual(result.buildTool, 'tsc');
  });

  test('should return no build configuration when nothing is found', async () => {
    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.hasBuildScript, false);
    assert.strictEqual(result.buildCommand, null);
    assert.strictEqual(result.buildTool, null);
    assert.strictEqual(result.requiresCompilation, false);
  });

  test('should prioritize build script over config files', async () => {
    const packageJson = {
      name: 'test-package',
      scripts: {
        build: 'vite build',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    await fs.writeFile(path.join(tempDir, 'webpack.config.js'), 'module.exports = {}');

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.hasBuildScript, true);
    assert.strictEqual(result.buildCommand, 'npm run build');
    assert.strictEqual(result.buildTool, 'vite'); // From script, not webpack config
  });

  test('should handle malformed package.json gracefully', async () => {
    await fs.writeFile(path.join(tempDir, 'package.json'), 'invalid json');

    const result = await detectBuildConfiguration(tempDir);

    // Should not throw, just return empty config
    assert.strictEqual(result.hasBuildScript, false);
  });

  test('should detect multiple build tools and use first found', async () => {
    await fs.writeFile(path.join(tempDir, 'webpack.config.js'), 'module.exports = {}');
    await fs.writeFile(path.join(tempDir, 'vite.config.js'), 'export default {}');

    const result = await detectBuildConfiguration(tempDir);

    // Should detect webpack first (based on file order)
    assert.strictEqual(result.buildTool, 'webpack');
  });

  test('should detect esbuild from package.json script', async () => {
    const packageJson = {
      name: 'test-package',
      scripts: {
        build: 'esbuild src/index.ts --bundle',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.hasBuildScript, true);
    assert.strictEqual(result.buildTool, 'esbuild');
  });

  test('should detect parcel from package.json script', async () => {
    const packageJson = {
      name: 'test-package',
      scripts: {
        build: 'parcel build src/index.html',
      },
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await detectBuildConfiguration(tempDir);

    assert.strictEqual(result.hasBuildScript, true);
    assert.strictEqual(result.buildTool, 'parcel');
  });
});
