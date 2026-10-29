import type {BoardWriting} from '@/types/board';

import {afterEach, describe, expect, it} from 'vitest';
import {Editor} from '@tiptap/core';
import {boardExtensions, fromEditorDoc, toEditorContent} from '@/editor';
import {BOARD_CONTENT_MAX_LENGTH} from '@/constants/board';

let editor: Editor | null = null;

function createEditor(writing: BoardWriting): Editor {
  editor = new Editor({extensions: boardExtensions(), content: toEditorContent(writing)});

  return editor;
}

function writingOf(target: Editor): BoardWriting {
  return fromEditorDoc(target.state.doc);
}

/** Types text at the cursor the way the browser does, so it takes the stored marks. */
function type(target: Editor, text: string): void {
  target.view.dispatch(target.state.tr.insertText(text));
}

/** The editor position just after the `offset`th character of the first line. */
function afterCharacter(offset: number): number {
  return offset + 1;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('board document conversion', () => {
  it('round-trips lines of colored text', () => {
    const writing: BoardWriting = {
      content: 'Milk\nEggs\n\nBread',
      inks: [{ink: 'red', length: 5}, {ink: 'green', length: 6}, {ink: 'blue', length: 5}],
    };

    expect(writingOf(createEditor(writing))).toEqual(writing);
  });

  it('round-trips an empty board', () => {
    expect(writingOf(createEditor({content: '', inks: []}))).toEqual({content: '', inks: []});
  });

  it('gives a line break the ink of the text before it', () => {
    const doc = createEditor({content: 'Hi\nYo', inks: [{ink: 'red', length: 2}, {ink: 'green', length: 3}]}).state.doc;

    expect(fromEditorDoc(doc).inks).toEqual([{ink: 'red', length: 3}, {ink: 'green', length: 2}]);
  });
});

describe('Ink', () => {
  it('writes new text in the marker in hand', () => {
    const target = createEditor({content: 'Hello', inks: [{ink: 'blue', length: 5}]});
    target.commands.setTextSelection(afterCharacter(5));

    target.commands.setInk('red');
    type(target, ' world');

    expect(writingOf(target)).toEqual({content: 'Hello world', inks: [{ink: 'blue', length: 5}, {ink: 'red', length: 6}]});
  });

  it('keeps writing in the marker in hand after the cursor moves into other-colored text', () => {
    const target = createEditor({content: 'Hello', inks: [{ink: 'blue', length: 5}]});
    target.commands.setInk('green');

    target.commands.setTextSelection(afterCharacter(2));
    type(target, 'xx');

    expect(writingOf(target).inks).toEqual([{ink: 'blue', length: 2}, {ink: 'green', length: 2}, {ink: 'blue', length: 3}]);
  });

  it('recolors the selected text', () => {
    const target = createEditor({content: 'Milk Eggs', inks: [{ink: 'blue', length: 9}]});
    target.commands.setTextSelection({from: afterCharacter(5), to: afterCharacter(9)});

    target.commands.setInk('purple');

    expect(writingOf(target)).toEqual({content: 'Milk Eggs', inks: [{ink: 'blue', length: 5}, {ink: 'purple', length: 4}]});
  });

  it('writes pasted text in the marker in hand', () => {
    const target = createEditor({content: 'Hello', inks: [{ink: 'blue', length: 5}]});
    target.commands.setTextSelection(afterCharacter(5));
    target.commands.setInk('orange');

    // What ProseMirror's paste handler dispatches; jsdom has no ClipboardEvent to drive the real one.
    // The pasted text arrives in another ink, as when copied from elsewhere on the board.
    const {schema} = target.state;
    const pasted = schema.text(' pasted', [schema.marks.ink.create({ink: 'blue'})]);
    target.view.dispatch(target.state.tr.replaceSelectionWith(pasted, false).setMeta('uiEvent', 'paste'));

    expect(writingOf(target)).toEqual({content: 'Hello pasted', inks: [{ink: 'blue', length: 5}, {ink: 'orange', length: 7}]});
  });

  it('colors text that arrives without an ink, as when typing over a select-all', () => {
    const target = createEditor({content: 'Old', inks: [{ink: 'blue', length: 3}]});
    target.commands.setInk('green');

    // ProseMirror reads this kind of typing back from the DOM, so the new text has no marks.
    const {doc, schema} = target.state;
    target.view.dispatch(target.state.tr.replaceWith(0, doc.content.size, schema.nodes.paragraph.create(null, schema.text('New'))));

    expect(writingOf(target)).toEqual({content: 'New', inks: [{ink: 'green', length: 3}]});
    expect(target.state.doc.firstChild?.firstChild?.marks.map((mark) => mark.attrs.ink)).toEqual(['green']);
  });

  it('leaves the colors of text it did not write alone', () => {
    const target = createEditor({content: 'Milk Eggs', inks: [{ink: 'red', length: 5}, {ink: 'purple', length: 4}]});
    target.commands.setInk('green');

    target.commands.setTextSelection(afterCharacter(9));
    type(target, '!');

    expect(writingOf(target).inks).toEqual([{ink: 'red', length: 5}, {ink: 'purple', length: 4}, {ink: 'green', length: 1}]);
  });

  it('restores the original colors on undo', () => {
    const target = createEditor({content: 'Milk', inks: [{ink: 'blue', length: 4}]});
    target.commands.selectAll();
    target.commands.setInk('red');

    target.commands.undo();

    expect(writingOf(target).inks).toEqual([{ink: 'blue', length: 4}]);
  });
});

describe('ContentLimit', () => {
  it('refuses writing past the limit, counting line breaks', () => {
    const almostFull = 'a'.repeat(BOARD_CONTENT_MAX_LENGTH - 3) + '\nb';
    const target = createEditor({content: almostFull, inks: []});
    target.commands.focus('end');

    type(target, 'c');
    type(target, 'dd');

    expect(writingOf(target).content).toBe(`${almostFull}c`);
  });
});
