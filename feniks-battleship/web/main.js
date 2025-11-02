// Importujemy interfejs do naszego modułu AI napisanego w Rust/WASM
import init, { FeniksAI, CellState } from './pkg/feniks_ai.js';

let ai; // Globalna instancja AI
let currentConfig; // Globalna konfiguracja gry
let playerGrid, opponentGrid; // Logiczne reprezentacje plansz
let playerShips = [];
let history = []; // Historia ruchów do cofania

const GAME_CONFIGS = {
    '10x10': { size: 10, ships: [{ name: 'pięciomasztowiec', size: 5, count: 1 }, /* ... reszta konfiguracji ... */] },
    '12x12': { size: 12, ships: [/* ... */] },
    '15x15': { size: 15, ships: [/* ... */] }
};
// Upraszczamy konfigurację dla czytelności - pełna jest w starym pliku
GAME_CONFIGS['10x10'].ships = [{ name: 'pięciomasztowiec', size: 5, count: 1 }, { name: 'czteromasztowiec', size: 4, count: 1 }, { name: 'trójmasztowiec', size: 3, count: 2 }, { name: 'dwumasztowiec', size: 2, count: 1 }];


// ##################################################################
// #                       LOGIKA UI (PRZENIESIONA)                 #
// ##################################################################

function createBoard(boardId, topCoordsId, leftCoordsId, size) {
    const boardElement = document.getElementById(boardId);
    const topCoordsElement = document.getElementById(topCoordsId);
    const leftCoordsElement = document.getElementById(leftCoordsId);
    boardElement.innerHTML = '';
    topCoordsElement.innerHTML = '';
    leftCoordsElement.innerHTML = '';
    boardElement.style.setProperty('--grid-size', size);
    for (let i = 0; i < size; i++) {
        const topCoord = document.createElement('div');
        topCoord.textContent = i + 1;
        topCoordsElement.appendChild(topCoord);
        const leftCoord = document.createElement('div');
        leftCoord.textContent = String.fromCharCode(65 + i);
        leftCoordsElement.appendChild(leftCoord);
    }
    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.x = i % size;
        cell.dataset.y = Math.floor(i / size);
        boardElement.appendChild(cell);
    }
}

function renderBoard(boardId, grid) {
    const boardElement = document.getElementById(boardId);
    const cells = boardElement.childNodes;
    const size = grid.length;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = y * size + x;
            const cellState = grid[y][x];
            const cellElement = cells[index];
            cellElement.className = 'cell'; // Reset klas

            if (boardId === 'opponent-board') {
                 if (cellState !== 'unknown') {
                    cellElement.classList.add(cellState);
                }
            }
        }
    }
}

function triggerAnimation(cellElement, animationClass, duration) {
    cellElement.classList.add(animationClass);
    setTimeout(() => cellElement.classList.remove(animationClass), duration);
}

function showThinkingIndicator(show) {
    document.getElementById('ai-thinking-indicator').classList.toggle('hidden', !show);
}


// ##################################################################
// #                 INTEGRACJA UI Z AI (WASM)                      #
// ##################################################################

let lastShot = null;

async function botTurn() {
    showThinkingIndicator(true);
    // Asynchroniczne wywołanie, aby UI się nie blokowało
    await new Promise(resolve => setTimeout(resolve, 50));

    const move = ai.get_best_move();
    lastShot = { x: move.x, y: move.y };

    const coordString = `${String.fromCharCode(65 + move.y)}${move.x + 1}`;
    document.getElementById('bot-suggestion').textContent = coordString;

    // Wizualizacja najlepszego ruchu
    const cellElement = document.querySelector(`#opponent-board .cell[data-x='${move.x}'][data-y='${move.y}']`);
    if(cellElement) {
        document.querySelectorAll('#opponent-board .cell').forEach(c => c.classList.remove('suggestion-1'));
        cellElement.classList.add('suggestion-1');
    }

    console.log(`Bot (WASM) sugeruje strzał w: (${move.x}, ${move.y})`);
    showThinkingIndicator(false);
}

function updateAfterBotShot(result) {
    if (!lastShot) return;

    // Zapisz stan do historii
    // ... (logika historii do zaimplementowania)

    const { x, y } = lastShot;
    const cellElement = document.querySelector(`#opponent-board .cell[data-x='${x}'][data-y='${y}']`);
    let resultState, animation;

    switch (result) {
        case 'Pudło':
            resultState = CellState.Miss;
            opponentGrid[y][x] = 'miss';
            animation = 'animate-miss';
            break;
        case 'Trafiony':
            resultState = CellState.Hit;
            opponentGrid[y][x] = 'hit';
            animation = 'animate-hit';
            break;
        case 'Zatopiony':
            // Logika Sunk jest bardziej złożona, na razie traktujemy jak Hit
            resultState = CellState.Hit; // TODO: Rozbudować o logikę Sunk
            opponentGrid[y][x] = 'sunk';
            animation = 'animate-sunk';
            break;
        default: return;
    }

    // Poinformuj AI w WASM o wyniku
    ai.apply_shot_result(x, y, resultState);

    triggerAnimation(cellElement, animation, 500);
    renderBoard('opponent-board', opponentGrid);

    // Poproś AI o następny ruch
    botTurn();
}

async function startGame(sizeConfig) {
    document.getElementById('start-screen').classList.add('hidden');
    currentConfig = GAME_CONFIGS[sizeConfig];
    const size = currentConfig.size;

    createBoard('player-board', 'player-coords-top', 'player-coords-left', size);
    createBoard('opponent-board', 'opponent-coords-top', 'opponent-coords-left', size);

    opponentGrid = Array(size).fill(null).map(() => Array(size).fill('unknown'));
    renderBoard('opponent-board', opponentGrid);

    // Uruchom AI
    botTurn();
}


// ##################################################################
// #                       GŁÓWNY PUNKT WEJŚCIA                     #
// ##################################################################

document.addEventListener('DOMContentLoaded', async () => {
    // Inicjalizuj moduł WASM i AI
    await init();
    ai = new FeniksAI();
    console.log("Feniks AI (WASM) gotowy.");

    document.querySelectorAll('.board-size-btn').forEach(button => {
        button.addEventListener('click', () => startGame(button.dataset.size));
    });

    const buttons = {
        'btn-miss': 'Pudło',
        'btn-hit': 'Trafiony',
        'btn-sunk': 'Zatopiony'
    };
    for (const [id, action] of Object.entries(buttons)) {
        document.getElementById(id).addEventListener('click', () => updateAfterBotShot(action));
    }

    // TODO: Dodać resztę event listenerów (undo, restart, etc.)
});
