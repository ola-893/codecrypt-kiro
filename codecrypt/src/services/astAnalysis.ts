/**
 * AST Analysis Service
 * Provides hybrid AST parsing using Babel (JavaScript) and ts-morph (TypeScript)
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import {
  FileASTAnalysis,
  ASTAnalysis,
  FunctionSignature,
  ModuleDependency,
  ComplexityMetrics,
  CodeStructure
} from '../types';
import { getLogger } from '../utils/logger';

/**
 * Detects file type based on extension
 */
export function detectFileType(filePath: string): 'js' | 'ts' | 'jsx' | 'tsx' | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.js':
      return 'js';
    case '.ts':
      return 'ts';
    case '.jsx':
      return 'jsx';
    case '.tsx':
      return 'tsx';
    default:
      return null;
  }
}

/**
 * Parses a JavaScript/JSX file using Babel
 */
export function parseJavaScriptFile(filePath: string, content: string): FileASTAnalysis {
  const fileType = detectFileType(filePath);
  if (!fileType || (fileType !== 'js' && fileType !== 'jsx')) {
    throw new Error(`Invalid file type for JavaScript parsing: ${filePath}`);
  }

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'dynamicImport', 'classProperties', 'objectRestSpread']
    });

    const structure: CodeStructure = {
      classes: [],
      functions: [],
      imports: [],
      exports: []
    };

    const callGraph: Array<{ caller: string; callee: string }> = [];
    let complexity = 0;
    let decisionPoints = 0;
    let currentFunction: string | null = null;

    traverse(ast, {
      // Extract function declarations
      FunctionDeclaration(path) {
        const node = path.node;
        const funcName = node.id?.name || 'anonymous';
        currentFunction = funcName;

        structure.functions.push({
          name: funcName,
          parameters: node.params.map(param => ({
            name: t.isIdentifier(param) ? param.name : 'unknown',
            type: undefined
          })),
          returnType: undefined,
          isAsync: node.async,
          isExported: path.parent.type === 'ExportNamedDeclaration' || 
                      path.parent.type === 'ExportDefaultDeclaration',
          location: { start: node.start || 0, end: node.end || 0 }
        });
      },

      // Extract arrow functions and function expressions
      ArrowFunctionExpression(path) {
        if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
          const funcName = path.parent.id.name;
          currentFunction = funcName;

          structure.functions.push({
            name: funcName,
            parameters: path.node.params.map(param => ({
              name: t.isIdentifier(param) ? param.name : 'unknown',
              type: undefined
            })),
            returnType: undefined,
            isAsync: path.node.async,
            isExported: false,
            location: { start: path.node.start || 0, end: path.node.end || 0 }
          });
        }
      },

      // Extract class declarations
      ClassDeclaration(path) {
        const node = path.node;
        const className = node.id?.name || 'anonymous';

        const methods: string[] = [];
        const properties: string[] = [];

        node.body.body.forEach(member => {
          if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
            methods.push(member.key.name);
          } else if (t.isClassProperty(member) && t.isIdentifier(member.key)) {
            properties.push(member.key.name);
          }
        });

        structure.classes.push({
          name: className,
          methods,
          properties,
          isExported: path.parent.type === 'ExportNamedDeclaration' || 
                      path.parent.type === 'ExportDefaultDeclaration'
        });
      },

      // Extract imports
      ImportDeclaration(path) {
        const node = path.node;
        const source = node.source.value;
        const identifiers: string[] = [];
        let importType: 'default' | 'named' | 'namespace' | 'dynamic' = 'named';

        node.specifiers.forEach(spec => {
          if (t.isImportDefaultSpecifier(spec)) {
            identifiers.push(spec.local.name);
            importType = 'default';
          } else if (t.isImportNamespaceSpecifier(spec)) {
            identifiers.push(spec.local.name);
            importType = 'namespace';
          } else if (t.isImportSpecifier(spec)) {
            identifiers.push(spec.local.name);
          }
        });

        structure.imports.push({
          source: filePath,
          target: source,
          importType,
          identifiers
        });
      },

      // Extract exports
      ExportNamedDeclaration(path) {
        const node = path.node;
        if (node.declaration) {
          if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
            structure.exports.push({ name: node.declaration.id.name, type: 'named' });
          } else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
            structure.exports.push({ name: node.declaration.id.name, type: 'named' });
          } else if (t.isVariableDeclaration(node.declaration)) {
            node.declaration.declarations.forEach(decl => {
              if (t.isIdentifier(decl.id)) {
                structure.exports.push({ name: decl.id.name, type: 'named' });
              }
            });
          }
        }
      },

      ExportDefaultDeclaration(path) {
        const node = path.node;
        if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
          structure.exports.push({ name: node.declaration.id.name, type: 'default' });
        } else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
          structure.exports.push({ name: node.declaration.id.name, type: 'default' });
        } else if (t.isIdentifier(node.declaration)) {
          structure.exports.push({ name: node.declaration.name, type: 'default' });
        } else {
          structure.exports.push({ name: 'default', type: 'default' });
        }
      },

      // Track function calls for call graph
      CallExpression(path) {
        if (currentFunction && t.isIdentifier(path.node.callee)) {
          callGraph.push({
            caller: currentFunction,
            callee: path.node.callee.name
          });
        }
      },

      // Calculate cyclomatic complexity
      IfStatement() {
        complexity++;
        decisionPoints++;
      },
      ConditionalExpression() {
        complexity++;
        decisionPoints++;
      },
      ForStatement() {
        complexity++;
        decisionPoints++;
      },
      WhileStatement() {
        complexity++;
        decisionPoints++;
      },
      DoWhileStatement() {
        complexity++;
        decisionPoints++;
      },
      SwitchCase(path) {
        if (path.node.test) {
          complexity++;
          decisionPoints++;
        }
      },
      LogicalExpression(path) {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
          decisionPoints++;
        }
      }
    });

    const linesOfCode = content.split('\n').length;

    return {
      filePath,
      fileType,
      linesOfCode,
      structure,
      complexity: {
        cyclomatic: complexity + 1, // Base complexity is 1
        decisionPoints
      },
      callGraph
    };
  } catch (error) {
    getLogger().error(`Failed to parse JavaScript file ${filePath}`, error);
    return {
      filePath,
      fileType,
      linesOfCode: content.split('\n').length,
      structure: { classes: [], functions: [], imports: [], exports: [] },
      complexity: { cyclomatic: 0, decisionPoints: 0 },
      callGraph: [],
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * Parses a TypeScript/TSX file using ts-morph
 */
export function parseTypeScriptFile(filePath: string, content: string): FileASTAnalysis {
  const fileType = detectFileType(filePath);
  if (!fileType || (fileType !== 'ts' && fileType !== 'tsx')) {
    throw new Error(`Invalid file type for TypeScript parsing: ${filePath}`);
  }

  try {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(filePath, content);

    const structure: CodeStructure = {
      classes: [],
      functions: [],
      imports: [],
      exports: []
    };

    const callGraph: Array<{ caller: string; callee: string }> = [];
    let complexity = 0;
    let decisionPoints = 0;

    // Extract functions
    sourceFile.getFunctions().forEach(func => {
      const funcName = func.getName() || 'anonymous';
      structure.functions.push({
        name: funcName,
        parameters: func.getParameters().map(param => ({
          name: param.getName(),
          type: param.getType().getText()
        })),
        returnType: func.getReturnType().getText(),
        isAsync: func.isAsync(),
        isExported: func.isExported(),
        location: { start: func.getStart(), end: func.getEnd() }
      });
    });

    // Extract arrow functions from variable declarations
    sourceFile.getVariableDeclarations().forEach(varDecl => {
      const initializer = varDecl.getInitializer();
      if (initializer && initializer.getKind() === SyntaxKind.ArrowFunction) {
        structure.functions.push({
          name: varDecl.getName(),
          parameters: [],
          returnType: undefined,
          isAsync: false,
          isExported: varDecl.isExported(),
          location: { start: varDecl.getStart(), end: varDecl.getEnd() }
        });
      }
    });

    // Extract classes
    sourceFile.getClasses().forEach(cls => {
      const className = cls.getName() || 'anonymous';
      structure.classes.push({
        name: className,
        methods: cls.getMethods().map(m => m.getName()),
        properties: cls.getProperties().map(p => p.getName()),
        isExported: cls.isExported()
      });
    });

    // Extract imports
    sourceFile.getImportDeclarations().forEach(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      const identifiers: string[] = [];
      let importType: 'default' | 'named' | 'namespace' | 'dynamic' = 'named';

      const defaultImport = imp.getDefaultImport();
      if (defaultImport) {
        identifiers.push(defaultImport.getText());
        importType = 'default';
      }

      const namespaceImport = imp.getNamespaceImport();
      if (namespaceImport) {
        identifiers.push(namespaceImport.getText());
        importType = 'namespace';
      }

      imp.getNamedImports().forEach(named => {
        identifiers.push(named.getName());
      });

      structure.imports.push({
        source: filePath,
        target: moduleSpecifier,
        importType,
        identifiers
      });
    });

    // Extract exports
    sourceFile.getExportedDeclarations().forEach((declarations, name) => {
      structure.exports.push({ name, type: 'named' });
    });

    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (defaultExport) {
      structure.exports.push({ name: 'default', type: 'default' });
    }

    // Calculate complexity
    sourceFile.forEachDescendant(node => {
      switch (node.getKind()) {
        case SyntaxKind.IfStatement:
        case SyntaxKind.ConditionalExpression:
        case SyntaxKind.ForStatement:
        case SyntaxKind.ForInStatement:
        case SyntaxKind.ForOfStatement:
        case SyntaxKind.WhileStatement:
        case SyntaxKind.DoStatement:
        case SyntaxKind.CaseClause:
          complexity++;
          decisionPoints++;
          break;
        case SyntaxKind.BinaryExpression:
          const binExpr = node.asKind(SyntaxKind.BinaryExpression);
          if (binExpr) {
            const operator = binExpr.getOperatorToken().getText();
            if (operator === '&&' || operator === '||') {
              complexity++;
              decisionPoints++;
            }
          }
          break;
      }
    });

    const linesOfCode = sourceFile.getEndLineNumber();

    return {
      filePath,
      fileType,
      linesOfCode,
      structure,
      complexity: {
        cyclomatic: complexity + 1,
        decisionPoints
      },
      callGraph
    };
  } catch (error) {
    getLogger().error(`Failed to parse TypeScript file ${filePath}`, error);
    return {
      filePath,
      fileType,
      linesOfCode: content.split('\n').length,
      structure: { classes: [], functions: [], imports: [], exports: [] },
      complexity: { cyclomatic: 0, decisionPoints: 0 },
      callGraph: [],
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * Parses a file based on its type
 */
export function parseFile(filePath: string, content: string): FileASTAnalysis {
  const fileType = detectFileType(filePath);
  
  if (!fileType) {
    throw new Error(`Unsupported file type: ${filePath}`);
  }

  if (fileType === 'js' || fileType === 'jsx') {
    return parseJavaScriptFile(filePath, content);
  } else {
    return parseTypeScriptFile(filePath, content);
  }
}

/**
 * Analyzes all JavaScript/TypeScript files in a directory
 */
export async function analyzeRepository(repoPath: string): Promise<ASTAnalysis> {
  const logger = getLogger();
  logger.info(`Starting AST analysis of repository: ${repoPath}`);

  const files: FileASTAnalysis[] = [];
  const allDependencies: ModuleDependency[] = [];

  // Find all JS/TS files
  const jstsFiles = await findSourceFiles(repoPath);
  
  logger.info(`Found ${jstsFiles.length} source files to analyze`);

  for (const filePath of jstsFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(repoPath, filePath);
      const analysis = parseFile(relativePath, content);
      
      files.push(analysis);
      allDependencies.push(...analysis.structure.imports);
    } catch (error) {
      logger.error(`Failed to analyze file ${filePath}`, error);
    }
  }

  const totalLOC = files.reduce((sum, file) => sum + file.linesOfCode, 0);
  const averageComplexity = files.length > 0
    ? files.reduce((sum, file) => sum + file.complexity.cyclomatic, 0) / files.length
    : 0;

  logger.info(`AST analysis complete: ${files.length} files, ${totalLOC} LOC, avg complexity ${averageComplexity.toFixed(2)}`);

  return {
    files,
    totalLOC,
    averageComplexity,
    dependencyGraph: allDependencies,
    analyzedAt: new Date()
  };
}

/**
 * Recursively finds all JavaScript/TypeScript source files
 */
async function findSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const excludeDirs = ['node_modules', 'dist', 'build', 'out', '.git', 'coverage'];

  function walkDir(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          walkDir(fullPath);
        }
      } else if (entry.isFile()) {
        const fileType = detectFileType(entry.name);
        if (fileType) {
          files.push(fullPath);
        }
      }
    }
  }

  walkDir(dir);
  return files;
}

