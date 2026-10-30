import type {SeedBoard} from '@/types/board';
import type {InkSegment} from '@/utils/inks';

import {writingFromSegments} from '@/utils/inks';

function sampleBoard(title: string, segments: InkSegment[]): SeedBoard {
  return {title, ...writingFromSegments(segments)};
}

/** The boards a new demo visitor starts with, showing the marker colors and the collection previews. */
export const SAMPLE_BOARDS: readonly SeedBoard[] = [
  sampleBoard('A Quick Tour', [
    {text: 'Welcome to Whiteboard!\n', ink: 'blue'},
    {text: 'Pick a marker from the tray to write in ', ink: 'black'},
    {text: 'red', ink: 'red'},
    {text: ', ', ink: 'black'},
    {text: 'green', ink: 'green'},
    {text: ', ', ink: 'black'},
    {text: 'purple', ink: 'purple'},
    {text: ' or ', ink: 'black'},
    {text: 'orange', ink: 'orange'},
    {text: '.\n', ink: 'black'},
    {text: 'Everything saves as you write.\n', ink: 'black'},
    {text: 'Demo boards stay in this browser only.', ink: 'purple'},
  ]),
  sampleBoard('Sprint Planning', [
    {text: 'This sprint\n', ink: 'blue'},
    {text: 'DONE ', ink: 'green'},
    {text: 'Board search\n', ink: 'black'},
    {text: 'DONE ', ink: 'green'},
    {text: 'Marker colors\n', ink: 'black'},
    {text: 'IN PROGRESS ', ink: 'orange'},
    {text: 'Light and dark themes\n', ink: 'black'},
    {text: 'BLOCKED ', ink: 'red'},
    {text: 'Sketch mode (needs a design for phones)', ink: 'black'},
  ]),
  sampleBoard('Weekend Errands', [
    {text: 'Saturday\n', ink: 'blue'},
    {text: '- Farmers market\n- Return library books\n', ink: 'black'},
    {text: 'Sunday\n', ink: 'blue'},
    {text: '- Call Grandma\n', ink: 'black'},
    {text: '- Water the plants!', ink: 'green'},
  ]),
];
