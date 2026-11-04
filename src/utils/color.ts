/** A color as lowercase `#rrggbb`, the one form colors are stored and compared in. */
export type HexColor = `#${string}`;

export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/;
const HEX_INPUT = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/;

export function isHexColor(value: unknown): value is HexColor {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Reads what someone typed or a picker gave: any case, `#` optional, three or six digits. `null` if it is not a color. */
export function parseHexColor(input: string): HexColor | null {
  const digits = HEX_INPUT.exec(input.trim().toLowerCase())?.[1];

  if (!digits) {
    return null;
  }

  const expanded = digits.length === 3 ? digits.replace(/./g, '$&$&') : digits;

  return `#${expanded}`;
}

export function hexToRgb(color: HexColor): RgbColor {
  return {
    red: Number.parseInt(color.slice(1, 3), 16),
    green: Number.parseInt(color.slice(3, 5), 16),
    blue: Number.parseInt(color.slice(5, 7), 16),
  };
}

export function rgbToHex({red, green, blue}: RgbColor): HexColor {
  const digits = [red, green, blue].map((channel) => channel.toString(16).padStart(2, '0'));

  return `#${digits.join('')}`;
}