/**
 * Builds a complete call graph across all files
 */
export function buildCallGraph(analysis: ASTAnalysis): Map<string, Set<string>> {
  const callGraph = new Map<string, Set<string>>();

  for (const file of analysis.files) {
    for (const call of file.callGraph) {
      if (!callGraph.has(call.caller)) {
        callGraph.set(call.caller, new Set());
      }
      callGraph.get(call.caller)!.add(call.callee);
    }
  }

  return callGraph;
}

/**
 * Identifies module dependency relationships
 */
export function buildDependencyGraph(analysis: ASTAnalysis): Map<string, Set<string>> {
  const depGraph = new Map<string, Set<string>>();

  for (const dep of analysis.dependencyGraph) {
    if (!depGraph.has(dep.source)) {
      depGraph.set(dep.source, new Set());
    }
    depGraph.get(dep.source)!.add(dep.target);
  }

  return depGraph;
}

/**
 * Extracts all function signatures from the analysis
 */
export function extractFunctionSignatures(analysis: ASTAnalysis): FunctionSignature[] {
  const signatures: FunctionSignature[] = [];

  for (const file of analysis.files) {
    signatures.push(...file.structure.functions);
  }

  return signatures;
}

/**
 * Calculates complexity metrics for the entire repository
 */
export function calculateRepositoryComplexity(analysis: ASTAnalysis): {
  totalComplexity: number;
  averageComplexity: number;
  maxComplexity: number;
  highComplexityFiles: Array<{ file: string; complexity: number }>;
} {
  let totalComplexity = 0;
  let maxComplexity = 0;
  const complexityByFile: Array<{ file: string; complexity: number }> = [];

  for (const file of analysis.files) {
    const fileComplexity = file.complexity.cyclomatic;
    totalComplexity += fileComplexity;
    complexityByFile.push({ file: file.filePath, complexity: fileComplexity });

    if (fileComplexity > maxComplexity) {
      maxComplexity = fileComplexity;
    }
  }

  const averageComplexity = analysis.files.length > 0 
    ? totalComplexity / analysis.files.length 
    : 0;

  // Identify high complexity files (above 2x average)
  const threshold = averageComplexity * 2;
  const highComplexityFiles = complexityByFile
    .filter(f => f.complexity > threshold)
    .sort((a, b) => b.complexity - a.complexity);

  return {
    totalComplexity,
    averageComplexity,
    maxComplexity,
    highComplexityFiles
  };
}

