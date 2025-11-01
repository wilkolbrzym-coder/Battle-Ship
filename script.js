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
            { name: 'pięciomasztowiec', size: 5, count: 3 },
            { name: 'czteromasztowiec', size: 4, count: 3 },
            { name: 'trójmasztowiec', size: 3, count: 5 },
            { name: 'dwumasztowiec', size: 2, count: 4 }
        ]
    }
};

let currentConfig = GAME_CONFIGS['10x10'];

/**
 * Tworzy planszę do gry o określonym rozmiarze wraz z koordynatami.
 * @param {string} boardId - ID elementu HTML, w którym ma być plansza.
 * @param {string} topCoordsId - ID kontenera na górne koordynaty.
 * @param {string} leftCoordsId - ID kontenera na lewe koordynaty.
 * @param {number} size - Rozmiar planszy.
 */
function createBoard(boardId, topCoordsId, leftCoordsId, size) {
    const boardElement = document.getElementById(boardId);
    const topCoordsElement = document.getElementById(topCoordsId);
    const leftCoordsElement = document.getElementById(leftCoordsId);

    boardElement.innerHTML = '';
    topCoordsElement.innerHTML = '';
    leftCoordsElement.innerHTML = '';

    boardElement.style.setProperty('--grid-size', size);

    // Generowanie górnych koordynatów (cyfry)
    for (let i = 0; i < size; i++) {
        const coord = document.createElement('div');
        coord.style.width = 'var(--cell-size)';
        coord.style.textAlign = 'center';
        coord.textContent = i + 1;
        topCoordsElement.appendChild(coord);
    }

    // Generowanie lewych koordynatów (litery)
    for (let i = 0; i < size; i++) {
        const coord = document.createElement('div');
        coord.style.height = 'var(--cell-size)';
        coord.style.display = 'flex';
        coord.style.alignItems = 'center';
        coord.style.justifyContent = 'center';
        coord.textContent = String.fromCharCode(65 + i);
        leftCoordsElement.appendChild(coord);
    }

    // Generowanie siatki gry
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

    // Sprawdzenie, czy pole było już ostrzelane
    if ((typeof cellState === 'object' && cellState.hit) || cellState === 'miss') {
        alert("To pole było już ostrzelane!");
        return;
    }

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
 * @param {Array<Array<string>>} grid - Siatka do analizy.
 * @returns {Array<Array<number>>} - Siatka z wartościami prawdopodobieństwa dla każdego pola.
 */
function calculateProbabilityMap(grid) {
    const size = currentConfig.size;
    const finalProbMap = Array(size).fill(null).map(() => Array(size).fill(0));

    const remainingShips = opponentShips.filter(s => s.count > 0);
    if (remainingShips.length === 0) return finalProbMap;

    const smallestShipSize = Math.min(...remainingShips.map(s => s.size));

    // Stwórz osobną mapę gęstości dla każdego typu statku
    for (const shipType of remainingShips) {
        const shipSize = shipType.size;
        const shipProbMap = Array(size).fill(null).map(() => Array(size).fill(0));
        for (let i = 0; i < shipType.count; i++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Poziomo
                    if (x + shipSize <= size && canPlaceShipForProbability(opponentGrid, x, y, shipSize, false)) {
                        for (let k = 0; k < shipSize; k++) shipProbMap[y][x + k]++;
                    }
                    // Pionowo
                    if (y + shipSize <= size && canPlaceShipForProbability(opponentGrid, x, y, shipSize, true)) {
                        for (let k = 0; k < shipSize; k++) shipProbMap[y + k][x]++;
                    }
                }
            }
        }
        // Dodaj mapę tego typu statku do finalnej mapy
        for(let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                finalProbMap[y][x] += shipProbMap[y][x];
            }
        }
    }

    // Zastosuj strategię Parity
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Strzelaj w pola, które pasują do "szachownicy" najmniejszego statku
            if ((x + y) % smallestShipSize !== 0) {
                finalProbMap[y][x] = 0;
            }
        }
    }

    return finalProbMap;
}

/**
 * Sprawdza, czy statek może być teoretycznie umieszczony na planszy przeciwnika.
 * Ignoruje inne 'unknown' pola, ale respektuje 'miss' i 'hit'.
 */
function canPlaceShipForProbability(grid, x, y, size, isVertical) {
    for (let i = 0; i < size; i++) {
        const currentX = isVertical ? x : x + i;
        const currentY = isVertical ? y + i : y;
        if (currentX >= grid.length || currentY >= grid.length || grid[currentY][currentX] === 'miss' || grid[currentY][currentX] === 'sunk') {
            return false; // Nie można umieścić statku na pudle, zatopionym statku lub poza planszą
        }
    }
    return true;
}


