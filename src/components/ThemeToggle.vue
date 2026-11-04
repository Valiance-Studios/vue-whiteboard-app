<template>
  <v-btn
    :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
    variant="text"
    density="comfortable"
    :aria-label="label"
    :title="label"
    @click="toggle"
  />
</template>

<script lang="ts">
import type {ThemeChoice} from '@/theme/themePreference';

import {defineComponent} from 'vue';
import vuetify from '@/plugins/vuetify';

/** Shows the current theme, and reports the opposite one when clicked. */
export default defineComponent({
  name: 'ThemeToggle',

  emits: {
    change: (choice: ThemeChoice) => Boolean(choice),
  },

  computed: {
    isDark(): boolean {
      return vuetify.theme.global.current.value.dark;
    },

    label(): string {
      return this.isDark ? 'Switch to light mode' : 'Switch to dark mode';
    },
  },

  methods: {
    toggle(): void {
      this.$emit('change', this.isDark ? 'light' : 'dark');
    },
  },
});
</script>

<style lang="scss" scoped>
</style>
