import { Notice, requestUrl } from "obsidian";
import { ImagePluginSettings, GitHubUploadResponse } from "./types";

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
  async uploadImage(
    file: File | ArrayBuffer,
    fileName: string,
    customPath?: string,
  ): Promise<string> {
    console.log(`[GitHubUploader] uploadImage START, fileName: ${fileName}`);

    if (!this.isConfigured()) {
      console.error(`[GitHubUploader] GitHub is not configured!`);
      throw new Error(
        "GitHub is not configured. Please configure in settings.",
      );
    }

    try {
      // Convert file to base64
      console.log(`[GitHubUploader] Converting file to base64...`);
      const base64Content = await this.fileToBase64(file);
      console.log(
        `[GitHubUploader] Base64 conversion complete, length: ${base64Content.length}`,
      );

      // Generate unique filename if needed
      const uniqueFileName = this.generateUniqueFileName(fileName);
      const path = (customPath || this.settings.githubPath) + uniqueFileName;
      console.log(`[GitHubUploader] Target path: ${path}`);

      // Upload to GitHub
      const url = `https://api.github.com/repos/${this.settings.githubRepo}/contents/${path}`;
      console.log(`[GitHubUploader] Uploading to GitHub API: ${url}`);

      const response = await requestUrl({
        url: url,
        method: "PUT",
        headers: {
          Authorization: `token ${this.settings.githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Upload image: ${uniqueFileName}`,
          content: base64Content,
          branch: this.settings.githubBranch,
        }),
      });

      console.log(
        `[GitHubUploader] GitHub API response status: ${response.status}`,
      );

      if (response.status === 201) {
        const data = response.json as GitHubUploadResponse;
        const downloadUrl = data.content.download_url;
        console.log(
          `[GitHubUploader] Upload successful! Download URL: ${downloadUrl}`,
        );
        new Notice(`Image uploaded successfully: ${uniqueFileName}`);
        return downloadUrl;
      } else {
        console.error(
          `[GitHubUploader] Upload failed with status: ${response.status}`,
        );
        throw new Error(`Upload failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error("[GitHubUploader] GitHub upload error:", error);
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
        const base64 = (reader.result as string).split(",")[1];
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
    let binary = "";
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
    const extension = originalName.split(".").pop() || "png";
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, "_");
    return `${sanitizedName}_${timestamp}.${extension}`;
  }

  /**
   * Upload image from URL (for converting local images)
   */
  async uploadFromUrl(imageUrl: string): Promise<string> {
    console.log(`[GitHubUploader] uploadFromUrl START, URL: ${imageUrl}`);

    try {
      // Fetch the image
      console.log(`[GitHubUploader] Fetching image from URL...`);
      const response = await requestUrl({ url: imageUrl });
      const arrayBuffer = response.arrayBuffer;
      console.log(
        `[GitHubUploader] Image fetched, size: ${arrayBuffer.byteLength} bytes`,
      );

      // Extract filename from URL
      const fileName = imageUrl.split("/").pop() || "image.png";
      console.log(`[GitHubUploader] Extracted filename: ${fileName}`);

      // Upload to GitHub
      console.log(`[GitHubUploader] Uploading to GitHub...`);
      const result = await this.uploadImage(arrayBuffer, fileName);
      console.log(`[GitHubUploader] uploadFromUrl END, result: ${result}`);
      return result;
    } catch (error) {
      console.error("[GitHubUploader] Failed to upload from URL:", error);
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
        urls.push(""); // Add empty string to maintain order
      }
    }

    return urls;
  }
}
