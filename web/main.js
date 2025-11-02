// Import z modułu WASM
import init, { JsGameEngine } from './pkg/feniks_ai.js';

// Konfiguracje gry
const GAME_CONFIGS = {
    '10x10': { size: 10, ships: [5, 4, 3, 3, 2] },
    '12x12': { size: 12, ships: [5, 4, 4, 3, 3, 3, 2, 2] },
    '15x15': { size: 15, ships: [5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2] }
};

let currentConfig;
let gameEngine;
let history = [];

const ui = {
    startScreen: document.getElementById('start-screen'),
    endScreen: document.getElementById('end-screen'),
    thinkingIndicator: document.getElementById('ai-thinking-indicator'),
    gameOverMessage: document.getElementById('game-over-message'),
    restartBtn: document.getElementById('restart-btn'),
    suggestion: document.getElementById('bot-suggestion'),
    playerBoard: document.getElementById('player-board'),
    opponentBoard: document.getElementById('opponent-board'),
    playerCoordsTop: document.getElementById('player-coords-top'),
    playerCoordsLeft: document.getElementById('player-coords-left'),
    opponentCoordsTop: document.getElementById('opponent-coords-top'),
    opponentCoordsLeft: document.getElementById('opponent-coords-left'),
    shotInput: document.getElementById('shot-input'),
    submitShotBtn: document.getElementById('submit-shot-btn'),
    playerOverrideInput: document.getElementById('player-shot-input'),
    submitPlayerOverrideBtn: document.getElementById('submit-player-shot-btn'),
    undoBtn: document.getElementById('btn-undo'),
};

async function startGame(sizeConfigKey) {
    ui.startScreen.classList.add('hidden');
    showThinkingIndicator();
    currentConfig = GAME_CONFIGS[sizeConfigKey];
    createBoardDOM('player', currentConfig.size);
    createBoardDOM('opponent', currentConfig.size);

    try {
        await init();
        gameEngine = new JsGameEngine(currentConfig.size, new Uint8Array(currentConfig.ships));
        gameEngine.start_ai_processing(new Uint8Array(currentConfig.ships));

        const playerFleetLayout = gameEngine.get_player_fleet_layout();
        renderPlayerBoard(playerFleetLayout);

        hideThinkingIndicator();
        botTurn();
    } catch (err) {
        console.error("Błąd krytyczny podczas inicjalizacji WASM:", err);
        alert("Nie udało się załadować modułu AI.");
    }
}

function createBoardDOM(type, size) {
    const boardEl = ui[`${type}Board`];
    const topCoordsEl = ui[`${type}CoordsTop`];
    const leftCoordsEl = ui[`${type}CoordsLeft`];
    [boardEl, topCoordsEl, leftCoordsEl].forEach(el => el.innerHTML = '');
    boardEl.style.setProperty('--grid-size', size);
    for (let i = 0; i < size; i++) {
        topCoordsEl.innerHTML += `<div>${i + 1}</div>`;
        leftCoordsEl.innerHTML += `<div>${String.fromCharCode(65 + i)}</div>`;
    }
    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.x = i % size;
        cell.dataset.y = Math.floor(i / size);
        boardEl.appendChild(cell);
    }
}

function renderPlayerBoard(flatLayout) {
    const size = currentConfig.size;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (flatLayout[y * size + x] === 1) {
                const cell = ui.playerBoard.querySelector(`[data-x='${x}'][data-y='${y}']`);
                cell.classList.add('ship');
            }
        }
    }
}

function botTurn() {
    showThinkingIndicator();
    setTimeout(() => {
        const moveData = gameEngine.get_best_bot_move();
        const { x, y, top_moves, is_guaranteed } = moveData;
        const coordString = `${String.fromCharCode(65 + y)}${x + 1}`;
        ui.suggestion.textContent = is_guaranteed ? `${coordString} (PEWNY STRZAŁ!)` : coordString;
        clearPreviousSuggestions();
        renderTopMoves(top_moves);
        hideThinkingIndicator();
    }, 50);
}

function updateAfterBotShot(resultCode) {
    const suggestionText = ui.suggestion.textContent.split(' ')[0];
    const y = suggestionText.charCodeAt(0) - 65;
    const x = parseInt(suggestionText.substring(1)) - 1;
    history.push(gameEngine.get_game_state());
    const result = gameEngine.apply_opponent_shot_result(x, y, resultCode);
    updateBoardFromResult(result);
    if(result.game_over) {
        showEndScreen(result.win ? 'Gratulacje! Wygrałeś razem z botem!' : 'Niestety, przeciwnik wygrał.');
    } else {
        botTurn();
    }
}

