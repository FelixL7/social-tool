class CanvasManager {
    constructor(canvasId) {
        this.formats = {
            'post-square':    { width: 1080, height: 1080, label: 'Post Quadrat' },
            'post-portrait':  { width: 1080, height: 1350, label: 'Post Hochformat' },
            'post-landscape': { width: 1080, height: 566,  label: 'Post Querformat' },
            'story':          { width: 1080, height: 1920, label: 'Story / Reel' },
        };

        this.currentFormat = 'post-square';

        this.canvas = new fabric.Canvas(canvasId, {
            preserveObjectStacking: true,
            backgroundColor: '#ffffff',
            selection: true,
        });

        this._resizeObserver = null;
        this._setupResizeObserver();
        this.updateCanvasSize();
    }

    /* ---- Sizing ---- */

    _getScale() {
        const area = document.getElementById('canvas-area');
        if (!area) return 0.5;
        const maxW = area.clientWidth - 60;
        const maxH = area.clientHeight - 60;
        const fmt = this.formats[this.currentFormat];
        return Math.min(maxW / fmt.width, maxH / fmt.height, 1);
    }

    updateCanvasSize() {
        const fmt = this.formats[this.currentFormat];
        const scale = this._getScale();
        this.canvas.setZoom(scale);
        this.canvas.setWidth(fmt.width * scale);
        this.canvas.setHeight(fmt.height * scale);
        this.canvas.renderAll();
    }

    _setupResizeObserver() {
        const area = document.getElementById('canvas-area');
        if (!area) return;
        this._resizeObserver = new ResizeObserver(() => this.updateCanvasSize());
        this._resizeObserver.observe(area);
    }

    setFormat(formatKey) {
        if (!this.formats[formatKey]) return;
        this.currentFormat = formatKey;
        this.updateCanvasSize();
    }

    /* ---- Background ---- */

    setBackgroundColor(color) {
        this.canvas.setBackgroundImage(null, this.canvas.renderAll.bind(this.canvas));
        this.canvas.backgroundColor = color;
        this.canvas.renderAll();
    }

    setBackgroundImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fmt = this.formats[this.currentFormat];
                fabric.Image.fromURL(e.target.result, (img) => {
                    this.canvas.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas), {
                        scaleX: fmt.width / img.width,
                        scaleY: fmt.height / img.height,
                    });
                    resolve();
                });
            };
            reader.readAsDataURL(file);
        });
    }

    removeBackgroundImage() {
        this.canvas.setBackgroundImage(null, this.canvas.renderAll.bind(this.canvas));
    }

    hasBackgroundImage() {
        return !!this.canvas.backgroundImage;
    }

    /* ---- Add Objects ---- */

    addText(opts = {}) {
        const fmt = this.formats[this.currentFormat];
        const text = new fabric.IText(opts.text || 'Text eingeben', {
            left: fmt.width / 2,
            top: fmt.height / 2,
            originX: 'center',
            originY: 'center',
            fontFamily: opts.fontFamily || 'Inter',
            fontSize: opts.fontSize || 48,
            fill: opts.fill || '#000000',
            fontWeight: opts.fontWeight || 'normal',
            fontStyle: opts.fontStyle || 'normal',
            textAlign: opts.textAlign || 'center',
            lineHeight: 1.2,
        });
        this.canvas.add(text);
        this.canvas.setActiveObject(text);
        this.canvas.renderAll();
        return text;
    }

    addRect(opts = {}) {
        const fmt = this.formats[this.currentFormat];
        const rect = new fabric.Rect({
            left: fmt.width / 2 - 100,
            top: fmt.height / 2 - 100,
            width: opts.width || 200,
            height: opts.height || 200,
            fill: opts.fill || '#6c63ff',
            stroke: opts.stroke || '',
            strokeWidth: opts.strokeWidth || 0,
            rx: opts.rx || 0,
            ry: opts.ry || 0,
        });
        this.canvas.add(rect);
        this.canvas.setActiveObject(rect);
        this.canvas.renderAll();
        return rect;
    }

    addCircle(opts = {}) {
        const fmt = this.formats[this.currentFormat];
        const circle = new fabric.Circle({
            left: fmt.width / 2,
            top: fmt.height / 2,
            originX: 'center',
            originY: 'center',
            radius: opts.radius || 100,
            fill: opts.fill || '#e74c3c',
            stroke: opts.stroke || '',
            strokeWidth: opts.strokeWidth || 0,
        });
        this.canvas.add(circle);
        this.canvas.setActiveObject(circle);
        this.canvas.renderAll();
        return circle;
    }

    addTriangle(opts = {}) {
        const fmt = this.formats[this.currentFormat];
        const tri = new fabric.Triangle({
            left: fmt.width / 2,
            top: fmt.height / 2,
            originX: 'center',
            originY: 'center',
            width: opts.width || 200,
            height: opts.height || 180,
            fill: opts.fill || '#2ecc71',
        });
        this.canvas.add(tri);
        this.canvas.setActiveObject(tri);
        this.canvas.renderAll();
        return tri;
    }

    addLine(opts = {}) {
        const fmt = this.formats[this.currentFormat];
        const cx = fmt.width / 2;
        const cy = fmt.height / 2;
        const line = new fabric.Line([cx - 120, cy, cx + 120, cy], {
            stroke: opts.stroke || '#000000',
            strokeWidth: opts.strokeWidth || 4,
            strokeLineCap: 'round',
        });
        this.canvas.add(line);
        this.canvas.setActiveObject(line);
        this.canvas.renderAll();
        return line;
    }

    addImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                fabric.Image.fromURL(e.target.result, (img) => {
                    const fmt = this.formats[this.currentFormat];
                    const maxDim = Math.min(fmt.width, fmt.height) * 0.7;
                    const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);

                    img.set({
                        left: fmt.width / 2,
                        top: fmt.height / 2,
                        originX: 'center',
                        originY: 'center',
                        scaleX: scale,
                        scaleY: scale,
                    });

                    this.canvas.add(img);
                    this.canvas.setActiveObject(img);
                    this.canvas.renderAll();
                    resolve(img);
                });
            };
            reader.readAsDataURL(file);
        });
    }

    /* ---- Object Actions ---- */

    deleteSelected() {
        const objs = this.canvas.getActiveObjects();
        if (!objs.length) return;
        objs.forEach((o) => this.canvas.remove(o));
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
    }

    _reorder(obj, newIdx) {
        const arr = this.canvas._objects;
        const oldIdx = arr.indexOf(obj);
        if (oldIdx < 0) return false;
        const clamped = Math.max(0, Math.min(arr.length - 1, newIdx));
        if (clamped === oldIdx) return false;
        arr.splice(oldIdx, 1);
        arr.splice(clamped, 0, obj);
        this.canvas.setActiveObject(obj);
        this.canvas.renderAll();
        this.canvas.fire('stacking:changed', { target: obj });
        return true;
    }

    bringForward() {
        const obj = this.canvas.getActiveObject();
        if (!obj) return;
        const idx = this.canvas._objects.indexOf(obj);
        this._reorder(obj, idx + 1);
    }

    sendBackward() {
        const obj = this.canvas.getActiveObject();
        if (!obj) return;
        const idx = this.canvas._objects.indexOf(obj);
        this._reorder(obj, idx - 1);
    }

    bringToFront() {
        const obj = this.canvas.getActiveObject();
        if (!obj) return;
        this._reorder(obj, this.canvas._objects.length - 1);
    }

    sendToBack() {
        const obj = this.canvas.getActiveObject();
        if (!obj) return;
        this._reorder(obj, 0);
    }

    /* ---- Serialization ---- */

    getState() {
        return this.canvas.toJSON(['selectable', 'evented', 'editable']);
    }

    loadState(state) {
        return new Promise((resolve) => {
            this.canvas.loadFromJSON(state, () => {
                this.canvas.getObjects().forEach((o) => {
                    if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
                        o.set({
                            selectable: true,
                            evented: true,
                            editable: true,
                            hoverCursor: 'text',
                        });
                        if (typeof o.initBehavior === 'function') o.initBehavior();
                        o.setCoords();
                    }
                });
                this.canvas.renderAll();
                resolve();
            });
        });
    }

    clear() {
        this.canvas.clear();
        this.canvas.backgroundColor = '#ffffff';
        this.canvas.renderAll();
    }

    /* ---- Thumbnails ---- */

    getThumbnail(maxWidth = 140) {
        const fmt = this.formats[this.currentFormat];
        const scale = maxWidth / fmt.width;
        const prevZoom = this.canvas.getZoom();
        const prevW = this.canvas.getWidth();
        const prevH = this.canvas.getHeight();

        this.canvas.setZoom(scale);
        this.canvas.setWidth(fmt.width * scale);
        this.canvas.setHeight(fmt.height * scale);

        const dataUrl = this.canvas.toDataURL({ format: 'png', quality: 0.7 });

        this.canvas.setZoom(prevZoom);
        this.canvas.setWidth(prevW);
        this.canvas.setHeight(prevH);

        return dataUrl;
    }

    /* ---- Export ---- */

    exportImage(format = 'png', quality = 1) {
        const fmt = this.formats[this.currentFormat];
        const prevZoom = this.canvas.getZoom();
        const prevW = this.canvas.getWidth();
        const prevH = this.canvas.getHeight();

        this.canvas.setZoom(1);
        this.canvas.setWidth(fmt.width);
        this.canvas.setHeight(fmt.height);

        const dataUrl = this.canvas.toDataURL({ format, quality, multiplier: 1 });

        this.canvas.setZoom(prevZoom);
        this.canvas.setWidth(prevW);
        this.canvas.setHeight(prevH);

        return dataUrl;
    }
}
