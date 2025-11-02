mod hypothesis;

use crate::utils::{Board, CellState, Position};
use crate::analysis::solver::global_constraint_solver;
use crate::analysis::alpha_beta::verify_best_moves;
use std::collections::HashMap;

const HYPOTHESIS_TARGET: usize = 20_000;
const HYPOTHESIS_THRESHOLD: usize = 15_000;

pub struct QuantumHunter {
    pub all_possible_layouts: Vec<Board>,
    known_board: Board,
    remaining_ship_lengths: Vec<u8>,
    width: u8,
    height: u8,
}

impl QuantumHunter {
    pub fn new(width: u8, height: u8, ship_lengths: &[u8]) -> Self {
        // ... (bez zmian)
        let layouts = (0..HYPOTHESIS_TARGET)
            .filter_map(|_| hypothesis::generate_random_valid_layout(width, height, ship_lengths))
            .collect();

        Self {
            all_possible_layouts: layouts,
            known_board: vec![vec![CellState::Empty; width as usize]; height as usize],
            remaining_ship_lengths: ship_lengths.to_vec(),
            width,
            height,
        }
    }

    pub fn apply_shot(&mut self, pos: Position, result: CellState) {
        // ... (bez zmian)
        self.known_board[pos.y as usize][pos.x as usize] = result;

        self.all_possible_layouts.retain(|layout| {
            let layout_cell = layout[pos.y as usize][pos.x as usize];
            match result {
                CellState::Hit => layout_cell == CellState::Sunk,
                CellState::Miss => layout_cell == CellState::Empty,
                _ => true,
            }
        });

        if self.all_possible_layouts.len() < HYPOTHESIS_THRESHOLD {
            self.regenerate_hypotheses();
        }

        global_constraint_solver(&mut self.known_board, &self.remaining_ship_lengths);
    }

    fn regenerate_hypotheses(&mut self) {
        // ... (bez zmian)
        let needed = HYPOTHESIS_TARGET - self.all_possible_layouts.len();
        for _ in 0..needed {
            if let Some(new_layout) = hypothesis::generate_random_valid_layout(self.width, self.height, &self.remaining_ship_lengths) {
                let is_consistent = self.known_board.iter().enumerate().all(|(y, row)| {
                    row.iter().enumerate().all(|(x, &cell_state)| {
                        match cell_state {
                            CellState::Miss => new_layout[y][x] == CellState::Empty,
                            CellState::Hit => new_layout[y][x] == CellState::Sunk,
                            _ => true,
                        }
                    })
                });

                if is_consistent {
                    self.all_possible_layouts.push(new_layout);
                }
            }
        }
    }

    pub fn find_best_move(&self) -> (u8, u8) {
        if self.all_possible_layouts.is_empty() { return (0, 0); }

        let largest_remaining_ship = self.remaining_ship_lengths.iter().max().cloned().unwrap_or(0);
        let mut final_scores = vec![vec![0.0f64; self.width as usize]; self.height as usize];

        // Obliczamy ogólną mapę ciepła
        let mut general_heat_map = vec![vec![0u32; self.width as usize]; self.height as usize];
        for layout in &self.all_possible_layouts {
            for y in 0..self.height {
                for x in 0..self.width {
                    if layout[y as usize][x as usize] == CellState::Sunk {
                        general_heat_map[y as usize][x as usize] += 1;
                    }
                }
            }
        }

        // Obliczamy VoI
        for y in 0..self.height as usize {
            for x in 0..self.width as usize {
                if self.known_board[y][x] == CellState::Empty {
                    let probability = general_heat_map[y][x] as f64 / self.all_possible_layouts.len() as f64;
                    // Prosty VoI: im bliżej 50% szansy, tym więcej informacji
                    let voi_score = 1.0 - (probability - 0.5).abs() * 2.0;

                    // Ważymy wynik: 80% VoI, 20% czyste prawdopodobieństwo
                    // Jeśli polujemy na duży statek, zwiększamy wagę VoI
                    let voi_weight = if largest_remaining_ship >= 4 { 0.8 } else { 0.5 };

                    final_scores[y][x] = voi_score * voi_weight + probability * (1.0 - voi_weight);
                }
            }
        }

        // Znajdź najlepsze ruchy na podstawie połączonego wyniku
        let mut moves_with_scores = Vec::new();
        for y in 0..self.height {
            for x in 0..self.width {
                if self.known_board[y as usize][x as usize] == CellState::Empty {
                    moves_with_scores.push(((x, y), final_scores[y as usize][x as usize]));
                }
            }
        }

        moves_with_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        let top_moves: Vec<(u8, u8)> = moves_with_scores.iter().take(5).map(|&(mv, _)| mv).collect();

        if top_moves.is_empty() { return (0, 0); }
        verify_best_moves(&self.known_board, &top_moves)
    }
}
