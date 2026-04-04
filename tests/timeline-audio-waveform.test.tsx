import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TimelineAudioWaveform } from '../src/components/TimelineAudioWaveform';

describe('TimelineAudioWaveform', () => {
  it('renders a waveform shell while async peaks are not loaded yet', () => {
    const html = renderToStaticMarkup(
      <TimelineAudioWaveform
        audioPath="/tmp/podcast.mp3"
        durationMs={12_000}
        trackWidth={800}
        trackHeight={38}
      />,
    );

    expect(html).toContain('data-waveform-shell="true"');
  });
});
