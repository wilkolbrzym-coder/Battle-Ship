package game

import (
	"fmt"
	"math/rand"
	"time"
)

// PlaceShipsRandomly rozmieszcza statki losowo na planszy zgodnie z zasadami.
func (b *Board) PlaceShipsRandomly(config GameConfig) error {
	rand.Seed(time.Now().UnixNano())
	b.Grid = make([][]Cell, b.Size)
	for i := range b.Grid {
		b.Grid[i] = make([]Cell, b.Size)
		for j := range b.Grid[i] {
			b.Grid[i][j] = Cell{State: CellWater, ShipID: -1}
		}
	}
	b.Ships = []*Ship{}
	shipIDCounter := 0

	// Sortowanie statków od największego do najmniejszego dla łatwiejszego upakowania
	// W Go mapy są nieuporządkowane, więc musimy spłaszczyć listę
	var shipsToPlace []ShipDef
	for _, def := range config.Ships {
		for i := 0; i < def.Count; i++ {
			shipsToPlace = append(shipsToPlace, def)
		}
	}

	// Proste sortowanie bąbelkowe malejąco po rozmiarze
	for i := 0; i < len(shipsToPlace)-1; i++ {
		for j := 0; j < len(shipsToPlace)-i-1; j++ {
			if shipsToPlace[j].Size < shipsToPlace[j+1].Size {
				shipsToPlace[j], shipsToPlace[j+1] = shipsToPlace[j+1], shipsToPlace[j]
			}
		}
	}

	for _, shipDef := range shipsToPlace {
		placed := false
		attempts := 0
		for !placed && attempts < 10000 { // Zwiększona liczba prób
			attempts++
			isVertical := rand.Intn(2) == 0
			x := rand.Intn(b.Size)
			y := rand.Intn(b.Size)

			if isVertical {
				if y+shipDef.Size > b.Size {
					continue
				}
			} else {
				if x+shipDef.Size > b.Size {
					continue
				}
			}

			if b.CanPlaceShip(x, y, shipDef.Size, isVertical) {
				newShip := &Ship{
					ID:        shipIDCounter,
					Name:      shipDef.Name,
					Size:      shipDef.Size,
					Positions: []Position{},
					Hits:      0,
					IsSunk:    false,
				}
				shipIDCounter++

				for i := 0; i < shipDef.Size; i++ {
					cx, cy := x, y
					if isVertical {
						cy += i
					} else {
						cx += i
					}
					b.Grid[cy][cx].State = CellShip
					b.Grid[cy][cx].ShipID = newShip.ID
					newShip.Positions = append(newShip.Positions, Position{X: cx, Y: cy})
				}
				b.Ships = append(b.Ships, newShip)
				placed = true
			}
		}
		if !placed {
			return fmt.Errorf("nie udało się rozmieścić statków po %d próbach", attempts)
		}
	}
	return nil
}

// CanPlaceShip sprawdza, czy można umieścić statek w danym miejscu (uwzględniając odstępy).
// Zasada: statki nie mogą się stykać, nawet rogami.
func (b *Board) CanPlaceShip(x, y, size int, isVertical bool) bool {
	for i := 0; i < size; i++ {
		cx, cy := x, y
		if isVertical {
			cy += i
		} else {
			cx += i
		}

		// Sprawdź sąsiedztwo 3x3 dla każdego segmentu statku
		for dy := -1; dy <= 1; dy++ {
			for dx := -1; dx <= 1; dx++ {
				nx, ny := cx+dx, cy+dy
				if nx >= 0 && nx < b.Size && ny >= 0 && ny < b.Size {
					if b.Grid[ny][nx].State != CellWater {
						return false
					}
				}
			}
		}
	}
	return true
}

// Fire wykonuje strzał w dane pole. Zwraca wynik strzału i komunikat.
func (b *Board) Fire(x, y int) (CellState, string) {
	if x < 0 || x >= b.Size || y < 0 || y >= b.Size {
		return CellWater, "Poza planszą"
	}

	cell := &b.Grid[y][x]
	if cell.State == CellHit || cell.State == CellMiss || cell.State == CellSunk {
		return cell.State, "Już strzelano"
	}

	if cell.State == CellWater {
		cell.State = CellMiss
		return CellMiss, "Pudło"
	}

	if cell.State == CellShip {
		cell.State = CellHit
		// Znajdź statek
		var hitShip *Ship
		for _, s := range b.Ships {
			if s.ID == cell.ShipID {
				hitShip = s
				break
			}
		}

		if hitShip != nil {
			hitShip.Hits++
			if hitShip.Hits >= hitShip.Size {
				hitShip.IsSunk = true
				// Oznacz wszystkie pola statku jako zatopione
				for _, pos := range hitShip.Positions {
					b.Grid[pos.Y][pos.X].State = CellSunk
				}
				// Oznacz otoczenie jako pudła (autouzupełnianie)
				b.MarkSurroundingAsMiss(hitShip)
				return CellSunk, "Zatopiony!"
			}
			return CellHit, "Trafiony!"
		}
		// To nie powinno się zdarzyć
		return CellHit, "Błąd - statek widmo"
	}

	return CellWater, "Nieznany stan"
}

// MarkSurroundingAsMiss oznacza pola wokół zatopionego statku jako pudła.
func (b *Board) MarkSurroundingAsMiss(ship *Ship) {
	for _, pos := range ship.Positions {
		for dy := -1; dy <= 1; dy++ {
			for dx := -1; dx <= 1; dx++ {
				nx, ny := pos.X+dx, pos.Y+dy
				if nx >= 0 && nx < b.Size && ny >= 0 && ny < b.Size {
					if b.Grid[ny][nx].State == CellWater {
						b.Grid[ny][nx].State = CellMiss
					}
				}
			}
		}
	}
}

// AllShipsSunk sprawdza, czy wszystkie statki zostały zatopione.
func (b *Board) AllShipsSunk() bool {
	for _, s := range b.Ships {
		if !s.IsSunk {
			return false
		}
	}
	return true
}
