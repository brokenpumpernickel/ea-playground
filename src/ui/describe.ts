import { formatReal, type GaEvent, type MutationEvent } from '../engine';
import { goldbergDisplay, type Display } from './format';
import { geneList, num } from './format';
import { realPair, realPairText } from './landscape-cells';
import { briefTour } from './tour-cells';
import { tourMutationNotes } from './tour-variation';

/** Plain-language sentences for what the engine recorded, so every number a view shows can be traced to an event. */

export function stageTitle(stage: string): string {
  const titles: Record<string, string> = {
    setup: 'Setup: scoring the initial population',
    selection: 'Selection',
    pairing: 'Pairing',
    crossover: 'Crossover',
    mutation: 'Mutation',
    evaluation: 'Evaluation of offspring',
    replacement: 'Replacement',
  };
  return titles[stage] ?? stage;
}

/** A describer for a problem's way of showing chromosomes. */
export const describer = (display: Display) => (event: GaEvent): string => describeWith(event, display);

/** The describer for Goldberg (and any other binary problem). */
export const describeEvent = describer(goldbergDisplay);

/** For alphabets of more than 2 symbols: which symbol each flipped gene became, and the draw r that picked it. */
function replaced(event: MutationEvent, display: Display): string {
  if (!event.replacements) return '';
  const shown = (g: number) => display.show([g]);
  return `; ${event.replacements.map((x) => `gene ${x.gene}: ${shown(x.from)} → ${shown(x.to)} (r = ${num(x.r)})`).join(', ')}`;
}

/** A real chromosome as the pair "(x, y)" for a sentence; any other chromosome as the display shows it. */
const shower = (display: Display) => (chromosome: readonly number[]): string => {
  const text = display.show(chromosome);
  // a tour of many cities does not fit a line of narration: its first and last cities, and how many are between
  if (display.tour) return briefTour(text.split(' ').map(Number));
  const pair = display.landscape?.representation === 'real' ? realPair(text) : undefined;
  return pair ? realPairText(pair) : text;
};

const nameOf = (gene: number) => (gene === 1 ? 'x' : 'y');
/** Coordinates, steps and distances: three decimals and a real minus sign, as the tables show them; z, trimmed. */
const f3 = (v: number) => formatReal([v], 3);
const trimmed = (v: number) => num(v).replace('-', '−');
const signed = (v: number) => `${v < 0 ? '−' : '+'}${f3(Math.abs(v))}`;
const stepText = (s: { z: number; step: number; before: number; after: number; clamped: boolean }) =>
  `z = ${trimmed(s.z)}, step ${signed(s.step)} (${f3(s.before)} → ${f3(s.after)}${s.clamped ? ', clamped to the bound' : ''})`;

/** For a binary-coded landscape: where the offspring's point was and is. */
function moved(event: MutationEvent, display: Display): string {
  const land = display.landscape;
  if (!land || land.representation === 'real' || event.decision !== 'mutated') return '';
  const a = land.pointOf(event.before);
  const b = land.pointOf(event.after);
  const text = (p: { x: number; y: number }) => `(${f3(p.x)}, ${f3(p.y)})`;
  return `; the point moves from ${text(a)} to ${text(b)} by ${f3(Math.hypot(b.x - a.x, b.y - a.y))}`;
}

