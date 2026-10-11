import type { GaEvent } from '../engine';
import { goldbergDisplay, type Display } from './format';
import { geneList, num } from './format';

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

function describeWith(event: GaEvent, display: Display): string {
  const formatBits = display.show;
  switch (event.stage) {
    case 'setup': {
      const i = event.individual;
      return `Individual ${i.id} (${formatBits(i.chromosome)}): ${scored(i, display)}fitness ${i.fitness}`;
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
        case 'probabilities':
          return `Probabilities: ${event.entries.map((e) => `individual ${e.individualId} = ${num(e.probability)}`).join(', ')}`;
        case 'spin':
          return `Spin ${event.spin}: r = ${num(event.r)} → individual ${event.individualId}`;
        case 'tournament-setup':
          return `Tournaments of ${event.size} compare fitness directly; the weight chain is not used`;
        case 'tournament': {
          const contestants = event.contestants.map((c) => `individual ${c.individualId} (fitness ${num(c.fitness)})`).join(' vs ');
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
      const kids = `${formatBits(first!.chromosome)} and ${formatBits(second!.chromosome)}`;
      const dropped = second!.discarded ? ' · second child dropped' : '';
      const head = `Pair ${event.pair}:`;
      if (event.decision === 'bypassed') {
        const why = event.reason === 'switched-off' ? 'crossover is off' : `u = ${num(event.draw!.u)} ≥ pc ${num(event.draw!.threshold)}`;
        return `${head} ${why} → bypassed: children are copies, ${kids}${dropped}`;
      }
      let where = '';
      if (event.cuts && event.cuts.length === 1) where = ` (cut after gene ${event.cuts[0]})`;
      else if (event.cuts) where = ` (cuts after genes ${event.cuts[0]} and ${event.cuts[1]})`;
      else if (event.mask) {
        const swapped = event.mask.flatMap((m, g) => (m ? [g + 1] : []));
        where = swapped.length > 0 ? ` (${geneList(swapped)} taken from the other parent)` : ' (no gene taken from the other parent)';
      }
      return `${head} u = ${num(event.draw!.u)} < pc ${num(event.draw!.threshold)} → recombined${where}: children ${kids}${dropped}`;
    }

    case 'mutation': {
      const before = formatBits(event.before);
      const after = formatBits(event.after);
      const head = `Offspring ${event.offspring}:`;
      const pm = num(event.threshold);
      if (event.decision === 'bypassed') return `${head} mutation is off → unchanged (${before})`;
      if (event.mode === 'per-individual') {
        const u = num(event.individualDraw!.u);
        if (event.decision === 'unchanged') return `${head} u = ${u} ≥ pm ${pm} → unchanged (${before})`;
        return `${head} u = ${u} < pm ${pm} → mutated, gene ${event.chosenGene!.gene} chosen (${before} → ${after})`;
      }
      if (event.decision === 'unchanged') return `${head} no gene drew below pm ${pm} → unchanged (${before})`;
      if (event.flipped.length === 1) {
        const u = event.geneDraws!.find((d) => d.gene === event.flipped[0])!.u;
        return `${head} gene ${event.flipped[0]} drew u = ${num(u)} < pm ${pm} → flipped (${before} → ${after})`;
      }
      return `${head} ${geneList(event.flipped)} drew below pm ${pm} → flipped (${before} → ${after})`;
    }

    case 'evaluation': {
      const i = event.individual;
      return `Offspring ${event.offspring}: ${formatBits(i.chromosome)} → ${scored(i, display, ' → ')}fitness ${i.fitness} (individual ${i.id})`;
    }

    case 'replacement': {
      const ids = event.population.map((id) => (event.elites.includes(id) ? `${id} (elite)` : String(id)));
      const lost = (event.ranking ?? []).filter((r) => !r.kept);
      // a long list would not fit the one-line narration; the stage view names each one
      const discarded = lost.length > 2 ? `${lost.length} offspring (ranks ${lost[0]!.rank}–${lost[lost.length - 1]!.rank})` : lost.map((r) => `offspring ${r.offspring} (rank ${r.rank})`).join(', ');
      const tail = lost.length > 0 ? `. Discarded: ${discarded}` : '';
      return `Next population: individuals ${ids.join(', ')}${tail}`;
    }
  }
}

/** The part of a sentence that says what a chromosome scored before its fitness: "x = 13, " or "4 of 5 positions match, ". */
function scored(i: { readonly decoded: number | string; readonly objective: number; readonly fitness: number }, display: Display, separator = ', '): string {
  if (display.scoreText) return display.scoreText(i) + separator;
  return typeof i.decoded === 'number' ? `x = ${i.decoded}${separator}` : '';
}
