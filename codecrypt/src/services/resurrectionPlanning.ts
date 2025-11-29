/**
 * Resurrection Planning Service
 * Generates ordered plans for dependency updates and code transformations
 */

import { DependencyInfo, DependencyReport, ASTAnalysis, HybridAnalysis } from '../types';
import { getLogger } from '../utils/logger';
import { calculateRepositoryComplexity, detectCodeSmells, detectAntiPatterns } from './astAnalysis';

const logger = getLogger();

/**
 * Resurrection plan item representing a single update operation
 */
export interface ResurrectionPlanItem {
  /** Package name to update */
  packageName: string;
  /** Current version */
  currentVersion: string;
  /** Target version to update to */
  targetVersion: string;
  /** Priority level (higher = more important) */
  priority: number;
  /** Reason for the update */
  reason: string;
  /** Whether this update fixes security vulnerabilities */
  fixesVulnerabilities: boolean;
  /** Number of vulnerabilities fixed */
  vulnerabilityCount: number;
}

/**
 * Complete resurrection plan
 */
export interface ResurrectionPlan {
  /** Ordered list of updates to perform */
  items: ResurrectionPlanItem[];
  /** Total number of updates */
  totalUpdates: number;
  /** Number of security patches */
  securityPatches: number;
  /** Strategy used for planning */
  strategy: 'conservative' | 'moderate' | 'aggressive';
  /** Timestamp when plan was generated */
  generatedAt: Date;
  /** Priority files identified from AST analysis */
  priorityFiles?: string[];
  /** Refactoring opportunities from hybrid analysis */
  refactoringOpportunities?: Array<{ filePath: string; description: string; impact: string }>;
  /** Structural insights from AST */
  structuralInsights?: {
    highComplexityFiles: Array<{ file: string; complexity: number }>;
    codeSmells: number;
    antiPatterns: number;
  };
}

/**
 * Calculate priority for a dependency update
 * Higher priority = should be updated first
 */
function calculatePriority(dependency: DependencyInfo): number {
  let priority = 0;
  
  // Security vulnerabilities get highest priority
  if (dependency.vulnerabilities.length > 0) {
    priority += 1000;
    
    // Add extra priority based on severity
    for (const vuln of dependency.vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          priority += 100;
          break;
        case 'high':
          priority += 50;
          break;
        case 'moderate':
          priority += 20;
          break;
        case 'low':
          priority += 5;
          break;
      }
    }
  }
  
  // Outdated packages get base priority
  if (dependency.latestVersion !== 'unknown' && 
      dependency.currentVersion !== dependency.latestVersion) {
    priority += 10;
  }
  
  return priority;
}

/**
 * Generate reason string for an update
 */
function generateUpdateReason(dependency: DependencyInfo): string {
  const reasons: string[] = [];
  
  if (dependency.vulnerabilities.length > 0) {
    const criticalCount = dependency.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = dependency.vulnerabilities.filter(v => v.severity === 'high').length;
    
    if (criticalCount > 0) {
      reasons.push(`${criticalCount} critical vulnerabilit${criticalCount === 1 ? 'y' : 'ies'}`);
    }
    if (highCount > 0) {
      reasons.push(`${highCount} high vulnerabilit${highCount === 1 ? 'y' : 'ies'}`);
    }
    if (criticalCount === 0 && highCount === 0) {
      reasons.push(`${dependency.vulnerabilities.length} vulnerabilit${dependency.vulnerabilities.length === 1 ? 'y' : 'ies'}`);
    }
  }
  
  if (dependency.latestVersion !== 'unknown' && 
      dependency.currentVersion !== dependency.latestVersion) {
    reasons.push('outdated version');
  }
  
  return reasons.length > 0 ? reasons.join(', ') : 'update available';
}

/**
 * Generate a resurrection plan from dependency analysis
 * Uses "moderate" strategy: update all packages to latest stable, prioritizing security
 * 
 * @param dependencyReport The dependency analysis report
 * @param astAnalysis Optional AST analysis for structural insights
 * @returns ResurrectionPlan with ordered list of updates
 */
