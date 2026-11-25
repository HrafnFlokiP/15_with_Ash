// =============================================================================
// maze.js - "Maze Haze", a vertical platformer (page 4)
// =============================================================================
//
// THE GAME
//   Steer the orange ball up through the maze to the gold finish line.
//   Touch the red spikes, or run out of time, and it is game over.
//
// SCORE
//   Winning is worth up to MAZE_MAX_POINTS. The faster you are, the more you get:
//       points = MAZE_MAX_POINTS * (1 - timeUsed / MAZE_TIME_LIMIT)
//   Dying scores 0. After a win the game opens the score page (scores.js).
//
// THE BUILDING BLOCKS (all come from api_lib/api_classes.js)
//   MiniGame      base class: keeps the list of balls and creates blocks
//   Block         a solid, rough.js-drawn rectangle the ball bounces off
//   Zone          a rectangle the ball can overlap (our Spikes and FinishLine)
//   PlatformBall  the player: gravity + left/right + jump
//   TextLabel     text on the canvas (a plain string, or a function that is
//                 called on every redraw, which is how the timer updates)
//
// HOW A FRAME WORKS
//   PlatformBall runs an animation loop. Every frame it moves the ball, and then
//   calls this game's update(). update() starts the clock, then checks
//   spikes -> finish line -> timer, in that order.
// =============================================================================


// ---- Settings ---------------------------------------------------------------

const MAZE_TIME_LIMIT = 45;       // seconds you get to finish
const MAZE_MAX_POINTS = 5000;     // points for an (impossibly) instant win
const MAZE_WIN_DELAY_MS = 2000;   // how long the "Victory!" text stays before the score page opens

// Difficulty hides the maze behind a circular "flashlight" that follows the ball.
// The value is the radius in canvas pixels; null means no mask at all (easy).
const MAZE_MASK_RADIUS = { easy: null, normal: 90, hard: 30 };

// The level. Each entry is [x, y, width, height]; y is the TOP edge of the slab.
// The canvas is 1000 x 1000 and the ball starts at the bottom.
const MAZE_WALLS = [
    [0, 0, 20, 1000],      // left outer wall
    [980, 0, 20, 1000],    // right outer wall
    [20, 960, 960, 40],    // floor (level 1)
    [20, 830, 360, 20],    // level 2, left part  - leads into the "stupid" hall
    [620, 830, 360, 20],   // level 2, right part - the real way up
    [20, 700, 600, 20],    // hall ceiling + next jump
    [20, 570, 280, 20],    // jump above the hall
    [340, 440, 180, 20],   // last jump: the little island
    [20, 440, 240, 20],    // left side: the spike trap sits on top of this
    [620, 440, 360, 20]    // right side: the finish line sits on top of this
];


// ---- Special zones ------------------------------------------------------------

// Red triangles. Touching them kills the ball. A zone of width W is drawn as
// one triangle for every ~20px of width.
class Spikes extends Zone {
    constructor(canvasId, x, y, width, height) {
        super(canvasId, x, y, width, height, 'Spikes');
    }

    paint() {
        const { x, y, width, height } = this.bounds;
        const count = Math.max(1, Math.round(width / 20));
        const triangleWidth = width / count;

        for (let i = 0; i < count; i++) {
            const left = x + i * triangleWidth;
            this.roughCanvas.polygon(
                [[left, y + height], [left + triangleWidth / 2, y], [left + triangleWidth, y + height]],
                { fill: 'red', fillStyle: 'solid', seed: this.seed + i }
            );
        }
    }
}

// Gold cross-hatched rectangle. Touching it wins the game.
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


// ---- The game -------------------------------------------------------------------

class MazeHazeGame extends MiniGame {
    // MiniGame's constructor calls setup() once. It builds the level and the player.
    setup() {
        // The game is always in exactly one of these states:
        //   ready   - waiting for the first key press (the clock is NOT running)
        //   playing - the clock is running
        //   won     - the finish line was touched
        //   dead    - spikes or the timer got the ball
        this.state = 'ready';
        this.startTime = 0;    // performance.now() when the clock started
        this.elapsed = 0;      // seconds since the clock started
        this.points = 0;
        this.message = '';     // big centred text ("Victory!", "Game over"...)
        this.winTimer = null;  // pending "open the score page" timeout

        this.buildLevel();
        this.buildLabels();
        this.buildPlayer();
        this.bindRestartKeys();
        this.setupDifficulty();
    }

    // Walls, spikes and the finish line.
    buildLevel() {
        for (const [x, y, width, height] of MAZE_WALLS) {
            this.addBlock('saddlebrown', x, y, width, height);
        }
        this.addBlock('black', 20, 0, 960, 20); // ceiling

        this.spikes = new Spikes(this.canvasId, 60, 410, 190, 30);
        this.finish = new FinishLine(this.canvasId, 910, 370, 60, 70);
    }

