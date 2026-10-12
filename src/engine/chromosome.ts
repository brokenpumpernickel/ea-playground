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
