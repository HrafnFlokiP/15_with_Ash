let HolesFilled = 0;
let HolesUnfilled = 0;
let ATTEMPTS = 3;
let HOLES_AMOUNT = 3;
let BALL_COLOR_ARRAY = ["orange", "red", "yellow", "green", "blue", "violet", "pink", "grey", "brown"];
const BALLS = []

const ballersByCanvas = new WeakMap();
const draggingBallerByCanvas = new WeakMap();
const blocksByCanvas = new WeakMap();
const animatingCanvases = new WeakSet();

class Baller {
    constructor(diameter, color, drawnstyle = 'hachure', start_x = 0, start_y = 0, despawned = false, canvasId = 'FillHoles', physics) {
        if (!Number.isFinite(diameter) || diameter <= 0 ||
            !Number.isFinite(start_x) || !Number.isFinite(start_y)) {
            throw new RangeError('Baller diameter and position must be finite, with a positive diameter.');
        }
        this.validatePhysics(physics);

        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas "${canvasId}" was not found.`);
        }
        this.context = this.canvas.getContext('2d');
        if (!this.context) {
            throw new Error(`Canvas "${canvasId}" does not support 2D drawing.`);
        }

        this.diameter = diameter;
        this.color = color;
        this.drawnstyle = drawnstyle;
        this.start_x = start_x;
        this.start_y = start_y;
        this.despawned = despawned;
        this.isStuck = false;
        this.physics = { ...physics };
        this.hovered = false;
        this.changed = false;
        this.hasDragLine = false;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isMoving = false;
        this.roughCanvas = rough.canvas(this.canvas);

        let ballers = ballersByCanvas.get(this.canvas);
        if (!ballers) {
            ballers = [];
            ballersByCanvas.set(this.canvas, ballers);
            this.canvas.addEventListener('mousemove', event => this.handleMouseMove(event));
            this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
            this.canvas.addEventListener('mousedown', event => this.handleMouseDown(event));
            window.addEventListener('mousemove', event => this.handleDragMove(event));
            window.addEventListener('mouseup', event => this.handleMouseUp(event));
        }

        ballers.push(this);
        this.draw();
    }

    validatePhysics(physics) {
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

    draw() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (const baller of ballersByCanvas.get(this.canvas)) {
            if (!baller.despawned && !baller.isStuck) baller.spawn();
        }
        for (const block of blocksByCanvas.get(this.canvas) || []) {
            block.draw();
        }
        for (const baller of ballersByCanvas.get(this.canvas)) {
            if (!baller.despawned && !baller.isStuck && baller.hasDragLine) {
                baller.roughCanvas.line(
                    baller.start_x,
                    baller.start_y,
                    baller.lineEndX,
                    baller.lineEndY,
                    { stroke: baller.color, strokeWidth: 2 }
                );
            }
        }
    }

    update(deltaTime) {
        if (!this.isMoving) return false;

        const frameDelta = Math.min(deltaTime, this.physics.maximumFrameDelta);
        const speed = Math.hypot(this.velocityX, this.velocityY);
        const stepCount = Math.max(1, Math.ceil(
            speed * frameDelta / this.physics.collisionStepDistance
        ));
        const stepDelta = frameDelta / stepCount;
        const blocks = blocksByCanvas.get(this.canvas) || [];

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

    isInBlockHole(blocks) {
        const radius = this.diameter / 2;
        const topBlocks = blocks
            .filter(block => block.color === 'yellow')
            .sort((a, b) => a.bounds.x - b.bounds.x);
        const sideWalls = blocks.filter(block => block.color === 'black');
        const leftWall = sideWalls.reduce((leftmost, block) =>
            !leftmost || block.bounds.x < leftmost.bounds.x ? block : leftmost, null
        );
        const rightWall = sideWalls.reduce((rightmost, block) =>
            !rightmost || block.bounds.x + block.bounds.width >
                rightmost.bounds.x + rightmost.bounds.width ? block : rightmost, null
        );
        const gaps = [];

        if (topBlocks.length && leftWall && rightWall) {
            gaps.push({
                start: leftWall.bounds.x + leftWall.bounds.width,
                end: topBlocks[0].bounds.x,
                bounds: topBlocks[0].bounds
            });
            const lastTopBlock = topBlocks[topBlocks.length - 1].bounds;
            gaps.push({
                start: lastTopBlock.x + lastTopBlock.width,
                end: rightWall.bounds.x,
                bounds: lastTopBlock
            });
        }

        for (let index = 0; index < topBlocks.length - 1; index++) {
            const left = topBlocks[index].bounds;
            const right = topBlocks[index + 1].bounds;
            if (left.y !== right.y || left.height !== right.height) continue;

            gaps.push({
                start: left.x + left.width,
                end: right.x,
                bounds: left
            });
        }

        for (const gap of gaps) {
            if (gap.end - gap.start < this.diameter) continue;
            if (this.start_x - radius >= gap.start &&
                this.start_x + radius <= gap.end &&
                this.start_y >= gap.bounds.y &&
                this.start_y <= gap.bounds.y + gap.bounds.height) return true;
        }
        return false;
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
        if (animatingCanvases.has(this.canvas)) return;

        animatingCanvases.add(this.canvas);
        let lastTimestamp;
        const animate = timestamp => {
            const deltaTime = lastTimestamp === undefined
                ? 0
                : (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            const ballers = ballersByCanvas.get(this.canvas);
            let hasMovingBaller = false;
            for (const baller of ballers) {
                if (baller.update(deltaTime)) hasMovingBaller = true;
            }
            update();
            this.draw();

            if (hasMovingBaller) {
                requestAnimationFrame(animate);
            } else {
                animatingCanvases.delete(this.canvas);
            }
        };
        requestAnimationFrame(animate);
    }

    spawn() {
        this.roughCanvas.circle(this.start_x, this.start_y, this.diameter, {
            fill: this.color,
            fillStyle: this.hovered || this.changed ? 'zigzag' : this.drawnstyle
        });
    }

    despawn() {
        this.despawned = true;
        this.draw();
    }

    contains(event) {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;

        const x = (event.clientX - rect.left) * this.canvas.width / rect.width;
        const y = (event.clientY - rect.top) * this.canvas.height / rect.height;
        const radius = this.diameter / 2;
        const distanceX = x - this.start_x;
        const distanceY = y - this.start_y;

        return distanceX * distanceX + distanceY * distanceY <= radius * radius;
    }

    canvasPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * this.canvas.width / rect.width,
            y: (event.clientY - rect.top) * this.canvas.height / rect.height
        };
    }

    handleMouseMove(event) {
        let changed = false;
        let hoveredBaller;
        const ballers = ballersByCanvas.get(this.canvas);

        for (const baller of ballers) {
            if (!baller.despawned && !baller.isStuck && baller.contains(event)) {
                hoveredBaller = baller;
            }
        }

        for (const baller of ballers) {
            const hovered = !baller.isStuck && baller === hoveredBaller;
            if (baller.hovered !== hovered) {
                baller.hovered = hovered;
                changed = true;
            }
        }
        this.canvas.style.cursor = hoveredBaller ? 'crosshair' : 'default';
        if (changed) this.draw();
    }

    handleDragMove(event) {
        const baller = draggingBallerByCanvas.get(this.canvas);
        if (!baller || baller.isStuck || baller.despawned) return;

        const point = baller.canvasPoint(event);
        baller.lineEndX = point.x;
        baller.lineEndY = point.y;
        baller.hasDragLine = true;
        baller.draw();
    }

    handleMouseLeave() {
        let changed = false;
        for (const baller of ballersByCanvas.get(this.canvas)) {
            if (baller.hovered) {
                baller.hovered = false;
                changed = true;
            }
        }
        this.canvas.style.cursor = 'default';
        if (changed) this.draw();
    }

    handleMouseDown(event) {
        if (event.button !== 0) return;

        const ballers = ballersByCanvas.get(this.canvas);
        const baller = [...ballers].reverse().find(candidate =>
            !candidate.despawned && !candidate.isStuck &&
            !candidate.isMoving && candidate.contains(event)
        );
        if (!baller) return;

        const point = baller.canvasPoint(event);
        baller.changed = true;
        baller.dragStartX = point.x;
        baller.dragStartY = point.y;
        baller.hasDragLine = false;
        baller.roughness = 50;
        draggingBallerByCanvas.set(this.canvas, baller);
        this.canvas.style.cursor = 'crosshair';
        this.draw();
    }

    handleMouseUp(event) {
        const baller = draggingBallerByCanvas.get(this.canvas);
        if (!baller) return;

        if (baller.isStuck || baller.despawned) {
            draggingBallerByCanvas.delete(this.canvas);
            return;
        }

        baller.changed = false;
        baller.hovered = false;
        baller.hasDragLine = false;
        draggingBallerByCanvas.delete(this.canvas);
        const target = event
            ? baller.canvasPoint(event)
            : { x: baller.lineEndX || baller.start_x, y: baller.lineEndY || baller.start_y };
        baller.shoot(target.x, target.y);
        baller.draw();
    }
}

class Block {
    constructor(canvasId, color, x, y, width = 200, height = 100, style='hachure') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas "${canvasId}" was not found.`);
        }

        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
            throw new RangeError('Block position and dimensions must be finite, with positive width and height.');
        }

        this.context = this.canvas.getContext('2d');
        if (!this.context) {
            throw new Error(`Canvas "${canvasId}" does not support 2D drawing.`);
        }

        this.roughCanvas = rough.canvas(this.canvas);
        this.color = color;
        this.bounds = { x, y, width, height };
        this.style = style

        let blocks = blocksByCanvas.get(this.canvas);
        if (!blocks) {
            blocks = [];
            blocksByCanvas.set(this.canvas, blocks);
        }
        blocks.push(this);

        this.draw();
    }

    draw() {
        const { x, y, width, height } = this.bounds;
        this.roughCanvas.rectangle(x, y, width, height, {
            fill: this.color,
            fillStyle: this.style
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

function add_ball() {
    color = random(BALL_COLOR_ARRAY)

    BALLS.push(new Baller(60, color, 'hachure', 500, 600, false, 'FillHoles', {
        gravity: 980,
        launchSpeedPerPixel: 32,
        maximumLaunchSpeed: 2100,
        restitution: 1,
        maximumFrameDelta: 0.05,
        collisionStepDistance: 15
    }));
}

function setupFillHoles() {
    add_ball()

    new Block('FillHoles', 'black', 100, 0, 50, 1000)
    new Block('FillHoles', 'black', 900, 0, 50, 1000)

    // Load three top blocks side by side.
    for (let index = 0; index < 4; index++) {
        new Block('FillHoles', 'yellow', 150 + index * (125+BALLS[0].diameter), 100, 115, 50);
    }
}
function update() {
    for (let index = BALLS.length - 1; index >= 0; index--) {
        const ball = BALLS[index];
        if (!ball.despawned && !ball.isStuck) continue;

        if (ball.isStuck) {
            const radius = ball.diameter / 2;
            new Block(
                ball.canvas.id,
                ball.color,
                ball.start_x - radius,
                ball.start_y - radius,
                ball.diameter,
                ball.diameter,
                ball.drawnstyle
            );
        }

        BALLS.splice(index, 1);
        const ballers = ballersByCanvas.get(ball.canvas);
        const ballerIndex = ballers.indexOf(ball);
        if (ballerIndex !== -1) ballers.splice(ballerIndex, 1);
        add_ball();
    }
}