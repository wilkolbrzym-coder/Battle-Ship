use crate::utils::{Board, CellState, Position};
use std::collections::{HashSet, VecDeque};

fn find_islands(board: &Board) -> Vec<HashSet<Position>> {
    let (height, width) = (board.len() as u8, board[0].len() as u8);
    let mut visited: HashSet<Position> = HashSet::new();
    let mut all_islands = Vec::new();

    for y in 0..height {
        for x in 0..width {
            let pos = Position { x, y };
            if board[y as usize][x as usize] == CellState::Empty && !visited.contains(&pos) {
                let mut current_island = HashSet::new();
                let mut queue = VecDeque::new();

                queue.push_back(pos);
                visited.insert(pos);
                current_island.insert(pos);

                while let Some(current_pos) = queue.pop_front() {
                    let (cx, cy) = (current_pos.x, current_pos.y);

                    let mut potential_neighbors = Vec::new();
                    if cx > 0 { potential_neighbors.push(Position { x: cx - 1, y: cy }); }
                    if cx < width - 1 { potential_neighbors.push(Position { x: cx + 1, y: cy }); }
                    if cy > 0 { potential_neighbors.push(Position { x: cx, y: cy - 1 }); }
                    if cy < height - 1 { potential_neighbors.push(Position { x: cx, y: cy + 1 }); }

                    for neighbor_pos in potential_neighbors {
                        if board[neighbor_pos.y as usize][neighbor_pos.x as usize] == CellState::Empty && !visited.contains(&neighbor_pos) {
                            visited.insert(neighbor_pos);
                            queue.push_back(neighbor_pos);
                            current_island.insert(neighbor_pos);
                        }
                    }
                }
                all_islands.push(current_island);
            }
        }
    }
    all_islands
}

fn can_ship_fit_in_island(island: &HashSet<Position>, ship_length: u8) -> bool {
    if island.is_empty() { return false; }

    let min_y = island.iter().map(|p| p.y).min().unwrap();
    let max_y = island.iter().map(|p| p.y).max().unwrap();
    let min_x = island.iter().map(|p| p.x).min().unwrap();
    let max_x = island.iter().map(|p| p.x).max().unwrap();

    if (max_y - min_y + 1) < ship_length && (max_x - min_x + 1) < ship_length {
        return false;
    }

    for pos in island {
        if max_x - pos.x + 1 >= ship_length {
            if (0..ship_length).all(|i| island.contains(&Position { x: pos.x + i, y: pos.y })) {
                return true;
            }
        }
        if max_y - pos.y + 1 >= ship_length {
            if (0..ship_length).all(|i| island.contains(&Position { x: pos.x, y: pos.y + i })) {
                return true;
            }
        }
    }

    false
}

pub fn global_constraint_solver(board: &mut Board, remaining_ship_lengths: &[u8]) {
    if remaining_ship_lengths.is_empty() { return; }

    let min_ship_length = *remaining_ship_lengths.iter().min().unwrap_or(&0);
    if min_ship_length == 0 { return; }

    let islands = find_islands(board);

    for island in islands {
        if !can_ship_fit_in_island(&island, min_ship_length) {
            for pos in island {
                board[pos.y as usize][pos.x as usize] = CellState::Miss;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::new_board;

    #[test]
    fn test_find_islands_simple() {
        let mut board = vec![vec![CellState::Miss; 5]; 5]; // Start with a non-empty board
        board[0][0] = CellState::Empty;
        board[0][1] = CellState::Empty; // Island 1
        board[2][2] = CellState::Empty; // Island 2
        let islands = find_islands(&board);
        assert_eq!(islands.len(), 2, "Should find two distinct islands");
    }

    #[test]
    fn test_can_ship_fit_positive() {
        let mut island = HashSet::new();
        island.insert(Position { x: 0, y: 0 });
        island.insert(Position { x: 1, y: 0 });
        island.insert(Position { x: 2, y: 0 });
        assert!(can_ship_fit_in_island(&island, 3));
        assert!(!can_ship_fit_in_island(&island, 4));
    }

    #[test]
    fn test_solver_marks_isolated_islands() {
        let mut board = new_board(10, 10); // Starts Empty
        // Create walls to isolate a 3x3 area. This area cannot fit a ship of length 4.
        for i in 0..10 { board[i][3] = CellState::Miss; } // Vertical wall
        for i in 0..3 { board[3][i] = CellState::Miss; } // Horizontal wall segment closing off the 3x3 area

        let ship_lengths = [4]; // Smallest ship has length 4
        global_constraint_solver(&mut board, &ship_lengths);

        // All cells in the isolated 3x3 area (top-left) should be marked as Miss
        assert_eq!(board[0][0], CellState::Miss, "Komórka [0][0] w wyspie 3x3 powinna być Miss");
        assert_eq!(board[2][2], CellState::Miss, "Komórka [2][2] w wyspie 3x3 powinna być Miss");

        // A cell in the larger area should remain Empty
        assert_eq!(board[5][5], CellState::Empty, "Komórka [5][5] powinna pozostać pusta");
    }
}