/**
 * Oblicza entropię dla hipotetycznej przyszłej siatki.
 */
function calculateEntropyForFutureGrid(shotX, shotY, result) {
    const size = currentConfig.size;
    // Klonowanie głębokie, aby nie modyfikować oryginalnej siatki
    const futureGrid = JSON.parse(JSON.stringify(opponentGrid));
    futureGrid[shotY][shotX] = result;

    // Oblicz przyszłą mapę prawdopodobieństwa
    const futureProbMap = calculateProbabilityMap(futureGrid);

    let totalProbability = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            totalProbability += futureProbMap[y][x];
        }
    }

    if (totalProbability === 0) return 0;

    let entropy = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (futureProbMap[y][x] > 0) {
                const p = futureProbMap[y][x] / totalProbability;
                entropy -= p * Math.log2(p);
            }
        }
    }

    return entropy;
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
 * Tworzy mapę wag, preferującą centrum planszy.
 */
function createWeightMap(size) {
    const weightMap = Array(size).fill(null).map(() => Array(size).fill(0));
    const center = Math.floor(size / 2);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dist = Math.min(Math.abs(x - center), Math.abs(y - center));
            weightMap[y][x] = size - dist;
        }
    }
    return weightMap;
}

/**
 * Rozmieszcza statki strategicznie, używając mapy wag.
 * @param {Array<Array<string>>} grid - Siatka do umieszczenia statków.
 * @param {Array<object>} shipsConfig - Konfiguracja statków do rozmieszczenia.
 */
