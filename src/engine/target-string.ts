import { formatGenes } from './chromosome';
import type { GaParams } from './algorithm';
import { type Problem, type ProblemColumn } from './problem';

/**
 * Evolve a string toward a target. The alphabet and the target are part of the problem's setup, so changing either
 * is a reset. Fitness is the number of positions that already hold the target's letter (identity rule: fitness
 * equals the objective value), so the optimum is the target's length.
 */
export interface TargetStringOptions {
  /** Every symbol a gene can take, in order, as typed (case matters). Each symbol is one character. */
  readonly alphabet: string;
  readonly target: string;
}

export const targetStringLimits = { minAlphabet: 2, maxAlphabet: 40, minTarget: 1, maxTarget: 24 } as const;

/** How a character is named in a message: a space would otherwise be invisible. */
const named = (character: string): string => (character === ' ' ? 'a space' : `"${character}"`);

/** What is wrong with the alphabet and with the target, in words, each under the field it concerns. */
export function validateTargetStringFields(options: TargetStringOptions): { readonly alphabet: string[]; readonly target: string[] } {
  const alphabetProblems: string[] = [];
  const targetProblems: string[] = [];
  const { minAlphabet, maxAlphabet, minTarget, maxTarget } = targetStringLimits;
  const symbols = [...options.alphabet];

  if (symbols.length < minAlphabet) alphabetProblems.push(`The alphabet needs at least ${minAlphabet} symbols, so that a gene has something to change into.`);
  if (symbols.length > maxAlphabet) alphabetProblems.push(`The alphabet can have at most ${maxAlphabet} symbols (it has ${symbols.length}).`);
  const control = symbols.filter((s) => s.codePointAt(0)! < 32);
  if (control.length > 0) alphabetProblems.push('The alphabet may only contain visible characters and spaces.');
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const s of symbols) (seen.has(s) ? repeated : seen).add(s);
  for (const s of repeated) alphabetProblems.push(`The alphabet contains ${named(s)} more than once.`);

  const target = [...options.target];
  if (target.length < minTarget) targetProblems.push('The target must not be empty.');
  if (target.length > maxTarget) targetProblems.push(`The target can have at most ${maxTarget} characters (it has ${target.length}).`);
  const outside: string[] = [];
  target.forEach((c) => {
    if (!seen.has(c) && !outside.includes(c)) outside.push(c);
  });
  for (const c of outside) {
    const place = target.indexOf(c) + 1;
    targetProblems.push(`The target contains ${named(c)} (position ${place}), which is not in the alphabet. Add it to the alphabet or remove it from the target.`);
  }
  return { alphabet: alphabetProblems, target: targetProblems };
}

/** Everything wrong with these options, in words, or an empty list. */
export function validateTargetString(options: TargetStringOptions): string[] {
  const { alphabet, target } = validateTargetStringFields(options);
  return [...alphabet, ...target];
}

export type TargetStringProblem = Problem & { readonly knownOptimumFitness: number; readonly options: TargetStringOptions };

/** The problem for these options; throws with the first validation message when they are not valid. */
export function targetStringProblem(options: TargetStringOptions): TargetStringProblem {
  const problems = validateTargetString(options);
  if (problems.length > 0) throw new Error(problems[0]);
  const alphabet = [...options.alphabet];
  const target = [...options.target];
  const wanted = target.map((c) => alphabet.indexOf(c));
  const length = wanted.length;
  const columns: ProblemColumn[] = [{ header: 'Fitness', note: '= matches', show: (scores) => `${scores.objective} of ${length}` }];
  return {
    options,
    chromosomeLength: length,
    alphabet,
    columns,
    knownOptimumFitness: length,
    scoreText: (scores) => `${scores.objective} of ${length} positions match`,
    evaluationExplanation: 'Each finished offspring is compared with the target position by position: the objective is how many positions match, and fitness is the same number.',
    evaluate(chromosome) {
      let matches = 0;
      for (let k = 0; k < length; k++) if (chromosome[k] === wanted[k]) matches++;
      return { decoded: formatGenes(chromosome, alphabet), objective: matches, fitness: matches };
    },
  };
}

/** The setup the target string opens with, as plain data (the problem menu's first entry for it). */
export const targetStringDefaults: {
  readonly options: TargetStringOptions;
  readonly populationSize: number;
  readonly params: GaParams;
} = {
  options: { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', target: 'HELLO' },
  populationSize: 12,
  params: {
    // tournament selection: with 27 symbols and a small population, fitness-proportional selection is too gentle to
    // converge in a classroom-sized run (measured over 20 seeds); tournaments of 3 reach the target in all of them
    selection: { method: 'tournament', size: 3 },
    crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
    mutation: { enabled: true, mode: 'per-gene', probability: 0.1 },
    elites: 0,
    // the target is reached when every position matches
    stop: { generationLimit: 100, targetFitness: 5, stagnationWindow: 15 },
  },
};
