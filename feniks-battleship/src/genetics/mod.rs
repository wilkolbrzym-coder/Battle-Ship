use crate::utils::{Board, Ship, Position};
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
                child = mutate(child, width, height);
            }
            new_population.push(child);
        }
        population = new_population;
    }
    population.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap());
    population[0].ships.clone()
}

fn create_random_individual(width: u8, height: u8, ship_lengths: &[u8]) -> Individual {
    let mut board = vec![vec![false; width as usize]; height as usize];
    let mut ships = Vec::new();
    let mut rng = rand::thread_rng();

    for (id, &length) in ship_lengths.iter().enumerate() {
        let mut placed = false;
        while !placed {
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
            }
        }
    }
    Individual { ships, fitness: 0.0 }
}

fn calculate_fitness(_individual: &Individual, _width: u8, _height: u8) -> f64 {
    // Prosta implementacja - preferuje rozproszenie statków
    0.0 // Placeholder
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

fn mutate(individual: Individual, _width: u8, _height: u8) -> Individual {
    individual
}

fn can_place_ship(board: &Vec<Vec<bool>>, length: u8, pos: Position, is_horizontal: bool) -> bool {
    let (width, height) = (board[0].len() as u8, board.len() as u8);
    if is_horizontal {
        if pos.x + length > width { return false; }
        (0..length).all(|i| !board[pos.y as usize][(pos.x + i) as usize])
    } else {
        if pos.y + length > height { return false; }
        (0..length).all(|i| !board[(pos.y + i) as usize][pos.x as usize])
    }
}

fn is_valid(ships: &[Ship], width: u8, height: u8) -> bool {
    let mut board = vec![vec![false; width as usize]; height as usize];
    for ship in ships {
        for pos in &ship.positions {
            if pos.x >= width || pos.y >= height || board[pos.y as usize][pos.x as usize] {
                return false;
            }
            board[pos.y as usize][pos.x as usize] = true;
        }
    }
    true
}
