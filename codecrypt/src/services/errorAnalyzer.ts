/**
 * ErrorAnalyzer - Parses compilation errors and categorizes them
 * 
 * This service analyzes compilation output to identify error categories,
 * extract package information, and prioritize errors by likelihood of
 * being the root cause.
 * 
 * **Feature: post-resurrection-validation**
 */

import {
  IErrorAnalyzer,
  PostResurrectionCompilationResult,
  PostResurrectionErrorCategory,
  AnalyzedError,
  PackageInfo,
  FixStrategy,
  POST_RESURRECTION_ERROR_PATTERNS,
  DEFAULT_FIX_STRATEGIES,
  ERROR_CATEGORY_PRIORITIES
} from '../types';

/**
 * Extended error patterns for more precise matching
 * These patterns are used to extract additional information from error messages
 */
const EXTENDED_ERROR_PATTERNS = {
  // Extract package name from "Cannot find module 'package-name'"
  packageFromModuleNotFound: /Cannot find module ['"]([^'"]+)['"]/,
  
  // Extract package and version from ERESOLVE errors
  packageFromEresolve: /(?:Could not resolve dependency|npm ERR! peer dep missing:)\s*(?:peer\s+)?([^\s@]+)@([^\s]+)/,
  
  // Extract conflicting packages from peer dependency errors
  conflictingPackages: /(?:requires|wants)\s+(?:peer\s+)?([^\s@]+)@([^\s]+)/g,
  
  // Extract package from native module failure
  nativeModulePackage: /(?:node-gyp|gyp ERR!|prebuild-install).*?(?:for|in|building)\s+['"]?([^'"@\s,]+)/i,
  
  // Extract package from git dependency failure
  gitDependencyPackage: /(?:git dep preparation failed|Could not resolve git).*?['"]?([^'"@\s]+)/i,
  
  // Extract version constraint from various error formats
  versionConstraint: /@([~^]?\d+(?:\.\d+)*(?:-[a-zA-Z0-9.-]+)?)/,
  
  // Extract peer dependency info
  peerDepInfo: /npm ERR! peer\s+([^\s@]+)@"([^"]+)"\s+from\s+([^\s@]+)@([^\s]+)/,
  
  // Extract package name from "Module 'x' has no exported member"
  moduleExportError: /Module ['"]([^'"]+)['"] has no exported member/
};

/**
 * ErrorAnalyzer class that parses and categorizes compilation errors
 */
export class ErrorAnalyzer implements IErrorAnalyzer {

  /**
   * Analyze compilation result and extract categorized errors
   * 
   * @param compilationResult - The result from CompilationRunner
   * @returns Array of analyzed errors with categories and metadata
   */
  analyze(compilationResult: PostResurrectionCompilationResult): AnalyzedError[] {
    const { stdout, stderr } = compilationResult;
    const combinedOutput = `${stdout}\n${stderr}`;
    
    // Split output into individual error messages
    const errorMessages = this.splitIntoErrorMessages(combinedOutput);
    
    // Analyze each error message
    const analyzedErrors: AnalyzedError[] = [];
    
    for (const message of errorMessages) {
      const category = this.categorize(message);
      
      // Skip unknown errors that are just noise
      if (category === 'unknown' && this.isNoiseMessage(message)) {
        continue;
      }
      
      const analyzedError: AnalyzedError = {
        category,
        message: message.trim(),
        priority: ERROR_CATEGORY_PRIORITIES[category]
      };
      
      // Extract package info based on category
      const packageInfo = this.extractPackageInfoFromMessage(message, category);
      if (packageInfo) {
        analyzedError.packageName = packageInfo.name;
        analyzedError.versionConstraint = packageInfo.requestedVersion;
        analyzedError.conflictingPackages = packageInfo.conflictsWith;
      }
      
      // Suggest a fix strategy
      analyzedError.suggestedFix = this.suggestFix(analyzedError);
      
      analyzedErrors.push(analyzedError);
    }
    
    // Deduplicate errors with same category and package
    const deduped = this.deduplicateErrors(analyzedErrors);
    
    // Prioritize and return
    return this.prioritize(deduped);
  }

  /**
   * Categorize a single error message into an error category
   * 
   * @param errorMessage - The error message to categorize
   * @returns The error category
   */
  categorize(errorMessage: string): PostResurrectionErrorCategory {
    // Test each pattern in order of specificity
    const categoryOrder: PostResurrectionErrorCategory[] = [
      'lockfile_conflict',
      'peer_dependency_conflict',
      'dependency_version_conflict',
      'native_module_failure',
      'git_dependency_failure',
      'dependency_not_found',
      'syntax_error',
      'type_error'
    ];
    
    for (const category of categoryOrder) {
      const pattern = POST_RESURRECTION_ERROR_PATTERNS[category];
      if (pattern.test(errorMessage)) {
        return category;
      }
    }
    
    return 'unknown';
  }

