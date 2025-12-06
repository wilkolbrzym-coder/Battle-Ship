package ai

import (
	"battleship/game"
	"fmt"
	"math"
	"math/rand"
	"time"
)

const (
	MaxHypotheses = 50000
	MinHypotheses = 5000
)

// QuantumHunter implementuje zaawansowany silnik AI.
type QuantumHunter struct {
	BoardSize      int
	Config         game.GameConfig
	OpponentGrid   [][]game.CellState // Widok planszy przeciwnika (znane informacje)
	ProbMap        [][]float64        // Mapa prawdopodobieństwa
	ActiveHypotheses [][][]game.CellState // Pula aktywnych, możliwych układów plansz
	RemainingShips []game.ShipDef     // Statki, które pozostały do zatopienia
}

// NewQuantumHunter tworzy nową instancję bota.
func NewQuantumHunter(config game.GameConfig) *QuantumHunter {
	grid := make([][]game.CellState, config.Size)
	for i := range grid {
		grid[i] = make([]game.CellState, config.Size)
		for j := range grid[i] {
			grid[i][j] = game.CellWater // Water = Unknown
		}
	}

	qh := &QuantumHunter{
		BoardSize:        config.Size,
		Config:           config,
		OpponentGrid:     grid,
		RemainingShips:   append([]game.ShipDef{}, config.Ships...),
		ActiveHypotheses: [][][]game.CellState{},
	}

	// Wstępna generacja puli hipotez
	fmt.Println("AI: Generowanie wstępnej puli rzeczywistości kwantowych...")
	qh.ReplenishHypotheses()
	return qh
}

// UpdateGameState aktualizuje wiedzę bota o planszy i filtruje hipotezy.
func (qh *QuantumHunter) UpdateGameState(x, y int, result game.CellState) {
	qh.OpponentGrid[y][x] = result

	// Jeśli statek zatonął, zaktualizuj listę i oznacz otoczenie
	if result == game.CellSunk {
		size := qh.deduceSunkShipSize(x, y)
		if size > 0 {
			qh.removeShipFromRemaining(size)
		}
		// Autouzupełnianie wirtualne dla celów filtrowania
		// (Gra robi to sama w logice, ale bot musi wiedzieć, że otoczenie to 'Miss')
		// W game/logic.go Fire() robi MarkSurroundingAsMiss.
		// Ale my dostajemy tylko wynik strzału w (x,y).
		// Musimy zsynchronizować wiedzę bota.
		qh.markSurroundingAsMiss(x, y)
	}

	// Filtrowanie hipotez: usuń te, które są sprzeczne z nowym faktem
	qh.filterHypotheses(x, y, result)

	// Dogeneruj, jeśli pula jest za mała
	if len(qh.ActiveHypotheses) < MinHypotheses {
		qh.ReplenishHypotheses()
	}
}

func (qh *QuantumHunter) filterHypotheses(x, y int, result game.CellState) {
	var valid [][][]game.CellState
	for _, grid := range qh.ActiveHypotheses {
		match := false
		cell := grid[y][x]

		switch result {
		case game.CellMiss:
			// Hipoteza musi mieć tu puste pole (nie statek)
			if cell != game.CellShip && cell != game.CellHit { // Hit w hipotezie to statek
				match = true
			}
		case game.CellHit, game.CellSunk:
			// Hipoteza musi mieć tu statek
			if cell == game.CellShip || cell == game.CellHit {
				match = true
			}
		}

		// Dodatkowe sprawdzenie dla Sunk: czy w hipotezie ten statek jest faktycznie takiej długości?
		// To jest trudne obliczeniowo dla 50k hipotez, pomijamy w tej wersji dla wydajności.
		// Wystarczy zgodność pozycyjna.

		if match {
			valid = append(valid, grid)
		}
	}
	qh.ActiveHypotheses = valid
}

