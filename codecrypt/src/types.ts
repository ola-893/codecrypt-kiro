/**
 * Core types for CodeCrypt Resurrection Flow
 */

/**
 * Status of a dependency update operation
 */
export type UpdateStatus = 'pending' | 'success' | 'failed';

/**
 * Information about a single dependency
 */
export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Current version installed */
  currentVersion: string;
  /** Latest stable version available */
  latestVersion: string;
  /** Known security vulnerabilities */
  vulnerabilities: VulnerabilityInfo[];
  /** Status of the update operation */
  updateStatus: UpdateStatus;
}

/**
 * Security vulnerability information
 */
export interface VulnerabilityInfo {
  /** Vulnerability ID (e.g., CVE number) */
  id: string;
  /** Severity level */
  severity: 'low' | 'moderate' | 'high' | 'critical';
  /** Description of the vulnerability */
  description?: string;
}

/**
 * Entry in the transformation log
 */
export interface TransformationLogEntry {
  /** Timestamp of the operation */
  timestamp: Date;
  /** Type of operation performed */
  type: 'dependency_update' | 'code_transformation' | 'test_run' | 'rollback' | 'error';
  /** Description of the operation */
  message: string;
  /** Additional details */
  details?: any;
}

/**
 * Main context object for the resurrection process
 */
export interface ResurrectionContext {
  /** GitHub repository URL */
  repoUrl: string;
  /** Whether the repository is classified as dead */
  isDead: boolean;
  /** Date of last commit */
  lastCommitDate?: Date;
  /** List of dependencies to be updated */
  dependencies: DependencyInfo[];
  /** Log of all transformation operations */
  transformationLog: TransformationLogEntry[];
  /** Path to the cloned repository */
  repoPath?: string;
  /** Name of the resurrection branch */
  resurrectionBranch?: string;
}

/**
 * Configuration options for the resurrection process
 */
export interface ResurrectionConfig {
  /** Strategy for dependency updates */
  strategy: 'conservative' | 'moderate' | 'aggressive';
  /** Whether to create a pull request */
  createPullRequest: boolean;
  /** Maximum number of retry attempts for network operations */
  maxRetries: number;
}

/**
 * Dependency analysis report
 */
export interface DependencyReport {
  /** Total number of dependencies analyzed */
  totalDependencies: number;
  /** Number of outdated dependencies */
  outdatedDependencies: number;
  /** Number of dependencies with security vulnerabilities */
  vulnerableDependencies: number;
  /** Total number of security vulnerabilities */
  totalVulnerabilities: number;
  /** List of all dependencies */
  dependencies: DependencyInfo[];
  /** Timestamp when the report was generated */
  generatedAt: Date;
}

/**
 * Result of a resurrection operation
 */
export interface ResurrectionResult {
  /** Whether the resurrection was successful */
  success: boolean;
  /** Summary message */
  message: string;
  /** Number of dependencies updated */
  dependenciesUpdated: number;
  /** Number of vulnerabilities fixed */
  vulnerabilitiesFixed: number;
  /** URL to the resurrection branch or PR */
  branchUrl?: string;
  /** URL to the pull request (if created) */
  pullRequestUrl?: string;
  /** Any errors encountered */
  errors?: string[];
}
