use crate::utils::{Ship, Position};
use rand::Rng;
use rand::seq::SliceRandom;

#[derive(Clone, Debug)]
pub struct Individual {
    pub ships: Vec<Ship>,
    pub fitness: f64,
}

pub fn run_genetic_algorithm(width: u8, height: u8, ship_lengths: &[u8]) -> Vec<Ship> {
    let population_size = 50;
    let generations = 30;
    let mutation_rate = 0.1;
    let elitism_count = 5;

    let mut population = (0..population_size)
        .map(|_| create_random_individual(width, height, ship_lengths))
        .collect::<Vec<_>>();

    for _gen in 0..generations {
        for individual in &mut population {
            individual.fitness = calculate_fitness(individual, width, height);
        }
        population.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap());

        let mut new_population = Vec::new();
        new_population.extend_from_slice(&population[..elitism_count]);

        while new_population.len() < population_size {
            let parent1 = tournament_selection(&population);
            let parent2 = tournament_selection(&population);
            let mut child = crossover(parent1, parent2, width, height, ship_lengths);
            if rand::thread_rng().gen::<f64>() < mutation_rate {
                child = mutate(child, width, height, ship_lengths);
            }
            new_population.push(child);
        }
        population = new_population;
    }
    population.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap());
    population[0].ships.clone()
}

fn calculate_fitness(individual: &Individual, width: u8, height: u8) -> f64 {
    let early_game_stealth = early_game_stealth_score(individual, width, height) * 0.70;
    let orientation_balance = orientation_balance_score(individual) * 0.15;
    let parity_resistance = 0.0 * 0.05; // Placeholder
    let ambiguity = 0.0 * 0.05; // Placeholder
    let balance = 0.0 * 0.05; // Placeholder

    early_game_stealth + orientation_balance + parity_resistance + ambiguity + balance
}

fn early_game_stealth_score(individual: &Individual, width: u8, height: u8) -> f64 {
    let mut board = vec![vec![false; width as usize]; height as usize];
    for ship in &individual.ships {
        for pos in &ship.positions {
            board[pos.y as usize][pos.x as usize] = true;
        }
    }
    let simulation_shots = 15;
    let mut hits = 0;
    let mut shot_count = 0;
    'outer: for y in 0..height {
        for x in 0..width {
            if (x + y) % 2 == 0 {
                if shot_count >= simulation_shots { break 'outer; }
                if board[y as usize][x as usize] { hits += 1; }
                shot_count += 1;
            }
        }
    }
    1.0 - (hits as f64 / simulation_shots as f64)
}

fn orientation_balance_score(individual: &Individual) -> f64 {
    if individual.ships.is_empty() { return 0.0; }
    let vertical_count = individual.ships.iter().filter(|s| s.positions.len() > 1 && s.positions[0].x == s.positions[1].x).count();
    let horizontal_count = individual.ships.len() - vertical_count;
    1.0 - ( (vertical_count as f64 - horizontal_count as f64).abs() / individual.ships.len() as f64 )
}

fn tournament_selection<'a>(population: &'a [Individual]) -> &'a Individual {
    let mut rng = rand::thread_rng();
    let tournament_size = 5;
    let mut best: Option<&'a Individual> = None;
    for _ in 0..tournament_size {
        let candidate = population.choose(&mut rng).unwrap();
        if best.is_none() || candidate.fitness > best.as_ref().unwrap().fitness {
            best = Some(candidate);
        }
    }
    best.unwrap()
}

fn crossover(parent1: &Individual, parent2: &Individual, width: u8, height: u8, ship_lengths: &[u8]) -> Individual {
    let mut rng = rand::thread_rng();
    let crossover_point = rng.gen_range(0..parent1.ships.len());
    let mut child_ships = parent1.ships[..crossover_point].to_vec();
    child_ships.extend_from_slice(&parent2.ships[crossover_point..]);

    if !is_valid(&child_ships, width, height) {
        return create_random_individual(width, height, ship_lengths);
    }
    Individual { ships: child_ships, fitness: 0.0 }
}

fn mutate(_individual: Individual, width: u8, height: u8, ship_lengths: &[u8]) -> Individual {
    create_random_individual(width, height, ship_lengths)
}

fn create_random_individual(width: u8, height: u8, ship_lengths: &[u8]) -> Individual {
    let mut board = vec![vec![false; width as usize]; height as usize];
    let mut ships = Vec::new();
    let mut rng = rand::thread_rng();

    for (id, &length) in ship_lengths.iter().enumerate() {
        let mut placed = false;
        for _ in 0..200 {
            let is_horizontal = rng.gen();
            let x = rng.gen_range(0..width);
            let y = rng.gen_range(0..height);

            if can_place_ship(&board, length, Position {x, y}, is_horizontal) {
                let mut positions = Vec::new();
                for i in 0..length {
                    let (px, py) = if is_horizontal { (x + i, y) } else { (x, y + i) };
                    board[py as usize][px as usize] = true;
                    positions.push(Position { x: px, y: py });
                }
                ships.push(Ship { id: id as u8, length, positions, hits: 0 });
                placed = true;
                break;
            }
        }
        if !placed {
            return create_random_individual(width, height, ship_lengths);
        }
    }
    Individual { ships, fitness: 0.0 }
}

fn can_place_ship(board: &Vec<Vec<bool>>, length: u8, pos: Position, is_horizontal: bool) -> bool {
    let (width, height) = (board[0].len() as i16, board.len() as i16);
    let (x, y) = (pos.x as i16, pos.y as i16);

    if is_horizontal {
        if x + length as i16 > width { return false; }
    } else {
        if y + length as i16 > height { return false; }
    }

    for i in 0..length as i16 {
        let (current_x, current_y) = if is_horizontal { (x + i, y) } else { (x, y + i) };
        for dy in -1..=1 {
            for dx in -1..=1 {
                let check_x = current_x + dx;
                let check_y = current_y + dy;
                if check_x >= 0 && check_x < width && check_y >= 0 && check_y < height {
                    if board[check_y as usize][check_x as usize] {
                        return false;
                    }
                }
            }
        }
    }
    true
}

fn is_valid(ships: &[Ship], width: u8, height: u8) -> bool {
    let mut board = vec![vec![false; width as usize]; height as usize];
    for ship in ships {
        let pos = ship.positions[0];
        let is_horizontal = ship.positions.len() > 1 && ship.positions[0].y == ship.positions[1].y;
        if !can_place_ship(&board, ship.length, pos, is_horizontal) {
            return false;
        }
        for p in &ship.positions {
            board[p.y as usize][p.x as usize] = true;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_place_ship_3x3_genetics() {
        let mut board = vec![vec![false; 10]; 10];
        board[2][2] = true;
        assert!(!can_place_ship(&board, 3, Position { x: 3, y: 3 }, true));
        assert!(can_place_ship(&board, 3, Position { x: 4, y: 2 }, true));
    }

    #[test]
    fn test_create_random_individual_respects_3x3() {
        let ship_lengths = [5, 4, 3, 3, 2];
        let individual = create_random_individual(10, 10, &ship_lengths);
        assert!(is_valid(&individual.ships, 10, 10));
    }
}
