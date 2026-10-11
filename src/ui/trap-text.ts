/**
 * The trap function worked out in words and numbers, for the drawer's help: the rule, its source, what each kind of block
 * scores, and the two scores that matter (the optimum and all zeros).
 */

/** What blocks of k genes score, from all ones down; a long list keeps its first four entries and its last. */
export function trapExamples(k: number): string {
  const entries = [`${'1'.repeat(k)} → ${k}`];
  for (let u = 0; u < k; u++) entries.push(`${'1'.repeat(u)}${'0'.repeat(k - u)} → ${k - 1 - u}`);
  if (entries.length <= 6) return entries.join(', ');
  return [...entries.slice(0, 4), '…', entries[entries.length - 1]].join(', ');
}

export function trapDefinition(blockSize: number | undefined, blocks: number | undefined): string {
  const rule =
    'With u the number of 1s in a block of k genes, the block scores k when u = k and k − 1 − u otherwise (Deb and Goldberg’s k-bit trap).';
  if (blockSize === undefined || blocks === undefined) return rule;
  return `${rule} For k = ${blockSize}: ${trapExamples(blockSize)}. Every block pulls toward all zeros although all ones is best. The best fitness is ${blockSize * blocks}; all zeros scores ${blocks * (blockSize - 1)}.`;
}
