// Конфигурация
const config = {
    pdfUrl: './assets/24_1305.pdf',
    previewScale: 0.5,
    zoomStep: 0.25,
    maxZoom: 3,
    minZoom: 0.5,
    qualityScale: 1.5
};

// Инициализация PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

class Flipbook {
    constructor() {
        this.state = {
            pdfDoc: null,
            totalPages: 0,
            currentPage: 1,
            isFlipping: false,
            scale: 1.5,
            currentZoom: 1,
            isZoomed: false,
            isDragging: false,
            startPos: { x: 0, y: 0 },
            translate: { x: 0, y: 0 },
            lastZoom: 1,
            renderedQuality: {}
        };

        this.elements = {
            preview: document.getElementById('preview'),
            previewCanvas: document.getElementById('preview-canvas'),
            lightbox: document.getElementById('lightbox'),
            flipbook: document.getElementById('flipbook'),
            pageContainer: document.getElementById('page-container'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            pageIndicator: document.getElementById('page-indicator'),
            closeBtn: document.getElementById('close-btn'),
            zoomIn: document.getElementById('zoom-in'),
            zoomOut: document.getElementById('zoom-out'),
            zoomLevel: document.getElementById('zoom-level')
        };

        this.init();
    }

    async init() {
        try {
            // Загрузка PDF
            const response = await fetch(config.pdfUrl);
            if (!response.ok) throw new Error('PDF не найден');
            
            const arrayBuffer = await response.arrayBuffer();
            const typedArray = new Uint8Array(arrayBuffer);
            
            this.state.pdfDoc = await pdfjsLib.getDocument(typedArray).promise;
            this.state.totalPages = this.state.pdfDoc.numPages;
            
            // Рендер превью первой страницы
            await this.renderPreview();
            
            // Назначение обработчиков событий
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            alert(`Не удалось загрузить PDF документ: ${error.message}`);
        }
    }

    async renderPreview() {
        const page = await this.state.pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: config.previewScale });
        
        this.elements.previewCanvas.width = viewport.width;
        this.elements.previewCanvas.height = viewport.height;
        
