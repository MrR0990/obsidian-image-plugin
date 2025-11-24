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
    );
    console.log("[Main] PasteHandler initialized");

    // Register markdown post processor for images
    console.log("[Main] Registering markdown post processor...");
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      console.log("[Main] Markdown post processor triggered");
      await this.renderer.processImages(el, ctx);
    });
    console.log("[Main] Markdown post processor registered");

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
}
