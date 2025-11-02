mod analysis;
mod engine;
mod genetics;
mod utils;

use wasm_bindgen::prelude::*;
use crate::engine::QuantumHunter;
use crate::genetics::GeneticArchitect;
use crate::utils::{Position, CellState, Ship};

#[wasm_bindgen]
pub struct JsGameEngine {
    hunter: QuantumHunter,
    player_board: Vec<Vec<u8>>,
    ship_lengths: Vec<u8>,
    width: u8,
    height: u8,
}

#[wasm_bindgen]
impl JsGameEngine {
    pub fn new(width: u8, height: u8, ship_lengths: Vec<u8>) -> Self {
        console_error_panic_hook::set_once();
        Self {
            hunter: QuantumHunter::new_empty(width, height),
            player_board: vec![vec![0; width as usize]; height as usize],
            ship_lengths,
            width,
            height,
        }
    }

    #[wasm_bindgen]
    pub fn start_ai_processing(&mut self) {
        let architect = GeneticArchitect::new(self.width, self.height, self.ship_lengths.clone());
        let best_fleet: Vec<Ship> = architect.generate_best_layout(100, 50);

        let mut player_board_repr = vec![vec![0; self.width as usize]; self.height as usize];
        for ship in &best_fleet {
            for pos in &ship.positions {
                if (pos.y as usize) < self.height as usize && (pos.x as usize) < self.width as usize {
                    player_board_repr[pos.y as usize][pos.x as usize] = 1;
                }
            }
        }
        self.player_board = player_board_repr;

        self.hunter = QuantumHunter::new(self.width, self.height, &self.ship_lengths);
        self.hunter.initialize();
    }

    pub fn get_player_fleet_layout(&self) -> Vec<u8> {
        self.player_board.clone().into_iter().flatten().collect()
    }

    pub fn get_best_bot_move(&self) -> Position {
        let (x, y) = self.hunter.find_best_move();
        Position { x, y }
    }

    pub fn apply_bot_shot_result(&mut self, x: u8, y: u8, result: u8) {
        let cell_result = match result {
            1 => CellState::Miss,
            2 => CellState::Hit,
            _ => CellState::Empty,
        };
        self.hunter.apply_shot(Position { x, y }, cell_result);
    }
}
