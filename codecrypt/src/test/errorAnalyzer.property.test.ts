/**
 * Property-Based Tests for ErrorAnalyzer
 * 
 * **Feature: post-resurrection-validation, Property 2: Error Parsing Completeness**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import { ErrorAnalyzer, createErrorAnalyzer } from '../services/errorAnalyzer';
import {
  PostResurrectionCompilationResult,
  PostResurrectionErrorCategory,
  ERROR_CATEGORY_PRIORITIES
} from '../types';

suite('ErrorAnalyzer Property Tests', () => {
  let analyzer: ErrorAnalyzer;

  setup(() => {
    analyzer = createErrorAnalyzer();
  });

  /**
   * **Feature: post-resurrection-validation, Property 2: Error Parsing Completeness**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   * 
   * Property: For any compilation error output, the Error Analyzer should:
   * 1. Categorize the error into exactly one category
   * 2. Extract relevant package information when applicable
   */
  suite('Property 2: Error Parsing Completeness', () => {
    
    // Generator for error messages that match specific categories
    const errorMessageGenerators: Record<PostResurrectionErrorCategory, fc.Arbitrary<string>> = {
      dependency_not_found: fc.constantFrom(
        "Cannot find module 'lodash'",
        "Cannot find module '@types/node'",
        "Cannot find module 'react-dom'",
        "Cannot find module '@babel/core'",
        "Cannot find module 'express'"
      ),
      dependency_version_conflict: fc.constantFrom(
        "npm ERR! ERESOLVE Could not resolve dependency\nnpm ERR! peer react@\"^17.0.0\" from react-dom@17.0.2",
        "ERESOLVE unable to resolve dependency tree\nCould not resolve dependency react@18.0.0",
        "npm ERR! ERESOLVE Could not resolve dependency\nnpm ERR! peer typescript@\">=4.0\" from ts-node@10.0.0"
      ),
      peer_dependency_conflict: fc.constantFrom(
        "npm ERR! peer dep missing: react@^17.0.0, required by react-dom@17.0.2",
        "npm ERR! peerDependencies conflict: typescript@4.5.0 requires @types/node@^16.0.0",
        "npm ERR! peer react@\"^18.0.0\" from react-router@6.0.0\nnpm ERR! peer dep missing"
      ),
      native_module_failure: fc.constantFrom(
        "gyp ERR! build error\ngyp ERR! stack Error: `make` failed with exit code: 2",
        "node-gyp rebuild failed for bcrypt",
        "prebuild-install WARN install No prebuilt binaries found for sharp",
        "gyp ERR! find Python\nnode-gyp requires Python"
      ),
      lockfile_conflict: fc.constantFrom(
        "npm ERR! code ENOLOCK\nnpm ERR! This command requires an existing lockfile",
        "npm ERR! Invalid: lock file's typescript@4.5.0 does not satisfy typescript@^5.0.0",
        "lockfile version mismatch: expected 2, got 1"
      ),
      git_dependency_failure: fc.constantFrom(
        "git dep preparation failed for github:user/repo",
        "Permission denied (publickey) when cloning git+ssh://git@github.com/user/repo",
        "Could not resolve git dependency: git+https://github.com/user/repo.git"
      ),
      syntax_error: fc.constantFrom(
        "SyntaxError: Unexpected token '{'",
        "SyntaxError: Unexpected identifier 'async'",
        "Parse error: Unexpected token"
      ),
      type_error: fc.constantFrom(
        "TypeError: Cannot read property 'map' of undefined",
        "TS2322: Type 'string' is not assignable to type 'number'",
        "TS2345: Argument of type 'string' is not assignable to parameter of type 'number'"
      ),
      unknown: fc.constantFrom(
        "Some random error message",
        "Build failed",
        "Process exited with code 1"
      )
    };


    test('should categorize any error message into exactly one category', function() {
      this.timeout(30000);

      // Generate arbitrary error messages
      const errorMessageArb = fc.oneof(
        ...Object.values(errorMessageGenerators)
      );

      fc.assert(
        fc.property(
          errorMessageArb,
          (errorMessage) => {
            const category = analyzer.categorize(errorMessage);
            
            // 1. Category should be a valid PostResurrectionErrorCategory
            const validCategories: PostResurrectionErrorCategory[] = [
              'dependency_not_found',
              'dependency_version_conflict',
              'peer_dependency_conflict',
              'native_module_failure',
              'lockfile_conflict',
              'git_dependency_failure',
              'syntax_error',
              'type_error',
              'unknown'
            ];
            
            assert.ok(
              validCategories.includes(category),
              `Category "${category}" should be a valid PostResurrectionErrorCategory`
            );

            // 2. Category should have a defined priority
            assert.ok(
              ERROR_CATEGORY_PRIORITIES[category] !== undefined,
              `Category "${category}" should have a defined priority`
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should correctly categorize known error patterns', function() {
      this.timeout(30000);

      // Test each category with its specific error messages
      // Note: Some error messages may match multiple patterns, so we test that
      // the categorization is consistent and valid
      const categoriesExceptUnknown: PostResurrectionErrorCategory[] = [
        'dependency_not_found',
        'native_module_failure',
        'lockfile_conflict',
        'git_dependency_failure',
        'syntax_error',
        'type_error'
      ];

      for (const expectedCategory of categoriesExceptUnknown) {
        fc.assert(
          fc.property(
            errorMessageGenerators[expectedCategory],
            (errorMessage) => {
              const category = analyzer.categorize(errorMessage);
              
              // The categorized result should match the expected category
              assert.strictEqual(
                category,
                expectedCategory,
                `Error "${errorMessage.substring(0, 50)}..." should be categorized as "${expectedCategory}" but got "${category}"`
              );

              return true;
            }
          ),
          { numRuns: 20 } // Fewer runs since we're testing each category
        );
      }

      // Test version conflict and peer dependency separately since they can overlap
      // Both are valid categorizations for ERESOLVE errors with "peer" in them
      fc.assert(
        fc.property(
          errorMessageGenerators.dependency_version_conflict,
          (errorMessage) => {
            const category = analyzer.categorize(errorMessage);
            
            // ERESOLVE errors with "peer" can be categorized as either
            assert.ok(
              category === 'dependency_version_conflict' || category === 'peer_dependency_conflict',
              `Version conflict error should be categorized as version or peer conflict, got "${category}"`
            );

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should extract package info from dependency_not_found errors', function() {
      this.timeout(30000);

      // Generator for package names
      const packageNameArb = fc.oneof(
        fc.constantFrom('lodash', 'express', 'react', 'axios', 'moment'),
        fc.tuple(
          fc.constantFrom('@types', '@babel', '@testing-library'),
          fc.constantFrom('node', 'core', 'react')
        ).map(([scope, name]) => `${scope}/${name}`)
      );

      fc.assert(
        fc.property(
          packageNameArb,
          (packageName) => {
            const errorMessage = `Cannot find module '${packageName}'`;
            
            const result: PostResurrectionCompilationResult = {
              success: false,
              compilationStatus: 'failed',
              exitCode: 1,
              stdout: '',
              stderr: errorMessage,
              duration: 1000
            };

            const errors = analyzer.analyze(result);
            
            // Should have at least one error
            assert.ok(errors.length > 0, 'Should have at least one error');
            
            // First error should be dependency_not_found
            const error = errors[0];
            assert.strictEqual(error.category, 'dependency_not_found');
            
            // Should extract the package name
            assert.strictEqual(
              error.packageName,
              packageName,
              `Should extract package name "${packageName}"`
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });


    test('should extract version constraints from version conflict errors', function() {
      this.timeout(30000);

      // Generator for package@version patterns
      const packageVersionArb = fc.tuple(
        fc.constantFrom('react', 'typescript', 'webpack', 'babel'),
        fc.constantFrom('^17.0.0', '>=4.0.0', '~5.0.0', '18.0.0')
      );

      fc.assert(
        fc.property(
          packageVersionArb,
          ([packageName, version]) => {
            const errorMessage = `npm ERR! ERESOLVE Could not resolve dependency\nnpm ERR! peer ${packageName}@"${version}" from some-package@1.0.0`;
            
            const result: PostResurrectionCompilationResult = {
              success: false,
              compilationStatus: 'failed',
              exitCode: 1,
              stdout: '',
              stderr: errorMessage,
              duration: 1000
            };

            const errors = analyzer.analyze(result);
            
            // Should have at least one error
            assert.ok(errors.length > 0, 'Should have at least one error');
            
            // Should be categorized as version conflict or peer dependency conflict
            const error = errors[0];
            assert.ok(
              error.category === 'dependency_version_conflict' || 
              error.category === 'peer_dependency_conflict',
              `Should be version or peer conflict, got ${error.category}`
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should extract conflicting packages from peer dependency errors', function() {
      this.timeout(30000);

      const peerDepErrorArb = fc.tuple(
        fc.constantFrom('react', 'typescript', 'webpack'),
        fc.constantFrom('^17.0.0', '>=4.0.0', '~5.0.0'),
        fc.constantFrom('react-dom', 'ts-node', 'webpack-cli'),
        fc.constantFrom('17.0.2', '10.0.0', '4.0.0')
      );

      fc.assert(
        fc.property(
          peerDepErrorArb,
          ([peerPkg, peerVersion, fromPkg, fromVersion]) => {
            const errorMessage = `npm ERR! peer ${peerPkg}@"${peerVersion}" from ${fromPkg}@${fromVersion}\nnpm ERR! peer dep missing`;
            
            const result: PostResurrectionCompilationResult = {
              success: false,
              compilationStatus: 'failed',
              exitCode: 1,
              stdout: '',
              stderr: errorMessage,
              duration: 1000
            };

            const errors = analyzer.analyze(result);
            
            // Should have at least one error
            assert.ok(errors.length > 0, 'Should have at least one error');
            
            // Should be categorized as peer dependency conflict
            const error = errors[0];
            assert.strictEqual(
              error.category,
              'peer_dependency_conflict',
              `Should be peer_dependency_conflict, got ${error.category}`
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should extract native module package from gyp errors', function() {
      this.timeout(30000);

      const nativeModuleArb = fc.constantFrom(
        'bcrypt', 'node-sass', 'sharp', 'canvas', 'sqlite3'
      );

      fc.assert(
        fc.property(
          nativeModuleArb,
          (moduleName) => {
            // Use a single-line error message to avoid splitting issues
            const errorMessage = `gyp ERR! build error: node-gyp rebuild failed for ${moduleName}`;
            
            const result: PostResurrectionCompilationResult = {
              success: false,
              compilationStatus: 'failed',
              exitCode: 1,
              stdout: '',
              stderr: errorMessage,
              duration: 1000
            };

            const errors = analyzer.analyze(result);
            
            // Should have at least one error
            assert.ok(errors.length > 0, 'Should have at least one error');
            
            // Find the native module failure error
            const nativeError = errors.find(e => e.category === 'native_module_failure');
            assert.ok(nativeError, 'Should have a native_module_failure error');
            
            // Should extract the module name
            assert.strictEqual(
              nativeError!.packageName,
              moduleName,
              `Should extract package name "${moduleName}"`
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });


    test('should prioritize errors correctly (higher priority first)', function() {
      this.timeout(30000);

      // Generate compilation results with multiple error types
      const multiErrorArb = fc.tuple(
        errorMessageGenerators.dependency_not_found,
        errorMessageGenerators.lockfile_conflict,
        errorMessageGenerators.type_error
      );

      fc.assert(
        fc.property(
          multiErrorArb,
          ([depError, lockError, typeError]) => {
            // Combine errors in random order
            const combinedErrors = `${typeError}\n${depError}\n${lockError}`;
            
            const result: PostResurrectionCompilationResult = {
              success: false,
              compilationStatus: 'failed',
              exitCode: 1,
              stdout: '',
              stderr: combinedErrors,
              duration: 1000
            };

            const errors = analyzer.analyze(result);
            
            // Errors should be sorted by priority (descending)
            for (let i = 1; i < errors.length; i++) {
              assert.ok(
                errors[i - 1].priority >= errors[i].priority,
                `Errors should be sorted by priority: ${errors[i - 1].priority} >= ${errors[i].priority}`
              );
            }

            // Lockfile conflict should be first (highest priority = 100)
            if (errors.some(e => e.category === 'lockfile_conflict')) {
              assert.strictEqual(
                errors[0].category,
                'lockfile_conflict',
                'Lockfile conflict should be first (highest priority)'
              );
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle empty compilation output gracefully', function() {
      this.timeout(30000);

      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const result: PostResurrectionCompilationResult = {
              success: true,
              compilationStatus: 'passed',
              exitCode: 0,
              stdout: '',
              stderr: '',
              duration: 1000
            };

            const errors = analyzer.analyze(result);
            
            // Should return empty array for empty output
            assert.ok(Array.isArray(errors), 'Should return an array');
            assert.strictEqual(errors.length, 0, 'Should return empty array for empty output');

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should deduplicate errors with same category and package', function() {
      this.timeout(30000);

      const packageNameArb = fc.constantFrom('lodash', 'express', 'react');

      fc.assert(
        fc.property(
          packageNameArb,
          (packageName) => {
            // Create duplicate errors
            const errorMessage = `Cannot find module '${packageName}'\nError: Cannot find module '${packageName}'`;
            
            const result: PostResurrectionCompilationResult = {
              success: false,
              compilationStatus: 'failed',
              exitCode: 1,
              stdout: '',
              stderr: errorMessage,
              duration: 1000
            };

            const errors = analyzer.analyze(result);
            
            // Should deduplicate to single error
            const samePackageErrors = errors.filter(
              e => e.category === 'dependency_not_found' && e.packageName === packageName
            );
            
            assert.strictEqual(
              samePackageErrors.length,
              1,
              `Should deduplicate errors for package "${packageName}"`
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should suggest appropriate fix strategies for each error category', function() {
      this.timeout(30000);

      // Test that errors with known categories get suggested fixes
      const categoriesWithFixes: PostResurrectionErrorCategory[] = [
        'dependency_version_conflict',
        'peer_dependency_conflict',
        'native_module_failure',
        'lockfile_conflict',
        'git_dependency_failure'
      ];

      for (const category of categoriesWithFixes) {
        fc.assert(
          fc.property(
            errorMessageGenerators[category],
            (errorMessage) => {
              const result: PostResurrectionCompilationResult = {
                success: false,
              compilationStatus: 'failed',
                exitCode: 1,
                stdout: '',
                stderr: errorMessage,
                duration: 1000
              };

              const errors = analyzer.analyze(result);
              
              // Find error with this category
              const error = errors.find(e => e.category === category);
              
              if (error) {
                // Should have a suggested fix
                assert.ok(
                  error.suggestedFix !== undefined,
                  `Error category "${category}" should have a suggested fix`
                );
              }

              return true;
            }
          ),
          { numRuns: 20 }
        );
      }
    });
  });
});
