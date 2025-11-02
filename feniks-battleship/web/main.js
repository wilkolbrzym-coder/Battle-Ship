import init, { FeniksAI, CellState } from './pkg/feniks_ai.js';

let ai;
let currentConfig;
let playerGrid, opponentGrid;
let playerShips = [];
let opponentShips;
let history = [];
let lastShot = null;

const GAME_CONFIGS = {
    '10x10': { size: 10, ships: [ { name: 'pięciomasztowiec', size: 5, count: 1 }, { name: 'czteromasztowiec', size: 4, count: 1 }, { name: 'trójmasztowiec', size: 3, count: 2 }, { name: 'dwumasztowiec', size: 2, count: 1 } ] },
    '12x12': { size: 12, ships: [ { name: 'pięciomasztowiec', size: 5, count: 1 }, { name: 'czteromasztowiec', size: 4, count: 2 }, { name: 'trójmasztowiec', size: 3, count: 3 }, { name: 'dwumasztowiec', size: 2, count: 2 } ] },
    '15x15': { size: 15, ships: [ { name: 'pięciomasztowiec', size: 5, count: 3 }, { name: 'czteromasztowiec', size: 4, count: 3 }, { name: 'trójmasztowiec', size: 3, count: 5 }, { name: 'dwumasztowiec', size: 2, count: 4 } ] }
};

function createBoard(boardId, topCoordsId, leftCoordsId, size) {
    const board = document.getElementById(boardId);
    board.innerHTML = '';
    board.style.setProperty('--grid-size', size);
    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.x = i % size;
        cell.dataset.y = Math.floor(i / size);
        board.appendChild(cell);
    }
}

function renderPlayerBoard() {
    playerShips.forEach(ship => {
        ship.positions.forEach(pos => {
            const cell = document.querySelector(`#player-board .cell[data-x='${pos.x}'][data-y='${pos.y}']`);
            if(cell) cell.classList.add('ship');
        });
    });
}

function renderOpponentBoard() {
    for(let y=0; y < currentConfig.size; y++) {
        for(let x=0; x < currentConfig.size; x++) {
            const cell = document.querySelector(`#opponent-board .cell[data-x='${x}'][data-y='${y}']`);
            if(cell) {
                cell.className = 'cell';
                if(opponentGrid[y][x] !== 'unknown') {
                    cell.classList.add(opponentGrid[y][x]);
                }
            }
        }
    }
}

async function botTurn() {
    showThinkingIndicator(true);
    await new Promise(resolve => setTimeout(resolve, 50));
    const move = ai.get_best_move();
    lastShot = { x: move.x, y: move.y };
    document.getElementById('bot-suggestion').textContent = `${String.fromCharCode(65 + move.y)}${move.x + 1}`;
    showThinkingIndicator(false);
}

function updateAfterBotShot(result) {
    if (!lastShot) return;
    const { x, y } = lastShot;
    let resultState;
    switch (result) {
        case 'Pudło': resultState = CellState.Miss; opponentGrid[y][x] = 'miss'; break;
        case 'Trafiony': resultState = CellState.Hit; opponentGrid[y][x] = 'hit'; break;
        case 'Zatopiony': resultState = CellState.Sunk; opponentGrid[y][x] = 'sunk'; break;
        default: return;
    }
    ai.apply_shot_result(x, y, resultState);
    renderOpponentBoard();
    botTurn();
}

function showThinkingIndicator(show) {
    document.getElementById('ai-thinking-indicator').classList.toggle('hidden', !show);
}

async function startGame(sizeConfig) {
    currentConfig = GAME_CONFIGS[sizeConfig];
    const { size } = currentConfig;

    createBoard('player-board', 'player-coords-top', 'player-coords-left', size);
    createBoard('opponent-board', 'opponent-coords-top', 'opponent-coords-left', size);

    opponentGrid = Array(size).fill(null).map(() => Array(size).fill('unknown'));
    renderOpponentBoard();

    // Inicjalizuj AI i pobierz statki bota
    ai = new FeniksAI();
    const shipsFromWasm = ai.playerShips; // Użyj gettera
    playerShips = shipsFromWasm.map(s => ({...s})); // Konwersja z formatu WASM

    renderPlayerBoard();
    botTurn();

    document.getElementById('start-screen').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
    await init();
    document.querySelectorAll('.board-size-btn').forEach(button => {
        button.addEventListener('click', () => startGame(button.dataset.size));
    });
    const buttons = {'btn-miss': 'Pudło', 'btn-hit': 'Trafiony', 'btn-sunk': 'Zatopiony'};
    for (const [id, action] of Object.entries(buttons)) {
        document.getElementById(id).addEventListener('click', () => updateAfterBotShot(action));
    }
});
