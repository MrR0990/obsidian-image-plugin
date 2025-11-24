import { Notice, TFile, Vault } from "obsidian";
import {
  ImagePluginSettings,
  CachedImage,
  CacheMetadata,
  CacheStats,
} from "./types";

/**
 * Cache Manager
 * Manages image cache with intelligent cleanup strategies
 */
export class CacheManager {
  private settings: ImagePluginSettings;
  private vault: Vault;
  private cacheDir: string = ".obsidian/plugins/obsidian-image-plugin/cache";
  private cacheIndex: Map<string, CachedImage> = new Map();
  private cacheMetadata: CacheMetadata;

  constructor(vault: Vault, settings: ImagePluginSettings) {
    this.vault = vault;
    this.settings = settings;
    this.cacheMetadata = {
      totalSize: 0,
      imageCount: 0,
      lastCleanup: Date.now(),
      version: "1.0.0",
    };
  }

  /**
   * Initialize cache system
   */
  async initialize(): Promise<void> {
    // Ensure cache directory exists
    await this.ensureCacheDir();

    // Load cache index
    await this.loadCacheIndex();

    // Perform initial cleanup if needed
    await this.checkAndCleanup();
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: ImagePluginSettings): void {
    this.settings = settings;
  }

  /**
   * Get cached image or return undefined
   */
  async get(url: string): Promise<CachedImage | undefined> {
    const cached = this.cacheIndex.get(url);
    if (!cached) {
      return undefined;
    }

    // Update access info
    cached.lastAccessedAt = Date.now();
    cached.accessCount++;
    await this.saveCacheIndex();

    return cached;
  }

  /**
   * Add image to cache
   */
  async add(
    url: string,
    data: ArrayBuffer,
    githubUrl?: string,
  ): Promise<CachedImage> {
    // Generate filename from URL hash
    const filename = this.generateFilename(url);
    const localPath = `${this.cacheDir}/${filename}`;

    // Save image data
    await this.vault.adapter.writeBinary(localPath, data);

    // Create cache entry
    const cached: CachedImage = {
      url,
      localPath,
      githubUrl,
      size: data.byteLength,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      hash: await this.hashUrl(url),
    };

    // Add to index
    this.cacheIndex.set(url, cached);
    this.cacheMetadata.totalSize += cached.size;
    this.cacheMetadata.imageCount++;

    // Save index
    await this.saveCacheIndex();

    // Check if cleanup is needed
    await this.checkAndCleanup();

    return cached;
  }

  /**
   * Remove image from cache
   */
  async remove(url: string): Promise<boolean> {
    const cached = this.cacheIndex.get(url);
    if (!cached) {
      return false;
    }

    try {
      // Delete file
      await this.vault.adapter.remove(cached.localPath);

      // Update metadata
      this.cacheMetadata.totalSize -= cached.size;
      this.cacheMetadata.imageCount--;

      // Remove from index
      this.cacheIndex.delete(url);

      // Save index
      await this.saveCacheIndex();

      return true;
    } catch (error) {
      console.error("Failed to remove cached image:", error);
      return false;
    }
  }

  /**
   * Check cache size and cleanup if needed
   */
  async checkAndCleanup(): Promise<void> {
    if (!this.settings.enableCache) {
      return;
    }

    // Check if cache size exceeds limit
    const maxSizeBytes = this.settings.maxCacheSize * 1024 * 1024; // Convert MB to bytes

    if (maxSizeBytes > 0 && this.cacheMetadata.totalSize > maxSizeBytes) {
      const bytesToFree = this.cacheMetadata.totalSize - maxSizeBytes;
      await this.cleanup(bytesToFree);
    }
  }

  /**
   * Cleanup cache using configured strategy
   */
  async cleanup(bytesToFree: number): Promise<number> {
    const strategy = this.settings.cacheStrategy;
    let freedBytes = 0;

    // Get candidates for deletion
    const candidates = this.getCleanupCandidates();

    if (candidates.length === 0) {
      return 0;
    }

    // Sort candidates based on strategy
    const sorted = this.sortByStrategy(candidates, strategy);

    // Delete images until we free enough space
    for (const cached of sorted) {
      if (freedBytes >= bytesToFree) {
        break;
      }

      const success = await this.remove(cached.url);
      if (success) {
        freedBytes += cached.size;
      }
    }

    this.cacheMetadata.lastCleanup = Date.now();
    await this.saveCacheIndex();

    new Notice(`Cache cleaned: ${this.formatBytes(freedBytes)} freed`);
    return freedBytes;
  }

  /**
   * Get candidates for cleanup (exclude protected images)
   */
  private getCleanupCandidates(): CachedImage[] {
    const now = Date.now();
    const protectionMs =
      this.settings.cacheProtectionDays * 24 * 60 * 60 * 1000;
    const candidates: CachedImage[] = [];

    for (const cached of this.cacheIndex.values()) {
      // Skip if accessed recently (within protection period)
      if (now - cached.lastAccessedAt < protectionMs) {
        continue;
      }

      candidates.push(cached);
    }

    return candidates;
  }

