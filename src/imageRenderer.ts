import { MarkdownPostProcessorContext } from "obsidian";
import { ImageZoomController } from "./imageZoom";
import { GitHubUploader } from "./githubUploader";
import { ImageDownloader } from "./imageDownloader";
import { ImagePluginSettings } from "./types";

/**
 * Image Renderer
 * Processes and enhances images in markdown
 */
export class ImageRenderer {
  private settings: ImagePluginSettings;
  private zoomController: ImageZoomController;
  private uploader: GitHubUploader;
  private downloader: ImageDownloader;

  constructor(
    settings: ImagePluginSettings,
    zoomController: ImageZoomController,
    uploader: GitHubUploader,
    downloader: ImageDownloader,
  ) {
    this.settings = settings;
    this.zoomController = zoomController;
    this.uploader = uploader;
    this.downloader = downloader;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: ImagePluginSettings): void {
    this.settings = settings;
  }

  /**
   * Process images in markdown content
   * This is called by Obsidian's MarkdownPostProcessor
   */
  async processImages(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): Promise<void> {
    // Find all images in the element
    const images = el.querySelectorAll("img");
    console.log(
      `[ImageRenderer] processImages called, found ${images.length} images`,
    );

    // Process each image
    for (const img of Array.from(images)) {
      console.log(`[ImageRenderer] Processing image:`, img.src);
      await this.enhanceImage(img as HTMLImageElement, el);
    }

    console.log(`[ImageRenderer] Finished processing ${images.length} images`);
  }

  /**
   * Enhance a single image
   */
  private async enhanceImage(
    img: HTMLImageElement,
    container: HTMLElement,
  ): Promise<void> {
    console.log(`[ImageRenderer] enhanceImage called for:`, img.src);

    // Skip if already enhanced
    if (img.classList.contains("enhanced-image")) {
      console.log(`[ImageRenderer] Image already enhanced, skipping:`, img.src);
      return;
    }

    // Mark as enhanced
    img.classList.add("enhanced-image");
    console.log(`[ImageRenderer] Marked image as enhanced:`, img.src);

    // Check if image is external and should be processed
    const isExternal = this.downloader.isExternalImage(img.src);
    const isGitHub = this.downloader.isGitHubUrl(img.src);
    console.log(
      `[ImageRenderer] Image external: ${isExternal}, GitHub: ${isGitHub}, autoDownload: ${this.settings.autoDownloadExternalImages}`,
    );

    if (this.settings.autoDownloadExternalImages && isExternal) {
      // Skip if already on GitHub
      if (!isGitHub) {
        console.log(`[ImageRenderer] Processing external image:`, img.src);
        await this.processExternalImage(img);
      } else {
        console.log(
          `[ImageRenderer] Image already on GitHub, skipping:`,
          img.src,
        );
      }
    }

    // Apply zoom and resize functionality
    console.log(`[ImageRenderer] Applying zoom controls:`, img.src);
    this.zoomController.enhanceImage(img, container);
    console.log(`[ImageRenderer] Zoom controls applied:`, img.src);

    // Listen for upload requests
    img.addEventListener("image-upload-requested", async (e: Event) => {
      console.log(`[ImageRenderer] Upload requested for:`, img.src);
      await this.handleUploadRequest(img, e);
    });

    console.log(`[ImageRenderer] Image enhancement complete:`, img.src);
  }

  /**
   * Process external image: download and optionally upload
   */
  private async processExternalImage(img: HTMLImageElement): Promise<void> {
    const originalSrc = img.src;
    console.log(`[ImageRenderer] processExternalImage START for:`, originalSrc);

    try {
      // Add loading indicator
      const wrapper = img.closest(".image-zoom-wrapper");
      if (wrapper) {
        wrapper.classList.add("loading");
        console.log(`[ImageRenderer] Added loading indicator`);
      }

      // Process the image (download, cache, and optionally upload)
      console.log(`[ImageRenderer] Calling downloader.processExternalImage...`);
      const newUrl = await this.downloader.processExternalImage(originalSrc);
      console.log(`[ImageRenderer] Got new URL:`, newUrl);

      // Update image source if it changed
      if (newUrl !== originalSrc) {
        console.log(
          `[ImageRenderer] Updating image src from ${originalSrc} to ${newUrl}`,
        );
        this.updateImageSrc(img, newUrl);
      } else {
        console.log(`[ImageRenderer] URL unchanged, no update needed`);
      }

      // Mark as successfully uploaded if we got a GitHub URL
      if (this.downloader.isGitHubUrl(newUrl)) {
        console.log(`[ImageRenderer] URL is GitHub URL, marking as uploaded`);
        if (wrapper) {
          wrapper.classList.add("uploaded");
        }
      }
    } catch (error) {
      console.error("[ImageRenderer] Failed to process external image:", error);
    } finally {
      // Remove loading indicator
      const wrapper = img.closest(".image-zoom-wrapper");
      if (wrapper) {
        wrapper.classList.remove("loading");
        console.log(`[ImageRenderer] Removed loading indicator`);
      }
    }

    console.log(`[ImageRenderer] processExternalImage END for:`, originalSrc);
  }

  /**
   * Handle image upload request (from upload button)
   */
  private async handleUploadRequest(
    img: HTMLImageElement,
    event: Event,
  ): Promise<void> {
    const customEvent = event as CustomEvent;

    try {
      // Check if image is a remote URL
      if (img.src.startsWith("http://") || img.src.startsWith("https://")) {
        // If it's already on GitHub, skip
        if (this.downloader.isGitHubUrl(img.src)) {
          console.log("Image is already hosted on GitHub");
          return;
        }

        // Process through downloader (which will cache and upload)
        await this.processExternalImage(img);
      } else {
        // Handle local file
        // This requires additional logic to read local files
        console.log("Local file upload not yet implemented");
      }
    } catch (error) {
      console.error("Failed to upload image:", error);
    }
  }

  /**
   * Update image source and maintain size
   */
  private updateImageSrc(img: HTMLImageElement, newSrc: string): void {
    const metadata = this.zoomController.getMetadata(img);
    const currentWidth = metadata?.currentWidth;

    img.src = newSrc;

    // Restore width after src change
    if (currentWidth) {
      img.style.width = `${currentWidth}%`;
    }

    // Update metadata
    if (metadata) {
      metadata.originalSrc = newSrc;
      metadata.githubUrl = newSrc;
      metadata.isUploaded = true;
    }
  }

  /**
   * Batch process all external images in a document
   */
  async processAllExternalImages(el: HTMLElement): Promise<void> {
    const images = el.querySelectorAll("img");
    const externalImages = Array.from(images).filter(
      (img) =>
        this.downloader.isExternalImage(img.src) &&
        !this.downloader.isGitHubUrl(img.src),
    ) as HTMLImageElement[];

    if (externalImages.length === 0) {
      return;
    }

    console.log(`Processing ${externalImages.length} external images...`);

    // Collect URLs
    const urls = externalImages.map((img) => img.src);

    // Process in batch
    const results = await this.downloader.processMultiple(urls);

    // Update image sources
    for (const img of externalImages) {
      const newUrl = results.get(img.src);
      if (newUrl && newUrl !== img.src) {
        this.updateImageSrc(img, newUrl);
      }
    }

    console.log("Batch processing complete");
  }
}