/**
 * Identifies circular dependencies in the module graph
 */
export function findCircularDependencies(analysis: ASTAnalysis): string[][] {
  const graph = buildDependencyGraph(analysis);
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }
    }

    recursionStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Extracts all exported symbols from the repository
 */
export function extractExports(analysis: ASTAnalysis): Map<string, Array<{ name: string; type: 'default' | 'named' }>> {
  const exports = new Map<string, Array<{ name: string; type: 'default' | 'named' }>>();

  for (const file of analysis.files) {
    if (file.structure.exports.length > 0) {
      exports.set(file.filePath, file.structure.exports);
    }
  }

  return exports;
}

/**
 * Generates a structural analysis report
 */
export function generateStructuralReport(analysis: ASTAnalysis): {
  summary: {
    totalFiles: number;
    totalLOC: number;
    totalFunctions: number;
    totalClasses: number;
    averageComplexity: number;
  };
  complexity: ReturnType<typeof calculateRepositoryComplexity>;
  dependencies: {
    totalDependencies: number;
    circularDependencies: string[][];
  };
  exports: {
    totalExports: number;
    filesByExports: Array<{ file: string; exportCount: number }>;
  };
} {
  const allFunctions = extractFunctionSignatures(analysis);
  const allClasses = analysis.files.flatMap(f => f.structure.classes);
  const complexity = calculateRepositoryComplexity(analysis);
  const circularDeps = findCircularDependencies(analysis);
  const exports = extractExports(analysis);

  const filesByExports = Array.from(exports.entries())
    .map(([file, exps]) => ({ file, exportCount: exps.length }))
    .sort((a, b) => b.exportCount - a.exportCount);

  return {
    summary: {
      totalFiles: analysis.files.length,
      totalLOC: analysis.totalLOC,
      totalFunctions: allFunctions.length,
      totalClasses: allClasses.length,
      averageComplexity: analysis.averageComplexity
    },
    complexity,
    dependencies: {
      totalDependencies: analysis.dependencyGraph.length,
      circularDependencies: circularDeps
    },
    exports: {
      totalExports: Array.from(exports.values()).reduce((sum, exps) => sum + exps.length, 0),
      filesByExports
    }
  };
}


