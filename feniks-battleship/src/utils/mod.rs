use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CellState {
    Empty,
    Miss,
    Hit,
    Sunk,
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Position {
    pub x: u8,
    pub y: u8,
}

#[wasm_bindgen]
#[derive(Clone, Debug)]
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
        Ship {
            id,
            length,
            positions: Vec::new(),
            hits: 0,
        }
    }
}

pub type Board = Vec<Vec<CellState>>;

pub fn new_board(width: u8, height: u8) -> Board {
    vec![vec![CellState::Empty; width as usize]; height as usize]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_board() {
        let board = new_board(10, 10);
        assert_eq!(board.len(), 10);
    }

    #[test]
    fn test_ship_creation_internal() {
        let mut ship = Ship::new(1, 4);
        ship.positions.push(Position { x: 0, y: 0});
        assert!(!ship.positions.is_empty());
    }
}
