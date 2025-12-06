package ai

import (
	"battleship/game"
	"math"
	"math/rand"
	"time"
)

// QuantumHunter implementuje silnik mapy prawdopodobieństwa.
type QuantumHunter struct {
	BoardSize     int
	Config        game.GameConfig
	OpponentGrid  [][]game.CellState // Widok planszy przeciwnika (znane informacje)
	ProbMap       [][]float64        // Mapa prawdopodobieństwa
	RemainingShips []game.ShipDef     // Statki, które pozostały do zatopienia
}

// NewQuantumHunter tworzy nową instancję bota.
func NewQuantumHunter(config game.GameConfig) *QuantumHunter {
	grid := make([][]game.CellState, config.Size)
	for i := range grid {
		grid[i] = make([]game.CellState, config.Size)
		for j := range grid[i] {
			grid[i][j] = game.CellWater // W kontekście widoku bota, 'Water' to nieznane (lub użyć osobnego typu)
			// Użyjmy konwencji: Water = Unknown, Miss = Miss, Hit = Hit, Sunk = Sunk
		}
	}

	return &QuantumHunter{
		BoardSize:     config.Size,
		Config:        config,
		OpponentGrid:  grid,
		RemainingShips: append([]game.ShipDef{}, config.Ships...),
	}
}

// UpdateGameState aktualizuje wiedzę bota o planszy.
func (qh *QuantumHunter) UpdateGameState(x, y int, result game.CellState) {
	qh.OpponentGrid[y][x] = result
	if result == game.CellSunk {
		// Musimy zaktualizować listę pozostałych statków.
		// To jest trudne bez wiedzy jaki statek zatonął, ale gra zwykle to zwraca.
		// W uproszczonej wersji założymy, że silnik gry mówi nam co zatonęło,
		// albo dedukujemy to z długości.
		// Tutaj, dla uproszczenia, zakładamy że dedukcja następuje na zewnątrz lub
		// po prostu regenerujemy mapę na podstawie "Sunk" na planszy.

		// Znajdź rozmiar zatopionego statku
		size := qh.deduceSunkShipSize(x, y)
		if size > 0 {
			qh.removeShipFromRemaining(size)
		}
	}
}

func (qh *QuantumHunter) deduceSunkShipSize(x, y int) int {
	// Prosty algorytm BFS/DFS do znalezienia rozmiaru spójnego obszaru 'Sunk'
	// Zakładamy, że (x,y) jest częścią tego statku.
	visited := make(map[[2]int]bool)
	queue := [][2]int{{x, y}}
	visited[[2]int{x, y}] = true
	count := 0

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		count++

		dirs := [][2]int{{0, 1}, {0, -1}, {1, 0}, {-1, 0}}
		for _, d := range dirs {
			nx, ny := curr[0]+d[0], curr[1]+d[1]
			if nx >= 0 && nx < qh.BoardSize && ny >= 0 && ny < qh.BoardSize {
				if qh.OpponentGrid[ny][nx] == game.CellSunk {
					if !visited[[2]int{nx, ny}] {
						visited[[2]int{nx, ny}] = true
						queue = append(queue, [2]int{nx, ny})
					}
				}
			}
		}
	}
	return count
}

func (qh *QuantumHunter) removeShipFromRemaining(size int) {
	for i, s := range qh.RemainingShips {
		if s.Size == size && s.Count > 0 {
			qh.RemainingShips[i].Count--
			return
		}
	}
}