function updateBoardFromResult(result) {
    result.updated_cells.forEach(cellInfo => {
        const cell = ui.opponentBoard.querySelector(`[data-x='${cellInfo.x}'][data-y='${cellInfo.y}']`);
        if (cell) {
            cell.className = 'cell'; // Reset
            switch (cellInfo.state) {
                case 1: cell.classList.add('miss'); triggerAnimation(cell, 'animate-miss', 400); break;
                case 2: cell.classList.add('hit'); triggerAnimation(cell, 'animate-hit', 500); break;
                case 3: cell.classList.add('sunk'); triggerAnimation(cell, 'animate-sunk', 600); break;
            }
        }
    });
}

function clearPreviousSuggestions() {
    ui.opponentBoard.querySelectorAll('.cell').forEach(cell => {
        const classes = Array.from(cell.classList);
        classes.forEach(c => {
            if(c.startsWith('suggestion-') || ['hit', 'miss', 'sunk'].includes(c)) {
                cell.classList.remove(c);
            }
        });
    });
}

function renderTopMoves(topMoves) {
    if (!topMoves) return;
    topMoves.forEach((move, i) => {
        const cell = ui.opponentBoard.querySelector(`[data-x='${move.x}'][data-y='${move.y}']`);
        if (cell) cell.classList.add(`suggestion-${i + 1}`);
    });
}

function handlePlayerOverrideShot() {
    const value = ui.playerOverrideInput.value.trim().toUpperCase();
    if (!value) return;
    const y = value.charCodeAt(0) - 65;
    const x = parseInt(value.substring(1)) - 1;
    if (x >= 0 && x < currentConfig.size && y >= 0 && y < currentConfig.size) {
        ui.suggestion.textContent = `${value} (Twój wybór)`;
        clearPreviousSuggestions();
        const cell = ui.opponentBoard.querySelector(`[data-x='${x}'][data-y='${y}']`);
        if(cell) cell.classList.add('suggestion-1');
        ui.playerOverrideInput.value = '';
    } else {
        alert("Nieprawidłowe koordynaty.");
    }
}

function handleUndo() {
    if (history.length > 0) {
        const lastState = history.pop();
        gameEngine.set_game_state(lastState);
        const fullBoardState = gameEngine.get_opponent_board_state();
        fullBoardState.forEach((row, y) => {
            row.forEach((state, x) => {
                 const cell = ui.opponentBoard.querySelector(`[data-x='${x}'][data-y='${y}']`);
                 cell.className = 'cell';
                 if (state === 1) cell.classList.add('miss');
                 if (state === 2) cell.classList.add('hit');
                 if (state === 3) cell.classList.add('sunk');
            });
        });
        botTurn();
        console.log("Cofnięto ostatni ruch.");
    } else {
        alert("Brak ruchów do cofnięcia.");
    }
}

function handlePlayerGridShot() {
    const value = ui.shotInput.value.trim().toUpperCase();
    if (!value) return;
    const y = value.charCodeAt(0) - 65;
    const x = parseInt(value.substring(1)) - 1;
     if (x >= 0 && x < currentConfig.size && y >= 0 && y < currentConfig.size) {
        const cell = ui.playerBoard.querySelector(`[data-x='${x}'][data-y='${y}']`);
        if (cell) {
            const isShip = cell.classList.contains('ship');
            cell.classList.add(isShip ? 'hit' : 'miss');
            if(isShip) triggerAnimation(cell, 'animate-hit', 500);
            else triggerAnimation(cell, 'animate-miss', 400);
        }
        ui.shotInput.value = '';
     } else {
         alert("Nieprawidłowe koordynaty.");
     }
}

function triggerAnimation(cellElement, animationClass, duration) {
    cellElement.classList.add(animationClass);
    setTimeout(() => cellElement.classList.remove(animationClass), duration);
}

function showThinkingIndicator() { ui.thinkingIndicator.classList.remove('hidden'); }
function hideThinkingIndicator() { ui.thinkingIndicator.classList.add('hidden'); }
function showEndScreen(message) {
    ui.gameOverMessage.textContent = message;
    ui.endScreen.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.board-size-btn').forEach(btn =>
        btn.addEventListener('click', () => startGame(btn.dataset.size))
    );
    ui.restartBtn.addEventListener('click', () => location.reload());
    const actionButtons = { 'btn-miss': 1, 'btn-hit': 2, 'btn-sunk': 3, 'btn-damaged': 2 };
    for (const [id, code] of Object.entries(actionButtons)) {
        document.getElementById(id).addEventListener('click', () => updateAfterBotShot(code));
    }
    ui.submitPlayerOverrideBtn.addEventListener('click', handlePlayerOverrideShot);
    ui.playerOverrideInput.addEventListener('keydown', e => e.key === 'Enter' && handlePlayerOverrideShot());
    ui.undoBtn.addEventListener('click', handleUndo);
    ui.submitShotBtn.addEventListener('click', handlePlayerGridShot);
    ui.shotInput.addEventListener('keydown', e => e.key === 'Enter' && handlePlayerGridShot());
});
