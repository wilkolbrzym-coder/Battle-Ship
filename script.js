// ##################################################################
// #                           ETAP 2                             #
// ##################################################################

const GAME_CONFIGS = {
    '10x10': {
        size: 10,
        ships: [
            { name: 'pięciomasztowiec', size: 5, count: 1 },
            { name: 'czteromasztowiec', size: 4, count: 1 },
            { name: 'trójmasztowiec', size: 3, count: 2 },
            { name: 'dwumasztowiec', size: 2, count: 1 }
        ]
    },
    '12x12': {
        size: 12,
        ships: [
            { name: 'pięciomasztowiec', size: 5, count: 1 },
            { name: 'czteromasztowiec', size: 4, count: 2 },
            { name: 'trójmasztowiec', size: 3, count: 3 },
            { name: 'dwumasztowiec', size: 2, count: 2 }
        ]
    },
    '15x15': {
        size: 15,
        ships: [
            { name: 'pięciomasztowiec', size: 5, count: 2 },
            { name: 'czteromasztowiec', size: 4, count: 2 },
            { name: 'trójmasztowiec', size: 3, count: 4 },
            { name: 'dwumasztowiec', size: 2, count: 3 }
        ]
    }
};

let currentConfig = GAME_CONFIGS['10x10'];

/**
 * Tworzy planszę do gry o określonym rozmiarze.
 * @param {string} boardId - ID elementu HTML, w którym ma być plansza.
 * @param {number} size - Rozmiar planszy (np. 10 dla 10x10).
 */
function createBoard(boardId, size) {
    const boardElement = document.getElementById(boardId);
    boardElement.innerHTML = ''; // Wyczyść planszę przed generowaniem

    // Ustawienie właściwości CSS dla siatki
    boardElement.style.setProperty('--grid-size', size);

    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        const x = i % size;
        const y = Math.floor(i / size);
        cell.dataset.x = x;
        cell.dataset.y = y;
        boardElement.appendChild(cell);
    }
}

/**
 * Obsługuje kliknięcie komórki na planszy gracza (strzał przeciwnika).
 * @param {Event} event
 */
function handlePlayerBoardClick(event) {
    const cell = event.target;
    if (!cell.classList.contains('cell')) return;

    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    const cellState = playerGrid[y][x];

    if (typeof cellState === 'object' && cellState !== null && !cellState.hit) {
        // Trafienie w statek
        cellState.hit = true;
        const ship = playerShips.find(s => s.id === cellState.shipId);
        ship.hits++;

        // Sprawdzenie specjalnej zasady dla statku 3-masztowego
        let sunkBySpecialRule = false;
        if (ship.size === 3) {
            const middlePosition = ship.positions[1]; // Środkowy segment
            if (middlePosition.x === x && middlePosition.y === y) {
                ship.isSunk = true;
                sunkBySpecialRule = true;
                console.log("Statek 3-masztowy zatopiony specjalną zasadą!");
            }
        }

        // Standardowe sprawdzenie zatopienia
        if (!sunkBySpecialRule && ship.hits === ship.size) {
            ship.isSunk = true;
        }

        if (ship.isSunk) {
            console.log(`Statek ${ship.name} został zatopiony!`);
            // Oznacz wszystkie części statku jako zatopione, aby zmienić ich wygląd
            ship.positions.forEach(pos => {
                const sunkCell = document.querySelector(`#player-board .cell[data-x='${pos.x}'][data-y='${pos.y}']`);
                sunkCell.classList.add('sunk');
            });
        }

        cell.classList.add('hit');
        checkWinCondition();
    } else if (cellState === 'water') {
        // Pudło
        playerGrid[y][x] = 'miss';
        cell.classList.add('miss');
    }
}

/**
 * Obsługuje kliknięcie komórki na planszy przeciwnika (symulacja strzału bota).
 * @param {Event} event
 */
