import type { Linkage } from '../engine';

/**
 * How big the cells of a chromosome made of blocks are, in pixels. The chromosome's cells, the block row above them and
 * the notes under them all take their sizes from here, so each block's label sits exactly over its group of cells.
 * Chromosomes of up to 20 genes get 20 px cells; from 21 genes the cells are 15 px, so that 30 still fit the table.
 */
export interface BlockGeometry {
  readonly cell: number;
  readonly height: number;
  readonly font: number;
  /** Between two genes of one block. */
  readonly gap: number;
  /** Between two blocks (tight linkage). */
  readonly blockGap: number;
}

export const blockGeometry = (genes: number): BlockGeometry =>
  genes <= 20 ? { cell: 20, height: 26, font: 16, gap: 2, blockGap: 6 } : { cell: 15, height: 24, font: 13, gap: 1, blockGap: 4 };

/**
 * How much wider than its cell each gene's column is in a mutation card, where a draw is printed under every gene: room
 * for a draw like .281 up to 20 genes; above that only the draws that flipped a gene are printed, so none.
 */
export const drawExtra = (genes: number): number => (genes <= 20 ? 8 : 0);

/** The width of a group of `size` cells in a chromosome of `genes` genes, each column `extra` px wider than its cell. */
export const groupWidth = (size: number, genes: number, extra = 0): number => {
  const g = blockGeometry(genes);
  return size * (g.cell + extra) + (size - 1) * g.gap;
};

/** The width of a whole chromosome of `blocks` blocks of `blockSize` genes. */
export function chromosomeWidth(blockSize: number, blocks: number, linkage: Linkage): number {
  const genes = blockSize * blocks;
  const g = blockGeometry(genes);
  return linkage === 'tight' ? blocks * groupWidth(blockSize, genes) + (blocks - 1) * g.blockGap : genes * g.cell + (genes - 1) * g.gap;
}
