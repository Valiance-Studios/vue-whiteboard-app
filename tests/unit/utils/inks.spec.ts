import {describe, expect, it} from 'vitest';
import {decodeInks, encodeInks, inkSegments, isSameWriting, normalizeInks, writingFromSegments} from '@/utils/inks';

describe('normalizeInks', () => {
  it('joins neighbours of the same ink and drops empty runs', () => {
    expect(normalizeInks([{ink: 'red', length: 2}, {ink: 'blue', length: 0}, {ink: 'red', length: 3}], 5))
      .toEqual([{ink: 'red', length: 5}]);
  });

  it('cuts off runs past the end of the text', () => {
    expect(normalizeInks([{ink: 'red', length: 4}, {ink: 'green', length: 4}], 6))
      .toEqual([{ink: 'red', length: 4}, {ink: 'green', length: 2}]);
  });

  it('writes uncovered text in the default ink', () => {
    expect(normalizeInks([{ink: 'red', length: 2}], 5)).toEqual([{ink: 'red', length: 2}, {ink: 'blue', length: 3}]);
  });

  it('has no runs for empty text', () => {
    expect(normalizeInks([], 0)).toEqual([]);
  });
});

describe('encodeInks and decodeInks', () => {
  it('round-trips runs', () => {
    const runs = [{ink: 'blue' as const, length: 24}, {ink: 'red' as const, length: 7}];

    expect(encodeInks(runs)).toBe('blue:24,red:7');
    expect(decodeInks('blue:24,red:7', 31)).toEqual(runs);
  });

  it('reads a board without inks as the default ink', () => {
    expect(decodeInks(undefined, 4)).toEqual([{ink: 'blue', length: 4}]);
  });

  it.each(['pink:3', 'red:-1', 'red:1.5', 'red', 'red:3,,blue:1'])('falls back to the default ink for malformed %s', (encoded) => {
    expect(decodeInks(encoded, 4)).toEqual([{ink: 'blue', length: 4}]);
  });

  it('fits runs that disagree with the text length', () => {
    expect(decodeInks('red:2', 3)).toEqual([{ink: 'red', length: 2}, {ink: 'blue', length: 1}]);
    expect(decodeInks('red:9', 3)).toEqual([{ink: 'red', length: 3}]);
  });
});

describe('inkSegments', () => {
  it('splits text into its pieces of each ink', () => {
    expect(inkSegments('Hello world', [{ink: 'blue', length: 6}, {ink: 'red', length: 5}])).toEqual([
      {text: 'Hello ', ink: 'blue'},
      {text: 'world', ink: 'red'},
    ]);
  });
});

describe('isSameWriting', () => {
  it('compares both the text and its inks', () => {
    const writing = {content: 'Hi', inks: [{ink: 'red' as const, length: 2}]};

    expect(isSameWriting(writing, {content: 'Hi', inks: [{ink: 'red', length: 2}]})).toBe(true);
    expect(isSameWriting(writing, {content: 'Hi', inks: [{ink: 'blue', length: 2}]})).toBe(false);
    expect(isSameWriting(writing, {content: 'Ho', inks: [{ink: 'red', length: 2}]})).toBe(false);
  });
});

describe('writingFromSegments', () => {
  it('joins the text and gives each piece its ink, merging neighbours of the same ink', () => {
    expect(writingFromSegments([{text: 'Hi ', ink: 'red'}, {text: 'there', ink: 'red'}, {text: '!', ink: 'green'}]))
      .toEqual({content: 'Hi there!', inks: [{ink: 'red', length: 8}, {ink: 'green', length: 1}]});
  });

  it('is the reverse of inkSegments', () => {
    const writing = {content: 'Hello world', inks: [{ink: 'blue' as const, length: 6}, {ink: 'red' as const, length: 5}]};

    expect(writingFromSegments(inkSegments(writing.content, writing.inks))).toEqual(writing);
  });
});
