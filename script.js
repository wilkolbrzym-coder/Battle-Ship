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
        triggerAnimation(cell, 'animate-hit', 500);
        const ship = playerShips.find(s => s.id === cellState.shipId);
        ship.hits++;

        if (ship.hits === ship.size) {
            ship.isSunk = true;
        }

        if (ship.isSunk) {
            setTimeout(() => {
                ship.positions.forEach(pos => {
                    const sunkCell = document.querySelector(`#player-board .cell[data-x='${pos.x}'][data-y='${pos.y}']`);
                    if(sunkCell) {
                        sunkCell.classList.remove('hit');
                        sunkCell.classList.add('sunk');
                        triggerAnimation(sunkCell, 'animate-sunk', 600);
                    }
                });
            }, 550);
        }

        cell.classList.add('hit');
        checkWinCondition();
    } else if (cellState === 'water') {
        // Pudło
        playerGrid[y][x] = 'miss';
        triggerAnimation(cell, 'animate-miss', 400);
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
// #                       NOWY INTERFEJS                           #
// ##################################################################

let turnCounter = 1;


// ##################################################################
// #           RDZEŃ AI - ŁOWCA KWANTOWY                            #
// ##################################################################

let allPossibleOpponentLayouts = []; // Globalna tablica przechowująca "możliwe rzeczywistości"

/**
 * Inicjalizuje Łowcę Kwantowego, generując początkowy zbiór możliwych układów planszy przeciwnika.
 */
function initializeQuantumHunter() {
    console.log("AI: Inicjalizacja Silnika 'Możliwych Rzeczywistości'...");
    const size = currentConfig.size;
    const shipsConfig = currentConfig.ships;
    const maxLayouts = 5000; // Ograniczenie, aby uniknąć problemów z wydajnością

    allPossibleOpponentLayouts = [];
    let attempts = 0;

    while(allPossibleOpponentLayouts.length < maxLayouts && attempts < maxLayouts * 10) {
        attempts++;
        const newLayout = generateRandomValidLayout(size, shipsConfig);
        if (newLayout) {
            allPossibleOpponentLayouts.push(newLayout);
        }
    }
    console.log(`AI: Wygenerowano ${allPossibleOpponentLayouts.length} możliwych rzeczywistości. Gotów do polowania.`);
}

/**
 * Generuje pojedynczy, losowy, ale w pełni prawidłowy układ statków.
 * @param {number} size - Rozmiar planszy.
 * @param {Array<object>} shipsConfig - Konfiguracja statków.
 * @returns {Array<Array<string>>|null} - Siatka z układem lub null, jeśli się nie udało.
 */
function generateRandomValidLayout(size, shipsConfig) {
    const grid = Array(size).fill(null).map(() => Array(size).fill('water'));
    const shipsToPlace = shipsConfig.flatMap(s => Array(s.count).fill(s.size)).sort((a, b) => b - a);

    for (const shipSize of shipsToPlace) {
        let placed = false;
        let placementAttempts = 0;
        while (!placed && placementAttempts < 200) {
            placementAttempts++;
            const isVertical = Math.random() < 0.5;
            const x = Math.floor(Math.random() * (isVertical ? size : size - shipSize + 1));
            const y = Math.floor(Math.random() * (isVertical ? size - shipSize + 1 : size));

            if (canPlaceShip(grid, x, y, shipSize, isVertical)) {
                for (let j = 0; j < shipSize; j++) {
                    const currentX = isVertical ? x : x + j;
                    const currentY = isVertical ? y + j : y;
                    grid[currentY][currentX] = 'ship';
                }
                placed = true;
            }
        }
        if (!placed) return null; // Nie udało się umieścić statku, układ jest nieważny
    }
    return grid;
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

    // Dynamiczna Analiza Parzystości
    const dynamicSmallestShip = Math.min(...opponentShips.filter(s => s.count > 0).map(s => s.size));
    if (dynamicSmallestShip && dynamicSmallestShip !== Infinity) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Strzelaj w pola, które pasują do "szachownicy" NAJMNIEJSZEGO POZOSTAŁEGO statku
                if ((x + y) % dynamicSmallestShip !== 0) {
                    finalProbMap[y][x] *= 0.1; // Zamiast zerować, mocno redukuj wagę
                }
            }
        }
    }

    return finalProbMap;
}

/**
 * Oblicza mapę Wartości Informacji (Value of Information).
 * Komórki, które dają więcej informacji (np. wykluczają więcej możliwych położeń statków),
 * otrzymują wyższy wynik.
 * @param {Array<Array<number>>} probMap - Mapa prawdopodobieństwa.
 * @param {Array<Array<string>>} grid - Siatka gry.
 * @returns {Array<Array<number>>} - Mapa z wartościami VoI.
 */
function calculateVoIMap(probMap, grid) {
    const size = grid.length;
    const voiMap = Array(size).fill(null).map(() => Array(size).fill(0));
    const remainingShips = opponentShips.filter(s => s.count > 0);
    if (remainingShips.length === 0) return voiMap;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (grid[y][x] === 'unknown') {
                // Podstawowym czynnikiem jest prawdopodobieństwo
                let informationValue = probMap[y][x];

                // Dodatkowy bonus za "przecinanie" możliwych długich statków
                for (const shipType of remainingShips) {
                    const shipSize = shipType.size;
                    // Sprawdź, ile potencjalnych umiejscowień statków "przechodzi" przez to pole
                    // Poziomo
                    for (let i = 0; i < shipSize; i++) {
                        if (canPlaceShipForProbability(grid, x - i, y, shipSize, false)) {
                            informationValue += 1;
                        }
                    }
                    // Pionowo
                    for (let i = 0; i < shipSize; i++) {
                        if (canPlaceShipForProbability(grid, x, y - i, shipSize, true)) {
                            informationValue += 1;
                        }
                    }
                }
                voiMap[y][x] = informationValue;
            }
        }
    }
    return voiMap;
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


// Moduł "Psychoanalizy Przeciwnika"
const opponentProfile = {
    placementBias: { edge: 0, center: 0, corner: 0 },
    orientationBias: { vertical: 0, horizontal: 0 }
};

