<script lang="ts">
  import { describeEvent, stageTitle } from './describe';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  const order = ['selection', 'pairing', 'crossover', 'mutation', 'evaluation', 'replacement'];

  const view = $derived(session.view);
  const stage = $derived(view.stage);
  const events = $derived(view.events.filter((e) => e.stage === stage));
  const lines = $derived(events.map(describeEvent));
  const position = $derived(order.indexOf(stage));
  const heading = $derived(position < 0 ? stageTitle(stage) : `Stage ${position + 1} · ${stageTitle(stage)}`);

  const narration = $derived.by(() => {
    const { micro } = view.position;
    if (view.micros === 0) return { label: 'No micro-steps', text: 'This stage has nothing to step through; its result is above.' };
    if (micro === 0) return { label: `${view.micros} micro-steps`, text: 'Stage entered. Step to see the first result.' };
    return { label: `Micro-step ${micro} of ${view.micros}`, text: lines[lines.length - 1] ?? '' };
  });
</script>

<section class="panel" style="left:24px;top:172px;width:1096px;height:574px" aria-labelledby="stage-heading">
  <div class="ph"><h2 id="stage-heading">{heading}</h2></div>
  <div id="stagebody" style="top:56px">
    {#if lines.length === 0}
      <p class="empty">Nothing has happened in this stage yet.</p>
    {:else}
      <ol data-testid="stage-events">
        {#each lines as line, k (k)}
          <li class:latest={k === lines.length - 1} class:older={k !== lines.length - 1}>{line}</li>
        {/each}
      </ol>
    {/if}
  </div>
  <div id="narr" data-testid="narration" aria-live="polite"><span class="m">{narration.label}</span><span>{narration.text}</span></div>
</section>
