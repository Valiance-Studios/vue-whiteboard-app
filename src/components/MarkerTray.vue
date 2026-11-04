<template>
  <div class="marker-tray">
    <span class="marker-tray__label">Marker · {{ currentName }}</span>

    <div
      class="marker-tray__markers"
      role="group"
      aria-label="Marker color"
    >
      <tray-marker
        ref="customMarker"
        :label="`${customMarkerName} marker`"
        :color="customColor"
        :selected="customMarkerInHand"
        :title="customMarkerInHand ? 'Click to choose a color' : undefined"
        :aria-expanded="panelOpen"
        aria-haspopup="dialog"
        @focus="reveal"
        @click="clickCustomMarker"
      >
        <span class="marker-tray__spectrum" />
        <v-icon
          v-if="customMarkerInHand"
          icon="mdi-palette"
          size="16"
          color="#2c3440"
        />
      </tray-marker>

      <tray-marker
        v-for="marker in markers"
        :key="marker.ink"
        :label="`${marker.name} marker`"
        :color="marker.color"
        :selected="marker.ink === ink"
        @focus="reveal"
        @click="pick(marker.ink, $event)"
      />
    </div>

    <v-menu
      v-model="panelOpen"
      :activator="customMarkerElement ?? undefined"
      :open-on-click="false"
      :close-on-content-click="false"
      location="top start"
      offset="12"
      @after-enter="focusPanel"
    >
      <marker-color-panel
        ref="panel"
        :color="customColor"
        @update:color="$emit('customColorInput', $event)"
        @done="panelOpen = false"
      />
    </v-menu>
  </div>
</template>

<script lang="ts">
import type {Marker, MarkerInk} from '@/constants/markers';
import type {HexColor} from '@/utils/color';
import type {ComponentPublicInstance, PropType} from 'vue';

import {defineComponent} from 'vue';
import MarkerColorPanel from '@/components/MarkerColorPanel.vue';
import TrayMarker from '@/components/TrayMarker.vue';
import {CUSTOM_MARKER_NAME, MARKERS} from '@/constants/markers';
import {isHexColor} from '@/utils/color';

/**
 * The ledge under the board holding the markers. Picking one is reported even if it is already in hand,
 * except the RGB marker, where a click on the marker in hand opens or closes its color panel instead.
 */
export default defineComponent({
  name: 'MarkerTray',

  components: {
    MarkerColorPanel,
    TrayMarker,
  },

  props: {
    ink: {
      type: String as PropType<MarkerInk>,
      required: true,
    },
    customColor: {
      type: String as PropType<HexColor>,
      required: true,
    },
  },

  emits: {
    pick: (ink: MarkerInk) => Boolean(ink),
    customColorInput: (color: HexColor) => Boolean(color),
    colorPanelClose: () => true,
  },

  data() {
    return {
      markers: MARKERS as readonly Marker[],
      customMarkerName: CUSTOM_MARKER_NAME,
      panelOpen: false,
      /** The panel's anchor, which only exists once mounted. */
      customMarkerElement: null as HTMLElement | null,
    };
  },

  computed: {
    customMarkerInHand(): boolean {
      return isHexColor(this.ink);
    },

    currentName(): string {
      return this.customMarkerInHand
        ? this.customMarkerName
        : this.markers.find((marker) => marker.ink === this.ink)?.name ?? '';
    },
  },

  watch: {
    panelOpen(open: boolean): void {
      if (!open) {
        this.$emit('colorPanelClose');
      }
    },
  },

  mounted(): void {
    this.customMarkerElement = (this.$refs.customMarker as ComponentPublicInstance).$el as HTMLElement;
  },

  methods: {
    pick(ink: MarkerInk, event: MouseEvent): void {
      this.reveal(event);
      this.$emit('pick', ink);
    },

    clickCustomMarker(event: MouseEvent): void {
      if (this.customMarkerInHand) {
        this.panelOpen = !this.panelOpen;
      } else {
        this.pick(this.customColor, event);
      }
    },

    /** Moves focus out of the writing, so typing cannot land on the board while the panel is open. */
    focusPanel(): void {
      const panel = (this.$refs.panel as ComponentPublicInstance | undefined)?.$el as HTMLElement | undefined;

      if (!panel?.contains(document.activeElement)) {
        panel?.focus({preventScroll: true});
      }
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
    gap: 8px;
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

  // Marks the RGB marker as one of any color, whichever color it holds now.
  &__spectrum {
    flex: 1 1 auto;
    height: 10px;
    border-radius: 3px;
    background: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  }

  // Short screens, such as a phone on its side: the height goes to the board, and the lifted marker still shows which is in hand.
  @media (max-height: 599.98px) {
    &__label {
      display: none;
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
</style>
