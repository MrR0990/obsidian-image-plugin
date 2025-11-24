import { ImagePluginSettings, ImageMetadata } from "./types";

/**
 * Image Zoom Controller
 * Handles image zoom, resize, and drag functionality
 */
export class ImageZoomController {
  private settings: ImagePluginSettings;
  private imageMetadata: WeakMap<HTMLImageElement, ImageMetadata>;

  constructor(settings: ImagePluginSettings) {
    this.settings = settings;
    this.imageMetadata = new WeakMap();
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: ImagePluginSettings): void {
    this.settings = settings;
  }

  /**
   * Enhance an image element with zoom and resize capabilities
   */
  enhanceImage(img: HTMLImageElement, container: HTMLElement): void {
    console.log(`[ImageZoom] enhanceImage called for:`, img.src);

    // Store original metadata
    console.log(`[ImageZoom] Storing image metadata...`);
    this.storeImageMetadata(img);

    // Wrap image in a container if not already wrapped
    console.log(`[ImageZoom] Creating image wrapper...`);
    const wrapper = this.createImageWrapper(img, container);
    console.log(`[ImageZoom] Wrapper created:`, wrapper.className);

    // Add zoom controls
    console.log(`[ImageZoom] Adding zoom controls...`);
    this.addZoomControls(img, wrapper);
    console.log(`[ImageZoom] Zoom controls added`);

    // Add click to zoom functionality
    if (this.settings.enableClickZoom) {
      console.log(`[ImageZoom] Adding click zoom functionality...`);
      this.addClickZoom(img);
    } else {
      console.log(`[ImageZoom] Click zoom disabled in settings`);
    }

    // Add drag to resize functionality
    if (this.settings.enableDragResize) {
      console.log(`[ImageZoom] Adding drag resize functionality...`);
      this.addDragResize(img, wrapper);
    } else {
      console.log(`[ImageZoom] Drag resize disabled in settings`);
    }

    // Set initial width
    console.log(
      `[ImageZoom] Setting initial width to ${this.settings.defaultWidth}%`,
    );
    this.setImageWidth(img, this.settings.defaultWidth);

    console.log(`[ImageZoom] Image enhancement complete for:`, img.src);
  }

  /**
   * Store image metadata
   */
  private storeImageMetadata(img: HTMLImageElement): void {
    const metadata: ImageMetadata = {
      originalSrc: img.src,
      currentWidth: this.settings.defaultWidth,
      aspectRatio: 0, // Will be set after image loads
      isUploaded: false,
    };

    // Calculate aspect ratio when image loads
    if (img.complete) {
      metadata.aspectRatio = img.naturalWidth / img.naturalHeight;
    } else {
      img.addEventListener("load", () => {
        metadata.aspectRatio = img.naturalWidth / img.naturalHeight;
      });
    }

    this.imageMetadata.set(img, metadata);
  }

  /**
   * Create wrapper for image
   */
  private createImageWrapper(
    img: HTMLImageElement,
    container: HTMLElement,
  ): HTMLElement {
    // Check if already wrapped
    if (img.parentElement?.classList.contains("image-zoom-wrapper")) {
      return img.parentElement;
    }

    const wrapper = document.createElement("div");
    wrapper.classList.add("image-zoom-wrapper");
    wrapper.contentEditable = "false";
    wrapper.setAttribute("contenteditable", "false");

    // Insert wrapper before image
    img.parentNode?.insertBefore(wrapper, img);

    // Move image into wrapper
    wrapper.appendChild(img);

    return wrapper;
  }

