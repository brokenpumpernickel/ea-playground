<script lang="ts">
  import { describeEvent, stageTitle } from './describe';
  import CrossoverView from './CrossoverView.svelte';
  import EvaluationView from './EvaluationView.svelte';
  import MutationView from './MutationView.svelte';
  import { evaluationModel, replacementModel } from './outcome-models';
  import PairingView from './PairingView.svelte';
  import ReplacementView from './ReplacementView.svelte';
  import RouletteView from './RouletteView.svelte';
  import { pairingModel, selectionModel, tournamentModel } from './selection-models';
  import type { Session } from './session.svelte';
  import TournamentView from './TournamentView.svelte';
  import { crossoverModel, mutationModel } from './variation-models';

  let { session }: { session: Session } = $props();

  const order = ['selection', 'pairing', 'crossover', 'mutation', 'evaluation', 'replacement'];

  const view = $derived(session.view);
  const stage = $derived(view.stage);
  const events = $derived(view.events.filter((e) => e.stage === stage));
  const lines = $derived(events.map(describeEvent));
  const position = $derived(order.indexOf(stage));
  const heading = $derived(position < 0 ? stageTitle(stage) : `Stage ${position + 1} · ${stageTitle(stage)}`);

  // the parameters this generation was made with, so the views can explain pc, pm, the operator and the mode
  const params = $derived(session.run.snapshot(view.position.cycle).params);
  const tournament = $derived(view.events.some((e) => e.stage === 'selection' && e.kind === 'tournament-setup'));
  const explanation = $derived(
    stage === 'selection' && !tournament
      ? 'Each spin draws r in [0, 1) and picks the individual whose interval contains r, with replacement.'
      : stage === 'pairing'
        ? 'Neighbours in the mating pool become pairs. The pool is already random, so pairing needs no draws.'
        : '',
  );

  const narration = $derived.by(() => {
    const { micro } = view.position;
    if (view.micros === 0) return { label: 'No micro-steps', text: 'This stage has nothing to step through; its result is above.' };
    if (micro === 0) return { label: `${view.micros} micro-step${view.micros === 1 ? '' : 's'}`, text: 'Stage entered. Step to see the first result.' };
    return { label: `Micro-step ${micro} of ${view.micros}`, text: lines[lines.length - 1] ?? '' };
  });
</script>

<section class="panel" style="left:24px;top:172px;width:1096px;height:574px" aria-labelledby="stage-heading">
  <div class="ph"><h2 id="stage-heading">{heading}</h2></div>
  <div id="stagebody" style="top:56px">
    {#if stage === 'selection' && tournament}
      <TournamentView model={tournamentModel(view)} />
    {:else if stage === 'selection'}
      <p class="expl">{explanation}</p>
      <RouletteView model={selectionModel(view)} animate={session.animate.micro} />
    {:else if stage === 'pairing'}
      <p class="expl">{explanation}</p>
      <PairingView model={pairingModel(view)} />
    {:else if stage === 'crossover'}
      <CrossoverView model={crossoverModel(view, params.crossover)} />
    {:else if stage === 'mutation'}
      <MutationView model={mutationModel(view, params.mutation)} />
    {:else if stage === 'evaluation'}
      <EvaluationView model={evaluationModel(view)} />
    {:else if stage === 'replacement'}
      <ReplacementView model={replacementModel(view, params)} />
    {:else if lines.length === 0}
      <p class="empty">Nothing has happened in this stage yet.</p>
    {:else}
      <ol class="events" data-testid="stage-events">
        {#each lines as line, k (k)}
          <li class:latest={k === lines.length - 1} class:older={k !== lines.length - 1}>{line}</li>
        {/each}
      </ol>
    {/if}
  </div>
  <div id="narr" data-testid="narration" aria-live="polite"><span class="m">{narration.label}</span><span>{narration.text}</span></div>
</section>
