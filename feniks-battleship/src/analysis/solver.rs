use crate::utils::{Board, CellState, Position};
use std::collections::{HashSet, VecDeque};

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

fn find_islands(board: &Board) -> Vec<HashSet<Position>> {
    let (h, w) = (board.len() as u8, board[0].len() as u8);
    let mut visited = HashSet::new();
    let mut islands = Vec::new();
    for y in 0..h {
        for x in 0..w {
            let pos = Position { x, y };
            if board[y as usize][x as usize] == CellState::Empty && !visited.contains(&pos) {
                let mut island = HashSet::new();
                let mut q = VecDeque::new();
                q.push_back(pos);
                visited.insert(pos);
                island.insert(pos);
                while let Some(curr) = q.pop_front() {
                    let (cx, cy) = (curr.x, curr.y);
                    [(0,1), (0,-1), (1,0), (-1,0)].iter().for_each(|&(dx, dy)| {
                        let (nx, ny) = (cx as i16 + dx, cy as i16 + dy);
                        if nx >= 0 && ny >= 0 && nx < w as i16 && ny < h as i16 {
                            let npos = Position { x: nx as u8, y: ny as u8 };
                            if board[ny as usize][nx as usize] == CellState::Empty && !visited.contains(&npos) {
                                visited.insert(npos);
                                q.push_back(npos);
                                island.insert(npos);
                            }
                        }
                    });
                }
                islands.push(island);
            }
        }
    }
    islands
}

fn can_ship_fit_in_island(island: &HashSet<Position>, len: u8) -> bool {
    if island.is_empty() { return false; }
    let (min_y, max_y) = (island.iter().map(|p| p.y).min().unwrap(), island.iter().map(|p| p.y).max().unwrap());
    let (min_x, max_x) = (island.iter().map(|p| p.x).min().unwrap(), island.iter().map(|p| p.x).max().unwrap());
    if (max_y - min_y + 1) < len && (max_x - min_x + 1) < len { return false; }
    for pos in island {
        if (0..len).all(|i| island.contains(&Position { x: pos.x + i, y: pos.y })) { return true; }
        if (0..len).all(|i| island.contains(&Position { x: pos.x, y: pos.y + i })) { return true; }
    }
    false
}
