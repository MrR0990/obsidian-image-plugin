import {
  Plugin,
  Notice,
  MarkdownView,
  Editor,
  MarkdownFileInfo,
} from "obsidian";
import { ImagePluginSettings } from "./src/types";
import { DEFAULT_SETTINGS, ImagePluginSettingTab } from "./src/settings";
import { GitHubUploader } from "./src/githubUploader";
import { ImageZoomController } from "./src/imageZoom";
import { ImageRenderer } from "./src/imageRenderer";
import { CacheManager } from "./src/cacheManager";
import { ImageDownloader } from "./src/imageDownloader";
import { PasteHandler } from "./src/pasteHandler";

/**
 * Obsidian Image Plugin
 * Provides advanced image management with zoom, resize, GitHub hosting, and smart caching
 */
export default class ImagePlugin extends Plugin {
  settings: ImagePluginSettings;
  private uploader: GitHubUploader;
  private zoomController: ImageZoomController;
  private renderer: ImageRenderer;
  cacheManager: CacheManager; // Public for settings tab access
  private downloader: ImageDownloader;
  private pasteHandler: PasteHandler;

  async onload() {
    console.log("========================================");
    console.log("Loading Image Plugin - START");
    console.log("========================================");

    // Load settings
    console.log("[Main] Loading settings...");
    await this.loadSettings();
    console.log(
      "[Main] Settings loaded:",
      JSON.stringify(this.settings, null, 2),
    );

    // Initialize cache manager first
    console.log("[Main] Initializing CacheManager...");
    this.cacheManager = new CacheManager(this.app.vault, this.settings);
    await this.cacheManager.initialize();
    console.log("[Main] CacheManager initialized");

    // Initialize other modules
    console.log("[Main] Initializing GitHubUploader...");
    this.uploader = new GitHubUploader(this.settings);
    console.log(
      "[Main] GitHubUploader initialized, configured:",
      this.uploader.isConfigured(),
    );

    console.log("[Main] Initializing ImageZoomController...");
    this.zoomController = new ImageZoomController(this.settings);
    console.log("[Main] ImageZoomController initialized");

    console.log("[Main] Initializing ImageDownloader...");
    this.downloader = new ImageDownloader(
      this.settings,
      this.cacheManager,
      this.uploader,
    );
    console.log("[Main] ImageDownloader initialized");

    console.log("[Main] Initializing ImageRenderer...");
    this.renderer = new ImageRenderer(
      this.settings,
      this.zoomController,
      this.uploader,
      this.downloader,
    );
    console.log("[Main] ImageRenderer initialized");

    console.log("[Main] Initializing PasteHandler...");
    this.pasteHandler = new PasteHandler(
      this.settings,
      this.uploader,
      this.cacheManager,
      this.app.vault,
    );
    console.log("[Main] PasteHandler initialized");

    // Register markdown post processor for images
    console.log("[Main] Registering markdown post processor...");
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      console.log("[Main] Markdown post processor triggered");
      await this.renderer.processImages(el, ctx);

      // Also process after a short delay to catch async-loaded images (Wikilinks)
      setTimeout(async () => {
        console.log("[Main] Processing delayed images (for Wikilinks)");
        await this.renderer.processImages(el, ctx);
      }, 100);
    });
    console.log("[Main] Markdown post processor registered");

    // Listen for layout changes to process images in new/switched views
    console.log("[Main] Setting up layout change listener...");
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        console.log("[Main] Layout changed, processing all images");
        setTimeout(async () => {
          const activeView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeView) {
            await this.renderer.processImages(activeView.contentEl, {} as any);
          }
        }, 200);
      }),
    );

    // Also process images when active leaf changes
    console.log("[Main] Setting up active leaf change listener...");
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        console.log("[Main] Active leaf changed, processing images");
        setTimeout(async () => {
          const activeView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeView) {
            await this.renderer.processImages(activeView.contentEl, {} as any);
          }
        }, 200);
      }),
    );

    // Register paste event handler
    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        async (
          evt: ClipboardEvent,
          editor: Editor,
          info: MarkdownView | MarkdownFileInfo,
        ) => {
          const view = info instanceof MarkdownView ? info : null;
          if (view) {
            await this.pasteHandler.handlePaste(evt, editor, view);
          }
        },
      ),
    );

    // Register drop event handler
    this.registerEvent(
      this.app.workspace.on(
        "editor-drop",
        async (
          evt: DragEvent,
          editor: Editor,
          info: MarkdownView | MarkdownFileInfo,
        ) => {
          const view = info instanceof MarkdownView ? info : null;
          if (view) {
            await this.pasteHandler.handleDrop(evt, editor, view);
          }
        },
      ),
    );

    // Add commands
    this.addCommand({
      id: "upload-image-to-github",
      name: "Upload current image to GitHub",
      callback: () => {
        new Notice("Please click on an image and use the upload button");
      },
    });

    this.addCommand({
      id: "test-github-connection",
      name: "Test GitHub connection",
      callback: async () => {
        await this.testGitHubConnection();
      },
    });

    this.addCommand({
      id: "process-all-external-images",
      name: "Process all external images in current note",
      callback: async () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
          const el = activeView.contentEl;
          await this.renderer.processAllExternalImages(el);
          new Notice("All external images processed");
        } else {
          new Notice("No active markdown view");
        }
      },
    });

    this.addCommand({
      id: "clear-image-cache",
      name: "Clear image cache",
      callback: async () => {
        await this.cacheManager.clearAll();
      },
    });

    this.addCommand({
      id: "show-cache-stats",
      name: "Show cache statistics",
      callback: () => {
        const stats = this.cacheManager.getStats();
        new Notice(
          `Cache Stats:\n` +
            `Size: ${stats.totalSizeMB.toFixed(2)} MB\n` +
            `Images: ${stats.imageCount}\n` +
            `Avg Size: ${(stats.averageSize / 1024).toFixed(2)} KB`,
          10000,
        );
      },
    });

    this.addCommand({
      id: "sync-cached-images-to-github",
      name: "Sync cached images to GitHub",
      callback: async () => {
        await this.syncCachedImagesToGitHub();
      },
    });

    // Add settings tab
    this.addSettingTab(new ImagePluginSettingTab(this.app, this));

    // Add ribbon icon
    this.addRibbonIcon("image", "Image Plugin", () => {
      const stats = this.cacheManager.getStats();
      new Notice(
        `Image Plugin Active\n` +
          `Cache: ${stats.imageCount} images (${stats.totalSizeMB.toFixed(2)} MB)`,
      );
    });

    console.log("========================================");
    console.log("Image Plugin loaded successfully");
    console.log("========================================");
  }

  onunload() {
    console.log("========================================");
    console.log("Unloading Image Plugin");
    console.log("========================================");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);

    // Update settings in all modules
    this.uploader?.updateSettings(this.settings);
    this.zoomController?.updateSettings(this.settings);
    this.cacheManager?.updateSettings(this.settings);
    this.downloader?.updateSettings(this.settings);
    this.renderer?.updateSettings(this.settings);
    this.pasteHandler?.updateSettings(this.settings);
  }

  /**
   * Test GitHub connection
   */
  private async testGitHubConnection(): Promise<void> {
    if (this.uploader.isConfigured()) {
      new Notice("GitHub is configured. Testing connection...");
      try {
        // Try to fetch repo info
        const response = await fetch(
          `https://api.github.com/repos/${this.settings.githubRepo}`,
          {
            headers: {
              Authorization: `token ${this.settings.githubToken}`,
            },
          },
        );
        if (response.ok) {
          new Notice("✓ GitHub connection successful!");
        } else {
          new Notice("✗ GitHub connection failed. Check your settings.");
        }
      } catch (error) {
        new Notice("✗ GitHub connection failed: " + error.message);
      }
    } else {
      new Notice("GitHub is not configured. Please configure in settings.");
    }
  }

  /**
   * Sync cached images to GitHub
   * Uploads all cache-only images to GitHub and updates references in notes
   */
  private async syncCachedImagesToGitHub(): Promise<void> {
    console.log("[Main] syncCachedImagesToGitHub START");

    // Check if GitHub is configured
    if (!this.uploader.isConfigured()) {
      new Notice(
        "⚠ GitHub is not configured. Please configure GitHub settings first.",
      );
      console.log("[Main] GitHub not configured, aborting sync");
      return;
    }

    new Notice("🔄 Syncing cached images to GitHub...");
    console.log("[Main] Starting cache sync to GitHub");

    try {
      // Get all cached images
      const stats = this.cacheManager.getStats();
      console.log(`[Main] Found ${stats.imageCount} cached images`);

      if (stats.imageCount === 0) {
        new Notice("No cached images to sync");
        console.log("[Main] No images to sync");
        return;
      }

      // Get cache index to find cache-only images
      const cacheIndex = await this.cacheManager.getAllCached();
      const cacheOnlyImages = cacheIndex.filter(
        (img) => !img.githubUrl && img.url.startsWith("cache://"),
      );

      console.log(
        `[Main] Found ${cacheOnlyImages.length} cache-only images to upload`,
      );

      if (cacheOnlyImages.length === 0) {
        new Notice("✓ All cached images are already on GitHub");
        console.log("[Main] All images already on GitHub");
        return;
      }

      new Notice(
        `Found ${cacheOnlyImages.length} images to upload. Starting sync...`,
      );

      let successCount = 0;
      let failCount = 0;

      // Upload each cache-only image
      for (const cachedImg of cacheOnlyImages) {
        try {
          console.log(`[Main] Uploading cached image: ${cachedImg.url}`);

          // Read image data from cache
          const data = await this.app.vault.adapter.readBinary(
            cachedImg.localPath,
          );

          // Extract filename from cache URL
          const filename = cachedImg.url.replace("cache://", "");

          // Upload to GitHub
          const githubUrl = await this.uploader.uploadImage(data, filename);
          console.log(`[Main] Uploaded to GitHub: ${githubUrl}`);

          // Update cache entry with GitHub URL
          await this.cacheManager.updateGitHubUrl(cachedImg.url, githubUrl);

          // TODO: Update markdown references in notes
          // This would require scanning all markdown files and replacing
          // app://local/... URLs with GitHub URLs

          successCount++;
        } catch (error) {
          console.error(`[Main] Failed to upload ${cachedImg.url}:`, error);
          failCount++;
        }
      }

      // Show summary
      if (failCount === 0) {
        new Notice(`✓ Successfully synced ${successCount} images to GitHub!`);
      } else {
        new Notice(
          `⚠ Synced ${successCount} images, ${failCount} failed. Check console for details.`,
        );
      }

      console.log(
        `[Main] Sync complete: ${successCount} success, ${failCount} failed`,
      );
    } catch (error) {
      console.error("[Main] Sync failed:", error);
      new Notice(`✗ Sync failed: ${error.message}`);
    }
  }
}
