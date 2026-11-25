// =============================================================================
// index.js - start-up code, settings and the main menu
// =============================================================================
//
// THE PAGES (all live in index.html, one on top of the other)
//   page1  main menu         Start / Options / Scores buttons
//   page2  splash screen     logo + spinner, slides away when the game has loaded
//   page3  options           difficulty, brightness and sound
//   page4  Maze Haze         the platformer          -> maze.js
//   page5  Fill Holes        the ball-launching game -> fillholes.js
//   page6  (placeholder)
//   page7  scores            leaderboard + name box  -> scores.js
//
// Only the page with the class "show" is visible. shiftPage('#pageN')
// (api_lib/myApi.js) moves that class, and the CSS slides the pages up/down.
//
// SCRIPTS AND THEIR JOBS
//   index.js      (this file) menu, settings, calls the setup functions below
//   fillholes.js  Fill Holes game
//   maze.js       Maze Haze game
//   scores.js     Firebase high scores
//
// p5.js calls setup() once, after the page and every script has loaded.
// =============================================================================


// ---- Settings (changed on the options page) -------------------------------------

// difficulty: 1-100 (higher = harder). 1-33 easy (no mask), 34-66 normal, 67-100 hard.
// brightness: 1-100 (50 = normal).
// sound:      true / false.
const gameSettings = { difficulty: 50, brightness: 50, sound: true };

// Turns the difficulty number into 'easy', 'normal' or 'hard'.
function getDifficultyName() {
    const difficulty = gameSettings.difficulty;
    if (difficulty <= 33) return 'easy';
    if (difficulty <= 66) return 'normal';
    return 'hard';
}

// Plays a sound effect, but only if sound is switched on.
function playSound(file = '../api_lib/sounds/beep.mp3') {
    if (!gameSettings.sound) return;
    // play() returns a promise that fails if the browser blocks autoplay. Ignore that.
    new Audio(file).play().catch(() => { });
}

// Connects the options page controls to gameSettings.
function setupOptions() {
    const difficultySlider = document.getElementById('difficultyRange');
    const brightnessSlider = document.getElementById('brightnessRange');
    const soundSwitch = document.getElementById('soundSwitch');

    // Load the settings saved last time, and show them on the controls.
    const saved = JSON.parse(localStorage.getItem('gameSettings') || '{}');
    Object.assign(gameSettings, saved);
    difficultySlider.value = gameSettings.difficulty;
    brightnessSlider.value = gameSettings.brightness;
    soundSwitch.checked = gameSettings.sound;

    // Runs once at start and again whenever any control changes.
    const applySettings = () => {
        // 1. Read the controls
        gameSettings.difficulty = Number(difficultySlider.value);
        gameSettings.brightness = Number(brightnessSlider.value);
        gameSettings.sound = soundSwitch.checked;

        // 2. Update the text next to each control
        document.getElementById('difficultyLabel').textContent =
            `${gameSettings.difficulty} (${getDifficultyName()})`;
        document.getElementById('brightnessLabel').textContent = gameSettings.brightness;
        document.getElementById('soundLabel').textContent = gameSettings.sound ? 'On' : 'Off';

        // 3. Brightness: 50 = normal, 1 = very dark, 100 = twice as bright
        document.querySelector('main').style.filter = `brightness(${gameSettings.brightness / 50})`;

        // 4. Remember the settings for next time
        localStorage.setItem('gameSettings', JSON.stringify(gameSettings));
    };

    [difficultySlider, brightnessSlider, soundSwitch].forEach(control => {
        control.addEventListener('input', applySettings);
    });
    applySettings();
}


// ---- Start-up ------------------------------------------------------------------

// When everything (images, fonts...) has loaded, fade out the splash screen.
window.onload = function () {
    const splashScreen = document.getElementById('page2');
    splashScreen.classList.add('hidden');
};

// Called once by p5.js.
function setup() {
    noCanvas(); // we draw on our own <canvas> elements, not on a p5 canvas

    // Start on the splash screen, then slide to the menu after a short moment.
    currentPage = '#page2';
    setTimeout(() => shiftPage('#page1'), 250);

    rowOfGames = ['4','5','6']

    // Main menu buttons.
    // SketchButton(canvasId, label, hoverColour, onClick, x, y, width, height)
    new SketchButton('myCanvas', 'Start!', 'lightblue', () => {
        shiftPage('#page2')

        rowOfGames = shuffle(rowOfGames)
        shiftPage('#page' + rowOfGames[0])
    }, 75, 50, 250, 110);

    new SketchButton('myCanvas', 'Options', 'orange', () => {
        shiftPage('#page3');
    }, 125, 180, 150, 70);

    new SketchButton('myCanvas', 'Scores', 'gold', () => {
        openScoreBoard(); // scores.js
    }, 125, 275, 150, 70);

    // Back button on the options page.
    new SketchButton('myCanvas2', 'Go Back!', 'lightgreen', () => {
        shiftPage('#page1');
    }, 125, 50, 150, 90);

    // Set up each part of the game.
    setupOptions();
    setupFillHoles();  // fillholes.js
    setupMazeHaze();   // maze.js
    setupScores();     // scores.js
}
