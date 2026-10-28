<template>
  <v-dialog
    :model-value="modelValue"
    :persistent="saving"
    max-width="480"
    @update:model-value="close"
  >
    <v-card title="New board">
      <v-form
        ref="form"
        @submit.prevent="onSubmit"
      >
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

          <v-text-field
            v-model="title"
            label="Title"
            :rules="titleRules"
            :counter="titleMaxLength"
            :disabled="saving"
            autofocus
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="saving"
            @click="close"
          >
            Cancel
          </v-btn>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            :loading="saving"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import type {VForm} from 'vuetify/components';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {BOARD_TITLE_MAX_LENGTH} from '@/constants/board';
import {useBoardsStore} from '@/stores/boards';

type ValidationRule = (value: string) => true | string;

export default defineComponent({
  name: 'CreateBoardDialog',

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  emits: {
    'update:modelValue': (open: boolean) => typeof open === 'boolean',
    'created': (id: string) => typeof id === 'string',
  },

  data() {
    return {
      title: '',
      saving: false,
      errorMessage: null as string | null,
      titleMaxLength: BOARD_TITLE_MAX_LENGTH,
      titleRules: [
        (value: string) => value.trim().length > 0 || 'Title is required.',
        (value: string) => value.length <= BOARD_TITLE_MAX_LENGTH || `Title must be ${BOARD_TITLE_MAX_LENGTH} characters or fewer.`,
      ] as ValidationRule[],
    };
  },

  computed: {
    ...mapStores(useBoardsStore),
  },

  watch: {
    modelValue(open: boolean): void {
      if (open) {
        this.title = '';
        this.errorMessage = null;
      }
    },
  },

  methods: {
    close(): void {
      if (!this.saving) {
        this.$emit('update:modelValue', false);
      }
    },

    async onSubmit(): Promise<void> {
      const form = this.$refs.form as VForm;
      const {valid} = await form.validate();

      if (!valid) {
        return;
      }

      this.saving = true;
      this.errorMessage = null;

      try {
        const id = await this.boardsStore.createBoard({title: this.title});
        this.$emit('created', id);
        this.$emit('update:modelValue', false);
      } catch (error) {
        console.error('Failed to create board', error);
        this.errorMessage = 'Could not create the board. Please try again.';
      } finally {
        this.saving = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
</style>