  /**
   * Extract package information from an analyzed error
   * 
   * @param error - The analyzed error
   * @returns Package info or null if not applicable
   */
  extractPackageInfo(error: AnalyzedError): PackageInfo | null {
    return this.extractPackageInfoFromMessage(error.message, error.category);
  }

  /**
   * Prioritize errors by likelihood of being the root cause
   * Higher priority errors are more likely to be the root cause
   * 
   * @param errors - Array of analyzed errors
   * @returns Sorted array with highest priority first
   */
  prioritize(errors: AnalyzedError[]): AnalyzedError[] {
    return [...errors].sort((a, b) => b.priority - a.priority);
  }


  /**
   * Split compilation output into individual error messages
   */
  private splitIntoErrorMessages(output: string): string[] {
    const messages: string[] = [];
    
    // Split by common error delimiters
    const lines = output.split('\n');
    let currentMessage = '';
    
    for (const line of lines) {
      // Check if this line starts a new error
      const isNewError = this.isErrorStart(line);
      
      if (isNewError && currentMessage.trim()) {
        messages.push(currentMessage.trim());
        currentMessage = line;
      } else if (isNewError) {
        currentMessage = line;
      } else if (currentMessage) {
        // Continue building current error message
        currentMessage += '\n' + line;
      }
    }
    
    // Don't forget the last message
    if (currentMessage.trim()) {
      messages.push(currentMessage.trim());
    }
    
    // If no structured errors found, treat the whole output as one message
    if (messages.length === 0 && output.trim()) {
      messages.push(output.trim());
    }
    
    return messages;
  }

  /**
   * Check if a line starts a new error message
   */
  private isErrorStart(line: string): boolean {
    const errorStarters = [
      /^npm ERR!/,
      /^error\s/i,
      /^Error:/,
      /^SyntaxError:/,
      /^TypeError:/,
      /^Cannot find module/,
      /^Module not found/,
      /ERESOLVE/,
      /node-gyp/,
      /gyp ERR!/,
      /^TS\d+:/,
      /^\s*\d+:\d+\s+error/,  // ESLint-style errors
      /^.+\(\d+,\d+\):\s*error/  // TypeScript-style errors
    ];
    
    return errorStarters.some(pattern => pattern.test(line));
  }

