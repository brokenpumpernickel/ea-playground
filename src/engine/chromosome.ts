/** A gene is a position in the problem's alphabet; for the binary problems that is 0 or 1. */
export type Gene = number;

export type Bit = 0 | 1;

/** A chromosome. Readonly, so copies can never share mutable state; operators return new arrays. */
export type Chromosome = readonly Gene[];

/** The alphabet of the binary problems: gene 0 is shown as `0`, gene 1 as `1`. */
export const binaryAlphabet: readonly string[] = ['0', '1'];

/** [0, 1, 1, 0, 1] with alphabet ['0','1'] → '01101'; with letters, the letters. */
export function formatGenes(chromosome: Chromosome, alphabet: readonly string[]): string {
  return chromosome.map((gene) => alphabet[gene] ?? '?').join('');
}

/**
 * '01101' → [0, 1, 1, 0, 1]. Each character must be one symbol of the alphabet (a one-character string);
 * returns undefined naming nothing when one is not, so the caller can say which.
 */
export function parseGenes(text: string, alphabet: readonly string[]): Chromosome | undefined {
  const genes = [...text].map((char) => alphabet.indexOf(char));
  return genes.includes(-1) ? undefined : genes;
}

const minus = (text: string): string => text.replace(/-/g, '−');

const numberToken = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/**
 * '1.5, −2.25' → [1.5, -2.25]. Numbers separated by spaces or commas, with `-` or `−` as the minus sign; anything else
 * (no numbers, a word, Infinity, NaN) gives undefined so the caller can say what was wrong.
 */
export function parseReal(text: string): Chromosome | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const tokens = trimmed.split(/[\s,]+/).map((token) => token.replace(/−/g, '-'));
  if (!tokens.every((token) => numberToken.test(token))) return undefined;
  return tokens.map(Number);
}

/**
 * [-2.5054, 1.2] → '−2.505 1.200' with `decimals` (a real minus sign, for display); without it the exact numbers with `-`,
 * which `parseReal` reads back unchanged (for data and share links).
 */
export function formatReal(chromosome: Chromosome, decimals?: number): string {
  if (decimals === undefined) return chromosome.join(' ');
  return chromosome
    .map((gene) => {
      const shown = gene.toFixed(decimals);
      return Number(shown) === 0 ? shown.replace('-', '') : minus(shown); // no "−0.000"
    })
    .join(' ');
}

/** The genes that lie outside their bounds, each named in words: 'gene 1 (5.001) is outside its bounds from −5 to 5'. */
export function checkReal(chromosome: Chromosome, bounds: readonly { readonly lo: number; readonly hi: number }[]): string[] {
  const problems: string[] = [];
  chromosome.forEach((gene, k) => {
    const { lo, hi } = bounds[k]!;
    if (!(gene >= lo && gene <= hi)) problems.push(`gene ${k + 1} (${minus(String(gene))}) is outside its bounds from ${minus(String(lo))} to ${minus(String(hi))}`);
  });
  return problems;
}

/** '01101' → [0, 1, 1, 0, 1] */
export function parseBits(text: string): Chromosome {
  return [...text].map((char) => (char === '1' ? 1 : 0));
}

/** [0, 1, 1, 0, 1] → '01101' */
export function formatBits(chromosome: Chromosome): string {
  return chromosome.join('');
}

/** [0, 4, 2, 1, 3] → '1 5 3 2 4': a tour as the city numbers a student reads, from 1 (and as the data and share links keep it). */
export function formatTour(tour: Chromosome): string {
  return tour.map((city) => city + 1).join(' ');
}

/**
 * '1 5 3 2 4' → [0, 4, 2, 1, 3]. Whole numbers separated by spaces or commas, read from 1; anything else (a word, a
 * decimal, a sign) gives undefined so the caller can say what was wrong. Whether they make a permutation is `checkTour`'s question.
 */
export function parseTour(text: string): Chromosome | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const tokens = trimmed.split(/[\s,]+/);
  return tokens.every((token) => /^\d+$/.test(token)) ? tokens.map((token) => Number(token) - 1) : undefined;
}

/**
 * What is wrong with a tour of n cities, in words: a city that appears more than once, a number that is not one of the
 * cities, then the cities that are missing, in order. An empty list means it is a permutation of the n cities.
 */
export function checkTour(tour: Chromosome, n: number): string[] {
  const counts = new Map<number, number>();
  for (const city of tour) counts.set(city, (counts.get(city) ?? 0) + 1);
  const problems: string[] = [];
  for (const [city, count] of counts) {
    if (!(city >= 0 && city < n)) problems.push(`city ${city + 1} is not one of the ${n} cities (1 to ${n})`);
    else if (count === 2) problems.push(`city ${city + 1} appears twice`);
    else if (count > 2) problems.push(`city ${city + 1} appears ${count} times`);
  }
  for (let city = 0; city < n; city++) if (!counts.has(city)) problems.push(`city ${city + 1} is missing`);
  return problems;
}

/**
 * The tour as the route it is, not the array it happens to be: starting at city 1 (gene 0) and going in the direction
 * whose second city is the lower one, so that every rotation and reversal of a tour gives the same route.
 */
export function canonicalRoute(tour: Chromosome): Chromosome {
  const start = tour.indexOf(0);
  if (start < 0) return [...tour];
  const rotated = [...tour.slice(start), ...tour.slice(0, start)];
  return rotated.length > 2 && rotated[1]! > rotated[rotated.length - 1]! ? [rotated[0]!, ...rotated.slice(1).reverse()] : rotated;
}

/** The edge between two cities, the same whichever way round they are given: '1-3'. */
export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** The edges of a closed tour as keys, so rotations and reversals of one route give equal sets. n cities have n edges; two have one; one city has none. */
export function tourEdgeSet(tour: Chromosome): ReadonlySet<string> {
  const edges = new Set<string>();
  if (tour.length < 2) return edges;
  tour.forEach((city, k) => edges.add(edgeKey(city, tour[(k + 1) % tour.length]!)));
  return edges;
}