function handleOpponentBoardClick(event) {
    if (event.target.classList.contains('cell')) {
        const x = event.target.dataset.x;
        const y = event.target.dataset.y;
        document.getElementById('bot-suggestion').textContent = `${String.fromCharCode(65 + parseInt(y))}${parseInt(x) + 1}`;
        console.log(`Bot strzela w pole: (${x}, ${y})`);
        // W przyszłości stan komórki będzie zależał od odpowiedzi gracza
    }
}


// ##################################################################
// #                       LOGIKA ZAAWANSOWANA BOTA                 #
// ##################################################################

/**
 * Oblicza mapę prawdopodobieństwa umieszczenia statków na planszy.
 * @returns {Array<Array<number>>} - Siatka z wartościami prawdopodobieństwa dla każdego pola.
 */
function calculateProbabilityMap() {
    const size = currentConfig.size;
    const probMap = Array(size).fill(null).map(() => Array(size).fill(0));
    const shipsToPlace = opponentShips.flatMap(ship => Array(ship.count).fill(ship.size));

    for (const shipSize of shipsToPlace) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Sprawdź w poziomie
                if (x + shipSize <= size && canPlaceShipForProbability(opponentGrid, x, y, shipSize, false)) {
                    for (let i = 0; i < shipSize; i++) {
                        probMap[y][x + i]++;
                    }
                }
                // Sprawdź w pionie
                if (y + shipSize <= size && canPlaceShipForProbability(opponentGrid, x, y, shipSize, true)) {
                    for (let i = 0; i < shipSize; i++) {
                        probMap[y + i][x]++;
                    }
                }
            }
        }
    }

    return probMap;
}

/**
 * Sprawdza, czy statek może być teoretycznie umieszczony na planszy przeciwnika.
 * Ignoruje inne 'unknown' pola, ale respektuje 'miss' i 'hit'.
 */
function canPlaceShipForProbability(grid, x, y, size, isVertical) {
    for (let i = 0; i < size; i++) {
        const currentX = isVertical ? x : x + i;
        const currentY = isVertical ? y + i : y;
        if (grid[currentY][currentX] === 'miss' || grid[currentY][currentX] === 'sunk') {
            return false; // Nie można umieścić statku na pudle lub zatopionym statku
        }
    }
    return true;
}


// ##################################################################
// #                           ETAP 3                             #
// ##################################################################

let playerGrid; // Tablica 2D dla statków gracza/bota
let playerShips = []; // Lista obiektów statków gracza
let opponentGrid; // Tablica 2D dla planszy przeciwnika
let opponentShips; // Lista statków przeciwnika do zatopienia

/**
 * Inicjalizuje puste siatki gry.
 * @param {number} size - Rozmiar siatki.
 */
function initializeGrids(size) {
    playerGrid = Array(size).fill(null).map(() => Array(size).fill('water'));
    opponentGrid = Array(size).fill(null).map(() => Array(size).fill('unknown'));

    // Inicjalizacja listy statków przeciwnika do śledzenia
    opponentShips = JSON.parse(JSON.stringify(currentConfig.ships));
}

/**
 * Rozmieszcza statki losowo na podanej siatce.
 * @param {Array<Array<string>>} grid - Siatka do umieszczenia statków.
 * @param {Array<object>} shipsConfig - Konfiguracja statków do rozmieszczenia.
 */
function placeShipsRandomly(grid, shipsConfig) {
    const size = grid.length;
    let shipIdCounter = 0;
    playerShips = []; // Resetuj listę statków gracza

    for (const shipType of shipsConfig) {
        for (let i = 0; i < shipType.count; i++) {
            let placed = false;
            while (!placed) {
                const isVertical = Math.random() < 0.5;
                const x = Math.floor(Math.random() * (isVertical ? size : size - shipType.size + 1));
                const y = Math.floor(Math.random() * (isVertical ? size - shipType.size + 1 : size));

                if (canPlaceShip(grid, x, y, shipType.size, isVertical)) {
                    const newShip = {
                        id: shipIdCounter++,
                        name: shipType.name,
                        size: shipType.size,
                        positions: [],
                        hits: 0,
                        isSunk: false
                    };

                    for (let j = 0; j < shipType.size; j++) {
                        const currentX = isVertical ? x : x + j;
                        const currentY = isVertical ? y + j : y;

                        grid[currentY][currentX] = { shipId: newShip.id, hit: false };
                        newShip.positions.push({ x: currentX, y: currentY });
                    }
                    playerShips.push(newShip);
                    placed = true;
                }
            }
        }
    }
}

