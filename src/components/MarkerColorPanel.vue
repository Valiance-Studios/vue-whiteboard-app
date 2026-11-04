<template>
  <v-card
    class="marker-color-panel"
    role="dialog"
    aria-label="RGB marker color"
    tabindex="-1"
  >
    <v-color-picker
      :model-value="color"
      class="marker-color-panel__picker"
      mode="rgb"
      :modes="['rgb']"
      hide-inputs
      hide-eye-dropper
      elevation="0"
      width="240"
      canvas-height="130"
      @update:model-value="pickColor"
    />

    <div class="marker-color-panel__fields">
      <v-text-field
        v-for="channel in channels"
        :key="channel.key"
        :model-value="channelDrafts[channel.key]"
        :label="channel.label"
        :error="parseChannel(channelDrafts[channel.key]) === null"
        type="number"
        min="0"
        max="255"
        variant="outlined"
        density="compact"
        hide-details
        hide-spin-buttons
        @update:model-value="typeChannel(channel.key, $event)"
        @blur="resetDrafts"
        @keydown.enter.prevent="$emit('done')"
      />
      <v-text-field
        :model-value="hexDraft"
        class="marker-color-panel__hex"
        label="Hex"
        :error="parseHexColor(hexDraft) === null"
        maxlength="7"
        spellcheck="false"
        variant="outlined"
        density="compact"
        hide-details
        @update:model-value="typeHex"
        @blur="resetDrafts"
        @keydown.enter.prevent="$emit('done')"
      />
    </div>
  </v-card>
</template>

<script lang="ts">
import type {HexColor, RgbColor} from '@/utils/color';
import type {PropType} from 'vue';

import {defineComponent} from 'vue';
import {hexToRgb, parseHexColor, rgbToHex} from '@/utils/color';

type Channel = keyof RgbColor;

type ChannelDrafts = Record<Channel, string>;

const CHANNEL_MAX = 255;

function toChannelDrafts(color: HexColor): ChannelDrafts {
  const {red, green, blue} = hexToRgb(color);

  return {red: String(red), green: String(green), blue: String(blue)};
}

/** A channel's value as typed, or `null` if it is not a whole number in range. */
function parseChannel(draft: string): number | null {
  const value = Number(draft);

  return /^\d{1,3}$/.test(draft) && value <= CHANNEL_MAX ? value : null;
}

/** The color typed into the channel fields, or `null` while any of them is not valid. */
function parseChannelDrafts(drafts: ChannelDrafts): HexColor | null {
  const red = parseChannel(drafts.red);
  const green = parseChannel(drafts.green);
  const blue = parseChannel(drafts.blue);

  return red === null || green === null || blue === null ? null : rgbToHex({red, green, blue});
}

/**
 * Picks a color from the spectrum, or from typed RGB or hex values, each kept up to date with the others.
 * Every valid change is reported straight away. A field holds what is being typed, even when not yet valid, until it loses focus.
 */
export default defineComponent({
  name: 'MarkerColorPanel',

  props: {
    color: {
      type: String as PropType<HexColor>,
      required: true,
    },
  },

  emits: {
    'update:color': (color: HexColor) => Boolean(color),
    'done': () => true,
  },

  data() {
    return {
      channels: [
        {key: 'red', label: 'Red'},
        {key: 'green', label: 'Green'},
        {key: 'blue', label: 'Blue'},
      ] as const,
      channelDrafts: toChannelDrafts(this.color),
      hexDraft: this.color as string,
    };
  },

  watch: {
    // Compares parsed values, so a field is not rewritten while it is typed in (e.g. `#abc` on the way to `#abcdef`).
    color(color: HexColor): void {
      if (parseChannelDrafts(this.channelDrafts) !== color) {
        this.channelDrafts = toChannelDrafts(color);
      }

      if (parseHexColor(this.hexDraft) !== color) {
        this.hexDraft = color;
      }
    },
  },

  methods: {
    parseChannel,
    parseHexColor,

    report(color: HexColor | null): void {
      if (color && color !== this.color) {
        this.$emit('update:color', color);
      }
    },

    pickColor(value: unknown): void {
      if (typeof value === 'string') {
        this.report(parseHexColor(value));
      }
    },

    typeChannel(channel: Channel, value: string): void {
      this.channelDrafts[channel] = value;
      this.report(parseChannelDrafts(this.channelDrafts));
    },

    typeHex(value: string): void {
      this.hexDraft = value;
      this.report(parseHexColor(value));
    },

    /** Replaces anything left unfinished or invalid in the fields with the current color. */
    resetDrafts(): void {
      this.channelDrafts = toChannelDrafts(this.color);
      this.hexDraft = this.color;
    },
  },
});
</script>

<style lang="scss" scoped>
.marker-color-panel {
  display: flex;
  gap: 12px;
  padding: 12px;
  outline: none;

  &__fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 104px;
  }

  // Phones: the fields go under the spectrum, with the three channels on one row.
  @media (max-width: 599.98px) {
    flex-direction: column;

    &__fields {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      width: auto;
    }

    &__hex {
      grid-column: 1 / -1;
    }
  }
}
</style>
