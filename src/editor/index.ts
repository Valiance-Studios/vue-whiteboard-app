import type {Extensions} from '@tiptap/core';

import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import {Placeholder, UndoRedo} from '@tiptap/extensions';
import {BOARD_CONTENT_MAX_LENGTH} from '@/constants/board';
import {ContentLimit} from './ContentLimit';
import {Ink} from './Ink';

export {contentLength, fromEditorDoc, toEditorContent} from './boardDocument';

/** Plain lines of colored text, and nothing else: no bold, headings or lists. */
export function boardExtensions(): Extensions {
  return [
    Document,
    Paragraph,
    Text,
    Ink,
    UndoRedo,
    Placeholder.configure({placeholder: 'Write on the board…'}),
    ContentLimit.configure({limit: BOARD_CONTENT_MAX_LENGTH}),
  ];
}
