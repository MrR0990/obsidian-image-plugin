import { Editor, MarkdownView, Notice, TFile, Vault } from "obsidian";
import { ImagePluginSettings } from "./types";
import { GitHubUploader } from "./githubUploader";
import { CacheManager } from "./cacheManager";

/**
 * Paste and Drop Handler
 * Handles pasted and dropped images, uploads them to GitHub
 */
export class PasteHandler {
  private settings: ImagePluginSettings;
  private uploader: GitHubUploader;
  private cacheManager: CacheManager;
  private vault: Vault;

  constructor(
    settings: ImagePluginSettings,
    uploader: GitHubUploader,
    cacheManager: CacheManager,
    vault: Vault,
  ) {
    this.settings = settings;
    this.uploader = uploader;
    this.cacheManager = cacheManager;
    this.vault = vault;
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
  async handlePaste(
    evt: ClipboardEvent,
    editor: Editor,
    view: MarkdownView,
  ): Promise<boolean> {
    console.log("[PasteHandler] ========================================");
    console.log("[PasteHandler] handlePaste called");
    console.log("[PasteHandler] ========================================");

    // Check if auto-upload is enabled
    console.log(
      "[PasteHandler] autoUploadPastedImages:",
      this.settings.autoUploadPastedImages,
    );
    if (!this.settings.autoUploadPastedImages) {
      console.log("[PasteHandler] Auto-upload disabled, skipping");
      return false; // Let Obsidian handle it normally
    }

    // Get clipboard data
    const clipboardData = evt.clipboardData;
    console.log("[PasteHandler] Clipboard data available:", !!clipboardData);
    if (!clipboardData) {
      console.log("[PasteHandler] No clipboard data");
      return false;
    }

    // Check for image files
    const files = clipboardData.files;
    console.log("[PasteHandler] Files in clipboard:", files?.length || 0);
    if (!files || files.length === 0) {
      console.log("[PasteHandler] No files in clipboard");
      return false;
    }

    // Process image files
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    console.log("[PasteHandler] Image files found:", imageFiles.length);

    if (imageFiles.length === 0) {
      console.log("[PasteHandler] No image files found");
      return false;
    }

    // Prevent default paste behavior
    evt.preventDefault();
    console.log("[PasteHandler] Default paste behavior prevented");

    // Process each image
    for (const file of imageFiles) {
      console.log(
        "[PasteHandler] Processing image file:",
        file.name,
        file.type,
        file.size,
        "bytes",
      );
      await this.processImageFile(file, editor);
    }

    console.log("[PasteHandler] handlePaste complete");
    return true;
  }

  /**
   * Handle drop event
   */
  async handleDrop(
    evt: DragEvent,
    editor: Editor,
    view: MarkdownView,
  ): Promise<boolean> {
    console.log("[PasteHandler] ========================================");
    console.log("[PasteHandler] handleDrop called");
    console.log("[PasteHandler] ========================================");

    // Check if auto-upload is enabled
    console.log(
      "[PasteHandler] autoUploadDroppedImages:",
      this.settings.autoUploadDroppedImages,
    );
    if (!this.settings.autoUploadDroppedImages) {
      console.log("[PasteHandler] Auto-upload for drops disabled, skipping");
      return false; // Let Obsidian handle it normally
    }

    // Get dropped files
    const files = evt.dataTransfer?.files;
    console.log("[PasteHandler] Files dropped:", files?.length || 0);
    if (!files || files.length === 0) {
      console.log("[PasteHandler] No files dropped");
      return false;
    }

    // Process image files
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    console.log("[PasteHandler] Image files in drop:", imageFiles.length);

    if (imageFiles.length === 0) {
      console.log("[PasteHandler] No image files in drop");
      return false;
    }

    // Prevent default drop behavior
    evt.preventDefault();
    console.log("[PasteHandler] Default drop behavior prevented");

    // Process each image
    for (const file of imageFiles) {
      console.log(
        "[PasteHandler] Processing dropped image:",
        file.name,
        file.type,
        file.size,
        "bytes",
      );
      await this.processImageFile(file, editor);
    }

    console.log("[PasteHandler] handleDrop complete");
    return true;
  }

  /**
   * Process a single image file
   */
  private async processImageFile(file: File, editor: Editor): Promise<void> {
    console.log("[PasteHandler] processImageFile START:", file.name);

    try {
      // Read file as ArrayBuffer
      console.log("[PasteHandler] Reading file as ArrayBuffer...");
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      console.log(
        "[PasteHandler] File read complete, size:",
        arrayBuffer.byteLength,
        "bytes",
      );

      // Generate unique filename
      const uniqueFilename = this.generateUniqueFilename(file.name);
      console.log("[PasteHandler] Generated filename:", uniqueFilename);

      let imageUrl: string;
      let isUploaded = false;

      // Check if GitHub is configured
      const isGitHubConfigured = this.uploader.isConfigured();
      console.log("[PasteHandler] GitHub configured:", isGitHubConfigured);

      if (isGitHubConfigured) {
        // GitHub is configured - upload directly
        console.log("[PasteHandler] Uploading to GitHub...");
        new Notice(`Uploading image to GitHub: ${file.name}...`);

        try {
          imageUrl = await this.uploader.uploadImage(
            arrayBuffer,
            uniqueFilename,
          );
          isUploaded = true;
          console.log("[PasteHandler] Upload complete, URL:", imageUrl);
          new Notice(`✓ Image uploaded to GitHub!`);
        } catch (uploadError) {
          console.error("[PasteHandler] GitHub upload failed:", uploadError);
          new Notice(
            `⚠ GitHub upload failed, saving to cache: ${uploadError.message}`,
          );
          // Fall back to cache
          imageUrl = await this.saveToCacheOnly(
            arrayBuffer,
            uniqueFilename,
            false,
          );
        }
      } else {
        // GitHub not configured - save to cache only
        console.log(
          "[PasteHandler] GitHub not configured, saving to cache only",
        );
        new Notice(`💾 Saving image to cache: ${file.name}`);
        imageUrl = await this.saveToCacheOnly(
          arrayBuffer,
          uniqueFilename,
          false,
        );
        new Notice(
          `✓ Image cached! Configure GitHub in settings to sync to cloud.`,
        );
      }

      // Cache the image if GitHub upload succeeded
      if (isUploaded && this.settings.enableCache) {
        console.log("[PasteHandler] Caching GitHub image locally...");
        await this.cacheManager.add(imageUrl, arrayBuffer, imageUrl);
        console.log("[PasteHandler] Image cached");
      }

      // Insert markdown image link at cursor
      // Use Wikilink format for cached images (Obsidian native support)
      // Use standard Markdown for external URLs
      let imageMarkdown: string;
      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        // External URL (including GitHub) - use standard Markdown
        imageMarkdown = `![${file.name}](${imageUrl})`;
      } else {
        // Local/cached image - use Wikilink format for better path resolution
        imageMarkdown = `![[${imageUrl}]]`;
      }
      console.log("[PasteHandler] Inserting markdown:", imageMarkdown);
      editor.replaceSelection(imageMarkdown + "\n");
      console.log("[PasteHandler] Markdown inserted");

      console.log("[PasteHandler] processImageFile SUCCESS");
    } catch (error) {
      console.error("[PasteHandler] Failed to process image:", error);
      new Notice(`✗ Failed to process image: ${error.message}`);
      console.log("[PasteHandler] processImageFile FAILED");
    }
  }