// CalculateProbabilityMap generuje mapę prawdopodobieństwa metodą Monte Carlo.
func (qh *QuantumHunter) CalculateProbabilityMap() {
	qh.ProbMap = make([][]float64, qh.BoardSize)
	for i := range qh.ProbMap {
		qh.ProbMap[i] = make([]float64, qh.BoardSize)
	}

	iterations := 10000 // W Go możemy sobie pozwolić na więcej niż w JS
	validLayouts := 0

	rand.Seed(time.Now().UnixNano())

	// Lista statków do rozmieszczenia (płaska)
	var shipsToPlace []int
	for _, s := range qh.RemainingShips {
		for i := 0; i < s.Count; i++ {
			shipsToPlace = append(shipsToPlace, s.Size)
		}
	}

	if len(shipsToPlace) == 0 {
		return
	}

	// Bufor na tymczasową planszę, żeby nie alokować pamięci w pętli
	tempGrid := make([][]game.CellState, qh.BoardSize)
	for i := range tempGrid {
		tempGrid[i] = make([]game.CellState, qh.BoardSize)
	}

	for iter := 0; iter < iterations; iter++ {
		// Reset tempGrid
		for i := 0; i < qh.BoardSize; i++ {
			for j := 0; j < qh.BoardSize; j++ {
				// Kopiuj stan: Miss i Sunk są przeszkodami. Hit też jest "zajęty" ale przez statek.
				// Unknown (Water) jest wolne.
				// Ale musimy pamiętać:
				// - Tam gdzie jest 'Hit', MUSI być statek.
				// - Tam gdzie jest 'Miss' lub 'Sunk', NIE MOŻE być nowego statku (Sunk to już odkryty statek).
				state := qh.OpponentGrid[i][j]
				if state == game.CellMiss || state == game.CellSunk {
					tempGrid[i][j] = game.CellMiss // Traktuj jako zablokowane
				} else if state == game.CellHit {
					tempGrid[i][j] = game.CellHit // Musi pokrywać się ze statkiem
				} else {
					tempGrid[i][j] = game.CellWater // Wolne
				}
			}
		}

		// Próba losowego rozmieszczenia
		if qh.tryPlaceShipsRandomly(tempGrid, shipsToPlace) {
			validLayouts++
			// Aktualizuj mapę prawdopodobieństwa
			for i := 0; i < qh.BoardSize; i++ {
				for j := 0; j < qh.BoardSize; j++ {
					if tempGrid[i][j] == game.CellShip || tempGrid[i][j] == game.CellHit { // Hit w tempGridzie po wstawieniu statku to po prostu statek
						// Zwiększ wagę pola
						qh.ProbMap[i][j]++
					}
				}
			}
		}
	}

	// Normalizacja (opcjonalna, ale przydatna dla debugowania)
	if validLayouts > 0 {
		for i := 0; i < qh.BoardSize; i++ {
			for j := 0; j < qh.BoardSize; j++ {
				qh.ProbMap[i][j] /= float64(validLayouts)
			}
		}
	}
}

func (qh *QuantumHunter) tryPlaceShipsRandomly(grid [][]game.CellState, ships []int) bool {
	// Tasowanie statków
	rand.Shuffle(len(ships), func(i, j int) { ships[i], ships[j] = ships[j], ships[i] })

	// Musimy śledzić, czy wszystkie istniejące 'Hit' na planszy zostały pokryte przez nowo wstawione statki.
	// Jeśli na końcu zostanie jakiś 'Hit' niepokryty, układ jest nieważny.
	// Ale w tej metodzie 'Hit' w gridzie traktujemy jako miejsce, gdzie statek MOŻE (i musi) wejść.

	for _, size := range ships {
		placed := false
		for attempt := 0; attempt < 50; attempt++ { // Limit prób na statek
			isVertical := rand.Intn(2) == 0
			x := rand.Intn(qh.BoardSize)
			y := rand.Intn(qh.BoardSize)

			if isVertical {
				if y+size > qh.BoardSize { continue }
			} else {
				if x+size > qh.BoardSize { continue }
			}

			if qh.canPlaceShipSimulation(grid, x, y, size, isVertical) {
				// Wstaw statek
				for k := 0; k < size; k++ {
					cx, cy := x, y
					if isVertical { cy += k } else { cx += k }
					grid[cy][cx] = game.CellShip // Oznacz jako statek (nawet jeśli pod spodem był Hit)
				}
				placed = true
				break
			}
		}
		if !placed {
			return false
		}
	}

	// Weryfikacja: Czy wszystkie 'Hit' z oryginalnej planszy są pokryte statkami?
	// W naszej symulacji nadpisujemy grid wartością CellShip.
	// Musimy sprawdzić, czy w miejscach gdzie w OpponentGrid jest CellHit, w grid jest teraz CellShip.
	// Ale zaraz, grid został zainicjalizowany kopią.
	// Jeśli w grid[y][x] było CellHit, a my nic tam nie wstawiliśmy, to nadal jest CellHit.
	// Jeśli wstawiliśmy, to jest CellShip.
	// Więc jeśli po wstawieniu wszystkich statków gdzieś zostało "CellHit" (które nie zostało nadpisane przez CellShip - co jest niemożliwe w tej implementacji bo CellShip nadpisuje),
	// Wróć. CellHit w gridzie oznacza "tu jest fragment statku, który już trafiliśmy".
	// Nasz generator musi wstawić statek TAK, żeby pokrywał te Hity.
	// Moja funkcja `canPlaceShipSimulation` pozwala kłaść statek na 'Hit'.
	// Ale musimy upewnić się, że KAŻDY 'Hit' jest przykryty przez jakiś statek.

	// Sprawdzenie coverage
	for i := 0; i < qh.BoardSize; i++ {
		for j := 0; j < qh.BoardSize; j++ {
			if qh.OpponentGrid[i][j] == game.CellHit {
				if grid[i][j] != game.CellShip {
					// Oznacza to, że generator nie położył tu statku, więc ten układ jest sprzeczny z rzeczywistością
					// (bo w rzeczywistości tu jest statek).
					return false
				}
			}
		}
	}

	return true
}

