/**
 * Simple in-memory cache for LLM responses and analysis results
 */

import * as crypto from 'crypto';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;
  private maxSize: number;

  constructor(defaultTTL: number = 3600000, maxSize: number = 1000) {
    this.defaultTTL = defaultTTL; // Default 1 hour
    this.maxSize = maxSize;
  }

  /**
   * Generate a cache key from input
   */
  private generateKey(input: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(input));
    return hash.digest('hex');
  }

  /**
   * Get a value from cache
   */
  get(key: string | any): T | undefined {
    const cacheKey = typeof key === 'string' ? key : this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      logger.debug(`Cache miss (expired): ${cacheKey}`);
      return undefined;
    }

    logger.debug(`Cache hit: ${cacheKey}`);
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: string | any, value: T, ttl?: number): void {
    const cacheKey = typeof key === 'string' ? key : this.generateKey(key);
    const expiresAt = Date.now() + (ttl || this.defaultTTL);

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug(`Cache eviction: ${oldestKey}`);
      }
    }

    this.cache.set(cacheKey, {
      value,
      timestamp: Date.now(),
      expiresAt,
    });

    logger.debug(`Cache set: ${cacheKey}`);
  }

  /**
   * Check if a key exists in cache
   */
  has(key: string | any): boolean {
    const cacheKey = typeof key === 'string' ? key : this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.debug('Cache cleared');
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`Cache cleanup: removed ${removed} expired entries`);
    }
  }
}

// Global caches
let llmCache: Cache<any> | null = null;
let astCache: Cache<any> | null = null;

/**
 * Get the global LLM cache
 */
export function getLLMCache(): Cache<any> {
  if (!llmCache) {
    llmCache = new Cache(3600000, 500); // 1 hour TTL, max 500 entries
  }
  return llmCache;
}

/**
 * Get the global AST cache
 */
export function getASTCache(): Cache<any> {
  if (!astCache) {
    astCache = new Cache(1800000, 1000); // 30 minutes TTL, max 1000 entries
  }
  return astCache;
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  if (llmCache) {
    llmCache.clear();
  }
  if (astCache) {
    astCache.clear();
  }
  logger.info('All caches cleared');
}

/**
 * Run cleanup on all caches
 */
export function cleanupAllCaches(): void {
  if (llmCache) {
    llmCache.cleanup();
  }
  if (astCache) {
    astCache.cleanup();
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupAllCaches, 300000);