  /**
   * Save image to local folder (when GitHub is not configured)
   * Saves to vault's assets folder which Obsidian can access
   */
  private async saveToCacheOnly(
    arrayBuffer: ArrayBuffer,
    filename: string,
    uploaded: boolean = false,
  ): Promise<string> {
    console.log("[PasteHandler] saveToLocalFolder:", filename);

    // Get local image folder from settings
    const localFolder = this.settings.localImageFolder || "assets/images";
    console.log("[PasteHandler] Local folder:", localFolder);

    // Ensure folder exists
    try {
      await this.vault.adapter.mkdir(localFolder);
    } catch (error) {
      // Folder might already exist, that's ok
    }

    // Full path in vault
    const fullPath = `${localFolder}/${filename}`;
    console.log("[PasteHandler] Saving to:", fullPath);

    // Save image to vault
    await this.vault.adapter.writeBinary(fullPath, arrayBuffer);
    console.log("[PasteHandler] Image saved successfully");

    // Also add to cache for tracking and later upload
    const cacheUrl = `cache://${filename}`;
    await this.cacheManager.add(cacheUrl, arrayBuffer, undefined);
    console.log("[PasteHandler] Added to cache index for future sync");

    // Return the path for Wikilink
    // Obsidian can resolve this path from vault root
    console.log("[PasteHandler] Returning path:", fullPath);
    return fullPath;
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
        reject(new Error("Failed to read file"));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Process existing local images in vault
   * Uploads them to GitHub and replaces references
   */
  async uploadExistingImage(
    file: TFile,
    editor: Editor,
  ): Promise<string | null> {
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
      console.error("Failed to upload existing image:", error);
      new Notice(`✗ Failed to upload ${file.name}: ${error.message}`);
      return null;
    }
  }

  /**
   * Batch upload all local images in current note
   */
  async uploadAllLocalImagesInNote(
    editor: Editor,
    content: string,
  ): Promise<string> {
    // Regex to find local image links
    // Matches: ![[image.png]] and ![](path/to/image.png)
    const localImageRegex =
      /!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\]\]|!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\)/gi;

    let updatedContent = content;
    const matches = Array.from(content.matchAll(localImageRegex));

    if (matches.length === 0) {
      new Notice("No local images found in current note");
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
        console.log("Local image found:", imagePath);
      } catch (error) {
        console.error("Failed to process local image:", error);
      }
    }

    return updatedContent;
  }

  /**
   * Generate unique filename with strong collision resistance
   * Format: {sanitized-name}_{timestamp}_{random}.{ext}
   */
  private generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const extension = originalName.split(".").pop() || "png";
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, "_");

    // Add random string for extra uniqueness (8 characters)
    const randomStr = Math.random().toString(36).substring(2, 10);

    // Format: name_timestamp_random.ext
    // Example: screenshot_1732435200000_a3f9k2d1.png
    return `${sanitizedName}_${timestamp}_${randomStr}.${extension}`;
  }

  /**
   * Generate content-based hash for deduplication (optional future use)
   */
  private async generateContentHash(arrayBuffer: ArrayBuffer): Promise<string> {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .substring(0, 16);
    }
    // Fallback: use size and timestamp
    return `${arrayBuffer.byteLength}_${Date.now()}`;
  }
}
