import { num } from './format';

/** Where a draw is printed: how many genes the chromosome has, and whether the problem narrows the columns (a trap's blocks) or draws two numbers in bits (the binary-coded landscape). */
export interface DrawLayout {
  readonly geneCount: number;
  readonly trapBlocks: boolean;
  readonly landscapeBits: boolean;
}

/** Above this many genes only the draws that flipped a gene are printed: the others were all at or above the threshold, and the columns could not hold them. */
export const printAllDrawsUpTo = 20;

/**
 * A draw under its gene in the mutation cards. In a trap the columns are narrow, so the leading 0 goes (.281); above 20 genes,
 * in a trap or in a binary-coded landscape, only the draws that flipped a gene are printed (as .04).
 */
export function drawText(d: { u: number; flipped: boolean }, layout: DrawLayout): string {
  const crowded = (layout.trapBlocks || layout.landscapeBits) && layout.geneCount > printAllDrawsUpTo;
  if (crowded) return d.flipped ? `.${String(Math.floor(d.u * 100)).padStart(2, '0')}` : '';
  return layout.trapBlocks ? num(d.u).replace(/^0\./, '.') : num(d.u);
}
