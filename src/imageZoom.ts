import { ImagePluginSettings, ImageMetadata } from './types';

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
		// Store original metadata
		this.storeImageMetadata(img);

		// Wrap image in a container if not already wrapped
		const wrapper = this.createImageWrapper(img, container);

		// Add zoom controls
		this.addZoomControls(img, wrapper);

		// Add click to zoom functionality
		if (this.settings.enableClickZoom) {
			this.addClickZoom(img);
		}

		// Add drag to resize functionality
		if (this.settings.enableDragResize) {
			this.addDragResize(img, wrapper);
		}

		// Set initial width
		this.setImageWidth(img, this.settings.defaultWidth);
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
			img.addEventListener('load', () => {
				metadata.aspectRatio = img.naturalWidth / img.naturalHeight;
			});
		}

		this.imageMetadata.set(img, metadata);
	}

	/**
	 * Create wrapper for image
	 */
	private createImageWrapper(img: HTMLImageElement, container: HTMLElement): HTMLElement {
		// Check if already wrapped
		if (img.parentElement?.classList.contains('image-zoom-wrapper')) {
			return img.parentElement;
		}

		const wrapper = document.createElement('div');
		wrapper.classList.add('image-zoom-wrapper');

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
		const controls = document.createElement('div');
		controls.classList.add('image-zoom-controls');
		controls.style.display = 'none'; // Hidden by default

		// Create preset buttons
		this.settings.zoomPresets.forEach(preset => {
			const btn = document.createElement('button');
			btn.classList.add('image-zoom-btn');
			btn.textContent = `${preset}%`;
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.setImageWidth(img, preset);
			});
			controls.appendChild(btn);
		});

		// Add upload button
		const uploadBtn = document.createElement('button');
		uploadBtn.classList.add('image-zoom-btn', 'upload-btn');
		uploadBtn.textContent = '📤 Upload';
		uploadBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.triggerUpload(img);
		});
		controls.appendChild(uploadBtn);

		wrapper.appendChild(controls);

		// Show/hide controls on hover
		wrapper.addEventListener('mouseenter', () => {
			controls.style.display = 'flex';
		});
		wrapper.addEventListener('mouseleave', () => {
			controls.style.display = 'none';
		});
	}

	/**
	 * Add click to zoom functionality
	 */
	private addClickZoom(img: HTMLImageElement): void {
		let isZoomed = false;

		img.style.cursor = 'zoom-in';

		img.addEventListener('click', (e) => {
			// Don't interfere with button clicks
			if ((e.target as HTMLElement).tagName === 'BUTTON') {
				return;
			}

			const metadata = this.imageMetadata.get(img);
			if (!metadata) return;

			if (!isZoomed) {
				// Zoom to 100%
				this.setImageWidth(img, 100);
				img.style.cursor = 'zoom-out';
				isZoomed = true;
			} else {
				// Return to default size
				this.setImageWidth(img, metadata.currentWidth);
				img.style.cursor = 'zoom-in';
				isZoomed = false;
			}
		});
	}

	/**
	 * Add drag to resize functionality
	 */
	private addDragResize(img: HTMLImageElement, wrapper: HTMLElement): void {
		const resizeHandle = document.createElement('div');
		resizeHandle.classList.add('image-resize-handle');
		resizeHandle.innerHTML = '⊙'; // Resize icon
		wrapper.appendChild(resizeHandle);

		let isResizing = false;
		let startX = 0;
		let startWidth = 0;

		resizeHandle.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			isResizing = true;
			startX = e.clientX;
			startWidth = img.offsetWidth;

			document.body.style.cursor = 'ew-resize';
			resizeHandle.classList.add('active');
		});

		document.addEventListener('mousemove', (e) => {
			if (!isResizing) return;

			const deltaX = e.clientX - startX;
			const newWidth = startWidth + deltaX;

			// Get parent container width
			const containerWidth = img.parentElement?.parentElement?.offsetWidth || 800;
			const widthPercent = Math.round((newWidth / containerWidth) * 100);

			// Clamp between 10% and 200%
			const clampedPercent = Math.max(10, Math.min(200, widthPercent));
			this.setImageWidth(img, clampedPercent);
		});

		document.addEventListener('mouseup', () => {
			if (isResizing) {
				isResizing = false;
				document.body.style.cursor = '';
				resizeHandle.classList.remove('active');
			}
		});
	}

	/**
	 * Set image width by percentage
	 */
	private setImageWidth(img: HTMLImageElement, percent: number): void {
		img.style.width = `${percent}%`;
		img.style.height = 'auto';

		// Update metadata
		const metadata = this.imageMetadata.get(img);
		if (metadata) {
			metadata.currentWidth = percent;
		}

		// Update active state on buttons
		const wrapper = img.closest('.image-zoom-wrapper');
		if (wrapper) {
			const buttons = wrapper.querySelectorAll('.image-zoom-btn');
			buttons.forEach((btn) => {
				const btnPercent = parseInt(btn.textContent || '0');
				if (btnPercent === percent) {
					btn.classList.add('active');
				} else {
					btn.classList.remove('active');
				}
			});
		}
	}

	/**
	 * Trigger upload event (to be handled by main plugin)
	 */
	private triggerUpload(img: HTMLImageElement): void {
		const event = new CustomEvent('image-upload-requested', {
			detail: { img },
			bubbles: true,
		});
		img.dispatchEvent(event);
	}

	/**
	 * Get current image metadata
	 */
	getMetadata(img: HTMLImageElement): ImageMetadata | undefined {
		return this.imageMetadata.get(img);
	}
}
