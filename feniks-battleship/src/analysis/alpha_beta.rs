use crate::utils::{Board, CellState, Position};
use std::cmp::{max, min};

/// Ocenia strategiczną wartość planszy.
/// Wyższa wartość jest lepsza dla gracza maksymalizującego (bota).
/// Kluczowa heurystyka: nagradza tworzenie ciągów trafień.
fn evaluate_board(board: &Board) -> i32 {
    let mut score = 0;
    let (height, width) = (board.len(), board[0].len());

    for y in 0..height {
        for x in 0..width {
            if board[y][x] == CellState::Hit {
                // Bonus za każde trafienie
                score += 10;

                // Duży bonus za sąsiadujące trafienia (tworzenie linii)
                // Sprawdź w prawo
                if x + 1 < width && board[y][x + 1] == CellState::Hit {
                    score += 100;
                }
                // Sprawdź w dół
                if y + 1 < height && board[y + 1][x] == CellState::Hit {
                    score += 100;
                }
            }
        }
    }
    score
}

/// Zwraca listę wszystkich możliwych do wykonania ruchów (puste pola).
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

/// Rekurencyjna implementacja algorytmu Minimax z odcięciami Alfa-Beta.
fn alpha_beta(board: &Board, depth: i32, mut alpha: i32, mut beta: i32, is_maximizing_player: bool) -> i32 {
    if depth == 0 {
        return evaluate_board(board);
    }

    let possible_moves = get_possible_moves(board);

    if is_maximizing_player {
        let mut max_eval = i32::MIN;
        for mv in possible_moves {
            let mut temp_board = board.clone();
            // Gracz maksymalizujący (bot) symuluje trafienie
            temp_board[mv.y as usize][mv.x as usize] = CellState::Hit;
            let eval = alpha_beta(&temp_board, depth - 1, alpha, beta, false);
            max_eval = max(max_eval, eval);
            alpha = max(alpha, eval);
            if beta <= alpha {
                break; // Odcięcie beta
            }
        }
        max_eval
    } else { // Gracz minimalizujący (przeciwnik)
        let mut min_eval = i32::MAX;
        for mv in possible_moves {
            let mut temp_board = board.clone();
            // Zakładamy, że przeciwnik nie strzela, to jest tylko ocena naszej pozycji
            // W tej implementacji, ruch "minimalizujący" to po prostu następny krok w ocenie
            let eval = alpha_beta(&temp_board, depth - 1, alpha, beta, true);
            min_eval = min(min_eval, eval);
            beta = min(beta, eval);
            if beta <= alpha {
                break; // Odcięcie alfa
            }
        }
        min_eval
    }
}

/// Weryfikuje listę najlepszych ruchów za pomocą przeszukiwania Alfa-Beta.
pub fn verify_best_moves(board: &Board, moves: &[(u8, u8)]) -> (u8, u8) {
    if moves.is_empty() {
        return (0, 0);
    }

    let mut best_move = moves[0];
    let mut best_score = i32::MIN;

    // Używamy płytkiego przeszukiwania (2-ply) do taktycznej oceny
    let search_depth = 2;

    for &(x, y) in moves {
        let mut temp_board = board.clone();
        temp_board[y as usize][x as usize] = CellState::Hit; // Symuluj ruch

        // Oceń pozycję po naszym ruchu, patrząc jeden ruch w przód
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
        assert_eq!(evaluate_board(&board), 10); // 10 za pojedyncze trafienie

        board[1][2] = CellState::Hit;
        // 10 za [1][1], 10 za [1][2], 100 za ich sąsiedztwo
        assert_eq!(evaluate_board(&board), 120);

        board[3][3] = CellState::Hit;
        // 120 z poprzedniego + 10 za nowe trafienie
        assert_eq!(evaluate_board(&board), 130);
    }

    #[test]
    fn test_verify_best_moves_prefers_line_creation() {
        let mut board = vec![vec![CellState::Empty; 5]; 5];
        board[2][2] = CellState::Hit;

        // Dwa ruchy do wyboru:
        // (2,3) - tworzy linię z (2,2)
        // (4,4) - izolowane trafienie
        let moves = [(4, 4), (2, 3)];

        // Oczekujemy, że wybierze (2,3), ponieważ daje to znacznie wyższy wynik w `evaluate_board`
        let best_move = verify_best_moves(&board, &moves);
        assert_eq!(best_move, (2, 3));
    }
}
