mod utils;
mod engine;
mod analysis;
mod genetics;

use wasm_bindgen::prelude::*;
use crate::engine::QuantumHunter;
use crate::utils::{Position, CellState, Ship};

#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    Ok(())
}

#[wasm_bindgen]
pub struct FeniksAI {
    hunter: QuantumHunter,
    player_ships: Vec<Ship>,
}

#[wasm_bindgen]
impl FeniksAI {
    #[wasm_bindgen(constructor)]
    pub fn new() -> FeniksAI {
        let width = 10;
        let height = 10;
        let ship_lengths = vec![5, 4, 3, 3, 2];

        let player_ships = genetics::run_genetic_algorithm(width, height, &ship_lengths);

        FeniksAI {
            hunter: QuantumHunter::new(width, height, &ship_lengths),
            player_ships,
        }
    }

    pub fn get_best_move(&self) -> Position {
        let (x, y) = self.hunter.find_best_move();
        Position { x, y }
    }

    #[wasm_bindgen(getter = playerShips)]
    pub fn get_player_ships_for_js(&self) -> js_sys::Array {
        self.player_ships.iter().map(|ship| {
            let obj = js_sys::Object::new();
            js_sys::Reflect::set(&obj, &"id".into(), &JsValue::from(ship.id)).unwrap();
            js_sys::Reflect::set(&obj, &"length".into(), &JsValue::from(ship.length)).unwrap();
            js_sys::Reflect::set(&obj, &"positions".into(), &ship.get_positions_for_js()).unwrap();
            JsValue::from(obj)
        }).collect()
    }

    pub fn apply_shot_result(&mut self, x: u8, y: u8, result: CellState) {
        self.hunter.apply_shot(Position { x, y }, result);
    }
}