  /**
   * Check if a message is just noise (not a real error)
   */
  private isNoiseMessage(message: string): boolean {
    const noisePatterns = [
      /^npm WARN/,
      /^warning/i,
      /^info/i,
      /^debug/i,
      /^\s*$/,
      /^>\s/,  // npm script output prefix
      /^Compiling/,
      /^Building/,
      /^Done in/,
      /^added \d+ packages/
    ];
    
    return noisePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Extract package information from an error message based on its category
   */
  private extractPackageInfoFromMessage(
    message: string,
    category: PostResurrectionErrorCategory
  ): PackageInfo | null {
    switch (category) {
      case 'dependency_not_found':
        return this.extractFromModuleNotFound(message);
      
      case 'dependency_version_conflict':
        return this.extractFromVersionConflict(message);
      
      case 'peer_dependency_conflict':
        return this.extractFromPeerDependency(message);
      
      case 'native_module_failure':
        return this.extractFromNativeModule(message);
      
      case 'git_dependency_failure':
        return this.extractFromGitDependency(message);
      
      default:
        return null;
    }
  }

  /**
   * Extract package info from "Cannot find module" errors
   */
  private extractFromModuleNotFound(message: string): PackageInfo | null {
    const match = EXTENDED_ERROR_PATTERNS.packageFromModuleNotFound.exec(message);
    if (!match) {return null;}
    
    const modulePath = match[1];
    
    // Skip relative paths
    if (modulePath.startsWith('.') || modulePath.startsWith('/')) {
      return null;
    }
    
    // Extract package name (handle scoped packages)
    const packageName = modulePath.startsWith('@')
      ? modulePath.split('/').slice(0, 2).join('/')
      : modulePath.split('/')[0];
    
    return { name: packageName };
  }

  /**
   * Extract package info from version conflict errors
   */
  private extractFromVersionConflict(message: string): PackageInfo | null {
    const match = EXTENDED_ERROR_PATTERNS.packageFromEresolve.exec(message);
    if (!match) {
      // Try to extract from generic version conflict message
      const versionMatch = message.match(/([^\s@]+)@([^\s]+)/);
      if (versionMatch) {
        return {
          name: versionMatch[1],
          requestedVersion: versionMatch[2]
        };
      }
      return null;
    }
    
    return {
      name: match[1],
      requestedVersion: match[2]
    };
  }


  /**
   * Extract package info from peer dependency errors
   */
  private extractFromPeerDependency(message: string): PackageInfo | null {
    // Try the detailed peer dep pattern first
    const peerMatch = EXTENDED_ERROR_PATTERNS.peerDepInfo.exec(message);
    if (peerMatch) {
      return {
        name: peerMatch[1],
        requestedVersion: peerMatch[2],
        conflictsWith: [`${peerMatch[3]}@${peerMatch[4]}`]
      };
    }
    
    // Try to extract conflicting packages
    const conflicting: string[] = [];
    let match: RegExpExecArray | null;
    const conflictPattern = new RegExp(EXTENDED_ERROR_PATTERNS.conflictingPackages.source, 'g');
    
    while ((match = conflictPattern.exec(message)) !== null) {
      conflicting.push(`${match[1]}@${match[2]}`);
    }
    
    // Try to get the main package from ERESOLVE
    const eresolveMatch = EXTENDED_ERROR_PATTERNS.packageFromEresolve.exec(message);
    if (eresolveMatch) {
      return {
        name: eresolveMatch[1],
        requestedVersion: eresolveMatch[2],
        conflictsWith: conflicting.length > 0 ? conflicting : undefined
      };
    }
    
    // Fallback: try to extract any package@version pattern
    const genericMatch = message.match(/([^\s@]+)@([^\s]+)/);
    if (genericMatch) {
      return {
        name: genericMatch[1],
        requestedVersion: genericMatch[2],
        conflictsWith: conflicting.length > 0 ? conflicting : undefined
      };
    }
    
    return null;
  }

  /**
   * Extract package info from native module failure errors
   */
  private extractFromNativeModule(message: string): PackageInfo | null {
    // First try the regex pattern
    const match = EXTENDED_ERROR_PATTERNS.nativeModulePackage.exec(message);
    if (match) {
      return { name: match[1] };
    }
    
    // Try alternative pattern: "failed for <package>"
    const failedForMatch = message.match(/failed\s+for\s+['"]?([a-zA-Z0-9_-]+)['"]?/i);
    if (failedForMatch) {
      return { name: failedForMatch[1] };
    }
    
    // Try to find package name from common native module patterns
    // Note: node-gyp is excluded as it's a build tool, not a package to fix
    const nativeModules = ['bcrypt', 'node-sass', 'sharp', 'canvas', 'sqlite3', 'fsevents', 'deasync', 'fibers'];
    for (const mod of nativeModules) {
      if (message.toLowerCase().includes(mod)) {
        return { name: mod };
      }
    }
    
    return null;
  }

  /**
   * Extract package info from git dependency failure errors
   */
  private extractFromGitDependency(message: string): PackageInfo | null {
    const match = EXTENDED_ERROR_PATTERNS.gitDependencyPackage.exec(message);
    if (match) {
      return { name: match[1] };
    }
    
    // Try to extract from git URL patterns
    const gitUrlMatch = message.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
    if (gitUrlMatch) {
      return { name: gitUrlMatch[2] };
    }
    
    return null;
  }

  /**
   * Suggest a fix strategy based on the error
   */
  private suggestFix(error: AnalyzedError): FixStrategy | undefined {
    const strategies = DEFAULT_FIX_STRATEGIES[error.category];
    if (!strategies || strategies.length === 0) {
      return undefined;
    }
    
    // Get the first (default) strategy and customize it
    const baseStrategy = strategies[0];
    
    // Customize strategy based on error details
    switch (baseStrategy.type) {
      case 'adjust_version':
        if (error.packageName) {
          return {
            type: 'adjust_version',
            package: error.packageName,
            newVersion: 'latest'  // Will be refined by FixStrategyEngine
          };
        }
        break;
      
      case 'remove_package':
        if (error.packageName) {
          return {
            type: 'remove_package',
            package: error.packageName
          };
        }
        break;
      
      case 'substitute_package':
        if (error.packageName) {
          return {
            type: 'substitute_package',
            original: error.packageName,
            replacement: ''  // Will be filled by FixStrategyEngine
          };
        }
        break;
      
      case 'add_resolution':
        if (error.packageName) {
          return {
            type: 'add_resolution',
            package: error.packageName,
            version: error.versionConstraint || '*'
          };
        }
        break;
      
      default:
        return baseStrategy;
    }
    
    return baseStrategy;
  }

  /**
   * Deduplicate errors with same category and package
   */
  private deduplicateErrors(errors: AnalyzedError[]): AnalyzedError[] {
    const seen = new Map<string, AnalyzedError>();
    
    for (const error of errors) {
      const key = `${error.category}:${error.packageName || 'none'}`;
      
      if (!seen.has(key)) {
        seen.set(key, error);
      } else {
        // Merge conflicting packages if present
        const existing = seen.get(key)!;
        if (error.conflictingPackages) {
          existing.conflictingPackages = [
            ...(existing.conflictingPackages || []),
            ...error.conflictingPackages
          ];
          // Deduplicate conflicting packages
          existing.conflictingPackages = [...new Set(existing.conflictingPackages)];
        }
      }
    }
    
    return Array.from(seen.values());
  }
}

/**
 * Create a new ErrorAnalyzer instance
 */
export function createErrorAnalyzer(): ErrorAnalyzer {
  return new ErrorAnalyzer();
}
