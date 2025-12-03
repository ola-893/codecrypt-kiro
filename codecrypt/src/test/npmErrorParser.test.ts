
import * as assert from 'assert';
import { parseNpmError, NpmErrorType } from '../utils/errors';

suite('npm Error Parser Unit Tests', () => {
  test('should parse peer dependency error and extract conflicting package', () => {
    const stderr = `npm ERR! code EPEERINVALID
npm ERR! peer dep missing: react@^17.0.0, required by react-dom@17.0.0
npm ERR! A complete log of this run can be found in:
`;
    const error = parseNpmError(stderr);
    assert.strictEqual(error.errorType, NpmErrorType.PeerDependencyConflict);
    assert.strictEqual(error.conflictingPackage, 'react');
  });

  test('should parse peer dependency error with scoped package', () => {
    const stderr = `npm ERR! code EPEERINVALID
npm ERR! peer dep missing: @angular/core@^12.0.0, required by @angular/common@12.0.0
`;
    const error = parseNpmError(stderr);
    assert.strictEqual(error.errorType, NpmErrorType.PeerDependencyConflict);
    assert.strictEqual(error.conflictingPackage, '@angular/core');
  });

  test('should detect network error', () => {
    const stderr = `npm ERR! code ENOTFOUND
npm ERR! network request to https://registry.npmjs.org/non-existent-package failed
npm ERR! A complete log of this run can be found in:
`;
    const error = parseNpmError(stderr);
    assert.strictEqual(error.errorType, NpmErrorType.NetworkError);
  });

  test('should detect build failure error', () => {
    const stderr = `npm ERR! code ELIFECYCLE
npm ERR! test-project@1.0.0 build: \`webpack\`
npm ERR! build error
npm ERR! Exit status 1
npm ERR! Failed at the test-project@1.0.0 build script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.
npm ERR! A complete log of this run can be found in:
`;
    const error = parseNpmError(stderr);
    assert.strictEqual(error.errorType, NpmErrorType.BuildFailure);
  });

  test('should categorize unknown errors', () => {
    const stderr = `npm ERR! A really strange error happened
npm ERR! Stack: Error: Something went wrong
`;
    const error = parseNpmError(stderr);
    assert.strictEqual(error.errorType, NpmErrorType.Unknown);
  });

  test('should handle empty stderr', () => {
    const stderr = '';
    const error = parseNpmError(stderr);
    assert.strictEqual(error.errorType, NpmErrorType.Unknown);
  });
});
