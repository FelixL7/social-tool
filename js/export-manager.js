class ExportManager {
    constructor(canvasManager, slideManager) {
        this.cm = canvasManager;
        this.sm = slideManager;
    }

    /* ---- Export single slide ---- */

    exportCurrentSlide(format = 'png', quality = 1) {
        const dataUrl = this.cm.exportImage(format, quality);
        this._download(dataUrl, `slide-${this.sm.currentIndex + 1}.${format}`);
    }

    /* ---- Export all slides ---- */

    async exportAllSlides(format = 'png', quality = 1) {
        this.sm._saveCurrent();
        const origIdx = this.sm.currentIndex;

        for (let i = 0; i < this.sm.slides.length; i++) {
            const slide = this.sm.slides[i];
            this.cm.setFormat(slide.format || 'post-square');
            await this.cm.loadState(slide.state);

            const dataUrl = this.cm.exportImage(format, quality);
            this._download(dataUrl, `slide-${i + 1}.${format}`);

            // Small delay so browser doesn't block multiple downloads
            await new Promise((r) => setTimeout(r, 350));
        }

        // Restore
        if (origIdx >= 0 && origIdx < this.sm.slides.length) {
            const slide = this.sm.slides[origIdx];
            this.cm.setFormat(slide.format || 'post-square');
            document.getElementById('format-select').value = slide.format || 'post-square';
            await this.cm.loadState(slide.state);
        }
    }

    /* ---- Save Project ---- */

    saveProject(extra = {}) {
        const project = {
            version: '1.1',
            createdAt: new Date().toISOString(),
            slides: this.sm.getAllStates(),
            ...extra,
        };

        const json = JSON.stringify(project);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        this._download(url, `social-tool-projekt-${this._dateStamp()}.json`);
        URL.revokeObjectURL(url);
    }

    /* ---- Load Project ---- */

    loadProject(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const project = JSON.parse(e.target.result);
                    if (!project.slides || !project.slides.length) {
                        throw new Error('Keine Slides im Projekt gefunden.');
                    }
                    await this.sm.loadAllStates(project.slides);
                    resolve(project);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
            reader.readAsText(file);
        });
    }

    /* ---- Helpers ---- */

    _download(href, filename) {
        const a = document.createElement('a');
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    _dateStamp() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}
class ExportManager {
    constructor(canvasManager, slideManager) {
        this.cm = canvasManager;
        this.sm = slideManager;
    }

    /* ---- Export single slide ---- */

    exportCurrentSlide(format = 'png', quality = 1) {
        const dataUrl = this.cm.exportImage(format, quality);
        this._download(dataUrl, `slide-${this.sm.currentIndex + 1}.${format}`);
    }

    /* ---- Export all slides ---- */

    async exportAllSlides(format = 'png', quality = 1) {
        this.sm._saveCurrent();
        const origIdx = this.sm.currentIndex;

        for (let i = 0; i < this.sm.slides.length; i++) {
            const slide = this.sm.slides[i];
            this.cm.setFormat(slide.format || 'post-square');
            await this.cm.loadState(slide.state);

            const dataUrl = this.cm.exportImage(format, quality);
            this._download(dataUrl, `slide-${i + 1}.${format}`);

            // Small delay so browser doesn't block multiple downloads
            await new Promise((r) => setTimeout(r, 350));
        }

        // Restore
        if (origIdx >= 0 && origIdx < this.sm.slides.length) {
            const slide = this.sm.slides[origIdx];
            this.cm.setFormat(slide.format || 'post-square');
            document.getElementById('format-select').value = slide.format || 'post-square';
            await this.cm.loadState(slide.state);
        }
    }

    /* ---- Save Project ---- */

    saveProject() {
        const project = {
            version: '1.0',
            createdAt: new Date().toISOString(),
            slides: this.sm.getAllStates(),
        };

        const json = JSON.stringify(project);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        this._download(url, `social-tool-projekt-${this._dateStamp()}.json`);
        URL.revokeObjectURL(url);
    }

    /* ---- Load Project ---- */

    loadProject(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const project = JSON.parse(e.target.result);
                    if (!project.slides || !project.slides.length) {
                        throw new Error('Keine Slides im Projekt gefunden.');
                    }
                    await this.sm.loadAllStates(project.slides);
                    resolve(project);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
            reader.readAsText(file);
        });
    }

    /* ---- Helpers ---- */

    _download(href, filename) {
        const a = document.createElement('a');
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    _dateStamp() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}
