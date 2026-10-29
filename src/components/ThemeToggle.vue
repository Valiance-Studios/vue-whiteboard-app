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
import {saveThemeChoice} from '@/theme/themePreference';

/** Switches between the light and dark themes and remembers the choice in this browser. */
export default defineComponent({
  name: 'ThemeToggle',

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
      const choice: ThemeChoice = this.isDark ? 'light' : 'dark';
      saveThemeChoice(localStorage, choice);
      void vuetify.theme.change(choice);
    },
  },
});
</script>

<style lang="scss" scoped>
</style>
