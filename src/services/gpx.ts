import { RunSession } from '../types';
import { calculateDistanceKm } from './routing';

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const isoUtc = (ms: number) =>
  new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Builds a single-track GPX 1.1 document from a saved run.
 * Timestamps are interpolated across the recorded breadcrumbs using
 * the run's real start time and total duration, so Strava / Garmin /
 * any GPX viewer shows a sensible moving time.
 */
export function runToGpx(run: RunSession, index = 1): string {
  const points = run.routeCoordinates || [];
  const name = `LoopRunner run ${index} - ${run.distanceKm.toFixed(2)} km`;

  const stepMs =
    points.length > 1 ? (run.durationSeconds * 1000) / (points.length - 1) : 0;

  const trkpts = points
    .map((p, i) => {
      const t = isoUtc(run.date + stepMs * i);
      return `      <trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"><time>${t}</time></trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LoopRunner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(name)}</name>
    <time>${isoUtc(run.date)}</time>
  </metadata>
  <trk>
    <name>${esc(name)}</name>
    <type>running</type>
    <trkseg>
${trkpts || ''}
    </trkseg>
  </trk>
</gpx>
`;
}

/**
 * One file holding every saved run as its own track, so the whole
 * history can be imported into a single GPX-aware app at once.
 */
export function runsToGpxBundle(runs: RunSession[]): string {
  const tracks = runs
    .map((run, i) => {
      const points = run.routeCoordinates || [];
      const stepMs =
        points.length > 1 ? (run.durationSeconds * 1000) / (points.length - 1) : 0;
      const name = `LoopRunner run ${i + 1} - ${run.distanceKm.toFixed(2)} km`;
      const trkpts = points
        .map((p, j) => {
          const t = isoUtc(run.date + stepMs * j);
          return `      <trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"><time>${t}</time></trkpt>`;
        })
        .join('\n');
      return `  <trk>
    <name>${esc(name)}</name>
    <type>running</type>
    <desc>${esc(
      `${new Date(run.date).toISOString()} | ${run.distanceKm} km | ${run.avgPaceMinPerKm} /km | ${run.calories} kcal`
    )}</desc>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LoopRunner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>LoopRunner history (${runs.length} runs)</name>
    <time>${isoUtc(Date.now())}</time>
  </metadata>
${tracks}
</gpx>
`;
}

/**
 * Hands the file to the OS. On a real device we first try the native share
 * sheet (which lets the file land in Drive / WhatsApp / Strava), then fall
 * back to a normal anchor download inside the WebView.
 */
export async function saveGpx(filename: string, xml: string): Promise<void> {
  const blob = new Blob([xml], { type: 'application/gpx+xml' });
  const file = new File([blob], filename, { type: 'application/gpx+xml' });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch {
      // user cancelled the sheet or the platform refused - fall through
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Total recorded distance of a track, used as a sanity check in Settings. */
export function trackLengthKm(run: RunSession): number {
  const pts = run.routeCoordinates || [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += calculateDistanceKm(
      { lat: pts[i - 1][0], lng: pts[i - 1][1] },
      { lat: pts[i][0], lng: pts[i][1] }
    );
  }
  return Number(total.toFixed(2));
}
