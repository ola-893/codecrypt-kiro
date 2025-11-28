/**
 * Progress tracking and reporting for CodeCrypt operations
 */

import * as vscode from 'vscode';
import { getLogger } from '../utils/logger';

/**
 * Resurrection stages for progress tracking
 */
export enum ResurrectionStage {
  INITIALIZING = 'Initializing',
  CLONING = 'Cloning repository',
  ANALYZING = 'Analyzing repository',
  PLANNING = 'Planning resurrection',
  UPDATING = 'Updating dependencies',
  VALIDATING = 'Validating changes',
  REPORTING = 'Generating report',
  COMPLETE = 'Complete'
}

/**
 * Progress reporter for resurrection operations
 */
export class ProgressReporter {
  private progress: vscode.Progress<{ message?: string; increment?: number }>;
  private logger = getLogger();
  private currentStage: ResurrectionStage = ResurrectionStage.INITIALIZING;
  private totalSteps: number = 0;
  private completedSteps: number = 0;

  constructor(
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    totalSteps: number = 100
  ) {
    this.progress = progress;
    this.totalSteps = totalSteps;
  }

  /**
   * Report progress for a new stage
   */
  reportStage(stage: ResurrectionStage, detail?: string): void {
    this.currentStage = stage;
    const message = detail ? `${stage}: ${detail}` : stage;
    
    this.logger.info(`[Progress] ${message}`);
    this.progress.report({ message });
  }

  /**
   * Report incremental progress within a stage
   */
  reportProgress(message: string, increment?: number): void {
    this.logger.info(`[Progress] ${this.currentStage}: ${message}`);
    
    if (increment !== undefined) {
      this.completedSteps += increment;
      this.progress.report({ message, increment });
    } else {
      this.progress.report({ message });
    }
  }

  /**
   * Report dependency update progress
   */
  reportDependencyUpdate(
    packageName: string,
    currentVersion: string,
    targetVersion: string,
    current: number,
    total: number
  ): void {
    const message = `Updating ${packageName} (${current}/${total}): ${currentVersion} → ${targetVersion}`;
    const percentage = Math.round((current / total) * 100);
    
    this.logger.info(`[Progress] ${message} [${percentage}%]`);
    this.progress.report({ 
      message,
      increment: total > 0 ? (100 / total) : 0
    });
  }

  /**
   * Report validation progress
   */
  reportValidation(type: 'compilation' | 'tests', status: 'running' | 'passed' | 'failed'): void {
    const emoji = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '🔄';
    const message = `${emoji} ${type === 'compilation' ? 'Compiling' : 'Running tests'}...`;
    
    this.logger.info(`[Progress] Validation: ${message}`);
    this.progress.report({ message });
  }

  /**
   * Report completion
   */
  reportComplete(success: boolean, summary?: string): void {
    const emoji = success ? '✅' : '❌';
    const message = summary || (success ? 'Resurrection complete!' : 'Resurrection failed');
    
    this.logger.info(`[Progress] ${emoji} ${message}`);
    this.progress.report({ message: `${emoji} ${message}` });
  }
}

/**
 * Create a progress reporter with VS Code Progress API
 */
export async function withProgressReporter<T>(
  title: string,
  task: (reporter: ProgressReporter) => Promise<T>,
  cancellable: boolean = false
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable
    },
    async (progress, token) => {
      const reporter = new ProgressReporter(progress);
      
      if (cancellable && token) {
        token.onCancellationRequested(() => {
          getLogger().warn('Operation cancelled by user');
        });
      }
      
      return task(reporter);
    }
  );
}
