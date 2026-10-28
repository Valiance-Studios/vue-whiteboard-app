<template>
  <v-container class="board-view">
    <v-skeleton-loader
      v-if="loading"
      type="heading"
      max-width="480"
      class="mb-4"
    />

    <template v-else-if="board">
      <div class="board-view__header mb-4">
        <h1 class="text-h4">
          {{ board.title }}
        </h1>

        <div
          v-if="saveStatus"
          class="board-view__status text-body-2"
          role="status"
        >
          <v-icon
            :icon="saveStatus.icon"
            :color="saveStatus.color"
            size="small"
          />
          <span :class="saveStatus.textClass">{{ saveStatus.text }}</span>
          <v-btn
            v-if="saveFailed"
            variant="text"
            size="small"
            density="comfortable"
            @click="saveNow"
          >
            Retry
          </v-btn>
        </div>
      </div>

      <v-sheet
        class="board-sheet"
        elevation="6"
      >
        <v-textarea
          :model-value="content"
          class="board-sheet__writing"
          aria-label="Board content"
          placeholder="Write on the board…"
          variant="plain"
          rows="16"
          hide-details
          no-resize
          auto-grow
          autofocus
          @update:model-value="onContentInput"
        />
      </v-sheet>
    </template>

    <v-alert
      v-else-if="errorMessage"
      type="error"
      variant="tonal"
    >
      {{ errorMessage }}
      <template #append>
        <v-btn
          variant="text"
          @click="load"
        >
          Retry
        </v-btn>
      </template>
    </v-alert>

    <v-empty-state
      v-else
      icon="mdi-file-question-outline"
      title="Board not found"
      text="This board doesn't exist, or you don't have access to it."
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-arrow-left"
          :to="boardCollectionRoute"
        >
          Back to my boards
        </v-btn>
      </template>
    </v-empty-state>
  </v-container>
</template>

<script lang="ts">
import type {Board} from '@/types/board';
import type {Debounced} from '@/utils/debounce';
import type {RouteLocationRaw} from 'vue-router';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {debounce} from '@/utils/debounce';
import {RouteName} from '@/router/routes';
import {useBoardsStore} from '@/stores/boards';

/** How long typing pauses before the board is saved. */
const SAVE_DEBOUNCE_MS = 800;

/** What the header tells the user about the state of their writing. */
interface SaveStatus {
  text: string;
  textClass: string;
  icon: string;
  color: string;
}

export default defineComponent({
  name: 'BoardView',

  // Writing is saved before the route changes, so edits are never lost by navigating away.
  async beforeRouteUpdate(): Promise<void> {
    await this.flushSave();
  },

  async beforeRouteLeave(): Promise<void> {
    await this.flushSave();
  },

  props: {
    id: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      board: null as Board | null,
      loading: true,
      errorMessage: null as string | null,
      /** What is on the board right now, saved after a pause in typing. */
      content: '',
      /** The text as last written to storage; anything else means there is work to save. */
      savedContent: '',
      saving: false,
      saveFailed: false,
      /** Whether the user has typed, so a board they only read shows no save status. */
      edited: false,
      saveContentLater: null as Debounced<[]> | null,
      boardCollectionRoute: {name: RouteName.BoardCollection} as RouteLocationRaw,
    };
  },

  computed: {
    ...mapStores(useBoardsStore),

    unsavedChanges(): boolean {
      return this.content !== this.savedContent;
    },

    saveStatus(): SaveStatus | null {
      if (this.saveFailed) {
        return {text: 'Could not save your writing.', textClass: 'text-error', icon: 'mdi-alert-circle-outline', color: 'error'};
      }

      if (this.unsavedChanges || this.saving) {
        return {text: 'Saving…', textClass: 'text-medium-emphasis', icon: 'mdi-cloud-upload-outline', color: 'medium-emphasis'};
      }

      return this.edited
        ? {text: 'All changes saved', textClass: 'text-medium-emphasis', icon: 'mdi-check-circle-outline', color: 'success'}
        : null;
    },
  },

  watch: {
    // The component is reused when navigating between boards, so reload whenever the id changes.
    id: {
      handler(): void {
        void this.load();
      },
      immediate: true,
    },
  },

  created(): void {
    this.saveContentLater = debounce(() => {
      void this.save();
    }, SAVE_DEBOUNCE_MS);
  },

  beforeUnmount(): void {
    // Nothing can be awaited here; the write is already on its way out by the time the view is gone.
    void this.flushSave();
  },

  methods: {
    async load(): Promise<void> {
      const id = this.id;
      this.loading = true;
      this.errorMessage = null;
      this.resetEditor();

      try {
        const board = await this.boardsStore.getBoard(id);

        // Ignore the response if the user has already navigated to another board.
        if (id === this.id) {
          this.board = board;
          this.content = board?.content ?? '';
          this.savedContent = this.content;
        }
      } catch (error) {
        console.error('Failed to load board', error);

        if (id === this.id) {
          this.board = null;
          this.errorMessage = 'Could not load this board. Please try again.';
        }
      } finally {
        if (id === this.id) {
          this.loading = false;
        }
      }
    },

    /**
     * Empties the editor for a different board. A write for the previous board may still be in
     * flight, but it targets another document, so it cannot clash with the board being opened.
     */
    resetEditor(): void {
      this.saveContentLater?.cancel();
      this.content = '';
      this.savedContent = '';
      this.saving = false;
      this.saveFailed = false;
      this.edited = false;
    },

    onContentInput(value: string): void {
      this.content = value;
      this.edited = true;
      this.saveFailed = false;
      this.saveContentLater?.();
    },

    /** Writes the board, one save at a time, until storage matches what is on screen. */
    async save(): Promise<void> {
      const id = this.id;

      if (this.saving || !this.unsavedChanges) {
        return;
      }

      this.saving = true;
      this.saveFailed = false;

      try {
        // Re-checked after every write, so text typed while one was in flight is saved as well.
        while (id === this.id && this.unsavedChanges) {
          const content = this.content;
          await this.boardsStore.saveBoardContent(id, content);
          this.savedContent = content;
        }
      } catch (error) {
        console.error('Failed to save board', error);
        this.saveFailed = true;
      } finally {
        this.saving = false;
      }
    },

    /** Saves now instead of waiting for the typing pause, e.g. when leaving the board. */
    async flushSave(): Promise<void> {
      this.saveContentLater?.cancel();
      await this.save();
    },

    saveNow(): void {
      void this.flushSave();
    },
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles/board';

.board-view {
  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
}

.board-sheet {
  @include board.surface(12px);

  position: relative;
  padding: 8px 24px 24px;

  // The sheen left on a board that has been wiped clean.
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(104deg, rgb(255 255 255 / 80%) 0%, rgb(255 255 255 / 0%) 45%);
    pointer-events: none;
  }

  &__writing {
    // Positioned so the writing sits above the sheen.
    position: relative;
    font-family: board.$marker-font;

    :deep(textarea) {
      font-family: inherit;
      font-size: 1.5rem;
      line-height: 2.5rem;
      color: board.$marker-ink;
      caret-color: board.$marker-ink;
    }

    :deep(textarea::placeholder) {
      font-family: inherit;
      color: board.$marker-ink;
      opacity: 0.35;
    }
  }
}
</style>
