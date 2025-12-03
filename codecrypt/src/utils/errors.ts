
export enum NpmErrorType {
  PeerDependencyConflict,
  NetworkError,
  BuildFailure,
  Unknown,
}

export interface NpmInstallError {
  errorType: NpmErrorType;
  message: string;
  conflictingPackage?: string;
}

export function parseNpmError(stderr: string): NpmInstallError {
  if (stderr.includes('EPEERINVALID')) {
    const match = stderr.match(/peer dep missing: ((?:@[^/]+\/)?[^@,\s]+)(?:@\S+)?/);
    return {
      errorType: NpmErrorType.PeerDependencyConflict,
      message: 'Peer dependency conflict',
      conflictingPackage: match ? match[1] : undefined,
    };
  }

  if (stderr.includes('ENOTFOUND') || stderr.includes('ETIMEDOUT')) {
    return {
      errorType: NpmErrorType.NetworkError,
      message: 'Network error',
    };
  }
  
  if (stderr.includes('build error')) {
    return {
        errorType: NpmErrorType.BuildFailure,
        message: 'Build failure'
    }
  }

  return {
    errorType: NpmErrorType.Unknown,
    message: 'Unknown npm install error',
  };
}

export class CodeCryptError extends Error {
    constructor(message: string, public readonly code?: string) {
        super(message);
        this.name = 'CodeCryptError';
    }
}

export class RepositoryError extends CodeCryptError {
    constructor(message: string, public readonly path: string) {
        super(message, 'REPOSITORY_ERROR');
        this.name = 'RepositoryError';
    }
}

export class DependencyError extends CodeCryptError {
    constructor(message: string, public readonly dependencyName: string) {
        super(message, 'DEPENDENCY_ERROR');
        this.name = 'DependencyError';
    }
}

export class NetworkError extends CodeCryptError {
    constructor(message: string, public readonly url: string) {
        super(message, 'NETWORK_ERROR');
        this.name = 'NetworkError';
    }
}

export class ValidationError extends CodeCryptError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

export function safeJsonParse(json: string): any {
    try {
        return JSON.parse(json);
    } catch (error) {
        return null;
    }
}

export function formatErrorForUser(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}