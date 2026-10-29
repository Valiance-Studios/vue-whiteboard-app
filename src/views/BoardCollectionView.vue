<template>
  <v-container class="py-8">
    <div class="collection-header mb-7">
      <div class="collection-header__title">
        <h1 class="text-h4 font-weight-bold ma-0">
          My Boards
        </h1>
        <p
          v-if="boardCountText"
          class="text-body-2 text-medium-emphasis ma-0"
        >
          {{ boardCountText }}
        </p>
      </div>

      <v-text-field
        v-model="searchTerm"
        class="collection-header__search"
        aria-label="Search by title"
        placeholder="Search by title"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        bg-color="surface"
        rounded="lg"
        hide-details
        clearable
      />
    </div>

    <v-progress-linear
      :active="boardsStore.loading"
      indeterminate
      color="primary"
      class="mb-4"
    />

    <v-alert
      v-if="boardsStore.error"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ boardsStore.error }}
      <template #append>
        <v-btn
          variant="text"
          @click="load"
        >
          Retry
        </v-btn>
      </template>
    </v-alert>

    <div
      v-if="boardsStore.visibleBoards.length > 0"
      class="board-grid"
    >
      <!-- Creating a board lives with the boards. Hidden while searching, so only matches show. -->
      <button
        v-if="!isSearching"
        type="button"
        class="new-board-tile"
        @click="createDialogOpen = true"
      >
        <span class="new-board-tile__icon">
          <v-icon icon="mdi-plus" />
        </span>
        New board
      </button>
      <board-card
        v-for="board in boardsStore.visibleBoards"
        :key="board.id"
        :board="board"
        @rename="startRename"
        @delete="startDelete"
      />
    </div>

    <v-empty-state
      v-else-if="showEmptyState"
      :icon="isSearching ? 'mdi-magnify-close' : 'mdi-draw'"
      :title="isSearching ? 'No matching boards' : 'No boards yet'"
      :text="emptyStateText"
    >
      <template
        v-if="!isSearching"
        #actions
      >
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="createDialogOpen = true"
        >
          New board
        </v-btn>
      </template>
    </v-empty-state>

    <board-title-dialog
      v-model="createDialogOpen"
      heading="New board"
      action-label="Create"
      :save="createBoard"
      failure-message="Could not create the board. Please try again."
    />

    <board-title-dialog
      v-model="renameDialogOpen"
      heading="Rename board"
      action-label="Rename"
      :initial-title="targetBoard?.title ?? ''"
      :save="renameBoard"
      failure-message="Could not rename the board. Please try again."
    />

    <delete-board-dialog
      v-model="deleteDialogOpen"
      :board-title="targetBoard?.title ?? ''"
      :remove="deleteBoard"
    />
  </v-container>
</template>

<script lang="ts">
import type {Board} from '@/types/board';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import BoardCard from '@/components/BoardCard.vue';
import BoardTitleDialog from '@/components/BoardTitleDialog.vue';
import DeleteBoardDialog from '@/components/DeleteBoardDialog.vue';
import {RouteName} from '@/router/routes';
import {useBoardsStore} from '@/stores/boards';
import {toSearchable} from '@/utils/search';

export default defineComponent({
  name: 'BoardCollectionView',

  components: {
    BoardCard,
    BoardTitleDialog,
    DeleteBoardDialog,
  },

  data() {
    return {
      createDialogOpen: false,
      renameDialogOpen: false,
      deleteDialogOpen: false,
      /** The board being renamed or deleted. Kept after its dialog closes, so the title stays put while it fades. */
      targetBoard: null as Board | null,
    };
  },

  computed: {
    ...mapStores(useBoardsStore),

    searchTerm: {
      get(): string {
        return this.boardsStore.searchTerm;
      },
      /** The field's clear button sets `null`. */
      set(term: string | null): void {
        this.boardsStore.searchTerm = term ?? '';
      },
    },

    isSearching(): boolean {
      return toSearchable(this.boardsStore.searchTerm) !== '';
    },

    /** E.g. "6 boards", or "2 of 6 boards" while searching. Empty until there are boards. */
    boardCountText(): string {
      const total = this.boardsStore.boards.length;

      if (total === 0) {
        return '';
      }

      const boards = total === 1 ? 'board' : 'boards';

      return this.isSearching ? `${this.boardsStore.visibleBoards.length} of ${total} ${boards}` : `${total} ${boards}`;
    },

    showEmptyState(): boolean {
      return !this.boardsStore.loading && !this.boardsStore.error;
    },

    emptyStateText(): string {
      return this.isSearching
        ? `No board titles contain "${this.boardsStore.searchTerm.trim()}".`
        : 'Create a board to start writing.';
    },
  },

  created(): void {
    this.load();
  },

  methods: {
    load(): void {
      void this.boardsStore.load();
    },

    async createBoard(title: string): Promise<void> {
      const id = await this.boardsStore.createBoard({title});
      await this.$router.push({name: RouteName.Board, params: {id}});
    },

    startRename(board: Board): void {
      this.targetBoard = board;
      this.renameDialogOpen = true;
    },

    startDelete(board: Board): void {
      this.targetBoard = board;
      this.deleteDialogOpen = true;
    },

    async renameBoard(title: string): Promise<void> {
      if (this.targetBoard) {
        await this.boardsStore.renameBoard(this.targetBoard.id, title);
      }
    },

    async deleteBoard(): Promise<void> {
      if (this.targetBoard) {
        await this.boardsStore.deleteBoard(this.targetBoard.id);
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.collection-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;

  // The count sits beside the heading, sharing its baseline.
  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    margin-right: auto;
  }

  &__search {
    flex: 0 1 400px;
    min-width: 240px;
  }
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
}

// As tall as the cards beside it, which the grid row stretches it to; the minimum covers a row of its own.
.new-board-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 236px;
  border: 2px dashed rgba(var(--v-theme-on-surface), 0.25);
  border-radius: 24px;
  background: transparent;
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    border-color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.06);
  }

  &:focus-visible {
    outline: 3px solid rgb(var(--v-theme-primary));
    outline-offset: 3px;
  }

  // On phones, where the grid is one column, a full card's height would push the boards off screen.
  @media (max-width: 599.98px) {
    flex-direction: row;
    min-height: 72px;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
    box-shadow: 0 2px 6px rgba(31, 59, 115, 0.3);
  }
}
</style>
