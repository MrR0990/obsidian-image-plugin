import { Notice, requestUrl } from 'obsidian';
import { ImagePluginSettings, GitHubUploadResponse } from './types';

/**
 * GitHub Image Uploader
 * Handles uploading images to GitHub repository
 */
export class GitHubUploader {
	private settings: ImagePluginSettings;

	constructor(settings: ImagePluginSettings) {
		this.settings = settings;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImagePluginSettings): void {
		this.settings = settings;
	}

	/**
	 * Validate GitHub configuration
	 */
	isConfigured(): boolean {
		return !!(
			this.settings.githubToken &&
			this.settings.githubRepo &&
			this.settings.githubBranch
		);
	}

	/**
	 * Upload image to GitHub
	 * @param file - Image file to upload
	 * @param customPath - Optional custom path (overrides settings)
	 * @returns URL of uploaded image
	 */
	async uploadImage(file: File | ArrayBuffer, fileName: string, customPath?: string): Promise<string> {
		if (!this.isConfigured()) {
			throw new Error('GitHub is not configured. Please configure in settings.');
		}

		try {
			// Convert file to base64
			const base64Content = await this.fileToBase64(file);

			// Generate unique filename if needed
			const uniqueFileName = this.generateUniqueFileName(fileName);
			const path = (customPath || this.settings.githubPath) + uniqueFileName;

			// Upload to GitHub
			const url = `https://api.github.com/repos/${this.settings.githubRepo}/contents/${path}`;

			const response = await requestUrl({
				url: url,
				method: 'PUT',
				headers: {
					'Authorization': `token ${this.settings.githubToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					message: `Upload image: ${uniqueFileName}`,
					content: base64Content,
					branch: this.settings.githubBranch,
				}),
			});

			if (response.status === 201) {
				const data = response.json as GitHubUploadResponse;
				new Notice(`Image uploaded successfully: ${uniqueFileName}`);
				return data.content.download_url;
			} else {
				throw new Error(`Upload failed with status: ${response.status}`);
			}
		} catch (error) {
			console.error('GitHub upload error:', error);
			new Notice(`Failed to upload image: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Convert file to base64
	 */
	private async fileToBase64(file: File | ArrayBuffer): Promise<string> {
		if (file instanceof ArrayBuffer) {
			return this.arrayBufferToBase64(file);
		}

		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const base64 = (reader.result as string).split(',')[1];
				resolve(base64);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	/**
	 * Convert ArrayBuffer to base64
	 */
	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	/**
	 * Generate unique filename with timestamp
	 */
	private generateUniqueFileName(originalName: string): string {
		const timestamp = Date.now();
		const extension = originalName.split('.').pop() || 'png';
		const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
		const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
		return `${sanitizedName}_${timestamp}.${extension}`;
	}

	/**
	 * Upload image from URL (for converting local images)
	 */
	async uploadFromUrl(imageUrl: string): Promise<string> {
		try {
			// Fetch the image
			const response = await requestUrl({ url: imageUrl });
			const arrayBuffer = response.arrayBuffer;

			// Extract filename from URL
			const fileName = imageUrl.split('/').pop() || 'image.png';

			// Upload to GitHub
			return await this.uploadImage(arrayBuffer, fileName);
		} catch (error) {
			console.error('Failed to upload from URL:', error);
			throw error;
		}
	}

	/**
	 * Batch upload multiple images
	 */
	async uploadMultiple(files: File[]): Promise<string[]> {
		const urls: string[] = [];

		for (const file of files) {
			try {
				const url = await this.uploadImage(file, file.name);
				urls.push(url);
			} catch (error) {
				console.error(`Failed to upload ${file.name}:`, error);
				urls.push(''); // Add empty string to maintain order
			}
		}

		return urls;
	}
}