/**
 * Aktualizuje profil przeciwnika na podstawie zatopionego statku.
 */
function updateOpponentProfile(ship) {
    // Prosta logika do demonstracji
    const size = currentConfig.size;
    const isVertical = ship.positions[0].x === ship.positions[1].x;
    if (isVertical) opponentProfile.orientationBias.vertical++;
    else opponentProfile.orientationBias.horizontal++;

    ship.positions.forEach(pos => {
        if (pos.x === 0 || pos.x === size - 1 || pos.y === 0 || pos.y === size - 1) {
            opponentProfile.placementBias.edge++;
        } else {
            opponentProfile.placementBias.center++;
        }
    });
}


// ##################################################################
// #                           ETAP 3                             #
// ##################################################################

let playerGrid; // Tablica 2D dla statków gracza/bota
let playerShips = []; // Lista obiektów statków gracza
let opponentGrid; // Tablica 2D dla planszy przeciwnika
let opponentShips; // Lista statków przeciwnika do zatopienia
let history = []; // Historia stanów gry do cofania ruchów

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

// ##################################################################
// #            EWOLUCJA ROZSTAWIANIA - ARCHITEKT GENETYCZNY        #
// ##################################################################

function placeShipsRandomly(grid, shipsConfig) {
    console.log("AI: Uruchamiam Architekta Genetycznego do zaprojektowania układu floty...");
    const size = grid.length;
    const populationSize = 50;
    const generations = 30;
    const mutationRate = 0.1;
    const elitismRate = 0.1;

    // 1. Inicjalizacja populacji
    let population = [];
    for (let i = 0; i < populationSize; i++) {
        population.push(createRandomIndividual(grid, shipsConfig));
    }

    for (let gen = 0; gen < generations; gen++) {
        // 2. Ewaluacja
        const fitnessScores = population.map(ind => ({ individual: ind, fitness: calculateFitness(ind, size) }));
        fitnessScores.sort((a, b) => b.fitness - a.fitness);

        const newPopulation = [];

        // 3. Elityzm
        const eliteCount = Math.floor(populationSize * elitismRate);
        for (let i = 0; i < eliteCount; i++) {
            newPopulation.push(fitnessScores[i].individual);
        }

        // 4. Selekcja, Krzyżowanie i Mutacja
        while (newPopulation.length < populationSize) {
            const parent1 = tournamentSelection(fitnessScores);
            const parent2 = tournamentSelection(fitnessScores);
            let child = crossover(parent1, parent2, grid, shipsConfig);
            if (Math.random() < mutationRate) {
                child = mutate(child, grid, shipsConfig);
            }
            newPopulation.push(child);
        }
        population = newPopulation;
         console.log(`Generacja ${gen + 1}/${generations}, Najlepszy wynik: ${fitnessScores[0].fitness.toFixed(2)}`);
    }

    const fitnessScores = population.map(ind => ({ individual: ind, fitness: calculateFitness(ind, size) }));
    fitnessScores.sort((a, b) => b.fitness - a.fitness);
    const bestIndividual = fitnessScores[0].individual;

    console.log(`AI: Projekt floty ukończony z optymalnym wynikiem ${fitnessScores[0].fitness.toFixed(2)}.`);
    applyIndividualToGrid(bestIndividual, grid);
}

// Tworzy pojedynczego osobnika (losowy układ statków)
function createRandomIndividual(grid, shipsConfig) {
    const size = grid.length;
    const individual = [];
    const tempGrid = Array(size).fill(null).map(() => Array(size).fill('water'));
    const sortedShips = shipsConfig.flatMap(s => Array(s.count).fill(s)).sort((a, b) => b.size - a.size);

    sortedShips.forEach(shipType => {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 200) {
            attempts++;
            const isVertical = Math.random() < 0.5;
            const x = Math.floor(Math.random() * (isVertical ? size : size - shipType.size + 1));
            const y = Math.floor(Math.random() * (isVertical ? size - shipType.size + 1 : size));

            if (canPlaceShip(tempGrid, x, y, shipType.size, isVertical)) {
                const newShip = { name: shipType.name, size: shipType.size, positions: [] };
                for (let j = 0; j < shipType.size; j++) {
                    const currentX = isVertical ? x : x + j;
                    const currentY = isVertical ? y + j : y;
                    tempGrid[currentY][currentX] = 'ship';
                    newShip.positions.push({ x: currentX, y: currentY });
                }
                individual.push(newShip);
                placed = true;
            }
        }
    });
    return individual;
}

// Ocenia jakość osobnika ("Wielki Architekt Pola Bitwy")
function calculateFitness(individual, size) {
    if (individual.length === 0) return -Infinity; // Kara za niekompletne układy

    const parityResistanceScore = calculateParityResistance(individual, size);
    const ambiguityScore = calculateAmbiguity(individual, size);
    const balanceScore = calculateBalance(individual, size);

    // Nadaj wagi poszczególnym kryteriom, aby ustalić priorytety strategiczne
    const finalScore = (parityResistanceScore * 0.4) + (ambiguityScore * 0.4) + (balanceScore * 0.2);

    return finalScore;
}

/**
 * Oblicza odporność układu na atak strategią parzystości.
 * @param {Array<object>} individual - Układ statków.
 * @param {number} size - Rozmiar planszy.
 * @returns {number} - Wynik odporności.
 */
function calculateParityResistance(individual, size) {
    const grid = Array(size).fill(null).map(() => Array(size).fill('water'));
    individual.forEach(ship => ship.positions.forEach(pos => grid[pos.y][pos.x] = 'ship'));

    let shotsNeeded = 0;
    const parity = 2; // Najbardziej uniwersalny i powszechny przypadek ataku
    const hitShips = new Set();

    for (let p = 0; p < parity; p++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if ((x + y) % parity === p) {
                    shotsNeeded++;
                    if (grid[y][x] === 'ship') {
                        // Znajdź statek, który został trafiony
                        const hitShip = individual.find(ship => ship.positions.some(pos => pos.x === x && pos.y === y));
                        if (hitShip) {
                            hitShips.add(hitShip);
                        }
                    }
                    if (hitShips.size === individual.length) {
                        // Znormalizuj wynik: im więcej strzałów, tym lepiej.
                        return shotsNeeded / (size * size);
                    }
                }
            }
        }
    }
    // Jeśli z jakiegoś powodu nie wszystkie statki zostały trafione (co nie powinno się zdarzyć)
    return shotsNeeded / (size * size);
}

