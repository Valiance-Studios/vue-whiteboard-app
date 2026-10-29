import type {Stroke} from '@/types/sketch';

import {describe, expect, it} from 'vitest';
import {SketchHistory} from '@/sketch/SketchHistory';

function stroke(id: string): Stroke {
  return {id, ink: 'blue', pen: false, points: [[0, 0, 0.5]], drawnAt: 0};
}

describe('SketchHistory', () => {
  it('has nothing to undo or redo at first', () => {
    const history = new SketchHistory();

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toEqual([]);
    expect(history.redo()).toEqual([]);
  });

  it('undoes and redoes a stroke', () => {
    const history = new SketchHistory();
    const a = stroke('a');

    expect(history.record({type: 'draw', stroke: a})).toEqual([{type: 'add', stroke: a}]);
    expect(history.undo()).toEqual([{type: 'remove', stroke: a}]);
    expect(history.canRedo).toBe(true);
    expect(history.redo()).toEqual([{type: 'add', stroke: a}]);
  });

  it('undoes an erase by restoring every stroke it removed', () => {
    const history = new SketchHistory();
    const [a, b] = [stroke('a'), stroke('b')];

    expect(history.record({type: 'erase', strokes: [a, b]})).toEqual([{type: 'remove', stroke: a}, {type: 'remove', stroke: b}]);
    expect(history.undo()).toEqual([{type: 'add', stroke: b}, {type: 'add', stroke: a}]);
  });

  it('undoes in reverse order, and forgets what was undone once something new is drawn', () => {
    const history = new SketchHistory();
    const [a, b, c] = [stroke('a'), stroke('b'), stroke('c')];
    history.record({type: 'draw', stroke: a});
    history.record({type: 'draw', stroke: b});

    expect(history.undo()).toEqual([{type: 'remove', stroke: b}]);

    history.record({type: 'draw', stroke: c});

    expect(history.canRedo).toBe(false);
    expect(history.undo()).toEqual([{type: 'remove', stroke: c}]);
    expect(history.undo()).toEqual([{type: 'remove', stroke: a}]);
    expect(history.canUndo).toBe(false);
  });
});
