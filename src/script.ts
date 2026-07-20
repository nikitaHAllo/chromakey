import { BackgroundManager, BackgroundOptions } from './background-manager.js';

interface ChromaKeyConfig {
	rMin: number;
	rMax: number;
	gMin: number;
	gMax: number;
	bMin: number;
	bMax: number;
}

interface RGB {
	r: number;
	g: number;
	b: number;
}

const CHROMA_CONFIG: ChromaKeyConfig = {
	rMin: 0,
	rMax: 100,
	gMin: 160, // Основной параметр для зелёного
	gMax: 255,
	bMin: 0,
	bMax: 100,
};

class ChromaKeyProcessor {
	private video: HTMLVideoElement;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private config: ChromaKeyConfig;
	private isAutoMode: boolean = false;
	private animationId: number | null = null;
	private backgroundManager: BackgroundManager;

	constructor(
		videoElement: HTMLVideoElement,
		canvasElement: HTMLCanvasElement,
		config: ChromaKeyConfig = CHROMA_CONFIG,
	) {
		this.video = videoElement;
		this.canvas = canvasElement;
		this.ctx = canvasElement.getContext('2d')!;
		this.config = config;
		this.backgroundManager = new BackgroundManager();

		console.log('🎯 ChromaKeyProcessor инициализирован');
	}

	public loadBackgroundFile(file: File): Promise<void> {
		return this.backgroundManager.loadFromFile(file);
	}

	public loadBackgroundImage(url: string): Promise<void> {
		return this.backgroundManager.loadFromUrl(url);
	}

	private drawBackground(): void {
		const { width, height } = this.canvas;
		this.backgroundManager.draw(this.ctx, width, height);
	}

	private isGreenPixel(r: number, g: number, b: number): boolean {
		const { rMin, rMax, gMin, gMax, bMin, bMax } = this.config;
		return (
			r >= rMin && r <= rMax && g >= gMin && g <= gMax && b >= bMin && b <= bMax
		);
	}

	public applyChromaKey(): void {
		if (this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
			console.warn('⚠️ Видео ещё не загружено');
			return;
		}

		this.drawBackground();

		this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

		const imageData = this.ctx.getImageData(
			0,
			0,
			this.canvas.width,
			this.canvas.height,
		);
		const data = imageData.data;

		for (let i = 0; i < data.length; i += 4) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];

			if (this.isGreenPixel(r, g, b)) {
				data[i + 3] = 0;
			}
		}

		this.ctx.putImageData(imageData, 0, 0);
	}

	public applyChromaKeySmooth(): void {
		if (this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
			return;
		}

		this.drawBackground();
		this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

		const imageData = this.ctx.getImageData(
			0,
			0,
			this.canvas.width,
			this.canvas.height,
		);
		const data = imageData.data;

		for (let i = 0; i < data.length; i += 4) {
			const g = data[i + 1];

			const greenScore = Math.max(0, Math.min(1, (g - 100) / 155));

			if (greenScore > 0.3) {
				data[i + 3] = Math.floor(255 * (1 - greenScore));
			}
		}

		this.ctx.putImageData(imageData, 0, 0);
	}

	public startAutoMode(useSmooth: boolean = false): void {
		if (this.isAutoMode) {
			console.log('⏹ Останавливаем авто-режим');
			this.stopAutoMode();
			return;
		}

		console.log('▶ Запускаем авто-режим');
		this.isAutoMode = true;

		const processFrame = (): void => {
			if (!this.isAutoMode) return;

			if (useSmooth) {
				this.applyChromaKeySmooth();
			} else {
				this.applyChromaKey();
			}

			this.animationId = requestAnimationFrame(processFrame);
		};

		processFrame();
	}

	public stopAutoMode(): void {
		this.isAutoMode = false;
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
	}

	public async startCamera(
		width: number = 640,
		height: number = 480,
	): Promise<void> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: width,
					height: height,
					facingMode: 'user',
				},
			});

			this.video.srcObject = stream;
			await this.video.play();

			console.log('✅ Камера запущена');
		} catch (error) {
			console.error('❌ Ошибка доступа к камере:', error);
			throw new Error('Не удалось получить доступ к камере');
		}
	}

	public stopCamera(): void {
		const stream = this.video.srcObject as MediaStream;
		if (stream) {
			stream.getTracks().forEach(track => track.stop());
			this.video.srcObject = null;
		}
		this.stopAutoMode();
		console.log('⏹ Камера остановлена');
	}

	public updateConfig(newConfig: Partial<ChromaKeyConfig>): void {
		this.config = { ...this.config, ...newConfig };
		console.log('✅ Настройки обновлены:', this.config);
	}

	public getConfig(): ChromaKeyConfig {
		return { ...this.config };
	}

	public setBackgroundOptions(options: BackgroundOptions): void {
		this.backgroundManager.setOptions(options);
	}

	public getBackgroundOptions(): BackgroundOptions {
		return this.backgroundManager.getOptions();
	}

	public clearBackground(): void {
		this.backgroundManager.clear();
	}

	public generateTestBackground(): void {
		this.backgroundManager.generateTestPattern();
	}

	public isBackgroundLoaded(): boolean {
		return this.backgroundManager.isLoaded();
	}
}

class App {
	private processor: ChromaKeyProcessor;
	private startBtn: HTMLButtonElement;
	private captureBtn: HTMLButtonElement;
	private autoBtn: HTMLButtonElement;
	private smoothBtn: HTMLButtonElement;
	private bgBtn: HTMLButtonElement;
	private bgInput: HTMLInputElement;
	private bgUrlInput: HTMLInputElement;
	private applyUrlBtn: HTMLButtonElement;

