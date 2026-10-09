<script lang="ts">
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  const stages = [
    ['selection', 'Selection'],
    ['pairing', 'Pairing'],
    ['crossover', 'Crossover'],
    ['mutation', 'Mutation'],
    ['evaluation', 'Evaluation'],
    ['replacement', 'Replacement'],
  ] as const;

  const view = $derived(session.view);
  const cycle = $derived(view.position.cycle);
  const complete = $derived(session.atCycleEnd);
  const current = $derived(stages.findIndex(([name]) => name === view.stage));
  const limit = $derived(session.run.parameters.stop.generationLimit);

  const stateOf = (k: number): 'done' | 'cur' | 'future' => {
    if (cycle === 0) return 'future';
    if (complete || k < current) return 'done';
    return k === current ? 'cur' : 'future';
  };

  const progress = $derived(
    cycle === 0
      ? 'initial population'
      : complete
        ? `complete · limit ${limit}`
        : view.position.micro === 0
          ? 'being made · stage entered'
          : `being made · micro-step ${view.position.micro} of ${view.micros}`,
  );
</script>

<div id="top">
  <div id="brand">
    <span class="logo" aria-hidden="true">x²</span>
    <div>
      <h1 class="t" style="margin:0">Goldberg x²</h1>
      <div class="s">Maximise x² on 0…31</div>
    </div>
  </div>

  <ol id="ribbon" data-testid="ribbon" aria-label="Stages of a generation" style="list-style:none;margin:0">
    {#each stages as [, label], k (label)}
      {@const state = stateOf(k)}
      <li class="stage" class:done={state === 'done'} class:cur={state === 'cur'} aria-current={state === 'cur' ? 'step' : undefined}>
        <span class="n" aria-hidden="true">{state === 'done' ? '✓' : k + 1}</span><span>{label}</span>
      </li>
    {/each}
  </ol>

  <div id="gen">
    <div class="g">Generation {cycle}</div>
    <div class="l">{progress}</div>
  </div>
</div>
