/**
 * Keyboard control for stepping and playback. Chosen so one hand can drive a demonstration while talking:
 *
 *   →          next micro-step         ←          back one micro-step
 *   Shift →    to the end of the stage Shift ←    to the end of the previous stage
 *   G          next generation         Space      run / pause
 *   F          show the function plot instead of diversity and gene shares (and back)
 *   E          give the route map or the landscape the whole centre of the screen (and back)
 *
 * The keys are labelled on the buttons. They are ignored while typing, while a control that uses the same key has
 * the focus (a slider uses the arrows, a button uses Space), and while a dialog is open.
 */
export type Shortcut = 'microForward' | 'microBack' | 'stageForward' | 'stageBack' | 'generation' | 'toggle' | 'function' | 'focus';

/** How each key is written on screen. */
export const shortcutLabels: Record<Shortcut, string> = {
  microForward: '→',
  microBack: '←',
  stageForward: '⇧→',
  stageBack: '⇧←',
  generation: 'G',
  toggle: 'Space',
  function: 'F',
  focus: 'E',
};

export interface KeyInfo {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

/** Where the key was pressed, reduced to what decides whether a shortcut applies. */
export interface KeyTarget {
  readonly tag: string;
  readonly role: string | null;
  readonly editable: boolean;
  readonly inDialog: boolean;
}

const usesArrows = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const usesSpace = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY']);

export function shortcutFor(event: KeyInfo, target: KeyTarget): Shortcut | undefined {
  if (event.ctrlKey || event.altKey || event.metaKey) return undefined;
  if (target.inDialog || target.editable) return undefined;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    if (usesArrows.has(target.tag) || target.role === 'slider' || target.role?.startsWith('menu')) return undefined;
    if (key === 'ArrowRight') return event.shiftKey ? 'stageForward' : 'microForward';
    return event.shiftKey ? 'stageBack' : 'microBack';
  }
  if (event.shiftKey) return undefined;
  if (key === 'g') return usesArrows.has(target.tag) ? undefined : 'generation';
  if (key === 'f') return usesArrows.has(target.tag) ? undefined : 'function';
  if (key === 'e') return usesArrows.has(target.tag) ? undefined : 'focus';
  if (key === ' ') return usesSpace.has(target.tag) || target.role === 'slider' || target.role === 'switch' ? undefined : 'toggle';
  return undefined;
}
