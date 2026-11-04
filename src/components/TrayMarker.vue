<template>
  <button
    type="button"
    class="marker"
    :class="{'marker--selected': selected}"
    :aria-label="label"
    :aria-pressed="selected"
    :style="{'--marker-color': color}"
    @mousedown.prevent
  >
    <span class="marker__cap" />
    <span class="marker__barrel"><slot /></span>
    <span class="marker__tip" />
  </button>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/** One marker on the tray. Pressing it leaves focus where it was, so the editor keeps its caret. The default slot decorates the barrel. */
export default defineComponent({
  name: 'TrayMarker',

  props: {
    label: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
  },
});
</script>

<style lang="scss" scoped>
.marker {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  min-height: 44px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(0 2px 2px rgb(28 35 48 / 25%));
  transition: transform 0.15s ease, filter 0.15s ease;

  &:hover {
    transform: translateY(-4px);
  }

  &:focus-visible {
    border-radius: 8px;
    outline: 3px solid rgb(var(--v-theme-primary));
    outline-offset: 4px;
  }

  // The marker in hand is lifted off the ledge.
  &--selected,
  &--selected:hover {
    transform: translateY(-10px);
    filter: drop-shadow(0 6px 4px rgb(28 35 48 / 30%));
  }

  &__cap {
    width: 30px;
    height: 26px;
    border-radius: 6px 3px 3px 6px;
    background: var(--marker-color);
  }

  &__barrel {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 52px;
    height: 22px;
    padding-inline: 5px;
    border-radius: 3px 8px 8px 3px;
    background: #f7f8fa;
    box-shadow: inset 0 -3px 0 rgb(28 35 48 / 8%);
  }

  &__tip {
    width: 8px;
    height: 12px;
    border-radius: 0 4px 4px 0;
    background: var(--marker-color);
  }
}
</style>
