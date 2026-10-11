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

/** '01101' → [0, 1, 1, 0, 1] */
export function parseBits(text: string): Chromosome {
  return [...text].map((char) => (char === '1' ? 1 : 0));
}

/** [0, 1, 1, 0, 1] → '01101' */
export function formatBits(chromosome: Chromosome): string {
  return chromosome.join('');
}