/**
 * Code smell types
 */
export type CodeSmell = 
  | 'long-function'
  | 'high-complexity'
  | 'large-class'
  | 'long-parameter-list'
  | 'duplicate-code'
  | 'dead-code'
  | 'god-class';

/**
 * Code smell detection result
 */
export interface CodeSmellResult {
  type: CodeSmell;
  severity: 'low' | 'medium' | 'high';
  location: string;
  description: string;
  metric?: number;
}

/**
 * Calculates cognitive complexity (more nuanced than cyclomatic)
 */
export function calculateCognitiveComplexity(file: FileASTAnalysis): number {
  // Cognitive complexity considers nesting depth
  // This is a simplified version - full implementation would require deeper AST traversal
  const baseComplexity = file.complexity.cyclomatic;
  const nestingPenalty = Math.floor(file.complexity.decisionPoints / 3);
  return baseComplexity + nestingPenalty;
}

/**
 * Identifies code smells in a file
 */
export function detectCodeSmells(file: FileASTAnalysis): CodeSmellResult[] {
  const smells: CodeSmellResult[] = [];

  // Long function detection (> 50 LOC)
  for (const func of file.structure.functions) {
    const funcLength = func.location.end - func.location.start;
    const estimatedLines = Math.floor(funcLength / 40); // Rough estimate

    if (estimatedLines > 50) {
      smells.push({
        type: 'long-function',
        severity: estimatedLines > 100 ? 'high' : 'medium',
        location: `${file.filePath}:${func.name}`,
        description: `Function '${func.name}' is too long (estimated ${estimatedLines} lines)`,
        metric: estimatedLines
      });
    }
  }

  // High complexity detection
  if (file.complexity.cyclomatic > 10) {
    smells.push({
      type: 'high-complexity',
      severity: file.complexity.cyclomatic > 20 ? 'high' : 'medium',
      location: file.filePath,
      description: `File has high cyclomatic complexity (${file.complexity.cyclomatic})`,
      metric: file.complexity.cyclomatic
    });
  }

  // Large class detection (> 10 methods)
  for (const cls of file.structure.classes) {
    if (cls.methods.length > 10) {
      smells.push({
        type: 'large-class',
        severity: cls.methods.length > 20 ? 'high' : 'medium',
        location: `${file.filePath}:${cls.name}`,
        description: `Class '${cls.name}' has too many methods (${cls.methods.length})`,
        metric: cls.methods.length
      });
    }

    // God class detection (many methods + many properties)
    if (cls.methods.length > 15 && cls.properties.length > 10) {
      smells.push({
        type: 'god-class',
        severity: 'high',
        location: `${file.filePath}:${cls.name}`,
        description: `Class '${cls.name}' is a god class (${cls.methods.length} methods, ${cls.properties.length} properties)`,
        metric: cls.methods.length + cls.properties.length
      });
    }
  }

  // Long parameter list detection (> 5 parameters)
  for (const func of file.structure.functions) {
    if (func.parameters.length > 5) {
      smells.push({
        type: 'long-parameter-list',
        severity: func.parameters.length > 7 ? 'high' : 'medium',
        location: `${file.filePath}:${func.name}`,
        description: `Function '${func.name}' has too many parameters (${func.parameters.length})`,
        metric: func.parameters.length
      });
    }
  }

  return smells;
}

