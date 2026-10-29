<template>
  <svg
    ref="svg"
    class="sketch-layer"
    :class="{'sketch-layer--active': active, [`sketch-layer--${tool}`]: active}"
    aria-hidden="true"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <path
      v-for="stroke in visibleStrokes"
      :key="stroke.id"
      class="sketch-layer__stroke"
      :data-ink="stroke.ink"
      :d="pathOf(stroke)"
      :fill="colorOf(stroke)"
    />
    <path
      v-if="liveStroke"
      :d="livePath"
      :fill="colorOf(liveStroke)"
    />
  </svg>
</template>

<script lang="ts">
import type {MarkerInk} from '@/constants/markers';
import type {Stroke, StrokePoint} from '@/types/sketch';
import type {PropType} from 'vue';
import type {StrokeOptions} from 'perfect-freehand';

import {defineComponent, toRaw} from 'vue';
import {getStroke} from 'perfect-freehand';
import {BOARD_SURFACE_WIDTH, STROKE_POINTS_MAX_LENGTH} from '@/constants/board';
import {markerColor} from '@/constants/markers';
import {fitPoints, strokeHitsPoint} from '@/utils/strokes';

export type SketchTool = 'pen' | 'eraser';

/** Each stroke's SVG path. Strokes never change once drawn, so a path is worked out once per stroke. */
const pathCache = new WeakMap<Stroke, string>();

/** How far from a stroke, in surface pixels, the eraser still catches it. */
const ERASER_RADIUS = 10;

/** A marker's line: a pen's pressure varies its width; mouse and finger strokes vary a little with speed. */
function strokeOptions(pen: boolean, last: boolean): StrokeOptions {
  return {size: 7, thinning: pen ? 0.55 : 0.3, smoothing: 0.5, streamline: 0.4, simulatePressure: !pen, last};
}

/** An SVG path through the outline perfect-freehand gives, as quadratic curves between midpoints. */
function outlineToPath(outline: number[][]): string {
  if (outline.length < 2) {
    return '';
  }

  const [first, ...rest] = outline;
  const segments = rest.map((point, i) => {
    const previous = outline[i];

    return `${previous[0].toFixed(1)},${previous[1].toFixed(1)} ${((previous[0] + point[0]) / 2).toFixed(1)},${((previous[1] + point[1]) / 2).toFixed(1)}`;
  });

  return `M${first[0].toFixed(1)},${first[1].toFixed(1)} Q${segments.join(' ')} Z`;
}

interface Drawing {
  pointerId: number;
  stroke: Stroke;
}

interface Erasing {
  pointerId: number;
  erased: Stroke[];
}

/**
 * The sketch drawn over a board's writing, in the surface's own pixels, so it scales with the board and
 * stays on the words it marks. While `active`, it takes the pointer: the pen draws a stroke per gesture,
 * and the eraser removes every stroke it touches. Results are reported, not applied: the parent owns the strokes.
 */
