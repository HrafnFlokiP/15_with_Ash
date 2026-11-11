let HolesFilled = 0;
let HolesUnfilled = 0;
let ATTEMPTS = 3;
let HOLES_AMOUNT = 3;
let BALL_COLOR_ARRAY = ["orange", "red", "yellow", "green", "blue", "violet", "pink", "grey", "brown"];

const BALL_PHYSICS = {
    gravity: 980,
    launchSpeedPerPixel: 32,
    maximumLaunchSpeed: 2100,
    restitution: 1,
    maximumFrameDelta: 0.05,
    collisionStepDistance: 15
};

// A ball is "stuck" when it rests in a gap between the yellow top blocks / black walls.
class Baller extends LaunchBall {
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
}

class FillHolesGame extends MiniGame {
    setup() {
        this.spawnBall();

        this.addBlock('black', 100, 0, 50, 1000);
        this.addBlock('black', 900, 0, 50, 1000);

        for (let index = 0; index < 4; index++) {
            this.addBlock('yellow', 150 + index * (125 + this.balls[0].diameter), 100, 115, 50);
        }
    }

    spawnBall() {
        const color = random(BALL_COLOR_ARRAY);
        this.addBall(new Baller(60, color, 'hachure', 500, 600, false, this.canvasId, BALL_PHYSICS));
    }

    update() {
        this.collectFinishedBalls(() => this.spawnBall(), () => this.spawnBall());
    }
}

function setupFillHoles() {
    new FillHolesGame('FillHoles');
}
