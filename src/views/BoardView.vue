<template>
  <v-container>
    <h1 class="text-h4 mb-4">
      Board {{ id }}
    </h1>
    <!-- TODO: dry-erase styled v-sheet with debounced auto-saving textarea. -->
  </v-container>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'BoardView',

  props: {
    id: {
      type: String,
      required: true,
    },
  },
});
</script>

<style lang="scss" scoped>
</style>
