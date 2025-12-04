
import * as fc from 'fast-check';
import * as assert from 'assert';
import { PackageReplacementExecutor, PackageReplacement, PackageReplacementResult } from '../services/packageReplacementExecutor';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as sinon from 'sinon';

suite('PackageReplacementExecutor Property Tests', () => {
  let executor: PackageReplacementExecutor;
  let readFileStub: sinon.SinonStub;
  let writeFileStub: sinon.SinonStub;

  const projectPath = '/fake/project';
  const packageJsonPath = path.join(projectPath, 'package.json');

  setup(() => {
    executor = new PackageReplacementExecutor(projectPath);
    // Stub internal _readFile and _writeFile methods
    readFileStub = sinon.stub(executor as any, '_readFile');
    writeFileStub = sinon.stub(executor as any, '_writeFile');
  });

  teardown(() => {
    sinon.restore();
  });

  const packageJsonArbitrary = fc.record({
    dependencies: fc.dictionary(
      fc.stringMatching(/^[a-z00-9-]+$/).filter((s: string) => s.length > 0 && !s.startsWith('.') && !s.startsWith('_')),
      fc.stringMatching(/^[0-9.]+$/).filter((s: string) => s.length > 0),
      { minKeys: 0, maxKeys: 5 }
    ),
    devDependencies: fc.dictionary(
      fc.stringMatching(/^[a-z0-9-]+$/).filter((s: string) => s.length > 0 && !s.startsWith('.') && !s.startsWith('_')),
      fc.stringMatching(/^[0-9.]+$/).filter((s: string) => s.length > 0),
      { minKeys: 0, maxKeys: 5 }
    ),
  });

  const replacementArbitrary = fc.record({
    oldName: fc.stringMatching(/^[a-z0-9-]+$/).filter((s: string) => s.length > 0 && !s.startsWith('.') && !s.startsWith('_')),
    newName: fc.stringMatching(/^[a-z0-9-]+$/).filter((s: string) => s.length > 0 && !s.startsWith('.') && !s.startsWith('_')),
    versionMapping: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 5 }).filter((s: string) => s.length > 0),
      fc.string({ minLength: 1, maxLength: 5 }).filter((s: string) => s.length > 0),
      { minKeys: 1, maxKeys: 3 }
    ),
    requiresCodeChanges: fc.boolean(),
  });

  // Property 6: Package replacement correctness
  test('Property 6: Package replacement correctness', () => {
    fc.assert(
      fc.asyncProperty(
        packageJsonArbitrary,
        fc.array(replacementArbitrary, { minLength: 1, maxLength: 3 }),
        async (initialPackageJson, replacements) => {
          const initialContent = JSON.stringify(initialPackageJson, null, 2);
          readFileStub.withArgs(packageJsonPath, 'utf-8').resolves(initialContent);

          const results = await executor.executeReplacement(replacements);

          // Verify that writeFile was called
          assert.ok(writeFileStub.calledOnce, 'writeFile should be called exactly once');

          const writtenContent = writeFileStub.getCall(0).args[1];
          const modifiedPackageJson = JSON.parse(writtenContent);

          for (const replacement of replacements) {
            // Check if old package is removed and new package is added with correct version
            const oldInDeps = initialPackageJson.dependencies?.[replacement.oldName];
            const oldInDevDeps = initialPackageJson.devDependencies?.[replacement.oldName];

            if (oldInDeps) {
              assert.strictEqual(modifiedPackageJson.dependencies?.[replacement.oldName], undefined, `Old package ${replacement.oldName} should be removed from dependencies`);
              assert.ok(modifiedPackageJson.dependencies?.[replacement.newName], `New package ${replacement.newName} should be added to dependencies`);
              const expectedVersion = replacement.versionMapping[oldInDeps] || replacement.versionMapping['*'] || oldInDeps;
              assert.strictEqual(modifiedPackageJson.dependencies?.[replacement.newName], expectedVersion, `Version for ${replacement.newName} in dependencies should be correct`);
            }
            if (oldInDevDeps) {
              assert.strictEqual(modifiedPackageJson.devDependencies?.[replacement.oldName], undefined, `Old package ${replacement.oldName} should be removed from devDependencies`);
              assert.ok(modifiedPackageJson.devDependencies?.[replacement.newName], `New package ${replacement.newName} should be added to devDependencies`);
              const expectedVersion = replacement.versionMapping[oldInDevDeps] || replacement.versionMapping['*'] || oldInDevDeps;
              assert.strictEqual(modifiedPackageJson.devDependencies?.[replacement.newName], expectedVersion, `Version for ${replacement.newName} in devDependencies should be correct`);
            }

            // Verify results array
            const expectedResults = results.filter(r => r.packageName === replacement.newName);
            if (oldInDeps || oldInDevDeps) {
              assert.strictEqual(expectedResults.length, 1, `Should have one result for ${replacement.newName}`);
              assert.strictEqual(expectedResults[0].requiresManualReview, replacement.requiresCodeChanges, `requiresManualReview for ${replacement.newName} should be correct`);
            } else {
              assert.strictEqual(expectedResults.length, 0, `Should have no results for ${replacement.newName} if not in initial package.json`);
            }
          }
        }
      )
    );
  });

  // Property 7: Replacement logging completeness
  test('Property 7: Replacement logging completeness', () => {
    fc.assert(
      fc.asyncProperty(
        packageJsonArbitrary,
        fc.array(replacementArbitrary, { minLength: 1, maxLength: 3 }),
        async (initialPackageJson, replacements) => {
          const initialContent = JSON.stringify(initialPackageJson, null, 2);
          readFileStub.withArgs(packageJsonPath, 'utf-8').resolves(initialContent);

          const results = await executor.executeReplacement(replacements);

          const expectedResults: PackageReplacementResult[] = [];
          for (const replacement of replacements) {
            const oldInDeps = initialPackageJson.dependencies?.[replacement.oldName];
            const oldInDevDeps = initialPackageJson.devDependencies?.[replacement.oldName];

            if (oldInDeps) {
              const newVersion = replacement.versionMapping[oldInDeps] || replacement.versionMapping['*'] || oldInDeps;
              expectedResults.push({
                packageName: replacement.newName,
                oldVersion: oldInDeps,
                newVersion: newVersion,
                requiresManualReview: replacement.requiresCodeChanges,
              });
            }
            if (oldInDevDeps) {
              const newVersion = replacement.versionMapping[oldInDevDeps] || replacement.versionMapping['*'] || oldInDevDeps;
              expectedResults.push({
                packageName: replacement.newName,
                oldVersion: oldInDevDeps,
                newVersion: newVersion,
                requiresManualReview: replacement.requiresCodeChanges,
              });
            }
          }
          // Sort both arrays for consistent comparison
          results.sort((a, b) => a.packageName.localeCompare(b.packageName));
          expectedResults.sort((a, b) => a.packageName.localeCompare(b.packageName));

          assert.deepStrictEqual(results, expectedResults, 'Results array should match expected replacements');
        }
      )
    );
  });
});