    // All the text. A label whose text is a function is re-evaluated on every
    // redraw, so the timer and the message always show the current values.
    buildLabels() {
        const id = this.canvasId;

        // Jokes written next to the places they belong to
        new TextLabel(id, 'stupid ;)', 60, 790, { size: 30 });
        new TextLabel(id, "F you ';).", 140, 370, { size: 30, color: 'darkred' });
        new TextLabel(id, 'victory.', 800, 400, { size: 30, color: 'darkgreen' });

        // Top-left: the controls before you start, then the countdown
        new TextLabel(id, () => this.state === 'ready'
            ? 'Move: A / D or arrows   Jump: W / Up / Space'
            : `Time: ${Math.max(0, MAZE_TIME_LIMIT - this.elapsed).toFixed(1)}`,
            40, 50, { size: 24 });

        // Middle: the win / game over message
        new TextLabel(id, () => this.message, 500, 250, { size: 44, align: 'center' });
    }

    // The player ball. PlatformBall(diameter, color, fillStyle, startX, startY, canvasId).
    buildPlayer() {
        this.ball = this.addBall(new PlatformBall(40, 'orange', 'hachure', 500, 935, this.canvasId));
        this.ball.startAnimation();
    }

    // After the game ends, R or Enter plays again. Only reacts while the maze
    // page is the one on screen (otherwise typing "r" in the score page's name
    // box would restart the maze).
    bindRestartKeys() {
        window.addEventListener('keydown', event => {
            if (!isCanvasOnScreen(document.getElementById(this.canvasId))) return;
            const gameIsOver = ['dead', 'won'].includes(this.state);
            const isRestartKey = ['r', 'enter'].includes(event.key.toLowerCase());
            if (gameIsOver && isRestartKey) this.restart();
        });
    }

    // Difficulty comes from the options page: easy = no mask, normal = big
    // mask, hard = small mask. The mask is a CSS clip-path on the canvas that
    // follows the ball, and it is re-applied on every browser frame so a change
    // of the slider takes effect immediately.
    setupDifficulty() {
        const canvas = document.getElementById(this.canvasId);

        const applyMask = () => {
            const radius = MAZE_MASK_RADIUS[getDifficultyName()];
            // The canvas may be shown smaller than its 1000px drawing size,
            // so convert canvas pixels to screen pixels first.
            const scale = canvas.clientWidth / canvas.width;
            const clip = radius == null
                ? 'none'
                : `circle(${radius * scale}px at ${this.ball.start_x * scale}px ${this.ball.start_y * scale}px)`;

            canvas.style.webkitClipPath = clip;
            canvas.style.clipPath = clip;
            requestAnimationFrame(applyMask);
        };
        applyMask();
    }

    // ---- game state changes -------------------------------------------------------

    restart() {
        clearTimeout(this.winTimer); // cancel a pending jump to the score page
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
        this.ball.enabled = false; // freezes the ball
        this.message = `${reason}\nGame over - 0 points\n(press R to retry)`;
    }

    win() {
        playSound();
        this.state = 'won';
        this.ball.enabled = false;

        // Never negative, even if the last frame lands a hair past the time limit.
        this.points = Math.max(0, Math.round(MAZE_MAX_POINTS * (1 - this.elapsed / MAZE_TIME_LIMIT)));
        this.message = `Victory!\nTime: ${this.elapsed.toFixed(2)}s  Points: ${this.points}\n(R = play again, or wait to save your score)`;

        // Give the player a moment to read the message, then open the score page.
        // The state check skips this if they pressed R in the meantime.
        this.winTimer = setTimeout(() => {
            if (this.state === 'won') openScorePageWithResult(this.points);
        }, MAZE_WIN_DELAY_MS);
    }

    // Runs once per animation frame (called by PlatformBall's loop).
    update() {
        // Waiting for the first key press: the clock starts on the first move.
        if (this.state === 'ready') {
            if (this.ball.keys.size === 0) return;
            this.state = 'playing';
            this.startTime = performance.now();
        }
        if (this.state !== 'playing') return;

        this.elapsed = (performance.now() - this.startTime) / 1000;

        // Order matters: spikes beat the finish line, and both beat the timer.
        if (this.spikes.touches(this.ball)) this.die("F you ';).");
        else if (this.finish.touches(this.ball)) this.win();
        else if (this.elapsed >= MAZE_TIME_LIMIT) this.die("Dead-end, so bend-over!");
    }
}


// The one running game. scores.js uses it for the "Play again" button.
let mazeGame = null;

// Called from setup() in index.js.
function setupMazeHaze() {
    mazeGame = new MazeHazeGame('MazeHaze');
}