/**
 * Sprawdza, czy statek może być umieszczony w danym miejscu.
 */
function canPlaceShip(grid, x, y, size, isVertical) {
    const gridSize = grid.length;
    for (let i = 0; i < size; i++) {
        const currentX = isVertical ? x : x + i;
        const currentY = isVertical ? y + i : y;

        // Sprawdzenie, czy pole i jego otoczenie są wolne
        for (let j = -1; j <= 1; j++) {
            for (let k = -1; k <= 1; k++) {
                const checkX = currentX + k;
                const checkY = currentY + j;
                if (checkX >= 0 && checkX < gridSize && checkY >= 0 && checkY < gridSize) {
                    if (typeof grid[checkY][checkX] === 'object') {
                        return false; // Pole lub jego otoczenie jest zajęte
                    }
                }
            }
        }
    }
    return true;
}

/**
 * Renderuje wizualny stan planszy na podstawie siatki danych.
 * @param {string} boardId - ID elementu HTML planszy.
 * @param {Array<Array<string>>} grid - Siatka z danymi o stanie gry.
 */
function renderBoard(boardId, grid) {
    const boardElement = document.getElementById(boardId);
    const cells = boardElement.childNodes;
    const size = grid.length;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = y * size + x;
            const cellState = grid[y][x];
            cells[index].className = 'cell'; // Reset klas
            // Na razie pokazujemy statki bota dla celów deweloperskich
            if (boardId === 'player-board' && typeof cellState === 'object' && cellState !== null) {
                cells[index].classList.add('ship');
                 if (cellState.hit) {
                    cells[index].classList.add('hit');
                }
            }

            // Wizualizacja planszy przeciwnika
            if (boardId === 'opponent-board' && cellState !== 'unknown') {
                cells[index].classList.add(cellState);
            }
        }
    }
}


let botState = 'HUNT'; // Może być 'HUNT' lub 'TARGET'
let targetQueue = []; // Kolejka celów do sprawdzenia w trybie TARGET
let lastShot = null;

/**
 * Główna funkcja tury bota - decyduje gdzie strzelić.
 */
function botTurn() {
    const size = currentConfig.size;
    let x, y;

    if (botState === 'HUNT') {
        // Tryb HUNT: Użyj mapy prawdopodobieństwa
        const probMap = calculateProbabilityMap();
        let maxProb = -1;
        let bestShots = [];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (opponentGrid[r][c] === 'unknown') {
                    if (probMap[r][c] > maxProb) {
                        maxProb = probMap[r][c];
                        bestShots = [{ x: c, y: r }];
                    } else if (probMap[r][c] === maxProb) {
                        bestShots.push({ x: c, y: r });
                    }
                }
            }
        }

        const randomBestShot = bestShots[Math.floor(Math.random() * bestShots.length)];
        x = randomBestShot.x;
        y = randomBestShot.y;

    } else { // botState === 'TARGET'
        // Tryb TARGET: weź następny cel z kolejki
        if (targetQueue.length > 0) {
            const nextTarget = targetQueue.shift();
            x = nextTarget.x;
            y = nextTarget.y;
        } else {
             // Jeśli kolejka jest pusta, wracamy do polowania
            botState = 'HUNT';
            botTurn(); // Wywołaj ponownie, aby znaleźć nowy cel
            return;
        }
    }

    lastShot = { x, y };
    // Aktualizacja UI z sugestią
    document.getElementById('bot-suggestion').textContent = `${String.fromCharCode(65 + y)}${x + 1}`;
    console.log(`Bot sugeruje strzał w: (${x}, ${y})`);
}

