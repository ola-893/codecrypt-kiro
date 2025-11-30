/**
 * LLM Analysis Service
 * Provides semantic code analysis using Large Language Models
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import * as vscode from 'vscode';
import { LLMAnalysis, LLMInsight, ASTAnalysis, FileASTAnalysis } from '../types';
import { CodeCryptError } from '../utils/errors';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Configuration for LLM client
 */
interface LLMConfig {
  /** API key for Anthropic */
  apiKey: string;
  /** Model to use (default: claude-3-5-sonnet-20241022) */
  model?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * Configuration for Gemini client
 */
interface GeminiConfig {
  /** API key for Google Gemini */
  apiKey: string;
  /** Model to use (default: gemini-pro) */
  model?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * LLM client with retry logic and timeout handling
 */
export class LLMClient {
  private client: Anthropic;
  private config: Required<LLMConfig>;

  constructor(config: LLMConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxTokens: config.maxTokens || 4096,
      timeout: config.timeout || 30000, // 30 seconds
      maxRetries: config.maxRetries || 3,
    };

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });

    logger.info('LLM client initialized', {
      model: this.config.model,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Analyze code with retry logic and exponential backoff
   */
  async analyzeCode(prompt: string, retryCount = 0): Promise<string> {
    try {
      logger.info(`LLM analysis attempt ${retryCount + 1}/${this.config.maxRetries + 1}`);

      const message = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract text content from response
      const textContent = message.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new CodeCryptError('No text content in LLM response');
      }

      return textContent.text;
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = isRetryable && retryCount < this.config.maxRetries;

      if (shouldRetry) {
        const backoffMs = this.calculateBackoff(retryCount);
        logger.warn(`LLM request failed, retrying in ${backoffMs}ms`, error);
        await this.sleep(backoffMs);
        return this.analyzeCode(prompt, retryCount + 1);
      }

      logger.error('LLM analysis failed', error);
      throw new CodeCryptError(
        `LLM analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Anthropic.APIError) {
      // Retry on rate limits, timeouts, and server errors
      return (
        error.status === 429 || // Rate limit
        error.status === 408 || // Request timeout
        error.status === 503 || // Service unavailable
        error.status === 504 || // Gateway timeout
        (error.status >= 500 && error.status < 600) // Server errors
      );
    }
    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    const baseDelay = 1000;
    const maxDelay = 30000; // Cap at 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    // Add jitter to avoid thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Sleep utility for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Gemini LLM client with retry logic and timeout handling
 */
export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private config: Required<GeminiConfig>;

  constructor(config: GeminiConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gemini-pro',
      timeout: config.timeout || 30000, // 30 seconds
      maxRetries: config.maxRetries || 3,
    };

    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.config.model });

    logger.info('Gemini client initialized', {
      model: this.config.model,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Analyze code with retry logic and exponential backoff
   */
  async analyzeCode(prompt: string, retryCount = 0): Promise<string> {
    try {
      logger.info(`Gemini analysis attempt ${retryCount + 1}/${this.config.maxRetries + 1}`);

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.config.timeout);
      });

      // Race between the API call and timeout
      const result = await Promise.race([
        this.model.generateContent(prompt),
        timeoutPromise,
      ]);

      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new CodeCryptError('No text content in Gemini response');
      }

      return text;
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = isRetryable && retryCount < this.config.maxRetries;

      if (shouldRetry) {
        const backoffMs = this.calculateBackoff(retryCount);
        logger.warn(`Gemini request failed, retrying in ${backoffMs}ms`, error);
        await this.sleep(backoffMs);
        return this.analyzeCode(prompt, retryCount + 1);
      }

      logger.error('Gemini analysis failed', error);
      throw new CodeCryptError(
        `Gemini analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Retry on rate limits, timeouts, and server errors
      return (
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('503') ||
        message.includes('504') ||
        message.includes('500') ||
        message.includes('502')
      );
    }
    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    const baseDelay = 1000;
    const maxDelay = 30000; // Cap at 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    // Add jitter to avoid thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Sleep utility for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create LLM client from VS Code configuration
 */
export async function createLLMClient(context: vscode.ExtensionContext): Promise<LLMClient | GeminiClient> {
  const { SecureConfigManager } = await import('./secureConfig.js');
  const configManager = new SecureConfigManager(context);

  // Get LLM provider from configuration (default to anthropic for backward compatibility)
  const config = vscode.workspace.getConfiguration('codecrypt');
  const provider = config.get<string>('llmProvider', 'anthropic');

  logger.info(`Creating LLM client for provider: ${provider}`);

  if (provider === 'gemini') {
    // Try to get Gemini API key from secure storage
    const apiKey = await configManager.getGeminiApiKey();

    if (!apiKey) {
      // Prompt user to configure API key
      const configuredKey = await configManager.promptAndStoreGeminiApiKey();
      if (!configuredKey) {
        throw new CodeCryptError(
          'Gemini API key not configured. LLM analysis will be skipped.'
        );
      }
      return new GeminiClient({ apiKey: configuredKey });
    }

    return new GeminiClient({ apiKey });
  } else {
    // Default to Anthropic
    // Try to get API key from secure storage
    const apiKey = await configManager.getAnthropicApiKey();

    if (!apiKey) {
      // Prompt user to configure API key
      const configuredKey = await configManager.promptAndStoreAnthropicApiKey();
      if (!configuredKey) {
        throw new CodeCryptError(
          'Anthropic API key not configured. LLM analysis will be skipped.'
        );
      }
      return new LLMClient({ apiKey: configuredKey });
    }

    return new LLMClient({ apiKey });
  }
}

/**
 * Analyze a single file for semantic insights
 */
export async function analyzeFile(
  client: LLMClient | GeminiClient,
  fileContent: string,
  filePath: string,
  astAnalysis?: FileASTAnalysis
): Promise<LLMInsight> {
  logger.info(`Analyzing file with LLM: ${filePath}`);

  // Build context from AST if available
  const astContext = astAnalysis
    ? `
AST Analysis Context:
- Lines of Code: ${astAnalysis.linesOfCode}
- Cyclomatic Complexity: ${astAnalysis.complexity.cyclomatic}
- Functions: ${astAnalysis.structure.functions.map((f) => f.name).join(', ')}
- Classes: ${astAnalysis.structure.classes.map((c) => c.name).join(', ')}
`
    : '';

  const prompt = `You are a code archaeologist analyzing legacy JavaScript/TypeScript code for modernization.

File: ${filePath}
${astContext}

Code:
\`\`\`
${fileContent}
\`\`\`

Analyze this code and provide semantic insights in JSON format:

{
  "developerIntent": "Brief description of what this code is trying to accomplish",
  "domainConcepts": ["business domain concepts", "technical domains"],
  "idiomaticPatterns": ["good patterns used", "modern practices"],
  "antiPatterns": ["code smells", "outdated patterns", "potential issues"],
  "modernizationSuggestions": ["specific actionable improvements"],
  "confidence": 0.85
}

Analysis Guidelines:
1. Developer Intent: Infer the purpose from function names, comments, and logic flow
2. Domain Concepts: Identify business logic, data models, and technical domains (e.g., "authentication", "data validation", "API client")
3. Idiomatic Patterns: Recognize modern JavaScript/TypeScript patterns (async/await, destructuring, arrow functions, etc.)
4. Anti-Patterns: Spot callback hell, global state, missing error handling, outdated APIs, etc.
5. Modernization: Suggest concrete improvements like:
   - Replace callbacks with async/await
   - Use ES6+ features (const/let, template literals, spread operator)
   - Add TypeScript types
   - Improve error handling
   - Use modern APIs (fetch instead of XMLHttpRequest)

Respond with ONLY valid JSON, no markdown formatting or additional text.`;

  try {
    const response = await client.analyzeCode(prompt);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      filePath,
      developerIntent: parsed.developerIntent || 'Unknown',
      domainConcepts: parsed.domainConcepts || [],
      idiomaticPatterns: parsed.idiomaticPatterns || [],
      antiPatterns: parsed.antiPatterns || [],
      modernizationSuggestions: parsed.modernizationSuggestions || [],
      confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    logger.error(`Failed to parse LLM response for ${filePath}`, error);
    // Return a low-confidence fallback insight
    return {
      filePath,
      developerIntent: 'Unable to analyze',
      domainConcepts: [],
      idiomaticPatterns: [],
      antiPatterns: [],
      modernizationSuggestions: [],
      confidence: 0,
    };
  }
}

/**
 * Analyze project intent from README and package.json
 */
async function analyzeProjectIntent(
  client: LLMClient | GeminiClient,
  repoPath: string
): Promise<{ intent?: string; strategy?: string }> {
  const fs = require('fs');
  const path = require('path');

  try {
    // Try to read README
    let readmeContent = '';
    const readmePaths = ['README.md', 'README.txt', 'README'];
    for (const readmePath of readmePaths) {
      const fullPath = path.join(repoPath, readmePath);
      if (fs.existsSync(fullPath)) {
        readmeContent = fs.readFileSync(fullPath, 'utf-8').slice(0, 2000); // First 2000 chars
        break;
      }
    }

    // Try to read package.json
    let packageInfo = '';
    const packagePath = path.join(repoPath, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      packageInfo = `Name: ${pkg.name}\nDescription: ${pkg.description || 'N/A'}\nVersion: ${pkg.version || 'N/A'}`;
    }

    if (!readmeContent && !packageInfo) {
      return {};
    }

    const prompt = `Analyze this project and provide high-level insights.

${packageInfo ? `Package Info:\n${packageInfo}\n` : ''}
${readmeContent ? `README:\n${readmeContent}` : ''}

Provide a JSON response:
{
  "projectIntent": "What is the overall purpose of this project?",
  "modernizationStrategy": "High-level strategy for modernizing this codebase"
}

Focus on:
1. Understanding the project's main purpose and target use case
2. Identifying the technology stack and architecture
3. Suggesting a high-level modernization approach

Respond with ONLY valid JSON.`;

    const response = await client.analyzeCode(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {};
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      intent: parsed.projectIntent,
      strategy: parsed.modernizationStrategy,
    };
  } catch (error) {
    logger.error('Failed to analyze project intent', error);
    return {};
  }
}

/**
 * Analyze entire repository for semantic insights
 */
export async function analyzeRepository(
  client: LLMClient | GeminiClient,
  repoPath: string,
  astAnalysis: ASTAnalysis,
  progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<LLMAnalysis> {
  logger.info('Starting LLM repository analysis', { repoPath, fileCount: astAnalysis.files.length });

  const insights: LLMInsight[] = [];
  const fs = require('fs');
  const path = require('path');

  // First, analyze project intent
  progress?.report({ message: 'Analyzing project intent...', increment: 5 });
  const projectAnalysis = await analyzeProjectIntent(client, repoPath);

  // Analyze each file (limit to important files to save API calls)
  const filesToAnalyze = astAnalysis.files
    .filter((file) => {
      // Skip test files and very small files
      return !file.filePath.includes('.test.') && file.linesOfCode > 10;
    })
    .sort((a, b) => b.complexity.cyclomatic - a.complexity.cyclomatic) // Prioritize complex files
    .slice(0, 10); // Limit to 10 most important files

  const totalFiles = filesToAnalyze.length;
  const incrementPerFile = 90 / totalFiles; // Reserve 5% for project analysis, 5% for summary

  for (let i = 0; i < totalFiles; i++) {
    const fileAnalysis = filesToAnalyze[i];
    const fullPath = path.join(repoPath, fileAnalysis.filePath);

    try {
      progress?.report({
        message: `Analyzing ${fileAnalysis.filePath} with LLM (${i + 1}/${totalFiles})`,
        increment: incrementPerFile,
      });

      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const insight = await analyzeFile(client, fileContent, fileAnalysis.filePath, fileAnalysis);
      insights.push(insight);
    } catch (error) {
      logger.error(`Failed to analyze file ${fileAnalysis.filePath}`, error);
      // Continue with other files
    }
  }

  // Extract key domain concepts across all insights
  progress?.report({ message: 'Extracting key domain concepts...', increment: 5 });
  const allDomainConcepts = insights.flatMap((i) => i.domainConcepts);
  const conceptCounts = new Map<string, number>();
  allDomainConcepts.forEach((concept) => {
    conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
  });

  const keyDomainConcepts = Array.from(conceptCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([concept]) => concept);

  logger.info('LLM repository analysis complete', {
    insightsCount: insights.length,
    keyDomainConcepts,
    projectIntent: projectAnalysis.intent,
  });

  return {
    insights,
    projectIntent: projectAnalysis.intent,
    keyDomainConcepts,
    modernizationStrategy: projectAnalysis.strategy,
    analyzedAt: new Date(),
  };
}