// ReplenishHypotheses dogenerowuje hipotezy do limitu MaxHypotheses.
func (qh *QuantumHunter) ReplenishHypotheses() {
	needed := MaxHypotheses - len(qh.ActiveHypotheses)
	if needed <= 0 {
		return
	}

	// Przygotuj płaską listę statków do rozmieszczenia
	var shipsToPlace []int
	for _, s := range qh.RemainingShips {
		for i := 0; i < s.Count; i++ {
			shipsToPlace = append(shipsToPlace, s.Size)
		}
	}

	if len(shipsToPlace) == 0 { return }

	rand.Seed(time.Now().UnixNano())

	// Użyj wielu wątków (goroutines) do generowania, bo to CPU heavy
	// Ale dla prostoty w TUI (single threaded update loop), zrobimy to sekwencyjnie
	// lub w małych paczkach. Tutaj sekwencyjnie, bo Go jest szybkie.
	// 50k może zająć 1-2 sekundy.

	// Bufor na nowe hipotezy
	newHypotheses := make([][][]game.CellState, 0, needed)

	timeout := time.After(2 * time.Second) // Limit czasu, żeby nie zamrozić UI na długo

	generationLoop:
	for i := 0; i < needed; i++ {
		select {
		case <-timeout:
			break generationLoop
		default:
			// Generuj losowy układ
			grid := make([][]game.CellState, qh.BoardSize)
			for r := range grid {
				grid[r] = make([]game.CellState, qh.BoardSize)
				for c := range grid[r] {
					// Inicjalizuj stanem wiedzy (żeby nie stawiać na Miss)
					// Ale generator tryPlaceShipsRandomly bierze pod uwagę OpponentGrid
					// więc tu możemy dać Water, a generator sprawdzi.
					grid[r][c] = game.CellWater
				}
			}

			if qh.tryPlaceShipsRandomly(grid, shipsToPlace) {
				newHypotheses = append(newHypotheses, grid)
			}
		}
	}

	qh.ActiveHypotheses = append(qh.ActiveHypotheses, newHypotheses...)
}

// CalculateProbabilityMap tworzy mapę na podstawie aktywnych hipotez.
func (qh *QuantumHunter) CalculateProbabilityMap() {
	// Reset mapy
	qh.ProbMap = make([][]float64, qh.BoardSize)
	for i := range qh.ProbMap {
		qh.ProbMap[i] = make([]float64, qh.BoardSize)
	}

	count := float64(len(qh.ActiveHypotheses))
	if count == 0 { return }

	for _, grid := range qh.ActiveHypotheses {
		for y := 0; y < qh.BoardSize; y++ {
			for x := 0; x < qh.BoardSize; x++ {
				if grid[y][x] == game.CellShip || grid[y][x] == game.CellHit {
					qh.ProbMap[y][x]++
				}
			}
		}
	}

	// Normalizacja
	for y := 0; y < qh.BoardSize; y++ {
		for x := 0; x < qh.BoardSize; x++ {
			qh.ProbMap[y][x] /= count
		}
	}
}

