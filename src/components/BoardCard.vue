<template>
  <v-card
    :to="boardRoute"
    class="board-card"
    variant="outlined"
    height="100%"
  >
    <v-card-title class="text-truncate">
      {{ board.title }}
    </v-card-title>

    <v-card-subtitle :title="updatedAtFull">
      Updated {{ updatedAt }}
    </v-card-subtitle>

    <v-card-text>
      <p
        v-if="board.content"
        class="board-card__preview"
      >
        {{ board.content }}
      </p>
      <p
        v-else
        class="board-card__preview board-card__preview--empty"
      >
        Empty board
      </p>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import type {Board} from '@/types/board';
import type {PropType} from 'vue';
import type {RouteLocationRaw} from 'vue-router';

import {defineComponent} from 'vue';
import {RouteName} from '@/router/routes';
import {formatDate, formatDateTime} from '@/utils/date';

export default defineComponent({
  name: 'BoardCard',

  props: {
    board: {
      type: Object as PropType<Board>,
      required: true,
    },
  },

  computed: {
    boardRoute(): RouteLocationRaw {
      return {name: RouteName.Board, params: {id: this.board.id}};
    },

    updatedAt(): string {
      return formatDate(this.board.updatedAt.time);
    },

    updatedAtFull(): string {
      return formatDateTime(this.board.updatedAt.time);
    },
  },
});
</script>

<style lang="scss" scoped>
.board-card__preview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  overflow: hidden;
  white-space: pre-line;

  &--empty {
    font-style: italic;
    opacity: 0.6;
  }
}
</style>
