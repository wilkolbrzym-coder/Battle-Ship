use crate::utils::{Board, CellState, Position};
use std::cmp::{max, min};

fn evaluate_board(board: &Board) -> i32 {
    let mut score = 0;
    for y in 0..board.len() {
        for x in 0..board[0].len() {
            if board[y][x] == CellState::Hit {
                if x > 0 && board[y][x - 1] == CellState::Hit { score += 10; }
                if y > 0 && board[y - 1][x] == CellState::Hit { score += 10; }
            }
        }
    }
    score
}

fn alphabeta(board: &mut Board, depth: u8, mut alpha: i32, mut beta: i32, max_player: bool) -> i32 {
    if depth == 0 { return evaluate_board(board); }
    let mut moves = vec![];
    for y in 0..board.len() {
        for x in 0..board[0].len() {
            if board[y][x] == CellState::Empty { moves.push(Position{x:x as u8, y:y as u8}); }
        }
    }
    if max_player {
        let mut val = i32::MIN;
        for m in moves {
            board[m.y as usize][m.x as usize] = CellState::Hit;
            val = max(val, alphabeta(board, depth - 1, alpha, beta, false));
            board[m.y as usize][m.x as usize] = CellState::Empty;
            alpha = max(alpha, val);
            if alpha >= beta { break; }
        }
        val
    } else {
        let mut val = i32::MAX;
        for m in moves {
            board[m.y as usize][m.x as usize] = CellState::Miss;
            val = min(val, alphabeta(board, depth - 1, alpha, beta, true));
            board[m.y as usize][m.x as usize] = CellState::Empty;
            beta = min(beta, val);
            if beta <= alpha { break; }
        }
        val
    }
}

pub fn verify_best_moves(board: &Board, top_moves: &[(u8, u8)]) -> (u8, u8) {
    if top_moves.is_empty() { return (0, 0); }
    let depth = if board.iter().flatten().filter(|&&c| c == CellState::Empty).count() > 40 { 2 } else { 3 };
    let mut best_move = top_moves[0];
    let mut best_score = i32::MIN;
    for &(x, y) in top_moves {
        let mut temp = board.clone();
        temp[y as usize][x as usize] = CellState::Hit;
        let score = alphabeta(&mut temp, depth, i32::MIN, i32::MAX, false);
        if score > best_score {
            best_score = score;
            best_move = (x, y);
        }
    }
    best_move
}
