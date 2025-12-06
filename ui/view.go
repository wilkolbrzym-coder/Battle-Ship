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

	// Kolory komórek - wyraźniejsze rozróżnienie
	waterStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#244")).SetString("·") // Ciemny szary
	shipStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#DDD")).SetString("■") // Jasny szary
	hitStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("#FFA500")).SetString("X") // Pomarańczowy dla trafienia
	missStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#55F")).SetString("○") // Niebieski dla pudła
	sunkStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#F00")).Bold(true).SetString("#") // Czerwony dla zatopienia
	cursorStyle = lipgloss.NewStyle().Background(lipgloss.Color("#444")) // Tło kursora

	// Układ
	boardBorderStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("63")).
				Padding(0, 1)

	logStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#AAA"))
)

type GameState int

const (
	StateWelcome GameState = iota
	StatePlayerTurn
	StateBotTurn
	StateGameOver
	StateHelp
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

	// Inicjalizacja gracza
	pBoard := game.NewBoard(config.Size)
	// Gracz też dostaje optymalny układ, żeby było sprawiedliwie
	if err := pBoard.PlaceShipsRandomly(config); err != nil {
		panic("Nie udało się stworzyć planszy gracza")
	}

	// Inicjalizacja bota
	botAI := ai.NewQuantumHunter(config)
	bBoard := botAI.GetOptimizedLayout()

	botView := make([][]game.CellState, config.Size)
	for i := range botView {
		botView[i] = make([]game.CellState, config.Size)
		for j := range botView[i] {
			botView[i][j] = game.CellWater
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
		logs:        []string{"Welcome to Battleship 2.0!", "Press '?' for help, Enter to start."},
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

		if msg.String() == "?" {
			if m.state != StateHelp {
				m.log("Showing help...")
				// Zapisz poprzedni stan? Uproszczenie: help jest osobnym stanem
				// Ale lepiej zrobić toggle overlay.
				// Tutaj: jeśli nie jesteśmy w menu, pauzujemy.
				if m.state != StateGameOver && m.state != StateWelcome {
					// Dla prostoty, logujemy legendę zamiast zmiany stanu ekranu
					m.log("LEGEND: ■ Ship, X Hit, # Sunk, ○ Miss")
					m.log("CONTROLS: Arrows to move, Enter/Space to fire")
					return m, nil
				}
			}
		}

		switch m.state {
		case StateWelcome:
			if msg.String() == "enter" {
				m.state = StatePlayerTurn
				m.log("Game started! Your turn.")
			}

		case StatePlayerTurn:
			switch msg.String() {
			case "up", "k":
				if m.cursorY > 0 { m.cursorY-- }
			case "down", "j":
				if m.cursorY < game.BoardSize-1 { m.cursorY++ }
			case "left", "h":
				if m.cursorX > 0 { m.cursorX-- }
			case "right", "l":
				if m.cursorX < game.BoardSize-1 { m.cursorX++ }
			case "enter", "space":
				m.handlePlayerShot()
			}

		case StateGameOver:
			if msg.String() == "enter" {
				return InitialModel(), nil
			}
		}
	}

	if m.state == StateBotTurn {
		m.handleBotTurn()
	}

	return m, nil
}

func (m *Model) handlePlayerShot() {
	if m.cursorY < 0 || m.cursorY >= game.BoardSize || m.cursorX < 0 || m.cursorX >= game.BoardSize {
		return // Sanity check
	}

	state := m.botView[m.cursorY][m.cursorX]
	if state == game.CellHit || state == game.CellMiss || state == game.CellSunk {
		m.log("Field already shot! Choose another.")
		return
	}

	// Strzał
	res, msg := m.botBoard.Fire(m.cursorX, m.cursorY)
	m.botView[m.cursorY][m.cursorX] = res // Aktualizacja lokalnego widoku

	if res == game.CellSunk {
		m.syncBotView() // Pociągnij info o całym zatopionym statku
	}

	m.log(fmt.Sprintf("You fired at %s: %s", coordStr(m.cursorX, m.cursorY), msg))

	if m.botBoard.AllShipsSunk() {
		m.state = StateGameOver
		m.winner = "PLAYER"
		m.log("Congratulations! You defeated the AI!")
		return
	}

	if res == game.CellMiss {
		m.state = StateBotTurn
		m.log("Bot is calculating 50,000 realities...")
	} else {
		m.log("Hit! Take another shot!")
	}
}

func (m *Model) handleBotTurn() {
	bx, by, confidence := m.botAI.GetBestMove()

	// Formatowanie pewności siebie bota
	confStr := fmt.Sprintf("%.1f%%", confidence*100)

	res, msg := m.playerBoard.Fire(bx, by)

	m.botAI.UpdateGameState(bx, by, res)

	botMsg := fmt.Sprintf("Bot targets %s (conf: %s): %s", coordStr(bx, by), confStr, msg)
	m.log(botMsg)

	if m.playerBoard.AllShipsSunk() {
		m.state = StateGameOver
		m.winner = "BOT"
		m.log("Game Over. The Quantum Hunter prevails.")
		return
	}

	if res == game.CellMiss {
		m.state = StatePlayerTurn
		m.log("Bot missed. Your turn.")
	} else {
		// Bot trafia - ma dodatkowy ruch (zasady Battleship często tak mówią, a to też przyspiesza grę bota)
		// Tutaj trzymamy się zasady, że jak trafisz to strzelasz dalej.
		m.log("Bot hit! Bot fires again...")
	}
}

func (m *Model) syncBotView() {
	// Kopiuje stany Sunk i Miss (autouzupełnione) z botBoard do botView
	for y := 0; y < game.BoardSize; y++ {
		for x := 0; x < game.BoardSize; x++ {
			realState := m.botBoard.Grid[y][x].State
			currentView := m.botView[y][x]

			// Jeśli pole jest zatopione, pokaż to
			if realState == game.CellSunk {
				m.botView[y][x] = game.CellSunk
			}
			// Jeśli pole jest pudłem, a my go nie widzieliśmy (autouzupełnianie), pokaż to
			if realState == game.CellMiss && currentView == game.CellWater {
				// Sprawdź czy to autouzupełnianie (sąsiad Sunk)
				if isNearSunk(m.botBoard, x, y) {
					m.botView[y][x] = game.CellMiss
				}
			}
		}
	}
}

func isNearSunk(b *game.Board, x, y int) bool {
	// Sprawdź czy (x,y) sąsiaduje z jakimś Sunk (w tym po skosie)
	for dy := -1; dy <= 1; dy++ {
		for dx := -1; dx <= 1; dx++ {
			nx, ny := x+dx, y+dy
			if nx >= 0 && nx < game.BoardSize && ny >= 0 && ny < game.BoardSize {
				if b.Grid[ny][nx].State == game.CellSunk {
					return true
				}
			}
		}
	}
	return false
}

func (m Model) View() string {
	if m.width == 0 {
		return "Initializing Quantum Engine..."
	}

	var s strings.Builder

	s.WriteString(titleStyle.Render(" BATTLESHIP 2.0 :: QUANTUM HUNTER EDITION "))
	s.WriteString("\n\n")

	playerView := renderBoard(m.playerBoard.Grid, true, -1, -1) // Gracz widzi swoje statki
	// Gracz widzi botView (swoją wiedzę o planszy bota), kursor jest aktywny
	botViewStr := renderBoardView(m.botView, m.state == StatePlayerTurn, m.cursorX, m.cursorY)

	boards := lipgloss.JoinHorizontal(lipgloss.Top,
		boardBorderStyle.Render(lipgloss.JoinVertical(lipgloss.Center, "YOUR FLEET", playerView)),
		"    ",
		boardBorderStyle.Render(lipgloss.JoinVertical(lipgloss.Center, "TARGET SECTOR", botViewStr)),
	)

	s.WriteString(boards)
	s.WriteString("\n\n")

	s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("#AAA")).Bold(true).Render("COMBAT LOG:"))
	s.WriteString("\n")

	// Pokaż ostatnie 6 logów
	limit := 6
	start := 0
	if len(m.logs) > limit {
		start = len(m.logs) - limit
	}
	for i := start; i < len(m.logs); i++ {
		line := m.logs[i]
		// Kolorowanie logów
		if strings.Contains(line, "Hit") || strings.Contains(line, "targets") {
			s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("#FFA500")).Render("> "+line) + "\n")
		} else if strings.Contains(line, "Sunk") || strings.Contains(line, "defeated") || strings.Contains(line, "Game Over") {
			s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("#F00")).Bold(true).Render("> "+line) + "\n")
		} else {
			s.WriteString(logStyle.Render("> "+line) + "\n")
		}
	}

	s.WriteString("\n")

	if m.state == StateGameOver {
		resColor := lipgloss.Color("#0F0")
		if m.winner == "BOT" { resColor = lipgloss.Color("#F00") }
		s.WriteString(lipgloss.NewStyle().Foreground(resColor).Bold(true).Render(fmt.Sprintf("GAME OVER - %s WINS!", m.winner)))
		s.WriteString("\nPress Enter to restart.")
	} else if m.state == StateBotTurn {
		s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("208")).Render("Quantum AI is analyzing timelines..."))
	} else {
		s.WriteString(subtleStyle.Render("ARROWS/HJKL: Move | ENTER/SPACE: Fire | ?: Legend | Q: Quit"))
	}

	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, s.String())
}

func renderBoard(grid [][]game.Cell, showShips bool, curX, curY int) string {
	var s strings.Builder

	// Nagłówek kolumn
	s.WriteString("  ")
	for i := 0; i < len(grid); i++ {
		if i < 9 { s.WriteString(" ") }
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
			case game.CellShip: // Stan wewnętrzny
				if showShips { char = shipStyle.Render() } else { char = waterStyle.Render() }
			case game.CellHit:
				char = hitStyle.Render()
			case game.CellMiss:
				char = missStyle.Render()
			case game.CellSunk:
				char = sunkStyle.Render()
			}

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
	var s strings.Builder
	s.WriteString("  ")
	for i := 0; i < len(view); i++ {
		if i < 9 { s.WriteString(" ") }
		s.WriteString(fmt.Sprintf("%d ", i+1))
	}
	s.WriteString("\n")

	for y := 0; y < len(view); y++ {
		s.WriteString(fmt.Sprintf("%c ", 'A'+y))
		for x := 0; x < len(view[y]); x++ {
			state := view[y][x]
			char := ""
			switch state {
			case game.CellWater:
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
