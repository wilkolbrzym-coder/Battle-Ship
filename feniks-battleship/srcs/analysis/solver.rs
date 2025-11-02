use crate::utils::{Board, CellState};

fn can_place_ship_at(board: &Board, y: usize, x: usize, length: u8, is_horizontal: bool) -> bool {
    let (height, width) = (board.len(), board[0].len());
    if is_horizontal {
        if x + length as usize > width { return false; }
        (0..length).all(|i| board[y][x + i as usize] != CellState::Miss)
    } else {
        if y + length as usize > height { return false; }
        (0..length).all(|i| board[y + i as usize][x] != CellState::Miss)
    }
}

pub fn global_constraint_solver(board: &mut Board, remaining_ship_lengths: &[u8]) {
    if remaining_ship_lengths.is_empty() { return; }

    let mut changed = true;
    while changed {
        changed = false;
        for y in 0..board.len() {
            for x in 0..board[0].len() {
                if board[y][x] == CellState::Empty {
                    let mut can_any_ship_cover_this_cell = false;
                    'ship_loop: for &ship_len in remaining_ship_lengths {
                        // Sprawdź poziomo
                        for i in 0..ship_len {
                            if x >= i as usize && can_place_ship_at(board, y, x - i as usize, ship_len, true) {
                                can_any_ship_cover_this_cell = true;
                                break 'ship_loop;
                            }
                        }
                        // Sprawdź pionowo
                        for i in 0..ship_len {
                            if y >= i as usize && can_place_ship_at(board, y - i as usize, x, ship_len, false) {
                                can_any_ship_cover_this_cell = true;
                                break 'ship_loop;
                            }
                        }
                    }

                    if !can_any_ship_cover_this_cell {
                        board[y][x] = CellState::Miss;
                        changed = true;
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solver_marks_isolated_islands() {
        let mut board = vec![vec![CellState::Empty; 10]; 10];
        for i in 0..10 { board[i][3] = CellState::Miss; }
        let ship_lengths = [4];
        global_constraint_solver(&mut board, &ship_lengths);
        assert_eq!(board[0][0], CellState::Miss);
        assert_eq!(board[9][2], CellState::Miss);
        assert_eq!(board[5][5], CellState::Empty);
    }
}
