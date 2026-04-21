/* ================================================================
   Social Tool – Main Application
   ================================================================ */

const canvasManager = new CanvasManager('main-canvas');
const slideManager  = new SlideManager(canvasManager);
const exportManager = new ExportManager(canvasManager, slideManager);
const pathEditor    = new PathEditor(canvasManager);

/* ================================================================
   HISTORY (Undo / Redo — pro Slide)
   ================================================================ */

class HistoryManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = 60;
        this.suspended = false;
        this.replaying = false;
    }

    reset() {
        this.undoStack = [];
        this.redoStack = [];
        this._push();
        this._updateButtons();
    }

    _push() {
        const state = JSON.stringify(this.cm.getState());
        const last = this.undoStack[this.undoStack.length - 1];
        if (last === state) return false;
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxSize) this.undoStack.shift();
        return true;
    }

    snapshot() {
        if (this.suspended) return;
        if (this._push()) {
            this.redoStack = [];
            this._updateButtons();
        }
    }

    async undo() {
        if (this.undoStack.length <= 1) return;
        this.suspended = true;
        this.replaying = true;
        const current = this.undoStack.pop();
        this.redoStack.push(current);
        const prev = this.undoStack[this.undoStack.length - 1];
        await this.cm.loadState(JSON.parse(prev));
        this.suspended = false;
        this.replaying = false;
        this._updateButtons();
    }

    async redo() {
        if (!this.redoStack.length) return;
        this.suspended = true;
        this.replaying = true;
        const next = this.redoStack.pop();
        this.undoStack.push(next);
        await this.cm.loadState(JSON.parse(next));
        this.suspended = false;
        this.replaying = false;
        this._updateButtons();
    }

    _updateButtons() {
        const undoBtn = document.getElementById('tool-undo');
        const redoBtn = document.getElementById('tool-redo');
        if (undoBtn) undoBtn.disabled = this.undoStack.length <= 1;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }
}

const history = new HistoryManager(canvasManager);

// Record on mutating events (skip path-editor helper objects)
canvasManager.canvas.on('object:added',     (e) => { if (!e.target?._peHandle) history.snapshot(); });
canvasManager.canvas.on('object:removed',   (e) => { if (!e.target?._peHandle) history.snapshot(); });
canvasManager.canvas.on('object:modified',  (e) => { if (!e.target?._peHandle) history.snapshot(); });
canvasManager.canvas.on('stacking:changed', () => history.snapshot());

// Pause recording during loadFromJSON (fires many object:added) and reset
// the stacks when a different slide's state is now on canvas.
// Skip the reset during undo/redo replay, otherwise the stacks would be wiped
// after every undo and only one step back would be possible.
canvasManager.canvas.on('state:loading', () => { history.suspended = true; });
canvasManager.canvas.on('state:loaded',  () => {
    history.suspended = false;
    if (!history.replaying) history.reset();
});

// Property-panel changes (color, size, font, position inputs etc.)
// fire 'change' on commit but don't trigger object:modified. Snapshot manually.
document.getElementById('properties-panel').addEventListener('change', () => {
    history.snapshot();
});

/* ---- Toast Notification ---- */

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ' toast-' + type : '');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.className = 'toast'; }, 2500);
}

/* ---- Google Fonts: dynamic on-demand loader ---- */

const SYSTEM_FONTS = new Set([
    'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
    'Courier New', 'Verdana', 'Impact',
]);

const _fontPromises = new Map();