function placeShipsRandomly(grid, shipsConfig) {
    const size = grid.length;
    let shipIdCounter = 0;
    playerShips = []; // Resetuj listę statków gracza
    const weightMap = createWeightMap(size);

    // Preferencja, aby unikać symetrii
    const preferTop = Math.random() < 0.5;

    // Sortuj statki od największego do najmniejszego
    const sortedShips = shipsConfig.flatMap(s => Array(s.count).fill(s)).sort((a, b) => b.size - a.size);

    for (const shipType of sortedShips) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 200) { // Ogranicznik prób, by uniknąć pętli nieskończonej
            attempts++;
            const isVertical = Math.random() < 0.5;

            // Losuj pozycję z uwzględnieniem wag
            const weightedPositions = [];
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if ((preferTop && y < size / 2) || (!preferTop && y > size / 2)) {
                         weightedPositions.push({x, y, weight: weightMap[y][x] * 2}); // Podwójna waga dla preferowanej połowy
                    } else {
                        weightedPositions.push({x, y, weight: weightMap[y][x]});
                    }
                }
            }
            const totalWeight = weightedPositions.reduce((acc, pos) => acc + pos.weight, 0);
            let random = Math.random() * totalWeight;
            let chosenPos = null;
            for(const pos of weightedPositions) {
                random -= pos.weight;
                if(random <= 0) {
                    chosenPos = pos;
                    break;
                }
            }

            if (!chosenPos || (isVertical ? chosenPos.y + shipType.size > size : chosenPos.x + shipType.size > size)) continue;

            if (canPlaceShip(grid, chosenPos.x, chosenPos.y, shipType.size, isVertical)) {
                const newShip = {
                    id: shipIdCounter++,
                    name: shipType.name,
                    size: shipType.size,
                    positions: [],
                    hits: 0,
                    isSunk: false
                };
                for (let j = 0; j < shipType.size; j++) {
                    const currentX = isVertical ? chosenPos.x : chosenPos.x + j;
                    const currentY = isVertical ? chosenPos.y + j : chosenPos.y;
                    grid[currentY][currentX] = { shipId: newShip.id, hit: false };
                    newShip.positions.push({ x: currentX, y: currentY });
                }
                playerShips.push(newShip);
                placed = true;
            }
        }
        if (!placed) {
            console.error("Nie udało się umieścić statku:", shipType.name);
             // Awaryjne umieszczanie, jeśli strategia zawiedzie
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
let currentTargetHits = []; // Przechowuje trafienia w aktualnie atakowany statek

/**
 * Główna funkcja tury bota - decyduje gdzie strzelić.
 */
let isFirstShot = true;

function botTurn() {
    const size = currentConfig.size;
    let x, y;

    if (isFirstShot) {
        const center = Math.floor(size / 2);
        const options = [
            {x: center, y: center},
            {x: center - 1, y: center},
            {x: center, y: center - 1},
            {x: center - 1, y: center - 1},
        ];
        const choice = options[Math.floor(Math.random() * options.length)];
        x = choice.x;
        y = choice.y;
        isFirstShot = false;
    } else if (botState === 'HUNT') {
        // Nowa, zaawansowana logika z analizą entropii
        const startTime = performance.now();
        const probMap = calculateProbabilityMap(opponentGrid);
        let bestShots = [];
        let maxProb = -1;

        // Znajdź kandydatów do strzału
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (probMap[r][c] > maxProb) {
                    maxProb = probMap[r][c];
                    bestShots = [{ x: c, y: r }];
                } else if (probMap[r][c] === maxProb) {
                    bestShots.push({ x: c, y: r });
                }
            }
        }

        let bestShot = bestShots[Math.floor(Math.random() * bestShots.length)];
        let minEntropy = Infinity;

        // Analiza entropii dla najlepszych kandydatów
        for (const shot of bestShots) {
            if (performance.now() - startTime > 4800) { // Limit 4.8s
                console.log("Przekroczono czas analizy entropii, wybieram najlepszy dotychczasowy strzał.");
                break;
            }

            // Symulacja trafienia
            const futureEntropyHit = calculateEntropyForFutureGrid(shot.x, shot.y, 'hit');
            // Symulacja pudła
            const futureEntropyMiss = calculateEntropyForFutureGrid(shot.x, shot.y, 'miss');

            const p_hit = probMap[shot.y][shot.x] / (size*size); // Uproszczone prawdopodobieństwo
            const p_miss = 1 - p_hit;
            const expectedEntropy = p_hit * futureEntropyHit + p_miss * futureEntropyMiss;

            if (expectedEntropy < minEntropy) {
                minEntropy = expectedEntropy;
                bestShot = shot;
            }
        }

        x = bestShot.x;
        y = bestShot.y;

    } else { // botState === 'TARGET'
        generateTargetQueue();
        if (targetQueue.length > 0) {
            const nextTarget = targetQueue.shift();
            x = nextTarget.x;
            y = nextTarget.y;
        } else {
             // Jeśli kolejka jest pusta (co nie powinno się zdarzyć, ale na wszelki wypadek)
            botState = 'HUNT';
            botTurn();
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
        case 'Uszkodzony':
            opponentGrid[y][x] = 'hit';
            cellElement.classList.add(result === 'Trafiony' ? 'hit' : 'damaged');
            botState = 'TARGET';
            currentTargetHits.push({ x, y });
            // Generowanie nowych celów zostanie obsłużone w botTurn
            break;
        case 'Zatopiony':
            opponentGrid[y][x] = 'sunk';
            cellElement.classList.add('sunk');
            currentTargetHits.push({ x, y });
            markSurroundingAsMiss(currentTargetHits);

            // Reset stanu bota
            botState = 'HUNT';
            targetQueue = [];

            // Zanim wyczyścimy, zidentyfikujmy statek
            const identificationSuccess = identifySunkShip(x, y);
            currentTargetHits = [];

            if (identificationSuccess) {
                 checkWinCondition();
            } else {
                // Jeśli identyfikacja się nie powiodła, nie kończymy tury bota,
                // aby gracz mógł poprawić swój błąd.
                botState = 'TARGET'; // Pozostań w trybie TARGET
                return; // Zatrzymaj dalsze wykonywanie
            }
            break;
    }
    renderBoard('opponent-board', opponentGrid); // Odśwież widok planszy
}

/**
 * Generuje kolejkę celów w trybie TARGET.
 */
function generateTargetQueue() {
    targetQueue = [];
    const size = currentConfig.size;

    const isValidTarget = (x, y) => {
        return x >= 0 && x < size && y >= 0 && y < size && opponentGrid[y][x] === 'unknown';
    };

    if (currentTargetHits.length === 1) {
        const { x, y } = currentTargetHits[0];
        // Dodaj 4 sąsiadów
        [{x:x, y:y-1}, {x:x, y:y+1}, {x:x-1, y:y}, {x:x+1, y:y}].forEach(t => {
            if(isValidTarget(t.x, t.y)) targetQueue.push(t);
        });
    } else {
        // Ustal orientację i dodaj cele na końcach
        currentTargetHits.sort((a, b) => a.x - b.x || a.y - b.y);
        const firstHit = currentTargetHits[0];
        const lastHit = currentTargetHits[currentTargetHits.length - 1];
        const isVertical = firstHit.x === lastHit.x;

        if (isVertical) {
            if (isValidTarget(firstHit.x, firstHit.y - 1)) targetQueue.push({ x: firstHit.x, y: firstHit.y - 1 });
            if (isValidTarget(lastHit.x, lastHit.y + 1)) targetQueue.push({ x: lastHit.x, y: lastHit.y + 1 });
        } else { // Poziomo
            if (isValidTarget(firstHit.x - 1, firstHit.y)) targetQueue.push({ x: firstHit.x - 1, y: firstHit.y });
            if (isValidTarget(lastHit.x + 1, lastHit.y)) targetQueue.push({ x: lastHit.x + 1, y: lastHit.y });
        }
    }
}