func (qh *QuantumHunter) canPlaceShipSimulation(grid [][]game.CellState, x, y, size int, isVertical bool) bool {
	for i := 0; i < size; i++ {
		cx, cy := x, y
		if isVertical { cy += i } else { cx += i }

		// Sprawdź czy pole jest wolne lub jest to 'Hit' (na którym możemy położyć statek)
		cell := grid[cy][cx]
		if cell == game.CellMiss || cell == game.CellSunk {
			return false
		}
		if cell == game.CellShip { // Kolizja z innym nowo postawionym statkiem
			return false
		}

		// Sprawdź otoczenie (No touching rule)
		// Tutaj musimy uważać. Jeśli w otoczeniu jest 'Hit', to czy możemy położyć statek?
		// Jeśli 'Hit' należy do TEGO SAMEGO statku, to tak. Ale my kładziemy nowy statek.
		// Jeśli w otoczeniu jest 'Hit' który NIE zostanie przykryty przez ten statek, to znaczy że jest to INNY statek.
		// A statki nie mogą się stykać.
		// Więc: w otoczeniu nie może być CellShip (nowy statek) ani CellSunk (stary statek).
		// A co z CellHit? Jeśli CellHit jest obok, to musi należeć do INNEGO statku (skoro my go nie przykrywamy).
		// Więc też nie może być.

		for dy := -1; dy <= 1; dy++ {
			for dx := -1; dx <= 1; dx++ {
				nx, ny := cx+dx, cy+dy
				if nx >= 0 && nx < qh.BoardSize && ny >= 0 && ny < qh.BoardSize {
					// Ignoruj samo pole statku (które dopiero sprawdzamy)
					isSelf := false
					for k:=0; k<size; k++ {
						sx, sy := x, y
						if isVertical { sy += k } else { sx += k }
						if nx == sx && ny == sy {
							isSelf = true
							break
						}
					}
					if isSelf { continue }

					neighbor := grid[ny][nx]
					if neighbor == game.CellShip || neighbor == game.CellSunk {
						return false
					}
					// Jeśli sąsiad to 'Hit', i nie jest on częścią AKTUALNIE kładzionego statku (co sprawdziliśmy w isSelf),
					// to znaczy że dotykamy innego statku (trafionego ale nie zatopionego).
					// To jest niedozwolone.
					if neighbor == game.CellHit {
						return false
					}
				}
			}
		}
	}
	return true
}

// GetBestMove zwraca najlepszy ruch na podstawie mapy prawdopodobieństwa.
func (qh *QuantumHunter) GetBestMove() (int, int) {
	// Najpierw tryb Target: jeśli mamy niezatopione trafienia
	hits := []game.Position{}
	for y := 0; y < qh.BoardSize; y++ {
		for x := 0; x < qh.BoardSize; x++ {
			if qh.OpponentGrid[y][x] == game.CellHit {
				hits = append(hits, game.Position{X: x, Y: y})
			}
		}
	}

	if len(hits) > 0 {
		return qh.getTargetModeMove(hits)
	}

	// Tryb Hunt (Quantum)
	qh.CalculateProbabilityMap()

	bestX, bestY := -1, -1
	maxProb := -1.0

	// Parity Hunting (szachownica) - optymalizacja dla najmniejszego statku
	minShipSize := 100
	for _, s := range qh.RemainingShips {
		if s.Count > 0 && s.Size < minShipSize {
			minShipSize = s.Size
		}
	}
	if minShipSize == 100 { minShipSize = 1 } // Fallback

	for y := 0; y < qh.BoardSize; y++ {
		for x := 0; x < qh.BoardSize; x++ {
			if qh.OpponentGrid[y][x] != game.CellWater { // Tylko nieznane pola
				continue
			}

			prob := qh.ProbMap[y][x]

			// Parity bonus: preferuj pola pasujące do wzorca parzystości najmniejszego statku
			if (x+y)%minShipSize == 0 {
				prob *= 1.5 // Boost
			}

			if prob > maxProb {
				maxProb = prob
				bestX, bestY = x, y
			}
		}
	}

	// Jeśli nadal nic (np. zerowe prawdopodobieństwo wszędzie - co możliwe przy błędach), losuj
	if bestX == -1 {
		return qh.getRandomMove()
	}

	return bestX, bestY
}

