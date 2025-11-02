use crate::utils::{Board, CellState, Position};
use std::cmp::{max, min};

const WIN_SCORE: i32 = 1000;
const LOSE_SCORE: i32 = -1000;

fn evaluate_board(board: &Board) -> i32 {
    let mut score = 0;
    // Nagradzaj za tworzenie linii trafień
    for y in 0..board.len() {
        for x in 0..board[0].len() {
            if board[y][x] == CellState::Hit {
                // Bonus za każdego trafionego sąsiada
                if x > 0 && board[y][x - 1] == CellState::Hit { score += 10; }
                if y > 0 && board[y - 1][x] == CellState::Hit { score += 10; }
            }
        }
    }
    score
}

fn alphabeta(board: &mut Board, depth: u8, mut alpha: i32, mut beta: i32, maximizing_player: bool) -> i32 {
    if depth == 0 { // Dodać warunek końca gry
        return evaluate_board(board);
    }

    let mut possible_moves = Vec::new();
    for y in 0..board.len() {
        for x in 0..board[0].len() {
            if board[y][x] == CellState::Empty {
                possible_moves.push(Position { x: x as u8, y: y as u8 });
            }
        }
    }

    if maximizing_player {
        let mut value = i32::MIN;
        for mv in possible_moves {
            board[mv.y as usize][mv.x as usize] = CellState::Hit; // Symuluj trafienie
            value = max(value, alphabeta(board, depth - 1, alpha, beta, false));
            board[mv.y as usize][mv.x as usize] = CellState::Empty; // Cofnij ruch
            alpha = max(alpha, value);
            if alpha >= beta {
                break; // Beta cutoff
            }
        }
        value
    } else { // Minimizing player
        let mut value = i32::MAX;
        for mv in possible_moves {
            board[mv.y as usize][mv.x as usize] = CellState::Miss; // Symuluj pudło
            value = min(value, alphabeta(board, depth - 1, alpha, beta, true));
            board[mv.y as usize][mv.x as usize] = CellState::Empty; // Cofnij ruch
            beta = min(beta, value);
            if beta <= alpha {
                break; // Alpha cutoff
            }
        }
        value
    }
}

pub fn verify_best_moves(board: &Board, top_moves: &[(u8, u8)]) -> (u8, u8) {
    if top_moves.is_empty() { return (0, 0); }

    let empty_cells = board.iter().flatten().filter(|&&c| c == CellState::Empty).count();
    let depth = if empty_cells > 50 { 2 } else if empty_cells > 20 { 3 } else { 4 };

    let mut best_move = top_moves[0];
    let mut best_score = i32::MIN;

    for &(x, y) in top_moves {
        let mut temp_board = board.clone();
        temp_board[y as usize][x as usize] = CellState::Hit;
        let score = alphabeta(&mut temp_board, depth, i32::MIN, i32::MAX, false);
        if score > best_score {
            best_score = score;
            best_move = (x, y);
        }
    }
    best_move
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evaluate_board_rewards_contiguity() {
        let mut board = vec![vec![CellState::Empty; 10]; 10];
        board[5][5] = CellState::Hit;
        board[5][6] = CellState::Hit;
        assert!(evaluate_board(&board) > 0);
    }

    #[test]
    fn test_verify_best_moves_prefers_line_creation() {
        let mut board = vec![vec![CellState::Empty; 10]; 10];
        board[5][5] = CellState::Hit;
        let moves = [(5, 6), (0, 0)]; // Pierwszy ruch tworzy linię, drugi jest losowy
        let best = verify_best_moves(&board, &moves);
        assert_eq!(best, (5, 6));
    }
}
