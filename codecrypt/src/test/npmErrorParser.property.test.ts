import * as fc from 'fast-check';
import * as assert from 'assert';
import { parseNpmError, NpmErrorType } from '../utils/errors';

suite('npm Error Parser Property Tests', () => {
  // Property 11: Peer conflict error parsing
  test('Property 11: Peer conflict error parsing', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9-]+$/).filter((s: string) => s.length > 0 && !s.startsWith('.') && !s.startsWith('_')),
        (packageName) => {
          const stderr = `npm ERR! code EPEERINVALID
npm ERR! peer dep missing: ${packageName}@^1.0.0, required by some-other-pkg@1.2.3
`;
          const error = parseNpmError(stderr);
          assert.strictEqual(error.errorType, NpmErrorType.PeerDependencyConflict);
          assert.strictEqual(error.conflictingPackage, packageName);
        }
      )
    );
  });

  // Property 10: Failure categorization completeness
  test('Property 10: Failure categorization completeness', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.tuple(
            fc.constant(NpmErrorType.PeerDependencyConflict),
            fc.stringMatching(/^[a-z0-9-]+$/).filter((s: string) => s.length > 0 && !s.startsWith('.') && !s.startsWith('_')),
          ).map(([type, pkgName]) => ({ // Peer Dependency Conflict
            type,
            stderr: `npm ERR! code EPEERINVALID\nnpm ERR! peer dep missing: ${pkgName}@^1.0.0, required by some-other-pkg@1.2.3\n`,
            expectedPackage: pkgName
          })),
          fc.constant(NpmErrorType.NetworkError).map(type => ({
            type,
            stderr: 'npm ERR! code ENOTFOUND\nnpm ERR! network',
            expectedPackage: undefined
          })),
          fc.constant(NpmErrorType.BuildFailure).map(type => ({
            type,
            stderr: 'npm ERR! code ELIFECYCLE\nnpm ERR! build error',
            expectedPackage: undefined
          })),
          fc.constant(NpmErrorType.Unknown).map(type => ({
            type,
            stderr: 'npm ERR! Some unexpected error occurred\n',
            expectedPackage: undefined
          })),
        ),
        ({ type, stderr, expectedPackage }) => {
          const error = parseNpmError(stderr);
          assert.strictEqual(error.errorType, type, `Expected error type ${NpmErrorType[type]} but got ${NpmErrorType[error.errorType]} for stderr: ${stderr}`);
          if (type === NpmErrorType.PeerDependencyConflict) {
            assert.strictEqual(error.conflictingPackage, expectedPackage, `Expected conflicting package ${expectedPackage} but got ${error.conflictingPackage} for stderr: ${stderr}`);
          }
        }
      )
    );
  });
});