<template>
  <div
    class="whiteboard-sheet"
    :style="{'--marker-color': inkColor}"
  >
    <div class="whiteboard-sheet__board">
      <!-- The surface is laid out at a fixed width and scaled to fit; the viewport takes its scaled height. -->
      <div
        ref="viewport"
        class="whiteboard-sheet__viewport"
        :style="{height: `${surfaceHeight * scale}px`}"
      >
        <div
          ref="surface"
          class="whiteboard-sheet__surface"
          :style="surfaceStyle"
        >
          <editor-content
            v-if="editor"
            :editor="editor"
          />
          <sketch-layer
            :strokes="strokeList"
            :active="mode === 'sketch'"
            :tool="tool"
            :ink="ink"
            @draw="draw"
            @erase="erase"
          />
        </div>
      </div>
    </div>

    <marker-tray
      :ink="ink"
      :mode="mode"
      :tool="tool"
      :can-undo="history.canUndo"
      :can-redo="history.canRedo"
      @pick="pickMarker"
      @mode="setMode"
      @tool="tool = $event"
      @undo="apply(history.undo())"
      @redo="apply(history.redo())"
    />
  </div>
</template>

<script lang="ts">
import type {BoardMode} from '@/components/MarkerTray.vue';
import type {SketchTool} from '@/components/SketchLayer.vue';
import type {MarkerInk} from '@/constants/markers';
import type {SketchChange} from '@/sketch/SketchHistory';
import type {BoardWriting} from '@/types/board';
import type {Stroke} from '@/types/sketch';
import type {CSSProperties, PropType, Raw} from 'vue';

import {defineComponent, markRaw} from 'vue';
import {Editor, EditorContent} from '@tiptap/vue-3';
import MarkerTray from '@/components/MarkerTray.vue';
import SketchLayer from '@/components/SketchLayer.vue';
import {BOARD_SURFACE_WIDTH} from '@/constants/board';
import {DEFAULT_INK, markerColor} from '@/constants/markers';
import {boardExtensions, fromEditorDoc, toEditorContent} from '@/editor';
import {SketchHistory} from '@/sketch/SketchHistory';
import {sketchBottom} from '@/utils/strokes';

/** Room left under the lowest stroke, so there is always somewhere to carry on sketching. */
const SKETCH_MARGIN = 120;

/**
 * The board's writing surface, the sketch drawn over it, and its marker tray. `writing` and `strokes` are only
 * read when the sheet is created; give the sheet a new `key` to show a different board. Changes are reported
 * for the parent to save: `change` for the writing, `sketch` for strokes added and removed.
 */
