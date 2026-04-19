/* ================================================================
   Social Tool – Main Application
   ================================================================ */

const canvasManager = new CanvasManager('main-canvas');
const slideManager  = new SlideManager(canvasManager);
const exportManager = new ExportManager(canvasManager, slideManager);

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

document.getElementById('format-select').addEventListener('change', (e) => {
    canvasManager.setFormat(e.target.value);
    if (slideManager.slides[slideManager.currentIndex]) {
        slideManager.slides[slideManager.currentIndex].format = e.target.value;
    }
});

/* ================================================================
   BACKGROUND
   ================================================================ */

document.getElementById('bg-color').addEventListener('input', (e) => {
    canvasManager.setBackgroundColor(e.target.value);
    document.getElementById('bg-color-hex').value = e.target.value;
    document.getElementById('btn-bg-image-remove').style.display = 'none';
});

// Background palette swatches
document.getElementById('bg-palette').addEventListener('click', (e) => {
    const swatch = e.target.closest('.palette-swatch');
    if (!swatch) return;
    const color = swatch.dataset.color;
    canvasManager.setBackgroundColor(color);
    document.getElementById('bg-color').value = color;
    document.getElementById('bg-color-hex').value = color;
    document.getElementById('btn-bg-image-remove').style.display = 'none';
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
    }
});

document.getElementById('btn-bg-image-remove').addEventListener('click', () => {
    canvasManager.removeBackgroundImage();
    document.getElementById('btn-bg-image-remove').style.display = 'none';
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

document.getElementById('tool-delete').addEventListener('click',   () => canvasManager.deleteSelected());
document.getElementById('tool-forward').addEventListener('click',  () => canvasManager.bringForward());
document.getElementById('tool-backward').addEventListener('click', () => canvasManager.sendBackward());

/* ================================================================
   SLIDES
   ================================================================ */

document.getElementById('btn-add-slide').addEventListener('click',       () => slideManager.addSlide());
document.getElementById('btn-duplicate-slide').addEventListener('click', () => slideManager.duplicateSlide());
document.getElementById('btn-delete-slide').addEventListener('click',    () => slideManager.deleteSlide());

/* ================================================================
   SAVE / LOAD / EXPORT
   ================================================================ */

document.getElementById('btn-save').addEventListener('click', () => {
    exportManager.saveProject();
    showToast('Projekt gespeichert!', 'success');
});

document.getElementById('btn-load').addEventListener('click', () => {
    document.getElementById('project-load').click();
});
document.getElementById('project-load').addEventListener('change', async (e) => {
    if (e.target.files[0]) {
        try {
            await exportManager.loadProject(e.target.files[0]);
            await preloadFontsFromCanvas();
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

const objectPropsEl = document.getElementById('object-properties');
const textPropsEl   = document.getElementById('text-properties');
const shapePropsEl  = document.getElementById('shape-properties');
const radiusRow     = document.getElementById('radius-row');

function updatePropertiesPanel(obj) {
    if (!obj || obj.type === 'activeSelection') {
        objectPropsEl.style.display = 'none';
        return;
    }

    objectPropsEl.style.display = '';

    // Fill
    if (obj.fill && typeof obj.fill === 'string') {
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
    const isShape = ['rect', 'circle', 'triangle', 'line'].includes(obj.type);
    shapePropsEl.style.display = isShape ? '' : 'none';
    radiusRow.style.display = obj.type === 'rect' ? '' : 'none';

    if (isShape) {
        document.getElementById('shape-stroke').value = obj.stroke || '#000000';
        document.getElementById('shape-stroke-hex').value = obj.stroke || '#000000';
        document.getElementById('shape-stroke-width').value = obj.strokeWidth || 0;
        if (obj.type === 'rect') {
            document.getElementById('shape-radius').value = obj.rx || 0;
        }
    }
}

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
});

document.getElementById('text-italic').addEventListener('click', () => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
    document.getElementById('text-italic').classList.toggle('active');
    canvasManager.canvas.renderAll();
});

document.getElementById('text-underline').addEventListener('click', () => {
    const obj = canvasManager.canvas.getActiveObject();
    if (!obj) return;
    obj.set('underline', !obj.underline);
    document.getElementById('text-underline').classList.toggle('active');
    canvasManager.canvas.renderAll();
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
