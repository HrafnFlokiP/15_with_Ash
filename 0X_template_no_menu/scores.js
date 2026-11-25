// =============================================================================
// scores.js - online high scores for Maze Haze (stored in Firebase Firestore)
// =============================================================================
//
// HOW IT FITS TOGETHER
//
//   api_lib/firebase.js    Starts Firebase and creates the global `db`.
//   api_lib/myClasses.js   Has the small `Firebase` helper class (save / listen).
//   scores.js (this file)  Adds the score screen on top of that helper:
//
//       ScoreStore   asks Firebase to save a score or to send us the top scores
//       ScorePage    controls page 7 (name box, buttons, leaderboard list)
//
// THE FLOW
//
//   1. The player wins Maze Haze      -> maze.js calls openScorePageWithResult(points)
//   2. Page 7 slides in               -> the player types a name and presses Save
//   3. ScoreStore.submit()            -> writes { name, points, timestamp } to Firestore
//   4. Firestore tells every browser  -> the leaderboard redraws by itself ("live")
//
//   The menu's "Scores" button calls openScoreBoard(), which shows the same page
//   without the name box, so the board can be viewed without playing.
//
// IF FIREBASE CANNOT LOAD (offline, blocked script...) the game still works:
// the score page just says that scores are unavailable.
//
// SECURITY NOTE
//   Everything in this file runs in the player's browser, so a determined player
//   can send any numbers they like. The checks below only catch honest mistakes.
//   Real protection has to live in the Firestore *security rules* (Firebase
//   console -> Firestore Database -> Rules). Suggested rules for this game:
//
//     rules_version = '2';
//     service cloud.firestore {
//       match /databases/{database}/documents {
//         match /maze_haze_scores/{score} {
//           allow read: if true;
//           allow create: if request.resource.data.keys().hasOnly(['name', 'points', 'timestamp'])
//                         && request.resource.data.name is string
//                         && request.resource.data.name.size() > 0
//                         && request.resource.data.name.size() <= 12
//                         && request.resource.data.points is int
//                         && request.resource.data.points >= 0
//                         && request.resource.data.points <= 5000
//                         && request.resource.data.timestamp == request.time;
//           allow update, delete: if false;
//         }
//       }
//     }
//
//   (12 = SCORE_NAME_MAX_LENGTH and 5000 = MAZE_MAX_POINTS in maze.js.)
// =============================================================================


// ---- Settings you may want to change ---------------------------------------

const SCORE_COLLECTION = 'maze_haze_scores'; // Firestore collection that holds the scores
const SCORE_LIST_SIZE = 8;                   // how many rows the leaderboard shows
const SCORE_NAME_MAX_LENGTH = 12;            // longest name we accept
const SCORE_SAVE_TIMEOUT_MS = 8000;          // stop waiting for the server after this long
const SCORE_OPEN_DELAY_MS = 1000;            // page slide takes 1s (see .page in index.css)
const SCORE_NAME_STORAGE_KEY = 'playerName'; // localStorage key that remembers the name


// ---- Small helpers ----------------------------------------------------------

// Turns whatever was typed into a safe, tidy name.
// Returns '' when nothing usable is left (the caller then asks for a name).
function cleanPlayerName(rawName) {
    return String(rawName ?? '')
        .replace(/[\u0000-\u001f\u007f]/g, '') // remove invisible control characters
        .replace(/\s+/g, ' ')                   // many spaces/tabs -> a single space
        .trim()
        .slice(0, SCORE_NAME_MAX_LENGTH)
        .trim();                                // cutting may leave a trailing space
}

// A score is valid if it is a whole number between 0 and the best possible score.
function isValidScore(points) {
    return Number.isInteger(points) && points >= 0 && points <= MAZE_MAX_POINTS;
}


// =============================================================================
// ScoreStore - the only class that talks to Firebase
// =============================================================================
class ScoreStore {
    constructor(collectionName) {
        this.firebase = null;
        this.available = false;

        // `new Firebase(...)` throws if the Firebase scripts did not load,
        // so we catch it and simply mark scores as unavailable.
        try {
            this.firebase = new Firebase(collectionName);
            this.available = true;
        } catch (error) {
            console.warn('Firebase is not available - scores are switched off.', error);
        }
    }

