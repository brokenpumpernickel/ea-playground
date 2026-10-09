<script lang="ts">
  import type { Session } from './session.svelte';

  let { session, theme, toggleTheme }: { session: Session; theme: 'light' | 'dark'; toggleTheme: () => void } = $props();

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
  <button class="btn quiet" onclick={() => session.reset()}><span aria-hidden="true">↺</span> Reset</button>
  <button class="btn quiet" onclick={() => session.backMicro()}><span aria-hidden="true">◂</span> Back</button>
  <button class="btn primary" onclick={() => session.stepMicro()}>Micro-step <span aria-hidden="true">▸</span></button>
  <button class="btn" onclick={() => session.stepStage()}>Stage <span aria-hidden="true">▸▸</span></button>
  <button class="btn" onclick={() => session.stepGeneration()}>Generation <span aria-hidden="true">⏭</span></button>
  <span class="vsep"></span>
  <button class="btn" onclick={() => session.toggle()}>
    {#if status.playing}<span aria-hidden="true">⏸</span> Pause{:else}<span aria-hidden="true">▶</span> Run{/if}
  </button>
  <button class="btn quiet" onclick={() => session.runUntilStop()}>Run until stop</button>
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
      <div class="labels" style="width:260px;margin-left:0">
        {#each session.playback.tiers as tier (tier.name)}<span>{tier.label}</span>{/each}
      </div>
    </div>
  </div>
  <span class="vsep"></span>

  <div id="seedbox">Seed <b data-testid="seed">{session.seed}</b> <button class="btn quiet" style="height:40px;padding:0 10px" onclick={() => session.newSeed()}>New seed</button></div>
  <div id="statusline" role="status" class:err={status.pausedBecause === 'error'}>{message}</div>

  <span style="flex:1"></span>
  <button class="btn quiet" onclick={toggleTheme}><span aria-hidden="true">{theme === 'light' ? '◐' : '◑'}</span> {theme === 'light' ? 'Dark' : 'Light'}</button>
  <button class="btn quiet" disabled title="Parameters arrive with the parameter drawer"><span aria-hidden="true">⚙</span> Parameters</button>
  <button class="btn quiet" disabled title="Projector mode arrives later" aria-label="Projector mode"><span aria-hidden="true">A⁺</span></button>
</div>
