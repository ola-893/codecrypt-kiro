/**
 * Tests for Compilation Proof Engine
 */

import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  detectCompilationStrategy,
  detectProjectType,
  parseTypeScriptErrors,
  parseNpmErrors,
  categorizeError,
  categorizeErrors,
  extractMissingModules,
  generateFixSuggestions,
  runBaselineCompilationCheck,
  generateResurrectionVerdict
} from '../services/compilationProof';
import { CompilationError, CategorizedError, BaselineCompilationResult } from '../types';

suite('Compilation Proof Engine', () => {
  let testRepoPath: string;

  setup(async () => {
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codecrypt-compilation-test-'));
  });

  teardown(async () => {
    if (testRepoPath) {
      try {
        await fs.rm(testRepoPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  suite('detectCompilationStrategy', () => {
    test('should detect TypeScript project', async () => {
      await fs.writeFile(path.join(testRepoPath, 'tsconfig.json'), '{}');
      const strategy = await detectCompilationStrategy(testRepoPath);
      assert.strictEqual(strategy, 'typescript');
    });

    test('should detect Vite project (js config)', async () => {
      await fs.writeFile(path.join(testRepoPath, 'vite.config.js'), 'export default {}');
      const strategy = await detectCompilationStrategy(testRepoPath);
      assert.strictEqual(strategy, 'vite');
    });

    test('should detect Vite project (ts config)', async () => {
      await fs.writeFile(path.join(testRepoPath, 'vite.config.ts'), 'export default {}');
      const strategy = await detectCompilationStrategy(testRepoPath);
      assert.strictEqual(strategy, 'vite');
    });


    test('should detect Webpack project', async () => {
      await fs.writeFile(path.join(testRepoPath, 'webpack.config.js'), 'module.exports = {}');
      const strategy = await detectCompilationStrategy(testRepoPath);
      assert.strictEqual(strategy, 'webpack');
    });

    test('should detect npm-build project', async () => {
      const packageJson = { scripts: { build: 'echo build' } };
      await fs.writeFile(path.join(testRepoPath, 'package.json'), JSON.stringify(packageJson));
      const strategy = await detectCompilationStrategy(testRepoPath);
      assert.strictEqual(strategy, 'npm-build');
    });

    test('should return custom for unknown project', async () => {
      const strategy = await detectCompilationStrategy(testRepoPath);
      assert.strictEqual(strategy, 'custom');
    });

    test('should prioritize TypeScript over other strategies', async () => {
      await fs.writeFile(path.join(testRepoPath, 'tsconfig.json'), '{}');
      await fs.writeFile(path.join(testRepoPath, 'vite.config.js'), 'export default {}');
      const strategy = await detectCompilationStrategy(testRepoPath);
      assert.strictEqual(strategy, 'typescript');
    });
  });

  suite('detectProjectType', () => {
    test('should detect TypeScript project', async () => {
      await fs.writeFile(path.join(testRepoPath, 'tsconfig.json'), '{}');
      const type = await detectProjectType(testRepoPath);
      assert.strictEqual(type, 'typescript');
    });

    test('should detect JavaScript project', async () => {
      await fs.writeFile(path.join(testRepoPath, 'package.json'), '{}');
      const type = await detectProjectType(testRepoPath);
      assert.strictEqual(type, 'javascript');
    });

    test('should return unknown for empty directory', async () => {
      const type = await detectProjectType(testRepoPath);
      assert.strictEqual(type, 'unknown');
    });
  });

  suite('parseTypeScriptErrors', () => {
    test('should parse standard TypeScript error format', () => {
      const output = `src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.`;
      const errors = parseTypeScriptErrors(output);
      
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].file, 'src/index.ts');
      assert.strictEqual(errors[0].line, 10);
      assert.strictEqual(errors[0].column, 5);
      assert.strictEqual(errors[0].code, 'TS2322');
      assert.ok(errors[0].message.includes('Type'));
    });

    test('should parse alternative TypeScript error format', () => {
      const output = `src/index.ts:10:5 - error TS2307: Cannot find module 'lodash'.`;
      const errors = parseTypeScriptErrors(output);
      
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].file, 'src/index.ts');
      assert.strictEqual(errors[0].line, 10);
      assert.strictEqual(errors[0].code, 'TS2307');
    });

    test('should parse multiple errors', () => {
      const output = `
src/a.ts(1,1): error TS2322: Error 1
src/b.ts(2,2): error TS2307: Error 2
src/c.ts(3,3): error TS1005: Error 3
      `;
      const errors = parseTypeScriptErrors(output);
      assert.strictEqual(errors.length, 3);
    });

    test('should return empty array for no errors', () => {
      const output = 'Compilation successful';
      const errors = parseTypeScriptErrors(output);
      assert.strictEqual(errors.length, 0);
    });
  });

  suite('parseNpmErrors', () => {
    test('should parse generic Error messages', () => {
      const output = `Error: Cannot find module 'express'`;
      const errors = parseNpmErrors(output);
      
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].message.includes('Cannot find module'));
    });

    test('should parse Module not found errors', () => {
      const output = `Module not found: Error: Can't resolve 'react'`;
      const errors = parseNpmErrors(output);
      
      assert.ok(errors.some(e => e.code === 'MODULE_NOT_FOUND'));
    });
  });

  suite('categorizeError', () => {
    test('should categorize TS2xxx as type error', () => {
      const error: CompilationError = {
        file: 'test.ts',
        line: 1,
        column: 1,
        code: 'TS2322',
        message: 'Type error'
      };
      assert.strictEqual(categorizeError(error), 'type');
    });

    test('should categorize TS1xxx as syntax error', () => {
      const error: CompilationError = {
        file: 'test.ts',
        line: 1,
        column: 1,
        code: 'TS1005',
        message: 'Expected semicolon'
      };
      assert.strictEqual(categorizeError(error), 'syntax');
    });

    test('should categorize TS2307 as import error', () => {
      const error: CompilationError = {
        file: 'test.ts',
        line: 1,
        column: 1,
        code: 'TS2307',
        message: "Cannot find module 'lodash'"
      };
      assert.strictEqual(categorizeError(error), 'import');
    });

    test('should categorize TS2305 as import error', () => {
      const error: CompilationError = {
        file: 'test.ts',
        line: 1,
        column: 1,
        code: 'TS2305',
        message: "Module has no exported member"
      };
      assert.strictEqual(categorizeError(error), 'import');
    });

    test('should categorize MODULE_NOT_FOUND as import error', () => {
      const error: CompilationError = {
        file: 'unknown',
        line: 0,
        column: 0,
        code: 'MODULE_NOT_FOUND',
        message: "Cannot find module 'express'"
      };
      assert.strictEqual(categorizeError(error), 'import');
    });

    test('should categorize TS5xxx as config error', () => {
      const error: CompilationError = {
        file: 'tsconfig.json',
        line: 1,
        column: 1,
        code: 'TS5023',
        message: 'Unknown compiler option'
      };
      assert.strictEqual(categorizeError(error), 'config');
    });
  });

  suite('categorizeErrors', () => {
    test('should categorize and count errors by category', () => {
      const errors: CompilationError[] = [
        { file: 'a.ts', line: 1, column: 1, code: 'TS2322', message: 'Type error' },
        { file: 'b.ts', line: 1, column: 1, code: 'TS2307', message: 'Cannot find module' },
        { file: 'c.ts', line: 1, column: 1, code: 'TS1005', message: 'Syntax error' },
      ];
      
      const { categorizedErrors, errorsByCategory } = categorizeErrors(errors);
      
      assert.strictEqual(categorizedErrors.length, 3);
      assert.strictEqual(errorsByCategory.type, 1);
      assert.strictEqual(errorsByCategory.import, 1);
      assert.strictEqual(errorsByCategory.syntax, 1);
    });
  });

  suite('extractMissingModules', () => {
    test('should extract module names from import errors', () => {
      const errors: CategorizedError[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          code: 'TS2307',
          message: "Cannot find module 'lodash'",
          category: 'import'
        },
        {
          file: 'test.ts',
          line: 2,
          column: 1,
          code: 'TS2307',
          message: "Cannot find module 'express'",
          category: 'import'
        }
      ];
      
      const modules = extractMissingModules(errors);
      assert.ok(modules.includes('lodash'));
      assert.ok(modules.includes('express'));
    });

    test('should handle scoped packages', () => {
      const errors: CategorizedError[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          code: 'TS2307',
          message: "Cannot find module '@types/node'",
          category: 'import'
        }
      ];
      
      const modules = extractMissingModules(errors);
      assert.ok(modules.includes('@types/node'));
    });

    test('should ignore relative paths', () => {
      const errors: CategorizedError[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          code: 'TS2307',
          message: "Cannot find module './utils'",
          category: 'import'
        }
      ];
      
      const modules = extractMissingModules(errors);
      assert.strictEqual(modules.length, 0);
    });
  });

  suite('generateFixSuggestions', () => {
    test('should generate suggestions for type errors', () => {
      const errors: CategorizedError[] = [
        { file: 'a.ts', line: 1, column: 1, code: 'TS2322', message: 'Type error', category: 'type' }
      ];
      const errorsByCategory = { type: 1, import: 0, syntax: 0, dependency: 0, config: 0 };
      
      const suggestions = generateFixSuggestions(errors, errorsByCategory);
      
      assert.ok(suggestions.some(s => s.errorCategory === 'type'));
    });

    test('should generate npm install suggestion for import errors', () => {
      const errors: CategorizedError[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          code: 'TS2307',
          message: "Cannot find module 'lodash'",
          category: 'import'
        }
      ];
      const errorsByCategory = { type: 0, import: 1, syntax: 0, dependency: 0, config: 0 };
      
      const suggestions = generateFixSuggestions(errors, errorsByCategory);
      
      const importSuggestion = suggestions.find(s => s.errorCategory === 'import');
      assert.ok(importSuggestion);
      assert.ok(importSuggestion!.description.includes('npm install'));
      assert.strictEqual(importSuggestion!.autoApplicable, true);
    });
  });

  suite('generateResurrectionVerdict', () => {
    test('should mark as resurrected when baseline failed and final passed', () => {
      const baseline: BaselineCompilationResult = {
        timestamp: new Date(),
        success: false,
        errorCount: 5,
        errors: [
          { file: 'a.ts', line: 1, column: 1, code: 'TS2322', message: 'Error 1', category: 'type' },
          { file: 'b.ts', line: 1, column: 1, code: 'TS2307', message: 'Error 2', category: 'import' },
        ],
        errorsByCategory: { type: 3, import: 2, syntax: 0, dependency: 0, config: 0 },
        output: '',
        projectType: 'typescript',
        strategy: 'typescript',
        suggestedFixes: []
      };
      
      const final: BaselineCompilationResult = {
        timestamp: new Date(),
        success: true,
        errorCount: 0,
        errors: [],
        errorsByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
        output: '',
        projectType: 'typescript',
        strategy: 'typescript',
        suggestedFixes: []
      };
      
      const verdict = generateResurrectionVerdict(baseline, final);
      
      assert.strictEqual(verdict.resurrected, true);
      assert.strictEqual(verdict.errorsFixed, 5);
      assert.strictEqual(verdict.errorsRemaining, 0);
    });

    test('should not mark as resurrected when both passed', () => {
      const baseline: BaselineCompilationResult = {
        timestamp: new Date(),
        success: true,
        errorCount: 0,
        errors: [],
        errorsByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
        output: '',
        projectType: 'typescript',
        strategy: 'typescript',
        suggestedFixes: []
      };
      
      const final: BaselineCompilationResult = {
        timestamp: new Date(),
        success: true,
        errorCount: 0,
        errors: [],
        errorsByCategory: { type: 0, import: 0, syntax: 0, dependency: 0, config: 0 },
        output: '',
        projectType: 'typescript',
        strategy: 'typescript',
        suggestedFixes: []
      };
      
      const verdict = generateResurrectionVerdict(baseline, final);
      
      assert.strictEqual(verdict.resurrected, false);
    });

    test('should track errors fixed by category', () => {
      const baseline: BaselineCompilationResult = {
        timestamp: new Date(),
        success: false,
        errorCount: 4,
        errors: [],
        errorsByCategory: { type: 2, import: 2, syntax: 0, dependency: 0, config: 0 },
        output: '',
        projectType: 'typescript',
        strategy: 'typescript',
        suggestedFixes: []
      };
      
      const final: BaselineCompilationResult = {
        timestamp: new Date(),
        success: false,
        errorCount: 1,
        errors: [],
        errorsByCategory: { type: 1, import: 0, syntax: 0, dependency: 0, config: 0 },
        output: '',
        projectType: 'typescript',
        strategy: 'typescript',
        suggestedFixes: []
      };
      
      const verdict = generateResurrectionVerdict(baseline, final);
      
      assert.strictEqual(verdict.errorsFixedByCategory.type, 1);
      assert.strictEqual(verdict.errorsFixedByCategory.import, 2);
      assert.strictEqual(verdict.errorsRemainingByCategory.type, 1);
    });

    test('should identify new errors introduced during resurrection', () => {
      const baseline: BaselineCompilationResult = {
        timestamp: new Date(),
        success: false,
        errorCount: 1,
        errors: [
          { file: 'a.ts', line: 1, column: 1, code: 'TS2322', message: 'Original error', category: 'type' }
        ],
        errorsByCategory: { type: 1, import: 0, syntax: 0, dependency: 0, config: 0 },
        output: '',
        projectType: 'typescript',
        strategy: 'typescript',
        suggestedFixes: []
      };
      
      const final: BaselineCompilationResult = {
        timestamp: new Date(),
        success: false,
        errorCount: 1,
        errors: [
          { file: 'b.ts', line: 5, column: 1, code: 'TS2307', message: 'New error', category: 'import' }
        ],
        errorsByCategory: { type: 0, import: 1, syntax: 0, dependency: 0, config: 0 },
        output: '',
        projectType: 'typescript',
        strategy: 'typescript',
        suggestedFixes: []
      };
      
      const verdict = generateResurrectionVerdict(baseline, final);
      
      assert.strictEqual(verdict.fixedErrors.length, 1);
      assert.strictEqual(verdict.newErrors.length, 1);
      assert.strictEqual(verdict.newErrors[0].message, 'New error');
    });
  });

  suite('runBaselineCompilationCheck', () => {
    test('should return success for project without compilation strategy', async () => {
      const result = await runBaselineCompilationCheck(testRepoPath);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.strategy, 'custom');
    });

    test('should detect TypeScript project and run compilation', async function() {
      this.timeout(30000);
      
      // Create tsconfig.json
      await fs.writeFile(
        path.join(testRepoPath, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'commonjs' } })
      );
      
      // Create valid TypeScript file
      await fs.writeFile(
        path.join(testRepoPath, 'index.ts'),
        'const x: number = 42;\nexport { x };'
      );
      
      // Create package.json with TypeScript
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify({ devDependencies: { typescript: '^5.0.0' } })
      );
      
      try {
        execSync('npm install', { cwd: testRepoPath, stdio: 'pipe', timeout: 30000 });
      } catch {
        this.skip();
        return;
      }
      
      const result = await runBaselineCompilationCheck(testRepoPath);
      
      assert.strictEqual(result.strategy, 'typescript');
      assert.strictEqual(result.projectType, 'typescript');
      assert.strictEqual(result.success, true);
    });

    test('should detect compilation errors in TypeScript project', async function() {
      this.timeout(30000);
      
      // Create tsconfig.json
      await fs.writeFile(
        path.join(testRepoPath, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'commonjs', strict: true } })
      );
      
      // Create invalid TypeScript file
      await fs.writeFile(
        path.join(testRepoPath, 'index.ts'),
        'const x: number = "not a number";'
      );
      
      // Create package.json with TypeScript
      await fs.writeFile(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify({ devDependencies: { typescript: '^5.0.0' } })
      );
      
      try {
        execSync('npm install', { cwd: testRepoPath, stdio: 'pipe', timeout: 30000 });
      } catch {
        this.skip();
        return;
      }
      
      const result = await runBaselineCompilationCheck(testRepoPath);
      
      assert.strictEqual(result.success, false);
      assert.ok(result.errorCount > 0);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errorsByCategory.type > 0);
    });
  });
});
