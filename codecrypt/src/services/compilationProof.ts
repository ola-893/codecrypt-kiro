/**
 * Compilation Proof Engine
 * 
 * This service is the core of CodeCrypt - it proves that dead code has been resurrected by:
 * 1. Establishing a baseline (proving the code is broken)
 * 2. Attempting resurrection (fixing compilation errors)
 * 3. Verifying success (proving the code now compiles)
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  CompilationStrategy,
  ErrorCategory,
  CompilationError,
  CategorizedError,
  FixSuggestion,
  BaselineCompilationResult
} from '../types';

const execAsync = promisify(exec);

/**
 * Detect the appropriate compilation strategy for a project
 */
export async function detectCompilationStrategy(repoPath: string): Promise<CompilationStrategy> {
  // Check for TypeScript (tsconfig.json)
  const tsconfigPath = path.join(repoPath, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    return 'typescript';
  }

  // Check for Vite (vite.config.js or vite.config.ts)
  const viteConfigJs = path.join(repoPath, 'vite.config.js');
  const viteConfigTs = path.join(repoPath, 'vite.config.ts');
  if (fs.existsSync(viteConfigJs) || fs.existsSync(viteConfigTs)) {
    return 'vite';
  }

  // Check for Webpack (webpack.config.js)
  const webpackConfig = path.join(repoPath, 'webpack.config.js');
  if (fs.existsSync(webpackConfig)) {
    return 'webpack';
  }

  // Check for build script in package.json
  const packageJsonPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.scripts?.build) {
        return 'npm-build';
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return 'custom';
}

/**
 * Detect the project type (TypeScript, JavaScript, or unknown)
 */
export async function detectProjectType(repoPath: string): Promise<'typescript' | 'javascript' | 'unknown'> {
  const tsconfigPath = path.join(repoPath, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    return 'typescript';
  }

  const packageJsonPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    return 'javascript';
  }

  return 'unknown';
}


/**
 * Result of running a compilation command
 */
interface CompilationRunResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run TypeScript compilation using tsc --noEmit
 */
export async function runTypeScriptCompilation(repoPath: string): Promise<CompilationRunResult> {
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
      cwd: repoPath,
      timeout: 120000, // 2 minute timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    return {
      success: true,
      exitCode: 0,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || ''
    };
  }
}

/**
 * Run npm build script
 */
export async function runNpmBuild(repoPath: string): Promise<CompilationRunResult> {
  try {
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: repoPath,
      timeout: 300000, // 5 minute timeout
      maxBuffer: 10 * 1024 * 1024
    });
    return {
      success: true,
      exitCode: 0,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || ''
    };
  }
}

/**
 * Run Webpack build
 */
export async function runWebpackBuild(repoPath: string): Promise<CompilationRunResult> {
  try {
    const { stdout, stderr } = await execAsync('npx webpack --mode production', {
      cwd: repoPath,
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024
    });
    return {
      success: true,
      exitCode: 0,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || ''
    };
  }
}

/**
 * Run Vite build
 */
export async function runViteBuild(repoPath: string): Promise<CompilationRunResult> {
  try {
    const { stdout, stderr } = await execAsync('npx vite build', {
      cwd: repoPath,
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024
    });
    return {
      success: true,
      exitCode: 0,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || ''
    };
  }
}

/**
 * Run compilation using the detected strategy
 */
export async function runCompilation(
  repoPath: string,
  strategy: CompilationStrategy
): Promise<CompilationRunResult> {
  switch (strategy) {
    case 'typescript':
      return runTypeScriptCompilation(repoPath);
    case 'npm-build':
      return runNpmBuild(repoPath);
    case 'webpack':
      return runWebpackBuild(repoPath);
    case 'vite':
      return runViteBuild(repoPath);
    case 'custom':
    default:
      // For custom/unknown, try npm build if available, otherwise succeed
      const packageJsonPath = path.join(repoPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.scripts?.build) {
            return runNpmBuild(repoPath);
          }
        } catch {
          // Ignore
        }
      }
      return {
        success: true,
        exitCode: 0,
        stdout: 'No compilation strategy detected',
        stderr: ''
      };
  }
}


/**
 * Parse TypeScript error output into structured errors
 */
