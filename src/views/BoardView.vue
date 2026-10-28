<template>
  <v-container>
    <v-skeleton-loader
      v-if="loading"
      type="heading"
      max-width="480"
      class="mb-4"
    />

    <template v-else-if="board">
      <h1 class="text-h4 mb-4">
        {{ board.title }}
      </h1>
      <!-- TODO: dry-erase styled v-sheet with debounced auto-saving textarea. -->
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
import type {RouteLocationRaw} from 'vue-router';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {RouteName} from '@/router/routes';
import {useBoardsStore} from '@/stores/boards';

export default defineComponent({
  name: 'BoardView',

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
      boardCollectionRoute: {name: RouteName.BoardCollection} as RouteLocationRaw,
    };
  },

  computed: {
    ...mapStores(useBoardsStore),
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

  methods: {
    async load(): Promise<void> {
      const id = this.id;
      this.loading = true;
      this.errorMessage = null;

      try {
        const board = await this.boardsStore.getBoard(id);

        // Ignore the response if the user has already navigated to another board.
        if (id === this.id) {
          this.board = board;
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
  },
});
</script>

<style lang="scss" scoped>
</style>
