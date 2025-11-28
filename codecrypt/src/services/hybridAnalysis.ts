/**
 * Hybrid Analysis Service
 * Combines AST structural analysis with LLM semantic insights
 */

import { ASTAnalysis, LLMAnalysis, HybridAnalysis, FileASTAnalysis, LLMInsight } from '../types';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Priority score for a file based on complexity and insights
 */
interface FilePriority {
  filePath: string;
  score: number;
  reason: string;
  astAnalysis?: FileASTAnalysis;
  llmInsight?: LLMInsight;
}

/**
 * Combine AST and LLM analyses into a comprehensive hybrid analysis
 */
export function combineInsights(
  astAnalysis: ASTAnalysis,
  llmAnalysis: LLMAnalysis
): HybridAnalysis {
  logger.info('Combining AST and LLM insights');

  // Create a map of file paths to their analyses
  const astMap = new Map<string, FileASTAnalysis>();
  astAnalysis.files.forEach((file) => astMap.set(file.filePath, file));

  const llmMap = new Map<string, LLMInsight>();
  llmAnalysis.insights.forEach((insight) => llmMap.set(insight.filePath, insight));

  // Calculate priority files for modernization
  const priorityFiles = calculatePriorityFiles(astMap, llmMap);

  // Identify refactoring opportunities
  const refactoringOpportunities = identifyRefactoringOpportunities(astMap, llmMap);

  // Generate overall recommendations
  const recommendations = generateRecommendations(
    astAnalysis,
    llmAnalysis,
    priorityFiles,
    refactoringOpportunities
  );

  logger.info('Hybrid analysis complete', {
    priorityFilesCount: priorityFiles.length,
    refactoringOpportunitiesCount: refactoringOpportunities.length,
    recommendationsCount: recommendations.length,
  });

  return {
    astAnalysis,
    llmAnalysis,
    combinedInsights: {
      priorityFiles,
      refactoringOpportunities,
      recommendations,
    },
    analyzedAt: new Date(),
  };
}

/**
 * Calculate priority files based on complexity, anti-patterns, and modernization potential
 */
function calculatePriorityFiles(
  astMap: Map<string, FileASTAnalysis>,
  llmMap: Map<string, LLMInsight>
): Array<{ filePath: string; reason: string; priority: number }> {
  const priorities: FilePriority[] = [];

  // Combine all file paths
  const allFiles = new Set([...astMap.keys(), ...llmMap.keys()]);

  for (const filePath of allFiles) {
    const ast = astMap.get(filePath);
    const llm = llmMap.get(filePath);

    let score = 0;
    const reasons: string[] = [];

    // AST-based scoring
    if (ast) {
      // High complexity files need attention
      if (ast.complexity.cyclomatic > 10) {
        score += ast.complexity.cyclomatic * 2;
        reasons.push(`High complexity (${ast.complexity.cyclomatic})`);
      }

      // Large files might need refactoring
      if (ast.linesOfCode > 300) {
        score += Math.floor(ast.linesOfCode / 100);
        reasons.push(`Large file (${ast.linesOfCode} LOC)`);
      }

      // Files with many functions might benefit from modularization
      if (ast.structure.functions.length > 10) {
        score += ast.structure.functions.length;
        reasons.push(`Many functions (${ast.structure.functions.length})`);
      }
    }

    // LLM-based scoring
    if (llm) {
      // Anti-patterns are high priority
      score += llm.antiPatterns.length * 10;
      if (llm.antiPatterns.length > 0) {
        reasons.push(`Anti-patterns: ${llm.antiPatterns.join(', ')}`);
      }

      // Modernization suggestions indicate improvement potential
      score += llm.modernizationSuggestions.length * 5;
      if (llm.modernizationSuggestions.length > 0) {
        reasons.push(`${llm.modernizationSuggestions.length} modernization opportunities`);
      }

      // Weight by confidence
      score *= llm.confidence;
    }

    if (score > 0) {
      priorities.push({
        filePath,
        score,
        reason: reasons.join('; '),
        astAnalysis: ast,
        llmInsight: llm,
      });
    }
  }

  // Sort by score and return top priorities
  return priorities
    .sort((a, b) => b.score - a.score)
    .slice(0, 20) // Top 20 priority files
    .map((p) => ({
      filePath: p.filePath,
      reason: p.reason,
      priority: Math.round(p.score),
    }));
}