/**
 * Aktualizuje stan gry po strzale bota na podstawie odpowiedzi gracza.
 * @param {string} result - Wynik strzału ('Pudło', 'Trafiony', 'Uszkodzony', 'Zatopiony').
 */
function updateAfterBotShot(result) {
    if (!lastShot) return;
    const { x, y } = lastShot;

    const cellElement = document.querySelector(`#opponent-board .cell[data-x='${x}'][data-y='${y}']`);

    switch (result) {
        case 'Pudło':
            opponentGrid[y][x] = 'miss';
            cellElement.classList.add('miss');
            break;
        case 'Trafiony':
            opponentGrid[y][x] = 'hit';
            cellElement.classList.add('hit');
            botState = 'TARGET';
            // Jeśli już jesteśmy w trybie TARGET, próbujemy ustalić orientację statku
            if (targetQueue.length > 0) {
                refineTargetQueue(x, y);
            } else {
                addNeighborsToTargetQueue(x, y);
            }
            break;
        case 'Uszkodzony':
            opponentGrid[y][x] = 'hit';
            cellElement.classList.add('damaged');
            botState = 'TARGET';
            addNeighborsToTargetQueue(x, y);
            break;
        case 'Zatopiony':
            opponentGrid[y][x] = 'sunk';
            cellElement.classList.add('sunk');
            botState = 'HUNT'; // Wracamy do polowania
            targetQueue = []; // Czyścimy kolejkę

            // Pokaż modal do wyboru zatopionego statku
            showSunkShipModal();
            break;
    }
    renderBoard('opponent-board', opponentGrid); // Odśwież widok planszy
}

function addNeighborsToTargetQueue(x, y) {
    const size = currentConfig.size;
    const neighbors = [
        { x: x, y: y - 1 }, { x: x, y: y + 1 },
        { x: x - 1, y: y }, { x: x + 1, y: y }
    ];

    for (const n of neighbors) {
        if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size && opponentGrid[n.y][n.x] === 'unknown') {
            if (!targetQueue.some(t => t.x === n.x && t.y === n.y)) {
                 targetQueue.push(n);
            }
        }
    }
}

/**
 * Po drugim trafieniu, ta funkcja ustala orientację statku i zawęża kolejkę celów.
 */
function refineTargetQueue(x, y) {
    const hits = [];
    for (let r = 0; r < currentConfig.size; r++) {
        for (let c = 0; c < currentConfig.size; c++) {
            if (opponentGrid[r][c] === 'hit') {
                hits.push({x: c, y: r});
            }
        }
    }

    if (hits.length < 2) return; // Potrzebujemy co najmniej dwóch trafień

    const lastHit = {x, y};
    const prevHit = hits.find(h => h.x !== lastHit.x || h.y !== lastHit.y);

    const isVertical = lastHit.x === prevHit.x;
    const isHorizontal = lastHit.y === prevHit.y;

    if (isVertical) {
        targetQueue = targetQueue.filter(t => t.x === x);
        targetQueue.push({x: x, y: y-1}, {x: x, y: y+1});
    } else if (isHorizontal) {
        targetQueue = targetQueue.filter(t => t.y === y);
        targetQueue.push({x: x-1, y: y}, {x: x+1, y: y});
    }

     // Usuń duplikaty i już ostrzelane pola
    const uniqueTargets = [];
    const seen = new Set();
    for (const target of targetQueue) {
        const key = `${target.x},${target.y}`;
        if (!seen.has(key) &&
            target.x >= 0 && target.x < currentConfig.size &&
            target.y >= 0 && target.y < currentConfig.size &&
            opponentGrid[target.y][target.x] === 'unknown') {
            uniqueTargets.push(target);
            seen.add(key);
        }
    }
    targetQueue = uniqueTargets;
}