/**
 * Po zatopieniu statku, oznacza otaczające go pola jako 'miss'.
 * @param {Array<{x: number, y: number}>} shipPositions - Pozycje zatopionego statku.
 */
function markSurroundingAsMiss(shipPositions) {
    const size = currentConfig.size;
    shipPositions.forEach(pos => {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const newX = pos.x + dx;
                const newY = pos.y + dy;
                if (newX >= 0 && newX < size && newY >= 0 && newY < size && opponentGrid[newY][newX] === 'unknown') {
                    opponentGrid[newY][newX] = 'miss';
                }
            }
        }
    });
}


// Etap 4: Rozbudowa bota do poziomu zaawansowanego
// W tym miejscu pojawią się zaawansowane algorytmy, takie jak mapa prawdopodobieństwa.

// Etap 5: Finalizacja
// Kod do obsługi ekranów startowych/końcowych i ustawień gry.

/**
 * Automatycznie identyfikuje zatopiony statek na podstawie ostatniego trafienia.
 * @param {number} x - Współrzędna X ostatniego trafienia.
 * @param {number} y - Współrzędna Y ostatniego trafienia.
 */
function identifySunkShip(x, y) {
    const size = currentConfig.size;
    const q = [{x, y}];
    const visited = new Set([`${x},${y}`]);
    const shipParts = [{x, y}]; // Ostatni strzał to też część statku

    // Zbierz wszystkie połączone 'hit'
    while (q.length > 0) {
        const current = q.shift();
        const neighbors = [{x:current.x+1, y:current.y}, {x:current.x-1, y:current.y}, {x:current.x, y:current.y+1}, {x:current.x, y:current.y-1}];
        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size && !visited.has(key) && opponentGrid[n.y][n.x] === 'hit') {
                visited.add(key);
                q.push(n);
                shipParts.push(n);
            }
        }
    }

    const sunkShipSize = shipParts.length;
    const shipIndex = opponentShips.findIndex(s => s.size === sunkShipSize && s.count > 0);

    if (shipIndex !== -1) {
        opponentShips[shipIndex].count--;
        console.log(`Bot automatycznie zidentyfikował i usunął statek o rozmiarze ${sunkShipSize}.`);
        return true;
    } else {
        alert(`Błąd: Zgłoszono zatopienie, ale nie ma już dostępnych statków o rozmiarze ${sunkShipSize}! Sprawdź planszę przeciwnika.`);
        // Przywróćmy stan 'hit', aby umożliwić kontynuację lub korektę
        shipParts.forEach(part => opponentGrid[part.y][part.x] = 'hit');
        return false;
    }
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
    document.getElementById('shot-input-container').classList.remove('hidden');

    // Inicjalizacja i generowanie widoku
    createBoard('player-board', 'player-coords-top', 'player-coords-left', currentConfig.size);
    createBoard('opponent-board', 'opponent-coords-top', 'opponent-coords-left', currentConfig.size);

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

    const shotInput = document.getElementById('shot-input');
    const submitShotBtn = document.getElementById('submit-shot-btn');

    const handleSubmitShot = () => {
        const value = shotInput.value.trim().toUpperCase();
        if (!value) return;

        const letter = value.charAt(0);
        const number = parseInt(value.substring(1), 10);

        if (letter >= 'A' && letter <= String.fromCharCode(65 + currentConfig.size - 1) && number >= 1 && number <= currentConfig.size) {
            const y = letter.charCodeAt(0) - 65;
            const x = number - 1;
            const cell = document.querySelector(`#player-board .cell[data-x='${x}'][data-y='${y}']`);
            if (cell) {
                cell.click();
                shotInput.value = ''; // Wyczyść pole po strzale
            }
        } else {
            alert("Nieprawidłowe koordynaty. Wpisz np. 'A5'.");
        }
    };

    submitShotBtn.addEventListener('click', handleSubmitShot);
    shotInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            handleSubmitShot();
        }
    });
});
