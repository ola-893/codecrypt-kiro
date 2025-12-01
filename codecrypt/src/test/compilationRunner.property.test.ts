/**
 * Property-Based Tests for CompilationRunner
 * 
 * **Feature: post-resurrection-validation, Property 6: Compilation Proof Generation**
 * **Validates: Requirements 1.3**
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import { CompilationRunner, createCompilationRunner } from '../services/compilationRunner';
import { PostResurrectionCompilationResult, CompileOptions, PackageManager } from '../types';

suite('CompilationRunner Property Tests', () => {
  let runner: CompilationRunner;

  setup(() => {
    runner = createCompilationRunner();
  });

  /**
   * **Feature: post-resurrection-validation, Property 6: Compilation Proof Generation**
   * **Validates: Requirements 1.3**
   * 
   * Property: For any successful compilation result, a Compilation Proof artifact
   * should be generated containing:
   * - timestamp (Date object)
   * - build command (string)
   * - exit code (should be 0 for success)
   * - duration (positive number)
   * - output hash (64-character SHA-256 hex string)
   * - package manager (npm, yarn, or pnpm)
   * - iterations required (positive integer)
   */
  suite('Property 6: Compilation Proof Generation', () => {
    test('should generate valid proof for any successful compilation result', function() {
      this.timeout(30000);

      // Arbitrary generators for compilation result components
      const stdoutArb = fc.string({ minLength: 0, maxLength: 10000 });
      const stderrArb = fc.string({ minLength: 0, maxLength: 10000 });
      const durationArb = fc.integer({ min: 1, max: 1000000 });
      const packageManagerArb: fc.Arbitrary<PackageManager> = fc.constantFrom('npm', 'yarn', 'pnpm');
      const buildCommandArb = fc.string({ minLength: 1, maxLength: 50 })
        .filter(s => /^[a-zA-Z0-9_:-]+$/.test(s));
      const iterationsArb = fc.integer({ min: 1, max: 100 });

      fc.assert(
        fc.property(
          stdoutArb,
          stderrArb,
          durationArb,
          packageManagerArb,
          buildCommandArb,
          iterationsArb,
          (stdout, stderr, duration, packageManager, buildCommand, iterations) => {
            // Create a successful compilation result
            const result: PostResurrectionCompilationResult = {
              success: true,
              exitCode: 0,
              stdout,
              stderr,
              duration
            };

            const options: CompileOptions = {
              packageManager,
              buildCommand
            };

            // Generate the proof
            const proof = runner.generateCompilationProof(result, options, iterations);

            // Verify all required fields are present and valid
            
            // 1. Timestamp should be a Date object
            assert.ok(proof.timestamp instanceof Date, 'timestamp should be a Date');
            assert.ok(!isNaN(proof.timestamp.getTime()), 'timestamp should be valid');

            // 2. Build command should match input
            assert.strictEqual(proof.buildCommand, buildCommand, 'buildCommand should match');

            // 3. Exit code should be 0 for successful compilation
            assert.strictEqual(proof.exitCode, 0, 'exitCode should be 0');

            // 4. Duration should match input and be positive
            assert.strictEqual(proof.duration, duration, 'duration should match');
            assert.ok(proof.duration > 0, 'duration should be positive');

            // 5. Output hash should be a 64-character hex string (SHA-256)
            assert.strictEqual(proof.outputHash.length, 64, 'outputHash should be 64 chars');
            assert.ok(/^[a-f0-9]{64}$/.test(proof.outputHash), 'outputHash should be valid hex');

            // 6. Package manager should match input
            assert.strictEqual(proof.packageManager, packageManager, 'packageManager should match');

            // 7. Iterations required should match input and be positive
            assert.strictEqual(proof.iterationsRequired, iterations, 'iterationsRequired should match');
            assert.ok(proof.iterationsRequired > 0, 'iterationsRequired should be positive');

            return true;
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design doc
      );
    });

    test('should generate deterministic hash for same output', function() {
      this.timeout(30000);

      const stdoutArb = fc.string({ minLength: 0, maxLength: 5000 });
      const stderrArb = fc.string({ minLength: 0, maxLength: 5000 });

      fc.assert(
        fc.property(
          stdoutArb,
          stderrArb,
          (stdout, stderr) => {
            const result: PostResurrectionCompilationResult = {
              success: true,
              exitCode: 0,
              stdout,
              stderr,
              duration: 1000
            };

            const options: CompileOptions = {
              packageManager: 'npm',
              buildCommand: 'build'
            };

            // Generate proof twice with same input
            const proof1 = runner.generateCompilationProof(result, options, 1);
            const proof2 = runner.generateCompilationProof(result, options, 1);

            // Hash should be deterministic
            assert.strictEqual(proof1.outputHash, proof2.outputHash, 
              'same output should produce same hash');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate unique hash for different outputs', function() {
      this.timeout(30000);

      // Generate pairs of different strings
      const differentStringsArb = fc.tuple(
        fc.string({ minLength: 1, maxLength: 1000 }),
        fc.string({ minLength: 1, maxLength: 1000 })
      ).filter(([a, b]) => a !== b);

      fc.assert(
        fc.property(
          differentStringsArb,
          ([stdout1, stdout2]) => {
            const result1: PostResurrectionCompilationResult = {
              success: true,
              exitCode: 0,
              stdout: stdout1,
              stderr: '',
              duration: 1000
            };

            const result2: PostResurrectionCompilationResult = {
              success: true,
              exitCode: 0,
              stdout: stdout2,
              stderr: '',
              duration: 1000
            };

            const options: CompileOptions = {
              packageManager: 'npm',
              buildCommand: 'build'
            };

            const proof1 = runner.generateCompilationProof(result1, options, 1);
            const proof2 = runner.generateCompilationProof(result2, options, 1);

            // Different outputs should produce different hashes
            assert.notStrictEqual(proof1.outputHash, proof2.outputHash,
              'different outputs should produce different hashes');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