export function parseTypeScriptErrors(output: string): CompilationError[] {
  const errors: CompilationError[] = [];
  
  // TypeScript error format: file(line,column): error TSxxxx: message
  const tsErrorRegex = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/gm;
  
  let match: RegExpExecArray | null;
  while ((match = tsErrorRegex.exec(output)) !== null) {
    errors.push({
      file: match[1].trim(),
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5].trim()
    });
  }

  // Also try alternative format: file:line:column - error TSxxxx: message
  const altErrorRegex = /^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/gm;
  let altMatch: RegExpExecArray | null;
  while ((altMatch = altErrorRegex.exec(output)) !== null) {
    // Avoid duplicates
    const exists = errors.some(
      e => e.file === altMatch![1].trim() && e.line === parseInt(altMatch![2], 10) && e.code === altMatch![4]
    );
    if (!exists) {
      errors.push({
        file: altMatch[1].trim(),
        line: parseInt(altMatch[2], 10),
        column: parseInt(altMatch[3], 10),
        code: altMatch[4],
        message: altMatch[5].trim()
      });
    }
  }

  return errors;
}

/**
 * Parse npm/webpack error output into structured errors
 */
export function parseNpmErrors(output: string): CompilationError[] {
  const errors: CompilationError[] = [];
  
  // Module not found pattern - check this FIRST as it's more specific
  const moduleNotFoundRegex = /Module not found:\s*(?:Error:\s*)?(?:Can't resolve\s*)?['"]?([^'"\s]+)['"]?/g;
  let moduleMatch: RegExpExecArray | null;
  while ((moduleMatch = moduleNotFoundRegex.exec(output)) !== null) {
    errors.push({
      file: 'unknown',
      line: 0,
      column: 0,
      code: 'MODULE_NOT_FOUND',
      message: `Cannot find module '${moduleMatch[1]}'`
    });
  }
  
  // Generic error pattern: Error: message (but not Module not found errors)
  const errorRegex = /(?<!Module not found:\s*)Error:\s*(.+)/g;
  let match: RegExpExecArray | null;
  let errorIndex = 0;
  
  while ((match = errorRegex.exec(output)) !== null) {
    // Skip if this is part of a Module not found error
    if (match[1].toLowerCase().includes("can't resolve")) {
      continue;
    }
    errors.push({
      file: 'unknown',
      line: 0,
      column: 0,
      code: `ERR${errorIndex++}`,
      message: match[1].trim()
    });
  }

  return errors;
}

/**
 * Parse compilation output into structured errors based on strategy
 */
export function parseCompilationErrors(
  output: string,
  strategy: CompilationStrategy
): CompilationError[] {
  const combinedOutput = output;
  
  switch (strategy) {
    case 'typescript':
      return parseTypeScriptErrors(combinedOutput);
    case 'npm-build':
    case 'webpack':
    case 'vite':
      // Try TypeScript errors first (many build tools use tsc)
      const tsErrors = parseTypeScriptErrors(combinedOutput);
      if (tsErrors.length > 0) {
        return tsErrors;
      }
      return parseNpmErrors(combinedOutput);
    case 'custom':
    default:
      // Try both parsers
      const errors = parseTypeScriptErrors(combinedOutput);
      if (errors.length === 0) {
        return parseNpmErrors(combinedOutput);
      }
      return errors;
  }
}

/**
 * Categorize a compilation error based on its code and message
 */
export function categorizeError(error: CompilationError): ErrorCategory {
  const code = error.code.toUpperCase();
  const message = error.message.toLowerCase();

  // TypeScript error codes
  if (code.startsWith('TS')) {
    const tsCode = parseInt(code.substring(2), 10);
    
    // TS1xxx - Syntax errors
    if (tsCode >= 1000 && tsCode < 2000) {
      return 'syntax';
    }
    
    // TS2307 - Cannot find module (import error)
    if (tsCode === 2307) {
      return 'import';
    }
    
    // TS2305 - Module has no exported member (import error)
    if (tsCode === 2305) {
      return 'import';
    }
    
    // TS2304 - Cannot find name (could be import or type)
    if (tsCode === 2304) {
      if (message.includes('module') || message.includes('import')) {
        return 'import';
      }
      return 'type';
    }
    
    // TS2xxx - Type errors (most common)
    if (tsCode >= 2000 && tsCode < 3000) {
      return 'type';
    }
    
    // TS5xxx - Config errors
    if (tsCode >= 5000 && tsCode < 6000) {
      return 'config';
    }
    
    // TS6xxx - Config errors
    if (tsCode >= 6000 && tsCode < 7000) {
      return 'config';
    }
  }

  // Module not found
  if (code === 'MODULE_NOT_FOUND' || message.includes('cannot find module') || 
      message.includes("can't resolve") || message.includes('module not found')) {
    return 'import';
  }

  // Import/export errors
  if (message.includes('has no exported member') || message.includes('is not exported') ||
      message.includes('import') || message.includes('export')) {
    return 'import';
  }

  // Syntax errors
  if (message.includes('unexpected') || message.includes('expected') ||
      message.includes('syntax') || message.includes('parsing')) {
    return 'syntax';
  }

  // Dependency errors
  if (message.includes('peer dep') || message.includes('version') ||
      message.includes('dependency') || message.includes('npm err')) {
    return 'dependency';
  }

  // Config errors
  if (message.includes('tsconfig') || message.includes('config') ||
      message.includes('webpack') || message.includes('vite')) {
    return 'config';
  }

  // Default to type error
  return 'type';
}

