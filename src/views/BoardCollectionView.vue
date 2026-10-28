<template>
  <v-container>
    <div class="collection-header mb-6">
      <h1 class="text-h4">
        My Boards
      </h1>

      <v-text-field
        v-model="searchTerm"
        class="collection-header__search"
        label="Search by title"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="comfortable"
        hide-details
        clearable
      />

      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
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

    <v-row v-if="boardsStore.visibleBoards.length > 0">
      <v-col
        v-for="board in boardsStore.visibleBoards"
        :key="board.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <board-card :board="board" />
      </v-col>
    </v-row>

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
  align-items: center;
  gap: 16px;

  &__search {
    flex: 1 1 240px;
  }
}
</style>
