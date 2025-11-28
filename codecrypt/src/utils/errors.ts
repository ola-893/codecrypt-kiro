/**
 * Error handling utilities for CodeCrypt
 */

/**
 * Base error class for CodeCrypt operations
 */
export class CodeCryptError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'CodeCryptError';
  }
}

/**
 * Error thrown when repository operations fail
 */
export class RepositoryError extends CodeCryptError {
  constructor(message: string) {
    super(message, 'REPO_ERROR');
    this.name = 'RepositoryError';
  }
}

/**
 * Error thrown when dependency operations fail
 */
export class DependencyError extends CodeCryptError {
  constructor(message: string) {
    super(message, 'DEPENDENCY_ERROR');
    this.name = 'DependencyError';
  }
}

/**
 * Error thrown when network operations fail
 */
export class NetworkError extends CodeCryptError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends CodeCryptError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retry attempts
 * @param delayMs Initial delay in milliseconds
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = delayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new NetworkError(
    `Operation failed after ${maxRetries + 1} attempts: ${lastError?.message}`
  );
}

/**
 * Safely parse JSON with error handling
 * @param jsonString JSON string to parse
 * @param context Context for error message
 * @returns Parsed object
 */
export function safeJsonParse<T = any>(jsonString: string, context: string = 'JSON'): T {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new ValidationError(
      `Failed to parse ${context}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Format error for user display
 * @param error Error to format
 * @returns User-friendly error message
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof CodeCryptError) {
    return `${error.name}: ${error.message}`;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return String(error);
}
