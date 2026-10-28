<template>
  <v-card
    :to="boardRoute"
    class="board-card"
    rounded="xl"
    elevation="0"
    border
  >
    <div class="board-card__board">
      <p
        v-if="board.content"
        class="board-card__preview ma-0"
      >
        {{ board.content }}
      </p>
      <p
        v-else
        class="board-card__empty"
      >
        Empty board
      </p>
    </div>

    <div class="board-card__details">
      <span class="board-card__title">{{ board.title }}</span>
      <span
        class="text-body-2 text-medium-emphasis"
        :title="updatedAtFull"
      >
        Updated {{ updatedAt }}
      </span>
    </div>
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
@use '@/styles/board';

.board-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 12px 16px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 24px rgb(28 35 48 / 12%);
  }

  // The lift replaces Vuetify's grey hover overlay, which would dull the white card.
  :deep(.v-card__overlay) {
    display: none;
  }

  &:focus-visible {
    outline: 3px solid rgb(var(--v-theme-primary));
    outline-offset: 3px;
  }

  &__board {
    @include board.surface(6px);

    height: 156px;
    padding: 12px 16px;
    border-radius: 10px;
  }

  &__preview {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    overflow: hidden;
    white-space: pre-line;
    font-family: board.$marker-font;
    font-size: 1.2rem;
    line-height: 1.75rem;
    color: board.$marker-ink;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-style: italic;
    opacity: 0.6;
  }

  &__details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 4px;
  }

  &__title {
    overflow: hidden;
    font-size: 1.05rem;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
</style>
