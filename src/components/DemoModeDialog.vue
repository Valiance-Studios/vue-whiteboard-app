<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="close"
  >
    <v-card title="Demo Mode">
      <v-form
        ref="form"
        @submit.prevent="onSubmit"
      >
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Try the app without an account. Your boards are saved in this browser only.
          </p>

          <v-alert
            v-if="previousName"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            Starting as someone new deletes {{ previousName }}'s demo boards in this browser.
          </v-alert>

          <v-text-field
            v-model="name"
            label="Your name"
            :rules="nameRules"
            :counter="nameMaxLength"
            autocomplete="name"
            autofocus
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="close">
            Cancel
          </v-btn>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
          >
            Start
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import type {PropType} from 'vue';
import type {VForm} from 'vuetify/components';
import type {ValidationRule} from '@/utils/validation';

import {defineComponent} from 'vue';
import {DEMO_NAME_MAX_LENGTH} from '@/constants/demo';

/** Asks a new demo visitor for their name. */
export default defineComponent({
  name: 'DemoModeDialog',

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    /** The demo visitor being replaced, if any, whose boards starting will delete. */
    previousName: {
      type: String as PropType<string | null>,
      default: null,
    },
  },

  emits: {
    'update:modelValue': (open: boolean) => typeof open === 'boolean',
    'start': (name: string) => typeof name === 'string',
  },

  data() {
    return {
      name: '',
      nameMaxLength: DEMO_NAME_MAX_LENGTH,
      nameRules: [
        (value: string) => value.trim().length > 0 || 'Your name is required.',
        (value: string) => value.length <= DEMO_NAME_MAX_LENGTH || `Your name must be ${DEMO_NAME_MAX_LENGTH} characters or fewer.`,
      ] as ValidationRule[],
    };
  },

  watch: {
    modelValue(open: boolean): void {
      if (open) {
        this.name = '';
      }
    },
  },

  methods: {
    close(): void {
      this.$emit('update:modelValue', false);
    },

    async onSubmit(): Promise<void> {
      const form = this.$refs.form as VForm;
      const {valid} = await form.validate();

      if (!valid) {
        return;
      }

      this.$emit('start', this.name.trim());
      this.close();
    },
  },
});
</script>

<style lang="scss" scoped>
</style>