export function generateResurrectionPlan(
  dependencyReport: DependencyReport,
  astAnalysis?: ASTAnalysis
): ResurrectionPlan {
  logger.info('Generating resurrection plan with moderate strategy');
  
  const planItems: ResurrectionPlanItem[] = [];
  
  // Process each dependency
  for (const dependency of dependencyReport.dependencies) {
    // Skip if already up to date or version is unknown
    if (dependency.latestVersion === 'unknown') {
      logger.info(`Skipping ${dependency.name}: version unknown`);
      continue;
    }
    
    if (dependency.currentVersion === dependency.latestVersion && 
        dependency.vulnerabilities.length === 0) {
      logger.info(`Skipping ${dependency.name}: already up to date`);
      continue;
    }
    
    // Calculate priority
    let priority = calculatePriority(dependency);
    
    // Boost priority if AST analysis shows high complexity
    if (astAnalysis) {
      const complexityMetrics = calculateRepositoryComplexity(astAnalysis);
      if (complexityMetrics.averageComplexity > 15) {
        // High complexity codebases need more careful updates
        priority += 5;
        logger.info(`Boosted priority for ${dependency.name} due to high codebase complexity`);
      }
    }
    
    // Generate reason
    const reason = generateUpdateReason(dependency);
    
    // Create plan item
    const item: ResurrectionPlanItem = {
      packageName: dependency.name,
      currentVersion: dependency.currentVersion,
      targetVersion: dependency.latestVersion,
      priority,
      reason,
      fixesVulnerabilities: dependency.vulnerabilities.length > 0,
      vulnerabilityCount: dependency.vulnerabilities.length
    };
    
    planItems.push(item);
    
    logger.info(
      `Added to plan: ${item.packageName} ${item.currentVersion} → ${item.targetVersion} ` +
      `(priority: ${item.priority}, reason: ${item.reason})`
    );
  }
  
  // Sort by priority (highest first)
  planItems.sort((a, b) => b.priority - a.priority);
  
  // Count security patches
  const securityPatches = planItems.filter(item => item.fixesVulnerabilities).length;
  
  const plan: ResurrectionPlan = {
    items: planItems,
    totalUpdates: planItems.length,
    securityPatches,
    strategy: 'moderate',
    generatedAt: new Date()
  };
  
  // Add structural insights from AST analysis
  if (astAnalysis) {
    const complexityMetrics = calculateRepositoryComplexity(astAnalysis);
    const codeSmells = astAnalysis.files.flatMap(file => detectCodeSmells(file));
    const antiPatterns = detectAntiPatterns(astAnalysis);
    
    plan.structuralInsights = {
      highComplexityFiles: complexityMetrics.highComplexityFiles.slice(0, 5),
      codeSmells: codeSmells.length,
      antiPatterns: antiPatterns.length
    };
    
    logger.info('Added structural insights to plan:');
    logger.info(`  High complexity files: ${plan.structuralInsights.highComplexityFiles.length}`);
    logger.info(`  Code smells: ${plan.structuralInsights.codeSmells}`);
    logger.info(`  Anti-patterns: ${plan.structuralInsights.antiPatterns}`);
  }
  
  logger.info('Resurrection plan generated:');
  logger.info(`  Total updates: ${plan.totalUpdates}`);
  logger.info(`  Security patches: ${plan.securityPatches}`);
  logger.info(`  Strategy: ${plan.strategy}`);
  
  if (plan.securityPatches > 0) {
    logger.info(`  First ${Math.min(3, plan.securityPatches)} security updates:`);
    plan.items
      .filter(item => item.fixesVulnerabilities)
      .slice(0, 3)
      .forEach(item => {
        logger.info(`    - ${item.packageName}: ${item.vulnerabilityCount} vulnerabilities`);
      });
  }
  
  return plan;
}

/**
 * Generate an enhanced resurrection plan using hybrid analysis
 * Combines dependency analysis with AST and LLM insights
 * 
 * @param dependencyReport The dependency analysis report
 * @param hybridAnalysis Hybrid analysis combining AST and LLM insights
 * @returns Enhanced ResurrectionPlan with priority files and refactoring opportunities
 */
export function generateEnhancedResurrectionPlan(
  dependencyReport: DependencyReport,
  hybridAnalysis: HybridAnalysis
): ResurrectionPlan {
  logger.info('Generating enhanced resurrection plan with hybrid analysis');
  
  // Start with base plan using AST analysis
  const plan = generateResurrectionPlan(dependencyReport, hybridAnalysis.astAnalysis);
  
  // Add priority files from hybrid analysis
  plan.priorityFiles = hybridAnalysis.combinedInsights.priorityFiles
    .slice(0, 10)
    .map(f => f.filePath);
  
  // Add refactoring opportunities
  plan.refactoringOpportunities = hybridAnalysis.combinedInsights.refactoringOpportunities
    .filter(r => r.impact === 'high' || r.impact === 'medium')
    .slice(0, 15)
    .map(r => ({
      filePath: r.filePath,
      description: r.description,
      impact: r.impact
    }));
  
  logger.info('Enhanced plan with hybrid analysis:');
  logger.info(`  Priority files: ${plan.priorityFiles.length}`);
  logger.info(`  Refactoring opportunities: ${plan.refactoringOpportunities.length}`);
  
  if (plan.priorityFiles.length > 0) {
    logger.info('  Top priority files:');
    plan.priorityFiles.slice(0, 3).forEach(file => {
      logger.info(`    - ${file}`);
    });
  }
  
  return plan;
}

