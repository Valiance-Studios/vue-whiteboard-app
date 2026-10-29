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
        </div>
      </div>
    </div>

    <marker-tray
      :ink="ink"
      @pick="pickMarker"
    />
  </div>
</template>

<script lang="ts">
import type {MarkerInk} from '@/constants/markers';
import type {BoardWriting} from '@/types/board';
import type {CSSProperties, PropType, Raw} from 'vue';

import {defineComponent, markRaw} from 'vue';
import {Editor, EditorContent} from '@tiptap/vue-3';
import MarkerTray from '@/components/MarkerTray.vue';
import {BOARD_SURFACE_WIDTH} from '@/constants/board';
import {DEFAULT_INK, markerColor} from '@/constants/markers';
import {boardExtensions, fromEditorDoc, toEditorContent} from '@/editor';

/**
 * The board's writing surface and its marker tray. `writing` is only read when the sheet is created;
 * give the sheet a new `key` to show different writing.
 */
export default defineComponent({
  name: 'WhiteboardSheet',

  components: {
    EditorContent,
    MarkerTray,
  },

  props: {
    writing: {
      type: Object as PropType<BoardWriting>,
      required: true,
    },
  },

  emits: {
    change: (writing: BoardWriting) => Boolean(writing),
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
    };
  },

  computed: {
    inkColor(): string {
      return markerColor(this.ink);
    },

    surfaceStyle(): CSSProperties {
      return {width: `${BOARD_SURFACE_WIDTH}px`, transform: `scale(${this.scale})`};
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

    // The frame's width sets the scale, and the writing's height sets the frame's height.
    this.resizeObserver = markRaw(new ResizeObserver(() => {
      this.measure();
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
      this.editor?.chain().focus().setInk(ink).run();
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
