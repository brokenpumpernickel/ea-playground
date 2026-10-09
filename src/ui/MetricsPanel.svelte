<script lang="ts">
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  const m = $derived(session.metrics);
  const size = $derived(session.table.rows.length);
  const round = (v: number, places = 3) => String(Math.round(v * 10 ** places) / 10 ** places);
</script>

<section class="panel" style="left:24px;top:758px;width:1872px;height:244px" aria-labelledby="metrics-heading">
  <div class="ph"><h2 id="metrics-heading">Population summary · generation {m.generation}</h2><span class="r">fitness plots follow</span></div>
  <div class="statrow">
    <div class="stat"><b>{m.best}</b><span>best now</span></div>
    <div class="stat"><b>{m.bestSoFar}</b><span>best so far</span></div>
    <div class="stat"><b>{round(m.average, 1)}</b><span>average</span></div>
    <div class="stat"><b>{m.worst}</b><span>worst</span></div>
    <div class="stat"><b>{round(m.diversity)}</b><span>diversity (0–1)</span></div>
    <div class="stat"><b>{m.distinct} of {size}</b><span>distinct chromosomes</span></div>
    <div class="stat"><b>{m.evaluations}</b><span>evaluations</span></div>
  </div>
  <p class="note" style="padding:14px 22px 0;margin:0">Share of 1s at each gene: {m.alleleFrequencies.map((f, k) => `gene ${k + 1} = ${round(f, 2)}`).join(' · ')}</p>
</section>
