<template>
  <div class="marker-tray">
    <span class="marker-tray__label">Marker · {{ currentName }}</span>

    <div
      class="marker-tray__markers"
      role="group"
      aria-label="Marker color"
    >
      <button
        v-for="marker in markers"
        :key="marker.ink"
        type="button"
        class="marker"
        :class="{'marker--selected': marker.ink === ink}"
        :aria-label="`${marker.name} marker`"
        :aria-pressed="marker.ink === ink"
        :style="{'--marker-color': marker.color}"
        @mousedown.prevent
        @click="$emit('pick', marker.ink)"
      >
        <span class="marker__cap" />
        <span class="marker__barrel" />
        <span class="marker__tip" />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import type {Marker, MarkerInk} from '@/constants/markers';
import type {PropType} from 'vue';

import {defineComponent} from 'vue';
import {MARKERS} from '@/constants/markers';

/** The ledge under the board holding the markers. Picking one is reported even if it is already in hand. */
export default defineComponent({
  name: 'MarkerTray',

  props: {
    ink: {
      type: String as PropType<MarkerInk>,
      required: true,
    },
  },

  emits: {
    pick: (ink: MarkerInk) => Boolean(ink),
  },

  data() {
    return {
      markers: MARKERS as readonly Marker[],
    };
  },

  computed: {
    currentName(): string {
      return this.markers.find((marker) => marker.ink === this.ink)?.name ?? '';
    },
  },
});
</script>

<style lang="scss" scoped>
.marker-tray {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
  padding: 14px 24px 10px;
  border-radius: 0 0 12px 12px;
  background: linear-gradient(180deg, #cbd2db 0%, #aab3bf 100%);
  box-shadow: 0 6px 14px rgb(28 35 48 / 18%);

  &__label {
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #2c3440;
  }

  // Always one row: where it does not fit beside the label, it takes its own row and the barrels shrink to fit.
  &__markers {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    min-width: 0;
    margin-left: auto;
  }

  // Phones: smaller markers and a slimmer label row, so the tray leaves the board most of the height.
  @media (max-width: 599.98px) {
    gap: 2px;
    padding: 8px 12px 4px;

    &__label {
      font-size: 0.75rem;
    }

    &__markers {
      gap: 4px;
    }

    .marker {
      --cap-width: 16px;
      --cap-height: 20px;
      --barrel-height: 16px;
      --tip-width: 5px;
      --tip-height: 9px;
      --lift: 6px;

      padding: 0 2px;
    }
  }
}

// Sized by custom properties, so the tray can shrink the markers on phones.
.marker {
  --cap-width: 30px;
  --cap-height: 26px;
  --barrel-height: 22px;
  --tip-width: 8px;
  --tip-height: 12px;
  --lift: 10px;

  display: flex;
  align-items: center;
  min-width: 0;
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
    transform: translateY(calc(-1 * var(--lift)));
    filter: drop-shadow(0 6px 4px rgb(28 35 48 / 30%));
  }

  &__cap {
    flex-shrink: 0;
    width: var(--cap-width);
    height: var(--cap-height);
    border-radius: 6px 3px 3px 6px;
    background: var(--marker-color);
  }

  &__barrel {
    // The only part that shrinks when the tray is narrow.
    width: 64px;
    min-width: 16px;
    height: var(--barrel-height);
    border-radius: 3px 8px 8px 3px;
    background: #f7f8fa;
    box-shadow: inset 0 -3px 0 rgb(28 35 48 / 8%);
  }

  &__tip {
    flex-shrink: 0;
    width: var(--tip-width);
    height: var(--tip-height);
    border-radius: 0 4px 4px 0;
    background: var(--marker-color);
  }
}
</style>
