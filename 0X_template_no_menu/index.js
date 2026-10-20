const buttonsByCanvas = new WeakMap();

class SketchButton {
    constructor(canvasId, label, hoverFill, onClick, x, y, width = 200, height = 100) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas "${canvasId}" was not found.`);
        }

        if (typeof onClick !== 'function') {
            throw new TypeError('SketchButton onClick must be a function.');
        }
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
            throw new RangeError('SketchButton position and dimensions must be finite, with positive width and height.');
        }

        this.context = this.canvas.getContext('2d');
        if (!this.context) {
            throw new Error(`Canvas "${canvasId}" does not support 2D drawing.`);
        }

        this.roughCanvas = rough.canvas(this.canvas);
        this.label = label;
        this.hoverFill = hoverFill;
        this.onClick = onClick;
        this.bounds = { x, y, width, height };
        this.hovered = false;

        let buttons = buttonsByCanvas.get(this.canvas);
        if (!buttons) {
            buttons = [];
            buttonsByCanvas.set(this.canvas, buttons);
            this.canvas.addEventListener('mousemove', event => this.handleMouseMove(event));
            this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
            this.canvas.addEventListener('click', event => {
                const target = [...buttons].reverse().find(button => button.contains(event));
                if (target) target.onClick();
            });
        }
        buttons.push(this);

        this.draw();
    }

    contains(event) {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;

        const x = (event.clientX - rect.left) * this.canvas.width / rect.width;
        const y = (event.clientY - rect.top) * this.canvas.height / rect.height;
        const { x: left, y: top, width, height } = this.bounds;

        return x >= left && x <= left + width &&
            y >= top && y <= top + height;
    }

    handleMouseMove(event) {
        let changed = false;
        let hoveredButton = false;
        for (const button of buttonsByCanvas.get(this.canvas)) {
            const hovered = button.contains(event);
            if (hovered) hoveredButton = true;
            if (button.hovered !== hovered) {
                button.hovered = hovered;
                changed = true;
            }
        }
        this.canvas.style.cursor = hoveredButton ? 'pointer' : 'default';
        if (changed) this.draw();
    }

    handleMouseLeave() {
        let changed = false;
        for (const button of buttonsByCanvas.get(this.canvas)) {
            if (button.hovered) {
                button.hovered = false;
                changed = true;
            }
        }
        this.canvas.style.cursor = 'default';
        if (changed) this.draw();
    }

    draw() {
        const context = this.context;
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const button of buttonsByCanvas.get(this.canvas)) {
            button.drawButton();
        }
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

function setup() {
    currentPage = '#page1';

    new SketchButton('myCanvas', 'Start!', 'lightblue', () => {
        shiftPage('#page2');
    }, 100, 50, 150, 90);
    new SketchButton('myCanvas', 'Options', 'lightblue', () => {
        shiftPage('#page3');
    }, 100, 180, 250, 110);

    new SketchButton('myCanvas2', 'Go Back!', 'lightgreen', () => {
        shiftPage('#page1');
    }, 80, 50, 150, 90);
}
