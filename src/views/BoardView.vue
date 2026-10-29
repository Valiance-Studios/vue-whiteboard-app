<template>
  <v-container class="board-view">
    <v-skeleton-loader
      v-if="loading"
      type="heading"
      max-width="480"
      class="mb-4"
    />

    <template v-else-if="board">
      <v-btn
        :to="boardCollectionRoute"
        variant="text"
        color="primary"
        prepend-icon="mdi-chevron-left"
        class="board-view__back mb-2"
      >
        My Boards
      </v-btn>

      <div class="board-view__header mb-4">
        <v-text-field
          v-if="editingTitle"
          v-model="titleDraft"
          class="board-view__title-field"
          aria-label="Board title"
          variant="outlined"
          density="compact"
          :counter="titleMaxLength"
          :error-messages="titleError ?? undefined"
          :loading="renaming"
          :readonly="renaming"
          hide-details="auto"
          autofocus
          @keydown.enter.prevent="saveTitle"
          @keydown.esc.prevent="cancelTitleEdit"
          @blur="saveTitle"
        />
        <h1
          v-else
          class="text-h4 ma-0"
        >
          <button
            type="button"
            class="board-view__title"
            title="Rename board"
            @click="startTitleEdit"
          >
            {{ board.title }}
            <v-icon
              icon="mdi-pencil-outline"
              size="x-small"
              class="board-view__title-icon"
            />
          </button>
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
            v-if="saveFailed || strokeSaveFailed"
            variant="text"
            size="small"
            density="comfortable"
            @click="saveNow"
          >
            Retry
          </v-btn>
        </div>

        <v-btn
          icon="mdi-trash-can-outline"
          variant="text"
          :aria-label="`Delete ${board.title}`"
          :class="{'board-view__delete--alone': !saveStatus}"
          @click="deleteDialogOpen = true"
        />
      </div>

      <delete-board-dialog
        v-model="deleteDialogOpen"
        :board-title="board.title"
        :remove="deleteBoard"
      />

      <whiteboard-sheet
        :key="board.id"
        :writing="board"
        :strokes="strokes"
        @change="onWritingChange"
        @sketch="onSketch"
      />
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
import type {SketchChange} from '@/sketch/SketchHistory';
import type {Board, BoardWriting} from '@/types/board';
import type {Stroke} from '@/types/sketch';
import type {Debounced} from '@/utils/debounce';
import type {RouteLocationRaw} from 'vue-router';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import DeleteBoardDialog from '@/components/DeleteBoardDialog.vue';
import WhiteboardSheet from '@/components/WhiteboardSheet.vue';
import {debounce} from '@/utils/debounce';
import {isSameWriting} from '@/utils/inks';
import {boardTitleRules, firstValidationError} from '@/utils/validation';
import {BOARD_MIN_SAVE_INTERVAL_MS, BOARD_TITLE_MAX_LENGTH} from '@/constants/board';
import {RouteName} from '@/router/routes';
import {useBoardsStore} from '@/stores/boards';

/** How long typing pauses before the board is saved. */
const SAVE_DEBOUNCE_MS = 800;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function emptyWriting(): BoardWriting {
  return {content: '', inks: []};
}

/** What the header tells the user about the state of their writing. */
interface SaveStatus {
  text: string;
  textClass: string;
  icon: string;
  color: string;
}