func (qh *QuantumHunter) tryPlaceShipsRandomly(grid [][]game.CellState, ships []int) bool {
	// Kopia ships do tasowania
	sh := make([]int, len(ships))
	copy(sh, ships)
	rand.Shuffle(len(sh), func(i, j int) { sh[i], sh[j] = sh[j], sh[i] })

	for _, size := range sh {
		placed := false
		for attempt := 0; attempt < 50; attempt++ {
			isVertical := rand.Intn(2) == 0
			x := rand.Intn(qh.BoardSize)
			y := rand.Intn(qh.BoardSize)

			if isVertical { if y+size > qh.BoardSize { continue } } else { if x+size > qh.BoardSize { continue } }

			if qh.canPlaceShipSimulation(grid, x, y, size, isVertical) {
				for k := 0; k < size; k++ {
					cx, cy := x, y
					if isVertical { cy += k } else { cx += k }
					grid[cy][cx] = game.CellShip
				}
				placed = true
				break
			}
		}
		if !placed { return false }
	}

	// Weryfikacja zgodności z OpponentGrid (czy pokrywa wszystkie Hity)
	for y := 0; y < qh.BoardSize; y++ {
		for x := 0; x < qh.BoardSize; x++ {
			// Jeśli wiemy, że tam jest HIT/SUNK, to w wygenerowanym gridzie musi być statek
			if qh.OpponentGrid[y][x] == game.CellHit || qh.OpponentGrid[y][x] == game.CellSunk {
				if grid[y][x] != game.CellShip {
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

		// Sprawdź kolizje ze znaną wiedzą
		known := qh.OpponentGrid[cy][cx]
		if known == game.CellMiss { return false } // Nie możemy stawiać na pudle
		// Hit/Sunk jest OK (nadpisujemy, bo to statek)

		// Sprawdź kolizje z już postawionymi statkami w tej symulacji
		current := grid[cy][cx]
		if current == game.CellShip { return false }

		// Sprawdź otoczenie (No touching)
		for dy := -1; dy <= 1; dy++ {
			for dx := -1; dx <= 1; dx++ {
				nx, ny := cx+dx, cy+dy
				if nx >= 0 && nx < qh.BoardSize && ny >= 0 && ny < qh.BoardSize {
					// Ignoruj segmenty tego samego statku (same-ship check)
					// Sprawdzamy czy (nx,ny) jest częścią statku, który właśnie kładziemy
					isSelf := false
					for k := 0; k < size; k++ {
						sx, sy := x, y
						if isVertical { sy += k } else { sx += k }
						if nx == sx && ny == sy { isSelf = true; break }
					}
					if isSelf { continue }

					if grid[ny][nx] == game.CellShip { return false }

					// Ważne: Sprawdź też, czy otoczenie nie jest Sunk/Hit w OpponentGrid
					// Jeśli jest Hit obok, a my go nie przykrywamy (bo !isSelf), to znaczy że dotykamy innego statku.
					// Jeśli OpponentGrid[ny][nx] == Hit/Sunk -> to jest inny statek.
					neighborKnown := qh.OpponentGrid[ny][nx]
					if neighborKnown == game.CellHit || neighborKnown == game.CellSunk {
						return false
					}
				}
			}
		}
	}
	return true
}

// GetBestMove zwraca koordynaty strzału i pewność (0-1).
func (qh *QuantumHunter) GetBestMove() (int, int, float64) {
	// Upewnij się, że mamy hipotezy
	if len(qh.ActiveHypotheses) < MinHypotheses {
		qh.ReplenishHypotheses()
	}

	qh.CalculateProbabilityMap()

	bestX, bestY := -1, -1
	maxProb := -1.0

	// Parity - polowanie na szachownicy
	minShipSize := 100
	for _, s := range qh.RemainingShips {
		if s.Count > 0 && s.Size < minShipSize { minShipSize = s.Size }
	}
	if minShipSize == 100 { minShipSize = 1 }

	for y := 0; y < qh.BoardSize; y++ {
		for x := 0; x < qh.BoardSize; x++ {
			// Strzelamy tylko w nieznane
			if qh.OpponentGrid[y][x] != game.CellWater { continue }

			prob := qh.ProbMap[y][x]

			// Bonus za parzystość (tylko w trybie Hunt, czyli gdy prob < 1.0)
			// W trybie Target, prob będzie bliskie 1.0 dla przedłużeń linii, więc to nie zaszkodzi
			if prob < 0.9 && (x+y)%minShipSize == 0 {
				prob *= 1.2
			}

			if prob > maxProb {
				maxProb = prob
				bestX, bestY = x, y
			}
		}
	}

	if bestX == -1 {
		// Fallback
		return qh.getRandomMove()
	}

	return bestX, bestY, maxProb
}

func (qh *QuantumHunter) getRandomMove() (int, int, float64) {
	candidates := []game.Position{}
	for y := 0; y < qh.BoardSize; y++ {
		for x := 0; x < qh.BoardSize; x++ {
			if qh.OpponentGrid[y][x] == game.CellWater {
				candidates = append(candidates, game.Position{X: x, Y: y})
			}
		}
	}
	if len(candidates) == 0 { return 0, 0, 0 }
	c := candidates[rand.Intn(len(candidates))]
	return c.X, c.Y, 0.1
}

// Helpery
func (qh *QuantumHunter) deduceSunkShipSize(x, y int) int {
	// Identyczne jak wcześniej
	visited := make(map[[2]int]bool)
	queue := [][2]int{{x, y}}
	visited[[2]int{x, y}] = true
	count := 0
	for len(queue) > 0 {
		curr := queue[0]; queue = queue[1:]
		count++
		for _, d := range [][2]int{{0, 1}, {0, -1}, {1, 0}, {-1, 0}} {
			nx, ny := curr[0]+d[0], curr[1]+d[1]
			if nx >= 0 && nx < qh.BoardSize && ny >= 0 && ny < qh.BoardSize {
				if qh.OpponentGrid[ny][nx] == game.CellSunk && !visited[[2]int{nx, ny}] {
					visited[[2]int{nx, ny}] = true
					queue = append(queue, [2]int{nx, ny})
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

func (qh *QuantumHunter) markSurroundingAsMiss(x, y int) {
	// BFS po sunk statku
	queue := [][2]int{{x, y}}
	visited := map[[2]int]bool{{x, y}: true}
	shipCells := [][2]int{{x, y}}

	// 1. Znajdź cały statek
	idx := 0
	for idx < len(queue) {
		curr := queue[idx]; idx++
		for _, d := range [][2]int{{0, 1}, {0, -1}, {1, 0}, {-1, 0}} {
			nx, ny := curr[0]+d[0], curr[1]+d[1]
			if nx >= 0 && nx < qh.BoardSize && ny >= 0 && ny < qh.BoardSize {
				if qh.OpponentGrid[ny][nx] == game.CellSunk && !visited[[2]int{nx, ny}] {
					visited[[2]int{nx, ny}] = true
					queue = append(queue, [2]int{nx, ny})
					shipCells = append(shipCells, [2]int{nx, ny})
				}
			}
		}
	}

	// 2. Oznacz otoczenie
	for _, cell := range shipCells {
		cx, cy := cell[0], cell[1]
		for dy := -1; dy <= 1; dy++ {
			for dx := -1; dx <= 1; dx++ {
				nx, ny := cx+dx, cy+dy
				if nx >= 0 && nx < qh.BoardSize && ny >= 0 && ny < qh.BoardSize {
					if qh.OpponentGrid[ny][nx] == game.CellWater {
						qh.OpponentGrid[ny][nx] = game.CellMiss
					}
				}
			}
		}
	}
}

// Genetic Layout - to samo co wcześniej, bez zmian
func (qh *QuantumHunter) GetOptimizedLayout() *game.Board {
	bestBoard := game.NewBoard(qh.BoardSize)
	bestFitness := -1.0
	for i := 0; i < 100; i++ {
		board := game.NewBoard(qh.BoardSize)
		if err := board.PlaceShipsRandomly(qh.Config); err == nil {
			fit := calculateFitness(board)
			if fit > bestFitness { bestFitness = fit; bestBoard = board }
		}
	}
	return bestBoard
}

func calculateFitness(b *game.Board) float64 {
	distSum := 0.0
	count := 0
	for i := 0; i < len(b.Ships); i++ {
		for j := i + 1; j < len(b.Ships); j++ {
			s1, s2 := b.Ships[i], b.Ships[j]
			cx1, cy1 := getCenter(s1)
			cx2, cy2 := getCenter(s2)
			distSum += math.Sqrt(math.Pow(cx1-cx2, 2) + math.Pow(cy1-cy2, 2))
			count++
		}
	}
	if count == 0 { return 0 }
	return distSum / float64(count)
}

func getCenter(s *game.Ship) (float64, float64) {
	sumX, sumY := 0, 0
	for _, p := range s.Positions { sumX += p.X; sumY += p.Y }
	return float64(sumX)/float64(len(s.Positions)), float64(sumY)/float64(len(s.Positions))
}