        await page.render({
            canvasContext: this.elements.previewCanvas.getContext('2d'),
            viewport: viewport
        }).promise;
    }

    async openLightbox() {
        this.elements.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        await this.calculateOptimalScale();
        await this.loadPage(1);
        this.updateUI();
    }

    closeLightbox() {
        this.resetZoom();
        this.elements.lightbox.classList.remove('active');
        document.body.style.overflow = '';
        this.elements.pageContainer.innerHTML = '';
        this.state.currentPage = 1;
        this.state.renderedQuality = {};
    }

    async calculateOptimalScale() {
        const page = await this.state.pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        
        const windowWidth = window.innerWidth * 0.8;
        const windowHeight = (window.innerHeight - 70) * 0.8;
        
        this.state.scale = Math.min(
            windowWidth / viewport.width,
            windowHeight / viewport.height
        );
    }

    async loadPage(pageNum) {
        if (pageNum < 1 || pageNum > this.state.totalPages) return;
        
        if (pageNum === 1) {
            this.elements.pageContainer.innerHTML = '';
        }
        
        const existingPage = document.querySelector(`.page[data-page-num="${pageNum}"]`);
        if (existingPage) return;
        
        // Создаем структуру страницы
        const pageElement = document.createElement('div');
        pageElement.className = 'page';
        pageElement.dataset.pageNum = pageNum;
        
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-wrapper';
        pageWrapper.dataset.pageNum = pageNum;
        
        const pageContent = document.createElement('div');
        pageContent.className = 'page-content';
        
        // Рендерим страницу с базовым качеством
        await this.renderPageContent(pageNum, pageContent, this.state.scale);
        
        pageWrapper.appendChild(pageContent);
        pageElement.appendChild(pageWrapper);
        this.elements.pageContainer.appendChild(pageElement);
        
        // Сохраняем оригинальные размеры
        const canvas = pageContent.querySelector('canvas');
        pageElement.dataset.naturalWidth = canvas.width;
        pageElement.dataset.naturalHeight = canvas.height;
        
        // Настраиваем взаимодействия
        this.setupDrag(pageContent, pageWrapper);
        
        // Позиционируем страницу
        this.positionPage(pageElement, pageNum);
    }

    async renderPageContent(pageNum, container, scale, isHighQuality = false) {
        const page = await this.state.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const context = canvas.getContext('2d');
        
        // Улучшаем качество рендеринга для высокого разрешения
        if (isHighQuality) {
            context.imageSmoothingEnabled = false;
            context.webkitImageSmoothingEnabled = false;
            context.mozImageSmoothingEnabled = false;
        }
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Очищаем контейнер и добавляем новый canvas
        container.innerHTML = '';
        container.appendChild(canvas);
    }

    positionPage(pageElement, pageNum) {
        let transform;
        if (pageNum < this.state.currentPage) {
            transform = 'rotateY(-180deg) translateX(-100%)';
            pageElement.style.zIndex = this.state.totalPages - pageNum;
        } else if (pageNum > this.state.currentPage) {
            transform = 'rotateY(0deg) translateX(100%)';
            pageElement.style.zIndex = pageNum;
        } else {
            transform = 'rotateY(0deg) translateX(0)';
            pageElement.style.zIndex = this.state.totalPages + 1;
        }
        
        const wrapper = pageElement.querySelector('.page-wrapper');
        wrapper.style.transform = `${transform} scale(${this.state.currentZoom})`;
    }

    setupDrag(contentElement, wrapperElement) {
        let startX, startY;
        let initialTranslate = { x: 0, y: 0 };

        const startDrag = (clientX, clientY) => {
            if (!this.state.isZoomed) return;
            
            this.state.isDragging = true;
            startX = clientX;
            startY = clientY;
            initialTranslate = { ...this.state.translate };
            document.body.classList.add('grabbing');
        };

        const moveDrag = (clientX, clientY) => {
            if (!this.state.isDragging || !this.state.isZoomed) return;
            
            const dx = clientX - startX;
            const dy = clientY - startY;
            
            this.state.translate = {
                x: initialTranslate.x + dx,
                y: initialTranslate.y + dy
            };
            
            this.applyTransform(wrapperElement);
        };

        const endDrag = () => {
            this.state.isDragging = false;
            document.body.classList.remove('grabbing');
        };

        // Mouse events
        contentElement.addEventListener('mousedown', (e) => {
            startDrag(e.clientX, e.clientY);
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            moveDrag(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', endDrag);
        document.addEventListener('mouseleave', endDrag);

        // Touch events
        contentElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startDrag(e.touches[0].clientX, e.touches[0].clientY);
                e.preventDefault();
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                moveDrag(e.touches[0].clientX, e.touches[0].clientY);
                e.preventDefault();
            }
        });

        document.addEventListener('touchend', endDrag);
    }

    applyTransform(wrapperElement) {
        wrapperElement.style.transform = `
            ${wrapperElement.style.transform.split(' scale(')[0]}
            scale(${this.state.currentZoom})
            translate(${this.state.translate.x}px, ${this.state.translate.y}px)
        `;
    }

    async adjustZoom(direction) {
        const newZoom = this.state.currentZoom + (direction * config.zoomStep);
        await this.applyZoom(newZoom);
    }

    async toggleZoom() {
        const newZoom = this.state.isZoomed ? 1 : 1.5;
        await this.applyZoom(newZoom);
    }

    async applyZoom(zoomLevel) {
        // Ограничиваем масштаб
        zoomLevel = Math.max(config.minZoom, Math.min(config.maxZoom, zoomLevel));
        
        // Получаем текущую страницу
        const pageElement = document.querySelector(`.page[data-page-num="${this.state.currentPage}"]`);
        if (!pageElement) return;
        
        const wrapper = pageElement.querySelector('.page-wrapper');
        const content = pageElement.querySelector('.page-content');
        
        // Если увеличиваем и еще не рендерили в высоком качестве - делаем это
        if (zoomLevel > 1.2 && !this.state.renderedQuality[this.state.currentPage]) {
            const naturalWidth = parseInt(pageElement.dataset.naturalWidth);
            const naturalHeight = parseInt(pageElement.dataset.naturalHeight);
            const qualityScale = this.state.scale * zoomLevel * config.qualityScale;
            
            await this.renderPageContent(
                this.state.currentPage, 
                content, 
                qualityScale,
                true
            );
            
            this.state.renderedQuality[this.state.currentPage] = true;
        }
        
        // Обновляем состояние
        this.state.currentZoom = zoomLevel;
        this.state.isZoomed = zoomLevel !== 1;
        this.state.lastZoom = zoomLevel;
        
        // Сбрасываем позицию при уменьшении
        if (zoomLevel <= 1) {
            this.state.translate = { x: 0, y: 0 };
        }
        
        // Применяем трансформации
        this.applyTransform(wrapper);
        
        // Обновляем индикатор зума
        this.elements.zoomLevel.textContent = `${Math.round(zoomLevel * 100)}%`;
    }

    resetZoom() {
        this.state.currentZoom = 1;
        this.state.isZoomed = false;
        this.state.translate = { x: 0, y: 0 };
        this.elements.zoomLevel.textContent = '100%';
        
        document.querySelectorAll('.page-wrapper').forEach(wrapper => {
            const baseTransform = wrapper.style.transform.split(' scale(')[0];
            wrapper.style.transform = `${baseTransform} scale(1) translate(0, 0)`;
        });
    }

    async goToPage(pageNum) {
        if (this.state.isFlipping || 
            pageNum < 1 || 
            pageNum > this.state.totalPages || 
            pageNum === this.state.currentPage) return;
        
        this.state.isFlipping = true;
        this.resetZoom();
        
        // Загружаем страницу, если ее нет
        await this.loadPage(pageNum);
        
        // Анимация перехода
        const direction = pageNum > this.state.currentPage ? 1 : -1;
        const currentPageElement = document.querySelector(`.page[data-page-num="${this.state.currentPage}"]`);
        const nextPageElement = document.querySelector(`.page[data-page-num="${pageNum}"]`);
        
        if (!currentPageElement || !nextPageElement) return;
        
        // Применяем анимацию
        currentPageElement.style.transform = direction > 0 
            ? 'rotateY(-180deg) translateX(-100%)' 
            : 'rotateY(0deg) translateX(100%)';
        
        nextPageElement.style.transform = 'rotateY(0deg) translateX(0)';
        nextPageElement.style.zIndex = this.state.totalPages + 1;
        
        // Обновляем состояние после анимации
        setTimeout(() => {
            this.state.currentPage = pageNum;
            this.state.isFlipping = false;
            this.updateUI();
        }, 1000);
    }

    updateUI() {
        this.elements.pageIndicator.textContent = `Страница ${this.state.currentPage} из ${this.state.totalPages}`;
        this.elements.prevBtn.disabled = this.state.currentPage <= 1;
        this.elements.nextBtn.disabled = this.state.currentPage >= this.state.totalPages;
    }

    setupEventListeners() {
        // Открытие лайтбокса
        this.elements.preview.addEventListener('click', () => this.openLightbox());
        
        // Закрытие лайтбокса
        this.elements.closeBtn.addEventListener('click', () => this.closeLightbox());
        
        // Управление зумом
        this.elements.zoomIn.addEventListener('click', () => this.adjustZoom(1));
        this.elements.zoomOut.addEventListener('click', () => this.adjustZoom(-1));
        
        // Двойной клик по странице для зума
        document.addEventListener('dblclick', (e) => {
            if (this.elements.lightbox.classList.contains('active') && 
                e.target.closest('.page-content')) {
                this.toggleZoom();
            }
        });
        
        // Навигация
        this.elements.prevBtn.addEventListener('click', () => {
            this.resetZoom();
            this.goToPage(this.state.currentPage - 1);
        });
        
        this.elements.nextBtn.addEventListener('click', () => {
            this.resetZoom();
            this.goToPage(this.state.currentPage + 1);
        });
        
        // Закрытие по клику вне контента
        this.elements.lightbox.addEventListener('click', (e) => {
            if (e.target === this.elements.lightbox) {
                this.closeLightbox();
            }
        });
        
        // Управление с клавиатуры
        document.addEventListener('keydown', (e) => {
            if (!this.elements.lightbox.classList.contains('active')) return;
            
            if (e.key === 'ArrowLeft') this.goToPage(this.state.currentPage - 1);
            if (e.key === 'ArrowRight') this.goToPage(this.state.currentPage + 1);
            if (e.key === 'Escape') this.closeLightbox();
            
            // Управление зумом с клавиатуры
            if (e.ctrlKey && e.key === '0') {
                this.resetZoom();
            }
            if (e.ctrlKey && e.key === '+') {
                this.adjustZoom(1);
            }
            if (e.ctrlKey && e.key === '-') {
                this.adjustZoom(-1);
            }
        });
        
        // Обработка изменения размера окна
        window.addEventListener('resize', () => {
            if (this.elements.lightbox.classList.contains('active')) {
                this.handleResize();
            }
        });
    }

    async handleResize() {
        if (this.state.isZoomed) {
            this.resetZoom();
        }
        
        await this.calculateOptimalScale();
        this.elements.pageContainer.innerHTML = '';
        this.state.renderedQuality = {};
        await this.loadPage(this.state.currentPage);
        
        if (this.state.currentPage > 1) {
            await this.loadPage(this.state.currentPage - 1);
        }
        if (this.state.currentPage < this.state.totalPages) {
            await this.loadPage(this.state.currentPage + 1);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new Flipbook();
});
