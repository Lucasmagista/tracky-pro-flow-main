import { supabase } from '@/integrations/supabase/client'

export interface CacheEntry<T = unknown> {
  key: string
  data: T
  expiresAt: number
  lastAccessed: number
  accessCount: number
  size: number
}

export interface CacheConfig {
  maxSize: number // Maximum cache size in bytes
  defaultTTL: number // Default time to live in milliseconds
  cleanupInterval: number // Cleanup interval in milliseconds
}

export class SmartCache {
  private static instance: SmartCache
  private memoryCache = new Map<string, CacheEntry>()
  private config: CacheConfig = {
    maxSize: 50 * 1024 * 1024, // 50MB
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    cleanupInterval: 5 * 60 * 1000 // 5 minutes
  }
  private cleanupTimer?: NodeJS.Timeout

  private constructor() {
    this.startCleanupTimer()
  }

  static getInstance(): SmartCache {
    if (!SmartCache.instance) {
      SmartCache.instance = new SmartCache()
    }
    return SmartCache.instance
  }

  // Set cache configuration
  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // Get data from cache
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      memoryEntry.lastAccessed = Date.now()
      memoryEntry.accessCount++
      return memoryEntry.data
    }

    // Check database cache
    try {
      const { data } = await supabase
        .from('cache_entries')
        .select('*')
        .eq('key', key)
        .single()

      if (data && !this.isExpired(data)) {
        const entry: CacheEntry<T> = {
          key: data.key,
          data: data.data,
          expiresAt: data.expires_at,
          lastAccessed: Date.now(),
          accessCount: data.access_count + 1,
          size: this.calculateSize(data.data)
        }

        // Update in database
        await supabase
          .from('cache_entries')
          .update({
            last_accessed: new Date().toISOString(),
            access_count: entry.accessCount
          })
          .eq('key', key)

        // Store in memory
        this.memoryCache.set(key, entry)

        return entry.data
      }
    } catch (error) {
      console.error('Error fetching from database cache:', error)
    }

    // Cache miss
    this.memoryCache.delete(key)
    return null
  }

  // Set data in cache
  async set<T>(
    key: string,
    data: T,
    ttl: number = this.config.defaultTTL
  ): Promise<void> {
    const size = this.calculateSize(data)
    const entry: CacheEntry<T> = {
      key,
      data,
      expiresAt: Date.now() + ttl,
      lastAccessed: Date.now(),
      accessCount: 1,
      size
    }

    // Check if we need to evict entries
    await this.evictIfNeeded(size)

    // Store in memory
    this.memoryCache.set(key, entry)

    // Store in database
    try {
      await supabase
        .from('cache_entries')
        .upsert({
          key,
          data,
          expires_at: new Date(entry.expiresAt).toISOString(),
          last_accessed: new Date(entry.lastAccessed).toISOString(),
          access_count: entry.accessCount,
          size: entry.size
        })
    } catch (error) {
      console.error('Error storing in database cache:', error)
    }
  }

  // Delete from cache
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key)

    try {
      await supabase
        .from('cache_entries')
        .delete()
        .eq('key', key)
    } catch (error) {
      console.error('Error deleting from database cache:', error)
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    this.memoryCache.clear()

    try {
      await supabase
        .from('cache_entries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    } catch (error) {
      console.error('Error clearing database cache:', error)
    }
  }

  // Get cache statistics
  getStats(): {
    memoryEntries: number
    memorySize: number
    hitRate: number
    totalAccesses: number
  } {
    const memoryEntries = this.memoryCache.size
    const memorySize = Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.size, 0)

    const totalAccesses = Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.accessCount, 0)

    return {
      memoryEntries,
      memorySize,
      hitRate: totalAccesses > 0 ? 1 : 0, // Simplified hit rate calculation
      totalAccesses
    }
  }

  // Check if entry is expired
  private isExpired(entry: CacheEntry | { expiresAt: number }): boolean {
    return Date.now() > entry.expiresAt
  }

  // Calculate size of data
  private calculateSize(data: unknown): number {
    return new Blob([JSON.stringify(data)]).size
  }

  // Evict entries if needed (LRU - Least Recently Used)
  private async evictIfNeeded(requiredSize: number): Promise<void> {
    const currentSize = Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.size, 0)

    if (currentSize + requiredSize <= this.config.maxSize) {
      return
    }

    // Sort by last accessed (LRU)
    const sortedEntries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

    let freedSize = 0
    const toDelete: string[] = []

    for (const [key, entry] of sortedEntries) {
      toDelete.push(key)
      freedSize += entry.size

      if (currentSize - freedSize + requiredSize <= this.config.maxSize) {
        break
      }
    }

    // Delete from memory
    toDelete.forEach(key => this.memoryCache.delete(key))

    // Delete from database
    try {
      if (toDelete.length > 0) {
        await supabase
          .from('cache_entries')
          .delete()
          .in('key', toDelete)
      }
    } catch (error) {
      console.error('Error deleting evicted entries:', error)
    }
  }

  // Start cleanup timer
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanup()
    }, this.config.cleanupInterval)
  }

  // Cleanup expired entries
  private async cleanup(): Promise<void> {
    const now = Date.now()

    // Cleanup memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key)
      }
    }

    // Cleanup database cache
    try {
      const { error } = await supabase
        .from('cache_entries')
        .delete()
        .lt('expires_at', new Date(now).toISOString())

      if (error) {
        console.error('Error cleaning up database cache:', error)
      }
    } catch (error) {
      console.error('Error during cache cleanup:', error)
    }
  }

  // Stop cleanup timer
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }
}

// Export singleton instance
export const smartCache = SmartCache.getInstance()

// Specialized cache for tracking data
export class TrackingCache {
  private static readonly CACHE_PREFIX = 'tracking:'
  private static readonly CACHE_TTL = 30 * 60 * 1000 // 30 minutes

  static async get(trackingCode: string): Promise<unknown | null> {
    const key = `${this.CACHE_PREFIX}${trackingCode}`
    return await smartCache.get(key)
  }

  static async set(trackingCode: string, data: any): Promise<void> {
    const key = `${this.CACHE_PREFIX}${trackingCode}`
    await smartCache.set(key, data, this.CACHE_TTL)
  }

  static async invalidate(trackingCode: string): Promise<void> {
    const key = `${this.CACHE_PREFIX}${trackingCode}`
    await smartCache.delete(key)
  }

  static async clearAll(): Promise<void> {
    // This would need to be implemented with a pattern-based deletion
    // For now, we'll clear all cache
    await smartCache.clear()
  }
}

// Specialized cache for API responses
export class APICache {
  private static readonly CACHE_PREFIX = 'api:'
  private static readonly CACHE_TTL = 15 * 60 * 1000 // 15 minutes

  static generateKey(endpoint: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')

    return `${this.CACHE_PREFIX}${endpoint}?${sortedParams}`
  }

  static async get(endpoint: string, params: Record<string, any>): Promise<any | null> {
    const key = this.generateKey(endpoint, params)
    return await smartCache.get(key)
  }

  static async set(endpoint: string, params: Record<string, any>, data: any): Promise<void> {
    const key = this.generateKey(endpoint, params)
    await smartCache.set(key, data, this.CACHE_TTL)
  }
}