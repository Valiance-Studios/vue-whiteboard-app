import type {MarkerInk} from '@/constants/markers';

import {combineTransactionSteps, getChangedRanges, Mark} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {DEFAULT_INK, isMarkerInk, markerColor} from '@/constants/markers';

export interface InkStorage {
  /** The marker in hand: everything written from now on is in this ink. */
  current: MarkerInk;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ink: {
      /** Picks up a marker: recolors the selected text, if any, and colors whatever is written next. */
      setInk: (ink: MarkerInk) => ReturnType;
    };
  }

  interface Storage {
    ink: InkStorage;
  }
}

/** UI events whose inserted text did not come from typing, so it carries no stored marks. */
const INSERTING_UI_EVENTS = new Set(['paste', 'drop']);

/** The marker color of a stretch of text. Every piece of text on a board carries one. */
export const Ink = Mark.create<Record<string, never>, InkStorage>({
  name: 'ink',

  addStorage() {
    return {current: DEFAULT_INK};
  },

  addAttributes() {
    return {
      ink: {
        default: DEFAULT_INK,
        parseHTML: (element: HTMLElement): MarkerInk => {
          const ink = element.getAttribute('data-ink');

          return isMarkerInk(ink) ? ink : DEFAULT_INK;
        },
        renderHTML: (attributes: {ink: MarkerInk}) => ({
          'data-ink': attributes.ink,
          'style': `color: ${markerColor(attributes.ink)}`,
        }),
      },
    };
  },

  parseHTML() {
    return [{tag: 'span[data-ink]'}];
  },

  renderHTML({HTMLAttributes}) {
    return ['span', HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setInk: (ink) => ({tr, dispatch}) => {
        if (dispatch) {
          this.storage.current = ink;
          const mark = this.type.create({ink});
          const {from, to, empty} = tr.selection;

          if (!empty) {
            tr.addMark(from, to, mark);
          }

          tr.setStoredMarks([mark]);
        }

        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const type = this.type;
    const storage = this.storage;

    return [
      new Plugin({
        key: new PluginKey('ink'),

        // Typed text takes the stored marks, which ProseMirror clears whenever the selection moves.
        // Re-storing the current ink after every change means typing anywhere, even in the middle of
        // other-colored text, writes in the marker in hand.
        // Some changes carry no stored marks: pasted and dropped text, and typing that ProseMirror reads
        // back from the DOM (e.g. replacing a select-all). Pasted and dropped text is recolored; any other
        // text that arrives without an ink gets the current one, so no text is ever left uncolored.
        appendTransaction: (transactions, oldState, newState) => {
          const mark = type.create({ink: storage.current});
          const tr = newState.tr;
          let changed = false;

          if (transactions.some((transaction) => transaction.docChanged)) {
            const recolorAll = transactions.some((transaction) => INSERTING_UI_EVENTS.has(transaction.getMeta('uiEvent') as string));

            for (const {newRange} of getChangedRanges(combineTransactionSteps(oldState.doc, [...transactions]))) {
              newState.doc.nodesBetween(newRange.from, newRange.to, (node, pos) => {
                if (node.isText && (recolorAll || !type.isInSet(node.marks))) {
                  tr.addMark(Math.max(pos, newRange.from), Math.min(pos + node.nodeSize, newRange.to), mark);
                  changed = true;
                }
              });
            }
          }

          if (!mark.isInSet(newState.storedMarks ?? [])) {
            tr.setStoredMarks([mark]);
            changed = true;
          }

          return changed ? tr : null;
        },
      }),
    ];
  },
});
