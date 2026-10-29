import type {MarkerInk} from '@/constants/markers';
import type {BoardWriting, InkRun} from '@/types/board';

import {DEFAULT_INK, isMarkerInk} from '@/constants/markers';

/** A piece of text in one ink, for rendering. */
export interface InkSegment {
  text: string;
  ink: MarkerInk;
}

/**
 * Makes runs cover exactly `length` characters: drops empty runs, joins neighbours of the same ink,
 * cuts off anything past the end, and writes any uncovered remainder in the default ink.
 */
export function normalizeInks(runs: readonly InkRun[], length: number): InkRun[] {
  const normalized: InkRun[] = [];
  let covered = 0;

  const append = (ink: MarkerInk, runLength: number): void => {
    const last = normalized.at(-1);

    if (last?.ink === ink) {
      last.length += runLength;
    } else {
      normalized.push({ink, length: runLength});
    }

    covered += runLength;
  };

  for (const run of runs) {
    const runLength = Math.min(run.length, length - covered);

    if (runLength > 0) {
      append(run.ink, runLength);
    }
  }

  if (covered < length) {
    append(DEFAULT_INK, length - covered);
  }

  return normalized;
}

/** Writes runs compactly for storage, e.g. `blue:24,red:7`. */
export function encodeInks(runs: readonly InkRun[]): string {
  return runs.map((run) => `${run.ink}:${run.length}`).join(',');
}

/**
 * Reads runs written by `encodeInks` for text of the given length. Missing or malformed values
 * fall back to the default ink rather than failing, since the rules cannot check them against the text.
 */
export function decodeInks(encoded: string | undefined, length: number): InkRun[] {
  const runs: InkRun[] = [];

  for (const part of encoded ? encoded.split(',') : []) {
    const [ink, count] = part.split(':');
    const runLength = Number(count);

    if (!isMarkerInk(ink) || !Number.isInteger(runLength) || runLength <= 0) {
      return normalizeInks([], length);
    }

    runs.push({ink, length: runLength});
  }

  return normalizeInks(runs, length);
}

/** Splits text into its pieces of each ink. */
export function inkSegments(content: string, runs: readonly InkRun[]): InkSegment[] {
  const segments: InkSegment[] = [];
  let start = 0;

  for (const run of normalizeInks(runs, content.length)) {
    segments.push({text: content.slice(start, start + run.length), ink: run.ink});
    start += run.length;
  }

  return segments;
}

export function isSameWriting(a: BoardWriting, b: BoardWriting): boolean {
  return a.content === b.content && encodeInks(a.inks) === encodeInks(b.inks);
}
