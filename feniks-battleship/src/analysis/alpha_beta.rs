use crate::utils::{Board, CellState, Position};
use std::cmp::{max, min};

fn evaluate_board(board: &Board) -> i32 {
    let mut score = 0;
    let (height, width) = (board.len(), board[0].len());
    for y in 0..height {
        for x in 0..width {
            if board[y][x] == CellState::Hit {
                score += 10;
                if x + 1 < width && board[y][x + 1] == CellState::Hit { score += 100; }
                if y + 1 < height && board[y + 1][x] == CellState::Hit { score += 100; }
            }
        }
    }
    score
}

fn get_possible_moves(board: &Board) -> Vec<Position> {
    let mut moves = Vec::new();
    for (y, row) in board.iter().enumerate() {
        for (x, &cell) in row.iter().enumerate() {
            if cell == CellState::Empty {
                moves.push(Position { x: x as u8, y: y as u8 });
            }
        }
    }
    moves
}

fn alpha_beta(board: &Board, depth: i32, mut alpha: i32, mut beta: i32, is_maximizing_player: bool) -> i32 {
    if depth == 0 { return evaluate_board(board); }
    let possible_moves = get_possible_moves(board);
    if is_maximizing_player {
        let mut max_eval = i32::MIN;
        for mv in possible_moves {
            let mut temp_board = board.clone();
            temp_board[mv.y as usize][mv.x as usize] = CellState::Hit;
            let eval = alpha_beta(&temp_board, depth - 1, alpha, beta, false);
            max_eval = max(max_eval, eval);
            alpha = max(alpha, eval);
            if beta <= alpha { break; }
        }
        max_eval
    } else {
        let mut min_eval = i32::MAX;
        for _mv in possible_moves {
            let temp_board = board.clone();
            let eval = alpha_beta(&temp_board, depth - 1, alpha, beta, true);
            min_eval = min(min_eval, eval);
            beta = min(beta, eval);
            if beta <= alpha { break; }
        }
        min_eval
    }
}

pub fn verify_best_moves(board: &Board, moves: &[(u8, u8)]) -> (u8, u8) {
    if moves.is_empty() { return (0, 0); }

    // Dynamiczne skalowanie głębokości
    let unknown_fields = board.iter().flatten().filter(|&&c| c == CellState::Empty).count();
    let search_depth = if unknown_fields < 20 { 3 }
                       else if unknown_fields <= 50 { 2 }
                       else { 1 };

    let mut best_move = moves[0];
    let mut best_score = i32::MIN;

    for &(x, y) in moves {
        let mut temp_board = board.clone();
        temp_board[y as usize][x as usize] = CellState::Hit;
        let score = alpha_beta(&temp_board, search_depth, i32::MIN, i32::MAX, false);
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
        let mut board = vec![vec![CellState::Empty; 5]; 5];
        board[1][1] = CellState::Hit;
        assert_eq!(evaluate_board(&board), 10);
        board[1][2] = CellState::Hit;
        assert_eq!(evaluate_board(&board), 120);
    }

    #[test]
    fn test_verify_best_moves_prefers_line_creation() {
        let mut board = vec![vec![CellState::Empty; 5]; 5];
        board[2][2] = CellState::Hit;
        let moves = [(4, 4), (2, 3)];
        let best_move = verify_best_moves(&board, &moves);
        assert_eq!(best_move, (2, 3));
    }
}