func (qh *QuantumHunter) getTargetModeMove(hits []game.Position) (int, int) {
	// Prosta heurystyka: strzelaj w sąsiedztwo trafień
	// Można by tu użyć bardziej zaawansowanej logiki (jak w JS: weryfikacja linii),
	// ale ProbabilityMap też to uwzględni (bo generuje tylko układy pasujące do Hitów).
	// Więc dla spójności, użyjmy ProbabilityMap nawet w trybie Target,
	// ponieważ ona naturalnie wyeliminuje niemożliwe pola i skupi się na przedłużeniu linii.

	qh.CalculateProbabilityMap()

	bestX, bestY := -1, -1
	maxProb := -1.0

	for y := 0; y < qh.BoardSize; y++ {
		for x := 0; x < qh.BoardSize; x++ {
			if qh.OpponentGrid[y][x] != game.CellWater {
				continue
			}
			if qh.ProbMap[y][x] > maxProb {
				maxProb = qh.ProbMap[y][x]
				bestX, bestY = x, y
			}
		}
	}

	if bestX != -1 {
		return bestX, bestY
	}

	return qh.getRandomMove()
}

func (qh *QuantumHunter) getRandomMove() (int, int) {
	candidates := []game.Position{}
	for y := 0; y < qh.BoardSize; y++ {
		for x := 0; x < qh.BoardSize; x++ {
			if qh.OpponentGrid[y][x] == game.CellWater {
				candidates = append(candidates, game.Position{X: x, Y: y})
			}
		}
	}
	if len(candidates) == 0 {
		return -1, -1 // Game over likely
	}
	choice := candidates[rand.Intn(len(candidates))]
	return choice.X, choice.Y
}

// GeneticPlacement to placeholder dla genetycznego algorytmu rozmieszczania (można użyć logiki z board.go, która jest już randomizowana i dobra)
// W wersji konsolowej gracz rozstawia sam, a bot używa PlaceShipsRandomly z logic.go,
// które ma wbudowane "hard constraints". Możemy to ulepszyć, aby maksymalizować rozproszenie.
func (qh *QuantumHunter) GetOptimizedLayout() *game.Board {
	// Użyjmy metody Monte Carlo: wygeneruj 100 plansz i wybierz tę o najlepszym "fitness" (rozproszeniu).
	bestBoard := game.NewBoard(qh.BoardSize)
	bestFitness := -1.0

	for i := 0; i < 100; i++ {
		board := game.NewBoard(qh.BoardSize)
		if err := board.PlaceShipsRandomly(qh.Config); err == nil {
			fitness := calculateFitness(board)
			if fitness > bestFitness {
				bestFitness = fitness
				bestBoard = board
			}
		}
	}
	return bestBoard
}

func calculateFitness(b *game.Board) float64 {
	// Fitness = suma odległości między środkami statków (im dalej, tym lepiej)
	// + kara za stykanie się krawędziami (choć PlaceShipsRandomly tego unika)
	// + preferencje za brak stykania się "nawet blisko"

	distSum := 0.0
	count := 0

	for i := 0; i < len(b.Ships); i++ {
		for j := i + 1; j < len(b.Ships); j++ {
			s1 := b.Ships[i]
			s2 := b.Ships[j]

			// Środki ciężkości
			cx1, cy1 := getCenter(s1)
			cx2, cy2 := getCenter(s2)

			dist := math.Sqrt(math.Pow(cx1-cx2, 2) + math.Pow(cy1-cy2, 2))
			distSum += dist
			count++
		}
	}

	if count == 0 { return 0 }
	return distSum / float64(count)
}

func getCenter(s *game.Ship) (float64, float64) {
	sumX, sumY := 0, 0
	for _, p := range s.Positions {
		sumX += p.X
		sumY += p.Y
	}
	return float64(sumX)/float64(len(s.Positions)), float64(sumY)/float64(len(s.Positions))
}
