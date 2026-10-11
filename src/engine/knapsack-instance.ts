/**
 * The 0/1 knapsack as data: items with a weight and a value, and a capacity. Everything here is pure arithmetic over a
 * bag (which items are packed), shared by the constraint-handling methods, the options validation and the tests.
 */
export interface KnapsackItem {
  readonly weight: number;
  readonly value: number;
}

export interface KnapsackInstance {
  readonly items: readonly KnapsackItem[];
  readonly capacity: number;
}

export const knapsackLimits = { minItems: 2, maxItems: 20, maxWeight: 99, maxValue: 999 } as const;

/** Items are named A, B, C, … by position. */
export const itemName = (index: number): string => String.fromCharCode(65 + index);

/**
 * The instance the app opens with: 12 items and a capacity of 48 of a total weight of 97. Designed so that the
 * optimum is 123 (the bag B, C, D, F, G, H, K), packing by best value per weight gets only 112, and exactly half of
 * the 4,096 possible bags fit. The tests check every one of those claims.
 */
export const builtInKnapsack: KnapsackInstance = {
  items: [
    { weight: 9, value: 4 },
    { weight: 12, value: 20 },
    { weight: 3, value: 21 },
    { weight: 3, value: 17 },
    { weight: 10, value: 5 },
    { weight: 14, value: 23 },
    { weight: 4, value: 7 },
    { weight: 5, value: 14 },
    { weight: 11, value: 8 },
    { weight: 7, value: 12 },
    { weight: 6, value: 21 },
    { weight: 13, value: 19 },
  ],
  capacity: 48,
};

/** The total weight of the packed items. */
export function bagWeight(instance: KnapsackInstance, bag: readonly boolean[]): number {
  return instance.items.reduce((total, item, i) => total + (bag[i] ? item.weight : 0), 0);
}

/** The total value of the packed items. */
export function bagValue(instance: KnapsackInstance, bag: readonly boolean[]): number {
  return instance.items.reduce((total, item, i) => total + (bag[i] ? item.value : 0), 0);
}

export const valuePerWeight = (item: KnapsackItem): number => item.value / item.weight;

/** The best bag by dynamic programming over the capacity: its value and one bag that reaches it (ties keep the earlier items out). */
export function optimalBag(instance: KnapsackInstance): { value: number; bag: boolean[] } {
  const { items, capacity } = instance;
  // best[i][c]: the best value using the first i items within capacity c
  const best = [new Array<number>(capacity + 1).fill(0)];
  for (let i = 0; i < items.length; i++) {
    const row = best[i]!.slice();
    for (let c = items[i]!.weight; c <= capacity; c++) row[c] = Math.max(row[c]!, best[i]![c - items[i]!.weight]! + items[i]!.value);
    best.push(row);
  }
  const bag = items.map(() => false);
  for (let i = items.length, c = capacity; i > 0; i--) {
    if (best[i]![c] !== best[i - 1]![c]) {
      bag[i - 1] = true;
      c -= items[i - 1]!.weight;
    }
  }
  return { value: best[items.length]![capacity]!, bag };
}

/** Packing by best value per weight (ties: the earlier item), skipping an item that does not fit and carrying on. */
export function greedyByRatio(instance: KnapsackInstance): { value: number; bag: boolean[] } {
  const order = instance.items.map((_, i) => i).sort((a, b) => valuePerWeight(instance.items[b]!) - valuePerWeight(instance.items[a]!) || a - b);
  const bag = instance.items.map(() => false);
  let weight = 0;
  for (const i of order) {
    if (weight + instance.items[i]!.weight <= instance.capacity) {
      bag[i] = true;
      weight += instance.items[i]!.weight;
    }
  }
  return { value: bagValue(instance, bag), bag };
}

const isWhole = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
const showNumber = (x: unknown): string => (typeof x === 'number' && Number.isFinite(x) ? String(x) : 'not a number');

/** What is wrong with the items and with the capacity, in words, each under the field it is about. */
export function validateKnapsackInstanceFields(instance: KnapsackInstance): { readonly items: string[]; readonly capacity: string[] } {
  const items: string[] = [];
  const capacity: string[] = [];
  const { minItems, maxItems, maxWeight, maxValue } = knapsackLimits;
  const n = instance.items.length;
  if (n < minItems) items.push(`A knapsack needs at least ${minItems} items (there ${n === 1 ? 'is' : 'are'} ${n}).`);
  if (n > maxItems) items.push(`A knapsack can have at most ${maxItems} items (there are ${n}).`);
  let weightsOk = true;
  instance.items.slice(0, maxItems).forEach((item, i) => {
    if (!isWhole(item.weight, 1, maxWeight)) {
      items.push(`Item ${itemName(i)}: the weight must be a whole number from 1 to ${maxWeight} (it is ${showNumber(item.weight)}).`);
      weightsOk = false;
    }
    if (!isWhole(item.value, 1, maxValue)) items.push(`Item ${itemName(i)}: the value must be a whole number from 1 to ${maxValue} (it is ${showNumber(item.value)}).`);
  });
  if (!isWhole(instance.capacity, 1, Number.MAX_SAFE_INTEGER)) {
    capacity.push(`The capacity must be a whole number of at least 1 (it is ${showNumber(instance.capacity)}).`);
  } else if (weightsOk && n >= 1 && n <= maxItems) {
    const total = instance.items.reduce((t, item) => t + item.weight, 0);
    const lightest = Math.min(...instance.items.map((item) => item.weight));
    if (instance.capacity > total) capacity.push(`The capacity can be at most the total weight, ${total} (it is ${instance.capacity}): a bag that holds everything is no puzzle.`);
    else if (lightest > instance.capacity) capacity.push(`No item fits on its own: the lightest weighs ${lightest} but the capacity is ${instance.capacity}.`);
  }
  return { items, capacity };
}

/** Everything wrong with the instance, or an empty list. */
export function validateKnapsackInstance(instance: KnapsackInstance): string[] {
  const { items, capacity } = validateKnapsackInstanceFields(instance);
  return [...items, ...capacity];
}