function loadGoogleFont(family) {
    if (!family) return Promise.resolve();
    if (SYSTEM_FONTS.has(family)) return Promise.resolve();
    if (_fontPromises.has(family)) return _fontPromises.get(family);

    const familyParam = family.replace(/ /g, '+');
    const href = `https://fonts.googleapis.com/css2?family=${familyParam}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;

    const p = new Promise((resolve) => {
        let link = document.querySelector(`link[data-font="${family}"]`);
        const waitForFaces = () => {
            Promise.all([
                document.fonts.load(`400 16px "${family}"`),
                document.fonts.load(`700 16px "${family}"`),
                document.fonts.load(`italic 400 16px "${family}"`),
            ]).catch(() => {}).then(() => resolve());
        };

        if (!link) {
            link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.dataset.font = family;
            link.addEventListener('load', waitForFaces, { once: true });
            link.addEventListener('error', () => resolve(), { once: true });
            document.head.appendChild(link);
        } else if (link.sheet) {
            waitForFaces();
        } else {
            link.addEventListener('load', waitForFaces, { once: true });
            link.addEventListener('error', () => resolve(), { once: true });
        }
    });

    _fontPromises.set(family, p);
    return p;
}

function applyFontToObject(obj, family) {
    if (!obj) return;
    if (fabric && fabric.util && typeof fabric.util.clearFabricFontCache === 'function') {
        fabric.util.clearFabricFontCache(family);
    }
    obj.set('fontFamily', family);
    if (typeof obj.initDimensions === 'function') obj.initDimensions();
    obj.setCoords();
    canvasManager.canvas.requestRenderAll();
}

function preloadFontsFromCanvas() {
    const fonts = new Set();
    canvasManager.canvas.getObjects().forEach((o) => {
        if (o.fontFamily) fonts.add(o.fontFamily);
    });
    const loaders = [...fonts].map(loadGoogleFont);
    return Promise.all(loaders).then(() => canvasManager.canvas.renderAll());
}

/* ---- Helper: sync color input + hex field ---- */

function linkColorInputs(colorId, hexId) {
    const colorEl = document.getElementById(colorId);
    const hexEl   = document.getElementById(hexId);

    colorEl.addEventListener('input', () => { hexEl.value = colorEl.value; });
    hexEl.addEventListener('change', () => {
        let v = hexEl.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
            colorEl.value = v;
            hexEl.value = v;
            colorEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
}

linkColorInputs('bg-color', 'bg-color-hex');
linkColorInputs('obj-fill', 'obj-fill-hex');
linkColorInputs('text-color', 'text-color-hex');
linkColorInputs('shape-stroke', 'shape-stroke-hex');

/* ================================================================
   FORMAT SELECTION
   ================================================================ */

const customSizeEl = document.getElementById('custom-size');
const customWidthEl = document.getElementById('custom-width');
const customHeightEl = document.getElementById('custom-height');

document.getElementById('format-select').addEventListener('change', (e) => {
    const val = e.target.value;
    customSizeEl.style.display = val === 'custom' ? 'flex' : 'none';
    if (val === 'custom') {
        const w = parseInt(customWidthEl.value) || 1080;
        const h = parseInt(customHeightEl.value) || 1080;
        canvasManager.formats['custom'] = { width: w, height: h, label: 'Manuell' };
    }
    canvasManager.setFormat(val);
    if (slideManager.slides[slideManager.currentIndex]) {
        slideManager.slides[slideManager.currentIndex].format = val;
    }
});

function applyCustomSize() {
    const w = parseInt(customWidthEl.value) || 1080;
    const h = parseInt(customHeightEl.value) || 1080;
    canvasManager.formats['custom'] = { width: w, height: h, label: 'Manuell' };
    if (canvasManager.currentFormat === 'custom') {
        canvasManager.updateCanvasSize();
    }
}
customWidthEl.addEventListener('change', applyCustomSize);
customHeightEl.addEventListener('change', applyCustomSize);

/* ================================================================
   BACKGROUND
   ================================================================ */

document.getElementById('bg-color').addEventListener('input', (e) => {
    canvasManager.setBackgroundColor(e.target.value);
    document.getElementById('bg-color-hex').value = e.target.value;
    document.getElementById('btn-bg-image-remove').style.display = 'none';
});

// Background palette – editable quick colors
const DEFAULT_PALETTE = [
    '#ffffff','#f8f9fa','#000000','#1a1a2e','#e74c3c','#e67e22',
    '#f1c40f','#2ecc71','#3498db','#9b59b6','#1abc9c','#fd79a8',
    '#6c5ce7','#00cec9','#ffeaa7','#dfe6e9',
];

let paletteColors = JSON.parse(localStorage.getItem('st-palette')) || [...DEFAULT_PALETTE];
let paletteEditing = false;
const bgPaletteEl = document.getElementById('bg-palette');

function savePalette() {
    localStorage.setItem('st-palette', JSON.stringify(paletteColors));
}

function renderPalette() {
    bgPaletteEl.innerHTML = '';
    paletteColors.forEach((color, i) => {
        const btn = document.createElement('button');
        btn.className = 'palette-swatch' + (paletteEditing ? ' editing' : '');
        btn.dataset.color = color;
        btn.style.background = color;

        if (paletteEditing) {
            const rm = document.createElement('span');
            rm.className = 'swatch-remove';
            rm.textContent = '\u00d7';
            rm.addEventListener('click', (e) => {
                e.stopPropagation();
                paletteColors.splice(i, 1);
                savePalette();
                renderPalette();
            });
            btn.appendChild(rm);

            // Click swatch in edit mode to change color
            btn.addEventListener('click', () => {
                const picker = document.createElement('input');
                picker.type = 'color';
                picker.value = color;
                picker.style.position = 'absolute';
                picker.style.opacity = '0';
                picker.style.pointerEvents = 'none';
                document.body.appendChild(picker);
                picker.addEventListener('input', () => {
                    paletteColors[i] = picker.value;
                    savePalette();
                    renderPalette();
                });
                picker.addEventListener('change', () => {
                    document.body.removeChild(picker);
                });
                picker.click();
            });
        } else {
            btn.addEventListener('click', () => {
                canvasManager.setBackgroundColor(color);
                document.getElementById('bg-color').value = color;
                document.getElementById('bg-color-hex').value = color;
                document.getElementById('btn-bg-image-remove').style.display = 'none';
                history.snapshot();
            });
        }

        bgPaletteEl.appendChild(btn);
    });
}

renderPalette();

document.getElementById('btn-palette-edit').addEventListener('click', () => {
    paletteEditing = !paletteEditing;
    document.getElementById('btn-palette-edit').classList.toggle('active', paletteEditing);
    document.getElementById('palette-edit-controls').style.display = paletteEditing ? '' : 'none';
    renderPalette();
});

document.getElementById('btn-palette-add').addEventListener('click', () => {
    const color = document.getElementById('palette-new-color').value;
    paletteColors.push(color);
    savePalette();
    renderPalette();
});

document.getElementById('btn-palette-reset').addEventListener('click', () => {
    paletteColors = [...DEFAULT_PALETTE];
    savePalette();
    renderPalette();
});

// Background image
document.getElementById('btn-bg-image').addEventListener('click', () => {
    document.getElementById('bg-image-upload').click();
});

document.getElementById('bg-image-upload').addEventListener('change', async (e) => {
    if (e.target.files[0]) {
        await canvasManager.setBackgroundImage(e.target.files[0]);
        document.getElementById('btn-bg-image-remove').style.display = '';
        e.target.value = '';
        history.snapshot();
    }
});

document.getElementById('btn-bg-image-remove').addEventListener('click', () => {
    canvasManager.removeBackgroundImage();
    document.getElementById('btn-bg-image-remove').style.display = 'none';
    history.snapshot();
});

/* ================================================================
   TOOLS
   ================================================================ */

document.getElementById('tool-text').addEventListener('click', async () => {
    const family = document.getElementById('text-font').value || 'Inter';
    await loadGoogleFont(family);
    canvasManager.addText({ fontFamily: family });
    canvasManager.canvas.renderAll();
});
document.getElementById('tool-rect').addEventListener('click', () => canvasManager.addRect());
document.getElementById('tool-circle').addEventListener('click', () => canvasManager.addCircle());
document.getElementById('tool-triangle').addEventListener('click', () => canvasManager.addTriangle());
document.getElementById('tool-line').addEventListener('click', () => canvasManager.addLine());

document.getElementById('tool-image').addEventListener('click', () => {
    document.getElementById('image-upload').click();
});
document.getElementById('image-upload').addEventListener('change', async (e) => {
    if (e.target.files[0]) {
        await canvasManager.addImage(e.target.files[0]);
        e.target.value = '';
    }
});

document.getElementById('tool-blob').addEventListener('click', () => canvasManager.addBlob());
document.getElementById('tool-delete').addEventListener('click',   () => canvasManager.deleteSelected());
document.getElementById('tool-forward').addEventListener('click',  () => canvasManager.bringForward());
document.getElementById('tool-backward').addEventListener('click', () => canvasManager.sendBackward());
document.getElementById('tool-undo').addEventListener('click',     () => history.undo());
document.getElementById('tool-redo').addEventListener('click',     () => history.redo());

/* ================================================================
   SLIDES
   ================================================================ */

document.getElementById('btn-add-slide').addEventListener('click',       () => slideManager.addSlide());
document.getElementById('btn-duplicate-slide').addEventListener('click', () => slideManager.duplicateSlide());
document.getElementById('btn-delete-slide').addEventListener('click',    () => slideManager.deleteSlide());
document.getElementById('btn-slide-up').addEventListener('click',        () => slideManager.moveSlideUp());
document.getElementById('btn-slide-down').addEventListener('click',      () => slideManager.moveSlideDown());

/* ================================================================
   SAVE / LOAD / EXPORT
   ================================================================ */

document.getElementById('btn-save').addEventListener('click', () => {
    exportManager.saveProject({
        guides: guides.map(g => ({ axis: g.axis, pos: g.pos })),
        palette: paletteColors,
    });
    showToast('Projekt gespeichert!', 'success');
});

document.getElementById('btn-load').addEventListener('click', () => {
    document.getElementById('project-load').click();
});
document.getElementById('project-load').addEventListener('change', async (e) => {
    if (e.target.files[0]) {
        try {
            const project = await exportManager.loadProject(e.target.files[0]);
            await preloadFontsFromCanvas();
            // Restore guides
            guides.length = 0;
            if (project.guides && Array.isArray(project.guides)) {
                project.guides.forEach(g => addGuide(g.axis, g.pos));
            }
            // Restore palette
            if (project.palette && Array.isArray(project.palette)) {
                paletteColors = project.palette;
                savePalette();
                renderPalette();
            }
            showToast('Projekt geladen!', 'success');
        } catch (err) {
            showToast('Fehler: ' + err.message, 'error');
        }
        e.target.value = '';
    }
});

document.getElementById('btn-export').addEventListener('click', () => {
    exportManager.exportCurrentSlide();
    showToast('Slide exportiert!', 'success');
});

document.getElementById('btn-export-all').addEventListener('click', async () => {
    showToast('Exportiere alle Slides...', '');
    await exportManager.exportAllSlides();
    showToast('Alle Slides exportiert!', 'success');
});

/* ================================================================
   PROPERTIES PANEL
   ================================================================ */

const objectPropsEl  = document.getElementById('object-properties');
const textPropsEl    = document.getElementById('text-properties');
const shapePropsEl   = document.getElementById('shape-properties');
const blobPropsEl    = document.getElementById('blob-properties');
const radiusRow      = document.getElementById('radius-row');

/* ---- Blob color list helpers ---- */

function renderBlobColorList(colors) {
    const list = document.getElementById('blob-colors-list');
    list.innerHTML = '';
    colors.forEach((c, i) => {
        const entry = document.createElement('div');
        entry.className = 'blob-color-entry';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = c;
        colorInput.addEventListener('input', () => {
            const obj = canvasManager.canvas.getActiveObject();
            if (obj && obj._blobConfig) {
                obj._blobConfig.blobColors[i] = colorInput.value;
                hexInput.value = colorInput.value;
                canvasManager.updateBlob(obj);
            }
        });

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'hex-input';
        hexInput.value = c;
        hexInput.maxLength = 7;
        hexInput.addEventListener('change', () => {
            let v = hexInput.value.trim();
            if (!v.startsWith('#')) v = '#' + v;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                colorInput.value = v;
                hexInput.value = v;
                const obj = canvasManager.canvas.getActiveObject();
                if (obj && obj._blobConfig) {
                    obj._blobConfig.blobColors[i] = v;
                    canvasManager.updateBlob(obj);
                }
            }
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'small-btn small-btn-danger blob-remove-color';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', () => {
            const obj = canvasManager.canvas.getActiveObject();
            if (obj && obj._blobConfig && obj._blobConfig.blobColors.length > 1) {
                obj._blobConfig.blobColors.splice(i, 1);
                canvasManager.updateBlob(obj);
            }
        });

        entry.appendChild(colorInput);
        entry.appendChild(hexInput);
        if (colors.length > 1) entry.appendChild(removeBtn);
        list.appendChild(entry);
    });
}

function updatePropertiesPanel(obj) {
    if (!obj || obj.type === 'activeSelection') {
        objectPropsEl.style.display = 'none';
        return;
    }

    objectPropsEl.style.display = '';

    const isBlob = !!(obj._blobConfig);

    // Fill
    if (!isBlob && obj.fill && typeof obj.fill === 'string') {
        document.getElementById('obj-fill').value = obj.fill;
        document.getElementById('obj-fill-hex').value = obj.fill;
    }

    // Opacity
    const op = obj.opacity != null ? obj.opacity : 1;
    document.getElementById('obj-opacity').value = op;
    document.getElementById('obj-opacity-val').textContent = Math.round(op * 100) + '%';

    // Position / Size / Angle
    document.getElementById('obj-left').value = Math.round(obj.left || 0);
    document.getElementById('obj-top').value = Math.round(obj.top || 0);
    document.getElementById('obj-width').value = Math.round((obj.width || 0) * (obj.scaleX || 1));
    document.getElementById('obj-height').value = Math.round((obj.height || 0) * (obj.scaleY || 1));
    document.getElementById('obj-angle').value = Math.round(obj.angle || 0);

    // Text
    const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
    textPropsEl.style.display = isText ? '' : 'none';

    if (isText) {
        document.getElementById('text-font').value = obj.fontFamily || 'Inter';
        document.getElementById('text-size').value = obj.fontSize || 40;
        document.getElementById('text-color').value = obj.fill || '#000000';
        document.getElementById('text-color-hex').value = obj.fill || '#000000';
        document.getElementById('text-line-height').value = obj.lineHeight || 1.2;

        document.getElementById('text-bold').classList.toggle('active', obj.fontWeight === 'bold');
        document.getElementById('text-italic').classList.toggle('active', obj.fontStyle === 'italic');
        document.getElementById('text-underline').classList.toggle('active', !!obj.underline);

        // Alignment highlight
        ['left', 'center', 'right'].forEach((a) => {
            document.getElementById('text-align-' + a).classList.toggle('active', obj.textAlign === a);
        });
    }

    // Shape
    const isShape = ['rect', 'circle', 'triangle', 'line', 'path'].includes(obj.type);
    shapePropsEl.style.display = isShape ? '' : 'none';
    radiusRow.style.display = obj.type === 'rect' ? '' : 'none';
    document.getElementById('path-edit-row').style.display = obj.type === 'path' ? '' : 'none';

    if (isShape) {
        document.getElementById('shape-stroke').value = obj.stroke || '#000000';
        document.getElementById('shape-stroke-hex').value = obj.stroke || '#000000';
        document.getElementById('shape-stroke-width').value = obj.strokeWidth || 0;
        if (obj.type === 'rect') {
            document.getElementById('shape-radius').value = obj.rx || 0;
        }
    }

    // Blob
    blobPropsEl.style.display = isBlob ? '' : 'none';

    if (isBlob) {
        const cfg = obj._blobConfig;
        document.getElementById('blob-area-w').value = cfg.areaWidth;
        document.getElementById('blob-area-h').value = cfg.areaHeight;
        document.getElementById('blob-bg-color').value = cfg.bgColor || '#ffffff';
        document.getElementById('blob-bg-color-hex').value = cfg.bgColor || '#ffffff';
        document.getElementById('blob-bg-transparent').checked = !!cfg.bgTransparent;
        document.getElementById('blob-count').value = cfg.blobCount;
        document.getElementById('blob-smoothness').value = cfg.smoothness != null ? cfg.smoothness : 1;
        document.getElementById('blob-corners-min').value = cfg.cornersMin || 6;
        document.getElementById('blob-corners-max').value = cfg.cornersMax || 10;
        document.getElementById('blob-allow-overlap').checked = cfg.allowOverlap !== false;
        document.getElementById('blob-size-mode').value = cfg.sizeMode || 'equal';
        document.getElementById('blob-large-scale-row').style.display = cfg.sizeMode === 'mixed' ? '' : 'none';
        document.getElementById('blob-large-scale').value = cfg.largeBlobScale || 2.5;
        document.getElementById('blob-opacity').value = cfg.blobOpacity != null ? cfg.blobOpacity : 0.8;
        document.getElementById('blob-opacity-val').textContent = Math.round((cfg.blobOpacity != null ? cfg.blobOpacity : 0.8) * 100) + '%';
        renderBlobColorList(cfg.blobColors || ['#6c63ff']);
    }
}

/* ---- Path Editor ---- */

document.getElementById('btn-path-edit').addEventListener('click', () => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj.type === 'path') {
        pathEditor.edit(obj);
    }
});

// Close path editor when selecting a non-handle object
canvasManager.canvas.on('selection:created', (e) => {
    if (e.selected && e.selected[0] && e.selected[0]._peHandle) return;
    pathEditor.close();
});
canvasManager.canvas.on('selection:updated', (e) => {
    if (e.selected && e.selected[0] && e.selected[0]._peHandle) return;
    pathEditor.close();
});

/* ---- Canvas Events ---- */

canvasManager.canvas.on('selection:created', (e) => updatePropertiesPanel(e.selected[0]));
canvasManager.canvas.on('selection:updated', (e) => updatePropertiesPanel(e.selected[0]));
canvasManager.canvas.on('selection:cleared', ()  => updatePropertiesPanel(null));
canvasManager.canvas.on('object:modified',   (e) => updatePropertiesPanel(e.target));
canvasManager.canvas.on('object:scaling',    (e) => updatePropertiesPanel(e.target));
canvasManager.canvas.on('object:moving',     (e) => updatePropertiesPanel(e.target));
canvasManager.canvas.on('object:rotating',   (e) => updatePropertiesPanel(e.target));

/* ---- Property Inputs → Canvas ---- */

// Fill
document.getElementById('obj-fill').addEventListener('input', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    obj.set('fill', e.target.value);
    document.getElementById('obj-fill-hex').value = e.target.value;
    canvasManager.canvas.renderAll();
});

// Opacity
document.getElementById('obj-opacity').addEventListener('input', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    const val = parseFloat(e.target.value);
    obj.set('opacity', val);
    document.getElementById('obj-opacity-val').textContent = Math.round(val * 100) + '%';
    canvasManager.canvas.renderAll();
});

// Text font
document.getElementById('text-font').addEventListener('change', async (e) => {
    const family = e.target.value;
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    await loadGoogleFont(family);
    applyFontToObject(obj, family);
});

// Text size
document.getElementById('text-size').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj) { obj.set('fontSize', parseInt(e.target.value)); canvasManager.canvas.renderAll(); }
});

// Text color
document.getElementById('text-color').addEventListener('input', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj) {
        obj.set('fill', e.target.value);
        document.getElementById('text-color-hex').value = e.target.value;
        document.getElementById('obj-fill').value = e.target.value;
        document.getElementById('obj-fill-hex').value = e.target.value;
        canvasManager.canvas.renderAll();
    }
});

// Text line height
document.getElementById('text-line-height').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj) { obj.set('lineHeight', parseFloat(e.target.value)); canvasManager.canvas.renderAll(); }
});

// Bold / Italic / Underline
document.getElementById('text-bold').addEventListener('click', () => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
    document.getElementById('text-bold').classList.toggle('active');
    canvasManager.canvas.renderAll();
    canvasManager.canvas.fire('object:modified', { target: obj });
});

document.getElementById('text-italic').addEventListener('click', () => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
    document.getElementById('text-italic').classList.toggle('active');
    canvasManager.canvas.renderAll();
    canvasManager.canvas.fire('object:modified', { target: obj });
});

document.getElementById('text-underline').addEventListener('click', () => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    obj.set('underline', !obj.underline);
    document.getElementById('text-underline').classList.toggle('active');
    canvasManager.canvas.renderAll();
    canvasManager.canvas.fire('object:modified', { target: obj });
});

// Alignment
['left', 'center', 'right'].forEach((align) => {
    document.getElementById('text-align-' + align).addEventListener('click', () => {
        const obj = canvasManager.canvas.getActiveObject();
        if (!obj) return;
        obj.set('textAlign', align);
        ['left', 'center', 'right'].forEach((a) => {
            document.getElementById('text-align-' + a).classList.toggle('active', a === align);
        });
        canvasManager.canvas.renderAll();
        canvasManager.canvas.fire('object:modified', { target: obj });
    });
});

// Shape stroke
document.getElementById('shape-stroke').addEventListener('input', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj) {
        obj.set('stroke', e.target.value);
        document.getElementById('shape-stroke-hex').value = e.target.value;
        canvasManager.canvas.renderAll();
    }
});

document.getElementById('shape-stroke-width').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj) { obj.set('strokeWidth', parseInt(e.target.value)); canvasManager.canvas.renderAll(); }
});

document.getElementById('shape-radius').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj.type === 'rect') {
        const v = parseInt(e.target.value);
        obj.set({ rx: v, ry: v });
        canvasManager.canvas.renderAll();
    }
});

// Blob properties
linkColorInputs('blob-bg-color', 'blob-bg-color-hex');

function blobConfigChange(field, parser) {
    return (e) => {
        const obj = canvasManager.canvas.getActiveObject();
        if (!obj || !obj._blobConfig) return;
        obj._blobConfig[field] = parser ? parser(e.target.value) : e.target.value;
        canvasManager.updateBlob(obj);
    };
}

document.getElementById('blob-area-w').addEventListener('change', blobConfigChange('areaWidth', parseInt));
document.getElementById('blob-area-h').addEventListener('change', blobConfigChange('areaHeight', parseInt));

document.getElementById('blob-bg-color').addEventListener('input', (e) => {
    document.getElementById('blob-bg-color-hex').value = e.target.value;
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj._blobConfig) {
        obj._blobConfig.bgColor = e.target.value;
        canvasManager.updateBlob(obj);
    }
});

document.getElementById('blob-bg-transparent').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj._blobConfig) {
        obj._blobConfig.bgTransparent = e.target.checked;
        canvasManager.updateBlob(obj);
    }
});

document.getElementById('blob-count').addEventListener('change', blobConfigChange('blobCount', parseInt));

document.getElementById('blob-smoothness').addEventListener('input', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj._blobConfig) {
        obj._blobConfig.smoothness = parseFloat(e.target.value);
        canvasManager.updateBlob(obj);
    }
});

document.getElementById('blob-corners-min').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj || !obj._blobConfig) return;
    const val = parseInt(e.target.value);
    obj._blobConfig.cornersMin = val;
    // Ensure max >= min
    if (val > obj._blobConfig.cornersMax) {
        obj._blobConfig.cornersMax = val;
        document.getElementById('blob-corners-max').value = val;
    }
    // Corner count changed → need new shapes
    obj._blobConfig.blobData = null;
    canvasManager.updateBlob(obj);
});

document.getElementById('blob-corners-max').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj || !obj._blobConfig) return;
    const val = parseInt(e.target.value);
    obj._blobConfig.cornersMax = val;
    // Ensure min <= max
    if (val < obj._blobConfig.cornersMin) {
        obj._blobConfig.cornersMin = val;
        document.getElementById('blob-corners-min').value = val;
    }
    // Corner count changed → need new shapes
    obj._blobConfig.blobData = null;
    canvasManager.updateBlob(obj);
});

document.getElementById('blob-allow-overlap').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj._blobConfig) {
        obj._blobConfig.allowOverlap = e.target.checked;
        canvasManager.updateBlob(obj);
    }
});

document.getElementById('blob-size-mode').addEventListener('change', (e) => {
    document.getElementById('blob-large-scale-row').style.display = e.target.value === 'mixed' ? '' : 'none';
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj._blobConfig) {
        obj._blobConfig.sizeMode = e.target.value;
        canvasManager.updateBlob(obj);
    }
});

document.getElementById('blob-large-scale').addEventListener('change', blobConfigChange('largeBlobScale', parseFloat));

document.getElementById('blob-opacity').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('blob-opacity-val').textContent = Math.round(val * 100) + '%';
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj._blobConfig) {
        obj._blobConfig.blobOpacity = val;
        canvasManager.updateBlob(obj);
    }
});

document.getElementById('blob-add-color').addEventListener('click', () => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj._blobConfig) {
        const palette = ['#6c63ff', '#e74c3c', '#2ecc71', '#f1c40f', '#3498db', '#9b59b6', '#1abc9c', '#e67e22'];
        const next = palette[obj._blobConfig.blobColors.length % palette.length];
        obj._blobConfig.blobColors.push(next);
        canvasManager.updateBlob(obj);
    }
});

document.getElementById('blob-regenerate').addEventListener('click', () => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj._blobConfig) {
        canvasManager.regenerateBlob(obj);
    }
});

document.getElementById('blob-ungroup').addEventListener('click', () => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj && obj._blobConfig) {
        canvasManager.ungroupBlob(obj);
    }
});

// Position / Size / Angle
document.getElementById('obj-left').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj) { obj.set('left', parseInt(e.target.value)); canvasManager.canvas.renderAll(); }
});

document.getElementById('obj-top').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj) { obj.set('top', parseInt(e.target.value)); canvasManager.canvas.renderAll(); }
});

document.getElementById('obj-width').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    const w = parseInt(e.target.value);
    obj.set('scaleX', w / (obj.width || 1));
    canvasManager.canvas.renderAll();
});

document.getElementById('obj-height').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    const h = parseInt(e.target.value);
    obj.set('scaleY', h / (obj.height || 1));
    canvasManager.canvas.renderAll();
});

document.getElementById('obj-angle').addEventListener('change', (e) => {
    const obj = canvasManager.canvas.getActiveObject();
    if (obj) { obj.set('angle', parseInt(e.target.value)); canvasManager.canvas.renderAll(); }
});

/* ================================================================
   AUSRICHTEN (an Slide oder an Auswahl-Bounding-Box)
   ================================================================ */

function alignObjects(mode) {
    const canvas = canvasManager.canvas;
    const active = canvas.getActiveObject();
    if (!active) return;

    const multi = active.type === 'activeSelection';
    let objs;

    if (multi) {
        // Work on absolute canvas coordinates — discard the group, align each,
        // then re-select. Child coords inside activeSelection are relative,
        // which makes absolute-pixel alignment awkward.
        objs = active._objects.slice();
        canvas.discardActiveObject();
    } else {
        objs = [active];
    }

    // Reference bbox: canvas (single selection) or combined bbox (multi)
    const fmt = canvasManager.formats[canvasManager.currentFormat];
    let refL, refT, refR, refB;

    if (multi) {
        refL = Infinity; refT = Infinity; refR = -Infinity; refB = -Infinity;
        objs.forEach((o) => {
            const br = o.getBoundingRect(true, true);
            refL = Math.min(refL, br.left);
            refT = Math.min(refT, br.top);
            refR = Math.max(refR, br.left + br.width);
            refB = Math.max(refB, br.top + br.height);
        });
    } else {
        refL = 0; refT = 0; refR = fmt.width; refB = fmt.height;
    }
    const refCX = (refL + refR) / 2;
    const refCY = (refT + refB) / 2;

    objs.forEach((o) => {
        const br = o.getBoundingRect(true, true);
        let dx = 0, dy = 0;
        switch (mode) {
            case 'left':    dx = refL - br.left; break;
            case 'right':   dx = refR - (br.left + br.width); break;
            case 'hcenter': dx = refCX - (br.left + br.width / 2); break;
            case 'top':     dy = refT - br.top; break;
            case 'bottom':  dy = refB - (br.top + br.height); break;
            case 'vcenter': dy = refCY - (br.top + br.height / 2); break;
        }
        o.set({ left: o.left + dx, top: o.top + dy });
        o.setCoords();
    });

    if (multi) {
        const sel = new fabric.ActiveSelection(objs, { canvas });
        canvas.setActiveObject(sel);
    }

    canvas.fire('object:modified', { target: canvas.getActiveObject() });
    canvas.requestRenderAll();
}

['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'].forEach((mode) => {
    document.getElementById('align-' + mode).addEventListener('click', () => alignObjects(mode));
});

// Update hint based on selection count
function updateAlignHint() {
    const active = canvasManager.canvas.getActiveObject();
    const hint = document.getElementById('align-hint');
    if (!active || !hint) return;
    hint.textContent = active.type === 'activeSelection'
        ? 'An Auswahl ausrichten'
        : 'An Slide ausrichten';
}
canvasManager.canvas.on('selection:created', updateAlignHint);
canvasManager.canvas.on('selection:updated', updateAlignHint);

/* ================================================================
   EBENEN (Layer-Liste mit Drag & Drop)
   ================================================================ */

const layerListEl = document.getElementById('layer-list');

function layerIconFor(obj) {
    if (obj._blobConfig) return '\u25CF';
    switch (obj.type) {
        case 'i-text':
        case 'text':
        case 'textbox':   return 'T';
        case 'rect':      return '\u25AD';
        case 'circle':    return '\u25CF';
        case 'triangle':  return '\u25B2';
        case 'line':      return '\u2500';
        case 'path':      return '\u25CF';
        case 'image':     return 'IMG';
        default:          return '?';
    }
}

function layerNameFor(obj) {
    if (obj._blobConfig) return 'Blobs (' + obj._blobConfig.blobCount + ')';
    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
        const t = (obj.text || '').replace(/\s+/g, ' ').trim();
        return t ? (t.length > 24 ? t.slice(0, 24) + '\u2026' : t) : 'Text';
    }
    if (obj.type === 'rect')     return 'Rechteck';
    if (obj.type === 'circle')   return 'Kreis';
    if (obj.type === 'triangle') return 'Dreieck';
    if (obj.type === 'line')     return 'Linie';
    if (obj.type === 'path')     return 'Blob';
    if (obj.type === 'image')    return 'Bild';
    return obj.type || 'Objekt';
}

function renderLayerList() {
    if (!layerListEl) return;
    const objs  = canvasManager.canvas.getObjects();
    const active = canvasManager.canvas.getActiveObject();
    layerListEl.innerHTML = '';

    if (!objs.length) {
        const empty = document.createElement('div');
        empty.className = 'layer-empty';
        empty.textContent = 'Keine Objekte';
        layerListEl.appendChild(empty);
        return;
    }

    // Display top-of-stack first (reverse of canvas order), skip editor handles
    for (let i = objs.length - 1; i >= 0; i--) {
        if (objs[i]._peHandle) continue;
        const obj = objs[i];
        const el = document.createElement('div');
        el.className = 'layer-item';
        el.draggable = true;
        el.dataset.canvasIdx = i;

        if (active === obj || (active && active.type === 'activeSelection' && active._objects && active._objects.includes(obj))) {
            el.classList.add('active');
        }

        const icon = document.createElement('span');
        icon.className = 'layer-icon';
        icon.textContent = layerIconFor(obj);

        const name = document.createElement('span');
        name.className = 'layer-name';
        name.textContent = layerNameFor(obj);

        el.appendChild(icon);
        el.appendChild(name);

        el.addEventListener('click', () => {
            canvasManager.canvas.setActiveObject(obj);
            canvasManager.canvas.requestRenderAll();
        });

        // Drag & drop
        el.addEventListener('dragstart', (ev) => {
            el.classList.add('dragging');
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('text/plain', String(i));
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            layerListEl.querySelectorAll('.drop-above, .drop-below').forEach((n) => {
                n.classList.remove('drop-above', 'drop-below');
            });
        });
        el.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = 'move';
            const rect = el.getBoundingClientRect();
            const above = ev.clientY < rect.top + rect.height / 2;
            el.classList.toggle('drop-above', above);
            el.classList.toggle('drop-below', !above);
        });
        el.addEventListener('dragleave', () => {
            el.classList.remove('drop-above', 'drop-below');
        });
        el.addEventListener('drop', (ev) => {
            ev.preventDefault();
            const srcIdx = parseInt(ev.dataTransfer.getData('text/plain'));
            const tgtIdx = i;
            if (!isFinite(srcIdx) || srcIdx === tgtIdx) return;

            const rect = el.getBoundingClientRect();
            const above = ev.clientY < rect.top + rect.height / 2;
            // Display is reversed: "above" in list means HIGHER canvas index
            let newCanvasIdx = above ? tgtIdx + 1 : tgtIdx;
            // If moving a lower object up past its old position, account for removal
            if (srcIdx < newCanvasIdx) newCanvasIdx--;
            // Clamp
            const max = canvasManager.canvas.getObjects().length - 1;
            newCanvasIdx = Math.max(0, Math.min(max, newCanvasIdx));

            const srcObj = canvasManager.canvas.getObjects()[srcIdx];
            if (srcObj) {
                canvasManager.canvas.moveTo(srcObj, newCanvasIdx);
                canvasManager.canvas.setActiveObject(srcObj);
                canvasManager.canvas.requestRenderAll();
                renderLayerList();
                slideManager.updateCurrentThumbnail();
            }
        });

        layerListEl.appendChild(el);
    }
}

// Keep list in sync with canvas state
canvasManager.canvas.on('object:added',      renderLayerList);
canvasManager.canvas.on('object:removed',    renderLayerList);
canvasManager.canvas.on('object:modified',   renderLayerList);
canvasManager.canvas.on('selection:created', renderLayerList);
canvasManager.canvas.on('selection:updated', renderLayerList);
canvasManager.canvas.on('selection:cleared', renderLayerList);
canvasManager.canvas.on('stacking:changed', () => {
    renderLayerList();
    slideManager.updateCurrentThumbnail();
});

renderLayerList();

/* ================================================================
   GRID (Anzeige + Snap)
   ================================================================ */

const grid = {
    size: 10,
    show: false,
    snap: false,
};

const gridOverlayEl = document.getElementById('grid-overlay');
const gridSizeEl    = document.getElementById('grid-size');
const gridShowEl    = document.getElementById('grid-show');
const gridSnapEl    = document.getElementById('grid-snap');

function updateGridOverlay() {
    gridOverlayEl.classList.toggle('show', grid.show);
    const zoom = canvasManager.canvas.getZoom() || 1;
    const px = Math.max(1, grid.size * zoom);
    gridOverlayEl.style.backgroundSize = `${px}px ${px}px`;
}

// Re-draw when canvas display size changes (format change, window resize)
new ResizeObserver(updateGridOverlay).observe(document.getElementById('canvas-wrapper'));

gridSizeEl.addEventListener('change', () => {
    const v = parseInt(gridSizeEl.value);
    grid.size = isFinite(v) && v > 0 ? v : 10;
    updateGridOverlay();
});

gridShowEl.addEventListener('change', () => {
    grid.show = gridShowEl.checked;
    updateGridOverlay();
});

gridSnapEl.addEventListener('change', () => {
    grid.snap = gridSnapEl.checked;
});

function snapToGrid(v) {
    return Math.round(v / grid.size) * grid.size;
}

canvasManager.canvas.on('object:moving', (e) => {
    if (!grid.snap) return;
    const obj = e.target;
    obj.set({
        left: snapToGrid(obj.left),
        top:  snapToGrid(obj.top),
    });
});

canvasManager.canvas.on('object:scaling', (e) => {
    if (!grid.snap) return;
    const obj = e.target;
    const baseW = obj.width || 1;
    const baseH = obj.height || 1;
    const w = baseW * obj.scaleX;
    const h = baseH * obj.scaleY;
    const sw = Math.max(grid.size, snapToGrid(w));
    const sh = Math.max(grid.size, snapToGrid(h));
    obj.scaleX = sw / baseW;
    obj.scaleY = sh / baseH;
});

updateGridOverlay();

/* ================================================================
   HILFSLINIEN (Guides)
   ================================================================ */

const guides = [];          // { id, axis: 'h'|'v', pos: number (canvas px) }
let guidesVisible = true;
let _guideIdCounter = 0;

const guidesOverlayEl = document.getElementById('guides-overlay');
const guidesListEl    = document.getElementById('guides-list');

function addGuide(axis, pos) {
    const id = ++_guideIdCounter;
    const fmt = canvasManager.formats[canvasManager.currentFormat];
    if (pos == null) pos = axis === 'h' ? Math.round(fmt.height / 2) : Math.round(fmt.width / 2);
    guides.push({ id, axis, pos });
    renderGuides();
    renderGuideList();
    return id;
}

function removeGuide(id) {
    const idx = guides.findIndex(g => g.id === id);
    if (idx >= 0) guides.splice(idx, 1);
    renderGuides();
    renderGuideList();
}

function updateGuidePos(id, pos) {
    const g = guides.find(g => g.id === id);
    if (g) { g.pos = pos; renderGuides(); renderGuideList(); }
}

function renderGuides() {
    guidesOverlayEl.innerHTML = '';
    if (!guidesVisible) return;
    const zoom = canvasManager.canvas.getZoom() || 1;

    guides.forEach(g => {
        const el = document.createElement('div');
        el.className = 'guide-line guide-line-' + g.axis;

        if (g.axis === 'h') {
            el.style.top = (g.pos * zoom) + 'px';
        } else {
            el.style.left = (g.pos * zoom) + 'px';
        }

        // Drag to reposition
        let dragging = false, startMouse = 0, startPos = 0;
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            dragging = true;
            startMouse = g.axis === 'h' ? e.clientY : e.clientX;
            startPos = g.pos;

            const onMove = (ev) => {
                if (!dragging) return;
                const delta = (g.axis === 'h' ? ev.clientY : ev.clientX) - startMouse;
                g.pos = Math.max(0, startPos + delta / zoom);
                if (g.axis === 'h') {
                    el.style.top = (g.pos * zoom) + 'px';
                } else {
                    el.style.left = (g.pos * zoom) + 'px';
                }
            };
            const onUp = () => {
                dragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                renderGuideList();
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        guidesOverlayEl.appendChild(el);
    });
}

function renderGuideList() {
    guidesListEl.innerHTML = '';
    guides.forEach(g => {
        const entry = document.createElement('div');
        entry.className = 'guide-entry';

        const type = document.createElement('span');
        type.className = 'guide-type';
        type.textContent = g.axis === 'h' ? '—' : '|';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'num-input';
        input.value = Math.round(g.pos);
        input.min = 0;
        input.addEventListener('change', () => {
            updateGuidePos(g.id, parseInt(input.value) || 0);
        });

        const unit = document.createElement('span');
        unit.className = 'guide-unit';
        unit.textContent = 'px';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'small-btn small-btn-danger guide-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', () => removeGuide(g.id));

        entry.appendChild(type);
        entry.appendChild(input);
        entry.appendChild(unit);
        entry.appendChild(removeBtn);
        guidesListEl.appendChild(entry);
    });
}

document.getElementById('btn-guide-h').addEventListener('click', () => addGuide('h'));
document.getElementById('btn-guide-v').addEventListener('click', () => addGuide('v'));

document.getElementById('guides-show').addEventListener('change', (e) => {
    guidesVisible = e.target.checked;
    renderGuides();
});

// Re-render guides when canvas zoom/size changes
new ResizeObserver(renderGuides).observe(document.getElementById('canvas-wrapper'));

/* ================================================================
   CLIPBOARD (Copy / Paste)
   ================================================================ */

let _clipboard = null;

function copySelection() {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    obj.clone((cloned) => { _clipboard = cloned; }, ['selectable', 'evented']);
}

function pasteClipboard() {
    if (!_clipboard) return;
    _clipboard.clone((cloned) => {
        canvasManager.canvas.discardActiveObject();
        cloned.set({
            left: (cloned.left || 0) + 20,
            top: (cloned.top || 0) + 20,
            evented: true,
        });

        if (cloned.type === 'activeSelection') {
            cloned.canvas = canvasManager.canvas;
            cloned.forEachObject((o) => canvasManager.canvas.add(o));
            cloned.setCoords();
        } else {
            canvasManager.canvas.add(cloned);
        }

        // Shift the stored clipboard too, so repeated pastes cascade
        _clipboard.left = (_clipboard.left || 0) + 20;
        _clipboard.top = (_clipboard.top || 0) + 20;

        canvasManager.canvas.setActiveObject(cloned);
        canvasManager.canvas.requestRenderAll();
    }, ['selectable', 'evented']);
}

/* ================================================================
   KEYBOARD SHORTCUTS
   ================================================================ */

document.addEventListener('keydown', (e) => {
    const active = canvasManager.canvas.getActiveObject();

    // Don't intercept keys while editing text
    if (active && active.isEditing) return;

    // Delete / Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
        canvasManager.deleteSelected();
        e.preventDefault();
    }

    // Ctrl+C → copy selection
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (active) {
            copySelection();
            e.preventDefault();
        }
    }

    // Ctrl+V → paste
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (_clipboard) {
            pasteClipboard();
            e.preventDefault();
        }
    }

    // Ctrl+Z → undo; Ctrl+Shift+Z or Ctrl+Y → redo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        history.undo();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        history.redo();
        return;
    }

    // Ctrl+S → save project
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        exportManager.saveProject();
        showToast('Projekt gespeichert!', 'success');
    }

    // Ctrl+E → export current slide
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportManager.exportCurrentSlide();
        showToast('Slide exportiert!', 'success');
    }

    // T → add text
    if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
        const family = document.getElementById('text-font').value || 'Inter';
        loadGoogleFont(family).then(() => {
            canvasManager.addText({ fontFamily: family });
            canvasManager.canvas.renderAll();
        });
    }
});

/* ================================================================
   AUTO-UPDATE THUMBNAILS
   ================================================================ */

let _thumbTimer = null;
function scheduleThumbnailUpdate() {
    clearTimeout(_thumbTimer);
    _thumbTimer = setTimeout(() => slideManager.updateCurrentThumbnail(), 600);
}

canvasManager.canvas.on('object:modified', scheduleThumbnailUpdate);
canvasManager.canvas.on('object:added',    scheduleThumbnailUpdate);
canvasManager.canvas.on('object:removed',  scheduleThumbnailUpdate);

// Auto-load any Google Font needed by a newly added text (covers slide switches and project loads)
canvasManager.canvas.on('object:added', (e) => {
    const t = e && e.target;
    if (t && t.fontFamily) {
        loadGoogleFont(t.fontFamily).then(() => {
            if (fabric && fabric.util && typeof fabric.util.clearFabricFontCache === 'function') {
                fabric.util.clearFabricFontCache(t.fontFamily);
            }
            if (typeof t.initDimensions === 'function') t.initDimensions();
            t.setCoords();
            canvasManager.canvas.requestRenderAll();
        });
    }
});

/* ================================================================
   INIT
   ================================================================ */

// Initial thumbnail
setTimeout(() => slideManager.updateCurrentThumbnail(), 200);

// Seed history with the initial (empty) canvas state so undo/redo buttons start disabled correctly
history.reset();
