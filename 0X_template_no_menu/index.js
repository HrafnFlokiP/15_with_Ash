// ---- Settings (set on the options page) ----
// difficulty slider 1-100 (higher = harder): 1-33 easy (no clip mask), 34-66 normal, 67-100 hard.
const gameSettings = { difficulty: 50, brightness: 50, sound: true };

function getDifficultyName() {
    const d = gameSettings.difficulty;
    return d <= 33 ? 'easy' : d <= 66 ? 'normal' : 'hard';
}

// Plays a sound effect only if sound is switched on.
function playSound(file = '../api_lib/sounds/beep.mp3') {
    if (!gameSettings.sound) return;
    new Audio(file).play().catch(() => { });
}

function setupOptions() {
    const diff = document.getElementById('difficultyRange');
    const bright = document.getElementById('brightnessRange');
    const sound = document.getElementById('soundSwitch');

    const saved = JSON.parse(localStorage.getItem('gameSettings') || '{}');
    Object.assign(gameSettings, saved);
    diff.value = gameSettings.difficulty;
    bright.value = gameSettings.brightness;
    sound.checked = gameSettings.sound;

    const apply = () => {
        gameSettings.difficulty = Number(diff.value);
        gameSettings.brightness = Number(bright.value);
        gameSettings.sound = sound.checked;
        document.getElementById('difficultyLabel').textContent = `${gameSettings.difficulty} (${getDifficultyName()})`;
        document.getElementById('brightnessLabel').textContent = gameSettings.brightness;
        document.getElementById('soundLabel').textContent = gameSettings.sound ? 'On' : 'Off';
        // 50 = normal brightness, 1 = very dark, 100 = double
        document.querySelector('main').style.filter = `brightness(${gameSettings.brightness / 50})`;
        localStorage.setItem('gameSettings', JSON.stringify(gameSettings));
    };
    [diff, bright, sound].forEach(el => el.addEventListener('input', apply));
    apply();
}
window.onload = function () {
    const loadingScreen = document.getElementById("page2");

    loadingScreen.classList.add("hidden");
};

function setup() {
    noCanvas();
    currentPage = '#page2';
    setTimeout(() => shiftPage('#page1'), 250);

    new SketchButton('myCanvas', 'Start!', 'lightblue', () => {
        shiftPage('#page4');
    }, 75, 50, 250, 110);
    new SketchButton('myCanvas', 'Options', 'orange', () => {
        shiftPage('#page3');
    }, 125, 180, 150, 70);

    new SketchButton('myCanvas2', 'Go Back!', 'lightgreen', () => {
        shiftPage('#page1');
    }, 125, 50, 150, 90);

    setupOptions();
    setupFillHoles();
    setupMazeHaze();
}
