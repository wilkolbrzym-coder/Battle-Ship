package ui

import (
	"battleship/ai"
	"battleship/game"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Definicje stylów
var (
	subtleStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	titleStyle  = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFF")).
			Background(lipgloss.Color("#333")).
			Padding(0, 1).
			Bold(true)

	// Kolory komórek
	waterStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#244")).SetString("·") // Ciemny szary
	shipStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#DDD")).SetString("■") // Jasny szary
	hitStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("#F00")).SetString("X") // Czerwony
	missStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#55F")).SetString("○") // Niebieski
	sunkStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#900")).SetString("#") // Ciemny czerwony
	cursorStyle = lipgloss.NewStyle().Background(lipgloss.Color("#444")) // Tło kursora

	// Układ
	boardBorderStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("63")).
				Padding(0, 1)
)

type GameState int

const (
	StateWelcome GameState = iota
	StatePlayerTurn
	StateBotTurn
	StateGameOver
)

type Model struct {
	state       GameState
	playerBoard *game.Board
	botBoard    *game.Board // Prawdziwa plansza bota (ukryta przed graczem)
	botView     [][]game.CellState // To co widzi gracz na planszy bota

	botAI       *ai.QuantumHunter

	cursorX, cursorY int

	logs []string

	width, height int
	winner string
}

func InitialModel() Model {
	// Konfiguracja gry
	config := game.DefaultConfig

	// Inicjalizacja gracza (losowe rozmieszczenie dla uproszczenia, można dodać manualne)
	pBoard := game.NewBoard(config.Size)
	// Dla gracza też używamy "zoptymalizowanego" losowania, żeby miał szansę ;)
	// Ale w sumie wystarczy zwykłe random.
	if err := pBoard.PlaceShipsRandomly(config); err != nil {
		panic("Nie udało się stworzyć planszy gracza")
	}

	// Inicjalizacja bota
	botAI := ai.NewQuantumHunter(config)
	bBoard := botAI.GetOptimizedLayout() // Bot bierze najlepszy układ

	botView := make([][]game.CellState, config.Size)
	for i := range botView {
		botView[i] = make([]game.CellState, config.Size)
		for j := range botView[i] {
			botView[i][j] = game.CellWater // Nieznane
		}
	}

	return Model{
		state:       StateWelcome,
		playerBoard: pBoard,
		botBoard:    bBoard,
		botView:     botView,
		botAI:       botAI,
		cursorX:     0,
		cursorY:     0,
		logs:        []string{"Welcome to Battleship 2.0!", "Press Enter to start."},
	}
}

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		}

		switch m.state {
		case StateWelcome:
			if msg.String() == "enter" {
				m.state = StatePlayerTurn
				m.log("Game started! Your turn.")
			}

		case StatePlayerTurn:
			switch msg.String() {
			case "up":
				if m.cursorY > 0 { m.cursorY-- }
			case "down":
				if m.cursorY < game.BoardSize-1 { m.cursorY++ }
			case "left":
				if m.cursorX > 0 { m.cursorX-- }
			case "right":
				if m.cursorX < game.BoardSize-1 { m.cursorX++ }
			case "enter", "space":
				// Strzał gracza
				m.handlePlayerShot()
			}

		case StateGameOver:
			if msg.String() == "enter" {
				// Restart (uproszczony - reload aplikacji byłby lepszy, ale tu resetujemy stan)
				return InitialModel(), nil
			}
		}
	}

	// Automatyczna tura bota po krótkim opóźnieniu (symulowanym przez Update loop,
	// ale w TUI lepiej to robić synchronicznie lub przez Cmd)
	if m.state == StateBotTurn {
		// Tutaj robimy ruch bota od razu
		m.handleBotTurn()
	}

	return m, nil
}

