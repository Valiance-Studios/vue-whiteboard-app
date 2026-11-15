<template>
  <v-menu
    v-model="open"
    :close-on-content-click="false"
    location="bottom start"
  >
    <template #activator="{props: menuProps}">
      <v-tooltip
        :text="summary"
        :disabled="open"
        location="top"
      >
        <template #activator="{props: tooltipProps}">
          <v-btn
            v-bind="mergeProps(menuProps, tooltipProps)"
            class="board-sort__button"
            icon="mdi-sort"
            aria-label="Sort boards"
            variant="outlined"
            rounded="lg"
          />
        </template>
      </v-tooltip>
    </template>

    <v-card
      class="board-sort__panel"
      rounded="lg"
    >
      <v-card-text>
        <v-radio-group
          v-model="field"
          label="Sort by"
          color="primary"
          density="compact"
          hide-details
        >
          <v-radio
            v-for="option in fieldOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </v-radio-group>

        <v-divider class="my-3" />

        <v-radio-group
          v-model="direction"
          label="Order"
          color="primary"
          density="compact"
          hide-details
        >
          <v-radio
            v-for="option in directionOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </v-radio-group>
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {BoardSort} from '@/utils/boardSort';

import {defineComponent, mergeProps} from 'vue';
import {BoardSortField, SortDirection} from '@/utils/boardSort';

interface Option<T> {
  value: T;
  label: string;
}

const FIELD_LABELS: Record<BoardSortField, string> = {
  [BoardSortField.Title]: 'Title',
  [BoardSortField.CreatedAt]: 'Date created',
  [BoardSortField.UpdatedAt]: 'Last updated',
};

/** What each direction means for a field, e.g. "A to Z" for titles. */
const DIRECTION_HINTS: Record<BoardSortField, Record<SortDirection, string>> = {
  [BoardSortField.Title]: {[SortDirection.Ascending]: 'A to Z', [SortDirection.Descending]: 'Z to A'},
  [BoardSortField.CreatedAt]: {[SortDirection.Ascending]: 'oldest first', [SortDirection.Descending]: 'newest first'},
  [BoardSortField.UpdatedAt]: {[SortDirection.Ascending]: 'oldest first', [SortDirection.Descending]: 'newest first'},
};

const DIRECTION_LABELS: Record<SortDirection, string> = {
  [SortDirection.Ascending]: 'Ascending',
  [SortDirection.Descending]: 'Descending',
};

export default defineComponent({
  name: 'BoardSortMenu',

  props: {
    modelValue: {
      type: Object as PropType<BoardSort>,
      required: true,
    },
  },

  emits: {
    'update:modelValue': (sort: BoardSort) => Boolean(sort),
  },

  data() {
    return {
      open: false,
      fieldOptions: Object.values(BoardSortField).map((value): Option<BoardSortField> => ({value, label: FIELD_LABELS[value]})),
    };
  },

  computed: {
    field: {
      get(): BoardSortField {
        return this.modelValue.field;
      },
      set(field: BoardSortField): void {
        this.$emit('update:modelValue', {...this.modelValue, field});
      },
    },

    direction: {
      get(): SortDirection {
        return this.modelValue.direction;
      },
      set(direction: SortDirection): void {
        this.$emit('update:modelValue', {...this.modelValue, direction});
      },
    },

    directionOptions(): Option<SortDirection>[] {
      return Object.values(SortDirection).map((value) => ({
        value,
        label: `${DIRECTION_LABELS[value]} (${DIRECTION_HINTS[this.field][value]})`,
      }));
    },

    /** E.g. "Sorted by last updated, newest first". */
    summary(): string {
      return `Sorted by ${FIELD_LABELS[this.field].toLowerCase()}, ${DIRECTION_HINTS[this.field][this.direction]}`;
    },
  },

  methods: {
    /** Combines the menu's and the tooltip's activator props, chaining handlers they share. */
    mergeProps,
  },
});
</script>

<style lang="scss" scoped>
// As tall as the outlined search field beside it, with the same border.
.board-sort__button {
  width: 56px;
  height: 56px;
  border-color: rgba(var(--v-theme-on-surface), 0.38);
  background: rgb(var(--v-theme-surface));
}

.board-sort__panel {
  min-width: 260px;
}
</style>
