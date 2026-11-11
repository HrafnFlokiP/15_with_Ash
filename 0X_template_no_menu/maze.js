// Maze Haze: a vertical platformer. Climb the maze, avoid the spikes, beat the timer.

const MAZE_TIME_LIMIT = 45;   // seconds
const MAZE_MAX_POINTS = 5000;
const MAZE_MASK_RADIUS = { easy: null, normal: 90, hard: 30 }; // clip mask radius in canvas px

class Spikes extends Zone {
    constructor(canvasId, x, y, width, height) {
        super(canvasId, x, y, width, height, 'Spikes');
    }

    paint() {
        const { x, y, width, height } = this.bounds;
        const count = Math.max(1, Math.round(width / 20));
        const w = width / count;
        for (let i = 0; i < count; i++) {
            this.roughCanvas.polygon(
                [[x + i * w, y + height], [x + i * w + w / 2, y], [x + (i + 1) * w, y + height]],
                { fill: 'red', fillStyle: 'solid', seed: this.seed + i }
            );
        }
    }
}

class FinishLine extends Zone {
    constructor(canvasId, x, y, width, height) {
        super(canvasId, x, y, width, height, 'FinishLine');
    }

    paint() {
        const { x, y, width, height } = this.bounds;
        this.roughCanvas.rectangle(x, y, width, height, {
            fill: 'gold', fillStyle: 'cross-hatch', seed: this.seed
        });
    }
}

class MazeHazeGame extends MiniGame {
    setup() {
        const id = this.canvasId;
        this.state = 'ready'; // ready -> playing -> won | dead
        this.startTime = 0;
        this.elapsed = 0;
        this.points = 0;
        this.message = '';

        // Slabs: [x, y(top), width, height]
        const walls = [
            [0, 0, 20, 1000], [980, 0, 20, 1000],      // outer walls
            [20, 960, 960, 40],                        // floor (level 1)
            [20, 830, 360, 20], [620, 830, 360, 20],   // two ways up; left one is the "stupid" hall
            [20, 700, 600, 20],                        // hall ceiling + next jump
            [20, 570, 280, 20],                        // jump above the hall
            [340, 440, 180, 20],                       // last jump: island
            [20, 440, 240, 20],                        // left: spike trap
            [620, 440, 360, 20]                        // right: finish
        ];
        for (const [x, y, w, h] of walls) this.addBlock('saddlebrown', x, y, w, h);
        for (const [x, y, w, h] of [[20, 0, 960, 20]]) this.addBlock('black', x, y, w, h);

        this.spikes = new Spikes(id, 60, 410, 190, 30);
        this.finish = new FinishLine(id, 910, 370, 60, 70);

        new TextLabel(id, 'stupid ;)', 60, 790, { size: 30 });
        new TextLabel(id, "F you ';).", 140, 370, { size: 30, color: 'darkred' });
        new TextLabel(id, 'victory.', 800, 400, { size: 30, color: 'darkgreen' });

        new TextLabel(id, () => this.state === 'ready'
            ? 'Move: A / D or arrows   Jump: W / Up / Space' : `Time: ${Math.max(0, MAZE_TIME_LIMIT - this.elapsed).toFixed(1)}`,
            40, 50, { size: 24 });
        new TextLabel(id, () => this.message, 500, 250, { size: 44, align: 'center' });

        this.ball = this.addBall(new PlatformBall(40, 'orange', 'hachure', 500, 935, id));
        window.addEventListener('keydown', event => {
            const canvas = document.getElementById(id);
            if (canvas.offsetParent === null) return;
            if (['dead', 'won'].includes(this.state) && ['r', 'enter'].includes(event.key.toLowerCase())) {
                this.restart();
            }
        });
        this.ball.startAnimation();
        this.setupDifficulty();
    }

    // Difficulty comes from the options menu (difficulty slider): easy = no clip mask,
    // normal = big mask, hard = small mask. The mask follows the ball.
    setupDifficulty() {
        const canvas = document.getElementById(this.canvasId);
        const applyMask = () => {
            const radius = MAZE_MASK_RADIUS[getDifficultyName()];
            const k = canvas.clientWidth / canvas.width;
            const clip = radius == null ? 'none'
                : `circle(${radius * k}px at ${this.ball.start_x * k}px ${this.ball.start_y * k}px)`;
            canvas.style.webkitClipPath = clip;
            canvas.style.clipPath = clip;
            requestAnimationFrame(applyMask);
        };
        applyMask();
    }
    restart() {
        this.state = 'ready';
        this.message = '';
        this.elapsed = 0;
        this.points = 0;
        this.ball.reset();
    }

    die(reason) {
        playSound();
        this.state = 'dead';
        this.points = 0;
        this.ball.enabled = false;
        this.message = `${reason}\nGame over - 0 points\n(press R to retry)`;
    }

    win() {
        playSound();
        this.state = 'won';
        this.ball.enabled = false;
        this.points = Math.round(MAZE_MAX_POINTS * (1 - this.elapsed / MAZE_TIME_LIMIT));
        this.message = `Victory!\nTime: ${this.elapsed.toFixed(2)}s  Points: ${this.points}\n(press R to play again)`;
    }

    // Runs every animation frame.
    update() {
        if (this.state === 'ready') {
            if (this.ball.keys.size === 0) return;
            this.state = 'playing';
            this.startTime = performance.now();
        }
        if (this.state !== 'playing') return;

        this.elapsed = (performance.now() - this.startTime) / 1000;
        if (this.spikes.touches(this.ball)) this.die("F you ';).");
        else if (this.finish.touches(this.ball)) this.win();
        else if (this.elapsed >= MAZE_TIME_LIMIT) this.die("Dead-end, so bend-over!");
    }
}

function setupMazeHaze() {
    new MazeHazeGame('MazeHaze');
}
