import type {BoardWriting, InkRun} from '@/types/board';
import type {JSONContent} from '@tiptap/core';
import type {Node as ProseMirrorNode} from '@tiptap/pm/model';

import {DEFAULT_INK, isMarkerInk} from '@/constants/markers';
import {inkSegments, normalizeInks} from '@/utils/inks';

// A board document is a list of paragraphs holding inked text; each paragraph is one line of `content`.

function paragraph(content: JSONContent[]): JSONContent {
  return content.length > 0 ? {type: 'paragraph', content} : {type: 'paragraph'};
}

/** The editor document for stored writing. */
export function toEditorContent(writing: BoardWriting): JSONContent {
  const paragraphs: JSONContent[] = [];
  let line: JSONContent[] = [];

  for (const {text, ink} of inkSegments(writing.content, writing.inks)) {
    text.split('\n').forEach((piece, index) => {
      if (index > 0) {
        paragraphs.push(paragraph(line));
        line = [];
      }

      if (piece) {
        line.push({type: 'text', text: piece, marks: [{type: 'ink', attrs: {ink}}]});
      }
    });
  }

  paragraphs.push(paragraph(line));

  return {type: 'doc', content: paragraphs};
}

/** The writing to store for an editor document. */
export function fromEditorDoc(doc: ProseMirrorNode): BoardWriting {
  let content = '';
  const runs: InkRun[] = [];

  doc.forEach((block, _offset, index) => {
    if (index > 0) {
      // A line break has no color of its own; giving it the ink before it keeps runs long.
      content += '\n';
      runs.push({ink: runs.at(-1)?.ink ?? DEFAULT_INK, length: 1});
    }

    block.forEach((node) => {
      if (node.text) {
        const ink: unknown = node.marks.find((mark) => mark.type.name === 'ink')?.attrs.ink;
        content += node.text;
        runs.push({ink: isMarkerInk(ink) ? ink : DEFAULT_INK, length: node.text.length});
      }
    });
  });

  return {content, inks: normalizeInks(runs, content.length)};
}

/** The length of the document as stored `content`, counting each line break. */
export function contentLength(doc: ProseMirrorNode): number {
  return doc.textBetween(0, doc.content.size, '\n').length;
}