    // Saves one score. Resolves with { id, queued }:
    //   id      the Firestore document id of the new score (null if still waiting)
    //   queued  true if the server did not answer in time. Firestore keeps the
    //           write and uploads it as soon as the connection is back.
    // Rejects if Firestore refuses the write (for example "permission-denied").
    async submit(name, points) {
        if (!this.available) throw new Error('Scores are not available.');

        const write = this.firebase.save(name, points);
        write.catch(error => console.warn('Saving the score failed.', error)); // avoids "unhandled rejection" if the timeout wins

        const timeout = new Promise(resolve => setTimeout(() => resolve(null), SCORE_SAVE_TIMEOUT_MS));
        const reference = await Promise.race([write, timeout]);

        return reference ? { id: reference.id, queued: false } : { id: null, queued: true };
    }

    // Calls onChange(listOfScores) now and again every time the top scores change.
    // Each score looks like { id, name, points, timestamp }, best score first.
    // Returns a function that stops listening.
    watchTop(limit, onChange, onError) {
        if (!this.available) return () => { };
        return this.firebase.listen(onChange, limit, 'points', 'desc', onError);
    }
}


// =============================================================================
// ScorePage - everything you see on page 7
// =============================================================================
class ScorePage {
    constructor(store) {
        this.store = store;

        // What the page currently knows
        this.points = null;        // score of the run that just ended (null = only browsing)
        this.hasSaved = false;     // true once that score has been saved
        this.isSaving = false;     // true while we wait for Firebase
        this.lastSavedId = null;   // lets us highlight the player's own row
        this.latestScores = [];    // newest list received from Firebase
        this.listProblem = null;   // text to show instead of the list when loading failed

        // The HTML elements we control (see page7 in index.html)
        this.page = document.getElementById('page7');
        this.summary = document.getElementById('scoreSummary');
        this.nameInput = document.getElementById('playerName');
        this.status = document.getElementById('scoreStatus');
        this.list = document.getElementById('scoreList');

        this.buildButtons();
        this.restoreSavedName();
        this.listenForEnterKey();
        this.listenForScores();
    }

    // ---- setup --------------------------------------------------------------

    // The three buttons are drawn on small canvases, like the other menus.
    buildButtons() {
        this.saveButton = new SketchButton('saveScoreCanvas', 'Save', 'gold',
            () => this.save(), 10, 10, 140, 60);

        this.playButton = new SketchButton('scoreNavCanvas', 'Play again', 'lightgreen',
            () => this.playAgain(), 15, 10, 175, 70);

        this.menuButton = new SketchButton('scoreNavCanvas', 'Main menu', 'orange',
            () => shiftPage('#page1'), 210, 10, 175, 70);
    }

    // Pre-fills the name box with the name used last time on this computer.
    restoreSavedName() {
        this.nameInput.value = localStorage.getItem(SCORE_NAME_STORAGE_KEY) || '';
    }

