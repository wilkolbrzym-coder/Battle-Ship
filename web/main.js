import init, { JsGameEngine } from './pkg/feniks_ai.js';

const PLAYER_BOARD = document.getElementById('player-board');
const OPPONENT_BOARD = document.getElementById('opponent-board');
const START_BUTTON = document.getElementById('start-game');
const LOGS = document.getElementById('logs');

const SHIP_LENGTHS = [5, 4, 3, 3, 2];
let gameEngine = null;

function renderBoard(element, board, isPlayerBoard = false) {
    element.innerHTML = '';
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.x = x;
            cell.dataset.y = y;

            if (isPlayerBoard && board.length > y && board[y].length > x) {
                const state = board[y][x];
                if (state === 1) cell.classList.add('ship');
            }
            element.appendChild(cell);
        }
    }
}

async function startGame() {
    try {
        await init();

        gameEngine = JsGameEngine.new(10, 10, new Uint8Array(SHIP_LENGTHS));
        gameEngine.start_ai_processing();

        const playerFleet = gameEngine.get_player_fleet_layout();
        const jsBoard = [];
        for (let i = 0; i < 10; i++) {
            jsBoard.push(Array.from(playerFleet.slice(i * 10, (i + 1) * 10)));
        }

        renderBoard(PLAYER_BOARD, jsBoard, true);
        renderBoard(OPPONENT_BOARD, [], false);
        log("Gra rozpoczęta. Twoja flota została rozstawiona przez Architekta Genetycznego.");

        OPPONENT_BOARD.addEventListener('click', handleOpponentBoardClick);
    } catch (err) {
        console.error("Błąd podczas inicjalizacji WASM:", err);
        log("Krytyczny błąd: Nie udało się załadować modułu AI.");
    }
}

function handleOpponentBoardClick(event) {
    if (!gameEngine || !event.target.classList.contains('cell') || event.target.classList.contains('hit') || event.target.classList.contains('miss')) return;

    const x = parseInt(event.target.dataset.x, 10);
    const y = parseInt(event.target.dataset.y, 10);

    const result = prompt(`Jaki był wynik strzału w (${x}, ${y})? (hit/miss)`);
    if (result !== 'hit' && result !== 'miss') return;

    event.target.classList.add(result);

    // gameEngine.apply_player_shot(x, y, result);
    log(`Gracz strzelił w (${x}, ${y}) i wynik to: ${result}.`);

    setTimeout(() => botTurn(), 100);
}

function botTurn() {
    const move = gameEngine.get_best_bot_move();
    const [x, y] = [move.x, move.y];

    log(`Bot strzela w: (${String.fromCharCode(65 + y)}${x + 1})`);

    const targetCellOnPlayerBoard = PLAYER_BOARD.querySelector(`[data-x='${x}'][data-y='${y}']`);
    const isHit = targetCellOnPlayerBoard.classList.contains('ship');

    const result = isHit ? 2 : 1; // 2=Hit, 1=Miss
    gameEngine.apply_bot_shot_result(x, y, result);

    targetCellOnPlayerBoard.classList.add(isHit ? 'hit' : 'miss');
    log(`Wynik strzału bota: ${isHit ? 'Trafiony!' : 'Pudło.'}`);
}

function log(message) {
    LOGS.innerHTML = `> ${message}<br>` + LOGS.innerHTML;
}

START_BUTTON.addEventListener('click', startGame);
