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

/** The width of a group of `size` cells in a chromosome of `genes` genes. */
export const groupWidth = (size: number, genes: number): number => {
  const g = blockGeometry(genes);
  return size * g.cell + (size - 1) * g.gap;
};

/** The width of a whole chromosome of `blocks` blocks of `blockSize` genes. */
export function chromosomeWidth(blockSize: number, blocks: number, linkage: Linkage): number {
  const genes = blockSize * blocks;
  const g = blockGeometry(genes);
  return linkage === 'tight' ? blocks * groupWidth(blockSize, genes) + (blocks - 1) * g.blockGap : genes * g.cell + (genes - 1) * g.gap;
}
