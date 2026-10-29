<template>
  <v-dialog
    :model-value="modelValue"
    :persistent="saving"
    max-width="480"
    @update:model-value="close"
  >
    <v-card :title="heading">
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
            {{ actionLabel }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {VForm} from 'vuetify/components';

import {defineComponent} from 'vue';
import {BOARD_TITLE_MAX_LENGTH} from '@/constants/board';
import {boardTitleRules} from '@/utils/validation';

/** Asks for a board title, for creating or renaming a board. `save` does the work; a failure keeps the dialog open. */
export default defineComponent({
  name: 'BoardTitleDialog',

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    heading: {
      type: String,
      required: true,
    },
    actionLabel: {
      type: String,
      required: true,
    },
    /** The title the field starts with each time the dialog opens. */
    initialTitle: {
      type: String,
      default: '',
    },
    save: {
      type: Function as PropType<(title: string) => Promise<void>>,
      required: true,
    },
    failureMessage: {
      type: String,
      required: true,
    },
  },

  emits: {
    'update:modelValue': (open: boolean) => typeof open === 'boolean',
  },

  data() {
    return {
      title: '',
      saving: false,
      errorMessage: null as string | null,
      titleMaxLength: BOARD_TITLE_MAX_LENGTH,
      titleRules: boardTitleRules,
    };
  },

  watch: {
    modelValue(open: boolean): void {
      if (open) {
        this.title = this.initialTitle;
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
        await this.save(this.title);
        this.$emit('update:modelValue', false);
      } catch (error) {
        console.error(this.failureMessage, error);
        this.errorMessage = this.failureMessage;
      } finally {
        this.saving = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
</style>
