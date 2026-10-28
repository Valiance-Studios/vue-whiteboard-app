<template>
  <v-container>
    <div class="collection-header mb-6">
      <h1 class="text-h4">
        My Boards
      </h1>

      <v-text-field
        v-model="searchInput"
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
          @click="search"
        >
          Retry
        </v-btn>
      </template>
    </v-alert>

    <v-row v-if="boardsStore.boards.length > 0">
      <v-col
        v-for="board in boardsStore.boards"
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
      :icon="boardsStore.searchTerm ? 'mdi-magnify-close' : 'mdi-draw'"
      :title="boardsStore.searchTerm ? 'No matching boards' : 'No boards yet'"
      :text="emptyStateText"
    >
      <template
        v-if="!boardsStore.searchTerm"
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
import {debounce} from '@/utils/debounce';

const SEARCH_DEBOUNCE_MS = 300;

export default defineComponent({
  name: 'BoardCollectionView',

  components: {
    BoardCard,
    CreateBoardDialog,
  },

  data() {
    return {
      /** `null` when the field is cleared. */
      searchInput: '' as string | null,
      createDialogOpen: false,
      debouncedSearch: debounce(() => this.search(), SEARCH_DEBOUNCE_MS),
    };
  },

  computed: {
    ...mapStores(useBoardsStore),

    showEmptyState(): boolean {
      return !this.boardsStore.loading && !this.boardsStore.error;
    },

    emptyStateText(): string {
      return this.boardsStore.searchTerm
        ? `No board titles start with "${this.boardsStore.searchTerm}".`
        : 'Create a board to start writing.';
    },
  },

  watch: {
    searchInput(): void {
      this.debouncedSearch();
    },
  },

  created(): void {
    this.search();
  },

  beforeUnmount(): void {
    this.debouncedSearch.cancel();
  },

  methods: {
    search(): void {
      this.debouncedSearch.cancel();
      void this.boardsStore.search(this.searchInput ?? '');
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
