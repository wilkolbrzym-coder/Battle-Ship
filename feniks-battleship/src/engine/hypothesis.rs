use crate::utils::{Board, CellState, Ship, Position};
use rand::Rng;
use rand::seq::SliceRandom;

// Sprawdza, czy statek można umieścić w danym miejscu na planszy
pub fn can_place_ship(board: &Board, ship_length: u8, pos: Position, is_horizontal: bool) -> bool {
    let (width, height) = (board[0].len() as u8, board.len() as u8);
    let (x, y) = (pos.x, pos.y);

    if is_horizontal {
        if x + ship_length > width { return false; }
        for i in 0..ship_length {
            if board[y as usize][(x + i) as usize] != CellState::Empty { return false; }
        }
    } else {
        if y + ship_length > height { return false; }
        for i in 0..ship_length {
            if board[(y + i) as usize][x as usize] != CellState::Empty { return false; }
        }
    }
    true
}

// Generuje jeden losowy, ale poprawny układ statków
pub fn generate_random_valid_layout(width: u8, height: u8, ship_lengths: &[u8]) -> Option<Board> {
    let mut board = vec![vec![CellState::Empty; width as usize]; height as usize];
    let mut rng = rand::thread_rng();

    for &ship_length in ship_lengths {
        let mut placed = false;
        let mut attempts = 0;
        while !placed && attempts < 100 { // Limit prób, aby uniknąć nieskończonej pętli
            let is_horizontal = rng.gen();
            let x = rng.gen_range(0..width);
            let y = rng.gen_range(0..height);

            if can_place_ship(&board, ship_length, Position { x, y }, is_horizontal) {
                for i in 0..ship_length {
                    if is_horizontal {
                        board[y as usize][(x + i) as usize] = CellState::Sunk; // Używamy Sunk jako placeholdera
                    } else {
                        board[(y + i) as usize][x as usize] = CellState::Sunk;
                    }
                }
                placed = true;
            }
            attempts += 1;
        }
        if !placed {
            return None; // Nie udało się umieścić statku, zwracamy błąd
        }
    }

    // Zamieniamy placeholdery na Empty
    for row in board.iter_mut() {
        for cell in row.iter_mut() {
            if *cell == CellState::Sunk { *cell = CellState::Empty; }
        }
    }

    Some(board)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_place_ship_horizontal_valid() {
        let board = vec![vec![CellState::Empty; 10]; 10];
        assert!(can_place_ship(&board, 4, Position { x: 0, y: 0 }, true));
    }

    #[test]
    fn test_can_place_ship_horizontal_invalid_boundary() {
        let board = vec![vec![CellState::Empty; 10]; 10];
        assert!(!can_place_ship(&board, 4, Position { x: 8, y: 0 }, true));
    }

    #[test]
    fn test_can_place_ship_vertical_valid() {
        let board = vec![vec![CellState::Empty; 10]; 10];
        assert!(can_place_ship(&board, 3, Position { x: 5, y: 5 }, false));
    }

    #[test]
    fn test_generate_layout_succeeds() {
        let ship_lengths = [5, 4, 3, 3, 2];
        let layout = generate_random_valid_layout(10, 10, &ship_lengths);
        assert!(layout.is_some());
    }
}
