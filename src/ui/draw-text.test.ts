import { describe, expect, test } from 'vitest';
import { drawText } from './draw-text';

const plain = { geneCount: 5, trapBlocks: false, landscapeBits: false };

describe('the draw printed under a gene in the mutation cards', () => {
  test('is the draw to three decimals where the columns are wide enough', () => {
    expect(drawText({ u: 0.28149, flipped: false }, plain)).toBe('0.281');
    expect(drawText({ u: 0.5, flipped: true }, plain)).toBe('0.5');
    expect(drawText({ u: 0.28149, flipped: false }, { ...plain, landscapeBits: true, geneCount: 20 })).toBe('0.281');
  });

  test('loses its leading zero in the narrow columns of a trap', () => {
    expect(drawText({ u: 0.28149, flipped: false }, { geneCount: 20, trapBlocks: true, landscapeBits: false })).toBe('.281');
  });

  test('above 20 genes only the draws that flipped a gene are printed, as two decimals without the zero, in a trap and in a binary-coded landscape', () => {
    for (const layout of [
      { geneCount: 21, trapBlocks: true, landscapeBits: false },
      { geneCount: 24, trapBlocks: false, landscapeBits: true },
    ]) {
      expect(drawText({ u: 0.043, flipped: true }, layout)).toBe('.04');
      expect(drawText({ u: 0.007, flipped: true }, layout)).toBe('.00');
      expect(drawText({ u: 0.6, flipped: false }, layout)).toBe('');
    }
  });

  test('20 genes is still printed in full; other problems are never shortened, however long', () => {
    expect(drawText({ u: 0.6, flipped: false }, { geneCount: 20, trapBlocks: false, landscapeBits: true })).toBe('0.6');
    expect(drawText({ u: 0.6, flipped: false }, { geneCount: 40, trapBlocks: false, landscapeBits: false })).toBe('0.6');
  });
});