function describeWith(event: GaEvent, display: Display): string {
  const formatBits = shower(display);
  const real = display.landscape?.representation === 'real';
  /** A landscape's fitness is a long fraction: three decimals, as the tables show it. */
  const fit = (v: number) => (display.landscape ? num(v) : v);
  switch (event.stage) {
    case 'setup': {
      const i = event.individual;
      const steps = (display.explainEvaluation?.(event.repairedFrom ?? i.chromosome).details ?? []).map((d) => `${d}; `).join('');
      const chromosome = event.repairedFrom ? `${formatBits(event.repairedFrom)} repaired to ${formatBits(i.chromosome)}` : formatBits(i.chromosome);
      return real ? `Individual ${i.id}: ${steps}${scored(i, display)}fitness ${fit(i.fitness)}` : `Individual ${i.id} (${chromosome}): ${steps}${scored(i, display)}fitness ${fit(i.fitness)}`;
    }

    case 'selection':
      switch (event.kind) {
        case 'weight-chain': {
          const steps = event.columns.map((c) => c.label).join(' → ');
          const base = `Selection weights: fitness → ${steps} → weight`;
          if (!event.autoSwitch) return base;
          const cause = event.autoSwitch.reason.replace(/\s*Switched to Shift.*$/, '');
          return `${base}. Switched to Shift automatically: ${cause}`;
        }
        case 'sharing': {
          const spun = event.method === 'roulette' ? 'the wheel spins on' : 'the tournaments compare';
          const shifted = event.shifted ? ' (fitness shifted to positive first)' : '';
          return `Fitness sharing, niche radius σ = ${num(event.sigma)}: each weight is divided by its niche count${shifted}, and ${spun} the shared weights`;
        }
        case 'probabilities':
          return `Probabilities: ${event.entries.map((e) => `individual ${e.individualId} = ${num(e.probability)}`).join(', ')}`;
        case 'spin':
          return `Spin ${event.spin}: r = ${num(event.r)} → individual ${event.individualId}`;
        case 'tournament-setup':
          return event.comparesShared ? `Tournaments of ${event.size} compare the shared weights (weight ÷ niche count); the weight chain is not used` : `Tournaments of ${event.size} compare fitness directly; the weight chain is not used`;
        case 'tournament': {
          const contestants = event.contestants.map((c) => `individual ${c.individualId} (${c.shared !== undefined ? `shared ${num(c.shared)}` : `fitness ${num(c.fitness)}`})`).join(' vs ');
          const tie = event.tieBreak ? ' (tie: the lower position wins)' : '';
          return `Tournament ${event.tournament}: ${contestants} → individual ${event.winnerId} wins${tie}`;
        }
      }
      break;

    case 'pairing': {
      const dropped = event.secondChildDropped ? ' (odd count: its second child will be dropped)' : '';
      return `Pair ${event.pair}: slots ${event.slotA} and ${event.slotB} → individual ${event.parentAId} with individual ${event.parentBId}${dropped}`;
    }

    case 'crossover': {
      const [first, second] = event.children;
      if (display.tour) {
        const info = display.tour;
        const lengths = event.children.filter((c) => !c.discarded).map((c) => info.lengthText(info.lengthOf(c.chromosome))).join(' and ');
        const dropped = second!.discarded ? ' · second child dropped' : '';
        if (event.decision === 'bypassed') {
          const why = event.reason === 'switched-off' ? 'crossover is off' : `u = ${num(event.draw!.u)} ≥ pc ${num(event.draw!.threshold)}`;
          return `Pair ${event.pair}: ${why} → bypassed: children are copies, ${lengths}${dropped}`;
        }
        const operator = event.operator.toUpperCase();
        const where = event.cuts ? `${operator}, slice positions ${event.cuts[0]! + 1} to ${event.cuts[1]}` : `${operator}, ${event.cycles!.length} ${event.cycles!.length === 1 ? 'cycle' : 'cycles'}`;
        return `Pair ${event.pair}: u = ${num(event.draw!.u)} < pc ${num(event.draw!.threshold)} → ${where} → children ${lengths}${dropped}`;
      }
      const kids = `${formatBits(first!.chromosome)} and ${formatBits(second!.chromosome)}`;
      const dropped = second!.discarded ? ' · second child dropped' : '';
      const head = `Pair ${event.pair}:`;
      if (event.decision === 'bypassed') {
        const why = event.reason === 'switched-off' ? 'crossover is off' : `u = ${num(event.draw!.u)} ≥ pc ${num(event.draw!.threshold)}`;
        return `${head} ${why} → bypassed: children are copies, ${kids}${dropped}`;
      }
      let where = '';
      if (event.blend) where = ` (BLX-α, α = ${num(event.alpha ?? 0.5)})`;
      else if (event.lambda !== undefined) where = ` (arithmetic, λ = ${num(event.lambda)})`;
      else if (event.cuts && event.cuts.length === 1) where = ` (cut after gene ${event.cuts[0]})`;
      else if (event.cuts) where = ` (cuts after genes ${event.cuts[0]} and ${event.cuts[1]})`;
      else if (event.mask) {
        const swapped = event.mask.flatMap((m, g) => (m ? [g + 1] : []));
        where = swapped.length > 0 ? ` (${geneList(swapped)} taken from the other parent)` : ' (no gene taken from the other parent)';
      }
      const clamps = event.children.flatMap((c) => (c.clamped ?? []).flatMap((x, g) => (x ? [`O${c.offspring} ${nameOf(g + 1)}`] : [])));
      const clamped = clamps.length > 0 ? ` · clamped to a bound: ${clamps.join(', ')}` : '';
      return `${head} u = ${num(event.draw!.u)} < pc ${num(event.draw!.threshold)} → recombined${where}: children ${kids}${dropped}${clamped}`;
    }

    case 'mutation': {
      const before = formatBits(event.before);
      const after = formatBits(event.after);
      const head = `Offspring ${event.offspring}:`;
      const pm = num(event.threshold);
      if (display.tour) {
        const notes = tourMutationNotes(event, display.tour);
        if (event.decision === 'bypassed') return `${head} mutation is off → unchanged (${notes.lengthText})`;
        const u = num(event.individualDraw!.u);
        if (event.decision === 'unchanged') return `${head} u = ${u} ≥ pm ${pm} → unchanged (${notes.lengthText})`;
        return `${head} u = ${u} < pm ${pm} → ${notes.moveText}: ${notes.lengthText}`;
      }
      if (real) return describeGaussian(event, head, pm, before, after);
      if (event.decision === 'bypassed') return `${head} mutation is off → unchanged (${before})`;
      if (event.mode === 'per-individual') {
        const u = num(event.individualDraw!.u);
        if (event.decision === 'unchanged') return `${head} u = ${u} ≥ pm ${pm} → unchanged (${before})`;
        return `${head} u = ${u} < pm ${pm} → mutated, gene ${event.chosenGene!.gene} chosen (${before} → ${after})${replaced(event, display)}${moved(event, display)}`;
      }
      if (event.decision === 'unchanged') return `${head} no gene drew below pm ${pm} → unchanged (${before})`;
      if (event.flipped.length === 1) {
        const u = event.geneDraws!.find((d) => d.gene === event.flipped[0])!.u;
        return `${head} gene ${event.flipped[0]} drew u = ${num(u)} < pm ${pm} → flipped (${before} → ${after})${replaced(event, display)}${moved(event, display)}`;
      }
      return `${head} ${geneList(event.flipped)} drew below pm ${pm} → flipped (${before} → ${after})${replaced(event, display)}${moved(event, display)}`;
    }

    case 'evaluation': {
      const i = event.individual;
      const steps = (display.explainEvaluation?.(event.repairedFrom ?? i.chromosome).details ?? []).map((d) => `${d}; `).join('');
      const chromosome = event.repairedFrom ? `${formatBits(event.repairedFrom)} → repaired to ${formatBits(i.chromosome)}` : formatBits(i.chromosome);
      return `Offspring ${event.offspring}: ${real || display.tour ? '' : `${chromosome} → `}${steps}${scored(i, display, ' → ')}fitness ${fit(i.fitness)} (individual ${i.id})`;
    }

    case 'replacement': {
      const ids = event.population.map((id) => (event.elites.includes(id) ? `${id} (elite)` : String(id)));
      const lost = (event.ranking ?? []).filter((r) => !r.kept);
      // a long list would not fit the one-line narration; the stage view names each one
      const discarded = lost.length > 2 ? `${lost.length} offspring (ranks ${lost[0]!.rank}–${lost[lost.length - 1]!.rank})` : lost.map((r) => `offspring ${r.offspring} (rank ${r.rank})`).join(', ');
      const tail = lost.length > 0 ? `. Discarded: ${discarded}` : '';
      // a long population would not fit the one-line narration either: its first ten, and how many there are in all
      const listed = ids.length > 12 ? `${ids.slice(0, 10).join(', ')}, … (${ids.length} in all)` : ids.join(', ');
      return `Next population: individuals ${listed}${tail}`;
    }
  }
}

