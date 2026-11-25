// =============================================================================
// fillholes.js - "Fill Holes", a ball-launching game (page 5)
// =============================================================================
//
// THE GAME
//   Drag a ball backwards (like a slingshot) and let go to launch it. The aim
//   is to drop balls into the gaps between the yellow blocks at the top. A ball
//   that comes to rest in a gap turns into a block and fills the hole. A new
//   ball then appears.
//
// THE BUILDING BLOCKS (from api_lib/api_classes.js)
//   LaunchBall  a ball you drag and release; it handles gravity and bouncing
//   Block       a solid rectangle the ball bounces off
//   MiniGame    base class that keeps the balls and calls update() every frame
// =============================================================================


// ---- Settings (some are not used yet) ----------------------------------------------

let HolesFilled = 0;
let HolesUnfilled = 0;
let ATTEMPTS = 3;
let HOLES_AMOUNT = 3;
let BALL_COLOR_ARRAY = ["orange", "red", "yellow", "green", "blue", "violet", "pink", "grey", "brown"];

// How the balls move. Speeds are in canvas pixels per second.
const BALL_PHYSICS = {
    gravity: 980,                 // downward acceleration
    launchSpeedPerPixel: 32,      // dragging 1px further = 32px/s faster launch
    maximumLaunchSpeed: 2100,     // launch speed cap
    restitution: 1,               // bounciness: 1 = loses no energy, 0 = no bounce
    maximumFrameDelta: 0.05,      // longest time step (seconds), so lag cannot teleport the ball
    collisionStepDistance: 15     // check for collisions at least every 15px of travel
};


// ---- The ball --------------------------------------------------------------------

// A ball is "stuck" (and so counts as filling a hole) when it rests in a gap
// between two yellow top blocks, or between a wall and the first/last block.
class Baller extends LaunchBall {
    // LaunchBall calls this after every small movement step. Returning true
    // stops the ball and marks it as stuck.
    isInBlockHole(blocks) {
        const radius = this.diameter / 2;

        // The yellow blocks, left to right
        const topBlocks = blocks
            .filter(block => block.color === 'yellow')
            .sort((a, b) => a.bounds.x - b.bounds.x);

        // The leftmost and rightmost black wall
        const sideWalls = blocks.filter(block => block.color === 'black');
        const leftWall = sideWalls.reduce((leftmost, block) =>
            !leftmost || block.bounds.x < leftmost.bounds.x ? block : leftmost, null
        );
        const rightWall = sideWalls.reduce((rightmost, block) =>
            !rightmost || block.bounds.x + block.bounds.width >
                rightmost.bounds.x + rightmost.bounds.width ? block : rightmost, null
        );

        // Collect every gap. A gap is { start, end, bounds }: the free x-range
        // and the block whose top/bottom edges tell us how deep the gap is.
        const gaps = [];

        // Gap between the left wall and the first block, and between the
        // last block and the right wall.
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

        // Gaps between neighbouring blocks (only if they line up in height).
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

        // The ball is stuck if it fits inside a gap sideways AND is level with the blocks.
        for (const gap of gaps) {
            if (gap.end - gap.start < this.diameter) continue; // gap too narrow for this ball
            if (this.start_x - radius >= gap.start &&
                this.start_x + radius <= gap.end &&
                this.start_y >= gap.bounds.y &&
                this.start_y <= gap.bounds.y + gap.bounds.height) return true;
        }
        return false;
    }
}


// ---- The game --------------------------------------------------------------------

class FillHolesGame extends MiniGame {
    // Builds the level: first ball, two walls and a row of four yellow blocks.
    setup() {
        this.spawnBall();

        this.addBlock('black', 100, 0, 50, 1000);  // left wall
        this.addBlock('black', 900, 0, 50, 1000);  // right wall

        // Four yellow blocks, 115px wide, with a start-to-start spacing of
        // 125px + the ball diameter. That leaves 70px gaps, just wider than a 60px ball.
        for (let index = 0; index < 4; index++) {
            this.addBlock('yellow', 150 + index * (125 + this.balls[0].diameter), 100, 115, 50);
        }
    }

    // Puts a new ball with a random colour at the launch spot.
    spawnBall() {
        const color = random(BALL_COLOR_ARRAY); // random() is a p5.js function
        this.addBall(new Baller(60, color, 'hachure', 500, 600, false, this.canvasId, BALL_PHYSICS));
    }

    // Runs every animation frame. A ball that got stuck or flew off the canvas
    // is removed (a stuck one becomes a block), and either way a new ball is spawned.
    update() {
        this.collectFinishedBalls(() => this.spawnBall(), () => this.spawnBall());
    }
}

// Called from setup() in index.js.
function setupFillHoles() {
    new FillHolesGame('FillHoles');
}
