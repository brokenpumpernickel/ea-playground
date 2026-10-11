<script lang="ts">
  import { onMount } from 'svelte';
  import DiscardNotice from './DiscardNotice.svelte';
  import Drawer from './Drawer.svelte';
  import HistoryStrip from './HistoryStrip.svelte';
  import LinkNotice from './LinkNotice.svelte';
  import MetricsPanel from './MetricsPanel.svelte';
  import PopulationPanel from './PopulationPanel.svelte';
  import ResetNotice from './ResetNotice.svelte';
  import { setupOf } from './run-config';
  import { createSession } from './session.svelte';
  import { startupOf } from './share-link';
  import { shortcutFor } from './shortcuts';
  import StagePanel from './StagePanel.svelte';
  import TopBar from './TopBar.svelte';
  import Transport from './Transport.svelte';

  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // a share link in the address asks for its configuration; a damaged one is reported and the defaults open instead
  const startup = startupOf(location.hash);
  const startConfig = startup.kind === 'config' ? startup.config : undefined;
  let linkProblems = $state<readonly string[] | undefined>(startup.kind === 'invalid' ? startup.problems : undefined);
  if (startup.kind !== 'none') {
    try {
      // the address would otherwise say a state the screen no longer shows after the first change
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      /* some contexts refuse to rewrite the address; the link is then simply still there */
    }
  }
  const session = createSession({
    config: startConfig && { setup: setupOf(startConfig), params: startConfig.params, seed: startConfig.seed },
    scheduler: { setTimeout: (callback, ms) => window.setTimeout(callback, ms), clearTimeout: (handle) => window.clearTimeout(handle as number) },
    reducedMotion,
  });

  // The screen is designed once, at 1920×1080, and scaled to fit the window.
  let scale = $state(1);
  const fit = () => (scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080));

  let drawerOpen = $state(false);
  const closeDrawer = () => {
    drawerOpen = false;
    document.getElementById('open-params')?.focus();
  };

  let showFunction = $state(false);
  let projector = $state(false);
  const setProjector = (on: boolean) => {
    projector = on;
    try {
      localStorage.setItem('ea-projector', on ? 'on' : 'off');
    } catch {
      /* storage can be unavailable; the choice just will not be remembered */
    }
  };

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

  const onKey = (event: KeyboardEvent) => {
    if (session.pendingChange || session.pendingReset || event.defaultPrevented) return;
    if (event.key === 'Escape' && drawerOpen) {
      event.preventDefault();
      closeDrawer();
      return;
    }
    const el = event.target instanceof HTMLElement ? event.target : document.body;
    const action = shortcutFor(event, {
      tag: el.tagName,
      role: el.getAttribute('role'),
      editable: el.isContentEditable,
      inDialog: el.closest('[role="alertdialog"], [role="dialog"]') !== null,
    });
    if (!action) return;
    event.preventDefault();
    if (action === 'microForward') session.stepMicro();
    else if (action === 'microBack') session.backMicro();
    else if (action === 'stageForward') session.stepStage();
    else if (action === 'stageBack') session.backStage();
    else if (action === 'generation') session.stepGeneration();
    else if (action === 'function') showFunction = !showFunction;
    else session.toggle();
  };

  onMount(() => {
    window.addEventListener('keydown', onKey);
    fit();
    window.addEventListener('resize', fit);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('ea-theme');
    } catch {
      /* see above */
    }
    applyTheme(stored === 'dark' ? 'dark' : 'light');
    try {
      projector = localStorage.getItem('ea-projector') === 'on';
    } catch {
      /* see above */
    }
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => session.setReducedMotion(motion.matches);
    motion.addEventListener('change', onMotion);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('keydown', onKey);
      motion.removeEventListener('change', onMotion);
      session.pause();
    };
  });
</script>

<div class="viewport">
  <main class="canvas" class:projector style="transform: translate(-50%, -50%) scale({scale}); transform-origin: center">
    <TopBar {session} />
    <Transport {session} {theme} toggleTheme={() => applyTheme(theme === 'light' ? 'dark' : 'light')} {drawerOpen} toggleDrawer={() => (drawerOpen ? closeDrawer() : (drawerOpen = true))} {projector} toggleProjector={() => setProjector(!projector)} />
    <StagePanel {session} />
    <PopulationPanel {session} />
    <MetricsPanel {session} {showFunction} toggleFunction={() => (showFunction = !showFunction)} />
    <HistoryStrip {session} />
    {#if linkProblems}<LinkNotice problems={linkProblems} ondismiss={() => (linkProblems = undefined)} />{/if}
    {#if drawerOpen}<Drawer {session} onclose={closeDrawer} />{/if}
    {#if session.pendingChange}<DiscardNotice {session} />{/if}
    {#if session.pendingReset}<ResetNotice {session} />{/if}
  </main>
</div>
