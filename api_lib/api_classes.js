// Reusable base classes for the mini games (rough.js drawn canvas items).
// Extend these in the mini game files instead of re-implementing canvas setup,
// hover handling, drag-to-launch physics, block collisions, etc.

// Per-canvas bookkeeping: item groups, current drag target and animation flag.
const canvasStates = new WeakMap();

function getCanvasState(canvas) {
    let state = canvasStates.get(canvas);
    if (!state) {
        state = { groups: new Map(), dragging: null, animating: false };
        canvasStates.set(canvas, state);
    }
    return state;
}

/**
 * Base for everything drawn on a canvas with rough.js.
 * Handles canvas lookup/validation, a per-canvas item registry, layered
 * redrawing and mouse hover. Subclasses implement `paint()` and `containsPoint()`.
 *
 * Override points:
 *   paint()          draw this item
 *   paintOverlay()   draw on top of all items (optional)
 *   containsPoint()  hit test in canvas coordinates
 *   isActive()       false = ignored by hover/click (default true)
 *   bindEvents()     add extra canvas listeners (called once per canvas+group)
 */
class CanvasItem {
    static layer = 0;          // lower layers are painted first
    hoverCursor = 'pointer';

    constructor(canvasId, group = this.constructor.name) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas "${canvasId}" was not found.`);
        }
        this.context = this.canvas.getContext('2d');
        if (!this.context) {
            throw new Error(`Canvas "${canvasId}" does not support 2D drawing.`);
        }
        this.roughCanvas = rough.canvas(this.canvas);
        this.hovered = false;
        this.group = group;

        const state = getCanvasState(this.canvas);
        let isNewGroup = false;
        if (!state.groups.has(group)) {
            state.groups.set(group, []);
            isNewGroup = true;
        }
        state.groups.get(group).push(this);
        if (isNewGroup) this.bindEvents();
    }

    // ---- registry ----
    siblings() {
        return getCanvasState(this.canvas).groups.get(this.group);
    }

    allItems() {
        const items = [];
        for (const list of getCanvasState(this.canvas).groups.values()) items.push(...list);
        return items;
    }

    unregister() {
        const list = this.siblings();
        const index = list.indexOf(this);
        if (index !== -1) list.splice(index, 1);
    }

    // ---- drawing ----
    paint() {}
    paintOverlay() {}

    redraw() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const items = this.allItems().sort((a, b) => a.constructor.layer - b.constructor.layer);
        for (const item of items) item.paint();
        for (const item of items) item.paintOverlay();
    }

    draw() {
        this.redraw();
    }

    // ---- hit testing ----
    isActive() {
        return true;
    }

    containsPoint(x, y) {
        return false;
    }

    canvasPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * this.canvas.width / rect.width,
            y: (event.clientY - rect.top) * this.canvas.height / rect.height
        };
    }

    contains(event) {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const { x, y } = this.canvasPoint(event);
        return this.containsPoint(x, y);
    }

    // ---- hover ----
    bindEvents() {
        this.canvas.addEventListener('mousemove', event => this.handleMouseMove(event));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    }

    // Topmost active item of this group under the mouse.
    topItemAt(event) {
        return [...this.siblings()].reverse().find(item => item.isActive() && item.contains(event));
    }

    handleMouseMove(event) {
        const top = this.topItemAt(event);
        let changed = false;
        for (const item of this.siblings()) {
            const hovered = item === top;
            if (item.hovered !== hovered) {
                item.hovered = hovered;
                changed = true;
            }
        }
        this.canvas.style.cursor = top ? this.hoverCursor : 'default';
        if (changed) this.redraw();
    }

    handleMouseLeave() {
        let changed = false;
        for (const item of this.siblings()) {
            if (item.hovered) {
                item.hovered = false;
                changed = true;
            }
        }
        this.canvas.style.cursor = 'default';
        if (changed) this.redraw();
    }
}

/** Rectangular canvas item (position + size validated). */
class RectItem extends CanvasItem {
    constructor(canvasId, x, y, width, height, group) {
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
            throw new RangeError(`${new.target.name} position and dimensions must be finite, with positive width and height.`);
        }
        super(canvasId, group);
        this.bounds = { x, y, width, height };
    }

    containsPoint(px, py) {
        const { x, y, width, height } = this.bounds;
        return px >= x && px <= x + width && py >= y && py <= y + height;
    }
}

/**
 * Clickable rough.js button. Extend and override `drawButton()` for a custom look.
 */
class SketchButton extends RectItem {
    static layer = 2;

    constructor(canvasId, label, hoverFill, onClick, x, y, width = 200, height = 100) {
        if (typeof onClick !== 'function') {
            throw new TypeError('SketchButton onClick must be a function.');
        }
        super(canvasId, x, y, width, height, 'SketchButton');
        this.label = label;
        this.hoverFill = hoverFill;
        this.onClick = onClick;
        this.redraw();
    }

    bindEvents() {
        super.bindEvents();
        this.canvas.addEventListener('click', event => {
            const target = this.topItemAt(event);
            if (target) target.onClick();
        });
    }

    paint() {
        this.drawButton();
    }

    drawButton() {
        const { x, y, width, height } = this.bounds;
        const { context } = this;
        this.roughCanvas.rectangle(x, y, width, height, {
            fill: this.hovered ? this.hoverFill : 'pink',
            fillStyle: this.hovered ? 'cross-hatch' : 'hachure'
        });

        context.font = '16px "Cabin Sketch", cursive, sans-serif';
        context.fillStyle = '#000000';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(this.label, x + width / 2, y + height / 2);
    }
}

/**
 * Static rectangle that LaunchBalls bounce off. Extend for special blocks
 * (override `resolveCollision` / `bounceBaller`).
 */
class Block extends RectItem {
    static layer = 1;

    constructor(canvasId, color, x, y, width = 200, height = 100, style = 'hachure') {
        super(canvasId, x, y, width, height, 'Block');
        this.color = color;
        this.style = style;
        this.seed = Math.floor(Math.random() * 2 ** 31); // keeps the sketchy look stable between redraws
        this.redraw();
    }

    bindEvents() {} // blocks are not interactive

    paint() {
        const { x, y, width, height } = this.bounds;
        this.roughCanvas.rectangle(x, y, width, height, {
            fill: this.color,
            fillStyle: this.style,
            seed: this.seed
        });
    }

    resolveCollision(baller, previousX, previousY) {
        const { x, y, width, height } = this.bounds;
        const radius = baller.diameter / 2;
        const closestX = Math.max(x, Math.min(baller.start_x, x + width));
        const closestY = Math.max(y, Math.min(baller.start_y, y + height));
        let normal = {
            x: baller.start_x - closestX,
            y: baller.start_y - closestY
        };
        const distance = Math.hypot(normal.x, normal.y);

        if (distance >= radius) return;

        if (distance > 0) {
            normal.x /= distance;
            normal.y /= distance;
            this.pushBallerOut(baller, normal, radius - distance);
        } else {
            normal = this.getCollisionNormal(baller, previousX, previousY);
            this.positionBallerOutside(baller, normal, radius);
        }

        this.bounceBaller(baller, normal);
    }

    pushBallerOut(baller, normal, overlap) {
        baller.start_x += normal.x * overlap;
        baller.start_y += normal.y * overlap;
    }

    positionBallerOutside(baller, normal, radius) {
        const { x, y, width, height } = this.bounds;
        if (normal.x < 0) baller.start_x = x - radius;
        if (normal.x > 0) baller.start_x = x + width + radius;
        if (normal.y < 0) baller.start_y = y - radius;
        if (normal.y > 0) baller.start_y = y + height + radius;
    }

    getCollisionNormal(baller, previousX, previousY) {
        const { x, y, width, height } = this.bounds;
        if (previousX <= x) return { x: -1, y: 0 };
        if (previousX >= x + width) return { x: 1, y: 0 };
        if (previousY <= y) return { x: 0, y: -1 };
        if (previousY >= y + height) return { x: 0, y: 1 };

        const distances = [
            { distance: baller.start_x - (x - baller.diameter / 2), normal: { x: -1, y: 0 } },
            { distance: x + width + baller.diameter / 2 - baller.start_x, normal: { x: 1, y: 0 } },
            { distance: baller.start_y - (y - baller.diameter / 2), normal: { x: 0, y: -1 } },
            { distance: y + height + baller.diameter / 2 - baller.start_y, normal: { x: 0, y: 1 } }
        ];
        return distances.reduce((nearest, candidate) =>
            candidate.distance < nearest.distance ? candidate : nearest
        ).normal;
    }

    bounceBaller(baller, normal) {
        const velocityAlongNormal = baller.velocityX * normal.x + baller.velocityY * normal.y;
        if (velocityAlongNormal < 0) {
            const bounceStrength = (1 + baller.physics.restitution) * velocityAlongNormal;
            baller.velocityX -= bounceStrength * normal.x;
            baller.velocityY -= bounceStrength * normal.y;
        }
    }
}

/**
 * Drag-and-release ball with gravity that bounces off Blocks.
 * Override points for mini games:
 *   isInBlockHole(blocks)  return true when the ball got stuck/scored (default false)
 *   onFrame()              runs once per animation frame (default: this.game.update())
 *
 * `physics` needs: gravity, launchSpeedPerPixel, maximumLaunchSpeed,
 * restitution, maximumFrameDelta, collisionStepDistance.
 */
class LaunchBall extends CanvasItem {
    static layer = 0;

    constructor(diameter, color, drawnstyle = 'hachure', start_x = 0, start_y = 0, despawned = false, canvasId = 'FillHoles', physics) {
        if (!Number.isFinite(diameter) || diameter <= 0 ||
            !Number.isFinite(start_x) || !Number.isFinite(start_y)) {
            throw new RangeError('Baller diameter and position must be finite, with a positive diameter.');
        }
        LaunchBall.validatePhysics(physics);

        super(canvasId, 'LaunchBall');
        this.hoverCursor = 'crosshair';
        this.diameter = diameter;
        this.color = color;
        this.drawnstyle = drawnstyle;
        this.start_x = start_x;
        this.start_y = start_y;
        this.despawned = despawned;
        this.isStuck = false;
        this.physics = { ...physics };
        this.changed = false;
        this.hasDragLine = false;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isMoving = false;
        this.game = null; // set by MiniGame.addBall

        this.redraw();
    }

    static validatePhysics(physics) {
        const physicsValues = [
            physics?.gravity,
            physics?.launchSpeedPerPixel,
            physics?.maximumLaunchSpeed,
            physics?.restitution,
            physics?.maximumFrameDelta,
            physics?.collisionStepDistance
        ];
        if (!physicsValues.every(Number.isFinite) ||
            physics.gravity < 0 ||
            physics.launchSpeedPerPixel <= 0 ||
            physics.maximumLaunchSpeed <= 0 ||
            physics.restitution < 0 || physics.restitution > 1 ||
            physics.maximumFrameDelta <= 0 ||
            physics.collisionStepDistance <= 0) {
            throw new RangeError('Baller physics requires finite values, positive speed and step limits, non-negative gravity, and restitution between 0 and 1.');
        }
    }

    // ---- hooks ----
    isInBlockHole(blocks) {
        return false;
    }

    onFrame() {
        if (this.game) this.game.update();
    }

    blocks() {
        return getCanvasState(this.canvas).groups.get('Block') || [];
    }

    // ---- state ----
    isActive() {
        return !this.despawned && !this.isStuck;
    }

    containsPoint(px, py) {
        const radius = this.diameter / 2;
        const dx = px - this.start_x;
        const dy = py - this.start_y;
        return dx * dx + dy * dy <= radius * radius;
    }

    // ---- drawing ----
    paint() {
        if (!this.isActive()) return;
        this.roughCanvas.circle(this.start_x, this.start_y, this.diameter, {
            fill: this.color,
            fillStyle: this.hovered || this.changed ? 'zigzag' : this.drawnstyle
        });
    }

    paintOverlay() {
        if (this.isActive() && this.hasDragLine) {
            this.roughCanvas.line(
                this.start_x, this.start_y, this.lineEndX, this.lineEndY,
                { stroke: this.color, strokeWidth: 2 }
            );
        }
    }

    spawn() {
        this.paint();
    }

    despawn() {
        this.despawned = true;
        this.redraw();
    }

    // ---- physics ----
    update(deltaTime) {
        if (!this.isMoving) return false;

        const frameDelta = Math.min(deltaTime, this.physics.maximumFrameDelta);
        const speed = Math.hypot(this.velocityX, this.velocityY);
        const stepCount = Math.max(1, Math.ceil(
            speed * frameDelta / this.physics.collisionStepDistance
        ));
        const stepDelta = frameDelta / stepCount;
        const blocks = this.blocks();

        for (let step = 0; step < stepCount; step++) {
            const previousX = this.start_x;
            const previousY = this.start_y;
            this.applyGravity(stepDelta);
            this.move(stepDelta);
            this.resolveBlockCollisions(blocks, previousX, previousY);
            if (this.isInBlockHole(blocks)) {
                this.velocityX = 0;
                this.velocityY = 0;
                this.isMoving = false;
                this.isStuck = true;
                this.hovered = false;
                this.changed = false;
                this.hasDragLine = false;
                return false;
            }
        }

        if (this.isOutsideCanvas()) {
            this.despawn();
            this.isMoving = false;
            return false;
        }

        return true;
    }

    applyGravity(deltaTime) {
        this.velocityY += this.physics.gravity * deltaTime;
    }

    move(deltaTime) {
        this.start_x += this.velocityX * deltaTime;
        this.start_y += this.velocityY * deltaTime;
    }

    resolveBlockCollisions(blocks, previousX, previousY) {
        for (const block of blocks) {
            block.resolveCollision(this, previousX, previousY);
        }
    }

    isOutsideCanvas() {
        const radius = this.diameter / 2;
        return this.start_x + radius < 0 ||
            this.start_x - radius > this.canvas.width ||
            this.start_y + radius < 0 ||
            this.start_y - radius > this.canvas.height;
    }

    shoot(targetX, targetY) {
        const directionX = targetX - this.start_x;
        const directionY = targetY - this.start_y;
        const distance = Math.hypot(directionX, directionY);
        if (distance === 0) return;

        const speed = Math.min(
            distance * this.physics.launchSpeedPerPixel,
            this.physics.maximumLaunchSpeed
        );
        this.velocityX = -directionX / distance * speed;
        this.velocityY = -directionY / distance * speed;
        this.isMoving = true;
        this.startAnimation();
    }

    startAnimation() {
        const state = getCanvasState(this.canvas);
        if (state.animating) return;

        state.animating = true;
        let lastTimestamp;
        const animate = timestamp => {
            const deltaTime = lastTimestamp === undefined
                ? 0
                : (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            let hasMovingBaller = false;
            for (const baller of [...this.siblings()]) {
                if (baller.update(deltaTime)) hasMovingBaller = true;
            }
            this.onFrame();
            this.redraw();

            if (hasMovingBaller) {
                requestAnimationFrame(animate);
            } else {
                state.animating = false;
            }
        };
        requestAnimationFrame(animate);
    }

    // ---- drag to launch ----
    bindEvents() {
        super.bindEvents();
        this.canvas.addEventListener('mousedown', event => this.handleMouseDown(event));
        window.addEventListener('mousemove', event => this.handleDragMove(event));
        window.addEventListener('mouseup', event => this.handleMouseUp(event));
    }

    handleDragMove(event) {
        const state = getCanvasState(this.canvas);
        const baller = state.dragging;
        if (!baller || !baller.isActive()) return;

        const point = baller.canvasPoint(event);
        baller.lineEndX = point.x;
        baller.lineEndY = point.y;
        baller.hasDragLine = true;
        this.redraw();
    }

    handleMouseDown(event) {
        if (event.button !== 0) return;

        const baller = [...this.siblings()].reverse().find(candidate =>
            candidate.isActive() && !candidate.isMoving && candidate.contains(event)
        );
        if (!baller) return;

        const point = baller.canvasPoint(event);
        baller.changed = true;
        baller.dragStartX = point.x;
        baller.dragStartY = point.y;
        baller.hasDragLine = false;
        getCanvasState(this.canvas).dragging = baller;
        this.canvas.style.cursor = 'crosshair';
        this.redraw();
    }

    handleMouseUp(event) {
        const state = getCanvasState(this.canvas);
        const baller = state.dragging;
        if (!baller) return;
        state.dragging = null;

        if (!baller.isActive()) return;

        baller.changed = false;
        baller.hovered = false;
        baller.hasDragLine = false;
        const target = event
            ? baller.canvasPoint(event)
            : { x: baller.lineEndX || baller.start_x, y: baller.lineEndY || baller.start_y };
        baller.shoot(target.x, target.y);
        this.redraw();
    }
}

/**
 * Ball steered with the arrow keys / WASD that slides along Blocks (no gravity).
 * Reuses LaunchBall's stepped collisions and animation loop.
 * Override onFrame() (default: game.update()) to check goals etc.
 */
class MoveBall extends LaunchBall {
    constructor(diameter, color, drawnstyle, x, y, canvasId, speed = 200) {
        super(diameter, color, drawnstyle, x, y, false, canvasId, {
            gravity: 0,
            launchSpeedPerPixel: 1,
            maximumLaunchSpeed: speed,
            restitution: 0,
            maximumFrameDelta: 0.05,
            collisionStepDistance: Math.max(1, diameter / 4)
        });
        this.speed = speed;
        this.keys = new Set();
        this.hoverCursor = 'default';
    }

    bindEvents() {
        CanvasItem.prototype.bindEvents.call(this); // hover only, no dragging
        window.addEventListener('keydown', event => this.handleKeyDown(event));
        window.addEventListener('keyup', event => this.keys.delete(MoveBall.keyName(event)));
        window.addEventListener('blur', () => this.keys.clear());
    }

    static keyName(event) {
        const k = event.key.toLowerCase();
        return { arrowleft: 'a', arrowright: 'd', arrowup: 'w', arrowdown: 's' }[k] || k;
    }

    handleKeyDown(event) {
        // Only steer while this canvas is actually on screen.
        if (this.canvas.offsetParent === null) return;
        const key = MoveBall.keyName(event);
        if (!['a', 'd', 'w', 's'].includes(key)) return;
        event.preventDefault();
        this.keys.add(key);
        this.startAnimation();
    }

    handleMouseMove() {}

    update(deltaTime) {
        const vx = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
        const vy = (this.keys.has('s') ? 1 : 0) - (this.keys.has('w') ? 1 : 0);
        const length = Math.hypot(vx, vy);
        this.isMoving = length > 0;
        if (!this.isMoving) {
            this.velocityX = 0;
            this.velocityY = 0;
            return false;
        }
        this.velocityX = vx / length * this.speed;
        this.velocityY = vy / length * this.speed;
        return super.update(deltaTime);
    }
}
/**
 * Platformer player: left/right (A/D or arrows), jump (W / Up / Space).
 * Gravity and Block collisions come from LaunchBall. While enabled the
 * animation loop keeps running; set enabled = false to freeze (game over).
 */
class PlatformBall extends LaunchBall {
    constructor(diameter, color, drawnstyle, x, y, canvasId, options = {}) {
        super(diameter, color, drawnstyle, x, y, false, canvasId, {
            gravity: options.gravity ?? 1500,
            launchSpeedPerPixel: 1,
            maximumLaunchSpeed: 1,
            restitution: 0,
            maximumFrameDelta: 0.03,
            collisionStepDistance: Math.max(1, diameter / 4)
        });
        this.speed = options.speed ?? 260;
        this.jumpSpeed = options.jumpSpeed ?? 720;
        this.spawnX = x;
        this.spawnY = y;
        this.keys = new Set();
        this.enabled = true;
        this.hoverCursor = 'default';
    }

    static keyName(event) {
        const k = event.key === ' ' ? 'space' : event.key.toLowerCase();
        return { arrowleft: 'a', arrowright: 'd', arrowup: 'w' }[k] || k;
    }

    bindEvents() {
        window.addEventListener('keydown', event => this.handleKeyDown(event));
        window.addEventListener('keyup', event => this.keys.delete(PlatformBall.keyName(event)));
        window.addEventListener('blur', () => this.keys.clear());
    }

    handleKeyDown(event) {
        // Only steer while this canvas is actually on screen.
        if (this.canvas.offsetParent === null) return;
        const key = PlatformBall.keyName(event);
        if (!['a', 'd', 'w', 'space'].includes(key)) return;
        event.preventDefault();
        this.keys.add(key);
        if (this.enabled) this.startAnimation();
    }

    handleMouseMove() {}

    // Is something solid directly under the ball?
    isOnGround() {
        const r = this.diameter / 2;
        for (const block of this.blocks()) {
            const { x, y, width, height } = block.bounds;
            const cx = Math.max(x, Math.min(this.start_x, x + width));
            const cy = Math.max(y, Math.min(this.start_y + 3, y + height));
            if (this.start_y <= cy && Math.hypot(this.start_x - cx, this.start_y + 3 - cy) < r) return true;
        }
        return false;
    }

    reset() {
        this.start_x = this.spawnX;
        this.start_y = this.spawnY;
        this.velocityX = 0;
        this.velocityY = 0;
        this.keys.clear();
        this.enabled = true;
        this.startAnimation();
    }

    update(deltaTime) {
        this.isMoving = this.enabled;
        if (!this.enabled) return false;
        this.velocityX = ((this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0)) * this.speed;
        if ((this.keys.has('w') || this.keys.has('space')) && this.isOnGround()) {
            this.velocityY = -this.jumpSpeed;
        }
        super.update(deltaTime);
        return this.enabled;
    }
}

/** Rectangle the ball can overlap without colliding (spikes, finish line...). */
class Zone extends RectItem {
    static layer = 1;

    constructor(canvasId, x, y, width, height, group = 'Zone') {
        super(canvasId, x, y, width, height, group);
        this.seed = Math.floor(Math.random() * 2 ** 31);
    }

    bindEvents() {}

    touches(ball, leniency = 0.8) {
        const { x, y, width, height } = this.bounds;
        const cx = Math.max(x, Math.min(ball.start_x, x + width));
        const cy = Math.max(y, Math.min(ball.start_y, y + height));
        return Math.hypot(ball.start_x - cx, ball.start_y - cy) < ball.diameter / 2 * leniency;
    }
}

/**
 * Text on the canvas. 	ext can be a string or a function returning one
 * (use '\n' for several lines; an empty string draws nothing).
 */
class TextLabel extends CanvasItem {
    static layer = 3;

    constructor(canvasId, text, x, y, { size = 24, color = '#000000', align = 'left' } = {}) {
        super(canvasId, 'TextLabel');
        this.text = text;
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.align = align;
    }

    bindEvents() {}

    paint() {
        const text = typeof this.text === 'function' ? this.text() : this.text;
        if (!text) return;
        const { context } = this;
        context.font = `${this.size}px "Cabin Sketch", cursive, sans-serif`;
        context.fillStyle = this.color;
        context.textAlign = this.align;
        context.textBaseline = 'middle';
        text.split('\n').forEach((line, i) => context.fillText(line, this.x, this.y + i * this.size * 1.3));
    }
}
/**
 * Base class for a mini game. Extend it, override `setup()` and `update()`.
 *
 *   class MyGame extends MiniGame {
 *       setup()  { this.addBlock('black', 100, 0, 50, 1000); this.spawnBall(); }
 *       update() { ...runs every animation frame while a ball moves... }
 *   }
 *   new MyGame('MyCanvas');
 */
class MiniGame {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.balls = [];
        this.setup();
    }

    setup() {}
    update() {}

    addBlock(color, x, y, width, height, style) {
        return new Block(this.canvasId, color, x, y, width, height, style);
    }

    clearBlocks() {
        const blocks = getCanvasState(document.getElementById(this.canvasId)).groups.get('Block') || [];
        blocks.length = 0;
    }

    addBall(ball) {
        ball.game = this;
        this.balls.push(ball);
        return ball;
    }

    removeBall(ball) {
        const index = this.balls.indexOf(ball);
        if (index !== -1) this.balls.splice(index, 1);
        ball.unregister();
    }

    // Turns a stuck ball into a block of the same colour and removes the ball.
    // Returns the new block, or null if the ball was not stuck.
    freezeBall(ball) {
        let block = null;
        if (ball.isStuck) {
            const radius = ball.diameter / 2;
            block = this.addBlock(
                ball.color,
                ball.start_x - radius,
                ball.start_y - radius,
                ball.diameter,
                ball.diameter,
                ball.drawnstyle
            );
        }
        this.removeBall(ball);
        return block;
    }

    // Walks the balls and returns those that stuck or despawned (and removes them from play).
    // `onStuck(ball)` / `onDespawn(ball)` are optional callbacks.
    collectFinishedBalls(onStuck, onDespawn) {
        for (let index = this.balls.length - 1; index >= 0; index--) {
            const ball = this.balls[index];
            if (ball.isActive()) continue;
            const stuck = ball.isStuck;
            this.freezeBall(ball);
            if (stuck) onStuck?.(ball);
            else onDespawn?.(ball);
        }
    }
}
