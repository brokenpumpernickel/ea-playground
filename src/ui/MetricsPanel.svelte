<script lang="ts">
  import AlleleStrip from './AlleleStrip.svelte';
  import DiversityPlot from './DiversityPlot.svelte';
  import FitnessPlot from './FitnessPlot.svelte';
  import { num } from './format';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  const m = $derived(session.metrics);
  const plots = $derived(session.plots);
  const size = $derived(session.table.rows.length);
</script>

<section class="panel plot" style="left:24px;top:758px;width:820px;height:244px" aria-labelledby="fitness-heading">
  <div class="ph">
    <h2 id="fitness-heading">Fitness</h2>
    <span class="r legend"><b>●</b> average &nbsp;<b>■</b> best of gen. &nbsp;<b>▲</b> best so far &nbsp;<b class="band">▒</b> min–max</span>
  </div>
  <FitnessPlot model={plots} />
</section>

<section class="panel plot" style="left:860px;top:758px;width:540px;height:244px" aria-labelledby="diversity-heading">
  <div class="ph">
    <h2 id="diversity-heading">Diversity</h2>
    <span class="r legend">mean pairwise Hamming, 0–1</span>
  </div>
  <DiversityPlot model={plots} />
</section>

<section class="panel plot" style="left:1416px;top:758px;width:480px;height:244px" aria-labelledby="allele-heading">
  <div class="ph">
    <h2 id="allele-heading">Share of 1s per gene</h2>
    <span class="r legend" data-testid="distinct">{m.distinct} of {size} distinct</span>
  </div>
  <AlleleStrip shares={m.alleleFrequencies} />
  <p class="summary" data-testid="summary">
    generation {m.generation} · best now {m.best} · best so far {m.bestSoFar}<br />
    average {num(Math.round(m.average * 10) / 10)} · worst {m.worst} · evaluations {m.evaluations}
  </p>
</section>

<!-- the same numbers as the plots, for anyone who cannot read a chart -->
<table class="sr-only" aria-label="Metrics by generation" data-testid="metrics-table">
  <thead>
    <tr><th>Generation</th><th>Average</th><th>Worst</th><th>Best of generation</th><th>Best so far</th><th>Diversity</th><th>Distinct</th></tr>
  </thead>
  <tbody>
    {#each plots.points as p (p.generation)}
      <tr><td>{p.generation}</td><td>{num(p.average)}</td><td>{p.min}</td><td>{p.best}</td><td>{p.bestSoFar}</td><td>{num(p.diversity)}</td><td>{p.distinct}</td></tr>
    {/each}
  </tbody>
</table>
