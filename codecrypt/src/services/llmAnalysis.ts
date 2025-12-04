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
  /** Model to use (default: gemini-3.0-pro) */
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
      model: config.model || 'gemini-3.0-pro', // Default to gemini-3.0-pro
      timeout: config.timeout || 60000, // 60 seconds (increased for safety)
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
    const startTime = Date.now();
    try {
      logger.info(`Gemini analysis attempt ${retryCount + 1}/${this.config.maxRetries + 1}`);
      logger.debug(`Prompt length: ${prompt.length} characters`);

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const elapsed = Date.now() - startTime;
          logger.warn(`Gemini request timeout after ${elapsed}ms (configured: ${this.config.timeout}ms)`);
          reject(new Error(`Request timeout after ${elapsed}ms`));
        }, this.config.timeout);
      });

      // Race between the API call and timeout
      logger.debug('Starting Gemini API call...');
      const result = await Promise.race([
        this.model.generateContent(prompt),
        timeoutPromise,
      ]);

      const elapsed = Date.now() - startTime;
      logger.info(`Gemini API call completed in ${elapsed}ms`);

      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new CodeCryptError('No text content in Gemini response');
      }

      logger.debug(`Gemini response length: ${text.length} characters`);
      return text;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      
      // Check for network/fetch errors specifically
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isFetchError = errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED');
      
      if (isFetchError) {
        logger.error(`Gemini network error after ${elapsed}ms - this may be due to VS Code extension host network restrictions`, error);
        logger.warn('Consider using Anthropic provider or implementing a proxy service');
        // Don't retry network errors - they won't succeed
        throw new CodeCryptError(
          `Gemini network error (VS Code extension host may block external requests): ${errorMessage}`
        );
      }
      
      logger.error(`Gemini request failed after ${elapsed}ms`, error);
      
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = isRetryable && retryCount < this.config.maxRetries;

      if (shouldRetry) {
        const backoffMs = this.calculateBackoff(retryCount);
        logger.warn(`Gemini request failed, retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${this.config.maxRetries})`, error);
        await this.sleep(backoffMs);
        return this.analyzeCode(prompt, retryCount + 1);
      }

      logger.error(`Gemini analysis failed after ${retryCount + 1} attempts`, error);
      throw new CodeCryptError(
        `Gemini analysis failed: ${errorMessage}`
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
  const geminiModel = config.get<string>('geminiModel', 'gemini-3.0-pro'); // Support custom Gemini model

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
      logger.info(`Using Gemini model: ${geminiModel}`);
      return new GeminiClient({ apiKey: configuredKey, model: geminiModel });
    }

    logger.info(`Using Gemini model: ${geminiModel}`);
    return new GeminiClient({ apiKey, model: geminiModel });
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
 * Sleep utility for backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Analyze a single file with retry logic and adaptive timeout
 * Returns null if all retries fail (doesn't throw)
 */
export async function analyzeFileWithRetry(
  client: LLMClient | GeminiClient,
  fileContent: string,
  filePath: string,
  astAnalysis?: FileASTAnalysis,
  attempt: number = 1
): Promise<LLMInsight | null> {
  const timeout = calculateAdaptiveTimeout(attempt);
  
  try {
    // Task 5.3: Log file being analyzed, attempt number and timeout
    logger.info(`[LLM Analysis] ========================================`);
    logger.info(`[LLM Analysis] Analyzing file: ${filePath}`);
    logger.info(`[LLM Analysis] Attempt: ${attempt}/${MAX_RETRIES}`);
    logger.info(`[LLM Analysis] Timeout: ${timeout}ms`);
    logger.info(`[LLM Analysis] File size: ${fileContent.length} bytes`);
    if (astAnalysis) {
      logger.info(`[LLM Analysis] Lines of code: ${astAnalysis.linesOfCode}`);
      logger.info(`[LLM Analysis] Complexity: ${astAnalysis.complexity.cyclomatic}`);
    }
    logger.info(`[LLM Analysis] ========================================`);
    
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
    });
    
    const startTime = Date.now();
    
    // Race between analysis and timeout
    const result = await Promise.race([
      analyzeFileInternal(client, fileContent, filePath, astAnalysis),
      timeoutPromise
    ]);
    
    const elapsed = Date.now() - startTime;
    logger.info(`[LLM Analysis] ✓ Analysis completed in ${elapsed}ms (confidence: ${result.confidence})`);
    
    return result;
    
  } catch (error) {
    const isTimeout = error instanceof Error && error.message.includes('timeout');
    
    if (isTimeout && attempt < MAX_RETRIES) {
      // Calculate exponential backoff
      const backoff = Math.pow(2, attempt) * 1000;
      
      // Task 5.3: Log retry backoff duration
      logger.warn(`[LLM Analysis] ⚠ Timeout occurred for ${filePath}`);
      logger.warn(`[LLM Analysis] Retry backoff: ${backoff}ms`);
      logger.warn(`[LLM Analysis] Next attempt: ${attempt + 1}/${MAX_RETRIES}`);
      
      await sleep(backoff);
      return analyzeFileWithRetry(client, fileContent, filePath, astAnalysis, attempt + 1);
    }
    
    logger.error(`[LLM Analysis] ✗ Analysis failed for ${filePath} after ${attempt} attempts:`, error);
    return null; // Return null instead of throwing - allow analysis to continue
  }
}

