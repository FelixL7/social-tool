class SlideManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this.slides = [];
        this.currentIndex = -1;
        this.listEl = document.getElementById('slide-list');

        // Create initial slide
        this.addSlide();
    }

    /* ---- CRUD ---- */

    addSlide(state = null) {
        const slide = {
            id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            state: state || { version: '5.3.1', objects: [], background: '#ffffff' },
            thumbnail: null,
            format: this.cm.currentFormat,
        };
        this.slides.push(slide);
        this.switchTo(this.slides.length - 1);
        this.renderList();
    }

    duplicateSlide() {
        if (this.currentIndex < 0) return;
        this._saveCurrent();

        const src = this.slides[this.currentIndex];
        const dup = {
            id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            state: JSON.parse(JSON.stringify(src.state)),
            thumbnail: src.thumbnail,
            format: src.format,
        };
        this.slides.splice(this.currentIndex + 1, 0, dup);
        this.switchTo(this.currentIndex + 1);
        this.renderList();
    }

    deleteSlide() {
        if (this.slides.length <= 1) return;
        this.slides.splice(this.currentIndex, 1);
        const idx = Math.min(this.currentIndex, this.slides.length - 1);
        this.currentIndex = -1; // force reload
        this.switchTo(idx);
        this.renderList();
    }

    /* ---- Switch ---- */

    _saveCurrent() {
        if (this.currentIndex >= 0 && this.currentIndex < this.slides.length) {
            const s = this.slides[this.currentIndex];
            s.state = this.cm.getState();
            s.thumbnail = this.cm.getThumbnail(140);
            s.format = this.cm.currentFormat;
        }
    }

    switchTo(index) {
        if (index === this.currentIndex) return;
        if (index < 0 || index >= this.slides.length) return;

        this._saveCurrent();
        this.currentIndex = index;

        const slide = this.slides[index];
        if (slide.format) {
            this.cm.setFormat(slide.format);
            document.getElementById('format-select').value = slide.format;
        }

        this.cm.loadState(slide.state).then(() => {
            this._updateHighlight();
            const bg = this.cm.canvas.backgroundColor || '#ffffff';
            document.getElementById('bg-color').value = bg;
            document.getElementById('bg-color-hex').value = bg;

            const hasBg = this.cm.hasBackgroundImage();
            document.getElementById('btn-bg-image-remove').style.display = hasBg ? '' : 'none';
        });
    }

    /* ---- Rendering ---- */

    renderList() {
        this.listEl.innerHTML = '';
        this.slides.forEach((slide, i) => {
            const el = document.createElement('div');
            el.className = 'slide-item' + (i === this.currentIndex ? ' active' : '');

            const num = document.createElement('span');
            num.className = 'slide-number';
            num.textContent = i + 1;

            const thumb = document.createElement('div');
            thumb.className = 'slide-thumbnail';
            if (slide.thumbnail) {
                thumb.style.backgroundImage = `url(${slide.thumbnail})`;
            }

            const fmt = this.cm.formats[slide.format || 'post-square'];
            thumb.style.paddingBottom = `${(fmt.height / fmt.width) * 100}%`;

            el.appendChild(num);
            el.appendChild(thumb);
            el.addEventListener('click', () => {
                this.switchTo(i);
                this.renderList();
            });

            this.listEl.appendChild(el);
        });
    }

    _updateHighlight() {
        const items = this.listEl.querySelectorAll('.slide-item');
        items.forEach((el, i) => el.classList.toggle('active', i === this.currentIndex));
    }

    /* ---- Persistence ---- */

    getAllStates() {
        this._saveCurrent();
        return this.slides.map((s) => ({ state: s.state, format: s.format }));
    }

    async loadAllStates(data) {
        this.slides = [];
        this.currentIndex = -1;

        data.forEach((d, i) => {
            this.slides.push({
                id: Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 8),
                state: d.state,
                thumbnail: null,
                format: d.format || 'post-square',
            });
        });

        if (this.slides.length > 0) {
            // Load first slide
            this.currentIndex = 0;
            const slide = this.slides[0];
            this.cm.setFormat(slide.format || 'post-square');
            document.getElementById('format-select').value = slide.format || 'post-square';
            await this.cm.loadState(slide.state);

            // Generate thumbnails for all slides
            await this._regenerateThumbnails();
        }

        this.renderList();
    }

    async _regenerateThumbnails() {
        const origIdx = this.currentIndex;

        for (let i = 0; i < this.slides.length; i++) {
            const slide = this.slides[i];
            this.cm.setFormat(slide.format || 'post-square');
            await this.cm.loadState(slide.state);
            slide.thumbnail = this.cm.getThumbnail(140);
        }

        // Restore original
        if (origIdx >= 0 && origIdx < this.slides.length) {
            const slide = this.slides[origIdx];
            this.cm.setFormat(slide.format || 'post-square');
            await this.cm.loadState(slide.state);
        }
    }

    /* Save + update thumbnail for current slide (called on changes) */
    updateCurrentThumbnail() {
        if (this.currentIndex >= 0 && this.currentIndex < this.slides.length) {
            this.slides[this.currentIndex].state = this.cm.getState();
            this.slides[this.currentIndex].thumbnail = this.cm.getThumbnail(140);
            this.slides[this.currentIndex].format = this.cm.currentFormat;
            this.renderList();
        }
    }
}