export default defineComponent({
  name: 'BoardView',

  components: {
    DeleteBoardDialog,
    WhiteboardSheet,
  },

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
      writing: emptyWriting(),
      /** The writing as last written to storage; anything else means there is work to save. */
      savedWriting: emptyWriting(),
      /** Whether the board has strokes now, and as last saved on the board for the collection's sketch icon. */
      hasSketches: false,
      savedHasSketches: false,
      /** The strokes as loaded, which the sheet starts from. */
      strokes: [] as Stroke[],
      /** Stroke changes not yet saved, oldest first. They are saved one at a time, in order. */
      strokeQueue: [] as SketchChange[],
      /** The stroke save in progress, if any. */
      runningStrokeSave: null as Promise<void> | null,
      strokeSaveFailed: false,
      /** The save in progress, which anything else writing the board waits for. */
      runningSave: null as Promise<void> | null,
      saveFailed: false,
      /** Whether the user has typed, so a board they only read shows no save status. */
      edited: false,
      saveWritingLater: null as Debounced<[]> | null,
      /** When the last write was acknowledged, in epoch ms, so the next one keeps the gap the rules require. */
      lastSavedAt: 0,
      boardCollectionRoute: {name: RouteName.BoardCollection} as RouteLocationRaw,
      editingTitle: false,
      titleDraft: '',
      titleError: null as string | null,
      renaming: false,
      titleMaxLength: BOARD_TITLE_MAX_LENGTH,
      deleteDialogOpen: false,
    };
  },

  computed: {
    ...mapStores(useBoardsStore),

    saving(): boolean {
      return this.runningSave !== null;
    },

    unsavedChanges(): boolean {
      return !isSameWriting(this.writing, this.savedWriting) || this.hasSketches !== this.savedHasSketches;
    },

    saveStatus(): SaveStatus | null {
      if (this.saveFailed) {
        return {text: 'Could not save your writing.', textClass: 'text-error', icon: 'mdi-alert-circle-outline', color: 'error'};
      }

      if (this.strokeSaveFailed) {
        return {text: 'Could not save your sketch.', textClass: 'text-error', icon: 'mdi-alert-circle-outline', color: 'error'};
      }

      if (this.unsavedChanges || this.saving || this.strokeQueue.length > 0) {
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
    this.saveWritingLater = debounce(() => {
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
          // Strokes are only looked for on a board that exists and is the user's.
          const strokes = board ? await this.boardsStore.getStrokes(id) : [];

          if (id === this.id) {
            this.board = board;
            this.writing = board ? {content: board.content, inks: board.inks} : emptyWriting();
            this.savedWriting = this.writing;
            this.strokes = strokes;
            this.hasSketches = board?.hasSketches ?? false;
            this.savedHasSketches = this.hasSketches;
          }
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
      this.saveWritingLater?.cancel();
      this.writing = emptyWriting();
      this.savedWriting = this.writing;
      this.runningSave = null;
      this.saveFailed = false;
      this.strokes = [];
      this.strokeQueue = [];
      this.runningStrokeSave = null;
      this.strokeSaveFailed = false;
      this.hasSketches = false;
      this.savedHasSketches = false;
      this.editingTitle = false;
      this.deleteDialogOpen = false;
      this.edited = false;
      this.lastSavedAt = 0;
    },

    onWritingChange(writing: BoardWriting): void {
      this.writing = writing;
      this.edited = true;
      this.saveFailed = false;
      this.saveWritingLater?.();
    },

    /**
     * Writes the board, one save at a time, until storage matches what is on screen. Joins the save
     * already running, if any, so awaiting this always waits for the board to be saved.
     */
    save(): Promise<void> {
      if (!this.runningSave && this.unsavedChanges) {
        const run: Promise<void> = this.writeUntilSaved().finally(() => {
          // A save for a board left behind finishes after the next board's save may have started.
          if (this.runningSave === run) {
            this.runningSave = null;
          }
        });
        this.runningSave = run;
      }

      return this.runningSave ?? Promise.resolve();
    },

    async writeUntilSaved(): Promise<void> {
      const id = this.id;
      this.saveFailed = false;

      try {
        // Re-checked after every write, so text typed while one was in flight is saved as well.
        while (id === this.id && this.unsavedChanges) {
          await this.waitForSaveInterval();

          if (id !== this.id) {
            break;
          }

          const writing = this.writing;
          const hasSketches = this.hasSketches;
          await this.boardsStore.saveBoardWriting(id, {...writing, hasSketches});
          this.savedWriting = writing;
          this.savedHasSketches = hasSketches;
          this.lastSavedAt = Date.now();
        }
      } catch (error) {
        console.error('Failed to save board', error);
        this.saveFailed = true;
      }
    },

    /**
     * The rules reject writes to a board that come too close together, e.g. text typed during a save,
     * or a rename straight after one. Clamped, because `setTimeout` wraps a large negative delay round
     * to a long positive one.
     */
    waitForSaveInterval(): Promise<void> {
      return wait(Math.max(0, this.lastSavedAt + BOARD_MIN_SAVE_INTERVAL_MS - Date.now()));
    },

    /** Saves now instead of waiting for the typing pause, e.g. when leaving the board. */
    async flushSave(): Promise<void> {
      this.saveWritingLater?.cancel();
      await Promise.all([this.save(), this.saveStrokes()]);
    },

    /** Saves strokes straight away, and the board's sketch flag with the next save of the writing. */
    onSketch(changes: SketchChange[], strokeCount: number): void {
      this.queueStrokeChanges(changes);
      this.hasSketches = strokeCount > 0;
      this.edited = true;
      void this.saveStrokes();
      this.saveWritingLater?.();
    },

    queueStrokeChanges(changes: SketchChange[]): void {
      // While a save runs, the first change in the queue is the one being written.
      const firstWaiting = this.runningStrokeSave ? 1 : 0;

      for (const change of changes) {
        // A stroke removed before its addition was saved, e.g. drawn and undone, need not be saved at all.
        const waitingAdd = change.type === 'remove'
          ? this.strokeQueue.findIndex((queued, index) => index >= firstWaiting && queued.type === 'add' && queued.stroke.id === change.stroke.id)
          : -1;

        if (waitingAdd === -1) {
          this.strokeQueue.push(change);
        } else {
          this.strokeQueue.splice(waitingAdd, 1);
        }
      }
    },

    /** Saves queued stroke changes in order, one at a time. Joins the save already running, like `save`. */
    saveStrokes(): Promise<void> {
      if (!this.runningStrokeSave && this.strokeQueue.length > 0) {
        const run: Promise<void> = this.writeStrokes().finally(() => {
          if (this.runningStrokeSave === run) {
            this.runningStrokeSave = null;
          }
        });
        this.runningStrokeSave = run;
      }

      return this.runningStrokeSave ?? Promise.resolve();
    },

    async writeStrokes(): Promise<void> {
      const id = this.id;
      this.strokeSaveFailed = false;

      try {
        // A failed change stays first in the queue, so Retry picks up where saving stopped.
        while (id === this.id && this.strokeQueue.length > 0) {
          const change = this.strokeQueue[0];

          if (change.type === 'add') {
            await this.boardsStore.addStroke(id, change.stroke);
          } else {
            await this.boardsStore.removeStroke(id, change.stroke.id);
          }

          this.strokeQueue.shift();
        }
      } catch (error) {
        console.error('Failed to save sketch', error);
        this.strokeSaveFailed = true;
      }
    },

    saveNow(): void {
      this.strokeSaveFailed = false;
      void this.flushSave();
    },

    startTitleEdit(): void {
      this.titleDraft = this.board?.title ?? '';
      this.titleError = null;
      this.editingTitle = true;
    },

    cancelTitleEdit(): void {
      this.editingTitle = false;
    },

    /** Saves the edited title on Enter or blur. An invalid or failed title keeps the field open. */
    async saveTitle(): Promise<void> {
      const board = this.board;

      if (!this.editingTitle || this.renaming || !board) {
        return;
      }

      const title = this.titleDraft.trim();

      if (title === board.title) {
        this.editingTitle = false;

        return;
      }

      this.titleError = firstValidationError(boardTitleRules, this.titleDraft);

      if (this.titleError) {
        return;
      }

      this.renaming = true;

      try {
        // A rename is a write too, so it waits for pending writing and keeps the rules' gap after it.
        await this.flushSave();
        await this.waitForSaveInterval();
        await this.boardsStore.renameBoard(board.id, title);
        this.lastSavedAt = Date.now();
        board.title = title;
        this.editingTitle = false;
      } catch (error) {
        console.error('Failed to rename board', error);
        this.titleError = 'Could not rename the board. Please try again.';
      } finally {
        this.renaming = false;
      }
    },

    async deleteBoard(): Promise<void> {
      const id = this.id;
      // Nothing is left to save on a board being deleted; saves already running are let finish first.
      // Its strokes are deleted along with it.
      this.saveWritingLater?.cancel();
      this.savedWriting = this.writing;
      this.savedHasSketches = this.hasSketches;
      this.strokeQueue = [];
      await Promise.all([this.runningSave, this.runningStrokeSave]);

      await this.boardsStore.deleteBoard(id);
      await this.$router.replace(this.boardCollectionRoute);
    },
  },
});
</script>

<style lang="scss" scoped>
.board-view {
  &__back {
    margin-left: -12px;
  }

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

  // Keeps the delete button across from the title when there is no save status to push it there.
  &__delete--alone {
    margin-left: auto;
  }

  &__title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
    margin: 0 -4px;
    border: 0;
    border-radius: 6px;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: text;

    &:hover,
    &:focus-visible {
      background: rgba(var(--v-theme-on-surface), 0.06);
    }

    &:focus-visible {
      outline: 3px solid rgb(var(--v-theme-primary));
    }
  }

  // Shown on hover and focus, hinting that the title can be edited.
  &__title-icon {
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &__title:hover &__title-icon,
  &__title:focus-visible &__title-icon {
    opacity: 0.6;
  }

  // Written at the heading's size, so the title does not shrink when clicked.
  &__title-field {
    flex: 1 1 320px;
    max-width: 640px;

    :deep(input) {
      font-size: 2.125rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
  }
}
</style>
