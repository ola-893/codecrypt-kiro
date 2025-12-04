
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

  // Generate valid npm package names (must start with letter, contain letters/numbers/hyphens, min length 2)
  const packageNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{1,20}$/)
    .filter((s: string) => s.length >= 2 && !s.endsWith('-') && !s.includes('--'));

  // Generate valid semantic versions
  const versionArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 10 }),
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 50 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  const packageJsonArbitrary = fc.record({
    dependencies: fc.dictionary(
      packageNameArbitrary,
      versionArbitrary,
      { minKeys: 0, maxKeys: 5 }
    ),
    devDependencies: fc.dictionary(
      packageNameArbitrary,
      versionArbitrary,
      { minKeys: 0, maxKeys: 5 }
    ),
  });

  const replacementArbitrary = fc.record({
    oldName: packageNameArbitrary,
    newName: packageNameArbitrary,
    versionMapping: fc.dictionary(
      versionArbitrary,
      versionArbitrary,
      { minKeys: 1, maxKeys: 3 }
    ).map(mapping => {
      // Ensure '*' wildcard is always present
      const result: Record<string, string> = { '*': Object.values(mapping)[0] || '1.0.0', ...mapping };
      return result;
    }),
    requiresCodeChanges: fc.boolean(),
  });

  // Property 6: Package replacement correctness
  test('Property 6: Package replacement correctness', () => {
    fc.assert(
      fc.asyncProperty(
        packageJsonArbitrary,
        fc.array(replacementArbitrary, { minLength: 1, maxLength: 3 }),
        async (initialPackageJson, replacements) => {
          // Filter out invalid replacements where oldName === newName
          const validReplacements = replacements.filter(r => r.oldName !== r.newName);
          if (validReplacements.length === 0) {
            // Skip test if no valid replacements
            return true;
          }
          const initialContent = JSON.stringify(initialPackageJson, null, 2);
          readFileStub.withArgs(packageJsonPath, 'utf-8').resolves(initialContent);

          const results = await executor.executeReplacement(validReplacements);

          // Check if any replacements actually apply to the initial package.json
          const hasApplicableReplacements = validReplacements.some(r => 
            initialPackageJson.dependencies?.[r.oldName] || 
            initialPackageJson.devDependencies?.[r.oldName]
          );

          if (!hasApplicableReplacements) {
            // No replacements apply, writeFile should not be called
            assert.ok(!writeFileStub.called, 'writeFile should not be called when no packages to replace');
            return true;
          }

          // Verify that writeFile was called
          assert.ok(writeFileStub.calledOnce, 'writeFile should be called exactly once');

          const writtenContent = writeFileStub.getCall(0).args[1];
          const modifiedPackageJson = JSON.parse(writtenContent);

          for (const replacement of validReplacements) {
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
          // Filter out invalid replacements where oldName === newName
          const validReplacements = replacements.filter(r => r.oldName !== r.newName);
          if (validReplacements.length === 0) {
            // Skip test if no valid replacements
            return true;
          }
          
          const initialContent = JSON.stringify(initialPackageJson, null, 2);
          readFileStub.withArgs(packageJsonPath, 'utf-8').resolves(initialContent);

          const results = await executor.executeReplacement(validReplacements);

          // Check if any replacements actually apply
          const hasApplicableReplacements = validReplacements.some(r => 
            initialPackageJson.dependencies?.[r.oldName] || 
            initialPackageJson.devDependencies?.[r.oldName]
          );

          if (!hasApplicableReplacements) {
            // No replacements apply, results should be empty
            assert.strictEqual(results.length, 0, 'Results should be empty when no packages to replace');
            return true;
          }

          const expectedResults: PackageReplacementResult[] = [];
          for (const replacement of validReplacements) {
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
