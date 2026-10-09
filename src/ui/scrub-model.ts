import type { GaEvent, GaParams, GaSetup, RunState } from '../engine';
import type { Position, Run, StageLayout } from '../run';
import { stageTitle } from './describe';

/**
 * The run history as a bar: each recorded generation gets an equal cell, each cell is split equally into its stages,
 * and a stage's micro-steps are spread across its share (0 = stage entered, the last = stage finished).
 */
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
type Layouts = readonly (readonly StageLayout[])[];

export const layoutsOf = (run: GaRun): StageLayout[][] => Array.from({ length: run.lastCycle + 1 }, (_, c) => [...run.layout(c)]);

export function xOfPosition(layouts: Layouts, width: number, position: Position): number {
  const cell = width / layouts.length;
  const stages = layouts[position.cycle]!;
  const micros = stages[position.stage]!.micros;
  return position.cycle * cell + ((position.stage + position.micro / (micros + 1)) * cell) / stages.length;
}

/** The recorded position nearest a point on the bar (rounding down inside a stage); points off either end snap to it. */
export function positionAtX(layouts: Layouts, width: number, x: number): Position {
  const cell = width / layouts.length;
  const cycle = Math.min(layouts.length - 1, Math.max(0, Math.floor(x / cell)));
  const stages = layouts[cycle]!;
  const along = Math.min(stages.length - 1e-9, Math.max(0, ((x - cycle * cell) / cell) * stages.length));
  const stage = Math.min(stages.length - 1, Math.floor(along));
  const micros = stages[stage]!.micros;
  const micro = Math.min(micros, Math.floor((along - stage) * (micros + 1) + 1e-9));
  return { cycle, stage, micro };
}

export interface ScrubModel {
  readonly cells: number;
  readonly cellWidth: number;
  /** Where the cursor is, in pixels from the left of the bar. */
  readonly thumbX: number;
  /** The generation the cursor is in. */
  readonly current: number;
  readonly lastCycle: number;
  /** How the position reads aloud. */
  readonly valueText: string;
  readonly labels: readonly { readonly generation: number; readonly x: number; readonly current: boolean }[];
  /** Every `labelStep`-th generation is named. */
  readonly labelStep: number;
  /** x of the boundaries between stages inside each cell, and between cells. */
  readonly stageTicks: readonly number[];
  readonly cellTicks: readonly number[];
}

const MIN_LABEL_SPACING = 78;

export function scrubModel(run: GaRun, width: number): ScrubModel {
  const layouts = layoutsOf(run);
  const cells = layouts.length;
  const cellWidth = width / cells;
  const cursor = run.cursor;
  const labelStep = Math.max(1, Math.ceil(MIN_LABEL_SPACING / cellWidth));

  const stage = layouts[cursor.cycle]![cursor.stage]!;
  const where =
    cursor.cycle === 0
      ? 'initial population'
      : cursor.micro === 0
        ? `stage ${cursor.stage + 1} ${stageTitle(stage.stage)} entered`
        : `stage ${cursor.stage + 1} ${stageTitle(stage.stage)}, micro-step ${cursor.micro} of ${stage.micros}`;

  return {
    cells,
    cellWidth,
    thumbX: xOfPosition(layouts, width, cursor),
    current: cursor.cycle,
    lastCycle: run.lastCycle,
    valueText: `Generation ${cursor.cycle}, ${where}`,
    labelStep,
    labels: Array.from({ length: cells }, (_, g) => g)
      .filter((g) => g % labelStep === 0)
      .map((g) => ({ generation: g, x: (g + 0.5) * cellWidth, current: g === cursor.cycle })),
    stageTicks: layouts.flatMap((stages, c) => Array.from({ length: stages.length - 1 }, (_, k) => c * cellWidth + ((k + 1) * cellWidth) / stages.length)),
    cellTicks: Array.from({ length: cells + 1 }, (_, c) => c * cellWidth),
  };
}
