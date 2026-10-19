<script lang="ts">
  import AlleleStrip from './AlleleStrip.svelte';
  import BlockStatesStrip from './BlockStatesStrip.svelte';
  import ChosenStrip from './ChosenStrip.svelte';
  import { chosenShares } from './chosen-model';
  import DiversityPlot from './DiversityPlot.svelte';
  import EdgeStrip from './EdgeStrip.svelte';
  import FitnessPlot from './FitnessPlot.svelte';
  import FunctionPlot from './FunctionPlot.svelte';
  import { landscapeModel } from './landscape-model';
  import { occupancy, occupancySentence, peakRadius } from './peak-occupancy';
  import MatchRateStrip from './MatchRateStrip.svelte';
  import { matchRates } from './match-rate-model';
  import { targetOf } from './problems';
  import { num } from './format';
  import SpreadPanel from './SpreadPanel.svelte';
  import { tourStatsLines } from './tour-cells';
  import { spreadPanel, statsLines } from './spread-model';
  import type { Session } from './session.svelte';

  let { session, showFunction, toggleFunction }: { session: Session; showFunction: boolean; toggleFunction: () => void } = $props();

  const m = $derived(session.metrics);
  const plots = $derived(session.plots);
  const size = $derived(session.table.rows.length);
  const entry = $derived(session.problemEntry);
  const rates = $derived(entry.genePanel === 'match-rate' && targetOf(session.problemOptions) !== undefined ? matchRates(m, targetOf(session.problemOptions)!, session.problem.alphabet) : undefined);
  const blockStates = $derived(entry.genePanel === 'blocks' ? session.blockStates : undefined);
  const chosen = $derived(entry.genePanel === 'chosen' ? chosenShares(m) : undefined);
  const spread = $derived(entry.genePanel === 'spread' ? spreadPanel(plots) : undefined);
  const edges = $derived(entry.genePanel === 'agreement' ? m.tour : undefined);
  const tour = $derived(session.tour);
  const stats = $derived(spread ? statsLines(m) : undefined);
  const tourStats = $derived(edges && tour ? tourStatsLines(tour, m) : undefined);
  const peakRows = $derived(session.landscape?.peaks ? occupancy(session.landscape.peaks, session.table.rows.flatMap((r) => (r.values ? [{ x: r.values[0]!, y: r.values[1]! }] : []))) : undefined);
  const landscape = $derived(session.problem.landscape);
  const curve = $derived(landscape ? landscapeModel(landscape, session.table.rows) : undefined);
</script>