/**
 * Identify specific refactoring opportunities by combining AST and LLM insights
 */
function identifyRefactoringOpportunities(
  astMap: Map<string, FileASTAnalysis>,
  llmMap: Map<string, LLMInsight>
): Array<{ filePath: string; description: string; impact: 'low' | 'medium' | 'high' }> {
  const opportunities: Array<{
    filePath: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
  }> = [];

  for (const [filePath, ast] of astMap) {
    const llm = llmMap.get(filePath);

    // High complexity functions should be refactored
    if (ast.complexity.cyclomatic > 15) {
      opportunities.push({
        filePath,
        description: `Reduce cyclomatic complexity (currently ${ast.complexity.cyclomatic})`,
        impact: 'high',
      });
    }

    // Large classes might need splitting
    const largeClasses = ast.structure.classes.filter((c) => c.methods.length > 10);
    if (largeClasses.length > 0) {
      opportunities.push({
        filePath,
        description: `Split large classes: ${largeClasses.map((c) => c.name).join(', ')}`,
        impact: 'medium',
      });
    }

    // Combine with LLM insights
    if (llm) {
      // Anti-patterns are refactoring opportunities
      llm.antiPatterns.forEach((antiPattern) => {
        opportunities.push({
          filePath,
          description: `Fix anti-pattern: ${antiPattern}`,
          impact: 'high',
        });
      });

      // Modernization suggestions
      llm.modernizationSuggestions.forEach((suggestion) => {
        // Determine impact based on keywords
        let impact: 'low' | 'medium' | 'high' = 'medium';
        if (
          suggestion.toLowerCase().includes('async') ||
          suggestion.toLowerCase().includes('promise') ||
          suggestion.toLowerCase().includes('error handling')
        ) {
          impact = 'high';
        } else if (
          suggestion.toLowerCase().includes('const') ||
          suggestion.toLowerCase().includes('let') ||
          suggestion.toLowerCase().includes('arrow function')
        ) {
          impact = 'low';
        }

        opportunities.push({
          filePath,
          description: suggestion,
          impact,
        });
      });
    }
  }

  // Sort by impact and return
  const impactOrder = { high: 3, medium: 2, low: 1 };
  return opportunities
    .sort((a, b) => impactOrder[b.impact] - impactOrder[a.impact])
    .slice(0, 30); // Top 30 opportunities
}

/**
 * Generate overall recommendations for the modernization process
 */