	constructor() {
		const video = document.getElementById('webcam') as HTMLVideoElement;
		const canvas = document.getElementById('output') as HTMLCanvasElement;

		if (!video || !canvas) {
			throw new Error('Не найдены элементы video или canvas');
		}

		this.processor = new ChromaKeyProcessor(video, canvas);

		this.startBtn = document.getElementById('startBtn') as HTMLButtonElement;
		this.captureBtn = document.getElementById(
			'captureBtn',
		) as HTMLButtonElement;
		this.autoBtn = document.getElementById('autoBtn') as HTMLButtonElement;
		this.smoothBtn = document.getElementById('smoothBtn') as HTMLButtonElement;
		this.bgBtn = document.getElementById('bgBtn') as HTMLButtonElement;
		this.bgInput = document.getElementById('bgInput') as HTMLInputElement;
		this.bgUrlInput = document.getElementById('bgUrlInput') as HTMLInputElement;
		this.applyUrlBtn = document.getElementById(
			'applyUrlBtn',
		) as HTMLButtonElement;

		if (
			!this.startBtn ||
			!this.captureBtn ||
			!this.autoBtn ||
			!this.smoothBtn ||
			!this.bgBtn ||
			!this.bgInput ||
			!this.bgUrlInput ||
			!this.applyUrlBtn
		) {
			throw new Error('Не найдены все элементы управления');
		}

		this.setupEventListeners();

		this.loadBackground();

		console.log('✅ Приложение инициализировано');
	}

	private setupEventListeners(): void {
		this.startBtn.addEventListener('click', () => this.handleStart());
		this.captureBtn.addEventListener('click', () => this.handleCapture());
		this.autoBtn.addEventListener('click', () => this.handleAuto());
		this.smoothBtn.addEventListener('click', () => this.handleSmooth());
		this.bgBtn.addEventListener('click', () => this.bgInput.click());
		this.bgInput.addEventListener('change', e =>
			this.handleBackgroundUpload(e),
		);
		this.applyUrlBtn.addEventListener('click', () =>
			this.handleUrlBackground(),
		);

		document.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				this.handleCapture();
			}
			if (e.key === ' ' || e.key === 'Space') {
				e.preventDefault();
				this.handleAuto();
			}
		});
	}

	private async loadBackground(): Promise<void> {
		try {
			console.log('ℹ️ Используется градиентный фон');
		} catch (error) {
			console.warn('⚠️ Не удалось загрузить фон:', error);
		}
	}

	private async handleStart(): Promise<void> {
		try {
			await this.processor.startCamera(640, 480);
			this.startBtn.textContent = '✅ Камера работает';
			this.startBtn.disabled = true;
		} catch (error) {
			alert('Не удалось запустить камеру. Проверьте разрешения.');
			console.error(error);
		}
	}

	private handleCapture(): void {
		try {
			this.processor.applyChromaKeySmooth();
		} catch (error) {
			console.error('Ошибка при применении хромакея:', error);
		}
	}

	private handleAuto(): void {
		const isRunning = this.processor['isAutoMode'];
		this.processor.startAutoMode(true);

		if (isRunning) {
			this.autoBtn.textContent = '⚡ Авто-режим';
			this.autoBtn.style.background = '#4ecdc4';
		} else {
			this.autoBtn.textContent = '⏹ Остановить';
			this.autoBtn.style.background = '#ff6b6b';
		}
	}

	private handleSmooth(): void {
		try {
			this.processor.applyChromaKeySmooth();
			console.log('✨ Применено сглаживание');
		} catch (error) {
			console.error('Ошибка при сглаживании:', error);
		}
	}

	private async handleBackgroundUpload(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		try {
			await this.processor.loadBackgroundFile(file);
			console.log('✅ Фон загружен из файла!');

			if (
				this.processor['video'].readyState ===
				this.processor['video'].HAVE_ENOUGH_DATA
			) {
				this.processor.applyChromaKeySmooth();
			}
		} catch (error) {
			console.error('❌ Ошибка загрузки фона:', error);
			alert('Не удалось загрузить картинку. Попробуйте другой файл.');
		}

		input.value = '';
	}

	private async handleUrlBackground(): Promise<void> {
		const url = this.bgUrlInput.value.trim();
		if (!url) {
			alert('Введите URL картинки!');
			return;
		}

		try {
			await this.processor.loadBackgroundImage(url);
			console.log('✅ Фон загружен по URL!');

			if (
				this.processor['video'].readyState ===
				this.processor['video'].HAVE_ENOUGH_DATA
			) {
				this.processor.applyChromaKeySmooth();
			}
		} catch (error) {
			console.error('❌ Ошибка загрузки фона:', error);
			alert('Не удалось загрузить картинку. Проверьте URL.');
		}
	}
}

document.addEventListener('DOMContentLoaded', () => {
	try {
		new App();
		console.log('🚀 Приложение запущено!');
		console.log('📖 Управление:');
		console.log('  - Кнопки на странице');
		console.log('  - ENTER: применить эффект');
		console.log('  - ПРОБЕЛ: авто-режим');
	} catch (error) {
		console.error('❌ Ошибка при запуске:', error);
		alert('Ошибка при запуске приложения. Проверьте консоль.');
	}
});

export { ChromaKeyProcessor, App, CHROMA_CONFIG };
export type { ChromaKeyConfig, RGB };