/**
 * Prioritize updates based on complexity metrics
 * Files with high complexity should be updated more carefully
 * 
 * @param planItems The plan items to prioritize
 * @param astAnalysis AST analysis for complexity metrics
 * @returns Prioritized plan items
 */
export function prioritizeByComplexity(
  planItems: ResurrectionPlanItem[],
  astAnalysis: ASTAnalysis
): ResurrectionPlanItem[] {
  const complexityMetrics = calculateRepositoryComplexity(astAnalysis);
  
  // If average complexity is high, prioritize security updates even more
  if (complexityMetrics.averageComplexity > 15) {
    logger.info('High complexity detected, prioritizing security updates');
    
    return planItems.map(item => {
      if (item.fixesVulnerabilities) {
        return {
          ...item,
          priority: item.priority + 50 // Significant boost for security in complex codebases
        };
      }
      return item;
    }).sort((a, b) => b.priority - a.priority);
  }
  
  return planItems;
}

/**
 * Identify refactoring opportunities from AST analysis
 * These can be addressed during or after dependency updates
 * 
 * @param astAnalysis AST analysis results
 * @returns List of refactoring opportunities
 */
export function identifyRefactoringOpportunities(
  astAnalysis: ASTAnalysis
): Array<{ filePath: string; description: string; priority: number }> {
  const opportunities: Array<{ filePath: string; description: string; priority: number }> = [];
  
  // Identify high complexity files
  const complexityMetrics = calculateRepositoryComplexity(astAnalysis);
  for (const file of complexityMetrics.highComplexityFiles) {
    opportunities.push({
      filePath: file.file,
      description: `Reduce cyclomatic complexity (currently ${file.complexity})`,
      priority: file.complexity
    });
  }
  
  // Identify code smells
  for (const file of astAnalysis.files) {
    const smells = detectCodeSmells(file);
    for (const smell of smells) {
      if (smell.severity === 'high') {
        opportunities.push({
          filePath: file.filePath,
          description: smell.description,
          priority: 100
        });
      } else if (smell.severity === 'medium') {
        opportunities.push({
          filePath: file.filePath,
          description: smell.description,
          priority: 50
        });
      }
    }
  }
  
  // Identify anti-patterns
  const antiPatterns = detectAntiPatterns(astAnalysis);
  for (const pattern of antiPatterns) {
    for (const file of pattern.affectedFiles) {
      opportunities.push({
        filePath: file,
        description: `Fix ${pattern.type}: ${pattern.description}`,
        priority: 75
      });
    }
  }
  
  // Sort by priority and deduplicate
  const uniqueOpportunities = new Map<string, typeof opportunities[0]>();
  for (const opp of opportunities) {
    const key = `${opp.filePath}:${opp.description}`;
    if (!uniqueOpportunities.has(key) || uniqueOpportunities.get(key)!.priority < opp.priority) {
      uniqueOpportunities.set(key, opp);
    }
  }
  
  return Array.from(uniqueOpportunities.values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20); // Top 20 opportunities
}

/**
 * Generate explanations for planned changes using LLM insights
 * Provides context and rationale for each update
 * 
 * @param planItems The plan items to explain
 * @param hybridAnalysis Hybrid analysis with LLM insights
 * @returns Plan items with enhanced explanations
 */
export function generateChangeExplanations(
  planItems: ResurrectionPlanItem[],
  hybridAnalysis: HybridAnalysis
): Array<ResurrectionPlanItem & { explanation?: string }> {
  logger.info('Generating change explanations using LLM insights');
  
  const llmInsights = hybridAnalysis.llmAnalysis.insights;
  const projectIntent = hybridAnalysis.llmAnalysis.projectIntent;
  
  return planItems.map(item => {
    const explanations: string[] = [];
    
    // Add base reason
    explanations.push(item.reason);
    
    // Add project context if available
    if (projectIntent) {
      explanations.push(`Aligns with project purpose: ${projectIntent.slice(0, 100)}...`);
    }
    
    // Check if any files use this dependency and have LLM insights
    const relevantInsights = llmInsights.filter(insight => 
      insight.modernizationSuggestions.some(suggestion => 
        suggestion.toLowerCase().includes(item.packageName.toLowerCase())
      )
    );
    
    if (relevantInsights.length > 0) {
      const suggestions = relevantInsights
        .flatMap(i => i.modernizationSuggestions)
        .filter(s => s.toLowerCase().includes(item.packageName.toLowerCase()))
        .slice(0, 2);
      
      if (suggestions.length > 0) {
        explanations.push(`LLM suggests: ${suggestions.join('; ')}`);
      }
    }
    
    return {
      ...item,
      explanation: explanations.join('. ')
    };
  });
}