/**
 * Detects anti-patterns in the codebase
 */
export function detectAntiPatterns(analysis: ASTAnalysis): Array<{
  type: string;
  description: string;
  affectedFiles: string[];
}> {
  const antiPatterns: Array<{
    type: string;
    description: string;
    affectedFiles: string[];
  }> = [];

  // Circular dependencies
  const circularDeps = findCircularDependencies(analysis);
  if (circularDeps.length > 0) {
    antiPatterns.push({
      type: 'circular-dependencies',
      description: `Found ${circularDeps.length} circular dependency chain(s)`,
      affectedFiles: circularDeps.flat()
    });
  }

  // Files with no exports (potential dead code)
  const filesWithoutExports = analysis.files.filter(
    f => f.structure.exports.length === 0 && f.structure.functions.length > 0
  );
  if (filesWithoutExports.length > 0) {
    antiPatterns.push({
      type: 'no-exports',
      description: `Found ${filesWithoutExports.length} file(s) with no exports (potential dead code)`,
      affectedFiles: filesWithoutExports.map(f => f.filePath)
    });
  }

  // Files with very high complexity
  const complexityMetrics = calculateRepositoryComplexity(analysis);
  if (complexityMetrics.highComplexityFiles.length > 0) {
    antiPatterns.push({
      type: 'high-complexity-files',
      description: `Found ${complexityMetrics.highComplexityFiles.length} file(s) with very high complexity`,
      affectedFiles: complexityMetrics.highComplexityFiles.map(f => f.file)
    });
  }

  return antiPatterns;
}

