<template>
  <v-card
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
        <span
          v-for="(segment, index) in previewSegments"
          :key="index"
          :style="{color: segment.color}"
        >{{ segment.text }}</span>
      </p>
      <p
        v-else
        class="board-card__empty"
      >
        Empty board
      </p>
    </div>

    <div class="board-card__details">
      <div class="board-card__text">
        <router-link
          :to="boardRoute"
          class="board-card__title"
        >
          {{ board.title }}
        </router-link>
        <span
          class="text-body-2 text-medium-emphasis"
          :title="updatedAtFull"
        >
          Updated {{ updatedAt }}
        </span>
      </div>

      <div class="board-card__actions">
        <v-btn
          icon="mdi-pencil-outline"
          variant="text"
          size="small"
          :aria-label="`Rename ${board.title}`"
          @click="$emit('rename', board)"
        />
        <v-btn
          icon="mdi-trash-can-outline"
          variant="text"
          size="small"
          :aria-label="`Delete ${board.title}`"
          @click="$emit('delete', board)"
        />
      </div>
    </div>
  </v-card>
</template>

<script lang="ts">
import type {Board} from '@/types/board';
import type {PropType} from 'vue';
import type {InkSegment} from '@/utils/inks';
import type {RouteLocationRaw} from 'vue-router';

import {defineComponent} from 'vue';
import {markerColor} from '@/constants/markers';
import {RouteName} from '@/router/routes';
import {formatDate, formatDateTime} from '@/utils/date';
import {inkSegments} from '@/utils/inks';

/** Comfortably more than the four lines the preview shows, so a long board does not render in full. */
const PREVIEW_LENGTH = 400;

interface PreviewSegment extends InkSegment {
  color: string;
}

export default defineComponent({
  name: 'BoardCard',

  props: {
    board: {
      type: Object as PropType<Board>,
      required: true,
    },
  },

  emits: {
    rename: (board: Board) => Boolean(board),
    delete: (board: Board) => Boolean(board),
  },

  computed: {
    boardRoute(): RouteLocationRaw {
      return {name: RouteName.Board, params: {id: this.board.id}};
    },

    previewSegments(): PreviewSegment[] {
      return inkSegments(this.board.content.slice(0, PREVIEW_LENGTH), this.board.inks)
        .map((segment) => ({...segment, color: markerColor(segment.ink)}));
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
  // The title link is stretched over the whole card (see `__title`), so the card opens the board
  // without being a link itself, which could not hold the action buttons.
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 12px 16px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 24px rgb(28 35 48 / 12%);
  }

  &:has(.board-card__title:focus-visible) {
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
    align-items: center;
    gap: 8px;
    padding: 0 0 0 4px;
  }

  &__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__title {
    overflow: hidden;
    font-size: 1.05rem;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: inherit;
    text-decoration: none;
    outline: none;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 1;
    }
  }

  // Above the stretched link, so the buttons get their own clicks.
  &__actions {
    position: relative;
    z-index: 2;
    display: flex;
    flex-shrink: 0;
  }
}
</style>
