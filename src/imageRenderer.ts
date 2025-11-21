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

    // Process each image
    for (const img of Array.from(images)) {
      await this.enhanceImage(img as HTMLImageElement, el);
    }
  }

  /**
   * Enhance a single image
   */
  private async enhanceImage(
    img: HTMLImageElement,
    container: HTMLElement,
  ): Promise<void> {
    // Skip if already enhanced
    if (img.classList.contains("enhanced-image")) {
      return;
    }

    // Mark as enhanced
    img.classList.add("enhanced-image");

    // Check if image is external and should be processed
    if (
      this.settings.autoDownloadExternalImages &&
      this.downloader.isExternalImage(img.src)
    ) {
      // Skip if already on GitHub
      if (!this.downloader.isGitHubUrl(img.src)) {
        await this.processExternalImage(img);
      }
    }

    // Apply zoom and resize functionality
    this.zoomController.enhanceImage(img, container);

    // Listen for upload requests
    img.addEventListener("image-upload-requested", async (e: Event) => {
      await this.handleUploadRequest(img, e);
    });
  }

  /**
   * Process external image: download and optionally upload
   */
  private async processExternalImage(img: HTMLImageElement): Promise<void> {
    const originalSrc = img.src;

    try {
      // Add loading indicator
      const wrapper = img.closest(".image-zoom-wrapper");
      if (wrapper) {
        wrapper.classList.add("loading");
      }

      // Process the image (download, cache, and optionally upload)
      const newUrl = await this.downloader.processExternalImage(originalSrc);

      // Update image source if it changed
      if (newUrl !== originalSrc) {
        this.updateImageSrc(img, newUrl);
      }

      // Mark as successfully uploaded if we got a GitHub URL
      if (this.downloader.isGitHubUrl(newUrl)) {
        if (wrapper) {
          wrapper.classList.add("uploaded");
        }
      }
    } catch (error) {
      console.error("Failed to process external image:", error);
    } finally {
      // Remove loading indicator
      const wrapper = img.closest(".image-zoom-wrapper");
      if (wrapper) {
        wrapper.classList.remove("loading");
      }
    }
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
