declare module 'optimization-js' {
  export class Real {
    constructor(low: number, high: number);
    low: number;
    high: number;
    random_sample(): number;
  }

  export class Integer {
    constructor(low: number, high: number);
    low: number;
    high: number;
    random_sample(): number;
  }

  export class Categorical {
    constructor(categories: any[]);
    categories: any[];
    random_sample(): any;
  }

  export class Space {
    constructor(dimensions: (Real | Integer | Categorical)[]);
    dimensions: (Real | Integer | Categorical)[];
    rsv(n: number): any[][];
  }

  export interface OptimizationResult {
    best_x: number[];
    best_y: number;
    X?: number[][];
    Y?: number[];
  }

  export interface LBFGSOptions {
    maxIterations?: number;
    lineSearch?: {
      maxIterations?: number;
      c1?: number;
      c2?: number;
    };
  }

  export interface LBFGSResult {
    x: number[];
    fx: number;
    iterations: number;
    converged: boolean;
  }

  export function rs_minimize(
    func: (x: number[]) => number,
    dimensions: (Real | Integer | Categorical)[],
    n_calls?: number,
    n_random_starts?: number,
    mutation_rate?: number
  ): OptimizationResult;

  export function minimize_L_BFGS(
    f: (x: number[]) => number,
    g: (x: number[]) => number[],
    x0: number[],
    options?: LBFGSOptions
  ): LBFGSResult;
} 