/**
 * Oblicza, jak bardzo niejednoznaczny i "mylący" jest układ.
 * @param {Array<object>} individual - Układ statków.
 * @param {number} size - Rozmiar planszy.
 * @returns {number} - Wynik niejednoznaczności.
 */
function calculateAmbiguity(individual, size) {
    let touchPoints = 0;
    const grid = Array(size).fill(null).map(() => Array(size).fill(false));
    individual.forEach(ship => ship.positions.forEach(pos => grid[pos.y][pos.x] = true));

    individual.forEach(ship => {
        ship.positions.forEach(pos => {
            // Sprawdź sąsiadów w odległości 2 pól (szukamy bliskich, ale nie dotykających się statków)
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue; // Pomiń bezpośrednich sąsiadów

                    const checkX = pos.x + dx;
                    const checkY = pos.y + dy;

                    if (checkX >= 0 && checkX < size && checkY >= 0 && checkY < size && grid[checkY][checkX]) {
                        touchPoints++;
                    }
                }
            }
        });
    });

    // Normalizuj wynik - im więcej "bliskich kontaktów", tym lepiej
    const totalPossibleTouchPoints = individual.reduce((acc, ship) => acc + ship.size, 0) * 16; // 16 to liczba pól w "otoczce" 5x5 minus 9 w centrum
    return touchPoints / totalPossibleTouchPoints;
}

/**
 * Oblicza strategiczną równowagę układu na planszy.
 * @param {Array<object>} individual - Układ statków.
 * @param {number} size - Rozmiar planszy.
 * @returns {number} - Wynik równowagi.
 */
function calculateBalance(individual, size) {
    const allPositions = individual.flatMap(ship => ship.positions);
    if (allPositions.length === 0) return 0;

    const centerX = (size - 1) / 2;
    const centerY = (size - 1) / 2;

    // Oblicz środek ciężkości floty
    const fleetCenterX = allPositions.reduce((acc, pos) => acc + pos.x, 0) / allPositions.length;
    const fleetCenterY = allPositions.reduce((acc, pos) => acc + pos.y, 0) / allPositions.length;

    // Oblicz, jak blisko środek ciężkości floty jest do idealnego centrum planszy
    const centerProximity = 1 - (Math.hypot(fleetCenterX - centerX, fleetCenterY - centerY) / Math.hypot(centerX, centerY));

    // Oblicz wariancję odległości statków od środka ciężkości floty (jak bardzo są rozproszone)
    const distances = allPositions.map(pos => Math.hypot(pos.x - fleetCenterX, pos.y - fleetCenterY));
    const meanDistance = distances.reduce((acc, d) => acc + d, 0) / distances.length;
    const variance = distances.reduce((acc, d) => acc + Math.pow(d - meanDistance, 2), 0) / distances.length;

    // Chcemy dużej wariancji (rozproszenia) i bliskości do centrum.
    // Normalizuj wariancję. Max wariancja to odległość rogu od centrum, czyli (size/2)^2.
    const maxVariance = Math.pow(size / 2, 2);
    const normalizedVariance = variance / maxVariance;

    return (centerProximity * 0.3) + (normalizedVariance * 0.7);
}


// Selekcja turniejowa
function tournamentSelection(fitnessScores, k = 5) {
    let best = null;
    for (let i = 0; i < k; i++) {
        const random = fitnessScores[Math.floor(Math.random() * fitnessScores.length)];
        if (best === null || random.fitness > best.fitness) {
            best = random;
        }
    }
    return best.individual;
}

// Krzyżowanie
function crossover(parent1, parent2, grid, shipsConfig) {
    const child = [];
    const size = grid.length;
    const tempGrid = Array(size).fill(null).map(() => Array(size).fill('water'));
    const shipsToPlace = JSON.parse(JSON.stringify(shipsConfig.flatMap(s => Array(s.count).fill(s)).sort((a, b) => b.size - a.size)));

    // Próba skopiowania genów (statków) naprzemiennie od rodziców
    for (let i = 0; i < parent1.length; i++) {
        const parent = i % 2 === 0 ? parent1 : parent2;
        const shipToCopy = parent[i];
         if (shipToCopy) {
            const shipTypeIndex = shipsToPlace.findIndex(s => s.size === shipToCopy.size);
            if (shipTypeIndex !== -1) {
                const firstPos = shipToCopy.positions[0];
                const isVertical = shipToCopy.positions.length > 1 && shipToCopy.positions[1].x === firstPos.x;
                if (canPlaceShip(tempGrid, firstPos.x, firstPos.y, shipToCopy.size, isVertical)) {
                    const newShip = { name: shipToCopy.name, size: shipToCopy.size, positions: [] };
                    for (let j = 0; j < shipToCopy.size; j++) {
                        const currentX = isVertical ? firstPos.x : firstPos.x + j;
                        const currentY = isVertical ? firstPos.y + j : firstPos.y;
                        tempGrid[currentY][currentX] = 'ship';
                        newShip.positions.push({ x: currentX, y: currentY });
                    }
                    child.push(newShip);
                    shipsToPlace.splice(shipTypeIndex, 1);
                }
            }
        }
    }

    // Uzupełnienie brakujących statków losowo
    shipsToPlace.forEach(shipType => {
        let placed = false;
        let attempts = 0;
        while(!placed && attempts < 100){
            attempts++;
            const isVertical = Math.random() < 0.5;
            const x = Math.floor(Math.random() * (isVertical ? size : size - shipType.size + 1));
            const y = Math.floor(Math.random() * (isVertical ? size - shipType.size + 1 : size));
            if(canPlaceShip(tempGrid, x, y, shipType.size, isVertical)){
                 const newShip = { name: shipType.name, size: shipType.size, positions: [] };
                 for (let j = 0; j < shipType.size; j++) {
                    const currentX = isVertical ? x : x + j;
                    const currentY = isVertical ? y + j : y;
                    tempGrid[currentY][currentX] = 'ship';
                    newShip.positions.push({ x: currentX, y: currentY });
                }
                child.push(newShip);
                placed = true;
            }
        }
    });

    return child;
}

