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
        @focus="reveal"
        @click="pick(marker.ink, $event)"
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

  methods: {
    pick(ink: MarkerInk, event: MouseEvent): void {
      this.reveal(event);
      this.$emit('pick', ink);
    },

    /**
     * Scrolls a marker the row has cut off fully into view. Browsers do not scroll to a partly visible
     * element on focus, and a tap never focuses one, since the editor keeps focus.
     */
    reveal(event: Event): void {
      (event.currentTarget as HTMLElement).scrollIntoView({block: 'nearest', inline: 'nearest'});
    },
  },
});
</script>

<style lang="scss" scoped>
// Room the scrolling row keeps around each marker, so the lift, shadow and focus ring are not clipped.
$marker-room-top: 18px;
$marker-room-side: 8px;
$marker-room-bottom: 10px;

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

  // Always one row of full-size markers: where it does not fit, it takes its own row and scrolls sideways.
  // Padded for the room around each marker, with negative margins so the padding takes no space in the tray.
  &__markers {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    min-width: 0;
    padding: $marker-room-top $marker-room-side $marker-room-bottom;
    margin: (-$marker-room-top) (-$marker-room-side) (-$marker-room-bottom) auto;
    overflow-x: auto;
    scroll-padding-inline: $marker-room-side;
    scrollbar-width: thin;

    @media (prefers-reduced-motion: no-preference) {
      scroll-behavior: smooth;
    }
  }

  // Phones: a slimmer tray, with the markers lined up under the label.
  @media (max-width: 599.98px) {
    gap: 6px;
    padding: 8px 12px 4px;

    &__label {
      font-size: 0.75rem;
    }

    &__markers {
      margin-left: -$marker-room-side;
    }
  }
}

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
    width: 64px;
    height: 22px;
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
