import type {Stroke} from '@/types/sketch';

/** A change to the strokes on a board, to show and to save. */
export type SketchChange = {type: 'add'; stroke: Stroke} | {type: 'remove'; stroke: Stroke};

/** Something the user did in sketch mode; one eraser gesture can remove several strokes. */
export type SketchAction = {type: 'draw'; stroke: Stroke} | {type: 'erase'; strokes: Stroke[]};

function changesFor(action: SketchAction): SketchChange[] {
  return action.type === 'draw'
    ? [{type: 'add', stroke: action.stroke}]
    : action.strokes.map((stroke) => ({type: 'remove', stroke}));
}

function inverse(change: SketchChange): SketchChange {
  return {type: change.type === 'add' ? 'remove' : 'add', stroke: change.stroke};
}

/**
 * Undo and redo for sketching, separate from the text editor's own history. It covers the current visit
 * to a board only. Each method returns the changes to apply, rather than holding the strokes itself.
 */
export class SketchHistory {
  private past: SketchAction[] = [];
  private future: SketchAction[] = [];

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Records a new action and returns its changes. A new action makes anything undone unrecoverable, as usual. */
  record(action: SketchAction): SketchChange[] {
    this.past.push(action);
    this.future = [];

    return changesFor(action);
  }

  undo(): SketchChange[] {
    const action = this.past.pop();

    if (!action) {
      return [];
    }

    this.future.push(action);

    // Reversed, so strokes come back in the order they left.
    return changesFor(action).map(inverse).reverse();
  }

  redo(): SketchChange[] {
    const action = this.future.pop();

    if (!action) {
      return [];
    }

    this.past.push(action);

    return changesFor(action);
  }
}