/**
 * Categorize all errors and group by category
 */
export function categorizeErrors(errors: CompilationError[]): {
  categorizedErrors: CategorizedError[];
  errorsByCategory: Record<ErrorCategory, number>;
} {
  const categorizedErrors: CategorizedError[] = errors.map(error => ({
    ...error,
    category: categorizeError(error)
  }));

  const errorsByCategory: Record<ErrorCategory, number> = {
    type: 0,
    import: 0,
    syntax: 0,
    dependency: 0,
    config: 0
  };

  for (const error of categorizedErrors) {
    errorsByCategory[error.category]++;
  }

  return { categorizedErrors, errorsByCategory };
}


/**
 * Extract missing module names from import errors
 */
export function extractMissingModules(errors: CategorizedError[]): string[] {
  const modules = new Set<string>();
  
  for (const error of errors) {
    if (error.category !== 'import') {continue;}
    
    // Pattern: Cannot find module 'xxx'
    const moduleMatch = error.message.match(/(?:cannot find module|can't resolve)\s*['"]([^'"]+)['"]/i);
    if (moduleMatch) {
      const moduleName = moduleMatch[1];
      // Only add if it looks like an npm package (not a relative path)
      if (!moduleName.startsWith('.') && !moduleName.startsWith('/')) {
        // Extract package name (handle scoped packages)
        const packageName = moduleName.startsWith('@')
          ? moduleName.split('/').slice(0, 2).join('/')
          : moduleName.split('/')[0];
        modules.add(packageName);
      }
    }
    
    // Pattern: Module 'xxx' has no exported member
    const exportMatch = error.message.match(/module\s*['"]([^'"]+)['"]/i);
    if (exportMatch && !moduleMatch) {
      const moduleName = exportMatch[1];
      if (!moduleName.startsWith('.') && !moduleName.startsWith('/')) {
        const packageName = moduleName.startsWith('@')
          ? moduleName.split('/').slice(0, 2).join('/')
          : moduleName.split('/')[0];
        modules.add(packageName);
      }
    }
  }
  
  return Array.from(modules);
}

/**
 * Generate fix suggestions based on categorized errors
 */
export function generateFixSuggestions(
  errors: CategorizedError[],
  errorsByCategory: Record<ErrorCategory, number>
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  // Type errors
  if (errorsByCategory.type > 0) {
    const typeErrors = errors.filter(e => e.category === 'type');
    suggestions.push({
      errorCategory: 'type',
      description: `Add type annotations or use 'any' casts for ${errorsByCategory.type} type error(s)`,
      autoApplicable: false,
      errorCount: errorsByCategory.type,
      details: typeErrors.slice(0, 5).map(e => `${e.file}:${e.line} - ${e.message}`)
    });
  }

  // Import errors
  if (errorsByCategory.import > 0) {
    const importErrors = errors.filter(e => e.category === 'import');
    const missingModules = extractMissingModules(importErrors);
    
    if (missingModules.length > 0) {
      suggestions.push({
        errorCategory: 'import',
        description: `Install missing packages: npm install ${missingModules.join(' ')}`,
        autoApplicable: true,
        errorCount: errorsByCategory.import,
        details: missingModules
      });
    } else {
      suggestions.push({
        errorCategory: 'import',
        description: `Fix ${errorsByCategory.import} import error(s) - check module paths and exports`,
        autoApplicable: false,
        errorCount: errorsByCategory.import,
        details: importErrors.slice(0, 5).map(e => `${e.file}:${e.line} - ${e.message}`)
      });
    }
  }

  // Syntax errors
  if (errorsByCategory.syntax > 0) {
    const syntaxErrors = errors.filter(e => e.category === 'syntax');
    suggestions.push({
      errorCategory: 'syntax',
      description: `Fix ${errorsByCategory.syntax} syntax error(s) - check for missing brackets, semicolons, or invalid syntax`,
      autoApplicable: false,
      errorCount: errorsByCategory.syntax,
      details: syntaxErrors.slice(0, 5).map(e => `${e.file}:${e.line} - ${e.message}`)
    });
  }

  // Dependency errors
  if (errorsByCategory.dependency > 0) {
    suggestions.push({
      errorCategory: 'dependency',
      description: `Resolve ${errorsByCategory.dependency} dependency conflict(s) - update or align package versions`,
      autoApplicable: true,
      errorCount: errorsByCategory.dependency,
      details: ['Run npm update or check for peer dependency conflicts']
    });
  }

  // Config errors
  if (errorsByCategory.config > 0) {
    const configErrors = errors.filter(e => e.category === 'config');
    suggestions.push({
      errorCategory: 'config',
      description: `Fix ${errorsByCategory.config} configuration error(s) - check tsconfig.json or build config`,
      autoApplicable: false,
      errorCount: errorsByCategory.config,
      details: configErrors.slice(0, 5).map(e => e.message)
    });
  }

  return suggestions;
}


/**
 * Run baseline compilation check to establish the initial state of the repository
 * This is called after cloning, before any modifications
 */
export async function runBaselineCompilationCheck(repoPath: string): Promise<BaselineCompilationResult> {
  // Detect project type and compilation strategy
  const projectType = await detectProjectType(repoPath);
  const strategy = await detectCompilationStrategy(repoPath);

  // Run compilation
  const compilationResult = await runCompilation(repoPath, strategy);
  
  // Combine stdout and stderr for error parsing
  const combinedOutput = `${compilationResult.stdout}\n${compilationResult.stderr}`;
  
  // Parse errors
  const rawErrors = parseCompilationErrors(combinedOutput, strategy);
  
  // Categorize errors
  const { categorizedErrors, errorsByCategory } = categorizeErrors(rawErrors);
  
  // Generate fix suggestions
  const suggestedFixes = generateFixSuggestions(categorizedErrors, errorsByCategory);

  return {
    timestamp: new Date(),
    success: compilationResult.success,
    errorCount: categorizedErrors.length,
    errors: categorizedErrors,
    errorsByCategory,
    output: combinedOutput,
    projectType,
    strategy,
    suggestedFixes
  };
}

/**
 * Run final compilation check after all resurrection steps
 * Uses the same logic as baseline check
 */
export async function runFinalCompilationCheck(repoPath: string): Promise<BaselineCompilationResult> {
  return runBaselineCompilationCheck(repoPath);
}


/**
 * Generate resurrection verdict by comparing baseline and final compilation results
 */
export function generateResurrectionVerdict(
  baseline: BaselineCompilationResult,
  final: BaselineCompilationResult
): import('../types').ResurrectionVerdict {
  // Determine if resurrection was successful
  // Success = baseline failed AND final passed
  const resurrected = !baseline.success && final.success;

  // Calculate errors fixed and remaining
  const errorsFixed = Math.max(0, baseline.errorCount - final.errorCount);
  const errorsRemaining = final.errorCount;

  // Calculate errors fixed by category
  const errorsFixedByCategory: Record<ErrorCategory, number> = {
    type: Math.max(0, baseline.errorsByCategory.type - final.errorsByCategory.type),
    import: Math.max(0, baseline.errorsByCategory.import - final.errorsByCategory.import),
    syntax: Math.max(0, baseline.errorsByCategory.syntax - final.errorsByCategory.syntax),
    dependency: Math.max(0, baseline.errorsByCategory.dependency - final.errorsByCategory.dependency),
    config: Math.max(0, baseline.errorsByCategory.config - final.errorsByCategory.config)
  };

  // Calculate errors remaining by category
  const errorsRemainingByCategory: Record<ErrorCategory, number> = {
    type: final.errorsByCategory.type,
    import: final.errorsByCategory.import,
    syntax: final.errorsByCategory.syntax,
    dependency: final.errorsByCategory.dependency,
    config: final.errorsByCategory.config
  };

  // Find which specific errors were fixed
  const fixedErrors: CategorizedError[] = baseline.errors.filter(
    baseErr => !final.errors.some(
      finalErr => 
        finalErr.file === baseErr.file &&
        finalErr.line === baseErr.line &&
        finalErr.code === baseErr.code &&
        finalErr.message === baseErr.message
    )
  );

  // Find new errors introduced during resurrection
  const newErrors: CategorizedError[] = final.errors.filter(
    finalErr => !baseline.errors.some(
      baseErr =>
        baseErr.file === finalErr.file &&
        baseErr.line === finalErr.line &&
        baseErr.code === finalErr.code &&
        baseErr.message === finalErr.message
    )
  );

  return {
    baselineCompilation: baseline,
    finalCompilation: final,
    resurrected,
    errorsFixed,
    errorsRemaining,
    errorsFixedByCategory,
    errorsRemainingByCategory,
    fixedErrors,
    newErrors
  };
}
