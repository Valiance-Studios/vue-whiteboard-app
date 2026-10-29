<template>
  <div
    class="whiteboard-sheet"
    :style="{'--marker-color': inkColor}"
  >
    <div class="whiteboard-sheet__board">
      <editor-content
        v-if="editor"
        :editor="editor"
      />
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
import type {PropType, Raw} from 'vue';

import {defineComponent, markRaw} from 'vue';
import {Editor, EditorContent} from '@tiptap/vue-3';
import MarkerTray from '@/components/MarkerTray.vue';
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
    };
  },

  computed: {
    inkColor(): string {
      return markerColor(this.ink);
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
  },

  beforeUnmount(): void {
    this.editor?.destroy();
  },

  methods: {
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
    padding: 16px 28px 28px;

    // The sheen left on a board that has been wiped clean.
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(104deg, rgb(255 255 255 / 80%) 0%, rgb(255 255 255 / 0%) 45%);
      pointer-events: none;
    }
  }

  // Positioned so the writing sits above the sheen.
  :deep(.ProseMirror) {
    position: relative;
    min-height: 40rem;
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
