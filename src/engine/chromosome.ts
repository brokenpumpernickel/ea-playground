export type Bit = 0 | 1;

/** A binary chromosome. Readonly, so copies can never share mutable state; operators return new arrays. */
export type Chromosome = readonly Bit[];

/** '01101' → [0, 1, 1, 0, 1] */
export function parseBits(text: string): Chromosome {
  return [...text].map((char) => (char === '1' ? 1 : 0));
}

/** [0, 1, 1, 0, 1] → '01101' */
export function formatBits(chromosome: Chromosome): string {
  return chromosome.join('');
}