func (m *Model) handlePlayerShot() {
	state := m.botView[m.cursorY][m.cursorX]
	if state == game.CellHit || state == game.CellMiss || state == game.CellSunk {
		m.log("Field already shot!")
		return
	}

	// Wykonaj strzał na prawdziwej planszy bota
	res, msg := m.botBoard.Fire(m.cursorX, m.cursorY)

	// Zaktualizuj widok gracza
	// Jeśli zatopiony, musimy pobrać info z planszy bota, które pola są zatopione
	// Ponieważ Fire() w logic.go aktualizuje stan na planszy bota
	// Musimy skopiować ten stan do botView w miejscach gdzie nastąpiła zmiana.
	// Najprościej: zaktualizować komórkę i sprawdzić czy statek zatonął.

	m.botView[m.cursorY][m.cursorX] = res

	if res == game.CellSunk {
		// Znajdź statek na planszy bota, który ma ten ID (nie mamy ID w widoku, ale board.Fire aktualizuje grid)
		// Pobierzemy stan bezpośrednio z botBoard dla tego pola i okolic (autouzupełnianie)
		// Bruteforce update view from board for changed cells
		m.syncBotView()
	}

	m.log(fmt.Sprintf("Player shoots at %s: %s", coordStr(m.cursorX, m.cursorY), msg))

	if m.botBoard.AllShipsSunk() {
		m.state = StateGameOver
		m.winner = "PLAYER"
		m.log("Congratulations! You won!")
		return
	}

	if res == game.CellMiss {
		m.state = StateBotTurn
		m.log("Bot's turn...")
	} else {
		m.log("Hit! Shoot again.")
	}
}

func (m *Model) handleBotTurn() {
	// Bot myśli...
	bx, by := m.botAI.GetBestMove()

	res, msg := m.playerBoard.Fire(bx, by)

	// Aktualizacja wiedzy bota
	m.botAI.UpdateGameState(bx, by, res)
	// Jeśli zatopiony, bot w logic.go sam sobie oznacza Sunk na planszy OpponentGrid poprzez UpdateGameState

	m.log(fmt.Sprintf("Bot shoots at %s: %s", coordStr(bx, by), msg))

	if m.playerBoard.AllShipsSunk() {
		m.state = StateGameOver
		m.winner = "BOT"
		m.log("Game Over. Bot wins!")
		return
	}

	if res == game.CellMiss {
		m.state = StatePlayerTurn
		m.log("Your turn.")
	} else {
		// Bot strzela dalej
		// W TUI musimy pozwolić pętli obsłużyć rendering, więc wywołamy to w następnym cyklu lub rekurencyjnie?
		// Rekurencja zablokuje UI. Lepiej nie.
		// Ale w 'Update' mamy 'if m.state == StateBotTurn'.
		// Jeśli zostawimy StateBotTurn, to w następnej klatce znowu wejdzie tutaj.
		// Więc jest OK.
	}
}

func (m *Model) syncBotView() {
	// Synchronizuje widok gracza z faktycznym stanem planszy bota (dla pól odkrytych)
	// Służy głównie do przeniesienia efektu "MarkSurroundingAsMiss" i "Sunk" na widok gracza
	for y := 0; y < game.BoardSize; y++ {
		for x := 0; x < game.BoardSize; x++ {
			realState := m.botBoard.Grid[y][x].State
			if realState == game.CellSunk || (realState == game.CellMiss && m.botView[y][x] == game.CellWater && isNearSunk(m.botBoard, x, y)) {
				m.botView[y][x] = realState
			}
		}
	}
}
func isNearSunk(b *game.Board, x, y int) bool {
	// Sprawdza czy pole jest miss z powodu autouzupełniania (czyli czy sąsiaduje z Sunk)
	// To jest pewne uproszczenie wizualne.
	// W logic.go autouzupełnianie ustawia CellMiss.
	// Jeśli w botBoard jest CellMiss, a w botView było Water, to znaczy że to 'Miss' powstało automatycznie (bo gracz tam nie strzelał).
	// Ale gracz mógł wcześniej tam strzelić i było Pudło.
	// Musimy rozróżnić.
	// W sumie: jeśli na botBoard jest Miss/Hit/Sunk, a my to właśnie odkryliśmy (np. przez zatopienie), to pokazujemy.
	// Ale nie chcemy pokazywać statków (Ship).
	// W funkcji Fire() autouzupełnianie zmienia Water -> Miss.
	// Więc możemy bezpiecznie przepisać wszystko co nie jest Ship i nie jest Water (chyba że było Water).
	return false
}