export default defineComponent({
  name: 'WhiteboardSheet',

  components: {
    EditorContent,
    MarkerTray,
    SketchLayer,
  },

  props: {
    writing: {
      type: Object as PropType<BoardWriting>,
      required: true,
    },
    strokes: {
      type: Array as PropType<Stroke[]>,
      required: true,
    },
  },

  emits: {
    change: (writing: BoardWriting) => Boolean(writing),
    /** Strokes to save, and how many the board now has. */
    sketch: (changes: SketchChange[], strokeCount: number) => changes.length > 0 && strokeCount >= 0,
  },

  data() {
    return {
      // Set with `markRaw`, so Vue does not wrap the editor and its ProseMirror state in reactive proxies.
      editor: null as Raw<Editor> | null,
      ink: DEFAULT_INK as MarkerInk,
      /** How much the fixed-width surface is scaled to fit the frame. */
      scale: 1,
      /** The surface's unscaled height, which grows with the writing. */
      surfaceHeight: 0,
      resizeObserver: null as Raw<ResizeObserver> | null,
      mode: 'text' as BoardMode,
      tool: 'pen' as SketchTool,
      /** The strokes on the board now, oldest first. */
      strokeList: [...this.strokes],
      history: new SketchHistory(),
    };
  },

  computed: {
    inkColor(): string {
      return markerColor(this.ink);
    },

    surfaceStyle(): CSSProperties {
      return {
        width: `${BOARD_SURFACE_WIDTH}px`,
        // Tall enough for the lowest stroke, which may be below the writing.
        minHeight: `${sketchBottom(this.strokeList) + SKETCH_MARGIN}px`,
        transform: `scale(${this.scale})`,
      };
    },
  },

  mounted(): void {
    this.editor = markRaw(new Editor({
      extensions: boardExtensions(),
      content: toEditorContent(this.writing),
      autofocus: 'end',
      editorProps: {
        attributes: {
          'role': 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Board content',
        },
      },
      onUpdate: ({editor}) => {
        this.$emit('change', fromEditorDoc(editor.state.doc));
      },
    }));

    // The frame's width sets the scale, and the writing's height sets the frame's height. Measured on the next
    // frame: resizing the frame inside the observer's own callback would trip its "loop" error.
    this.resizeObserver = markRaw(new ResizeObserver(() => {
      requestAnimationFrame(() => this.measure());
    }));
    this.resizeObserver.observe(this.$refs.viewport as HTMLElement);
    this.resizeObserver.observe(this.$refs.surface as HTMLElement);
    this.measure();
  },

  beforeUnmount(): void {
    this.resizeObserver?.disconnect();
    this.editor?.destroy();
  },

  methods: {
    /** Fits the surface to the frame's width, and the frame to the surface's scaled height. */
    measure(): void {
      const viewport = this.$refs.viewport as HTMLElement | undefined;
      const surface = this.$refs.surface as HTMLElement | undefined;

      if (viewport && surface) {
        this.scale = viewport.clientWidth / BOARD_SURFACE_WIDTH;
        // `offsetHeight` is the laid-out height, before the scale transform.
        this.surfaceHeight = surface.offsetHeight;
      }
    },

    pickMarker(ink: MarkerInk): void {
      this.ink = ink;

      // In sketch mode the marker only colors new strokes; the writing is left alone.
      if (this.mode === 'text') {
        this.editor?.chain().focus().setInk(ink).run();
      }
    },

    /** In sketch mode the writing cannot be edited, so pointers and taps go to the sketch. */
    setMode(mode: BoardMode): void {
      this.mode = mode;
      this.editor?.setEditable(mode === 'text');

      if (mode === 'text') {
        this.editor?.commands.focus();
      }
    },

    draw(stroke: Stroke): void {
      this.apply(this.history.record({type: 'draw', stroke}));
    },

    erase(strokes: Stroke[]): void {
      this.apply(this.history.record({type: 'erase', strokes}));
    },

    /** Shows the changes, and reports them for saving. */
    apply(changes: SketchChange[]): void {
      if (changes.length === 0) {
        return;
      }

      for (const change of changes) {
        if (change.type === 'add') {
          // Kept in drawing order, so a restored stroke goes back beneath the ones drawn after it.
          const index = this.strokeList.findIndex((stroke) => stroke.drawnAt > change.stroke.drawnAt);
          this.strokeList.splice(index === -1 ? this.strokeList.length : index, 0, change.stroke);
        } else {
          this.strokeList = this.strokeList.filter((stroke) => stroke.id !== change.stroke.id);
        }
      }

      this.$emit('sketch', changes, this.strokeList.length);
    },
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles/board';

.whiteboard-sheet {
  display: flex;
  flex-direction: column;

  &__board {
    @include board.surface(12px);

    // The tray forms the bottom of the frame.
    border-bottom-width: 0;
    border-radius: 12px 12px 0 0;
    position: relative;

    // The sheen left on a board that has been wiped clean.
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(104deg, rgb(255 255 255 / 80%) 0%, rgb(255 255 255 / 0%) 45%);
      pointer-events: none;
    }
  }

  &__viewport {
    // Positioned so the writing sits above the sheen.
    position: relative;
    overflow: hidden;
  }

  // Everything inside is in surface pixels: sizes are px, not rem, because a rem follows the user's
  // browser font size and would change where lines wrap from one person to the next.
  &__surface {
    // The sketch layer covers the surface exactly, in the same surface pixels as the writing.
    position: relative;
    padding: 16px 28px 28px;
    transform-origin: top left;
  }

  :deep(.ProseMirror) {
    min-height: 640px;
    font-family: board.$marker-font;
    font-size: 24px;
    line-height: 40px;
    color: var(--marker-color);
    caret-color: var(--marker-color);
    outline: none;
    white-space: pre-wrap;
    overflow-wrap: break-word;

    p {
      margin: 0;
    }

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      height: 0;
      opacity: 0.35;
      pointer-events: none;
    }
  }
}
</style>
