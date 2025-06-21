/**
 * 3D Flipbook PDF Viewer
 * @version 2.0
 * @description Реализация 3D Flipbook с миниатюрами и фиксированным PDF
 */

// Инициализация PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const flipbook = document.getElementById('flipbook');
    const thumbnails = document.getElementById('thumbnails');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageNum = document.getElementById('page-num');
    
    // Состояние приложения
    let state = {
        pdfDoc: null,
        totalPages: 0,
        currentPage: 1,
        isFlipping: false,
        pages: [],
        thumbnails: []
    };
    
    // Инициализация приложения
    initFlipbook();
    
    /**
     * Инициализирует flipbook с тестовым PDF
     */
    async function initFlipbook() {
        // Пример PDF (замените на ваш URL или бинарные данные)
        const pdfUrl = '24_1305.pdf';
        
        try {
            // Загрузка PDF документа
            state.pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
            state.totalPages = state.pdfDoc.numPages;
            
            // Создание миниатюр
            await createThumbnails();
            
            // Загрузка первых страниц
            await loadInitialPages();
            
            // Обновление информации о странице
            updatePageInfo();
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            alert('Не удалось загрузить PDF документ');
        }
    }
    
    /**
     * Создает миниатюры для всех страниц
     */
    async function createThumbnails() {
        thumbnails.innerHTML = '';
        state.thumbnails = [];
        
        for (let i = 1; i <= state.totalPages; i++) {
            const page = await state.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 });
            
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
            
            // Обработчик клика на миниатюру
            canvas.addEventListener('click', () => {
                if (!state.isFlipping) goToPage(i);
            });
            
            thumbnails.appendChild(canvas);
            state.thumbnails.push(canvas);
        }
    }
    
    /**
     * Загружает начальные страницы (первую и вторую)
     */
    async function loadInitialPages() {
        flipbook.innerHTML = '';
        
        // Загружаем первую страницу
        const firstPage = await renderPage(1);
        const firstPageElement = createPageElement(firstPage, true);
        flipbook.appendChild(firstPageElement);
        state.pages.push(firstPage);
        
        // Если есть вторая страница, загружаем ее
        if (state.totalPages > 1) {
            const secondPage = await renderPage(2);
            const secondPageElement = createPageElement(secondPage, false);
            flipbook.appendChild(secondPageElement);
            state.pages.push(secondPage);
        }
    }
    
    /**
     * Переходит к указанной странице
     * @param {number} pageNum - Номер страницы
     */
    async function goToPage(pageNum) {
        if (state.isFlipping || pageNum < 1 || pageNum > state.totalPages) return;
        
        const diff = pageNum - state.currentPage;
        if (diff === 0) return;
        
        state.isFlipping = true;
        
        // Обновляем активную миниатюру
        updateActiveThumbnail(pageNum);
        
        // Если переход на +1/-1 страницу - анимируем перелистывание
        if (Math.abs(diff) === 1) {
            await animatePageFlip(diff);
        } else {
            // Для больших переходов просто заменяем страницы
            await replacePages(pageNum);
        }
        
        state.currentPage = pageNum;
        state.isFlipping = false;
        updatePageInfo();
    }
    
    /**
     * Анимирует перелистывание страницы
     * @param {number} direction - 1 для следующей, -1 для предыдущей
     */
    async function animatePageFlip(direction) {
        const currentPageElement = document.querySelector(`.page[data-page-num="${state.currentPage}"]`);
        const nextPageNum = state.currentPage + direction;
        let nextPageElement = document.querySelector(`.page[data-page-num="${nextPageNum}"]`);
        
        // Если следующей страницы нет в DOM, загружаем ее
        if (!nextPageElement) {
            const newPage = await renderPage(nextPageNum);
            nextPageElement = createPageElement(newPage, false);
            flipbook.appendChild(nextPageElement);
            state.pages.push(newPage);
        }
        
        // Анимация переворота
        if (direction > 0) {
            currentPageElement.style.transform = 'rotateY(180deg)';
            nextPageElement.style.transform = 'rotateY(0deg)';
        } else {
            currentPageElement.style.transform = 'rotateY(-180deg)';
            nextPageElement.style.transform = 'rotateY(0deg)';
        }
        
        // Обновляем z-index
        currentPageElement.style.zIndex = '1';
        nextPageElement.style.zIndex = '2';
        
        // Ждем завершения анимации
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    /**
     * Обновляет активную миниатюру
     * @param {number} pageNum - Номер активной страницы
     */
    function updateActiveThumbnail(pageNum) {
        state.thumbnails.forEach(thumb => {
            thumb.classList.toggle('active', parseInt(thumb.dataset.pageNum) === pageNum);
        });
    }
    
    // Остальные функции (renderPage, createPageElement, updatePageInfo) остаются без изменений
    // Кнопки и обработчики событий также остаются прежними
});