/**
 * Calculates comprehensive metrics for the repository
 */
export function calculateComprehensiveMetrics(analysis: ASTAnalysis): {
  loc: {
    total: number;
    average: number;
    largest: { file: string; loc: number };
  };
  complexity: {
    cyclomatic: {
      total: number;
      average: number;
      max: number;
    };
    cognitive: {
      total: number;
      average: number;
    };
  };
  structure: {
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    averageFunctionsPerFile: number;
    averageClassesPerFile: number;
  };
  dependencies: {
    totalImports: number;
    averageImportsPerFile: number;
    mostImportedModules: Array<{ module: string; count: number }>;
  };
  quality: {
    codeSmells: CodeSmellResult[];
    antiPatterns: ReturnType<typeof detectAntiPatterns>;
    filesWithErrors: number;
  };
} {
  // LOC metrics
  const locByFile = analysis.files.map(f => ({ file: f.filePath, loc: f.linesOfCode }));
  const largestFile = locByFile.reduce((max, f) => f.loc > max.loc ? f : max, locByFile[0] || { file: '', loc: 0 });

  // Complexity metrics
  const complexityMetrics = calculateRepositoryComplexity(analysis);
  const cognitiveComplexities = analysis.files.map(f => calculateCognitiveComplexity(f));
  const totalCognitive = cognitiveComplexities.reduce((sum, c) => sum + c, 0);
  const avgCognitive = analysis.files.length > 0 ? totalCognitive / analysis.files.length : 0;

  // Structure metrics
  const allFunctions = extractFunctionSignatures(analysis);
  const allClasses = analysis.files.flatMap(f => f.structure.classes);

  // Dependency metrics
  const importCounts = new Map<string, number>();
  for (const dep of analysis.dependencyGraph) {
    importCounts.set(dep.target, (importCounts.get(dep.target) || 0) + 1);
  }
  const mostImported = Array.from(importCounts.entries())
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Quality metrics
  const allCodeSmells = analysis.files.flatMap(f => detectCodeSmells(f));
  const antiPatterns = detectAntiPatterns(analysis);
  const filesWithErrors = analysis.files.filter(f => f.errors && f.errors.length > 0).length;

  return {
    loc: {
      total: analysis.totalLOC,
      average: analysis.files.length > 0 ? analysis.totalLOC / analysis.files.length : 0,
      largest: largestFile
    },
    complexity: {
      cyclomatic: {
        total: complexityMetrics.totalComplexity,
        average: complexityMetrics.averageComplexity,
        max: complexityMetrics.maxComplexity
      },
      cognitive: {
        total: totalCognitive,
        average: avgCognitive
      }
    },
    structure: {
      totalFiles: analysis.files.length,
      totalFunctions: allFunctions.length,
      totalClasses: allClasses.length,
      averageFunctionsPerFile: analysis.files.length > 0 ? allFunctions.length / analysis.files.length : 0,
      averageClassesPerFile: analysis.files.length > 0 ? allClasses.length / analysis.files.length : 0
    },
    dependencies: {
      totalImports: analysis.dependencyGraph.length,
      averageImportsPerFile: analysis.files.length > 0 ? analysis.dependencyGraph.length / analysis.files.length : 0,
      mostImportedModules: mostImported
    },
    quality: {
      codeSmells: allCodeSmells,
      antiPatterns,
      filesWithErrors
    }
  };
}

