mod hypothesis;

use crate::utils::{Board, CellState, Ship, Position};
use crate::analysis::solver::global_constraint_solver;
use crate::analysis::alpha_beta::verify_best_moves;

pub struct QuantumHunter {
    pub all_possible_layouts: Vec<Board>,
    known_board: Board,
    remaining_ship_lengths: Vec<u8>,
    width: u8,
    height: u8,
}

impl QuantumHunter {
    pub fn new(width: u8, height: u8, ship_lengths: &[u8]) -> Self {
        let mut layouts = Vec::new();
        for _ in 0..50_000 {
            if let Some(layout) = hypothesis::generate_random_valid_layout(width, height, ship_lengths) {
                layouts.push(layout);
            }
        }

        Self {
            all_possible_layouts: layouts,
            known_board: vec![vec![CellState::Empty; width as usize]; height as usize],
            remaining_ship_lengths: ship_lengths.to_vec(),
            width,
            height,
        }
    }

    pub fn apply_shot(&mut self, pos: Position, result: CellState) {
        self.known_board[pos.y as usize][pos.x as usize] = result;
        self.all_possible_layouts.retain(|layout| {
            let layout_cell = layout[pos.y as usize][pos.x as usize];
            match result {
                CellState::Hit => layout_cell == CellState::Sunk,
                CellState::Miss => layout_cell == CellState::Empty,
                _ => true,
            }
        });
        global_constraint_solver(&mut self.known_board, &self.remaining_ship_lengths);
    }

    pub fn find_best_move(&self) -> (u8, u8) {
        if self.all_possible_layouts.is_empty() { return (0, 0); }

        let mut heat_map = vec![vec![0u32; self.width as usize]; self.height as usize];
        for layout in &self.all_possible_layouts {
            for y in 0..self.height {
                for x in 0..self.width {
                    if layout[y as usize][x as usize] == CellState::Sunk {
                        heat_map[y as usize][x as usize] += 1;
                    }
                }
            }
        }

        // Zbieramy wszystkie ruchy i ich "ciepło"
        let mut moves_with_heat = Vec::new();
        for y in 0..self.height {
            for x in 0..self.width {
                if self.known_board[y as usize][x as usize] == CellState::Empty {
                    moves_with_heat.push(((x, y), heat_map[y as usize][x as usize]));
                }
            }
        }

        // Sortujemy, aby znaleźć najlepsze ruchy
        moves_with_heat.sort_by(|a, b| b.1.cmp(&a.1));

        // Bierzemy do 5 najlepszych ruchów do weryfikacji
        let top_moves: Vec<(u8, u8)> = moves_with_heat.iter().take(5).map(|&(mv, _)| mv).collect();

        if top_moves.is_empty() {
            return (0, 0); // Nie ma już możliwych ruchów
        }

        // Przekazujemy do weryfikacji Alpha-Beta
        verify_best_moves(&self.known_board, &top_moves)
    }
}
