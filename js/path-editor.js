/* ================================================================
   Path Editor – Drag anchor points and bezier curve handles
   ================================================================ */

class PathEditor {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this.canvas = canvasManager.canvas;
        this.activePath = null;
        this.anchors = [];
        this.controls = [];
        this.handles = [];
        this.ctrlLines = [];
        this.closedLink = -1;

        this._boundMouseDown = (opt) => {
            if (opt.target && opt.target._peHandle) return;
            this.close();
        };
        this._boundKeyDown = (e) => {
            if (e.key === 'Escape') this.close();
        };
    }

    isActive() { return !!this.activePath; }

    /* ---- Enter / Exit ---- */

    edit(pathObj) {
        if (!pathObj || pathObj.type !== 'path') return;
        if (this.activePath === pathObj) return;
        this.close();

        this.activePath = pathObj;
        this.activePath.set({ selectable: false, evented: false });

        this._parsePath();
        this._createHandles();

        this.canvas.discardActiveObject();
        this.canvas.on('mouse:down', this._boundMouseDown);
        document.addEventListener('keydown', this._boundKeyDown);
        this.canvas.renderAll();
    }

    close() {
        if (!this.activePath) return;
        this.activePath.set({ selectable: true, evented: true });
        this.activePath.setCoords();
        this._clearHandles();
        this.canvas.off('mouse:down', this._boundMouseDown);
        document.removeEventListener('keydown', this._boundKeyDown);
        this.activePath = null;
        this.anchors = [];
        this.controls = [];
        this.closedLink = -1;
        this.canvas.renderAll();
    }

    /* ---- Parse SVG path commands ---- */

    _parsePath() {
        this.anchors = [];
        this.controls = [];
        this.closedLink = -1;
        const cmds = this.activePath.path;
        if (!cmds) return;

        for (let i = 0; i < cmds.length; i++) {
            const cmd = cmds[i];
            if (cmd[0] === 'M') {
                this.anchors.push({ ci: i, ao: 1 }); // ci=cmdIndex, ao=argOffset
            } else if (cmd[0] === 'L') {
                this.anchors.push({ ci: i, ao: 1 });
            } else if (cmd[0] === 'C') {
                this.controls.push({ ci: i, ao: 1, ai: this.anchors.length - 1 });
                this.controls.push({ ci: i, ao: 3, ai: this.anchors.length });
                this.anchors.push({ ci: i, ao: 5 });
            }
        }

        // Detect closed loop: last anchor same as first
        if (this.anchors.length >= 2) {
            const f = this._pt(this.anchors[0]);
            const l = this._pt(this.anchors[this.anchors.length - 1]);
            if (Math.abs(f.x - l.x) < 0.5 && Math.abs(f.y - l.y) < 0.5) {
                this.closedLink = this.anchors.length - 1;
            }
        }
    }

    /* ---- Coordinate helpers ---- */

    _pt(a) {
        const c = this.activePath.path[a.ci];
        return { x: c[a.ao], y: c[a.ao + 1] };
    }
    _setPt(a, x, y) {
        const c = this.activePath.path[a.ci];
        c[a.ao] = x;
        c[a.ao + 1] = y;
    }
    _toCanvas(px, py) {
        const p = this.activePath;
        return fabric.util.transformPoint(
            { x: px - p.pathOffset.x, y: py - p.pathOffset.y },
            p.calcTransformMatrix()
        );
    }
    _toPath(cx, cy) {
        const p = this.activePath;
        const inv = fabric.util.invertTransform(p.calcTransformMatrix());
        const l = fabric.util.transformPoint({ x: cx, y: cy }, inv);
        return { x: l.x + p.pathOffset.x, y: l.y + p.pathOffset.y };
    }

    /* ---- Build visual handles ---- */

    _createHandles() {
        this._clearHandles();
        const zoom = this.canvas.getZoom() || 1;

        // Lines (below handles)
        this.controls.forEach((c) => {
            const cp = this._pt(c);
            const ap = this._pt(this.anchors[c.ai]);
            const cc = this._toCanvas(cp.x, cp.y);
            const ac = this._toCanvas(ap.x, ap.y);
            const line = new fabric.Line([ac.x, ac.y, cc.x, cc.y], {
                stroke: '#888', strokeWidth: 1 / zoom,
                strokeDashArray: [3 / zoom, 3 / zoom],
                selectable: false, evented: false,
                excludeFromExport: true, _peHandle: true,
            });
            this.ctrlLines.push(line);
            this.canvas.add(line);
        });

        // Anchor handles (skip last if it's the closed-loop duplicate)
        const anchorEnd = this.closedLink >= 0 ? this.anchors.length - 1 : this.anchors.length;
        for (let i = 0; i < anchorEnd; i++) {
            const pt = this._pt(this.anchors[i]);
            const pos = this._toCanvas(pt.x, pt.y);
            const h = this._circle(pos.x, pos.y, 6 / zoom, '#4a90d9', '#fff', 2 / zoom);
            h._peIdx = i;
            h._peKind = 'a';
            h.on('moving', () => this._dragAnchor(h, i));
            h.on('modified', () => this._dragEnd());
            this.handles.push(h);
            this.canvas.add(h);
        }

        // Control-point handles
        this.controls.forEach((c, ci) => {
            const pt = this._pt(c);
            const pos = this._toCanvas(pt.x, pt.y);
            const h = this._circle(pos.x, pos.y, 4 / zoom, '#fff', '#4a90d9', 1.5 / zoom);
            h._peIdx = ci;
            h._peKind = 'c';
            h.on('moving', () => this._dragControl(h, ci));
            h.on('modified', () => this._dragEnd());
            this.handles.push(h);
            this.canvas.add(h);
        });
    }

    _circle(x, y, r, fill, stroke, sw) {
        return new fabric.Circle({
            left: x, top: y, radius: r,
            fill: fill, stroke: stroke, strokeWidth: sw,
            originX: 'center', originY: 'center',
            hasControls: false, hasBorders: false,
            selectable: true, evented: true,
            excludeFromExport: true, _peHandle: true,
        });
    }

    /* ---- Drag callbacks ---- */

    _dragAnchor(handle, idx) {
        const a = this.anchors[idx];
        const newP = this._toPath(handle.left, handle.top);
        const oldP = this._pt(a);
        const dx = newP.x - oldP.x;
        const dy = newP.y - oldP.y;

        // Move anchor point
        this._setPt(a, newP.x, newP.y);

        // Also move linked closed-loop anchor
        if (this.closedLink >= 0 && idx === 0) {
            this._setPt(this.anchors[this.closedLink], newP.x, newP.y);
        }

        // Determine which anchor indices should have their controls moved
        const moveSet = new Set([idx]);
        if (this.closedLink >= 0 && idx === 0) moveSet.add(this.closedLink);

        // Move adjacent control points & update their visuals
        this.controls.forEach((c, ci) => {
            if (!moveSet.has(c.ai)) return;
            const cp = this._pt(c);
            this._setPt(c, cp.x + dx, cp.y + dy);
            // Update control handle position
            const ch = this.handles.find(h => h._peKind === 'c' && h._peIdx === ci);
            if (ch) {
                const np = this._toCanvas(cp.x + dx, cp.y + dy);
                ch.set({ left: np.x, top: np.y }); ch.setCoords();
            }
            // Update connecting line
            this._updateLine(ci);
        });

        this.activePath.dirty = true;
        this.canvas.requestRenderAll();
    }

    _dragControl(handle, ci) {
        const c = this.controls[ci];
        const newP = this._toPath(handle.left, handle.top);
        this._setPt(c, newP.x, newP.y);
        this._updateLine(ci);
        this.activePath.dirty = true;
        this.canvas.requestRenderAll();
    }

    _dragEnd() {
        if (!this.activePath) return;
        // Defer heavy recalculation so it doesn't interfere with Fabric.js mouse-up
        setTimeout(() => {
            if (!this.activePath) return;
            this.activePath._setPositionDimensions({});
            this.activePath.setCoords();
            this._refreshAllPositions();
            this.canvas.fire('object:modified', { target: this.activePath });
        }, 0);
    }

    /* ---- Visual updates ---- */

    _updateLine(ci) {
        const c = this.controls[ci];
        const line = this.ctrlLines[ci];
        if (!line) return;
        const cp = this._toCanvas(this._pt(c).x, this._pt(c).y);
        const ap = this._toCanvas(this._pt(this.anchors[c.ai]).x, this._pt(this.anchors[c.ai]).y);
        line.set({ x1: ap.x, y1: ap.y, x2: cp.x, y2: cp.y }); line.setCoords();
    }

    _refreshAllPositions() {
        // Anchor handles
        const anchorEnd = this.closedLink >= 0 ? this.anchors.length - 1 : this.anchors.length;
        for (let i = 0; i < anchorEnd; i++) {
            const h = this.handles.find(h => h._peKind === 'a' && h._peIdx === i);
            if (!h) continue;
            const pt = this._pt(this.anchors[i]);
            const pos = this._toCanvas(pt.x, pt.y);
            h.set({ left: pos.x, top: pos.y }); h.setCoords();
        }
        // Control handles + lines
        this.controls.forEach((c, ci) => {
            const h = this.handles.find(h => h._peKind === 'c' && h._peIdx === ci);
            if (h) {
                const pt = this._pt(c);
                const pos = this._toCanvas(pt.x, pt.y);
                h.set({ left: pos.x, top: pos.y }); h.setCoords();
            }
            this._updateLine(ci);
        });
        this.canvas.renderAll();
    }

    _clearHandles() {
        this.handles.forEach(h => this.canvas.remove(h));
        this.ctrlLines.forEach(l => this.canvas.remove(l));
        this.handles = [];
        this.ctrlLines = [];
    }
}
