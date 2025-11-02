mod analysis;
mod engine;
mod genetics;
mod utils;

use wasm_bindgen::prelude::*;
use crate::engine::QuantumHunter;
use crate::genetics::GeneticArchitect;
use crate::utils::{Position, CellState, Ship, Board};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct GameState {
    opponent_board: Board,
    opponent_ships: Vec<(u8, u8)>,
}

#[wasm_bindgen]
pub struct JsGameEngine {
    hunter: QuantumHunter,
    player_fleet: Vec<Ship>,
    opponent_board: Board,
    opponent_ships: Vec<(u8, u8)>,
    history: Vec<String>,
    width: u8,
    height: u8,
}

#[wasm_bindgen]
impl JsGameEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(size: u8, ship_config: Vec<u8>) -> Self {
        console_error_panic_hook::set_once();
        let opponent_ships = ship_config.into_iter().fold(Vec::<(u8, u8)>::new(), |mut acc, size| {
            if let Some(e) = acc.iter_mut().find(|e| e.0 == size) { e.1 += 1; } else { acc.push((size, 1)); }
            acc
        });
        Self {
            hunter: QuantumHunter::new_empty(size, size),
            player_fleet: vec![],
            opponent_board: vec![vec![CellState::Empty; size as usize]; size as usize],
            opponent_ships,
            history: vec![],
            width: size, height: size,
        }
    }

    pub fn start_ai_processing(&mut self, ship_config: Vec<u8>) {
        let architect = GeneticArchitect::new(self.width, self.height, ship_config.clone());
        self.player_fleet = architect.generate_best_layout(100, 50);
        let remaining: Vec<u8> = self.opponent_ships.iter().flat_map(|&(s, c)| vec![s; c as usize]).collect();
        self.hunter = QuantumHunter::new(self.width, self.height, &remaining);
        self.hunter.initialize();
    }

    pub fn get_player_fleet_layout(&self) -> Vec<u8> {
        let mut board = vec![0; (self.width * self.height) as usize];
        self.player_fleet.iter().flat_map(|s| &s.positions).for_each(|p| {
            board[(p.y * self.width + p.x) as usize] = 1;
        });
        board
    }

    pub fn get_best_bot_move(&self) -> JsValue {
        let (x, y, top_moves, is_guaranteed) = self.hunter.find_best_move();
        serde_wasm_bindgen::to_value(&serde_json::json!({
            "x": x, "y": y, "top_moves": top_moves, "is_guaranteed": is_guaranteed
        })).unwrap()
    }

    pub fn apply_opponent_shot_result(&mut self, x: u8, y: u8, result_code: u8) -> JsValue {
        self.history.push(self.get_game_state());
        let result = CellState::from(result_code);
        self.opponent_board[y as usize][x as usize] = result;
        // Pełna logika gry...
        let updated_cells = vec![serde_json::json!({"x": x, "y": y, "state": result_code})];
        serde_wasm_bindgen::to_value(&serde_json::json!({
            "updated_cells": updated_cells, "game_over": false, "win": false
        })).unwrap()
    }

    pub fn get_game_state(&self) -> String {
        serde_json::to_string(&GameState {
            opponent_board: self.opponent_board.clone(),
            opponent_ships: self.opponent_ships.clone(),
        }).unwrap()
    }

    pub fn set_game_state(&mut self, state_str: String) {
        let state: GameState = serde_json::from_str(&state_str).unwrap();
        self.opponent_board = state.opponent_board;
        self.opponent_ships = state.opponent_ships;
    }

    pub fn get_opponent_board_state(&self) -> JsValue {
        let js_board: Vec<Vec<u8>> = self.opponent_board.iter().map(|row| {
            row.iter().map(|cell| *cell as u8).collect()
        }).collect();
        serde_wasm_bindgen::to_value(&js_board).unwrap()
    }
}
