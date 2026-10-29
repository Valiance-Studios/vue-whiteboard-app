<template>
  <v-dialog
    :model-value="modelValue"
    :persistent="deleting"
    max-width="480"
    @update:model-value="close"
  >
    <v-card :title="`Delete “${boardTitle}”?`">
      <v-card-text>
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ errorMessage }}
        </v-alert>

        The board and everything written on it will be deleted. This cannot be undone.
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="deleting"
          @click="close"
        >
          Cancel
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="deleting"
          @click="onDelete"
        >
          Delete
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import type {PropType} from 'vue';

import {defineComponent} from 'vue';

/** Confirms deleting a board. `remove` does the work; a failure keeps the dialog open. */
export default defineComponent({
  name: 'DeleteBoardDialog',

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    boardTitle: {
      type: String,
      required: true,
    },
    remove: {
      type: Function as PropType<() => Promise<void>>,
      required: true,
    },
  },

  emits: {
    'update:modelValue': (open: boolean) => typeof open === 'boolean',
  },

  data() {
    return {
      deleting: false,
      errorMessage: null as string | null,
    };
  },

  watch: {
    modelValue(open: boolean): void {
      if (open) {
        this.errorMessage = null;
      }
    },
  },

  methods: {
    close(): void {
      if (!this.deleting) {
        this.$emit('update:modelValue', false);
      }
    },

    async onDelete(): Promise<void> {
      this.deleting = true;
      this.errorMessage = null;

      try {
        await this.remove();
        this.$emit('update:modelValue', false);
      } catch (error) {
        console.error('Failed to delete board', error);
        this.errorMessage = 'Could not delete the board. Please try again.';
      } finally {
        this.deleting = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
</style>
