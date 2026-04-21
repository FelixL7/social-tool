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

    /* ---- Blobs ---- */

    // Generate a single blob's shape data with a given number of corners
    _generateBlobShapeData(corners) {
        const n = corners || 8;
        const step = (2 * Math.PI) / n;
        const angles = [];
        const radii = [];
        for (let i = 0; i < n; i++) {
            angles.push(step * i + (Math.random() - 0.5) * step * 0.3);
            radii.push(1 + (Math.random() - 0.5) * 0.5 * 2); // multiplier ~0.5–1.5
        }
        return { angles, radii };
    }

    // Generate blob data array (shape + position for each blob)
    _generateBlobData(config) {
        const cMin = config.cornersMin || 6;
        const cMax = config.cornersMax || 10;
        const data = [];
        for (let i = 0; i < config.blobCount; i++) {
            const corners = cMin + Math.floor(Math.random() * (cMax - cMin + 1));
            const relX = Math.random();
            const relY = Math.random();
            data.push({ shape: this._generateBlobShapeData(corners), relX, relY });
        }
        return data;
    }

    // Build SVG path from shape data at a given radius and smoothness
    _blobPathFromData(shapeData, radius, smoothness) {
        const n = shapeData.angles.length;
        const pts = shapeData.angles.map((a, i) => ({
            x: (shapeData.radii[i] * radius) * Math.cos(a),
            y: (shapeData.radii[i] * radius) * Math.sin(a),
        }));

        // smoothness 0 = polygon (no curves), 1 = nicely rounded
        const tension = (smoothness != null ? smoothness : 1) * 0.2;

        if (tension === 0) {
            // Straight-line polygon
            let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} `;
            for (let i = 1; i < n; i++) {
                d += `L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} `;
            }
            d += 'Z';
            return d;
        }

        let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} `;

        for (let i = 0; i < n; i++) {
            const p0 = pts[(i - 1 + n) % n];
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            const p3 = pts[(i + 2) % n];

            const cp1x = p1.x + (p2.x - p0.x) * tension;
            const cp1y = p1.y + (p2.y - p0.y) * tension;
            const cp2x = p2.x - (p3.x - p1.x) * tension;
            const cp2y = p2.y - (p3.y - p1.y) * tension;

            d += `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
        }

        d += 'Z';
        return d;
    }

    _buildBlobObjects(config) {
        const objects = [];

        // Background rect
        const bgRect = new fabric.Rect({
            left: -config.areaWidth / 2,
            top: -config.areaHeight / 2,
            width: config.areaWidth,
            height: config.areaHeight,
            fill: config.bgTransparent ? 'transparent' : config.bgColor,
            selectable: false,
            evented: false,
        });
        objects.push(bgRect);

        // Ensure blobData exists and matches count
        const cMin = config.cornersMin || 6;
        const cMax = config.cornersMax || 10;
        if (!config.blobData || config.blobData.length !== config.blobCount) {
            const existing = config.blobData || [];
            const newData = [];
            for (let i = 0; i < config.blobCount; i++) {
                newData.push(existing[i] || {
                    shape: this._generateBlobShapeData(
                        cMin + Math.floor(Math.random() * (cMax - cMin + 1))
                    ),
                    relX: Math.random(),
                    relY: Math.random(),
                });
            }
            config.blobData = newData;
        }

        // Auto-calculate blob sizes to fill area
        // When overlap is disabled, reduce fill so blobs can actually be packed
        const totalArea = config.areaWidth * config.areaHeight;
        const n = config.blobCount;
        const allowOverlap = config.allowOverlap === true;
        const fillRatio = allowOverlap ? 0.75 : Math.min(0.55, 0.75 / Math.max(1, n * 0.15));
        const targetArea = totalArea * fillRatio;
        const L = config.largeBlobScale || 2.5;
        let smallRadius, largeRadius;

        if (config.sizeMode === 'mixed' && n > 1) {
            const smallArea = targetArea / (L * L + n - 1);
            smallRadius = Math.sqrt(smallArea / Math.PI);
            largeRadius = L * smallRadius;
        } else {
            const eachArea = targetArea / n;
            smallRadius = Math.sqrt(eachArea / Math.PI);
            largeRadius = smallRadius;
        }

        const smoothness = config.smoothness != null ? config.smoothness : 1;
        const halfW = config.areaWidth / 2;
        const halfH = config.areaHeight / 2;

        // Compute radii and initial positions for all blobs
        const blobs = [];
        for (let i = 0; i < config.blobCount; i++) {
            const bd = config.blobData[i];
            const isLarge = config.sizeMode === 'mixed' && i === 0;
            const radius = isLarge ? largeRadius : smallRadius;
            const collisionR = radius * 1.2;
            const margin = radius;
            const rw = Math.max(1, config.areaWidth - 2 * margin);
            const rh = Math.max(1, config.areaHeight - 2 * margin);
            blobs.push({
                bd, radius, collisionR, margin,
                x: -halfW + margin + bd.relX * rw,
                y: -halfH + margin + bd.relY * rh,
            });
        }

        // Separate overlapping blobs using iterative force-directed push
        if (!allowOverlap && blobs.length > 1) {
            for (let iter = 0; iter < 300; iter++) {
                let maxPush = 0;
                for (let a = 0; a < blobs.length; a++) {
                    for (let b = a + 1; b < blobs.length; b++) {
                        const dx = blobs[b].x - blobs[a].x;
                        const dy = blobs[b].y - blobs[a].y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
                        const minDist = blobs[a].collisionR + blobs[b].collisionR;
                        if (dist < minDist) {
                            const overlap = minDist - dist;
                            const pushX = (dx / dist) * overlap * 0.55;
                            const pushY = (dy / dist) * overlap * 0.55;
                            blobs[a].x -= pushX;
                            blobs[a].y -= pushY;
                            blobs[b].x += pushX;
                            blobs[b].y += pushY;
                            maxPush = Math.max(maxPush, overlap);
                        }
                    }
                }
                // Clamp all blobs inside area
                for (const bl of blobs) {
                    const m = bl.margin;
                    bl.x = Math.max(-halfW + m, Math.min(halfW - m, bl.x));
                    bl.y = Math.max(-halfH + m, Math.min(halfH - m, bl.y));
                }
                if (maxPush < 0.5) break;
            }

            // Write back relative positions
            for (const bl of blobs) {
                const m = bl.margin;
                const rw = Math.max(1, config.areaWidth - 2 * m);
                const rh = Math.max(1, config.areaHeight - 2 * m);
                bl.bd.relX = (bl.x - (-halfW + m)) / rw;
                bl.bd.relY = (bl.y - (-halfH + m)) / rh;
            }
        }

        // Build fabric objects from final positions
        for (let i = 0; i < blobs.length; i++) {
            const bl = blobs[i];
            const pathStr = this._blobPathFromData(bl.bd.shape, bl.radius, smoothness);
            const color = config.blobColors[i % config.blobColors.length];

            const blob = new fabric.Path(pathStr, {
                left: bl.x,
                top: bl.y,
                fill: color,
                opacity: config.blobOpacity != null ? config.blobOpacity : 1,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
            });

            objects.push(blob);
        }

        return objects;
    }

    // Replace group on canvas, preserving visual size and position
    _replaceBlobGroup(existingGroup, config) {
        const visualW = (existingGroup.width || 1) * (existingGroup.scaleX || 1);
        const visualH = (existingGroup.height || 1) * (existingGroup.scaleY || 1);
        const pos = {
            left: existingGroup.left,
            top: existingGroup.top,
            angle: existingGroup.angle || 0,
            opacity: existingGroup.opacity != null ? existingGroup.opacity : 1,
            originX: existingGroup.originX || 'center',
            originY: existingGroup.originY || 'center',
        };

        const idx = this.canvas._objects.indexOf(existingGroup);
        this.canvas.remove(existingGroup);

        const objects = this._buildBlobObjects(config);
        const group = new fabric.Group(objects, {
            ...pos,
            _blobConfig: JSON.parse(JSON.stringify(config)),
        });

        // Restore visual size by recalculating scale from new internal dimensions
        group.set({
            scaleX: visualW / (group.width || 1),
            scaleY: visualH / (group.height || 1),
        });

        this.canvas.add(group);
        if (idx >= 0 && idx < this.canvas._objects.length) {
            this.canvas.moveTo(group, idx);
        }

        this.canvas.setActiveObject(group);
        this.canvas.renderAll();
        return group;
    }

    addBlob(opts = {}) {
        const fmt = this.formats[this.currentFormat];
        const config = {
            areaWidth: opts.areaWidth || 400,
            areaHeight: opts.areaHeight || 400,
            blobCount: opts.blobCount || 1,
            sizeMode: opts.sizeMode || 'equal',
            largeBlobScale: opts.largeBlobScale || 2.5,
            smoothness: opts.smoothness != null ? opts.smoothness : 1,
            cornersMin: opts.cornersMin || 6,
            cornersMax: opts.cornersMax || 10,
            allowOverlap: opts.allowOverlap === true,
            bgColor: opts.bgColor || '#ffffff',
            bgTransparent: opts.bgTransparent !== undefined ? opts.bgTransparent : true,
            blobColors: opts.blobColors || ['#6c63ff'],
            blobOpacity: opts.blobOpacity != null ? opts.blobOpacity : 1,
            blobData: null,
        };
        config.blobData = this._generateBlobData(config);

        const objects = this._buildBlobObjects(config);
        const group = new fabric.Group(objects, {
            left: fmt.width / 2,
            top: fmt.height / 2,
            originX: 'center',
            originY: 'center',
            _blobConfig: JSON.parse(JSON.stringify(config)),
        });

        this.canvas.add(group);
        this.canvas.setActiveObject(group);
        this.canvas.renderAll();
        return group;
    }

    // Update blob properties while preserving shapes
    updateBlob(existingGroup) {
        if (!existingGroup || !existingGroup._blobConfig) return null;
        return this._replaceBlobGroup(existingGroup, existingGroup._blobConfig);
    }

    // Generate completely new random shapes
    regenerateBlob(existingGroup) {
        if (!existingGroup || !existingGroup._blobConfig) return null;
        const config = existingGroup._blobConfig;
        config.blobData = this._generateBlobData(config);
        return this._replaceBlobGroup(existingGroup, config);
    }

    // Dissolve blob group into individual canvas objects
    ungroupBlob(group) {
        if (!group || !group._blobConfig) return [];

        const items = group.getObjects().slice();
        const groupOpacity = group.opacity != null ? group.opacity : 1;

        // Compute each child's absolute transform while still inside the group
        const absTransforms = items.map((child) => {
            const m = child.calcTransformMatrix();
            return fabric.util.qrDecompose(m);
        });

        const idx = this.canvas._objects.indexOf(group);
        this.canvas.remove(group);

        const created = [];
        items.forEach((child, i) => {
            const t = absTransforms[i];

            // Clear the group reference so Fabric.js doesn't apply
            // the old group transform on top of the absolute position
            child.group = undefined;

            child.set({
                left: t.translateX,
                top: t.translateY,
                scaleX: t.scaleX,
                scaleY: t.scaleY,
                angle: t.angle,
                skewX: t.skewX || 0,
                skewY: t.skewY || 0,
                originX: 'center',
                originY: 'center',
                opacity: (child.opacity != null ? child.opacity : 1) * groupOpacity,
                selectable: true,
                evented: true,
            });
            child.setCoords();
            this.canvas.add(child);
            if (idx >= 0) {
                this.canvas.moveTo(child, idx + i);
            }
            created.push(child);
        });

        if (created.length) {
            this.canvas.setActiveObject(created[created.length - 1]);
        }
        this.canvas.renderAll();
        return created;
    }

    /* ---- Serialization ---- */

    getState() {
        return this.canvas.toJSON(['selectable', 'evented', 'editable', '_blobConfig']);
    }

    loadState(state) {
        return new Promise((resolve) => {
            this.canvas.fire('state:loading');
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
                this.canvas.fire('state:loaded');
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
            this.canvas.fire('state:loading');
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
                this.canvas.fire('state:loaded');
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
