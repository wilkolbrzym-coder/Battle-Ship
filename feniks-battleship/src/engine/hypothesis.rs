use crate::utils::{Board, CellState};
use rand::Rng;

pub fn can_place_ship(board: &Board, y: usize, x: usize, length: u8, is_horizontal: bool) -> bool {
    let (height, width) = (board.len(), board[0].len());
    for i in 0..length as usize {
        let (cx, cy) = if is_horizontal { (x + i, y) } else { (x, y + i) };
        if cx >= width || cy >= height { return false; }
        for dy in -1..=1 {
            for dx in -1..=1 {
                let (nx, ny) = ((cx as isize) + dx, (cy as isize) + dy);
                if nx >= 0 && ny >= 0 && nx < width as isize && ny < height as isize {
                    if board[ny as usize][nx as usize] != CellState::Empty {
                        return false;
                    }
                }
            }
        }
    }
    true
}

pub fn generate_random_valid_layout(width: u8, height: u8, ship_lengths: &[u8]) -> Option<Board> {
    let mut board = vec![vec![CellState::Empty; width as usize]; height as usize];
    let mut rng = rand::thread_rng();
    for &length in ship_lengths {
        let mut placed = false;
        for _ in 0..200 {
            let is_horizontal = rng.gen();
            let x = rng.gen_range(0..width as usize);
            let y = rng.gen_range(0..height as usize);
            if can_place_ship(&board, y, x, length, is_horizontal) {
                for i in 0..length as usize {
                    if is_horizontal { board[y][x + i] = CellState::Sunk; }
                    else { board[y + i][x] = CellState::Sunk; }
                }
                placed = true;
                break;
            }
        }
        if !placed { return None; }
    }
    Some(board)
}