function generateRecommendations(
  astAnalysis: ASTAnalysis,
  llmAnalysis: LLMAnalysis,
  priorityFiles: Array<{ filePath: string; reason: string; priority: number }>,
  refactoringOpportunities: Array<{
    filePath: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
  }>
): string[] {
  const recommendations: string[] = [];

  // Overall code quality assessment
  if (astAnalysis.averageComplexity > 10) {
    recommendations.push(
      `High average complexity (${astAnalysis.averageComplexity.toFixed(1)}). Focus on simplifying complex functions.`
    );
  }

  // Size-based recommendations
  if (astAnalysis.totalLOC > 10000) {
    recommendations.push(
      `Large codebase (${astAnalysis.totalLOC} LOC). Consider modularization and splitting into smaller packages.`
    );
  }

  // Domain-specific recommendations
  if (llmAnalysis.keyDomainConcepts.length > 0) {
    recommendations.push(
      `Key domain concepts identified: ${llmAnalysis.keyDomainConcepts.slice(0, 5).join(', ')}. Ensure these are well-encapsulated.`
    );
  }

  // Project intent-based recommendations
  if (llmAnalysis.projectIntent) {
    recommendations.push(
      `Project purpose: ${llmAnalysis.projectIntent}. Align modernization with this core purpose.`
    );
  }

  // Modernization strategy
  if (llmAnalysis.modernizationStrategy) {
    recommendations.push(`Strategy: ${llmAnalysis.modernizationStrategy}`);
  }

  // Priority-based recommendations
  if (priorityFiles.length > 0) {
    const topFile = priorityFiles[0];
    recommendations.push(
      `Start with high-priority file: ${topFile.filePath} (${topFile.reason})`
    );
  }

  // Refactoring-based recommendations
  const highImpactRefactorings = refactoringOpportunities.filter((r) => r.impact === 'high');
  if (highImpactRefactorings.length > 0) {
    recommendations.push(
      `${highImpactRefactorings.length} high-impact refactoring opportunities identified. Address these first.`
    );
  }

  // Common patterns across files
  const allAntiPatterns = llmAnalysis.insights.flatMap((i) => i.antiPatterns);
  const antiPatternCounts = new Map<string, number>();
  allAntiPatterns.forEach((pattern) => {
    antiPatternCounts.set(pattern, (antiPatternCounts.get(pattern) || 0) + 1);
  });

  const commonAntiPatterns = Array.from(antiPatternCounts.entries())
    .filter(([_, count]) => count > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (commonAntiPatterns.length > 0) {
    recommendations.push(
      `Common anti-patterns across codebase: ${commonAntiPatterns.map(([pattern, count]) => `${pattern} (${count} files)`).join(', ')}`
    );
  }

  // Dependency graph insights
  if (astAnalysis.dependencyGraph.length > 50) {
    recommendations.push(
      `Complex dependency graph (${astAnalysis.dependencyGraph.length} dependencies). Consider reducing coupling.`
    );
  }

  return recommendations;
}

/**
 * Get files that should be prioritized for modernization
 */
export function getPriorityFiles(hybridAnalysis: HybridAnalysis): string[] {
  return hybridAnalysis.combinedInsights.priorityFiles
    .slice(0, 10)
    .map((f) => f.filePath);
}

/**
 * Get high-impact refactoring opportunities
 */
export function getHighImpactRefactorings(hybridAnalysis: HybridAnalysis): Array<{
  filePath: string;
  description: string;
}> {
  return hybridAnalysis.combinedInsights.refactoringOpportunities
    .filter((r) => r.impact === 'high')
    .map((r) => ({
      filePath: r.filePath,
      description: r.description,
    }));
}

/**
 * Generate a summary report of the hybrid analysis
 */
export function generateAnalysisSummary(hybridAnalysis: HybridAnalysis): string {
  const { astAnalysis, llmAnalysis, combinedInsights } = hybridAnalysis;

  const lines: string[] = [];
  lines.push('# Hybrid Code Analysis Summary\n');

  // Project overview
  if (llmAnalysis.projectIntent) {
    lines.push(`## Project Intent\n${llmAnalysis.projectIntent}\n`);
  }

  // Code metrics
  lines.push('## Code Metrics');
  lines.push(`- Total Lines of Code: ${astAnalysis.totalLOC}`);
  lines.push(`- Average Complexity: ${astAnalysis.averageComplexity.toFixed(1)}`);
  lines.push(`- Files Analyzed: ${astAnalysis.files.length}`);
  lines.push(`- Dependencies: ${astAnalysis.dependencyGraph.length}\n`);

  // Domain concepts
  if (llmAnalysis.keyDomainConcepts.length > 0) {
    lines.push('## Key Domain Concepts');
    llmAnalysis.keyDomainConcepts.forEach((concept) => {
      lines.push(`- ${concept}`);
    });
    lines.push('');
  }

  // Priority files
  if (combinedInsights.priorityFiles.length > 0) {
    lines.push('## Priority Files for Modernization');
    combinedInsights.priorityFiles.slice(0, 5).forEach((file, i) => {
      lines.push(`${i + 1}. **${file.filePath}** (Priority: ${file.priority})`);
      lines.push(`   ${file.reason}\n`);
    });
  }

  // Refactoring opportunities
  const highImpact = combinedInsights.refactoringOpportunities.filter((r) => r.impact === 'high');
  if (highImpact.length > 0) {
    lines.push('## High-Impact Refactoring Opportunities');
    highImpact.slice(0, 10).forEach((opp, i) => {
      lines.push(`${i + 1}. **${opp.filePath}**`);
      lines.push(`   ${opp.description}\n`);
    });
  }

  // Recommendations
  if (combinedInsights.recommendations.length > 0) {
    lines.push('## Recommendations');
    combinedInsights.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
