<template>
  <div
    class="whiteboard-sheet"
    :class="{'whiteboard-sheet--fullscreen': fullscreen}"
    :style="{'--marker-color': inkColor}"
  >
    <div class="whiteboard-sheet__board">
      <v-btn
        class="whiteboard-sheet__fullscreen-toggle"
        :icon="fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
        :aria-label="fullscreenLabel"
        :title="fullscreenLabel"
        variant="text"
        density="comfortable"
        color="#2c3440"
        @mousedown.prevent
        @click="toggleFullscreen"
      />
      <div class="whiteboard-sheet__writing">
        <editor-content
          v-if="editor"
          :editor="editor"
        />
      </div>
    </div>

    <marker-tray
      :ink="ink"
      :custom-color="customColor"
      @pick="pickMarker"
      @custom-color-input="applyCustomColor"
      @color-panel-close="finishCustomColor"
    />
  </div>
</template>

<script lang="ts">
import type {MarkerInk} from '@/constants/markers';
import type {BoardWriting} from '@/types/board';
import type {HexColor} from '@/utils/color';
import type {PropType, Raw} from 'vue';

import {defineComponent, markRaw} from 'vue';
import {Editor, EditorContent} from '@tiptap/vue-3';
import MarkerTray from '@/components/MarkerTray.vue';
import {DEFAULT_INK, markerColor} from '@/constants/markers';
import {boardExtensions, fromEditorDoc, toEditorContent} from '@/editor';
import {isHexColor} from '@/utils/color';

/**
 * Leaving browser full screen this soon after entering was not the user's doing: iPad Safari drops out
 * as soon as an editable element has focus, and the board's editor always does.
 */
const FORCED_FULLSCREEN_EXIT_MS = 1000;

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
    /** The user's saved RGB marker color. A new color is only reported once they are done choosing it. */
    customMarkerColor: {
      type: String as PropType<HexColor>,
      required: true,
    },
  },

  emits: {
    change: (writing: BoardWriting) => Boolean(writing),
    customMarkerColorChange: (color: HexColor) => Boolean(color),
  },

  data() {
    return {
      // Set with `markRaw`, so Vue does not wrap the editor and its ProseMirror state in reactive proxies.
      editor: null as Raw<Editor> | null,
      ink: DEFAULT_INK as MarkerInk,
      customColor: this.customMarkerColor,
      fullscreen: false,
      /** When the browser last entered full screen, in epoch ms. */
      fullscreenEnteredAt: 0,
    };
  },

  computed: {
    inkColor(): string {
      return markerColor(this.ink);
    },

    fullscreenLabel(): string {
      return this.fullscreen ? 'Exit full screen' : 'Enter full screen';
    },
  },

  watch: {
    // The saved color can arrive after the sheet is created, since settings load separately from the board.
    customMarkerColor(color: HexColor): void {
      if (color !== this.customColor) {
        this.applyCustomColor(color);
      }
    },
  },

  mounted(): void {
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
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
  },

  beforeUnmount(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    void this.leaveBrowserFullscreen();
    // Leaving with the panel still open, e.g. with the browser's back button.
    this.saveCustomColor();
    this.editor?.destroy();
  },

  methods: {
    /**
     * Covers the page with the sheet, and asks the browser to take the page full screen. The page rather
     * than the sheet, because the color panel renders outside the sheet, where a full-screen sheet would hide it.
     * Without browser support, or if the browser refuses, the sheet still fills the window.
     */
    async toggleFullscreen(): Promise<void> {
      this.fullscreen = !this.fullscreen;

      try {
        if (this.fullscreen) {
          await document.documentElement.requestFullscreen?.();
        } else {
          await this.leaveBrowserFullscreen();
        }
      } catch (error) {
        console.warn('Could not change the browser\'s full-screen mode', error);
      }
    },

    async leaveBrowserFullscreen(): Promise<void> {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    },

    /**
     * The browser can leave full screen by itself, e.g. on Escape, which ends the sheet's full screen too.
     * If the browser forced the exit, the sheet stays filling the window, as it does without browser support.
     */
    onFullscreenChange(): void {
      if (document.fullscreenElement) {
        this.fullscreenEnteredAt = Date.now();
      } else if (Date.now() - this.fullscreenEnteredAt >= FORCED_FULLSCREEN_EXIT_MS) {
        this.fullscreen = false;
      }
    },

    pickMarker(ink: MarkerInk): void {
      this.ink = ink;
      this.editor?.chain().focus().setInk(ink).run();
    },

    /** Changes the RGB marker's color, leaving focus alone. If it is in hand, the selected text and whatever is written next take the new color. */
    applyCustomColor(color: HexColor): void {
      this.customColor = color;

      if (isHexColor(this.ink)) {
        this.ink = color;
        this.editor?.commands.setInk(color);
      }
    },

    finishCustomColor(): void {
      this.saveCustomColor();
      this.editor?.commands.focus();
    },

    saveCustomColor(): void {
      if (this.customColor !== this.customMarkerColor) {
        this.$emit('customMarkerColorChange', this.customColor);
      }
    },
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles/board';

// Fills the height its parent gives it. The frame and tray stay put; only the writing scrolls.
.whiteboard-sheet {
  display: flex;
  flex-direction: column;

  // Above the app bar, and below Vuetify's overlays, so the color panel still opens over it.
  &--fullscreen {
    position: fixed;
    inset: 0;
    z-index: 1100;
    background: #fff;
  }

  &--fullscreen &__board,
  &--fullscreen :deep(.marker-tray) {
    border-radius: 0;
  }

  &__fullscreen-toggle {
    position: absolute;
    top: 8px;
    right: 12px;
    z-index: 1;
  }

  &__board {
    @include board.surface(12px);

    // The tray forms the bottom of the frame.
    border-bottom-width: 0;
    border-radius: 12px 12px 0 0;
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-height: 0;

    // The sheen left on a board that has been wiped clean. On the frame, so it stays put while the writing scrolls.
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(104deg, rgb(255 255 255 / 80%) 0%, rgb(255 255 255 / 0%) 45%);
      pointer-events: none;
    }
  }

  // Positioned so the writing sits above the sheen. A column, so the editor can stretch to fill it.
  &__writing {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    // Wider on the right, so the first line stops short of the full-screen button.
    padding: 16px 56px 28px 28px;
    overflow-y: auto;

    > :deep(div) {
      display: flex;
      flex: 1 0 auto;
      flex-direction: column;
    }
  }

  // Stretched to the bottom of the board, so clicking anywhere on it puts the caret in the writing.
  :deep(.ProseMirror) {
    flex: 1 0 auto;
    font-family: board.$marker-font;
    font-size: 1.5rem;
    line-height: 2.5rem;
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
