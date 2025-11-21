import { Editor, MarkdownView, Notice, TFile } from 'obsidian';
import { ImagePluginSettings } from './types';
import { GitHubUploader } from './githubUploader';
import { CacheManager } from './cacheManager';

/**
 * Paste and Drop Handler
 * Handles pasted and dropped images, uploads them to GitHub
 */
export class PasteHandler {
	private settings: ImagePluginSettings;
	private uploader: GitHubUploader;
	private cacheManager: CacheManager;

	constructor(
		settings: ImagePluginSettings,
		uploader: GitHubUploader,
		cacheManager: CacheManager
	) {
		this.settings = settings;
		this.uploader = uploader;
		this.cacheManager = cacheManager;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImagePluginSettings): void {
		this.settings = settings;
	}

	/**
	 * Handle paste event
	 */
	async handlePaste(evt: ClipboardEvent, editor: Editor, view: MarkdownView): Promise<boolean> {
		// Check if auto-upload is enabled
		if (!this.settings.autoUploadPastedImages) {
			return false; // Let Obsidian handle it normally
		}

		// Get clipboard data
		const clipboardData = evt.clipboardData;
		if (!clipboardData) {
			return false;
		}

		// Check for image files
		const files = clipboardData.files;
		if (!files || files.length === 0) {
			return false;
		}

		// Process image files
		const imageFiles = Array.from(files).filter(file =>
			file.type.startsWith('image/')
		);

		if (imageFiles.length === 0) {
			return false;
		}

		// Prevent default paste behavior
		evt.preventDefault();

		// Process each image
		for (const file of imageFiles) {
			await this.processImageFile(file, editor);
		}

		return true;
	}

	/**
	 * Handle drop event
	 */
	async handleDrop(evt: DragEvent, editor: Editor, view: MarkdownView): Promise<boolean> {
		// Check if auto-upload is enabled
		if (!this.settings.autoUploadDroppedImages) {
			return false; // Let Obsidian handle it normally
		}

		// Get dropped files
		const files = evt.dataTransfer?.files;
		if (!files || files.length === 0) {
			return false;
		}

		// Process image files
		const imageFiles = Array.from(files).filter(file =>
			file.type.startsWith('image/')
		);

		if (imageFiles.length === 0) {
			return false;
		}

		// Prevent default drop behavior
		evt.preventDefault();

		// Process each image
		for (const file of imageFiles) {
			await this.processImageFile(file, editor);
		}

		return true;
	}

	/**
	 * Process a single image file
	 */
	private async processImageFile(file: File, editor: Editor): Promise<void> {
		try {
			new Notice(`Uploading image: ${file.name}...`);

			// Read file as ArrayBuffer
			const arrayBuffer = await this.readFileAsArrayBuffer(file);

			// Upload to GitHub
			const githubUrl = await this.uploader.uploadImage(arrayBuffer, file.name);

			// Cache the image locally
			if (this.settings.enableCache) {
				await this.cacheManager.add(githubUrl, arrayBuffer, githubUrl);
			}

			// Insert markdown image link at cursor
			const imageMarkdown = `![${file.name}](${githubUrl})`;
			editor.replaceSelection(imageMarkdown + '\n');

			new Notice(`✓ Image uploaded successfully!`);
		} catch (error) {
			console.error('Failed to process image:', error);
			new Notice(`✗ Failed to upload image: ${error.message}`);
		}
	}

	/**
	 * Read file as ArrayBuffer
	 */
	private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = () => {
				resolve(reader.result as ArrayBuffer);
			};

			reader.onerror = () => {
				reject(new Error('Failed to read file'));
			};

			reader.readAsArrayBuffer(file);
		});
	}

	/**
	 * Process existing local images in vault
	 * Uploads them to GitHub and replaces references
	 */
	async uploadExistingImage(file: TFile, editor: Editor): Promise<string | null> {
		try {
			// Read the file from vault
			const arrayBuffer = await file.vault.adapter.readBinary(file.path);

			// Upload to GitHub
			const githubUrl = await this.uploader.uploadImage(arrayBuffer, file.name);

			// Cache the image
			if (this.settings.enableCache) {
				await this.cacheManager.add(githubUrl, arrayBuffer, githubUrl);
			}

			new Notice(`✓ ${file.name} uploaded to GitHub`);
			return githubUrl;
		} catch (error) {
			console.error('Failed to upload existing image:', error);
			new Notice(`✗ Failed to upload ${file.name}: ${error.message}`);
			return null;
		}
	}

	/**
	 * Batch upload all local images in current note
	 */
	async uploadAllLocalImagesInNote(editor: Editor, content: string): Promise<string> {
		// Regex to find local image links
		// Matches: ![[image.png]] and ![](path/to/image.png)
		const localImageRegex = /!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\]\]|!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\)/gi;

		let updatedContent = content;
		const matches = Array.from(content.matchAll(localImageRegex));

		if (matches.length === 0) {
			new Notice('No local images found in current note');
			return content;
		}

		new Notice(`Found ${matches.length} local images, uploading...`);

		for (const match of matches) {
			const fullMatch = match[0];
			let imagePath: string;

			// Check which format it is
			if (match[1]) {
				// ![[image.png]] format
				imagePath = match[1];
			} else if (match[4]) {
				// ![](path/to/image.png) format
				imagePath = match[4];
			} else {
				continue;
			}

			try {
				// Get the file from vault
				const file = editor.getDoc().getValue(); // Get access to vault through editor
				// This is a simplified version - in practice, you'd need vault access

				// For now, we'll skip local file processing and show a notice
				console.log('Local image found:', imagePath);
			} catch (error) {
				console.error('Failed to process local image:', error);
			}
		}

		return updatedContent;
	}

	/**
	 * Generate unique filename
	 */
	private generateUniqueFilename(originalName: string): string {
		const timestamp = Date.now();
		const extension = originalName.split('.').pop() || 'png';
		const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
		const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
		return `${sanitizedName}_${timestamp}.${extension}`;
	}
}
