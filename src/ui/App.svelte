<script lang="ts">
  import { onMount } from 'svelte';
  import DiscardNotice from './DiscardNotice.svelte';
  import HistoryStrip from './HistoryStrip.svelte';
  import MetricsPanel from './MetricsPanel.svelte';
  import PopulationPanel from './PopulationPanel.svelte';
  import { createSession } from './session.svelte';
  import StagePanel from './StagePanel.svelte';
  import TopBar from './TopBar.svelte';
  import Transport from './Transport.svelte';

  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const session = createSession({
    scheduler: { setTimeout: (callback, ms) => window.setTimeout(callback, ms), clearTimeout: (handle) => window.clearTimeout(handle as number) },
    reducedMotion,
  });

  // The screen is designed once, at 1920×1080, and scaled to fit the window.
  let scale = $state(1);
  const fit = () => (scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080));

  let theme = $state<'light' | 'dark'>('light');
  const applyTheme = (next: 'light' | 'dark') => {
    theme = next;
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('ea-theme', next);
    } catch {
      /* storage can be unavailable (private windows, blocked site data); the choice just will not be remembered */
    }
  };

  onMount(() => {
    fit();
    window.addEventListener('resize', fit);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('ea-theme');
    } catch {
      /* see above */
    }
    applyTheme(stored === 'dark' ? 'dark' : 'light');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => session.setReducedMotion(motion.matches);
    motion.addEventListener('change', onMotion);
    return () => {
      window.removeEventListener('resize', fit);
      motion.removeEventListener('change', onMotion);
      session.pause();
    };
  });
</script>

<div class="viewport">
  <main class="canvas" style="transform: translate(-50%, -50%) scale({scale}); transform-origin: center">
    <TopBar {session} />
    <Transport {session} {theme} toggleTheme={() => applyTheme(theme === 'light' ? 'dark' : 'light')} />
    <StagePanel {session} />
    <PopulationPanel {session} />
    <MetricsPanel {session} />
    <HistoryStrip {session} />
    {#if session.pendingChange}<DiscardNotice {session} />{/if}
  </main>
</div>