/** The part of a sentence that says what a chromosome scored before its fitness: "x = 13, " or "4 of 5 positions match, ". */
function scored(i: { readonly decoded: number | string; readonly objective: number; readonly fitness: number }, display: Display, separator = ', '): string {
  if (display.scoreText) return display.scoreText(i) + separator;
  return typeof i.decoded === 'number' ? `x = ${i.decoded}${separator}` : '';
}

/** Gaussian mutation of a real-valued landscape: which gene drew what, and each step. */
function describeGaussian(event: MutationEvent, head: string, pm: string, before: string, after: string): string {
  if (event.decision === 'bypassed') return `${head} mutation is off → unchanged, still ${before}`;
  if (event.mode === 'per-individual') {
    const u = num(event.individualDraw!.u);
    if (event.decision === 'unchanged') return `${head} u = ${u} ≥ pm ${pm} → unchanged, still ${before}`;
    const step = event.gaussian![0]!;
    return `${head} u = ${u} < pm ${pm} → mutated, gene ${nameOf(event.chosenGene!.gene)} chosen → ${stepText(step)}: ${before} → ${after}`;
  }
  if (event.decision === 'unchanged') return `${head} no gene drew below pm ${pm} → unchanged, still ${before}`;
  if (event.gaussian!.length === 1) {
    const step = event.gaussian![0]!;
    const u = event.geneDraws!.find((d) => d.gene === step.gene)!.u;
    return `${head} gene ${nameOf(step.gene)} drew u = ${num(u)} < pm ${pm} → ${stepText(step)}: ${before} → ${after}`;
  }
  return `${head} genes x and y drew below pm ${pm} → ${event.gaussian!.map((s) => `${nameOf(s.gene)}: ${stepText(s)}`).join('; ')}: ${before} → ${after}`;
}
