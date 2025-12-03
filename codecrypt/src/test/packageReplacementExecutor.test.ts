import * as assert from 'assert';
import { PackageReplacementExecutor, PackageReplacement } from '../services/packageReplacementExecutor';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as sinon from 'sinon';

suite('PackageReplacementExecutor Unit Tests', () => {
  let executor: PackageReplacementExecutor;
  let readFileStub: sinon.SinonStub;
  let writeFileStub: sinon.SinonStub;

  const projectPath = '/fake/project';
  const packageJsonPath = path.join(projectPath, 'package.json');

  setup(() => {
    executor = new PackageReplacementExecutor(projectPath);
    readFileStub = sinon.stub(executor as any, '_readFile');
    writeFileStub = sinon.stub(executor as any, '_writeFile');
  });

  teardown(() => {
    sinon.restore();
  });

  test('should replace package name in dependencies', async () => {
    const initialPackageJson = {
      dependencies: {
        'old-pkg': '1.0.0',
        'other-pkg': '2.0.0',
      },
    };
    readFileStub.withArgs(packageJsonPath).resolves(JSON.stringify(initialPackageJson, null, 2));

    const replacements: PackageReplacement[] = [
      {
        oldName: 'old-pkg',
        newName: 'new-pkg',
        versionMapping: { '1.0.0': '2.0.0' },
        requiresCodeChanges: false,
      },
    ];

    const results = await executor.executeReplacement(replacements);

    const expectedPackageJson = {
      dependencies: {
        'new-pkg': '2.0.0',
        'other-pkg': '2.0.0',
      },
    };
    assert.deepStrictEqual(JSON.parse(writeFileStub.getCall(0).args[1]), expectedPackageJson);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].packageName, 'new-pkg');
    assert.strictEqual(results[0].oldVersion, '1.0.0');
    assert.strictEqual(results[0].newVersion, '2.0.0');
  });

  test('should replace package name in devDependencies', async () => {
    const initialPackageJson = {
      devDependencies: {
        'old-dev-pkg': '1.0.0',
        'other-dev-pkg': '2.0.0',
      },
    };
    readFileStub.withArgs(packageJsonPath).resolves(JSON.stringify(initialPackageJson, null, 2));

    const replacements: PackageReplacement[] = [
      {
        oldName: 'old-dev-pkg',
        newName: 'new-dev-pkg',
        versionMapping: { '1.0.0': '2.0.0' },
        requiresCodeChanges: false,
      },
    ];

    const results = await executor.executeReplacement(replacements);

    const expectedPackageJson = {
      devDependencies: {
        'new-dev-pkg': '2.0.0',
        'other-dev-pkg': '2.0.0',
      },
    };
    assert.deepStrictEqual(JSON.parse(writeFileStub.getCall(0).args[1]), expectedPackageJson);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].packageName, 'new-dev-pkg');
    assert.strictEqual(results[0].oldVersion, '1.0.0');
    assert.strictEqual(results[0].newVersion, '2.0.0');
  });

  test('should apply version mapping', async () => {
    const initialPackageJson = {
      dependencies: {
        'some-pkg': '1.0.0',
      },
    };
    readFileStub.withArgs(packageJsonPath).resolves(JSON.stringify(initialPackageJson, null, 2));

    const replacements: PackageReplacement[] = [
      {
        oldName: 'some-pkg',
        newName: 'some-pkg',
        versionMapping: { '1.0.0': '3.0.0', '*': 'latest' },
        requiresCodeChanges: false,
      },
    ];

    const results = await executor.executeReplacement(replacements);

    const expectedPackageJson = {
      dependencies: {
        'some-pkg': '3.0.0',
      },
    };
    assert.deepStrictEqual(JSON.parse(writeFileStub.getCall(0).args[1]), expectedPackageJson);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].newVersion, '3.0.0');
  });

  test('should use wildcard version mapping if specific version not found', async () => {
    const initialPackageJson = {
      dependencies: {
        'some-pkg': '1.2.3',
      },
    };
    readFileStub.withArgs(packageJsonPath).resolves(JSON.stringify(initialPackageJson, null, 2));

    const replacements: PackageReplacement[] = [
      {
        oldName: 'some-pkg',
        newName: 'some-pkg',
        versionMapping: { '*': '4.0.0' },
        requiresCodeChanges: false,
      },
    ];

    const results = await executor.executeReplacement(replacements);

    const expectedPackageJson = {
      dependencies: {
        'some-pkg': '4.0.0',
      },
    };
    assert.deepStrictEqual(JSON.parse(writeFileStub.getCall(0).args[1]), expectedPackageJson);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].newVersion, '4.0.0');
  });

  test('should flag requiresManualReview in results', async () => {
    const initialPackageJson = {
      dependencies: {
        'old-pkg': '1.0.0',
      },
    };
    readFileStub.withArgs(packageJsonPath).resolves(JSON.stringify(initialPackageJson, null, 2));

    const replacements: PackageReplacement[] = [
      {
        oldName: 'old-pkg',
        newName: 'new-pkg',
        versionMapping: { '1.0.0': '2.0.0' },
        requiresCodeChanges: true,
      },
    ];

    const results = await executor.executeReplacement(replacements);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].requiresManualReview, true);
  });

  test('should handle package not found in package.json', async () => {
    const initialPackageJson = {
      dependencies: {
        'other-pkg': '2.0.0',
      },
    };
    readFileStub.withArgs(packageJsonPath).resolves(JSON.stringify(initialPackageJson, null, 2));

    const replacements: PackageReplacement[] = [
      {
        oldName: 'non-existent-pkg',
        newName: 'new-pkg',
        versionMapping: { '*': '1.0.0' },
        requiresCodeChanges: false,
      },
    ];

    const results = await executor.executeReplacement(replacements);
    assert.strictEqual(results.length, 0, 'Should not return results for non-existent package');
    // Verify package.json content remains unchanged
    assert.deepStrictEqual(JSON.parse(writeFileStub.getCall(0).args[1]), initialPackageJson);
  });

  test('should handle empty replacements array', async () => {
    const initialPackageJson = {
      dependencies: {
        'some-pkg': '1.0.0',
      },
    };
    readFileStub.withArgs(packageJsonPath).resolves(JSON.stringify(initialPackageJson, null, 2));

    const replacements: PackageReplacement[] = [];

    const results = await executor.executeReplacement(replacements);
    assert.strictEqual(results.length, 0, 'Should return empty results for empty replacements array');
    // Verify package.json content remains unchanged
    assert.deepStrictEqual(JSON.parse(writeFileStub.getCall(0).args[1]), initialPackageJson);
  });
});