// Etap 4: Rozbudowa bota do poziomu zaawansowanego
// W tym miejscu pojawią się zaawansowane algorytmy, takie jak mapa prawdopodobieństwa.

// Etap 5: Finalizacja
// Kod do obsługi ekranów startowych/końcowych i ustawień gry.

function showSunkShipModal() {
    const modal = document.getElementById('sunk-ship-modal');
    const optionsContainer = document.getElementById('sunk-ship-options');
    optionsContainer.innerHTML = ''; // Wyczyść stare opcje

    const availableShips = opponentShips.filter(s => s.count > 0);
    for (const ship of availableShips) {
        const button = document.createElement('button');
        button.classList.add('board-size-btn');
        button.textContent = `${ship.name} (${ship.size})`;
        button.dataset.size = ship.size;
        button.addEventListener('click', () => {
            const shipIndex = opponentShips.findIndex(s => s.size === ship.size);
            opponentShips[shipIndex].count--;
            console.log(`Usunięto statek o rozmiarze ${ship.size}. Pozostało:`, opponentShips);
            modal.classList.add('hidden');
            checkWinCondition();
        });
        optionsContainer.appendChild(button);
    }

    modal.classList.remove('hidden');
}

function checkWinCondition() {
    // Sprawdzenie, czy bot wygrał (wszystkie statki przeciwnika zatopione)
    const opponentShipsLeft = opponentShips.reduce((acc, ship) => acc + ship.count, 0);
    if (opponentShipsLeft === 0) {
        showEndScreen('Gratulacje! Wygrałeś razem z botem!');
        return;
    }

    // Sprawdzenie, czy gracz 2 wygrał (wszystkie statki bota zniszczone)
    const playerShipsLeft = playerShips.some(ship => !ship.isSunk);
    if (!playerShipsLeft && playerShips.length > 0) {
        showEndScreen('Niestety, przeciwnik wygrał.');
    }
}

function showEndScreen(message) {
    document.getElementById('game-over-message').textContent = message;
    document.getElementById('end-screen').classList.remove('hidden');
}


function startGame(sizeConfig) {
    console.log(`Rozpoczynanie gry z planszą ${sizeConfig}...`);
    currentConfig = GAME_CONFIGS[sizeConfig];
    document.getElementById('start-screen').classList.add('hidden');

    // Inicjalizacja i generowanie widoku
    createBoard('player-board', currentConfig.size);
    createBoard('opponent-board', currentConfig.size);

    // Inicjalizacja logicznej reprezentacji plansz
    initializeGrids(currentConfig.size);
    placeShipsRandomly(playerGrid, currentConfig.ships);

    // Renderowanie stanu początkowego
    renderBoard('player-board', playerGrid);
    renderBoard('opponent-board', opponentGrid);


    // Dodanie obsługi kliknięć na planszach
    document.getElementById('player-board').addEventListener('click', handlePlayerBoardClick);
    document.getElementById('opponent-board').addEventListener('click', handleOpponentBoardClick);

    // Dodanie obsługi przycisków
    const buttons = {
        'btn-miss': 'Pudło',
        'btn-hit': 'Trafiony',
        'btn-damaged': 'Uszkodzony',
        'btn-sunk': 'Zatopiony'
    };

    for (const [id, action] of Object.entries(buttons)) {
        document.getElementById(id).addEventListener('click', () => {
            console.log(`Gracz 1 raportuje wynik: ${action}`);
            updateAfterBotShot(action); // Zaktualizuj stan gry
            botTurn(); // Rozpocznij kolejną turę bota
        });
    }

    // Rozpoczęcie pierwszej tury bota
    botTurn();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Gra w statki załadowana. Oczekiwanie na wybór gracza...');

    document.querySelectorAll('.board-size-btn').forEach(button => {
        button.addEventListener('click', () => {
            startGame(button.dataset.size);
        });
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        location.reload();
    });
});
