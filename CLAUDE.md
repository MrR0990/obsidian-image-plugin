# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Obsidian Image Plugin** that provides advanced image management capabilities:

- **Interactive Image Zoom**: Click to zoom, preset size buttons, drag-to-resize
- **GitHub Image Hosting**: Upload images directly to GitHub repository as a CDN
- **Automatic Enhancement**: All images in markdown are automatically enhanced with controls

The plugin intercepts Obsidian's markdown rendering to add interactive controls to all images.

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (watches for changes and rebuilds automatically)
npm run dev

# Production build (with type checking)
npm run build

# Version bump (updates manifest.json and versions.json)
npm run version
```

## Project Structure

```
ObsidianImage/
├── main.ts                  # Plugin entry point, coordinates all modules
├── src/
│   ├── types.ts            # TypeScript interfaces and types
│   ├── settings.ts         # Settings management and UI
│   ├── githubUploader.ts   # GitHub API integration for image hosting
│   ├── imageZoom.ts        # Image zoom and resize functionality
│   └── imageRenderer.ts    # Markdown post-processor for images
├── styles.css              # Plugin styles (controls, buttons, animations)
├── manifest.json           # Plugin metadata
├── esbuild.config.mjs      # Build configuration
└── CLAUDE.md               # This file
```

## Architecture

### Module Responsibilities

**main.ts** - Plugin Coordinator
- Initializes all modules
- Registers markdown post-processor
- Provides commands and settings UI
- Manages plugin lifecycle

**src/types.ts** - Type Definitions
- `ImagePluginSettings`: Plugin configuration interface
- `GitHubUploadResponse`: GitHub API response types
- `ImageMetadata`: Image tracking data

**src/settings.ts** - Settings Management
- `DEFAULT_SETTINGS`: Default configuration
- `ImagePluginSettingTab`: Settings UI component
- Handles GitHub config, display settings, auto-upload options

**src/githubUploader.ts** - GitHub Integration
- `GitHubUploader` class handles all GitHub API interactions
- Uploads images using GitHub Contents API
- Converts images to base64 for API
- Generates unique filenames with timestamps
- Methods:
  - `uploadImage()`: Upload file or ArrayBuffer
  - `uploadFromUrl()`: Fetch and upload from URL
  - `uploadMultiple()`: Batch upload

**src/imageZoom.ts** - Image Enhancement
- `ImageZoomController` class manages image interactions
- Creates wrapper elements with controls
- Implements zoom presets, click-to-zoom, drag-to-resize
- Uses WeakMap to store metadata without memory leaks
- Key methods:
  - `enhanceImage()`: Main enhancement entry point
  - `addZoomControls()`: Creates button overlay
  - `addClickZoom()`: Toggle zoom on click
  - `addDragResize()`: Corner handle for resizing

**src/imageRenderer.ts** - Rendering Pipeline
- `ImageRenderer` class processes markdown images
- Registered as MarkdownPostProcessor
- Finds all `<img>` tags and enhances them
- Listens for 'image-upload-requested' custom events
- Coordinates between zoom controller and uploader

### Data Flow

1. **Image Rendering**:
   ```
   Markdown → Obsidian Parser → MarkdownPostProcessor → ImageRenderer.processImages()
   → ImageZoomController.enhanceImage() → Enhanced Image with Controls
   ```

2. **Image Upload**:
   ```
   User clicks Upload → Custom Event → ImageRenderer.handleUploadRequest()
   → GitHubUploader.uploadImage() → GitHub API → New URL → Update Image src
   ```

3. **Settings Update**:
   ```
   User changes setting → ImagePluginSettingTab.onChange() → Plugin.saveSettings()
   → Update all module settings → Re-render if needed
   ```

## Key Implementation Details

### Markdown Post-Processing

The plugin uses `registerMarkdownPostProcessor()` to intercept rendered markdown:

```typescript
this.registerMarkdownPostProcessor((el, ctx) => {
    this.renderer.processImages(el, ctx);
});
```

This runs after Obsidian renders markdown to HTML, allowing us to enhance `<img>` elements.

### Image Enhancement Strategy

Images are wrapped in a container for positioning controls:

```
<div class="image-zoom-wrapper">
    <img class="enhanced-image" />
    <div class="image-zoom-controls">...</div>
    <div class="image-resize-handle">⊙</div>
</div>
```

Controls are hidden by default and shown on hover using CSS.

### GitHub API Integration

Uses GitHub Contents API to upload images:
- Endpoint: `PUT /repos/:owner/:repo/contents/:path`
- Requires: Personal Access Token with `repo` scope
- Images are base64 encoded before upload
- Returns `download_url` for direct image access

### Memory Management

`WeakMap` is used to store image metadata, ensuring:
- Metadata is garbage collected when image elements are removed
- No memory leaks from orphaned data
- Efficient lookup by image element reference

### Settings Synchronization

When settings change, all modules are updated:

```typescript
async saveSettings() {
    await this.saveData(this.settings);
    this.uploader?.updateSettings(this.settings);
    this.zoomController?.updateSettings(this.settings);
}
```

This ensures consistent behavior across all modules.

## Testing

Manual testing in Obsidian:

1. Build: `npm run dev`
2. Copy files to vault:
   - `main.js`
   - `manifest.json`
   - `styles.css`
   
   To: `<vault>/.obsidian/plugins/obsidian-image-plugin/`

3. Enable in Obsidian Settings → Community Plugins
4. Test features:
   - Insert image in note
   - Hover to see controls
   - Click preset buttons to resize
   - Drag corner handle to resize
   - Click image to toggle zoom
   - Configure GitHub settings
   - Test upload functionality

## GitHub Configuration

To use image hosting:

1. Create a GitHub repository for images
2. Generate Personal Access Token:
   - Settings → Developer settings → Personal access tokens
   - Scope: `repo` (full control)
3. Configure in plugin settings:
   - Token: `ghp_...`
   - Repo: `username/repo-name`
   - Branch: `main` (or your branch)
   - Path: `images/` (or your path)

## Common Development Tasks

**Adding a new zoom preset:**
- Modify `DEFAULT_SETTINGS.zoomPresets` in `src/settings.ts`
- UI automatically generates buttons from this array

**Changing default image size:**
- Modify `DEFAULT_SETTINGS.defaultWidth` in `src/settings.ts`

**Adding new image enhancement:**
- Extend `ImageZoomController.enhanceImage()` in `src/imageZoom.ts`
- Add styles to `styles.css`

**Modifying upload logic:**
- Edit `GitHubUploader` methods in `src/githubUploader.ts`
- Handle errors with `Notice` for user feedback

## Notes for Future Development

- Consider adding support for other image hosts (S3, Imgur, etc.)
- Implement local caching for uploaded images
- Add image optimization (compression) before upload
- Support for batch operations on multiple images
- Add keyboard shortcuts for common operations
- Implement undo/redo for image modifications