func (m Model) View() string {
	if m.width == 0 {
		return "Loading..."
	}

	var s strings.Builder

	s.WriteString(titleStyle.Render("BATTLESHIP 2.0 - UNBEATABLE AI"))
	s.WriteString("\n\n")

	// Renderowanie plansz obok siebie
	playerView := renderBoard(m.playerBoard.Grid, false, -1, -1)
	botViewStr := renderBoardView(m.botView, true, m.cursorX, m.cursorY)

	boards := lipgloss.JoinHorizontal(lipgloss.Top,
		boardBorderStyle.Render(lipgloss.JoinVertical(lipgloss.Center, "PLAYER FLEET", playerView)),
		"    ",
		boardBorderStyle.Render(lipgloss.JoinVertical(lipgloss.Center, "OPPONENT SECTOR", botViewStr)),
	)

	s.WriteString(boards)
	s.WriteString("\n\n")

	// Logi
	s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("#AAA")).Render("LOGS:"))
	s.WriteString("\n")
	startLog := 0
	if len(m.logs) > 5 {
		startLog = len(m.logs) - 5
	}
	for i := startLog; i < len(m.logs); i++ {
		s.WriteString(fmt.Sprintf("> %s\n", m.logs[i]))
	}

	s.WriteString("\n")
	if m.state == StateGameOver {
		resColor := lipgloss.Color("#0F0")
		if m.winner == "BOT" { resColor = lipgloss.Color("#F00") }
		s.WriteString(lipgloss.NewStyle().Foreground(resColor).Bold(true).Render(fmt.Sprintf("GAME OVER - %s WINS!", m.winner)))
		s.WriteString("\nPress Enter to restart.")
	} else if m.state == StateBotTurn {
		s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("208")).Render("Bot is thinking..."))
	} else {
		s.WriteString(subtleStyle.Render("Arrows: Move | Enter: Fire | Q: Quit"))
	}

	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, s.String())
}

func renderBoard(grid [][]game.Cell, showShips bool, curX, curY int) string {
	var s strings.Builder

	// Nagłówek kolumn
	s.WriteString("  ")
	for i := 0; i < len(grid); i++ {
		s.WriteString(fmt.Sprintf("%d ", i+1))
	}
	s.WriteString("\n")

	for y := 0; y < len(grid); y++ {
		s.WriteString(fmt.Sprintf("%c ", 'A'+y))
		for x := 0; x < len(grid[y]); x++ {
			cell := grid[y][x]
			char := ""

			switch cell.State {
			case game.CellWater:
				if showShips && cell.ShipID != -1 {
					char = shipStyle.Render()
				} else {
					char = waterStyle.Render()
				}
			case game.CellShip: // To teoretycznie nie występuje jako stan widoczny (to jest ukryte pod Water z ShipID, albo Hit)
				// Ale w mojej logice w logic.go, CellShip oznacza "żywy statek".
				if showShips {
					char = shipStyle.Render()
				} else {
					char = waterStyle.Render()
				}
			case game.CellHit:
				char = hitStyle.Render()
			case game.CellMiss:
				char = missStyle.Render()
			case game.CellSunk:
				char = sunkStyle.Render()
			}

			// Kursor (tylko dla prawej planszy zwykle, ale tu funkcja generyczna)
			if x == curX && y == curY {
				char = cursorStyle.Render(char)
			}

			s.WriteString(char + " ")
		}
		s.WriteString("\n")
	}
	return s.String()
}

func renderBoardView(view [][]game.CellState, isCursorActive bool, curX, curY int) string {
	// Konwersja view na grid dla renderera
	// Potrzebujemy tymczasowej struktury lub duplikacji kodu renderera.
	// Zduplikuję logicznie dla prostoty.
	var s strings.Builder

	s.WriteString("  ")
	for i := 0; i < len(view); i++ {
		if i < 9 { s.WriteString(" ") } // wyrównanie
		s.WriteString(fmt.Sprintf("%d ", i+1))
	}
	s.WriteString("\n")

	for y := 0; y < len(view); y++ {
		s.WriteString(fmt.Sprintf("%c ", 'A'+y))
		for x := 0; x < len(view[y]); x++ {
			state := view[y][x]
			char := ""
			switch state {
			case game.CellWater: // Unknown
				char = waterStyle.Render()
			case game.CellHit:
				char = hitStyle.Render()
			case game.CellMiss:
				char = missStyle.Render()
			case game.CellSunk:
				char = sunkStyle.Render()
			}

			if isCursorActive && x == curX && y == curY {
				char = cursorStyle.Render(char)
			}
			s.WriteString(char + " ")
		}
		s.WriteString("\n")
	}
	return s.String()
}

func (m *Model) log(msg string) {
	m.logs = append(m.logs, msg)
}

func coordStr(x, y int) string {
	return fmt.Sprintf("%c%d", 'A'+y, x+1)
}