/**
 * Generates a complete structural analysis report with metrics
 */
export function generateCompleteAnalysisReport(analysis: ASTAnalysis): string {
  const metrics = calculateComprehensiveMetrics(analysis);
  const structuralReport = generateStructuralReport(analysis);

  let report = '# AST Analysis Report\n\n';
  report += `**Generated:** ${analysis.analyzedAt.toISOString()}\n\n`;

  // Summary
  report += '## Summary\n\n';
  report += `- **Total Files:** ${metrics.structure.totalFiles}\n`;
  report += `- **Total Lines of Code:** ${metrics.loc.total}\n`;
  report += `- **Total Functions:** ${metrics.structure.totalFunctions}\n`;
  report += `- **Total Classes:** ${metrics.structure.totalClasses}\n`;
  report += `- **Average Complexity:** ${metrics.complexity.cyclomatic.average.toFixed(2)}\n\n`;

  // Complexity Analysis
  report += '## Complexity Analysis\n\n';
  report += `- **Total Cyclomatic Complexity:** ${metrics.complexity.cyclomatic.total}\n`;
  report += `- **Average Cyclomatic Complexity:** ${metrics.complexity.cyclomatic.average.toFixed(2)}\n`;
  report += `- **Max Cyclomatic Complexity:** ${metrics.complexity.cyclomatic.max}\n`;
  report += `- **Average Cognitive Complexity:** ${metrics.complexity.cognitive.average.toFixed(2)}\n\n`;

  if (structuralReport.complexity.highComplexityFiles.length > 0) {
    report += '### High Complexity Files\n\n';
    for (const file of structuralReport.complexity.highComplexityFiles.slice(0, 5)) {
      report += `- ${file.file}: ${file.complexity}\n`;
    }
    report += '\n';
  }

  // Dependencies
  report += '## Dependencies\n\n';
  report += `- **Total Imports:** ${metrics.dependencies.totalImports}\n`;
  report += `- **Average Imports per File:** ${metrics.dependencies.averageImportsPerFile.toFixed(2)}\n`;
  
  if (structuralReport.dependencies.circularDependencies.length > 0) {
    report += `- **⚠️ Circular Dependencies Found:** ${structuralReport.dependencies.circularDependencies.length}\n`;
  }
  report += '\n';

  // Code Quality
  report += '## Code Quality\n\n';
  report += `- **Code Smells Detected:** ${metrics.quality.codeSmells.length}\n`;
  report += `- **Anti-Patterns Detected:** ${metrics.quality.antiPatterns.length}\n`;
  report += `- **Files with Parse Errors:** ${metrics.quality.filesWithErrors}\n\n`;

  if (metrics.quality.codeSmells.length > 0) {
    report += '### Code Smells\n\n';
    const smellsByType = new Map<CodeSmell, number>();
    for (const smell of metrics.quality.codeSmells) {
      smellsByType.set(smell.type, (smellsByType.get(smell.type) || 0) + 1);
    }
    for (const [type, count] of smellsByType.entries()) {
      report += `- **${type}:** ${count}\n`;
    }
    report += '\n';
  }

  if (metrics.quality.antiPatterns.length > 0) {
    report += '### Anti-Patterns\n\n';
    for (const pattern of metrics.quality.antiPatterns) {
      report += `- **${pattern.type}:** ${pattern.description}\n`;
    }
    report += '\n';
  }

  return report;
}
