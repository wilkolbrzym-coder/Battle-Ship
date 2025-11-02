use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum CellState {
    Empty,
    Miss,
    Hit,
    Sunk,
}

impl From<u8> for CellState {
    fn from(val: u8) -> Self {
        match val {
            1 => CellState::Miss,
            2 => CellState::Hit,
            3 => CellState::Sunk,
            _ => CellState::Empty,
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Position {
    pub x: u8,
    pub y: u8,
}

#[wasm_bindgen]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Ship {
    pub id: u8,
    pub length: u8,
    #[wasm_bindgen(getter_with_clone)]
    pub positions: Vec<Position>,
    pub hits: u8,
}

#[wasm_bindgen]
impl Ship {
    #[wasm_bindgen(constructor)]
    pub fn new(id: u8, length: u8) -> Ship {
        Ship { id, length, positions: Vec::new(), hits: 0 }
    }
}

pub type Board = Vec<Vec<CellState>>;