// Mutacja
function mutate(individual, grid, shipsConfig) {
    const mutatedIndividual = JSON.parse(JSON.stringify(individual));
    const shipIndexToMutate = Math.floor(Math.random() * mutatedIndividual.length);

    // Usuń stary statek i spróbuj umieścić go w nowym miejscu
    const shipToMutate = mutatedIndividual.splice(shipIndexToMutate, 1)[0];

    const size = grid.length;
    const tempGrid = Array(size).fill(null).map(() => Array(size).fill('water'));
    mutatedIndividual.forEach(ship => ship.positions.forEach(pos => tempGrid[pos.y][pos.x] = 'ship'));

     let placed = false;
     let attempts = 0;
     while(!placed && attempts < 100){
        attempts++;
        const isVertical = Math.random() < 0.5;
        const x = Math.floor(Math.random() * (isVertical ? size : size - shipToMutate.size + 1));
        const y = Math.floor(Math.random() * (isVertical ? size - shipToMutate.size + 1 : size));
        if(canPlaceShip(tempGrid, x, y, shipToMutate.size, isVertical)){
            const newShip = { name: shipToMutate.name, size: shipToMutate.size, positions: [] };
            for (let j = 0; j < shipToMutate.size; j++) {
                const currentX = isVertical ? x : x + j;
                const currentY = isVertical ? y + j : y;
                newShip.positions.push({ x: currentX, y: currentY });
            }
            mutatedIndividual.push(newShip);
            placed = true;
        }
    }
    // Jeśli nie uda się umieścić, przywróć oryginał, aby uniknąć niekompletnych układów
    if(!placed) return individual;

    return mutatedIndividual;
}

function applyIndividualToGrid(individual, grid) {
    let shipIdCounter = 0;
    playerShips = [];
    individual.forEach(shipData => {
        const newShip = {
            id: shipIdCounter++,
            name: shipData.name,
            size: shipData.size,
            positions: shipData.positions,
            hits: 0,
            isSunk: false
        };
        newShip.positions.forEach(pos => {
            grid[pos.y][pos.x] = { shipId: newShip.id, hit: false };
        });
        playerShips.push(newShip);
    });
}

/**
 * Sprawdza, czy statek może być umieszczony w danym miejscu.
 */
function canPlaceShip(grid, x, y, size, isVertical) {
    const gridSize = grid.length;
    // Sprawdzenie granic planszy
    if ((isVertical && y + size > gridSize) || (!isVertical && x + size > gridSize)) {
        return false;
    }

    for (let i = 0; i < size; i++) {
        const currentX = isVertical ? x : x + i;
        const currentY = isVertical ? y + i : y;

        // Sprawdzenie otoczenia 3x3
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkX = currentX + dx;
                const checkY = currentY + dy;

                if (checkX >= 0 && checkX < gridSize && checkY >= 0 && checkY < gridSize) {
                    const cell = grid[checkY][checkX];
                    if (cell !== 'water') {
                        // Musimy sprawdzić, czy ta "zajęta" komórka nie jest częścią statku, który właśnie próbujemy umieścić
                        // To jest skomplikowane w tej pętli. Prostszy sposób:
                        // Logika jest błędna, bo sprawdza komórki, na których statek ma dopiero stanąć.
                    }
                }
            }
        }
    }
    // Prawidłowa, uproszczona logika
    for (let i = 0; i < size; i++) {
        const currentX = isVertical ? x : x + i;
        const currentY = isVertical ? y + i : y;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkX = currentX + dx;
                const checkY = currentY + dy;

                if (checkX >= 0 && checkX < gridSize && checkY >= 0 && checkY < gridSize) {
                    const cell = grid[checkY][checkX];
                     if (cell === 'ship' || typeof cell === 'object') {
                        return false;
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
            const cellElement = cells[index];

            // Czyszczenie starych klas sugestii
            cellElement.className = 'cell';

            if (boardId === 'player-board') {
                if (typeof cellState === 'object' && cellState !== null) {
                    cellElement.classList.add('ship');
                    if (cellState.hit) {
                        cellElement.classList.add('hit');
                    }
                }
            } else if (boardId === 'opponent-board') {
                if (cellState !== 'unknown') {
                    cellElement.classList.add(cellState);
                }
            }
        }
    }
}


let botState = 'HUNT'; // Może być 'HUNT' lub 'TARGET'
let targetQueue = []; // Kolejka celów do sprawdzenia w trybie TARGET
let lastShot = null;
let currentTargetHits = []; // Przechowuje trafienia w aktualnie atakowany statek

// ##################################################################
// #           ULEPSZENIE DEDUKCJI - TRYB "SHERLOCK HOLMES"         #
// ##################################################################

/**
 * Identyfikuje na planszy izolowane, nieodkryte obszary ("kieszenie").
 * @param {Array<Array<string>>} grid - Siatka gry.
 * @returns {Array<Array<{x: number, y: number}>>} - Tablica kieszeni.
 */
function findPockets(grid) {
    const size = grid.length;
    const visited = Array(size).fill(null).map(() => Array(size).fill(false));
    const pockets = [];

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (grid[y][x] === 'unknown' && !visited[y][x]) {
                const newPocket = [];
                const q = [{x, y}];
                visited[y][x] = true;

                while (q.length > 0) {
                    const cell = q.shift();
                    newPocket.push(cell);
                    const neighbors = [{x:cell.x+1, y:cell.y}, {x:cell.x-1, y:cell.y}, {x:cell.x, y:cell.y+1}, {x:cell.x, y:cell.y-1}];
                    for (const n of neighbors) {
                        if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size && grid[n.y][n.x] === 'unknown' && !visited[n.y][n.x]) {
                            visited[n.y][n.x] = true;
                            q.push(n);
                        }
                    }
                }
                pockets.push(newPocket);
            }
        }
    }
    return pockets;
}

