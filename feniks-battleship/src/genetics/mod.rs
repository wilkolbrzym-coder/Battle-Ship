use crate::utils::{Ship, Position};
use rand::seq::SliceRandom;
use rand::Rng;
use rayon::prelude::*;

#[derive(Clone, Debug)]
pub struct Individual {
    pub ships: Vec<Ship>,
    pub fitness: f64,
}

pub struct GeneticArchitect {
    width: u8,
    height: u8,
    ship_lengths: Vec<u8>,
}

impl GeneticArchitect {
    pub fn new(width: u8, height: u8, ship_lengths: Vec<u8>) -> Self {
        Self { width, height, ship_lengths }
    }

    pub fn generate_best_layout(&self, generations: usize, population_size: usize) -> Vec<Ship> {
        let mut population: Vec<Individual> = (0..population_size)
            .into_par_iter()
            .map(|_| self.create_random_individual())
            .collect();

        for _gen in 0..generations {
            population.par_iter_mut().for_each(|ind| {
                ind.fitness = self.calculate_fitness(ind);
            });
            population.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap());
            let mut new_population = Vec::with_capacity(population_size);
            let elite_count = (population_size as f64 * 0.1) as usize;
            new_population.extend(population[..elite_count].iter().cloned());
            let children: Vec<Individual> = (0..(population_size - elite_count)).into_par_iter().map(|_| {
                let p1 = tournament_selection(&population);
                let p2 = tournament_selection(&population);
                let mut child = self.crossover(p1, p2);
                if rand::thread_rng().gen::<f64>() < 0.1 { child = self.mutate(child); }
                child
            }).collect();
            new_population.extend(children);
            population = new_population;
        }
        population.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap());
        population[0].ships.clone()
    }

    fn calculate_fitness(&self, individual: &Individual) -> f64 {
        (self.early_game_stealth_score(individual) * 0.70) +
        (self.orientation_balance_score(individual) * 0.15) // Placeholder values for others
    }

    fn early_game_stealth_score(&self, ind: &Individual) -> f64 {
        let mut board = vec![vec![false; self.width as usize]; self.height as usize];
        ind.ships.iter().flat_map(|s| &s.positions).for_each(|p| board[p.y as usize][p.x as usize] = true);
        let mut hits = 0;
        let shots = 15;
        let mut shot_count = 0;
        'outer: for y in 0..self.height {
            for x in 0..self.width {
                if (x + y) % 2 == 0 {
                    if shot_count >= shots { break 'outer; }
                    if board[y as usize][x as usize] { hits += 1; }
                    shot_count += 1;
                }
            }
        }
        1.0 - (hits as f64 / shots as f64)
    }

    fn orientation_balance_score(&self, ind: &Individual) -> f64 {
        if ind.ships.is_empty() { return 0.0; }
        let vertical = ind.ships.iter().filter(|s| s.positions.len() > 1 && s.positions[0].x == s.positions[1].x).count();
        let horizontal = ind.ships.len() - vertical;
        1.0 - ((vertical as f64 - horizontal as f64).abs() / ind.ships.len() as f64)
    }

    fn crossover(&self, _p1: &Individual, _p2: &Individual) -> Individual { self.create_random_individual() }
    fn mutate(&self, _ind: Individual) -> Individual { self.create_random_individual() }

    fn create_random_individual(&self) -> Individual {
        let mut ships = Vec::new();
        let mut board = vec![vec![false; self.width as usize]; self.height as usize];
        let mut rng = rand::thread_rng();
        for (id, &length) in self.ship_lengths.iter().enumerate() {
            let mut placed = false;
            for _ in 0..200 {
                let is_horizontal = rng.gen();
                let x = rng.gen_range(0..self.width);
                let y = rng.gen_range(0..self.height);
                if can_place_ship(&board, y as usize, x as usize, length, is_horizontal) {
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
            if !placed { return self.create_random_individual(); }
        }
        Individual { ships, fitness: 0.0 }
    }
}

fn can_place_ship(board: &Vec<Vec<bool>>, y: usize, x: usize, length: u8, is_horizontal: bool) -> bool {
    let (h, w) = (board.len(), board[0].len());
    for i in 0..length as usize {
        let (cx, cy) = if is_horizontal { (x + i, y) } else { (x, y + i) };
        if cx >= w || cy >= h { return false; }
        for dy in -1..=1 {
            for dx in -1..=1 {
                let (nx, ny) = ((cx as isize) + dx, (cy as isize) + dy);
                if nx >= 0 && ny >= 0 && nx < w as isize && ny < h as isize && board[ny as usize][nx as usize] { return false; }
            }
        }
    }
    true
}

fn tournament_selection(population: &[Individual]) -> &Individual {
    population.choose_multiple(&mut rand::thread_rng(), 5).min_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap()).unwrap()
}
