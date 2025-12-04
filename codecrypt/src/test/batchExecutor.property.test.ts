

import * as fc from 'fast-check';
import { NpmBatchExecutor } from '../services/batchExecutor';
import { UpdateBatch } from '../services/batchPlanner';
import { ResurrectionPlanItem } from '../services/resurrectionPlanning';
import * as sinon from 'sinon';
import * as assert from 'assert';
import * as path from 'path';

suite('BatchExecutor Property-Based Tests', () => {
  let executor: NpmBatchExecutor;
  let runCommandStub: sinon.SinonStub;
  let readFileStub: sinon.SinonStub;
  let writeFileStub: sinon.SinonStub;

  const projectPath = '/fake/project';
  const packageJsonPath = path.join(projectPath, 'package.json');
  const initialPackageJsonContent = JSON.stringify({ dependencies: {}, devDependencies: {} }, null, 2);

  setup(() => {
    executor = new NpmBatchExecutor();
    // Stub internal methods of NpmBatchExecutor
    runCommandStub = sinon.stub(executor as any, 'runCommand');
    readFileStub = sinon.stub(executor as any, '_readFile');
    writeFileStub = sinon.stub(executor as any, '_writeFile');

    // Default stub for _readFile to return a valid package.json
    readFileStub.withArgs(packageJsonPath).resolves(initialPackageJsonContent);

    // Stub git checkout command within runCommand
    runCommandStub.withArgs('git', ['checkout', 'HEAD', '--', packageJsonPath])
      .resolves({ stdout: '', stderr: '', code: 0 });
  });

  teardown(() => {
    sinon.restore();
  });

  // Generate valid npm package names
  const packageNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{1,20}$/)
    .filter((s: string) => s.length >= 2 && !s.endsWith('-') && !s.includes('--'));

  // Generate valid semantic versions
  const versionArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 10 }),
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 50 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  // Property 4: Batch modification atomicity
  test('Property 4: Batch modification atomicity', () => {
    fc.assert(
      fc.asyncProperty(fc.record({
        batch: fc.record({
            id: fc.stringMatching(/^batch-[a-z0-9]+$/).filter(s => s.length > 7),
            packages: fc.array(fc.record({
                packageName: packageNameArbitrary,
                currentVersion: versionArbitrary,
                targetVersion: versionArbitrary,
                priority: fc.integer({ min: 0, max: 100 }),
                reason: fc.string(),
                fixesVulnerabilities: fc.boolean(),
                vulnerabilityCount: fc.integer({ min: 0, max: 10 }),
            }) as fc.Arbitrary<ResurrectionPlanItem>, { minLength: 0, maxLength: 3 }),
            priority: fc.integer({ min: 0, max: 100 }),
            estimatedRisk: fc.constantFrom('low', 'medium', 'high'),
        }) as fc.Arbitrary<UpdateBatch>,
        installShouldFail: fc.boolean(),
      }), async ({ batch, installShouldFail }) => {
        // Filter out duplicate package names
        const uniquePackages = new Map<string, ResurrectionPlanItem>();
        for (const pkg of batch.packages) {
          uniquePackages.set(pkg.packageName, pkg);
        }
        batch.packages = Array.from(uniquePackages.values());
        // Reset stubs for each test to ensure a clean state
        readFileStub.resetHistory();
        writeFileStub.resetHistory();
        runCommandStub.resetHistory();
        
        readFileStub.withArgs(packageJsonPath).resolves(initialPackageJsonContent);
        runCommandStub.withArgs('git', ['checkout', 'HEAD', '--', packageJsonPath])
          .resolves({ stdout: '', stderr: '', code: 0 });

        if (installShouldFail) {
            runCommandStub.withArgs('npm', ['install']).resolves({ code: 1, stderr: 'error', stdout: '' });
        } else {
            runCommandStub.withArgs('npm', ['install']).resolves({ code: 0, stdout: 'success', stderr: '' });
        }

        const result = await executor.execute(batch, projectPath);

        if (installShouldFail) {
            assert.ok(runCommandStub.calledWith('git', ['checkout', 'HEAD', '--', packageJsonPath]), 'git checkout should be called on failure');
            assert.ok(!result.success, 'Execution should fail');
        } else {
            if (batch.packages.length > 0) {
                assert.ok(writeFileStub.calledOnce, 'writeFile should be called on success for non-empty batch');
            } else {
                assert.ok(!writeFileStub.called, 'writeFile should not be called for empty batch');
            }
            assert.ok(!runCommandStub.calledWith('git', ['checkout', 'HEAD', '--', packageJsonPath]), 'git checkout should not be called on success');
            assert.ok(result.success, 'Execution should succeed');
        }
      })
    );
  });

  // Property 5: Progress event completeness - This is more of an integration test, will be tested in the orchestrator

  // Property 12: Fallback flag warning
  test('Property 12: Fallback flag warning', () => {
    fc.assert(
      fc.asyncProperty(fc.record({
        batch: fc.record({
            id: fc.stringMatching(/^batch-[a-z0-9]+$/).filter(s => s.length > 7),
            packages: fc.array(fc.record({
                packageName: packageNameArbitrary,
                currentVersion: versionArbitrary,
                targetVersion: versionArbitrary,
                priority: fc.integer({ min: 0, max: 100 }),
                reason: fc.string(),
                fixesVulnerabilities: fc.boolean(),
                vulnerabilityCount: fc.integer({ min: 0, max: 10 }),
            }) as fc.Arbitrary<ResurrectionPlanItem>, { minLength: 1, maxLength: 3 }),
            priority: fc.integer({ min: 0, max: 100 }),
            estimatedRisk: fc.constantFrom('low', 'medium', 'high'),
        }) as fc.Arbitrary<UpdateBatch>,
      }), async ({ batch }) => {
        // Filter out duplicate package names
        const uniquePackages = new Map<string, ResurrectionPlanItem>();
        for (const pkg of batch.packages) {
          uniquePackages.set(pkg.packageName, pkg);
        }
        batch.packages = Array.from(uniquePackages.values());
        
        // Skip if no packages after deduplication
        if (batch.packages.length === 0) {
          return true;
        }
        // Reset stubs for each test to ensure a clean state
        readFileStub.resetHistory();
        writeFileStub.resetHistory();
        runCommandStub.resetHistory();
        
        readFileStub.withArgs(packageJsonPath).resolves(initialPackageJsonContent);
        runCommandStub.withArgs('git', ['checkout', 'HEAD', '--', packageJsonPath])
          .resolves({ stdout: '', stderr: '', code: 0 });

        runCommandStub.withArgs('npm', ['install']).resolves({ code: 1, stderr: 'error', stdout: '' });
        runCommandStub.withArgs('npm', ['install', '--legacy-peer-deps']).resolves({ code: 0, stdout: 'success', stderr: '' });
        runCommandStub.withArgs('npm', ['install', '--force']).resolves({ code: 1, stderr: 'error', stdout: '' });

        const result = await executor.executeWithFallback(batch, projectPath);
        
        assert.ok(result.success, 'executeWithFallback should eventually succeed');
        assert.deepStrictEqual(result.installFlagsUsed, ['--legacy-peer-deps'], 'Should use --legacy-peer-deps');
      })
    );
  });

  // New test for individual fallback on batch failure
  test('should attempt individual installation on batch failure', () => {
    fc.assert(
      fc.asyncProperty(fc.record({
        batch: fc.record({
            id: fc.stringMatching(/^batch-[a-z0-9]+$/).filter(s => s.length > 7),
            packages: fc.array(fc.record({
                packageName: packageNameArbitrary,
                currentVersion: versionArbitrary,
                targetVersion: versionArbitrary,
                priority: fc.integer({ min: 0, max: 100 }),
                reason: fc.string(),
                fixesVulnerabilities: fc.boolean(),
                vulnerabilityCount: fc.integer({ min: 0, max: 10 }),
            }) as fc.Arbitrary<ResurrectionPlanItem>, { minLength: 2, maxLength: 2 }), // Ensure at least two packages for individual fallback
            priority: fc.integer({ min: 0, max: 100 }),
            estimatedRisk: fc.constantFrom('low', 'medium', 'high'),
        }) as fc.Arbitrary<UpdateBatch>,
      }), async ({ batch }) => {
        readFileStub.resetHistory();
        writeFileStub.resetHistory();
        runCommandStub.resetHistory();
        
        readFileStub.withArgs(packageJsonPath).resolves(initialPackageJsonContent);
        runCommandStub.withArgs('git', ['checkout', 'HEAD', '--', packageJsonPath])
          .resolves({ stdout: '', stderr: '', code: 0 });

        // Simulate initial batch install failing all attempts
        runCommandStub.withArgs('npm', ['install']).resolves({ code: 1, stderr: 'error' });
        runCommandStub.withArgs('npm', ['install', '--legacy-peer-deps']).resolves({ code: 1, stderr: 'error' });
        runCommandStub.withArgs('npm', ['install', '--force']).resolves({ code: 1, stderr: 'error' });

        // Simulate individual package installs: first succeeds, second fails
        const packageJsonWithFirstPackage = JSON.stringify({ dependencies: { [batch.packages[0].packageName]: batch.packages[0].targetVersion } }, null, 2);
        const packageJsonWithSecondPackage = JSON.stringify({ dependencies: { [batch.packages[1].packageName]: batch.packages[1].targetVersion } }, null, 2);

        writeFileStub.withArgs(packageJsonPath, packageJsonWithFirstPackage).resolves();
        runCommandStub.withArgs('npm', ['install'])
                      .onFirstCall().resolves({ code: 0, stdout: 'success' });

        writeFileStub.withArgs(packageJsonPath, packageJsonWithSecondPackage).resolves();
        runCommandStub.withArgs('npm', ['install'])
                      .onSecondCall().resolves({ code: 1, stderr: 'error' });
        
        // Mock the final batch install of successful packages
        const finalSuccessfulPackageJson = { dependencies: { [batch.packages[0].packageName]: batch.packages[0].targetVersion } };
        writeFileStub.withArgs(packageJsonPath, JSON.stringify(finalSuccessfulPackageJson, null, 2))
          .resolves(undefined);
        runCommandStub.withArgs('npm', ['install'])
                      .onThirdCall().resolves({ code: 0, stdout: 'final batch success' });


        const result = await executor.executeWithFallback(batch, projectPath);

        assert.ok(!result.success, 'Overall fallback should be considered failed if any package fails individually');
        assert.ok(result.log.includes(`FAILURE: ${batch.packages[1].packageName}`), 'Log should indicate failure of second package');
        assert.ok(readFileStub.calledWith(packageJsonPath), 'readFileStub should have been called');
        assert.ok(writeFileStub.calledWith(packageJsonPath, initialPackageJsonContent), 'writeFileStub should restore original content');
      })
    );
  });
});
