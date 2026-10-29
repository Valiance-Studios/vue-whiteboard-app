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

      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        size="large"
        rounded="lg"
        @click="createDialogOpen = true"
      >
        New board
      </v-btn>
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
      <board-card
        v-for="board in boardsStore.visibleBoards"
        :key="board.id"
        :board="board"
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
          Create your first board
        </v-btn>
      </template>
    </v-empty-state>

    <create-board-dialog
      v-model="createDialogOpen"
      @created="openBoard"
    />
  </v-container>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import BoardCard from '@/components/BoardCard.vue';
import CreateBoardDialog from '@/components/CreateBoardDialog.vue';
import {RouteName} from '@/router/routes';
import {useBoardsStore} from '@/stores/boards';
import {toSearchable} from '@/utils/search';

export default defineComponent({
  name: 'BoardCollectionView',

  components: {
    BoardCard,
    CreateBoardDialog,
  },

  data() {
    return {
      createDialogOpen: false,
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

    openBoard(id: string): void {
      void this.$router.push({name: RouteName.Board, params: {id}});
    },
  },
});
</script>

<style lang="scss" scoped>
.collection-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px 24px;

  &__title {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-right: auto;
  }

  &__search {
    flex: 0 1 360px;
    min-width: 220px;
  }
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
}
</style>