  /**
   * Add zoom control buttons
   */
  private addZoomControls(img: HTMLImageElement, wrapper: HTMLElement): void {
    console.log(
      `[ImageZoom] addZoomControls START, presets:`,
      this.settings.zoomPresets,
    );

    const controls = document.createElement("div");
    controls.classList.add("image-zoom-controls");
    controls.style.display = "none"; // Hidden by default
    controls.contentEditable = "false"; // Prevent editor interference
    controls.setAttribute("contenteditable", "false");
    console.log(`[ImageZoom] Created controls div`);

    // Create preset buttons
    this.settings.zoomPresets.forEach((preset) => {
      const btn = document.createElement("button");
      btn.classList.add("image-zoom-btn");
      btn.textContent = `${preset}%`;
      btn.type = "button"; // Explicitly set button type
      btn.contentEditable = "false";
      btn.setAttribute("contenteditable", "false");

      btn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          console.log(`[ImageZoom] Preset button clicked: ${preset}%`);
          this.setImageWidth(img, preset);
          return false;
        },
        true,
      ); // Use capture phase

      // Also prevent mousedown to stop any editor selection
      btn.addEventListener(
        "mousedown",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        true,
      );

      controls.appendChild(btn);
      console.log(`[ImageZoom] Added preset button: ${preset}%`);
    });

    // Add upload button
    const uploadBtn = document.createElement("button");
    uploadBtn.classList.add("image-zoom-btn", "upload-btn");
    uploadBtn.textContent = "📤 Upload";
    uploadBtn.type = "button";
    uploadBtn.contentEditable = "false";
    uploadBtn.setAttribute("contenteditable", "false");

    uploadBtn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log(`[ImageZoom] Upload button clicked`);
        this.triggerUpload(img);
        return false;
      },
      true,
    );

    uploadBtn.addEventListener(
      "mousedown",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    controls.appendChild(uploadBtn);
    console.log(`[ImageZoom] Added upload button`);

    wrapper.appendChild(controls);
    console.log(`[ImageZoom] Controls appended to wrapper`);

    // Show/hide controls on hover
    wrapper.addEventListener("mouseenter", () => {
      console.log(`[ImageZoom] Mouse entered wrapper, showing controls`);
      controls.style.display = "flex";
    });
    wrapper.addEventListener("mouseleave", () => {
      console.log(`[ImageZoom] Mouse left wrapper, hiding controls`);
      controls.style.display = "none";
    });

    console.log(`[ImageZoom] addZoomControls END`);
  }

  /**
   * Add click to zoom functionality
   */
  private addClickZoom(img: HTMLImageElement): void {
    let isZoomed = false;

    img.style.cursor = "zoom-in";

    img.addEventListener("click", (e) => {
      // Don't interfere with button clicks
      if ((e.target as HTMLElement).tagName === "BUTTON") {
        return;
      }

      const metadata = this.imageMetadata.get(img);
      if (!metadata) return;

      if (!isZoomed) {
        // Zoom to 100%
        this.setImageWidth(img, 100);
        img.style.cursor = "zoom-out";
        isZoomed = true;
      } else {
        // Return to default size
        this.setImageWidth(img, metadata.currentWidth);
        img.style.cursor = "zoom-in";
        isZoomed = false;
      }
    });
  }

  /**
   * Add drag to resize functionality
   */
  private addDragResize(img: HTMLImageElement, wrapper: HTMLElement): void {
    const resizeHandle = document.createElement("div");
    resizeHandle.classList.add("image-resize-handle");
    resizeHandle.innerHTML = "⊙"; // Resize icon
    resizeHandle.contentEditable = "false";
    resizeHandle.setAttribute("contenteditable", "false");
    wrapper.appendChild(resizeHandle);

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startWidth = img.offsetWidth;

      document.body.style.cursor = "ew-resize";
      resizeHandle.classList.add("active");
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;

      // Get parent container width
      const containerWidth =
        img.parentElement?.parentElement?.offsetWidth || 800;
      const widthPercent = Math.round((newWidth / containerWidth) * 100);

      // Clamp between 10% and 200%
      const clampedPercent = Math.max(10, Math.min(200, widthPercent));
      this.setImageWidth(img, clampedPercent);
    });

    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "";
        resizeHandle.classList.remove("active");
      }
    });
  }

  /**
   * Set image width by percentage
   */
  private setImageWidth(img: HTMLImageElement, percent: number): void {
    console.log(`[ImageZoom] setImageWidth: ${percent}% for:`, img.src);
    img.style.width = `${percent}%`;
    img.style.height = "auto";

    // Update metadata
    const metadata = this.imageMetadata.get(img);
    if (metadata) {
      metadata.currentWidth = percent;
      console.log(`[ImageZoom] Updated metadata, currentWidth: ${percent}%`);
    }

    // Update active state on buttons
    const wrapper = img.closest(".image-zoom-wrapper");
    if (wrapper) {
      const buttons = wrapper.querySelectorAll(".image-zoom-btn");
      console.log(
        `[ImageZoom] Updating active state on ${buttons.length} buttons`,
      );
      buttons.forEach((btn) => {
        const btnPercent = parseInt(btn.textContent || "0");
        if (btnPercent === percent) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }
  }

  /**
   * Trigger upload event (to be handled by main plugin)
   */
  private triggerUpload(img: HTMLImageElement): void {
    console.log(`[ImageZoom] triggerUpload for:`, img.src);
    const event = new CustomEvent("image-upload-requested", {
      detail: { img },
      bubbles: true,
    });
    img.dispatchEvent(event);
    console.log(`[ImageZoom] Upload event dispatched`);
  }

  /**
   * Get current image metadata
   */
  getMetadata(img: HTMLImageElement): ImageMetadata | undefined {
    return this.imageMetadata.get(img);
  }
}