/**
 * Znajduje wszystkie unikalne kombinacje statków, które sumują się do danego rozmiaru.
 * @param {number} targetSize - Docelowy rozmiar (wielkość kieszeni).
 * @param {Array<number>} availableShips - Lista rozmiarów dostępnych statków.
 * @returns {Array<Array<number>>} - Tablica kombinacji.
 */
function findShipCombinationsThatFit(targetSize, availableShips) {
    const results = [];
    function find(target, startIndex, currentCombination) {
        if (target === 0) {
            results.push([...currentCombination]);
            return;
        }
        if (target < 0) return;

        for (let i = startIndex; i < availableShips.length; i++) {
            if (i > startIndex && availableShips[i] === availableShips[i-1]) continue; // Unikaj duplikatów
            currentCombination.push(availableShips[i]);
            find(target - availableShips[i], i + 1, currentCombination);
            currentCombination.pop(); // backtrack
        }
    }
    find(targetSize, 0, []);
    return results;
}

/**
 * Rekursywnie próbuje umieścić dany zestaw statków w kieszeni, aby znaleźć wszystkie możliwe układy.
 * @param {Array<{x: number, y: number}>} pocket - Współrzędne komórek kieszeni.
 * @param {Array<number>} shipsToPlace - Rozmiary statków do umieszczenia.
 * @param {Array<object>} solutions - Tablica, do której zostaną dodane znalezione rozwiązania.
 */
function solvePlacement(pocket, shipsToPlace, solutions) {
    const minX = Math.min(...pocket.map(p => p.x));
    const minY = Math.min(...pocket.map(p => p.y));
    const localGridW = Math.max(...pocket.map(p => p.x)) - minX + 1;
    const localGridH = Math.max(...pocket.map(p => p.y)) - minY + 1;
    const localGrid = Array(localGridH).fill(null).map(() => Array(localGridW).fill(false));
    pocket.forEach(cell => { localGrid[cell.y - minY][cell.x - minX] = true; });

    function canPlace(x, y, size, isVertical, grid) {
        for (let i = 0; i < size; i++) {
            const lx = isVertical ? x : x + i;
            const ly = isVertical ? y : y + i;
            if (lx >= localGridW || ly >= localGridH || !grid[ly][lx]) return false;
        }
        return true;
    }

    function backtrack(shipIndex, gridState, placedShips) {
        if (solutions.length > 1) return;
        if (shipIndex === shipsToPlace.length) {
            solutions.push(JSON.parse(JSON.stringify(placedShips)));
            return;
        }
        const shipSize = shipsToPlace[shipIndex];
        for (let r = 0; r < localGridH; r++) {
            for (let c = 0; c < localGridW; c++) {
                if (canPlace(c, r, shipSize, false, gridState)) {
                    const newGridState = JSON.parse(JSON.stringify(gridState));
                    const positions = [];
                    for (let i = 0; i < shipSize; i++) {
                        newGridState[r][c + i] = false;
                        positions.push({ x: c + minX, y: r + minY });
                    }
                    placedShips.push({ size: shipSize, positions });
                    backtrack(shipIndex + 1, newGridState, placedShips);
                    placedShips.pop();
                    if (solutions.length > 1) return;
                }
                if (shipSize > 1 && canPlace(c, r, shipSize, true, gridState)) {
                    const newGridState = JSON.parse(JSON.stringify(gridState));
                    const positions = [];
                    for (let i = 0; i < shipSize; i++) {
                        newGridState[r + i][c] = false;
                        positions.push({ x: c + minX, y: r + i + minY });
                    }
                    placedShips.push({ size: shipSize, positions });
                    backtrack(shipIndex + 1, newGridState, placedShips);
                    placedShips.pop();
                    if (solutions.length > 1) return;
                }
            }
        }
    }
    backtrack(0, localGrid, []);
}

/**
 * Główna funkcja dedukcyjna, która szuka gwarantowanych trafień poprzez analizę kieszeni.
 */
function findGuaranteedHit() {
    const remainingShips = opponentShips.flatMap(s => Array(s.count).fill(s.size)).sort((a, b) => b - a);
    if (remainingShips.length === 0) return null;

    const pockets = findPockets(opponentGrid);
    const totalUnknown = pockets.reduce((acc, p) => acc + p.length, 0);
    const totalShipSize = remainingShips.reduce((acc, s) => acc + s, 0);

    // Warunek konieczny: analiza jest możliwa tylko jeśli wszystkie pozostałe puste pola muszą być statkami.
    if (totalUnknown !== totalShipSize) return null;

    console.log("AI: Uruchamiam tryb dedukcji 'Sherlock Holmes'...");

    for (const pocket of pockets) {
        const fittingCombinations = findShipCombinationsThatFit(pocket.length, remainingShips);
        if (fittingCombinations.length === 1) {
            const shipsToPlace = fittingCombinations[0];
            const placementSolutions = [];
            solvePlacement(pocket, shipsToPlace, placementSolutions);

            if (placementSolutions.length === 1) {
                console.log("Sherlock AI: Deducuję z absolutną pewnością!");
                return placementSolutions[0][0].positions[0]; // Zwróć pierwszą komórkę pierwszego statku
            }
        }
    }
    return null;
}

// ##################################################################
// #      ARCHIMISTRZ AI - SAMODOSTOSOWUJĄCY SIĘ KONTROLER TAKTYCZNY #
// ##################################################################

class TacticalController {
    constructor() {
        this.currentMode = 'BALANCED'; // 'AGGRESSIVE', 'BALANCED', 'CAUTIOUS'
        this.recentShotHistory = []; // Przechowuje wyniki ostatnich N strzałów (true for hit, false for miss)
        this.HISTORY_LENGTH = 10;
    }

