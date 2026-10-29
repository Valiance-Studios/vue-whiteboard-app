/**
 * Renders the PNG fallbacks of the tab icon from `public/favicon.svg`.
 *
 * Usage: node scripts/generate-icons.ts (run again whenever favicon.svg changes, and commit the PNGs)
 *
 * Browsers that skip SVG tab icons (Safari) use `favicon-32.png`, and Safari and iOS use
 * `apple-touch-icon.png` for bookmarks and the home screen. A PNG cannot follow the system's color
 * scheme the way the SVG does, so both draw the marker on a white tile, which shows on dark tab bars too.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const MARKER_BLUE = '#1f3b73';

interface Icon {
  file: string;
  size: number;
  /** Corner radius as a share of the size. The touch icon is square: iOS rounds it itself. */
  cornerRadius: number;
}

const ICONS: Icon[] = [
  {file: 'favicon-32.png', size: 32, cornerRadius: 0.22},
  {file: 'apple-touch-icon.png', size: 180, cornerRadius: 0},
];

const publicDir = new URL('../public/', import.meta.url);
const markerPath = /<path d="([^"]+)"/.exec(readFileSync(new URL('favicon.svg', publicDir), 'utf8'))?.[1];

if (!markerPath) {
  throw new Error('No <path d="..."> found in public/favicon.svg.');
}

function tileSvg(icon: Icon): string {
  const radius = 24 * icon.cornerRadius;

  // The marker is drawn at 80% of the tile, centred, so it keeps a margin on the white.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${icon.size}" height="${icon.size}">
    <rect width="24" height="24" rx="${radius}" fill="#ffffff"/>
    <path d="${markerPath}" fill="${MARKER_BLUE}" transform="translate(2.4 2.4) scale(0.8)"/>
  </svg>`;
}

const browser = await chromium.launch();

try {
  for (const icon of ICONS) {
    const page = await browser.newPage({viewport: {width: icon.size, height: icon.size}});
    await page.setContent(`<body style="margin:0">${tileSvg(icon)}</body>`);
    await page.screenshot({path: fileURLToPath(new URL(icon.file, publicDir)), omitBackground: true});
    await page.close();
    console.log(`Wrote public/${icon.file} (${icon.size}x${icon.size}).`);
  }
} finally {
  await browser.close();
}
