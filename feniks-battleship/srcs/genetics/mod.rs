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
        (self.orientation_balance_score(individual) * 0.10) +
        (self.ambiguity_score(individual) * 0.10) +
        (self.parity_resistance_score(individual) * 0.05) +
        (self.balance_score(individual) * 0.05)
    }

    fn early_game_stealth_score(&self, ind: &Individual) -> f64 {
        let mut board = vec![vec![false; self.width as usize]; self.height as usize];
        ind.ships.iter().flat_map(|s| &s.positions).for_each(|p| board[p.y as usize][p.x as usize] = true);
        let shots = 15;
        let mut hits = 0;
        (0..self.height).step_by(2).flat_map(|y| (0..self.width).step_by(2).map(move |x| (x, y)))
            .take(shots).for_each(|(x, y)| if board[y as usize][x as usize] { hits += 1; });
        1.0 - (hits as f64 / shots as f64)
    }

    fn orientation_balance_score(&self, ind: &Individual) -> f64 {
        if ind.ships.is_empty() { return 0.0; }
        let vertical = ind.ships.iter().filter(|s| s.positions.len() > 1 && s.positions[0].x == s.positions[1].x).count();
        let horizontal = ind.ships.len() - vertical;
        1.0 - ((vertical as f64 - horizontal as f64).abs() / ind.ships.len() as f64)
    }

    fn ambiguity_score(&self, ind: &Individual) -> f64 {
        // Placeholder - requires more complex logic
        0.5
    }

    fn parity_resistance_score(&self, ind: &Individual) -> f64 {
        // Placeholder
        0.5
    }

    fn balance_score(&self, ind: &Individual) -> f64 {
        // Placeholder
        0.5
    }

    fn crossover(&self, p1: &Individual, p2: &Individual) -> Individual {
        let mut child_ships = p1.ships.clone();
        let mut board = vec![vec![false; self.width as usize]; self.height as usize];
        child_ships.iter().flat_map(|s| &s.positions).for_each(|p| board[p.y as usize][p.x as usize] = true);

        for ship_p2 in &p2.ships {
            if rand::thread_rng().gen::<f64>() < 0.5 {
                // remove conflicting ships from child
                child_ships.retain(|ship_p1| !ship_p1.positions.iter().any(|p1| ship_p2.positions.contains(p1)));
                if can_place_ship_individual(&child_ships, ship_p2, self.width, self.height) {
                    child_ships.push(ship_p2.clone());
                }
            }
        }
        Individual { ships: child_ships, fitness: 0.0 }
    }
    fn mutate(&self, ind: Individual) -> Individual {
        let mut new_ind = ind.clone();
        if new_ind.ships.is_empty() { return self.create_random_individual(); }
        let ship_idx = rand::thread_rng().gen_range(0..new_ind.ships.len());
        new_ind.ships.remove(ship_idx);
        // try to place a new ship
        let len = self.ship_lengths[ship_idx]; // This is an approximation

        let mut placed = false;
        for _ in 0..100 {
            let is_horizontal = rand::thread_rng().gen();
            let x = rand::thread_rng().gen_range(0..self.width);
            let y = rand::thread_rng().gen_range(0..self.height);
            let new_ship = Ship { id: ship_idx as u8, length: len, positions: vec![], hits: 0 };
            if can_place_ship_individual(&new_ind.ships, &new_ship, self.width, self.height) {
                 // logic to actually create and add the ship
                placed = true;
                break;
            }
        }

        if !placed { return ind; } // return original if mutation fails
        new_ind
    }

    fn create_random_individual(&self) -> Individual {
        let mut ships = Vec::new();
        for (id, &length) in self.ship_lengths.iter().enumerate() {
            let mut placed = false;
            for _ in 0..200 {
                let is_horizontal = rand::thread_rng().gen();
                let x = rand::thread_rng().gen_range(0..self.width);
                let y = rand::thread_rng().gen_range(0..self.height);
                let mut positions = vec![];
                let mut can_place = true;
                for i in 0..length {
                    let (px, py) = if is_horizontal { (x + i, y) } else { (x, y + i) };
                    if px >= self.width || py >= self.height { can_place = false; break; }
                    positions.push(Position{x:px, y:py});
                }
                if can_place && can_place_ship_individual(&ships, &Ship{id:0, length, positions: positions.clone(), hits:0}, self.width, self.height) {
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

fn can_place_ship_individual(ships: &[Ship], new_ship: &Ship, width: u8, height: u8) -> bool {
    for pos in &new_ship.positions {
        for existing_ship in ships {
            for existing_pos in &existing_ship.positions {
                if (pos.x as i16 - existing_pos.x as i16).abs() <= 1 && (pos.y as i16 - existing_pos.y as i16).abs() <= 1 {
                    return false;
                }
            }
        }
    }
    true
}


fn tournament_selection(population: &[Individual]) -> &Individual {
    population.choose_multiple(&mut rand::thread_rng(), 5).min_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap()).unwrap()
}