/**
 * Use LLM insights to guide modernization strategy
 * Determines which updates should be prioritized based on semantic understanding
 * 
 * @param hybridAnalysis Hybrid analysis with LLM insights
 * @returns Modernization strategy recommendations
 */
export function generateModernizationStrategy(
  hybridAnalysis: HybridAnalysis
): {
  strategy: string;
  keyFocus: string[];
  riskAreas: string[];
  recommendations: string[];
} {
  logger.info('Generating modernization strategy from LLM insights');
  
  const llmAnalysis = hybridAnalysis.llmAnalysis;
  const astAnalysis = hybridAnalysis.astAnalysis;
  
  // Extract common themes from LLM insights
  const allSuggestions = llmAnalysis.insights.flatMap(i => i.modernizationSuggestions);
  const allAntiPatterns = llmAnalysis.insights.flatMap(i => i.antiPatterns);
  
  // Count suggestion themes
  const suggestionThemes = new Map<string, number>();
  for (const suggestion of allSuggestions) {
    const lower = suggestion.toLowerCase();
    if (lower.includes('async') || lower.includes('promise')) {
      suggestionThemes.set('async-modernization', (suggestionThemes.get('async-modernization') || 0) + 1);
    }
    if (lower.includes('typescript') || lower.includes('type')) {
      suggestionThemes.set('type-safety', (suggestionThemes.get('type-safety') || 0) + 1);
    }
    if (lower.includes('error') || lower.includes('exception')) {
      suggestionThemes.set('error-handling', (suggestionThemes.get('error-handling') || 0) + 1);
    }
    if (lower.includes('es6') || lower.includes('modern')) {
      suggestionThemes.set('modern-syntax', (suggestionThemes.get('modern-syntax') || 0) + 1);
    }
  }
  
  // Identify key focus areas (top 3 themes)
  const keyFocus = Array.from(suggestionThemes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);
  
  // Identify risk areas from anti-patterns
  const riskAreas = Array.from(new Set(allAntiPatterns))
    .slice(0, 5);
  
  // Generate recommendations
  const recommendations = hybridAnalysis.combinedInsights.recommendations;
  
  // Determine overall strategy
  let strategy = llmAnalysis.modernizationStrategy || 'Incremental modernization with focus on stability';
  
  // Adjust strategy based on complexity
  const complexityMetrics = calculateRepositoryComplexity(astAnalysis);
  if (complexityMetrics.averageComplexity > 20) {
    strategy += '. High complexity detected - proceed with extra caution and comprehensive testing.';
  }
  
  logger.info('Modernization strategy generated:');
  logger.info(`  Strategy: ${strategy}`);
  logger.info(`  Key focus areas: ${keyFocus.join(', ')}`);
  logger.info(`  Risk areas: ${riskAreas.length}`);
  
  return {
    strategy,
    keyFocus,
    riskAreas,
    recommendations
  };
}

/**
 * Prioritize updates based on LLM semantic insights
 * Uses understanding of code intent to determine update order
 * 
 * @param planItems The plan items to prioritize
 * @param hybridAnalysis Hybrid analysis with LLM insights
 * @returns Prioritized plan items
 */
export function prioritizeBySemanticInsights(
  planItems: ResurrectionPlanItem[],
  hybridAnalysis: HybridAnalysis
): ResurrectionPlanItem[] {
  logger.info('Prioritizing updates using semantic insights');
  
  const llmInsights = hybridAnalysis.llmAnalysis.insights;
  
  return planItems.map(item => {
    let priorityBoost = 0;
    
    // Check if this package is mentioned in high-confidence insights
    const relevantInsights = llmInsights.filter(insight => {
      const mentionedInSuggestions = insight.modernizationSuggestions.some(s => 
        s.toLowerCase().includes(item.packageName.toLowerCase())
      );
      const mentionedInAntiPatterns = insight.antiPatterns.some(a => 
        a.toLowerCase().includes(item.packageName.toLowerCase())
      );
      return (mentionedInSuggestions || mentionedInAntiPatterns) && insight.confidence > 0.7;
    });
    
    if (relevantInsights.length > 0) {
      // Boost priority based on number of files that mention this package
      priorityBoost += relevantInsights.length * 10;
      
      // Extra boost if mentioned in anti-patterns
      const antiPatternMentions = relevantInsights.filter(i => 
        i.antiPatterns.some(a => a.toLowerCase().includes(item.packageName.toLowerCase()))
      );
      priorityBoost += antiPatternMentions.length * 20;
      
      logger.info(`Boosted priority for ${item.packageName} by ${priorityBoost} based on LLM insights`);
    }
    
    return {
      ...item,
      priority: item.priority + priorityBoost
    };
  }).sort((a, b) => b.priority - a.priority);
}