    // Pressing Enter in the name box works like pressing Save.
    listenForEnterKey() {
        this.nameInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') this.save();
        });
    }

    // Starts the live connection to Firebase. From now on `renderList` runs
    // every time somebody (in any browser) saves a new top score.
    listenForScores() {
        if (!this.store.available) {
            this.listProblem = 'Scores are offline right now.';
            this.renderList([]);
            return;
        }
        this.store.watchTop(
            SCORE_LIST_SIZE,
            scores => {
                this.listProblem = null; // loading works (again)
                this.latestScores = scores;
                this.renderList(scores);
            },
            error => {
                console.error('Could not load the scores.', error);
                this.listProblem = "Couldn't load the scores.";
                this.renderList([]);
            }
        );
    }

    // ---- the two ways of opening the page -------------------------------------

    // After a win: show the points, the name box and the Save button.
    showResult(points) {
        this.points = points;
        this.hasSaved = false;
        this.lastSavedId = null;

        this.page.classList.add('has-result');
        this.summary.textContent = `You escaped with ${points} points! Add your name to the board:`;
        this.setStatus('');
        this.setButtonLabel(this.saveButton, 'Save');
        this.setButtonLabel(this.playButton, 'Play again');
        this.renderList(this.latestScores);
    }

    // From the main menu: just the leaderboard, no name box.
    showBoardOnly() {
        this.points = null;
        this.lastSavedId = null;

        this.page.classList.remove('has-result');
        this.summary.textContent = 'The best escapes so far:';
        this.setStatus('');
        this.setButtonLabel(this.playButton, 'Play Maze');
        this.renderList(this.latestScores);
    }

    // ---- saving ---------------------------------------------------------------

    async save() {
        // Nothing to save when only browsing, or when this score is already saved.
        if (this.points === null || this.hasSaved || this.isSaving) return;

        if (!this.store.available) {
            this.setStatus('Scores are offline, so this one cannot be saved.', 'error');
            return;
        }

        const name = cleanPlayerName(this.nameInput.value);
        if (!name) {
            this.setStatus('Type a name first!', 'error');
            this.nameInput.focus({ preventScroll: true });
            return;
        }

        if (!isValidScore(this.points)) {
            this.setStatus("That score doesn't look right, so it was not saved.", 'error');
            return;
        }

        this.isSaving = true;
        this.setStatus('Saving...');

        try {
            const result = await this.store.submit(name, this.points);

            this.hasSaved = true;
            this.lastSavedId = result.id;
            this.nameInput.value = name; // show the tidied-up name that was really saved
            localStorage.setItem(SCORE_NAME_STORAGE_KEY, name);

            this.setButtonLabel(this.saveButton, 'Saved!');
            this.setStatus(
                result.queued
                    ? 'No answer yet - your score will upload when you are back online.'
                    : 'Score saved!',
                'ok'
            );
            this.renderList(this.latestScores); // redraw so the new row gets highlighted
        } catch (error) {
            console.error('Could not save the score.', error);
            this.setStatus("Couldn't save your score. Try again!", 'error');
        } finally {
            this.isSaving = false;
        }
    }

    // ---- navigation -----------------------------------------------------------

    playAgain() {
        if (mazeGame) mazeGame.restart(); // mazeGame is created in maze.js
        shiftPage('#page4');
    }

    // ---- drawing the page -------------------------------------------------------

    // Changes the text on a SketchButton and redraws it.
    setButtonLabel(button, label) {
        button.label = label;
        button.redraw();
    }

    // Shows a line of feedback under the name box.
    // kind: '' (normal), 'ok' (green) or 'error' (red) - styled in index.css.
    setStatus(text, kind = '') {
        this.status.textContent = text;
        this.status.className = `score-status ${kind}`.trim();
    }

    // Replaces the whole leaderboard with a single message line.
    showListMessage(text) {
        this.list.replaceChildren();
        const item = document.createElement('li');
        item.className = 'score-message';
        item.textContent = text;
        this.list.appendChild(item);
    }

    // Rebuilds the leaderboard rows from a list of scores
    // (or shows the reason why there is no list).
    renderList(scores) {
        if (this.listProblem) {
            this.showListMessage(this.listProblem);
            return;
        }
        if (!scores.length) {
            this.showListMessage('No scores yet - be the first!');
            return;
        }
        this.list.replaceChildren(
            ...scores.map((score, index) => this.buildRow(score, index + 1))
        );
    }

    // Builds one <li> row: rank, name and points.
    // textContent (not innerHTML) is used on purpose: names come from the
    // database, and this way nobody can sneak HTML into the page.
    buildRow(score, rank) {
        const row = document.createElement('li');
        row.className = 'score-row';
        if (score.id && score.id === this.lastSavedId) row.classList.add('mine');

        const rankCell = document.createElement('span');
        rankCell.className = 'score-rank';
        rankCell.textContent = `#${rank}`;

        const nameCell = document.createElement('span');
        nameCell.className = 'score-name';
        nameCell.textContent = String(score.name ?? '???');

        const pointsCell = document.createElement('span');
        pointsCell.className = 'score-points';
        pointsCell.textContent = Number(score.points) || 0;

        row.append(rankCell, nameCell, pointsCell);
        return row;
    }
}


// =============================================================================
// Functions the rest of the game calls
// =============================================================================

let scorePage = null; // created once by setupScores()

// Called from setup() in index.js.
function setupScores() {
    scorePage = new ScorePage(new ScoreStore(SCORE_COLLECTION));
}

// Called by maze.js after a win: slide to page 7 with the name box open.
function openScorePageWithResult(points) {
    if (!scorePage) return;
    scorePage.showResult(points);
    shiftPage('#page7');
    // Wait for the slide to finish, then put the cursor in the name box.
    // (preventScroll stops the browser from scrolling the half-hidden page.)
    setTimeout(() => scorePage.nameInput.focus({ preventScroll: true }), SCORE_OPEN_DELAY_MS);
}

// Called by the "Scores" button on the main menu: just show the leaderboard.
function openScoreBoard() {
    if (!scorePage) return;
    scorePage.showBoardOnly();
    shiftPage('#page7');
}
