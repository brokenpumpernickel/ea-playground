<script lang="ts">
  import type { Session } from './session.svelte';
  import { shortcutLabels } from './shortcuts';

  let {
    session,
    theme,
    toggleTheme,
    drawerOpen,
    toggleDrawer,
    projector,
    toggleProjector,
  }: { session: Session; theme: 'light' | 'dark'; toggleTheme: () => void; drawerOpen: boolean; toggleDrawer: () => void; projector: boolean; toggleProjector: () => void } = $props();

  const stopNames: Record<string, string> = {
    'generation-limit': 'generation limit',
    'target-reached': 'target fitness reached',
    stagnation: 'no improvement for a while',
  };

  const status = $derived(session.status);
  const message = $derived.by(() => {
    if (status.playing) return `Playing · ${session.tier.label}`;
    if (status.pausedBecause === 'stop-criterion') return `Paused · stop criterion: ${(status.stops ?? []).map((s) => stopNames[s] ?? s).join(', ')}`;
    if (status.pausedBecause === 'error') return `Paused · ${status.error}`;
    return 'Paused';
  });
</script>

<div id="transport">
  <button class="btn quiet" onclick={() => session.reset()} aria-label="Reset" title="Reset: start again from generation 0 with the same seed"><span aria-hidden="true">↺</span></button>
  <button class="btn quiet" onclick={() => session.backMicro()} aria-keyshortcuts="ArrowLeft"><span aria-hidden="true">◂</span> Back <kbd aria-hidden="true">{shortcutLabels.microBack}</kbd></button>
  <button class="btn primary" onclick={() => session.stepMicro()} aria-keyshortcuts="ArrowRight">Micro-step <span aria-hidden="true">▸</span> <kbd aria-hidden="true">{shortcutLabels.microForward}</kbd></button>
  <button class="btn quiet" onclick={() => session.backStage()} aria-label="Previous stage" aria-keyshortcuts="Shift+ArrowLeft" title={`Back to the end of the previous stage (${shortcutLabels.stageBack})`}><span aria-hidden="true">◂◂</span></button>
  <button class="btn" onclick={() => session.stepStage()} aria-keyshortcuts="Shift+ArrowRight">Stage <span aria-hidden="true">▸▸</span> <kbd aria-hidden="true">{shortcutLabels.stageForward}</kbd></button>
  <button class="btn" onclick={() => session.stepGeneration()} aria-keyshortcuts="G">Generation <span aria-hidden="true">⏭</span> <kbd aria-hidden="true">{shortcutLabels.generation}</kbd></button>
  <span class="vsep"></span>
  <button class="btn" onclick={() => session.toggle()} aria-keyshortcuts="Space">
    {#if status.playing}<span aria-hidden="true">⏸</span> Pause{:else}<span aria-hidden="true">▶</span> Run{/if} <kbd aria-hidden="true">{shortcutLabels.toggle}</kbd>
  </button>
  <button class="btn quiet" onclick={() => session.runUntilStop()} aria-label="Run until stop" title="Run until a stop criterion is reached">Run to stop</button>
  <span class="vsep"></span>

  <div id="tier">
    <div>
      <input
        class="speed"
        type="range"
        min="0"
        max="3"
        step="1"
        aria-label="Playback speed"
        aria-valuetext={session.tier.label}
        value={session.slider}
        oninput={(e) => session.setSlider(Number(e.currentTarget.value))}
      />
      <div class="labels" style="width:200px;margin-left:0">
        {#each session.playback.tiers as tier (tier.name)}<span>{tier.label}</span>{/each}
      </div>
    </div>
  </div>
  <span class="vsep"></span>

  <div id="seedbox">Seed <b data-testid="seed">{session.seed}</b> <button class="btn quiet" style="height:40px;padding:0 10px" onclick={() => session.newSeed()} aria-label="New seed" title="Start again with a new random seed"><span aria-hidden="true">↻</span> New</button></div>
  <div id="statusline" role="status" title={message} class:err={status.pausedBecause === 'error'}>{message}</div>

  <span style="flex:1"></span>
  <button class="btn quiet" onclick={toggleTheme} aria-label={theme === 'light' ? 'Dark theme' : 'Light theme'} title={theme === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme'}><span aria-hidden="true">{theme === 'light' ? '◐' : '◑'}</span></button>
  <button id="open-params" class="btn quiet" aria-expanded={drawerOpen} aria-controls="drawer" onclick={toggleDrawer}><span aria-hidden="true">⚙</span> Parameters</button>
  <button class="btn quiet" aria-pressed={projector} aria-label="Projector mode" title="Projector mode: larger text and heavier lines" onclick={toggleProjector}><span aria-hidden="true">A⁺</span></button>
</div>