  /**
   * Sort candidates by cleanup strategy
   */
  private sortByStrategy(
    candidates: CachedImage[],
    strategy: string,
  ): CachedImage[] {
    const sorted = [...candidates];

    switch (strategy) {
      case "lru": // Least Recently Used
        sorted.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
        break;

      case "lfu": // Least Frequently Used
        sorted.sort((a, b) => a.accessCount - b.accessCount);
        break;

      case "fifo": // First In First Out
        sorted.sort((a, b) => a.createdAt - b.createdAt);
        break;

      case "smart": // Smart strategy: combination of LRU, size, and frequency
        sorted.sort((a, b) => {
          // Calculate score: lower score = higher priority for deletion
          const scoreA = this.calculateSmartScore(a);
          const scoreB = this.calculateSmartScore(b);
          return scoreA - scoreB;
        });
        break;
    }

    return sorted;
  }

  /**
   * Calculate smart score for cleanup priority
   * Lower score = higher priority for deletion
   */
  private calculateSmartScore(cached: CachedImage): number {
    const now = Date.now();
    const daysSinceAccess =
      (now - cached.lastAccessedAt) / (24 * 60 * 60 * 1000);
    const daysSinceCreation = (now - cached.createdAt) / (24 * 60 * 60 * 1000);

    // Factors:
    // 1. Recency: More recent access = higher score
    const recencyScore = 1000 / (daysSinceAccess + 1);

    // 2. Frequency: More access = higher score
    const frequencyScore = Math.log(cached.accessCount + 1) * 100;

    // 3. Size penalty: Larger files = lower score (easier to delete)
    const sizePenalty = cached.size / (1024 * 1024); // Size in MB

    // 4. Age penalty: Older files = lower score
    const agePenalty = daysSinceCreation * 2;

    // Combined score
    return recencyScore + frequencyScore - sizePenalty - agePenalty;
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    const urls = Array.from(this.cacheIndex.keys());

    for (const url of urls) {
      await this.remove(url);
    }

    new Notice("Cache cleared successfully");
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const images = Array.from(this.cacheIndex.values());

    const stats: CacheStats = {
      totalSize: this.cacheMetadata.totalSize,
      totalSizeMB: this.cacheMetadata.totalSize / (1024 * 1024),
      imageCount: this.cacheMetadata.imageCount,
      oldestImage:
        images.length > 0 ? Math.min(...images.map((i) => i.createdAt)) : 0,
      newestImage:
        images.length > 0 ? Math.max(...images.map((i) => i.createdAt)) : 0,
      averageSize:
        this.cacheMetadata.imageCount > 0
          ? this.cacheMetadata.totalSize / this.cacheMetadata.imageCount
          : 0,
    };

    return stats;
  }

  /**
   * Get all cached images
   */
  async getAllCached(): Promise<CachedImage[]> {
    return Array.from(this.cacheIndex.values());
  }

  /**
   * Update GitHub URL for a cached image
   */
  async updateGitHubUrl(url: string, githubUrl: string): Promise<boolean> {
    const cached = this.cacheIndex.get(url);
    if (!cached) {
      return false;
    }

    cached.githubUrl = githubUrl;
    await this.saveCacheIndex();
    return true;
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await this.vault.adapter.mkdir(this.cacheDir);
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Load cache index from disk
   */
  private async loadCacheIndex(): Promise<void> {
    const indexPath = `${this.cacheDir}/index.json`;

    try {
      const data = await this.vault.adapter.read(indexPath);
      const parsed = JSON.parse(data);

      this.cacheMetadata = parsed.metadata || this.cacheMetadata;

      if (parsed.index) {
        this.cacheIndex.clear();
        for (const [url, cached] of Object.entries(parsed.index)) {
          this.cacheIndex.set(url, cached as CachedImage);
        }
      }
    } catch (error) {
      // Index doesn't exist yet, will be created on first save
      console.log("Cache index not found, creating new one");
    }
  }

  /**
   * Save cache index to disk
   */
  private async saveCacheIndex(): Promise<void> {
    const indexPath = `${this.cacheDir}/index.json`;

    const data = {
      metadata: this.cacheMetadata,
      index: Object.fromEntries(this.cacheIndex),
    };

    try {
      await this.vault.adapter.write(indexPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save cache index:", error);
    }
  }

  /**
   * Generate filename from URL
   */
  private generateFilename(url: string): string {
    // Extract extension from URL
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const extension = pathname.split(".").pop() || "png";

    // Generate hash from URL
    const hash = this.simpleHash(url);

    return `${hash}.${extension}`;
  }

  /**
   * Simple hash function for URLs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate async hash for URL
   */
  private async hashUrl(url: string): Promise<string> {
    // Use built-in crypto if available
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(url);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .substring(0, 16);
    }

    // Fallback to simple hash
    return this.simpleHash(url);
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }
}
