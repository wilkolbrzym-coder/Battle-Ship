use crate::utils::{Board, CellState};

// Sprawdza, czy statek o danej długości może być umieszczony w danym miejscu
fn can_place_ship_at(board: &Board, y: usize, x: usize, length: u8, is_horizontal: bool) -> bool {
    let (height, width) = (board.len(), board[0].len());
    if is_horizontal {
        if x + length as usize > width { return false; }
        (0..length).all(|i| board[y][x + i as usize] == CellState::Empty || board[y][x + i as usize] == CellState::Sunk)
    } else {
        if y + length as usize > height { return false; }
        (0..length).all(|i| board[y + i as usize][x] == CellState::Empty || board[y + i as usize][x] == CellState::Sunk)
    }
}

// Główna funkcja solvera
pub fn global_constraint_solver(board: &mut Board, remaining_ship_lengths: &[u8]) {
    let (height, width) = (board.len(), board[0].len());
    let min_ship_len = *remaining_ship_lengths.iter().min().unwrap_or(&0);

    if min_ship_len == 0 { return; }

    let mut possible_placements = vec![vec![false; width]; height];

    for y in 0..height {
        for x in 0..width {
            if board[y][x] == CellState::Empty {
                for &ship_len in remaining_ship_lengths {
                    // Sprawdzamy w poziomie i w pionie
                    if can_place_ship_at(board, y, x, ship_len, true) || can_place_ship_at(board, y, x, ship_len, false) {
                        possible_placements[y][x] = true;
                        break;
                    }
                }
            }
        }
    }

    // Oznaczamy pola, gdzie nie da się umieścić żadnego statku
    for y in 0..height {
        for x in 0..width {
            if board[y][x] == CellState::Empty && !possible_placements[y][x] {
                board[y][x] = CellState::Miss;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solver_marks_impossible_cells() {
        let mut board = vec![vec![CellState::Empty; 5]; 5];
        // Ustawiamy "trafienie", które uniemożliwia umieszczenie statku o dł. 3 w rogu
        board[0][1] = CellState::Miss;
        board[1][0] = CellState::Miss;

        let ship_lengths = [3];
        global_constraint_solver(&mut board, &ship_lengths);

        // Oczekujemy, że pole [0][0] zostanie oznaczone jako Miss
        assert_eq!(board[0][0], CellState::Miss);
        // Oczekujemy, że inne puste pola pozostaną puste
        assert_eq!(board[2][2], CellState::Empty);
    }
}
