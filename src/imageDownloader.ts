import { Notice, requestUrl } from 'obsidian';
import { ImagePluginSettings } from './types';
import { CacheManager } from './cacheManager';
import { GitHubUploader } from './githubUploader';

/**
 * Image Downloader
 * Downloads external images and optionally uploads them
 */
export class ImageDownloader {
	private settings: ImagePluginSettings;
	private cacheManager: CacheManager;
	private uploader: GitHubUploader;
	private downloadQueue: Map<string, Promise<string>> = new Map();

	constructor(
		settings: ImagePluginSettings,
		cacheManager: CacheManager,
		uploader: GitHubUploader
	) {
		this.settings = settings;
		this.cacheManager = cacheManager;
		this.uploader = uploader;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImagePluginSettings): void {
		this.settings = settings;
	}

	/**
	 * Check if URL is an external image
	 */
	isExternalImage(url: string): boolean {
		try {
			const urlObj = new URL(url);

			// Check if it's http/https
			if (!urlObj.protocol.startsWith('http')) {
				return false;
			}

			// Check if it looks like an image (basic check)
			const pathname = urlObj.pathname.toLowerCase();
			const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];

			return imageExtensions.some(ext => pathname.endsWith(ext)) ||
				   pathname.includes('/image/') ||
				   urlObj.hostname.includes('imgur') ||
				   urlObj.hostname.includes('cloudinary');
		} catch {
			return false;
		}
	}

	/**
	 * Process external image: download, cache, and optionally upload
	 * Returns the final URL to use
	 */
	async processExternalImage(url: string): Promise<string> {
		// Check if already being processed
		if (this.downloadQueue.has(url)) {
			return await this.downloadQueue.get(url)!;
		}

		// Create promise for this download
		const promise = this._processExternalImage(url);
		this.downloadQueue.set(url, promise);

		try {
			const result = await promise;
			return result;
		} finally {
			// Clean up queue
			this.downloadQueue.delete(url);
		}
	}

	/**
	 * Internal process method
	 */
	private async _processExternalImage(url: string): Promise<string> {
		try {
			// Step 1: Check cache
			if (this.settings.enableCache) {
				const cached = await this.cacheManager.get(url);
				if (cached) {
					console.log('Image found in cache:', url);

					// If we have a GitHub URL, use that
					if (cached.githubUrl) {
						return cached.githubUrl;
					}

					// Otherwise, return cached local path
					return cached.localPath;
				}
			}

			// Step 2: Download image
			console.log('Downloading external image:', url);
			const imageData = await this.downloadImage(url);

			// Step 3: Add to cache
			let cached;
			if (this.settings.enableCache) {
				cached = await this.cacheManager.add(url, imageData);
			}

			// Step 4: Upload to GitHub if configured and auto-upload is enabled
			if (this.settings.autoDownloadExternalImages && this.uploader.isConfigured()) {
				try {
					console.log('Uploading to GitHub:', url);
					const filename = this.extractFilename(url);
					const githubUrl = await this.uploader.uploadImage(imageData, filename);

					// Update cache with GitHub URL
					if (cached) {
						cached.githubUrl = githubUrl;
						// Save cache index (this happens in cacheManager.add, but we need to update)
					}

					new Notice('External image uploaded to GitHub');
					return githubUrl;
				} catch (error) {
					console.error('Failed to upload to GitHub:', error);
					// Fall through to use cached version
				}
			}

			// Return cached local path or original URL
			if (cached) {
				return cached.localPath;
			}

			return url; // Fallback to original URL
		} catch (error) {
			console.error('Failed to process external image:', error);
			new Notice(`Failed to download image: ${error.message}`);
			return url; // Return original URL as fallback
		}
	}

	/**
	 * Download image from URL
	 */
	private async downloadImage(url: string): Promise<ArrayBuffer> {
		try {
			const response = await requestUrl({
				url: url,
				method: 'GET',
			});

			if (response.status !== 200) {
				throw new Error(`HTTP ${response.status}: ${response.text}`);
			}

			return response.arrayBuffer;
		} catch (error) {
			console.error('Download error:', error);
			throw new Error(`Failed to download image: ${error.message}`);
		}
	}

	/**
	 * Extract filename from URL
	 */
	private extractFilename(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;
			const segments = pathname.split('/');
			let filename = segments[segments.length - 1];

			// Remove query parameters
			filename = filename.split('?')[0];

			// If no filename or no extension, generate one
			if (!filename || !filename.includes('.')) {
				const extension = this.guessExtension(url);
				filename = `image_${Date.now()}.${extension}`;
			}

			return filename;
		} catch {
			return `image_${Date.now()}.png`;
		}
	}

	/**
	 * Guess image extension from URL or content type
	 */
	private guessExtension(url: string): string {
		const urlLower = url.toLowerCase();

		if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'jpg';
		if (urlLower.includes('.png')) return 'png';
		if (urlLower.includes('.gif')) return 'gif';
		if (urlLower.includes('.webp')) return 'webp';
		if (urlLower.includes('.svg')) return 'svg';
		if (urlLower.includes('.bmp')) return 'bmp';

		return 'png'; // Default
	}

	/**
	 * Batch process multiple external images
	 */
	async processMultiple(urls: string[]): Promise<Map<string, string>> {
		const results = new Map<string, string>();

		// Process in parallel with concurrency limit
		const concurrency = 3;
		const chunks = this.chunkArray(urls, concurrency);

		for (const chunk of chunks) {
			const promises = chunk.map(async (url) => {
				try {
					const newUrl = await this.processExternalImage(url);
					results.set(url, newUrl);
				} catch (error) {
					console.error(`Failed to process ${url}:`, error);
					results.set(url, url); // Keep original URL on error
				}
			});

			await Promise.all(promises);
		}

		return results;
	}

	/**
	 * Chunk array for batch processing
	 */
	private chunkArray<T>(array: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	}

	/**
	 * Check if URL is already on GitHub
	 */
	isGitHubUrl(url: string): boolean {
		try {
			const urlObj = new URL(url);
			return urlObj.hostname.includes('github') ||
				   urlObj.hostname.includes('githubusercontent');
		} catch {
			return false;
		}
	}

	/**
	 * Clear download queue
	 */
	clearQueue(): void {
		this.downloadQueue.clear();
	}

	/**
	 * Get queue size
	 */
	getQueueSize(): number {
		return this.downloadQueue.size;
	}
}