<section class="panel plot" style="left:24px;top:758px;width:820px;height:244px" aria-labelledby="fitness-heading">
  <div class="ph">
    <h2 id="fitness-heading">Fitness</h2>
    <span class="r legend"><b>●</b> average &nbsp;<b>■</b> best of gen. &nbsp;<b>▲</b> best so far &nbsp;<b class="band">▒</b> min–max{#if session.landscape?.minimised} &nbsp;fitness = −f{/if}{#if tour} &nbsp;fitness = −length{/if}{#if plots.feasibleLine} &nbsp;<b>◇</b> best <u>feasible</u> so far{/if}</span>
  </div>
  <FitnessPlot model={plots} />
</section>

{#if showFunction && curve}
  <section class="panel plot" style="left:860px;top:758px;width:1036px;height:244px" aria-labelledby="function-heading">
    <div class="ph">
      <h2 id="function-heading">Function</h2>
      <span class="r legend">generation {m.generation} · <b>{curve.label}</b> · <b>●</b> individual on the axis · <b>◆</b> its fitness · higher is better
        <button class="btn quiet tiny" onclick={toggleFunction} aria-keyshortcuts="F" data-testid="show-metrics">Diversity &amp; genes <kbd aria-hidden="true">F</kbd></button></span>
    </div>
    <FunctionPlot model={curve} />
  </section>
{:else}
<section class="panel plot" style="left:860px;top:758px;width:540px;height:244px" aria-labelledby="diversity-heading">
  <div class="ph">
    <h2 id="diversity-heading">Diversity</h2>
    <span class="r legend">{#if plots.hammingLine}<b>●</b> decoded distance &nbsp;<b>◇</b> Hamming, 0–1{:else}{entry.diversityNote}{/if}{#if curve}
        <button class="btn quiet tiny" onclick={toggleFunction} aria-keyshortcuts="F" data-testid="show-function">f(x) <kbd aria-hidden="true">F</kbd></button>{/if}</span>
  </div>
  <DiversityPlot model={plots} />
</section>

<section class="panel plot" style="left:1416px;top:758px;width:480px;height:244px" aria-labelledby="allele-heading">
  <div class="ph">
    <h2 id="allele-heading">{rates ? 'Match rate per position' : chosen ? 'Chosen per item' : blockStates ? 'Block states' : spread ? 'Spread' : entry.genePanel === 'agreement' ? 'Edge agreement' : 'Share of 1s per gene'}</h2>
    <span class="r legend" data-testid="distinct">{m.distinct} of {size} distinct{edges ? ' routes' : ''}</span>
  </div>
  {#if rates}<MatchRateStrip {rates} />{:else if chosen}<ChosenStrip shares={chosen} />{:else if blockStates}<BlockStatesStrip model={blockStates} />{:else if spread}<SpreadPanel panel={spread} />{:else if edges}<EdgeStrip shares={edges.agreement} route={edges.bestRoute} {size} />{:else}<AlleleStrip shares={m.alleleFrequencies} />{/if}
  <p class="summary" class:landscape={stats !== undefined} class:tourstats={tourStats !== undefined} class:withpeaks={peakRows !== undefined && stats !== undefined} data-testid="summary">
    {#if tourStats}{tourStats[0]}<br />{tourStats[1]}{:else if stats}{stats[0]}<br />{stats[1]}{#if peakRows}<br /><span class="peakline" data-testid="peak-readout" aria-hidden="true" title="Individuals within {peakRadius} of each peak">near: {#each peakRows as r, k (r.name)}{k > 0 ? ' · ' : ''}{r.name} <b>{r.count}</b>{/each}</span>{/if}{:else}
    generation {m.generation} · best now {m.best} · best so far {m.bestSoFar}<br />
    average {num(Math.round(m.average * 10) / 10)} · worst {m.worst} · evaluations {m.evaluations}{#if m.feasible}{' · '}feasible {m.feasible.count} of {size}{/if}{/if}
  </p>
</section>
{/if}

{#if peakRows}
  <p class="sr-only" data-testid="peak-sentence">{occupancySentence(peakRows, size)}</p>
  <table class="sr-only" aria-label="Individuals near each peak" data-testid="peaks-table">
    <thead><tr><th scope="col">Peak</th><th scope="col">x</th><th scope="col">y</th><th scope="col">Individuals within {peakRadius}</th></tr></thead>
    <tbody>
      {#each peakRows as r (r.name)}
        <tr data-peak={r.name}><th scope="row">{r.name}</th><td>{num(r.x)}</td><td>{num(r.y)}</td><td>{r.count}</td></tr>
      {/each}
    </tbody>
  </table>
{/if}

<!-- the same numbers as the plots, for anyone who cannot read a chart -->
<table class="sr-only" aria-label="Metrics by generation" data-testid="metrics-table">
  <thead>
    <tr><th>Generation</th><th>Average</th><th>Worst</th><th>Best of generation</th><th>Best so far</th><th>Diversity</th><th>Distinct</th></tr>
  </thead>
  <tbody>
    {#each plots.points as p (p.generation)}
      <tr><td>{p.generation}</td><td>{num(p.average)}</td><td>{num(p.min)}</td><td>{num(p.best)}</td><td>{num(p.bestSoFar)}</td><td>{num(p.diversity)}</td><td>{p.distinct}</td></tr>
    {/each}
  </tbody>
</table>
