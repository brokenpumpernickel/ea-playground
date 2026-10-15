import { describe, expect, it } from 'vitest';
import { FocusView } from './focus-view.svelte';

describe('the focus view setting', () => {
  it('starts closed, and cannot be entered while there is no figure to expand', () => {
    const focus = new FocusView();
    expect(focus.active).toBe(false);
    focus.enter();
    expect(focus.active).toBe(false);
    focus.toggle();
    expect(focus.active).toBe(false);
  });

  it('is entered, left and toggled once a figure is on show', () => {
    const focus = new FocusView();
    focus.available = true;
    focus.enter();
    expect(focus.active).toBe(true);
    focus.leave();
    expect(focus.active).toBe(false);
    focus.toggle();
    expect(focus.active).toBe(true);
    focus.toggle();
    expect(focus.active).toBe(false);
  });

  it('is not active when the figure goes away, and comes back with it unless it was left', () => {
    const focus = new FocusView();
    focus.available = true;
    focus.enter();
    focus.available = false;
    expect(focus.active).toBe(false);
    focus.available = true;
    expect(focus.active).toBe(true);
    focus.leave();
    focus.available = false;
    focus.available = true;
    expect(focus.active).toBe(false);
  });

  it('starts over (closed) when asked to, as another problem does', () => {
    const focus = new FocusView();
    focus.available = true;
    focus.enter();
    focus.reset();
    expect(focus.active).toBe(false);
    focus.available = false;
    focus.available = true;
    expect(focus.active).toBe(false);
  });
});

describe('the area the figure is given', () => {
  it('is the whole area of the stage panel, the population table, the legend line and the plots', async () => {
    const { focusArea } = await import('./focus-view.svelte');
    expect(focusArea).toEqual({ left: 24, top: 172, width: 1872, height: 830 });
  });
});
