/**
 * Logging infrastructure for CodeCrypt
 */

import * as vscode from 'vscode';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Logger class for CodeCrypt operations
 */
export class Logger {
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel;

  constructor(channelName: string = 'CodeCrypt', logLevel: LogLevel = LogLevel.INFO) {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
    this.logLevel = logLevel;
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, ...args);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, ...args);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, ...args);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, ...args: any[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : undefined;
      
      this.log('ERROR', message, errorMessage, ...args);
      
      if (stackTrace) {
        this.outputChannel.appendLine(stackTrace);
      }
    }
  }

  /**
   * Show the output channel
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Clear the output channel
   */
  clear(): void {
    this.outputChannel.clear();
  }

  /**
   * Dispose of the output channel
   */
  dispose(): void {
    this.outputChannel.dispose();
  }

  /**
   * Internal logging method
   */
  private log(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : '';
    
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}${formattedArgs}`);
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | undefined;

/**
 * Get or create the global logger instance
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

/**
 * Initialize the logger with custom settings
 */
export function initializeLogger(channelName?: string, logLevel?: LogLevel): Logger {
  if (globalLogger) {
    globalLogger.dispose();
  }
  globalLogger = new Logger(channelName, logLevel);
  return globalLogger;
}

/**
 * Dispose of the global logger
 */
export function disposeLogger(): void {
  if (globalLogger) {
    globalLogger.dispose();
    globalLogger = undefined;
  }
}