/**
 * Generate a comprehensive plan summary with LLM insights
 * Provides human-readable explanation of the resurrection plan
 * 
 * @param plan The resurrection plan
 * @param hybridAnalysis Hybrid analysis with LLM insights
 * @returns Markdown-formatted plan summary
 */
export function generatePlanSummary(
  plan: ResurrectionPlan,
  hybridAnalysis: HybridAnalysis
): string {
  const lines: string[] = [];
  
  lines.push('# Resurrection Plan Summary\n');
  lines.push(`**Generated:** ${plan.generatedAt.toISOString()}`);
  lines.push(`**Strategy:** ${plan.strategy}\n`);
  
  // Project context
  if (hybridAnalysis.llmAnalysis.projectIntent) {
    lines.push('## Project Context');
    lines.push(hybridAnalysis.llmAnalysis.projectIntent);
    lines.push('');
  }
  
  // Modernization strategy
  const strategy = generateModernizationStrategy(hybridAnalysis);
  lines.push('## Modernization Strategy');
  lines.push(strategy.strategy);
  lines.push('');
  
  if (strategy.keyFocus.length > 0) {
    lines.push('### Key Focus Areas');
    strategy.keyFocus.forEach(focus => {
      lines.push(`- ${focus}`);
    });
    lines.push('');
  }
  
  // Plan overview
  lines.push('## Plan Overview');
  lines.push(`- **Total Updates:** ${plan.totalUpdates}`);
  lines.push(`- **Security Patches:** ${plan.securityPatches}`);
  
  if (plan.structuralInsights) {
    lines.push(`- **High Complexity Files:** ${plan.structuralInsights.highComplexityFiles.length}`);
    lines.push(`- **Code Smells Detected:** ${plan.structuralInsights.codeSmells}`);
    lines.push(`- **Anti-Patterns Detected:** ${plan.structuralInsights.antiPatterns}`);
  }
  
  if (plan.priorityFiles && plan.priorityFiles.length > 0) {
    lines.push(`- **Priority Files:** ${plan.priorityFiles.length}`);
  }
  
  if (plan.refactoringOpportunities && plan.refactoringOpportunities.length > 0) {
    lines.push(`- **Refactoring Opportunities:** ${plan.refactoringOpportunities.length}`);
  }
  lines.push('');
  
  // Priority updates
  if (plan.securityPatches > 0) {
    lines.push('## Priority Security Updates');
    plan.items
      .filter(item => item.fixesVulnerabilities)
      .slice(0, 5)
      .forEach((item, i) => {
        lines.push(`${i + 1}. **${item.packageName}** ${item.currentVersion} → ${item.targetVersion}`);
        lines.push(`   - ${item.reason}`);
        lines.push(`   - Fixes ${item.vulnerabilityCount} vulnerabilit${item.vulnerabilityCount === 1 ? 'y' : 'ies'}`);
        lines.push('');
      });
  }
  
  // Priority files
  if (plan.priorityFiles && plan.priorityFiles.length > 0) {
    lines.push('## Priority Files for Attention');
    plan.priorityFiles.slice(0, 5).forEach((file, i) => {
      lines.push(`${i + 1}. ${file}`);
    });
    lines.push('');
  }
  
  // Refactoring opportunities
  if (plan.refactoringOpportunities && plan.refactoringOpportunities.length > 0) {
    lines.push('## Key Refactoring Opportunities');
    plan.refactoringOpportunities
      .filter(r => r.impact === 'high')
      .slice(0, 5)
      .forEach((opp, i) => {
        lines.push(`${i + 1}. **${opp.filePath}**`);
        lines.push(`   - ${opp.description}`);
        lines.push('');
      });
  }
  
  // Recommendations
  if (strategy.recommendations.length > 0) {
    lines.push('## Recommendations');
    strategy.recommendations.slice(0, 5).forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push('');
  }
  
  // Risk areas
  if (strategy.riskAreas.length > 0) {
    lines.push('## Risk Areas to Monitor');
    strategy.riskAreas.forEach(risk => {
      lines.push(`- ${risk}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}
