// Конфигурация
const config = {
    pdfUrl: './assets/24_1305.pdf', // Относительный путь к файлу
    scale: 1.5,
    thumbnailScale: 0.2
};

class Flipbook {
    constructor() {
        this.state = {
            pdfDoc: null,
            totalPages: 0,
            currentPage: 1,
            isFlipping: false,
            pages: [],
            thumbnails: []
        };

        this.elements = {
            flipbook: document.getElementById('flipbook'),
            thumbnails: document.getElementById('thumbnails'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            pageIndicator: document.getElementById('page-indicator')
        };

        this.init();
    }

    async init() {
        try {
            // Загрузка PDF с использованием fetch для локальных файлов
            const response = await fetch(config.pdfUrl);
            if (!response.ok) throw new Error('PDF не найден');
            
            const arrayBuffer = await response.arrayBuffer();
            const typedArray = new Uint8Array(arrayBuffer);
            
            this.state.pdfDoc = await pdfjsLib.getDocument(typedArray).promise;
            this.state.totalPages = this.state.pdfDoc.numPages;
            
            await this.createThumbnails();
            await this.loadPage(1);
            this.updateUI();
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            alert(`Не удалось загрузить PDF документ: ${error.message}`);
        }
    }

    async createThumbnails() {
        this.elements.thumbnails.innerHTML = '';
        this.state.thumbnails = [];

        for (let i = 1; i <= this.state.totalPages; i++) {
            const page = await this.state.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: config.thumbnailScale });
            
            const canvas = document.createElement('canvas');
            canvas.className = 'thumbnail';
            canvas.dataset.pageNum = i;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const context = canvas.getContext('2d');
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            canvas.addEventListener('click', () => this.goToPage(i));
            
            this.elements.thumbnails.appendChild(canvas);
            this.state.thumbnails.push(canvas);
        }
    }

    async loadPage(pageNum) {
        if (pageNum < 1 || pageNum > this.state.totalPages) return;
        
        // Проверяем, есть ли уже страница в DOM
        const existingPage = document.querySelector(`.page[data-page-num="${pageNum}"]`);
        if (existingPage) return;
        
        // Рендерим страницу
        const page = await this.state.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: config.scale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const context = canvas.getContext('2d');
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Создаем элемент страницы
        const pageElement = document.createElement('div');
        pageElement.className = 'page';
        pageElement.dataset.pageNum = pageNum;
        
        const pageContent = document.createElement('div');
        pageContent.className = 'page-content';
        pageContent.appendChild(canvas);
        
        pageElement.appendChild(pageContent);
        this.elements.flipbook.appendChild(pageElement);
        
        // Позиционируем страницу
        this.positionPage(pageElement, pageNum);
        
        this.state.pages.push(pageElement);
    }

    positionPage(pageElement, pageNum) {
        if (pageNum < this.state.currentPage) {
            // Страницы слева (уже просмотренные)
            pageElement.style.transform = 'rotateY(-180deg) translateX(-100%)';
            pageElement.style.zIndex = this.state.totalPages - pageNum;
        } else if (pageNum > this.state.currentPage) {
            // Страницы справа (еще не просмотренные)
            pageElement.style.transform = 'rotateY(0deg) translateX(100%)';
            pageElement.style.zIndex = pageNum;
        } else {
            // Текущая страница
            pageElement.style.transform = 'rotateY(0deg) translateX(0)';
            pageElement.style.zIndex = this.state.totalPages + 1;
        }
    }

    async goToPage(pageNum) {
        if (this.state.isFlipping || 
            pageNum < 1 || 
            pageNum > this.state.totalPages || 
            pageNum === this.state.currentPage) return;
        
        this.state.isFlipping = true;
        
        // Загружаем страницу, если ее нет
        await this.loadPage(pageNum);
        
        // Анимация перехода
        const direction = pageNum > this.state.currentPage ? 1 : -1;
        const currentPageElement = document.querySelector(`.page[data-page-num="${this.state.currentPage}"]`);
        const nextPageElement = document.querySelector(`.page[data-page-num="${pageNum}"]`);
        
        // Анимация
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
        // Обновляем индикатор страницы
        this.elements.pageIndicator.textContent = `Страница ${this.state.currentPage} из ${this.state.totalPages}`;
        
        // Обновляем состояние кнопок
        this.elements.prevBtn.disabled = this.state.currentPage <= 1;
        this.elements.nextBtn.disabled = this.state.currentPage >= this.state.totalPages;
        
        // Обновляем активную миниатюру
        this.state.thumbnails.forEach(thumb => {
            thumb.classList.toggle('active', parseInt(thumb.dataset.pageNum) === this.state.currentPage);
        });
    }

    setupEventListeners() {
        this.elements.prevBtn.addEventListener('click', () => this.goToPage(this.state.currentPage - 1));
        this.elements.nextBtn.addEventListener('click', () => this.goToPage(this.state.currentPage + 1));
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.goToPage(this.state.currentPage - 1);
            if (e.key === 'ArrowRight') this.goToPage(this.state.currentPage + 1);
        });
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new Flipbook();
});