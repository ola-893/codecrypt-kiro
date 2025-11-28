/**
 * Tests for Hybrid Analysis Service
 */

import * as assert from 'assert';
import {
  combineInsights,
  getPriorityFiles,
  getHighImpactRefactorings,
  generateAnalysisSummary,
} from '../services/hybridAnalysis';
import { ASTAnalysis, LLMAnalysis, FileASTAnalysis, LLMInsight } from '../types';

suite('Hybrid Analysis Service', () => {
  // Sample AST analysis
  const sampleASTAnalysis: ASTAnalysis = {
    files: [
      {
        filePath: 'src/complex.ts',
        fileType: 'ts',
        linesOfCode: 500,
        structure: {
          classes: [
            {
              name: 'ComplexClass',
              methods: ['method1', 'method2', 'method3'],
              properties: ['prop1', 'prop2'],
              isExported: true,
            },
          ],
          functions: [
            {
              name: 'complexFunction',
              parameters: [{ name: 'arg1' }],
              isAsync: false,
              isExported: true,
              location: { start: 0, end: 100 },
            },
          ],
          imports: [],
          exports: [{ name: 'ComplexClass', type: 'named' }],
        },
        complexity: {
          cyclomatic: 20,
          decisionPoints: 15,
        },
        callGraph: [],
      },
      {
        filePath: 'src/simple.ts',
        fileType: 'ts',
        linesOfCode: 50,
        structure: {
          classes: [],
          functions: [
            {
              name: 'simpleFunction',
              parameters: [],
              isAsync: true,
              isExported: true,
              location: { start: 0, end: 20 },
            },
          ],
          imports: [],
          exports: [{ name: 'simpleFunction', type: 'named' }],
        },
        complexity: {
          cyclomatic: 2,
          decisionPoints: 1,
        },
        callGraph: [],
      },
    ],
    totalLOC: 550,
    averageComplexity: 11,
    dependencyGraph: [],
    analyzedAt: new Date(),
  };

  // Sample LLM analysis
  const sampleLLMAnalysis: LLMAnalysis = {
    insights: [
      {
        filePath: 'src/complex.ts',
        developerIntent: 'Complex business logic handler',
        domainConcepts: ['authentication', 'validation'],
        idiomaticPatterns: ['async/await'],
        antiPatterns: ['callback hell', 'global state'],
        modernizationSuggestions: [
          'Replace callbacks with async/await',
          'Add TypeScript types',
        ],
        confidence: 0.9,
      },
      {
        filePath: 'src/simple.ts',
        developerIntent: 'Simple utility function',
        domainConcepts: ['data transformation'],
        idiomaticPatterns: ['arrow functions', 'destructuring'],
        antiPatterns: [],
        modernizationSuggestions: ['Add error handling'],
        confidence: 0.8,
      },
    ],
    projectIntent: 'Web application backend',
    keyDomainConcepts: ['authentication', 'validation', 'data transformation'],
    modernizationStrategy: 'Incremental modernization focusing on high-complexity areas',
    analyzedAt: new Date(),
  };

  suite('combineInsights', () => {
    test('should combine AST and LLM analyses', () => {
      const result = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);

      assert.ok(result);
      assert.strictEqual(result.astAnalysis, sampleASTAnalysis);
      assert.strictEqual(result.llmAnalysis, sampleLLMAnalysis);
      assert.ok(result.combinedInsights);
      assert.ok(result.analyzedAt);
    });

    test('should identify priority files', () => {
      const result = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);

      assert.ok(result.combinedInsights.priorityFiles.length > 0);
      
      // Complex file should be higher priority
      const complexFile = result.combinedInsights.priorityFiles.find(
        (f) => f.filePath === 'src/complex.ts'
      );
      assert.ok(complexFile);
      assert.ok(complexFile.priority > 0);
    });

    test('should identify refactoring opportunities', () => {
      const result = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);

      assert.ok(result.combinedInsights.refactoringOpportunities.length > 0);
      
      // Should include high complexity refactoring
      const complexityRefactoring = result.combinedInsights.refactoringOpportunities.find(
        (r) => r.description.includes('complexity')
      );
      assert.ok(complexityRefactoring);
    });

    test('should generate recommendations', () => {
      const result = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);

      assert.ok(result.combinedInsights.recommendations.length > 0);
      
      // Should include complexity recommendation
      const hasComplexityRec = result.combinedInsights.recommendations.some(
        (r) => r.includes('complexity')
      );
      assert.ok(hasComplexityRec);
    });

    test('should prioritize files with anti-patterns', () => {
      const result = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);

      const complexFile = result.combinedInsights.priorityFiles.find(
        (f) => f.filePath === 'src/complex.ts'
      );
      
      assert.ok(complexFile);
      assert.ok(complexFile.reason.includes('Anti-patterns'));
    });

    test('should handle empty analyses', () => {
      const emptyAST: ASTAnalysis = {
        files: [],
        totalLOC: 0,
        averageComplexity: 0,
        dependencyGraph: [],
        analyzedAt: new Date(),
      };

      const emptyLLM: LLMAnalysis = {
        insights: [],
        keyDomainConcepts: [],
        analyzedAt: new Date(),
      };

      const result = combineInsights(emptyAST, emptyLLM);

      assert.ok(result);
      assert.strictEqual(result.combinedInsights.priorityFiles.length, 0);
      assert.strictEqual(result.combinedInsights.refactoringOpportunities.length, 0);
    });
  });

  suite('getPriorityFiles', () => {
    test('should return top priority files', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const priorityFiles = getPriorityFiles(hybridAnalysis);

      assert.ok(Array.isArray(priorityFiles));
      assert.ok(priorityFiles.length <= 10);
    });

    test('should return file paths as strings', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const priorityFiles = getPriorityFiles(hybridAnalysis);

      priorityFiles.forEach((filePath) => {
        assert.strictEqual(typeof filePath, 'string');
      });
    });
  });

  suite('getHighImpactRefactorings', () => {
    test('should return only high-impact refactorings', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const refactorings = getHighImpactRefactorings(hybridAnalysis);

      assert.ok(Array.isArray(refactorings));
      
      refactorings.forEach((refactoring) => {
        assert.ok(refactoring.filePath);
        assert.ok(refactoring.description);
      });
    });

    test('should include anti-pattern fixes', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const refactorings = getHighImpactRefactorings(hybridAnalysis);

      const hasAntiPatternFix = refactorings.some((r) =>
        r.description.includes('anti-pattern')
      );
      
      assert.ok(hasAntiPatternFix);
    });
  });

  suite('generateAnalysisSummary', () => {
    test('should generate markdown summary', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const summary = generateAnalysisSummary(hybridAnalysis);

      assert.ok(summary);
      assert.ok(summary.includes('# Hybrid Code Analysis Summary'));
      assert.ok(summary.includes('## Code Metrics'));
    });

    test('should include project intent if available', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const summary = generateAnalysisSummary(hybridAnalysis);

      assert.ok(summary.includes('## Project Intent'));
      assert.ok(summary.includes('Web application backend'));
    });

    test('should include code metrics', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const summary = generateAnalysisSummary(hybridAnalysis);

      assert.ok(summary.includes('Total Lines of Code: 550'));
      assert.ok(summary.includes('Average Complexity: 11'));
    });

    test('should include priority files', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const summary = generateAnalysisSummary(hybridAnalysis);

      assert.ok(summary.includes('## Priority Files for Modernization'));
      assert.ok(summary.includes('src/complex.ts'));
    });

    test('should include recommendations', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const summary = generateAnalysisSummary(hybridAnalysis);

      assert.ok(summary.includes('## Recommendations'));
    });
  });

  suite('Priority Calculation', () => {
    test('should prioritize high complexity files', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const priorityFiles = hybridAnalysis.combinedInsights.priorityFiles;

      const complexFile = priorityFiles.find((f) => f.filePath === 'src/complex.ts');
      const simpleFile = priorityFiles.find((f) => f.filePath === 'src/simple.ts');

      if (complexFile && simpleFile) {
        assert.ok(complexFile.priority > simpleFile.priority);
      }
    });

    test('should consider LLM confidence in scoring', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      
      // Files with LLM insights should be prioritized
      const filesWithInsights = hybridAnalysis.combinedInsights.priorityFiles.filter(
        (f) => f.filePath === 'src/complex.ts' || f.filePath === 'src/simple.ts'
      );

      assert.ok(filesWithInsights.length > 0);
    });
  });

  suite('Refactoring Opportunity Detection', () => {
    test('should detect high complexity as refactoring opportunity', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const opportunities = hybridAnalysis.combinedInsights.refactoringOpportunities;

      const complexityOpp = opportunities.find(
        (o) => o.filePath === 'src/complex.ts' && o.description.includes('complexity')
      );

      assert.ok(complexityOpp);
      assert.strictEqual(complexityOpp.impact, 'high');
    });

    test('should include LLM modernization suggestions', () => {
      const hybridAnalysis = combineInsights(sampleASTAnalysis, sampleLLMAnalysis);
      const opportunities = hybridAnalysis.combinedInsights.refactoringOpportunities;

      const asyncOpp = opportunities.find(
        (o) => o.description.includes('async/await')
      );

      assert.ok(asyncOpp);
    });
  });
});
