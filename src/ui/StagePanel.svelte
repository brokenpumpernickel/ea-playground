<script lang="ts">
  import { getContext } from 'svelte';
  import { describer, stageTitle } from './describe';
  import { focusArea, focusContextKey, type FocusView } from './focus-view.svelte';
  import { parseSchema, schemaOfBlock } from './schema-model';
  import SchemaTracker from './SchemaTracker.svelte';
  import { defaultView, type SurfaceView } from './surface-projection';
  import CrossoverView from './CrossoverView.svelte';
  import CrowdingSelectionView from './CrowdingSelectionView.svelte';
  import EvaluationView from './EvaluationView.svelte';
  import LandscapeView from './LandscapeView.svelte';
  import MutationView from './MutationView.svelte';
  import { evaluationModel, replacementModel } from './outcome-models';
  import PairingView from './PairingView.svelte';
  import RouteMapView from './RouteMapView.svelte';
  import type { MapView } from './map-zoom';
  import type { Offset } from './overlay-drag';
  import ReplacementView from './ReplacementView.svelte';
  import RouletteView from './RouletteView.svelte';
  import { crowdingSelectionModel, pairingModel, selectionModel, tournamentModel } from './selection-models';
  import type { Session } from './session.svelte';
  import TournamentView from './TournamentView.svelte';
  import { crossoverModel, mutationModel } from './variation-models';

  let { session }: { session: Session } = $props();

  const focus = getContext<FocusView | undefined>(focusContextKey);
  const focused = $derived(focus?.active === true);

  const order = ['selection', 'pairing', 'crossover', 'mutation', 'evaluation', 'replacement'];

  const view = $derived(session.view);
  const stage = $derived(view.stage);
  const events = $derived(view.events.filter((e) => e.stage === stage));
  const display = $derived(session.display);
  const lines = $derived(events.map(describer(display)));
  const position = $derived(order.indexOf(stage));
  const heading = $derived(position < 0 ? stageTitle(stage) : `Stage ${position + 1} · ${stageTitle(stage)}`);

  // the trap's schema tracker is a second view of the stage panel: a view setting, so it is not part of the run or of a link and starts over with the run
  const blocks = $derived(session.blocks);
  let showSchema = $state(false);
  let typedSchema = $state<string | undefined>(undefined);
  let seenEpoch: number | undefined;
  $effect(() => {
    if (seenEpoch === undefined) seenEpoch = session.epoch;
    else if (session.epoch !== seenEpoch) {
      seenEpoch = session.epoch;
      typedSchema = undefined;
      showSchema = false;
    }
  });
  // the landscape's heatmap is the panel's second view for a landscape; the narration stays visible below it
  const land = $derived(session.landscape);
  let showLandscape = $state(false);
  let zoomToPopulation = $state(false);
  let surfaceView = $state<SurfaceView>({ ...defaultView });
  let trail = $state<0 | 1 | 3 | 5>(0);
  let heatView = $state<MapView | undefined>(undefined);
  let seenLandscapeEpoch: number | undefined;
  $effect(() => {
    if (seenLandscapeEpoch === undefined) seenLandscapeEpoch = session.epoch;
    else if (session.epoch !== seenLandscapeEpoch) {
      seenLandscapeEpoch = session.epoch;
      // a restart of a landscape run keeps the view the class was looking at; the views start over only when the problem has no landscape
      if (land === undefined) {
        showLandscape = false;
        zoomToPopulation = false;
        surfaceView = { ...defaultView };
        trail = 0;
        heatView = undefined;
        landGraphPos = { x: 0, y: 0 };
        landCardPos = { x: 0, y: 0 };
      }
    }
  });
  // the TSP's route map is the panel's second view for a tour; like the landscape's, it is a view setting that a restart keeps
  const tour = $derived(session.tour);
  let showMap = $state(false);
  let showPopulationEdges = $state(true);
  let showOptimalTour = $state(false);
  let showCityNumbers = $state(true);
  let showFocusGraph = $state(true);
  let showFocusCard = $state(true);
  // where the class moved the overlays of the focus view to, kept like the other view settings
  let mapGraphPos = $state<Offset>({ x: 0, y: 0 });
  let mapCardPos = $state<Offset>({ x: 0, y: 0 });
  let landGraphPos = $state<Offset>({ x: 0, y: 0 });
  let landCardPos = $state<Offset>({ x: 0, y: 0 });
  /** The map's zoom and pan: kept across steps, tabs and restarts of the same instance, started over by another one. */
  let mapZoom = $state<MapView | undefined>(undefined);
  const instanceKey = $derived(tour ? `${tour.instance.name}|${tour.cities}|${tour.places.map((p) => p.join(',')).join(';')}` : '');
  let seenInstance = '';
  $effect(() => {
    if (instanceKey !== seenInstance) {
      seenInstance = instanceKey;
      mapZoom = undefined;
    }
  });
  let seenTourEpoch: number | undefined;
  $effect(() => {
    if (seenTourEpoch === undefined) seenTourEpoch = session.epoch;
    else if (session.epoch !== seenTourEpoch) {
      seenTourEpoch = session.epoch;
      if (tour === undefined) {
        showMap = false;
        showPopulationEdges = true;
        showOptimalTour = false;
        showCityNumbers = true;
        showFocusGraph = true;
        mapGraphPos = { x: 0, y: 0 };
        mapCardPos = { x: 0, y: 0 };
      }
    }
  });
  const mapOpen = $derived(tour !== undefined && showMap);
  const landscapeOpen = $derived(land !== undefined && showLandscape);
  // a figure is on show, so the focus view can expand it; another problem (one without a figure of its own) starts the focus view over
  $effect(() => {
    if (focus) focus.available = mapOpen || landscapeOpen;
  });
  let seenProblem: string | undefined;
  $effect(() => {
    const id = session.problemEntry.id;
    if (seenProblem !== undefined && id !== seenProblem) focus?.reset();
    seenProblem = id;
  });
  const schemaOpen = $derived(blocks !== undefined && showSchema);
  const schemaText = $derived(typedSchema ?? (blocks ? schemaOfBlock(blocks, 1) : ''));
  const schemaParsed = $derived(blocks ? parseSchema(schemaText, blocks.blockSize * blocks.blocks) : undefined);
  const schemaPoints = $derived(schemaOpen && schemaParsed?.ok ? session.schemaHistory(schemaParsed.symbols) : undefined);

  // the parameters this generation was made with, so the views can explain pc, pm, the operator and the mode
  const params = $derived(session.run.snapshot(view.position.cycle).params);
  const tournament = $derived(view.events.some((e) => e.stage === 'selection' && e.kind === 'tournament-setup'));
  const crowdingSelection = $derived(view.events.some((e) => e.stage === 'selection' && e.kind === 'crowding-setup'));
  const explanation = $derived(
    stage === 'selection' && !tournament && !crowdingSelection
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

<section class="panel" data-testid="stage-panel" data-focus={focused ? 'true' : undefined} style={focused ? `left:${focusArea.left}px;top:${focusArea.top}px;width:${focusArea.width}px;height:${focusArea.height}px` : 'left:24px;top:172px;width:1096px;height:574px'} aria-labelledby="stage-heading">
  <div class="ph" class:sr-only={focused}>
    <h2 id="stage-heading">{schemaOpen ? 'Schema tracker' : landscapeOpen ? 'Landscape' : mapOpen ? (stage === 'crossover' || stage === 'mutation' ? `Route map · ${stage}` : 'Route map') : heading}</h2>
    {#if session.pending.length > 0}<span class="pendingchip" data-testid="pending-chip" title="Changed settings apply when the next generation starts">● pending: {session.pending.join(', ')}</span>{/if}
  </div>
  {#if land && !focused}
    <div class="tabs" role="group" aria-label="View of this panel">
      <button class="tab" class:on={!showLandscape} type="button" aria-pressed={!showLandscape} data-testid="show-stage" onclick={() => (showLandscape = false)}>Stage view</button>
      <button class="tab" class:on={showLandscape} type="button" aria-pressed={showLandscape} data-testid="show-landscape" onclick={() => (showLandscape = true)}>Landscape</button>
    </div>
  {/if}
  {#if tour && !focused}
    <div class="tabs" role="group" aria-label="View of this panel">
      <button class="tab" class:on={!showMap} type="button" aria-pressed={!showMap} data-testid="show-stage" onclick={() => (showMap = false)}>Stage view</button>
      <button class="tab" class:on={showMap} type="button" aria-pressed={showMap} data-testid="show-map" onclick={() => (showMap = true)}>Route map</button>
    </div>
  {/if}
  {#if blocks && !focused}
    <div class="tabs" role="group" aria-label="View of this panel">
      <button class="tab" class:on={!showSchema} type="button" aria-pressed={!showSchema} data-testid="show-stage" onclick={() => (showSchema = false)}>Stage view</button>
      <button class="tab" class:on={showSchema} type="button" aria-pressed={showSchema} data-testid="show-schema" onclick={() => (showSchema = true)}>Schema tracker</button>
    </div>
  {/if}
  <div id="stagebody" style={focused ? 'top:12px;bottom:84px' : blocks || land || tour ? `top:90px${schemaOpen ? ';bottom:16px' : ''}` : 'top:56px'}>
    {#if mapOpen}
      <RouteMapView {session} bind:showPopulation={showPopulationEdges} bind:showOptimal={showOptimalTour} bind:showNumbers={showCityNumbers} bind:showGraph={showFocusGraph} bind:zoom={mapZoom} bind:graphPos={mapGraphPos} bind:cardPos={mapCardPos} />
    {:else if landscapeOpen}
      <LandscapeView {session} bind:zoom={zoomToPopulation} bind:surface={surfaceView} bind:trail bind:heatView bind:showGraph={showFocusGraph} bind:showCard={showFocusCard} bind:graphPos={landGraphPos} bind:cardPos={landCardPos} />
    {:else if schemaOpen && blocks}
      <SchemaTracker info={blocks} text={schemaText} oninput={(t) => (typedSchema = t)} history={schemaPoints} now={view.position.cycle} />
    {:else if stage === 'selection' && crowdingSelection}
      <CrowdingSelectionView model={crowdingSelectionModel(view, display)} />
    {:else if stage === 'selection' && tournament}
      <TournamentView model={tournamentModel(view, display)} />
    {:else if stage === 'selection'}
      <p class="expl">{explanation}</p>
      <RouletteView model={selectionModel(view)} animate={session.animate.micro} />
    {:else if stage === 'pairing'}
      <p class="expl">{explanation}</p>
      <PairingView model={pairingModel(view, display)} />
    {:else if stage === 'crossover'}
      <CrossoverView model={crossoverModel(view, params.crossover, display)} />
    {:else if stage === 'mutation'}
      <MutationView model={mutationModel(view, params.mutation, display)} />
    {:else if stage === 'evaluation'}
      <EvaluationView model={evaluationModel(view, display)} />
    {:else if stage === 'replacement'}
      <ReplacementView model={replacementModel(view, params, display)} />
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
 {#if !schemaOpen}<div id="narr" data-testid="narration" data-long={narration.text.length > 150 ? 2 : narration.text.length > 100 ? 1 : undefined} aria-live="polite"><span class="m">{narration.label}</span><span>{narration.text}</span></div>{/if}
</section>
