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
    console.log("Loading Image Plugin");

    // Load settings
    await this.loadSettings();

    // Initialize cache manager first
    this.cacheManager = new CacheManager(this.app.vault, this.settings);
    await this.cacheManager.initialize();

    // Initialize other modules
    this.uploader = new GitHubUploader(this.settings);
    this.zoomController = new ImageZoomController(this.settings);
    this.downloader = new ImageDownloader(
      this.settings,
      this.cacheManager,
      this.uploader,
    );
    this.renderer = new ImageRenderer(
      this.settings,
      this.zoomController,
      this.uploader,
      this.downloader,
    );
    this.pasteHandler = new PasteHandler(
      this.settings,
      this.uploader,
      this.cacheManager,
    );

    // Register markdown post processor for images
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      await this.renderer.processImages(el, ctx);
    });

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

    console.log("Image Plugin loaded successfully");
  }

  onunload() {
    console.log("Unloading Image Plugin");
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
