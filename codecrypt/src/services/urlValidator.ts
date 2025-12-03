/**
 * URL Validator
 * 
 * Validates URL-based package versions before installation.
 * Handles GitHub archive URLs and provides npm registry fallback.
 */

import { URLValidationResult, IURLValidator } from '../types';

/**
 * URLValidator implementation
 */
export class URLValidator implements IURLValidator {
  private readonly timeout: number;
  private readonly npmRegistryUrl: string;

  constructor(timeout: number = 5000) {
    this.timeout = timeout;
    this.npmRegistryUrl = 'https://registry.npmjs.org';
  }

  /**
   * Validate a URL-based package version
   * Performs a HEAD request to check if the URL is accessible
   */
  async validate(url: string): Promise<URLValidationResult> {
    try {
      const fullUrl = this.normalizeUrl(url);
      
      if (!fullUrl) {
        return {
          url,
          isValid: false,
          statusCode: undefined,
          error: 'Malformed or unresolvable URL',
        };
      }

      // Create an AbortController with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(fullUrl, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow'
        });
        
        clearTimeout(timeoutId);

        return {
          url,
          isValid: response.ok,
          statusCode: response.status
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // If HEAD fails, try GET (some servers don't support HEAD)
        try {
          const getController = new AbortController();
          const getTimeoutId = setTimeout(() => getController.abort(), this.timeout);
          
          const getResponse = await fetch(fullUrl, {
            method: 'GET',
            signal: getController.signal,
            redirect: 'follow'
          });
          
          clearTimeout(getTimeoutId);

          return {
            url,
            isValid: getResponse.ok,
            statusCode: getResponse.status
          };
        } catch (getError: any) {
          return {
            url,
            isValid: false,
            statusCode: undefined,
            error: getError.message || 'Failed to access URL after multiple attempts.'
          };
        }
      }
    } catch (error: any) {
      return {
        url,
        isValid: false,
        statusCode: undefined,
        error: error.message || 'An unexpected error occurred during URL validation.'
      };
    }
  }

  /**
   * Find npm registry alternative for a package
   * Queries the npm registry to get the latest version
   */
  async findNpmAlternative(packageName: string): Promise<string | null> {
    try {
      const registryUrl = `${this.npmRegistryUrl}/${encodeURIComponent(packageName)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(registryUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        
        // Get the latest version from dist-tags
        if (data['dist-tags'] && data['dist-tags'].latest) {
          return data['dist-tags'].latest;
        }

        return null;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract package name from a GitHub archive URL
   * Handles various GitHub URL formats
   */
  extractPackageFromUrl(url: string): string | null {
    try {
      // Common GitHub URL patterns:
      // https://github.com/user/repo/archive/version.tar.gz
      // https://github.com/user/repo/tarball/version
      // github:user/repo#version
      
      // Remove protocol if present
      let cleanUrl = url.replace(/^https?:\/\//, '');
      
      // Handle github: protocol
      if (url.startsWith('github:')) {
        const match = url.match(/github:([^/]+)\/([^#]+)/);
        if (match) {
          return match[2]; // Return repo name
        }
        return null;
      }

      // Handle github.com URLs
      if (cleanUrl.includes('github.com')) {
        // Match pattern: github.com/user/repo/...
        const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
          // Return repo name, removing .git suffix if present
          return match[2].replace(/\.git$/, '');
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Normalize URL to ensure it has a protocol
   */
  private normalizeUrl(url: string): string {
    try {
      new URL(url);
      return url;
    } catch (e) {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      // If it's still malformed after attempting to add protocol, return empty string
      try {
        new URL(`https://${url}`);
        return `https://${url}`;
      } catch (e) {
        return ''; // Indicate an unresolvable URL
      }
    }
  }
}