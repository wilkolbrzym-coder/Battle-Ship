package game

// BoardSize definiuje rozmiar planszy.
const BoardSize = 10

// CellState reprezentuje stan pojedynczego pola na planszy.
type CellState int

const (
	CellWater CellState = iota
	CellShip
	CellHit
	CellMiss
	CellSunk
)

// Cell reprezentuje komórkę planszy.
type Cell struct {
	State  CellState
	ShipID int // -1 jeśli brak statku
}

// Ship reprezentuje statek.
type Ship struct {
	ID        int
	Name      string
	Size      int
	Positions []Position
	Hits      int
	IsSunk    bool
}

// Position reprezentuje koordynaty (X, Y).
type Position struct {
	X, Y int
}

// GameConfig przechowuje konfigurację gry (statki).
type GameConfig struct {
	Size  int
	Ships []ShipDef
}

// ShipDef definiuje typ statku (nazwa, rozmiar, ilość).
type ShipDef struct {
	Name  string
	Size  int
	Count int
}

// DefaultConfig to konfiguracja 10x10 z JS.
var DefaultConfig = GameConfig{
	Size: BoardSize,
	Ships: []ShipDef{
		{"Carrier", 5, 1},
		{"Battleship", 4, 1},
		{"Cruiser", 3, 2},
		{"Destroyer", 2, 1},
	},
}

// Board reprezentuje planszę do gry.
type Board struct {
	Size  int
	Grid  [][]Cell
	Ships []*Ship
}

// NewBoard tworzy nową planszę.
func NewBoard(size int) *Board {
	grid := make([][]Cell, size)
	for i := range grid {
		grid[i] = make([]Cell, size)
		for j := range grid[i] {
			grid[i][j] = Cell{State: CellWater, ShipID: -1}
		}
	}
	return &Board{
		Size:  size,
		Grid:  grid,
		Ships: []*Ship{},
	}
}