    /**
     * Analizuje stan gry i decyduje o trybie taktycznym.
     * @param {object} gameState - Obiekt zawierający informacje o stanie gry.
     *                          { playerShipsLeft: number, opponentShipsLeft: number,
     *                            totalPlayerShips: number, totalOpponentShips: number }
     */
    updateAndDecide(gameState) {
        const playerShipsLeftRatio = gameState.playerShipsLeft / gameState.totalPlayerShips;
        const opponentShipsLeftRatio = gameState.opponentShipsLeft / gameState.totalOpponentShips;
        const advantage = playerShipsLeftRatio - opponentShipsLeftRatio;
        const hitRate = this.recentShotHistory.filter(Boolean).length / this.recentShotHistory.length;

        let previousMode = this.currentMode;

        if (advantage > 0.25 || (hitRate > 0.6 && this.recentShotHistory.length === this.HISTORY_LENGTH)) {
            this.currentMode = 'AGGRESSIVE';
        } else if (advantage < -0.25 || (hitRate < 0.2 && this.recentShotHistory.length === this.HISTORY_LENGTH)) {
            this.currentMode = 'CAUTIOUS';
        } else {
            this.currentMode = 'BALANCED';
        }

        if (previousMode !== this.currentMode) {
            console.log(`Kontroler Taktyczny: Zmiana trybu z ${previousMode} na ${this.currentMode}. Przewaga: ${(advantage * 100).toFixed(0)}%, Skuteczność: ${(hitRate * 100).toFixed(0)}%`);
        }
    }

    /**
     * Rejestruje wynik ostatniego strzału.
     * @param {boolean} wasHit - True, jeśli strzał był celny.
     */
    recordShot(wasHit) {
        this.recentShotHistory.push(wasHit);
        if (this.recentShotHistory.length > this.HISTORY_LENGTH) {
            this.recentShotHistory.shift();
        }
    }

    /**
     * Zwraca parametry dla algorytmu MCTS na podstawie aktualnego trybu.
     * @returns {{timeout: number, isParanoid: boolean}}
     */
    getMctsParameters() {
        switch (this.currentMode) {
            case 'AGGRESSIVE':
                // Szybsze decyzje, mniejsza ostrożność
                return { timeout: 10000, isParanoid: false };
            case 'CAUTIOUS':
                // Dłuższy namysł, wysoka ostrożność
                return { timeout: 25000, isParanoid: true };
            case 'BALANCED':
            default:
                // Domyślny, zbalansowany czas
                return { timeout: 20000, isParanoid: false };
        }
    }
}

const tacticalController = new TacticalController();

// ##################################################################
// #      ARCHIMISTRZ AI - MODUŁ KOREKCJI BŁĘDÓW                     #
// ##################################################################

class ErrorCorrection {
    /**
     * Weryfikuje, czy zatopienie statku o podanym rozmiarze jest zgodne z aktualną wiedzą o flocie przeciwnika.
     * @param {number} sunkShipSize - Rozmiar zatopionego statku.
     * @param {Array<object>} knownOpponentShips - Lista pozostałych statków przeciwnika.
     * @returns {{error: boolean, message: string|null}}
     */
    verifySunkShip(sunkShipSize, knownOpponentShips) {
        const shipType = knownOpponentShips.find(s => s.size === sunkShipSize);
        if (!shipType || shipType.count === 0) {
            const message = `BŁĄD KRYTYCZNY: Zgłoszono zatopienie statku o rozmiarze ${sunkShipSize}, ale według mojej wiedzy nie ma już takich jednostek! Sprawdź swoje zapiski. Możesz cofnąć ostatni ruch, aby skorygować stan gry.`;
            return { error: true, message: message };
        }
        return { error: false, message: null };
    }
}

const errorCorrector = new ErrorCorrection();


/**
 * Główna funkcja tury bota - decyduje gdzie strzelić.
 */
let isFirstShot = true;

