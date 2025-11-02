use crate::utils::{Board, CellState, Position};
use rand::Rng;

/// Sprawdza, czy statek o danej długości można umieścić w danym miejscu,
/// uwzględniając regułę 3x3 (statki nie mogą się stykać).
pub fn can_place_ship(board: &Board, ship_length: u8, pos: Position, is_horizontal: bool) -> bool {
    let (width, height) = (board[0].len() as i16, board.len() as i16);
    let (x, y) = (pos.x as i16, pos.y as i16);

    // Sprawdzenie, czy sam statek mieści się na planszy
    if is_horizontal {
        if x + ship_length as i16 > width { return false; }
    } else {
        if y + ship_length as i16 > height { return false; }
    }

    // Sprawdzenie otoczki 3x3 wokół każdego segmentu
    for i in 0..ship_length as i16 {
        let (current_x, current_y) = if is_horizontal { (x + i, y) } else { (x, y + i) };

        for dy in -1..=1 {
            for dx in -1..=1 {
                let check_x = current_x + dx;
                let check_y = current_y + dy;

                if check_x >= 0 && check_x < width && check_y >= 0 && check_y < height {
                    if board[check_y as usize][check_x as usize] != CellState::Empty {
                        return false;
                    }
                }
            }
        }
    }
    true
}

/// Generuje jeden losowy, ale poprawny (zgodny z 3x3) układ statków.
pub fn generate_random_valid_layout(width: u8, height: u8, ship_lengths: &[u8]) -> Option<Board> {
    let mut board = vec![vec![CellState::Empty; width as usize]; height as usize];
    let mut rng = rand::thread_rng();

    for &ship_length in ship_lengths {
        let mut placed = false;
        for _ in 0..200 { // Limit prób
            let is_horizontal = rng.gen();
            let x = rng.gen_range(0..width);
            let y = rng.gen_range(0..height);

            if can_place_ship(&board, ship_length, Position { x, y }, is_horizontal) {
                for i in 0..ship_length {
                    if is_horizontal {
                        board[y as usize][(x + i) as usize] = CellState::Sunk; // Placeholder
                    } else {
                        board[(y + i) as usize][x as usize] = CellState::Sunk;
                    }
                }
                placed = true;
                break;
            }
        }
        if !placed { return None; }
    }
    Some(board)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_place_ship_3x3_rule_adjacent() {
        let mut board = vec![vec![CellState::Empty; 10]; 10];
        board[2][2] = CellState::Sunk; // Istniejący statek
        // Próba umieszczenia obok (nielegalne)
        assert!(!can_place_ship(&board, 3, Position { x: 2, y: 3 }, true));
    }

    #[test]
    fn test_can_place_ship_3x3_rule_diagonal() {
        let mut board = vec![vec![CellState::Empty; 10]; 10];
        board[2][2] = CellState::Sunk;
        // Próba umieszczenia na ukos (nielegalne)
        assert!(!can_place_ship(&board, 3, Position { x: 3, y: 3 }, true));
    }

    #[test]
    fn test_can_place_ship_3x3_rule_valid() {
        let mut board = vec![vec![CellState::Empty; 10]; 10];
        board[2][2] = CellState::Sunk;
        // Próba umieszczenia w dozwolonej odległości
        assert!(can_place_ship(&board, 3, Position { x: 4, y: 2 }, true));
    }

    #[test]
    fn test_generate_layout_succeeds_with_3x3() {
        let ship_lengths = [5, 4, 3, 3, 2];
        let layout = generate_random_valid_layout(10, 10, &ship_lengths);
        assert!(layout.is_some());
    }
}
