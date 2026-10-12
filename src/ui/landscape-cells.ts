import { formatReal, type ProblemColumn } from '../engine';
import type { LandscapeInfo } from './landscape-context';

/**
 * How big the cells of a binary-coded landscape chromosome are, in pixels. The chromosome's cells and the variable row
 * above them take their sizes from here, so each variable's label sits exactly over its group of bits. Up to ten bits
 * per variable the cells are 17 px; above that 14 px, so that 12 + 12 bits still fit beside the table's other columns.
 */
export interface VariableGeometry {
  readonly cell: number;
  readonly height: number;
  readonly font: number;
  /** Between two bits of one variable. */
  readonly gap: number;
  /** Between the x group and the y group. */
  readonly groupGap: number;
}

export const variableGeometry = (bits: number): VariableGeometry =>
  bits <= 10 ? { cell: 17, height: 24, font: 13, gap: 1, groupGap: 10 } : { cell: 14, height: 24, font: 11, gap: 1, groupGap: 10 };

/** The width of one variable's group of `bits` cells. */
export const groupWidth = (bits: number): number => {
  const g = variableGeometry(bits);
  return bits * g.cell + (bits - 1) * g.gap;
};

/** The shown text of a real chromosome, "−2.698 −1.768", as its two numbers; undefined for anything else. */
export function realPair(text: string): { readonly x: string; readonly y: string } | undefined {
  const parts = text.split(' ');
  return parts.length === 2 && parts.every((p) => /^[−-]?\d+(\.\d+)?$/.test(p)) ? { x: parts[0]!, y: parts[1]! } : undefined;
}

export const realPairText = ({ x, y }: { x: string; y: string }): string => `(${x}, ${y})`;

export const realSentence = ({ x, y }: { x: string; y: string }): string => `x = ${x}, y = ${y}`;

/** The labels over the two groups of bits. */
export const variableLabels = (info: LandscapeInfo): [string, string] => [`x · ${info.bits} bits`, `y · ${info.bits} bits`];

/** How a variable is read, for the variable row's sentence. */
export const variableSentence = (info: LandscapeInfo): string => {
  const coding = info.representation === 'gray' ? 'from Gray code' : 'in plain binary';
  const range = `${formatReal([info.bounds.lo], 2).replace(/\.?0+$/, '')} to ${formatReal([info.bounds.hi], 2).replace(/\.?0+$/, '')}`;
  return `Variables: the first ${info.bits} bits are x and the next ${info.bits} are y; each is read as a whole number ${coding} and scaled onto ${range}.`;
};

/** A binary-coded chromosome in words: its two groups of bits and the point they decode to. */
export function bitsSentence(chromosome: string, info: LandscapeInfo): string {
  const { x, y } = info.pointOf([...chromosome].map(Number));
  return `x bits ${chromosome.slice(0, info.bits)}, y bits ${chromosome.slice(info.bits)}, decodes to x = ${formatReal([x], 3)}, y = ${formatReal([y], 3)}`;
}

/**
 * The columns of the population table to show. A real-valued run shows them all (the pair is the chromosome, the rest are
 * narrow). A binary-coded run keeps the decoded x and y beside the bits and fitness; the objective of a minimised function
 * only while there are few enough bits to leave the room, and with roulette weights beside them, only fitness stays: the
 * rest is in the evaluation view.
 */
export function visibleColumns(columns: readonly ProblemColumn[], info: LandscapeInfo, showSelection: boolean): ProblemColumn[] {
  if (info.representation === 'real') return [...columns];
  if (showSelection) return columns.filter((c) => c.header === 'Fitness');
  return columns.filter((c) => !c.optional || info.bits <= 6);
}