function botTurn() {
    const size = currentConfig.size;
    let x, y;

    if (isFirstShot) {
        const center = Math.floor(size / 2);
        const options = [{x: center, y: center}, {x: center - 1, y: center}, {x: center, y: center - 1}, {x: center - 1, y: center - 1}];
        const choice = options[Math.floor(Math.random() * options.length)];
        x = choice.x;
        y = choice.y;
        isFirstShot = false;
    } else if (botState === 'HUNT') {
        const guaranteedHit = findGuaranteedHit();
        if (guaranteedHit) {
            console.log("AI dedukuje: GWARANTOWANE trafienie!");
            x = guaranteedHit.x;
            y = guaranteedHit.y;
        } else {
            console.log(`AI: Rozpoczynam analizę ${allPossibleOpponentLayouts.length} możliwych rzeczywistości...`);
            let bestMove = { x: -1, y: -1, score: -Infinity };
            const unknownCells = [];
            for(let r=0; r<size; r++) for(let c=0; c<size; c++) if(opponentGrid[r][c] === 'unknown') unknownCells.push({x:c, y:r});

            // "Tryb Egzekutora"
            const dynamicSmallestShip = Math.min(...opponentShips.filter(s => s.count > 0).map(s => s.size));
            if (dynamicSmallestShip <= 2 && unknownCells.length > (size*size*0.5)) {
                 console.log("AI: Aktywacja Trybu Egzekutora opartego na parzystości.");
                 const parityMoves = unknownCells.filter(cell => (cell.x + cell.y) % dynamicSmallestShip === 0);
                 if (parityMoves.length > 0) {
                     const randomCell = parityMoves[Math.floor(Math.random() * parityMoves.length)];
                     x = randomCell.x;
                     y = randomCell.y;
                     // Pomiń resztę skomplikowanej analizy
                     lastShot = { x, y };
                     const coordString = `${String.fromCharCode(65 + y)}${x + 1}`;
                     document.getElementById('bot-suggestion').textContent = coordString;
                     console.log(`Bot (Egzekutor) sugeruje strzał w: (${x}, ${y})`);
                     return;
                 }
            }

            for (const cell of unknownCells) {
                const layoutsWithShipAtCell = allPossibleOpponentLayouts.filter(layout => layout[cell.y][cell.x] === 'ship').length;
                const layoutsWithoutShipAtCell = allPossibleOpponentLayouts.length - layoutsWithShipAtCell;

                // Strategia minimaksowa: wybierz ruch, który jest najlepszy w najgorszym przypadku
                const score = Math.min(layoutsWithShipAtCell, layoutsWithoutShipAtCell);

                if (score > bestMove.score) {
                    bestMove = { x: cell.x, y: cell.y, score: score };
                }
            }

            if(bestMove.x !== -1) {
                x = bestMove.x;
                y = bestMove.y;
                 console.log(`AI: Najlepszy ruch redukuje niepewność o co najmniej ${bestMove.score} rzeczywistości.`);
            } else {
                // Sytuacja awaryjna
                 const randomCell = unknownCells[Math.floor(Math.random() * unknownCells.length)];
                 x = randomCell.x;
                 y = randomCell.y;
            }
        }
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
    const coordString = `${String.fromCharCode(65 + y)}${x + 1}`;
    document.getElementById('bot-suggestion').textContent = coordString;
    console.log(`Bot sugeruje strzał w: (${x}, ${y})`);
}

/**
 * Aktualizuje stan gry po strzale bota na podstawie odpowiedzi gracza.
 * @param {string} result - Wynik strzału ('Pudło', 'Trafiony', 'Uszkodzony', 'Zatopiony').
 */
function updatePossibleLayouts(shotX, shotY, result) {
    const previousCount = allPossibleOpponentLayouts.length;
    if (result === 'Pudło') {
        allPossibleOpponentLayouts = allPossibleOpponentLayouts.filter(layout => layout[shotY][shotX] === 'water');
    } else { // Trafiony, Uszkodzony, Zatopiony
        allPossibleOpponentLayouts = allPossibleOpponentLayouts.filter(layout => layout[shotY][shotX] === 'ship');
    }
    console.log(`AI: Redukcja rzeczywistości. Pozostało ${allPossibleOpponentLayouts.length} z ${previousCount}.`);
}

function updateAfterBotShot(result) {
    if (!lastShot) return;

    // Zapisz aktualny stan przed modyfikacją
    history.push(JSON.parse(JSON.stringify({
        grid: opponentGrid,
        ships: opponentShips,
        botState: botState,
        currentTargetHits: currentTargetHits,
        lastShot: lastShot
    })));

    const { x, y } = lastShot;

    // Zaktualizuj "pamięć" bota o nową informację
    updatePossibleLayouts(x, y, result);

    const cellElement = document.querySelector(`#opponent-board .cell[data-x='${x}'][data-y='${y}']`);

    switch (result) {
        case 'Pudło':
            opponentGrid[y][x] = 'miss';
            triggerAnimation(cellElement, 'animate-miss', 400);
            cellElement.classList.add('miss');
            tacticalController.recordShot(false);
            break;
        case 'Trafiony':
        case 'Uszkodzony':
            opponentGrid[y][x] = 'hit';
            triggerAnimation(cellElement, 'animate-hit', 500);
            cellElement.classList.add(result === 'Trafiony' ? 'hit' : 'damaged');
            botState = 'TARGET';
            currentTargetHits.push({ x, y });
            tacticalController.recordShot(true);
            break;
        case 'Zatopiony':
            opponentGrid[y][x] = 'hit'; // Najpierw oznacz jako trafienie dla animacji
            triggerAnimation(cellElement, 'animate-hit', 500);

            currentTargetHits.push({ x, y });
            tacticalController.recordShot(true);

            // Zidentyfikuj statek PRZED oznaczeniem go jako zatopiony
            const shipCoords = identifyAndGetSunkShipCoords(x,y);

            // Uruchom animację zatopienia na wszystkich częściach z opóźnieniem
            setTimeout(() => {
                shipCoords.forEach(pos => {
                    const sunkCellEl = document.querySelector(`#opponent-board .cell[data-x='${pos.x}'][data-y='${pos.y}']`);
                    if(sunkCellEl) {
                        opponentGrid[pos.y][pos.x] = 'sunk'; // Zaktualizuj model danych
                        sunkCellEl.classList.remove('hit', 'damaged');
                        sunkCellEl.classList.add('sunk');
                        triggerAnimation(sunkCellEl, 'animate-sunk', 600);
                    }
                });
                markSurroundingAsMiss(shipCoords);
                renderBoard('opponent-board', opponentGrid); // Przerenderuj, aby pokazać pola 'miss'
            }, 550);


            // Reset stanu bota
            const verification = errorCorrector.verifySunkShip(shipCoords.length, opponentShips);
            if (verification.error) {
                alert(verification.message);
                // Cofnij operację: oznacz tylko jako trafione, nie zatopione
                shipCoords.forEach(part => {
                    const cellEl = document.querySelector(`#opponent-board .cell[data-x='${part.x}'][data-y='${part.y}']`);
                    if (cellEl) cellEl.classList.add('hit');
                    opponentGrid[part.y][part.x] = 'hit';
                });
                botState = 'TARGET'; // Wróć do trybu dobijania, bo coś jest nie tak
                return; // Przerwij dalsze przetwarzanie
            }

            // Kontynuuj, jeśli weryfikacja przebiegła pomyślnie
            const shipIndex = opponentShips.findIndex(s => s.size === shipCoords.length);
            opponentShips[shipIndex].count--;
            updateOpponentProfile({ size: shipCoords.length, positions: shipCoords });
            checkWinCondition();

            botState = 'HUNT';
            targetQueue = [];
            currentTargetHits = []; // Wyczyść dopiero po całej operacji
            break;
    }
    renderBoard('opponent-board', opponentGrid); // Odśwież widok planszy
}

/**
 * Pomocnicza funkcja do uruchamiania animacji na komórce.
 * @param {HTMLElement} cellElement - Element komórki do animowania.
 * @param {string} animationClass - Klasa CSS animacji.
 * @param {number} duration - Czas trwania animacji w ms.
 */
function triggerAnimation(cellElement, animationClass, duration) {
    cellElement.classList.add(animationClass);
    setTimeout(() => {
        cellElement.classList.remove(animationClass);
    }, duration);
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

function identifyAndGetSunkShipCoords(lastHitX, lastHitY) {
    const size = currentConfig.size;
    const q = [{x: lastHitX, y: lastHitY}];
    const visited = new Set([`${lastHitX},${lastHitY}`]);
    const shipParts = [{x: lastHitX, y: lastHitY}];

    while(q.length > 0){
        const curr = q.shift();
        const neighbors = [
            {x: curr.x + 1, y: curr.y}, {x: curr.x - 1, y: curr.y},
            {x: curr.x, y: curr.y + 1}, {x: curr.x, y: curr.y - 1}
        ];
        for(const n of neighbors){
            const key = `${n.x},${n.y}`;
            if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size && !visited.has(key)) {
                const cellState = opponentGrid[n.y][n.x];
                if (cellState === 'hit' || cellState === 'damaged') {
                    visited.add(key);
                    q.push(n);
                    shipParts.push(n);
                }
            }
        }
    }
    return shipParts;
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
    saveOpponentProfile(); // Zapisz profil po zakończeniu gry
}

function saveOpponentProfile() {
    try {
        localStorage.setItem('battleshipAI_opponentProfile', JSON.stringify(opponentProfile));
        console.log("Pamięć Długotrwała: Profil przeciwnika został zapisany.");
    } catch (e) {
        console.error("Nie udało się zapisać profilu przeciwnika:", e);
    }
}

function loadOpponentProfile() {
    try {
        const savedProfile = localStorage.getItem('battleshipAI_opponentProfile');
        if (savedProfile) {
            const loaded = JSON.parse(savedProfile);
            // Stopniowe dostosowanie, a nie całkowite zastąpienie
            opponentProfile.placementBias.edge = (opponentProfile.placementBias.edge + loaded.placementBias.edge) / 2;
            opponentProfile.placementBias.center = (opponentProfile.placementBias.center + loaded.placementBias.center) / 2;
            opponentProfile.placementBias.corner = (opponentProfile.placementBias.corner + loaded.placementBias.corner) / 2;
            opponentProfile.orientationBias.vertical = (opponentProfile.orientationBias.vertical + loaded.orientationBias.vertical) / 2;
            opponentProfile.orientationBias.horizontal = (opponentProfile.orientationBias.horizontal + loaded.orientationBias.horizontal) / 2;
            console.log("Pamięć Długotrwała: Profil przeciwnika został załadowany i zaadaptowany.");
        } else {
             console.log("Pamięć Długotrwała: Nie znaleziono zapisanego profilu. Rozpoczynam z czystą kartą.");
        }
    } catch (e) {
        console.error("Nie udało się załadować profilu przeciwnika:", e);
    }
}


function startGame(sizeConfig) {
    console.log(`Rozpoczynanie gry z planszą ${sizeConfig}...`);
    currentConfig = GAME_CONFIGS[sizeConfig];
    loadOpponentProfile(); // Załaduj profil przed rozpoczęciem gry
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('shot-input-container').classList.remove('hidden');

    // Inicjalizacja i generowanie widoku
    createBoard('player-board', 'player-coords-top', 'player-coords-left', currentConfig.size);
    createBoard('opponent-board', 'opponent-coords-top', 'opponent-coords-left', currentConfig.size);

    // Inicjalizacja logicznej reprezentacji plansz
    initializeGrids(currentConfig.size);
    initializeQuantumHunter(); // Inicjalizacja nowego systemu ataku
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
            updateAfterBotShot(action);
            if(botState === 'HUNT') turnCounter++;
            botTurn();
        });
    }

    // Rozpoczęcie pierwszej tury bota
    turnCounter = 1;
    botTurn();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Gra w statki załadowana. Oczekiwanie na wybór gracza...');

    // Logika Panelu Taktycznego
    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('settings-btn').addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    document.querySelectorAll('.board-size-btn').forEach(button => {
        button.addEventListener('click', () => {
            startGame(button.dataset.size);
        });
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        location.reload();
    });

    document.getElementById('submit-player-shot-btn').addEventListener('click', handlePlayerOverrideShot);

    document.getElementById('btn-undo').addEventListener('click', () => {
        if (history.length > 0) {
            const lastState = history.pop();
            opponentGrid = lastState.grid;
            opponentShips = lastState.ships;
            botState = lastState.botState;
            currentTargetHits = lastState.currentTargetHits;
            lastShot = lastState.lastShot;
            renderBoard('opponent-board', opponentGrid);
            console.log("Cofnięto ostatni ruch.");
        } else {
            alert("Brak ruchów do cofnięcia.");
        }
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

    document.getElementById('player-shot-input').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            handlePlayerOverrideShot();
        }
    });
});

