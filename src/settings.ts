import { App, PluginSettingTab, Setting } from "obsidian";
import type ImagePlugin from "../main";
import { ImagePluginSettings } from "./types";

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: ImagePluginSettings = {
  githubToken: "",
  githubRepo: "",
  githubBranch: "main",
  githubPath: "images/",
  defaultWidth: 100,
  enableClickZoom: true,
  enableDragResize: true,
  zoomPresets: [25, 50, 75, 100, 150, 200],
  autoUploadPastedImages: false,
  autoUploadDroppedImages: false,
  autoDownloadExternalImages: true,
  enableCache: true,
  maxCacheSize: 0, // 0 means unlimited
  cacheProtectionDays: 7,
  cacheStrategy: "smart",
};

/**
 * Settings tab for the plugin
 */
export class ImagePluginSettingTab extends PluginSettingTab {
  plugin: ImagePlugin;

  constructor(app: App, plugin: ImagePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // GitHub Image Hosting Section
    containerEl.createEl("h2", { text: "GitHub Image Hosting" });

    new Setting(containerEl)
      .setName("GitHub Token")
      .setDesc("Personal access token with repo permissions")
      .addText((text) =>
        text
          .setPlaceholder("ghp_xxxxxxxxxxxx")
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("GitHub Repository")
      .setDesc("Repository to store images (format: username/repo)")
      .addText((text) =>
        text
          .setPlaceholder("username/repo")
          .setValue(this.plugin.settings.githubRepo)
          .onChange(async (value) => {
            this.plugin.settings.githubRepo = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Branch")
      .setDesc("Branch to upload images to")
      .addText((text) =>
        text
          .setPlaceholder("main")
          .setValue(this.plugin.settings.githubBranch)
          .onChange(async (value) => {
            this.plugin.settings.githubBranch = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Storage Path")
      .setDesc("Path in repository to store images")
      .addText((text) =>
        text
          .setPlaceholder("images/")
          .setValue(this.plugin.settings.githubPath)
          .onChange(async (value) => {
            this.plugin.settings.githubPath = value;
            await this.plugin.saveSettings();
          }),
      );

    // Image Display Section
    containerEl.createEl("h2", { text: "Image Display Settings" });

    new Setting(containerEl)
      .setName("Default Image Width")
      .setDesc("Default width for images (percentage, 1-100)")
      .addSlider((slider) =>
        slider
          .setLimits(1, 100, 1)
          .setValue(this.plugin.settings.defaultWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.defaultWidth = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Enable Click to Zoom")
      .setDesc("Click on images to toggle full size")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableClickZoom)
          .onChange(async (value) => {
            this.plugin.settings.enableClickZoom = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Enable Drag to Resize")
      .setDesc("Drag image corners to resize")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDragResize)
          .onChange(async (value) => {
            this.plugin.settings.enableDragResize = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Zoom Presets")
      .setDesc("Comma-separated zoom percentages (e.g., 25,50,75,100)")
      .addText((text) =>
        text
          .setPlaceholder("25,50,75,100,150,200")
          .setValue(this.plugin.settings.zoomPresets.join(","))
          .onChange(async (value) => {
            const presets = value
              .split(",")
              .map((v) => parseInt(v.trim()))
              .filter((v) => !isNaN(v) && v > 0);
            this.plugin.settings.zoomPresets = presets;
            await this.plugin.saveSettings();
          }),
      );

    // Auto Upload Section
    containerEl.createEl("h2", { text: "Auto Upload Settings" });

    new Setting(containerEl)
      .setName("Auto Download External Images")
      .setDesc(
        "Automatically download and upload external images from web clippings",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoDownloadExternalImages)
          .onChange(async (value) => {
            this.plugin.settings.autoDownloadExternalImages = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto Upload Pasted Images")
      .setDesc("Automatically upload images pasted into notes")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoUploadPastedImages)
          .onChange(async (value) => {
            this.plugin.settings.autoUploadPastedImages = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto Upload Dropped Images")
      .setDesc("Automatically upload images dropped into notes")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoUploadDroppedImages)
          .onChange(async (value) => {
            this.plugin.settings.autoUploadDroppedImages = value;
            await this.plugin.saveSettings();
          }),
      );

    // Cache Settings Section
    containerEl.createEl("h2", { text: "Cache Settings" });

    new Setting(containerEl)
      .setName("Enable Cache")
      .setDesc("Cache downloaded images locally for faster loading")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCache)
          .onChange(async (value) => {
            this.plugin.settings.enableCache = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max Cache Size")
      .setDesc("Maximum cache size in MB (0 = unlimited)")
      .addText((text) =>
        text
          .setPlaceholder("0")
          .setValue(String(this.plugin.settings.maxCacheSize))
          .onChange(async (value) => {
            const size = parseInt(value);
            if (!isNaN(size) && size >= 0) {
              this.plugin.settings.maxCacheSize = size;
              await this.plugin.saveSettings();

              // Trigger cleanup if new limit is set
              if (size > 0 && this.plugin.cacheManager) {
                await this.plugin.cacheManager.checkAndCleanup();
              }
            }
          }),
      );

    new Setting(containerEl)
      .setName("Cache Protection Days")
      .setDesc(
        "Number of days to protect recently accessed images from cleanup",
      )
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.cacheProtectionDays)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.cacheProtectionDays = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Cache Strategy")
      .setDesc("Strategy for removing cached images when limit is reached")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("lru", "LRU (Least Recently Used)")
          .addOption("lfu", "LFU (Least Frequently Used)")
          .addOption("fifo", "FIFO (First In First Out)")
          .addOption("smart", "Smart (Recommended)")
          .setValue(this.plugin.settings.cacheStrategy)
          .onChange(async (value: any) => {
            this.plugin.settings.cacheStrategy = value;
            await this.plugin.saveSettings();
          }),
      );

    // Cache Statistics
    if (this.plugin.cacheManager) {
      const stats = this.plugin.cacheManager.getStats();

      const statsContainer = containerEl.createDiv("cache-stats");
      statsContainer.createEl("h3", { text: "Cache Statistics" });

      statsContainer.createEl("p", {
        text: `Total size: ${stats.totalSizeMB.toFixed(2)} MB`,
      });
      statsContainer.createEl("p", {
        text: `Image count: ${stats.imageCount}`,
      });
      statsContainer.createEl("p", {
        text: `Average size: ${(stats.averageSize / 1024).toFixed(2)} KB`,
      });

      new Setting(statsContainer)
        .setName("Clear Cache")
        .setDesc("Remove all cached images")
        .addButton((button) =>
          button
            .setButtonText("Clear All")
            .setWarning()
            .onClick(async () => {
              if (this.plugin.cacheManager) {
                await this.plugin.cacheManager.clearAll();
                this.display(); // Refresh display
              }
            }),
        );
    }
  }
}
