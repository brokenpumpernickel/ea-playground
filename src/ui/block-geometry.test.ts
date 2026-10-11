import { describe, expect, test } from 'vitest';
import { linkages, trapLimits } from '../engine';
import { blockGeometry, chromosomeWidth, drawExtra, groupWidth } from './block-geometry';

describe('room for the draws printed under the genes of a mutation card', () => {
  test('up to 20 genes each gene column is 8 px wider than its cell, so a draw like .281 fits under it; above 20 only the draws that flipped a gene are printed, so there is no extra', () => {
    expect(drawExtra(20)).toBe(8);
    expect(drawExtra(8)).toBe(8);
    expect(drawExtra(21)).toBe(0);
    expect(drawExtra(30)).toBe(0);
  });

  test('a group of wide columns is as wide as its columns and gaps', () => {
    expect(groupWidth(4, 20, 8)).toBe(4 * 28 + 3 * 2);
    expect(groupWidth(4, 20)).toBe(groupWidth(4, 20, 0));
  });
});

describe('the size of the cells of a chromosome made of blocks', () => {
  test('up to 20 genes the cells are 20 px wide; from 21 genes they are 15 px, so that 30 genes still fit', () => {
    expect(blockGeometry(20)).toEqual({ cell: 20, height: 26, font: 16, gap: 2, blockGap: 6 });
    expect(blockGeometry(2)).toEqual(blockGeometry(20));
    expect(blockGeometry(21)).toEqual({ cell: 15, height: 24, font: 13, gap: 1, blockGap: 4 });
    expect(blockGeometry(30)).toEqual(blockGeometry(21));
  });

  test('a group of k cells is k cells and the gaps between them wide, and the whole chromosome adds the gaps between groups', () => {
    expect(groupWidth(4, 20)).toBe(4 * 20 + 3 * 2);
    expect(groupWidth(8, 30)).toBe(8 * 15 + 7 * 1);
    expect(chromosomeWidth(4, 5, 'tight')).toBe(5 * 86 + 4 * 6);
    expect(chromosomeWidth(4, 5, 'loose')).toBe(20 * 20 + 19 * 2);
  });

  test('every valid size, tight or loose, fits the 560 px a table gives the chromosome', () => {
    for (const linkage of linkages) {
      for (let k = trapLimits.minBlockSize; k <= trapLimits.maxBlockSize; k++) {
        for (let m = trapLimits.minBlocks; m <= trapLimits.maxBlocks; m++) {
          if (k * m > trapLimits.maxGenes) continue;
          expect(chromosomeWidth(k, m, linkage), `${m} blocks of ${k}, ${linkage}`).toBeLessThanOrEqual(560);
        }
      }
    }
  });
});
