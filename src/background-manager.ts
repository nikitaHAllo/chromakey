export interface BackgroundOptions {
	fit?: 'cover' | 'contain' | 'stretch'; // Режим отображения
	blur?: number;
	opacity?: number;
}

export class BackgroundManager {
	private image: HTMLImageElement | null = null;
	private options: BackgroundOptions = {
		fit: 'cover',
		blur: 0,
		opacity: 1,
	};

	constructor(options: BackgroundOptions = {}) {
		this.options = { ...this.options, ...options };
		console.log('🎨 BackgroundManager инициализирован');
	}

	public async loadFromFile(file: File): Promise<void> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = e => {
				const url = e.target?.result as string;
				this.loadFromUrl(url).then(resolve).catch(reject);
			};

			reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
			reader.readAsDataURL(file);
		});
	}

	public async loadFromUrl(url: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const img = new Image();

			img.onload = () => {
				this.image = img;
				console.log('✅ Фон загружен:', url);
				resolve();
			};

			img.onerror = () => {
				reject(new Error(`Не удалось загрузить фон: ${url}`));
			};

			img.crossOrigin = 'anonymous';
			img.src = url;
		});
	}

	public async loadFromPath(path: string): Promise<void> {
		try {
			const response = await fetch(path);
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			await this.loadFromUrl(url);
		} catch (error) {
			throw new Error(`Не удалось загрузить фон из пути: ${path}`);
		}
	}

	public draw(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
	): void {
		if (!this.image) {
			this.drawGradient(ctx, width, height);
			return;
		}

		ctx.save();

		// Применяем прозрачность
		ctx.globalAlpha = this.options.opacity || 1;

		// Рисуем изображение
		this.drawImage(ctx, width, height);

		if (this.options.blur && this.options.blur > 0) {
			this.applyBlur(ctx);
		}

		ctx.restore();
	}

	private drawImage(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
	): void {
		if (!this.image) return;

		const img = this.image;
		const fit = this.options.fit || 'cover';

		let drawWidth = width;
		let drawHeight = height;
		let offsetX = 0;
		let offsetY = 0;

		if (fit === 'cover') {
			const ratio = Math.max(width / img.width, height / img.height);
			drawWidth = img.width * ratio;
			drawHeight = img.height * ratio;
			offsetX = (width - drawWidth) / 2;
			offsetY = (height - drawHeight) / 2;
		} else if (fit === 'contain') {
			const ratio = Math.min(width / img.width, height / img.height);
			drawWidth = img.width * ratio;
			drawHeight = img.height * ratio;
			offsetX = (width - drawWidth) / 2;
			offsetY = (height - drawHeight) / 2;
		} else if (fit === 'stretch') {
			drawWidth = width;
			drawHeight = height;
		}

		ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
	}

	private drawGradient(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
	): void {
		const gradient = ctx.createLinearGradient(0, 0, width, height);
		gradient.addColorStop(0, '#ff6b6b');
		gradient.addColorStop(0.5, '#4ecdc4');
		gradient.addColorStop(1, '#45b7d1');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
	}

	private applyBlur(ctx: CanvasRenderingContext2D): void {
		const canvas = ctx.canvas;
		canvas.style.filter = `blur(${this.options.blur || 0}px)`;

		setTimeout(() => {
			canvas.style.filter = 'none';
		}, 100);
	}

	public setOptions(options: BackgroundOptions): void {
		this.options = { ...this.options, ...options };
		console.log('✅ Настройки фона обновлены:', this.options);
	}

	public getOptions(): BackgroundOptions {
		return { ...this.options };
	}

	public getImage(): HTMLImageElement | null {
		return this.image;
	}

	public isLoaded(): boolean {
		return this.image !== null && this.image.complete;
	}

	public clear(): void {
		this.image = null;
		console.log('🗑️ Фон очищен');
	}

	public async loadFromClipboard(): Promise<void> {
		try {
			const clipboardItems = await navigator.clipboard?.read();
			if (!clipboardItems) {
				throw new Error('Clipboard API не поддерживается');
			}

			for (const item of clipboardItems) {
				for (const type of item.types) {
					if (type.startsWith('image/')) {
						const blob = await item.getType(type);
						const file = new File([blob], 'clipboard.png', { type });
						await this.loadFromFile(file);
						return;
					}
				}
			}

			throw new Error('В буфере обмена нет изображения');
		} catch (error) {
			throw new Error(`Не удалось загрузить из буфера обмена: ${error}`);
		}
	}

	public generateTestPattern(): void {
		const canvas = document.createElement('canvas');
		canvas.width = 640;
		canvas.height = 480;
		const ctx = canvas.getContext('2d')!;

		const cellSize = 40;
		for (let y = 0; y < canvas.height; y += cellSize) {
			for (let x = 0; x < canvas.width; x += cellSize) {
				const isEven =
					(Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0;
				ctx.fillStyle = isEven ? '#4ecdc4' : '#1a1a2e';
				ctx.fillRect(x, y, cellSize, cellSize);
			}
		}

		this.image = new Image();
		this.image.src = canvas.toDataURL();
		console.log('🎯 Сгенерирован тестовый фон');
	}
}
