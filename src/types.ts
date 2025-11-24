/**
 * Plugin settings interface
 */
export interface ImagePluginSettings {
  // GitHub Image Hosting Settings
  githubToken: string;
  githubRepo: string; // format: "username/repo"
  githubBranch: string;
  githubPath: string; // path in repo, e.g., "images/"

  // Image Display Settings
  defaultWidth: number; // default image width percentage (0-100)
  enableClickZoom: boolean; // enable click to zoom
  enableDragResize: boolean; // enable drag to resize

  // Zoom Presets
  zoomPresets: number[]; // e.g., [25, 50, 75, 100, 150, 200]

  // Auto Upload Settings
  autoUploadPastedImages: boolean;
  autoUploadDroppedImages: boolean;
  autoDownloadExternalImages: boolean; // automatically download and upload external images

  // Cache Settings
  enableCache: boolean;
  maxCacheSize: number; // in MB, 0 means unlimited
  cacheProtectionDays: number; // protect images accessed within N days
  cacheStrategy: "lru" | "lfu" | "fifo" | "smart"; // cache eviction strategy

  // Local Storage Settings
  localImageFolder: string; // folder for local images when GitHub not configured
}

/**
 * GitHub API response for file upload
 */
export interface GitHubUploadResponse {
  content: {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string;
  };
  commit: {
    sha: string;
    message: string;
  };
}

/**
 * Image metadata for tracking
 */
export interface ImageMetadata {
  originalSrc: string;
  currentWidth: number; // percentage
  aspectRatio: number;
  isUploaded: boolean;
  githubUrl?: string;
}

/**
 * Cached image entry
 */
export interface CachedImage {
  url: string; // original URL
  localPath: string; // path in vault
  githubUrl?: string; // uploaded GitHub URL
  size: number; // file size in bytes
  createdAt: number; // timestamp
  lastAccessedAt: number; // timestamp
  accessCount: number; // number of times accessed
  hash?: string; // optional hash for deduplication
}

/**
 * Cache metadata
 */
export interface CacheMetadata {
  totalSize: number; // total cache size in bytes
  imageCount: number; // number of cached images
  lastCleanup: number; // timestamp of last cleanup
  version: string; // cache format version
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalSize: number; // in bytes
  totalSizeMB: number; // in MB
  imageCount: number;
  oldestImage: number; // timestamp
  newestImage: number; // timestamp
  averageSize: number; // in bytes
  hitRate?: number; // cache hit rate (if tracked)
}