function handlePlayerOverrideShot() {
    const inputElement = document.getElementById('player-shot-input');
    const value = inputElement.value.trim().toUpperCase();
    if (!value) return;

    const letter = value.charAt(0);
    const number = parseInt(value.substring(1), 10);

    if (letter >= 'A' && letter <= String.fromCharCode(65 + currentConfig.size - 1) && number >= 1 && number <= currentConfig.size) {
        const y = letter.charCodeAt(0) - 65;
        const x = number - 1;

        if (opponentGrid[y][x] !== 'unknown') {
            alert("To pole było już ostrzelane! Wybierz inne.");
            return;
        }

        // Gracz przejmuje inicjatywę
        lastShot = { x, y };
        document.getElementById('bot-suggestion').textContent = `${value} (Twój wybór)`;
        clearPreviousSuggestions();

        // Podświetl wybór gracza
        const cellElement = document.querySelector(`#opponent-board .cell[data-x='${x}'][data-y='${y}']`);
        if (cellElement) {
            cellElement.classList.add('suggestion-1'); // Użyj stylu najlepszej sugestii
        }

        console.log(`Gracz przejmuje kontrolę, strzelając w: (${x}, ${y})`);
        inputElement.value = ''; // Wyczyść pole po strzale
    } else {
        alert("Nieprawidłowe koordynaty. Wpisz np. 'A5'.");
    }
}