/**
 * Analyze a single file for semantic insights (backward compatible wrapper)
 */
export async function analyzeFile(
  client: LLMClient | GeminiClient,
  fileContent: string,
  filePath: string,
  astAnalysis?: FileASTAnalysis
): Promise<LLMInsight> {
  const result = await analyzeFileWithRetry(client, fileContent, filePath, astAnalysis);
  
  // If retry logic returns null, return a fallback insight
  if (result === null) {
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
  
  return result;
}

/**
 * Internal function to analyze a single file for semantic insights
 */
async function analyzeFileInternal(
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
    logger.info(`Requesting LLM analysis for ${filePath}`);
    const response = await client.analyzeCode(prompt);
    logger.info(`Received LLM response for ${filePath}, length: ${response.length}`);

    // Parse JSON response with better error handling
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn(`No JSON found in LLM response for ${filePath}`);
      logger.debug(`Response preview: ${response.substring(0, 500)}`);
      throw new Error('No JSON found in LLM response');
    }

    logger.debug(`Attempting to parse JSON for ${filePath}, length: ${jsonMatch[0].length}`);
    
    // Try to clean up common JSON issues before parsing
    let jsonStr = jsonMatch[0];
    
    // Log the raw JSON for debugging
    logger.debug(`Raw JSON preview for ${filePath}: ${jsonStr.substring(0, 200)}`);
    
    const parsed = JSON.parse(jsonStr);
    logger.info(`Successfully parsed LLM response for ${filePath}`);

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
    if (error instanceof SyntaxError) {
      logger.error(`JSON parse error details: ${error.message}`);
      logger.error(`Error occurred at position: ${(error as any).position || 'unknown'}`);
    }
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

// Timeout configuration constants
const MAX_RETRIES = 3;
const BASE_TIMEOUT = 30000; // 30 seconds
const MAX_TIMEOUT = 60000; // 60 seconds
const TIMEOUT_THRESHOLD = 3; // consecutive timeouts before skipping remaining files

/**
 * Calculate adaptive timeout based on attempt number
 * Uses exponential backoff: BASE_TIMEOUT * 1.5^(attempt-1)
 * Capped at MAX_TIMEOUT
 */
function calculateAdaptiveTimeout(attempt: number): number {
  const timeout = BASE_TIMEOUT * Math.pow(1.5, attempt - 1);
  return Math.min(timeout, MAX_TIMEOUT);
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
  // Task 5.3: Enhanced repository analysis logging
  logger.info('[LLM Analysis] ========================================');
  logger.info('[LLM Analysis] REPOSITORY ANALYSIS STARTED');
  logger.info('[LLM Analysis] ========================================');
  logger.info(`[LLM Analysis] Repository: ${repoPath}`);
  logger.info(`[LLM Analysis] Total files in AST: ${astAnalysis.files.length}`);

  const insights: LLMInsight[] = [];
  const fs = require('fs');
  const path = require('path');

  // First, analyze project intent
  progress?.report({ message: 'Analyzing project intent...', increment: 5 });
  logger.info('[LLM Analysis] Analyzing project intent...');
  const projectAnalysis = await analyzeProjectIntent(client, repoPath);
  
  if (projectAnalysis.intent) {
    logger.info(`[LLM Analysis] Project intent: ${projectAnalysis.intent.substring(0, 100)}...`);
  }

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
  
  logger.info(`[LLM Analysis] Files to analyze: ${totalFiles} (filtered from ${astAnalysis.files.length})`);
  logger.info('[LLM Analysis] ----------------------------------------');
  
  // Track timeout count for graceful degradation
  let timeoutCount = 0;
  let consecutiveTimeouts = 0;

  for (let i = 0; i < totalFiles; i++) {
    const fileAnalysis = filesToAnalyze[i];
    const fullPath = path.join(repoPath, fileAnalysis.filePath);

    try {
      logger.info(`[LLM Analysis] Processing file ${i + 1}/${totalFiles}: ${fileAnalysis.filePath}`);
      progress?.report({
        message: `Analyzing ${fileAnalysis.filePath} with LLM (${i + 1}/${totalFiles})`,
        increment: incrementPerFile,
      });

      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      logger.debug(`[LLM Analysis] File size: ${fileContent.length} bytes, ${fileAnalysis.linesOfCode} LOC`);
      
      const fileStartTime = Date.now();
      const insight = await analyzeFileWithRetry(client, fileContent, fileAnalysis.filePath, fileAnalysis);
      const fileElapsed = Date.now() - fileStartTime;
      
      // Handle null results (timeouts)
      if (insight === null) {
        timeoutCount++;
        consecutiveTimeouts++;
        
        // Task 5.3: Log timeout count
        logger.warn(`[LLM Analysis] ⚠ Analysis timed out for ${fileAnalysis.filePath}`);
        logger.warn(`[LLM Analysis] Total timeout count: ${timeoutCount}`);
        logger.warn(`[LLM Analysis] Consecutive timeouts: ${consecutiveTimeouts}/${TIMEOUT_THRESHOLD}`);
        
        // Check if we've hit the timeout threshold
        if (consecutiveTimeouts >= TIMEOUT_THRESHOLD) {
          const remainingFiles = totalFiles - i - 1;
          logger.warn(`[LLM Analysis] ========================================`);
          logger.warn(`[LLM Analysis] TIMEOUT THRESHOLD REACHED`);
          logger.warn(`[LLM Analysis] ========================================`);
          logger.warn(`[LLM Analysis] Consecutive timeouts: ${consecutiveTimeouts}`);
          logger.warn(`[LLM Analysis] Skipping remaining ${remainingFiles} files`);
          logger.warn(`[LLM Analysis] Returning partial results`);
          logger.warn(`[LLM Analysis] ========================================`);
          break;
        }
      } else {
        // Reset consecutive timeout count on successful analysis
        consecutiveTimeouts = 0;
        logger.info(`[LLM Analysis] ✓ Completed in ${fileElapsed}ms (confidence: ${insight.confidence})`);
        logger.info(`[LLM Analysis]   - Developer intent: ${insight.developerIntent.substring(0, 60)}...`);
        logger.info(`[LLM Analysis]   - Domain concepts: ${insight.domainConcepts.length}`);
        logger.info(`[LLM Analysis]   - Modernization suggestions: ${insight.modernizationSuggestions.length}`);
        insights.push(insight);
      }
    } catch (error) {
      logger.error(`[LLM Analysis] ✗ Failed to analyze file ${fileAnalysis.filePath}`, error);
      logger.warn(`[LLM Analysis] Continuing with remaining ${totalFiles - i - 1} files`);
      // Continue with other files
    }
  }

  // Extract key domain concepts across all insights
  progress?.report({ message: 'Extracting key domain concepts...', increment: 5 });
  logger.info('[LLM Analysis] Extracting key domain concepts...');
  
  const allDomainConcepts = insights.flatMap((i) => i.domainConcepts);
  const conceptCounts = new Map<string, number>();
  allDomainConcepts.forEach((concept) => {
    conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
  });

  const keyDomainConcepts = Array.from(conceptCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([concept]) => concept);

  // Task 5.3: Log analysis summary (X/Y files)
  const successfulAnalyses = insights.length;
  const failedAnalyses = totalFiles - successfulAnalyses;
  const analysisRate = totalFiles > 0 ? ((successfulAnalyses / totalFiles) * 100).toFixed(1) : '0';
  
  logger.info('[LLM Analysis] ========================================');
  logger.info('[LLM Analysis] REPOSITORY ANALYSIS COMPLETE');
  logger.info('[LLM Analysis] ========================================');
  logger.info(`[LLM Analysis] Files analyzed: ${successfulAnalyses}/${totalFiles} (${analysisRate}%)`);
  logger.info(`[LLM Analysis] Files failed/skipped: ${failedAnalyses}`);
  logger.info(`[LLM Analysis] Total timeouts: ${timeoutCount}`);
  logger.info(`[LLM Analysis] Key domain concepts: ${keyDomainConcepts.length}`);
  
  if (keyDomainConcepts.length > 0) {
    logger.info('[LLM Analysis] Top domain concepts:');
    keyDomainConcepts.slice(0, 5).forEach((concept, idx) => {
      const count = conceptCounts.get(concept) || 0;
      logger.info(`[LLM Analysis]   ${idx + 1}. ${concept} (${count} occurrences)`);
    });
  }
  
  if (projectAnalysis.intent) {
    logger.info(`[LLM Analysis] Project intent: ${projectAnalysis.intent.substring(0, 150)}...`);
  }
  
  if (projectAnalysis.strategy) {
    logger.info(`[LLM Analysis] Modernization strategy: ${projectAnalysis.strategy.substring(0, 150)}...`);
  }
  
  if (failedAnalyses > 0) {
    logger.warn(`[LLM Analysis] ⚠ ${failedAnalyses} files failed to analyze or were skipped`);
  }
  
  if (timeoutCount >= TIMEOUT_THRESHOLD) {
    logger.warn('[LLM Analysis] ⚠ Analysis terminated early due to consecutive timeouts');
    logger.warn('[LLM Analysis] ⚠ Returning partial results');
  }
  
  logger.info('[LLM Analysis] ========================================');

  return {
    insights,
    projectIntent: projectAnalysis.intent,
    keyDomainConcepts,
    modernizationStrategy: projectAnalysis.strategy,
    analyzedAt: new Date(),
  };
}
