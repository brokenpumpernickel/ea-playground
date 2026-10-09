/** Numbers as the screen shows them: up to three decimals, with no trailing zeros (0.8, 0.144, 576). */
export const num = (v: number): string => String(Math.round(v * 1000) / 1000);

/** "gene 3", "genes 1 and 3", "genes 1, 3 and 5". */
export const geneList = (genes: readonly number[]): string =>
  genes.length === 1 ? `gene ${genes[0]}` : `genes ${genes.slice(0, -1).join(', ')} and ${genes[genes.length - 1]}`;
