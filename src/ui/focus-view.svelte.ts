/**
 * The focus view: a figure (the route map, the landscape) given the whole centre of the screen, in place of the stage panel,
 * the population table, the legend line and the plots. It is a view setting like the others: kept across steps and restarts,
 * started over by another problem, not part of a link or a preset. `available` says a figure is on show to expand.
 */
export const focusArea = { left: 24, top: 172, width: 1872, height: 830 } as const;

export class FocusView {
  /** The class asked for the focus view (a button, E). */
  wanted = $state(false);
  /** A figure that can be expanded is on show (the stage panel says so). */
  available = $state(false);

  get active(): boolean {
    return this.wanted && this.available;
  }
  enter(): void {
    if (this.available) this.wanted = true;
  }
  leave(): void {
    this.wanted = false;
  }
  toggle(): void {
    if (this.active) this.leave();
    else this.enter();
  }
  reset(): void {
    this.wanted = false;
  }
}

export const focusContextKey = Symbol('focus-view');
