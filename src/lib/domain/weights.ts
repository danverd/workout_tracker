export interface WeightRange {
  min: number;
  max: number;
  step: number;
}

const MAX_WEIGHTS = 1000;
const clean = (value: number) => Math.round(value * 1000) / 1000;

/** Expands min/max/step into an ascending list, e.g. 5, 80, 5 -> 5, 10 ... 80. */
export function expandRange({ min, max, step }: WeightRange): number[] {
  if (![min, max, step].every(Number.isFinite) || step <= 0 || max < min)
    return [];
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  if (count > MAX_WEIGHTS) return [];
  return Array.from({ length: count }, (_, index) => clean(min + index * step));
}

/** Nearest available weight; ties round down. Empty list returns the target. */
export function snapToNearest(weights: readonly number[], target: number) {
  let best: number | undefined;
  for (const weight of weights) {
    if (best === undefined) {
      best = weight;
      continue;
    }
    const distance = Math.abs(weight - target);
    const bestDistance = Math.abs(best - target);
    if (distance < bestDistance || (distance === bestDistance && weight < best))
      best = weight;
  }
  return best ?? target;
}

export interface StepOptions {
  /** Available weights at the location for the exercise's weighted equipment. */
  weights?: readonly number[] | null;
  /** Fallback step when there is no weight list. */
  increment: number;
}

/** Next heavier weight for the stepper "+" button. */
export function nextWeight(current: number, options: StepOptions): number {
  const { weights, increment } = options;
  if (weights && weights.length > 0) {
    const higher = weights.filter((weight) => weight > current);
    return higher.length > 0 ? Math.min(...higher) : current;
  }
  return clean(current + increment);
}

/** Next lighter weight for the stepper "-" button; never below zero. */
export function previousWeight(current: number, options: StepOptions): number {
  const { weights, increment } = options;
  if (weights && weights.length > 0) {
    const lower = weights.filter((weight) => weight < current);
    return lower.length > 0 ? Math.max(...lower) : current;
  }
  return Math.max(0, clean(current - increment));
}
