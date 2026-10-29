import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {contentLength} from './boardDocument';

export interface ContentLimitOptions {
  /** The most characters the stored `content` may hold, line breaks included. */
  limit: number;
}

/**
 * Refuses changes that would make the board longer than the rules allow. Tiptap's CharacterCount
 * is not used because it does not count line breaks, which are characters in the stored content.
 */
export const ContentLimit = Extension.create<ContentLimitOptions>({
  name: 'contentLimit',

  addOptions() {
    return {limit: Infinity};
  },

  addProseMirrorPlugins() {
    const {limit} = this.options;

    return [
      new Plugin({
        key: new PluginKey('contentLimit'),
        // A board already over the limit (e.g. saved before it existed) may still be shortened.
        filterTransaction: (tr, state) => !tr.docChanged || contentLength(tr.doc) <= Math.max(limit, contentLength(state.doc)),
      }),
    ];
  },
});