export default defineComponent({
  name: 'SketchLayer',

  props: {
    strokes: {
      type: Array as PropType<Stroke[]>,
      required: true,
    },
    active: {
      type: Boolean,
      required: true,
    },
    tool: {
      type: String as PropType<SketchTool>,
      required: true,
    },
    ink: {
      type: String as PropType<MarkerInk>,
      required: true,
    },
  },

  emits: {
    draw: (stroke: Stroke) => Boolean(stroke),
    erase: (strokes: Stroke[]) => strokes.length > 0,
  },

  data() {
    return {
      drawing: null as Drawing | null,
      erasing: null as Erasing | null,
      /** Once a pen has been used, touches are taken for a resting palm and ignored. */
      penSeen: false,
    };
  },

  computed: {
    visibleStrokes(): Stroke[] {
      const erased = this.erasing?.erased;

      return erased ? this.strokes.filter((stroke) => !erased.includes(stroke)) : this.strokes;
    },

    liveStroke(): Stroke | null {
      return this.drawing?.stroke ?? null;
    },

    livePath(): string {
      const stroke = this.liveStroke;

      return stroke ? outlineToPath(getStroke(stroke.points, strokeOptions(stroke.pen, false))) : '';
    },
  },

  methods: {
    pathOf(stroke: Stroke): string {
      // Keyed by the raw stroke, since Vue may hand the same stroke over as a reactive proxy.
      const raw = toRaw(stroke);
      let path = pathCache.get(raw);

      if (path === undefined) {
        path = outlineToPath(getStroke(raw.points, strokeOptions(raw.pen, true)));
        pathCache.set(raw, path);
      }

      return path;
    },

    colorOf(stroke: Stroke): string {
      return markerColor(stroke.ink);
    },

    /** The event's position on the surface, in surface pixels, whatever the board's scale. */
    pointOf(event: PointerEvent): StrokePoint {
      const rect = (this.$refs.svg as SVGSVGElement).getBoundingClientRect();
      const toSurface = BOARD_SURFACE_WIDTH / rect.width;
      // A pen reports pressure; mouse and touch report a flat 0.5 while pressed.
      const pressure = event.pointerType === 'pen' ? Math.max(event.pressure, 0.05) : 0.5;

      return [(event.clientX - rect.left) * toSurface, (event.clientY - rect.top) * toSurface, pressure];
    },

    onPointerDown(event: PointerEvent): void {
      if (!this.active) {
        return;
      }

      if (event.pointerType === 'pen') {
        this.penSeen = true;
      } else if (event.pointerType === 'touch' && this.penSeen) {
        return;
      }

      // A second finger means a pinch, not a stroke.
      if (!event.isPrimary) {
        this.cancelDrawing();

        return;
      }

      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      event.preventDefault();
      (this.$refs.svg as SVGSVGElement).setPointerCapture(event.pointerId);

      if (this.tool === 'eraser') {
        this.erasing = {pointerId: event.pointerId, erased: []};
        this.eraseAt(event);
      } else {
        this.drawing = {
          pointerId: event.pointerId,
          stroke: {id: crypto.randomUUID(), ink: this.ink, pen: event.pointerType === 'pen', points: [this.pointOf(event)], drawnAt: Date.now()},
        };
      }
    },

    onPointerMove(event: PointerEvent): void {
      // Fast movement is reported in fewer events than it happened in; the coalesced ones fill the gaps.
      const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
      const moves = events.length > 0 ? events : [event];

      if (this.drawing?.pointerId === event.pointerId) {
        this.drawing.stroke.points.push(...moves.map((move) => this.pointOf(move)));
      } else if (this.erasing?.pointerId === event.pointerId) {
        moves.forEach((move) => this.eraseAt(move));
      }
    },

    onPointerUp(event: PointerEvent): void {
      if (this.drawing?.pointerId === event.pointerId) {
        const {stroke} = this.drawing;
        this.drawing = null;
        this.$emit('draw', {...stroke, points: fitPoints(stroke.points, STROKE_POINTS_MAX_LENGTH)});
      } else if (this.erasing?.pointerId === event.pointerId) {
        this.finishErasing();
      }
    },

    /** The browser took the pointer, e.g. for a pinch-zoom: a half-drawn stroke is dropped, but erasing so far stands. */
    onPointerCancel(event: PointerEvent): void {
      if (this.drawing?.pointerId === event.pointerId) {
        this.cancelDrawing();
      } else if (this.erasing?.pointerId === event.pointerId) {
        this.finishErasing();
      }
    },

    cancelDrawing(): void {
      this.drawing = null;
    },

    eraseAt(event: PointerEvent): void {
      const erasing = this.erasing;

      if (!erasing) {
        return;
      }

      const [x, y] = this.pointOf(event);

      for (const stroke of this.visibleStrokes) {
        if (strokeHitsPoint(stroke, [x, y], ERASER_RADIUS)) {
          erasing.erased.push(stroke);
        }
      }
    },

    finishErasing(): void {
      const erased = this.erasing?.erased ?? [];
      this.erasing = null;

      if (erased.length > 0) {
        this.$emit('erase', erased);
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.sketch-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  // Text mode: strokes show over the writing, but clicks go through to it.
  pointer-events: none;

  &--active {
    pointer-events: auto;
    // One finger draws; two still pinch-zoom the page.
    touch-action: pinch-zoom;
  }

  &--pen {
    cursor: crosshair;
  }

  &--eraser {
    cursor: cell;
  }
}
</style>
