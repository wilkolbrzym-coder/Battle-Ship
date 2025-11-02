mod hypothesis;

use crate::utils::{Board, CellState, Position};
use crate::analysis::solver::global_constraint_solver;
use crate::analysis::alpha_beta::verify_best_moves;
use rayon::prelude::*;
use std::collections::HashMap;

const HYPOTHESIS_TARGET: usize = 50_000;
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
        Self {
            all_possible_layouts: Vec::new(),
            known_board: vec![vec![CellState::Empty; width as usize]; height as usize],
            remaining_ship_lengths: ship_lengths.to_vec(),
            width, height,
        }
    }

    pub fn new_empty(width: u8, height: u8) -> Self {
        Self {
            all_possible_layouts: vec![],
            known_board: vec![vec![CellState::Empty; width as usize]; height as usize],
            remaining_ship_lengths: vec![],
            width, height,
        }
    }

    pub fn initialize(&mut self) {
        self.regenerate_hypotheses();
    }

    pub fn apply_shot(&mut self, pos: Position, result: CellState) {
        self.known_board[pos.y as usize][pos.x as usize] = result;
        let layouts = std::mem::take(&mut self.all_possible_layouts);
        self.all_possible_layouts = layouts.into_par_iter().filter(|layout| {
            let cell = layout[pos.y as usize][pos.x as usize];
            match result {
                CellState::Hit => cell == CellState::Sunk,
                CellState::Miss => cell == CellState::Empty,
                _ => true,
            }
        }).collect();
        if self.all_possible_layouts.len() < HYPOTHESIS_THRESHOLD {
            self.regenerate_hypotheses();
        }
        global_constraint_solver(&mut self.known_board, &self.remaining_ship_lengths);
    }

    fn regenerate_hypotheses(&mut self) {
        let needed = HYPOTHESIS_TARGET.saturating_sub(self.all_possible_layouts.len());
        if needed == 0 { return; }
        let new_layouts: Vec<Board> = (0..needed).into_par_iter().filter_map(|_| {
            let layout = hypothesis::generate_random_valid_layout(self.width, self.height, &self.remaining_ship_lengths)?;
            let consistent = self.known_board.iter().enumerate().all(|(y, r)| r.iter().enumerate().all(|(x, &cs)| match cs {
                CellState::Miss => layout[y][x] == CellState::Empty,
                CellState::Hit => layout[y][x] == CellState::Sunk,
                _ => true,
            }));
            if consistent { Some(layout) } else { None }
        }).collect();
        self.all_possible_layouts.extend(new_layouts);
    }

    pub fn find_best_move(&self) -> (u8, u8, Vec<Position>, bool) {
        if self.all_possible_layouts.is_empty() { return (self.width / 2, self.height / 2, vec![], false); }
        let largest_ship = self.remaining_ship_lengths.iter().max().cloned().unwrap_or(0);
        let heat_map: HashMap<Position, u32> = self.all_possible_layouts.par_iter().flat_map(|layout| {
            layout.iter().enumerate().flat_map(|(y, row)| row.iter().enumerate().filter(|&(_, &cell)| cell == CellState::Sunk)
                .map(move |(x, _)| Position {x: x as u8, y: y as u8})
            ).collect::<Vec<_>>()
        }).fold(HashMap::new, |mut acc, pos| { *acc.entry(pos).or_insert(0) += 1; acc }).reduce(HashMap::new, |mut a, b| {
            for (pos, count) in b { *a.entry(pos).or_insert(0) += count; } a
        });

        let mut moves = vec![];
        for y in 0..self.height {
            for x in 0..self.width {
                if self.known_board[y as usize][x as usize] == CellState::Empty {
                    let pos = Position {x, y};
                    let prob = *heat_map.get(&pos).unwrap_or(&0) as f64 / self.all_possible_layouts.len() as f64;
                    let voi_w = if largest_ship >= 4 { 0.8 } else { 0.6 };
                    let voi = 1.0 - (prob - 0.5).abs() * 2.0;
                    moves.push(((x, y), voi * voi_w + prob * (1.0 - voi_w)));
                }
            }
        }
        moves.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        let top_5_raw: Vec<(u8, u8)> = moves.iter().take(5).map(|&(mv, _)| mv).collect();
        let (best_x, best_y) = verify_best_moves(&self.known_board, &top_5_raw);
        let top_5_pos = top_5_raw.into_iter().map(|(x, y)| Position {x, y}).collect();
        (best_x, best_y, top_5_pos, false)
    }
}
