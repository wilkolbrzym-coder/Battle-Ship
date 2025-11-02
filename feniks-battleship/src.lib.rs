mod utils;
mod engine;
mod analysis;

use wasm_bindgen::prelude::*;
use console_error_panic_hook;
use crate::engine::QuantumHunter;
use crate::utils::{Position, CellState};

#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();
    Ok(())
}

#[wasm_bindgen]
pub struct FeniksAI {
    hunter: QuantumHunter,
}

#[wasm_bindgen]
impl FeniksAI {
    #[wasm_bindgen(constructor)]
    pub fn new() -> FeniksAI {
        let width = 10;
        let height = 10;
        let ship_lengths = vec![5, 4, 3, 3, 2];

        FeniksAI {
            hunter: QuantumHunter::new(width, height, &ship_lengths),
        }
    }

    pub fn get_best_move(&self) -> Position {
        let (x, y) = self.hunter.find_best_move();
        Position { x, y }
    }

    // Nowa metoda do informowania AI o wyniku strzału
    pub fn apply_shot_result(&mut self, x: u8, y: u8, result: CellState) {
        self.hunter.apply_shot(Position { x, y }, result);
    }
}
