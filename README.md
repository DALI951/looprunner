# LoopRunner

Plan a run by distance, run it with live GPS, keep every kilometre on your own phone.
No account, no cloud, no ads.

Android APK is built and released automatically on every push to `main`
(see [Releases](https://github.com/DALI951/looprunner/releases)).

---

## What it does

**Plan** — pick a start point (saved place or your live GPS position), choose a target
distance (e.g. 5 km), and it generates a real route with a live polyline on
OpenStreetMap. Loop mode returns you to the start; point-to-point mode finishes
somewhere else. You can also force a zone radius (stay within X km of home) or avoid
highways, and rotate the route to get a different shape at the same distance.

**Run** — live tracking screen with elapsed time, distance, current pace, average
pace, max speed, calories and a self-drawing breadcrumb trail. Pause/resume, and
GPS jumps are filtered so a bad fix can't fake a sprint record.

**Summary** — the run debrief: 6 stats, your actual trace on the map, and instant
notices when you break a personal record (longest run, top speed, best pace).

**Progress** — personal records board, an SVG trend chart (speed / distance / pace
over your last 12 runs), and a full log sheet of every run with per-run GPX export.

**Settings** — set your real body weight (it drives every calorie number), change the
update-check repository, export your whole history as one GPX file, or wipe all data.

## Install (Android)

1. Open [Releases](https://github.com/DALI951/looprunner/releases) on the phone.
2. Download `LoopRunner.apk` from the newest release.
3. Allow "install unknown apps" for your browser, then install.
4. Newer builds install over older ones — same application id
   `com.dali951.looprunner`, same signing key, no uninstall needed.

The in-app **Settings → Check for APK update** button also finds and installs the
latest release for you.

## Run it on the PC

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle
npm run lint     # oxlint
```

Geolocation over plain `http://localhost` works in Chrome; opening the built files
from `file://` will not give you GPS.

## Android build

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

In CI, `.github/workflows/build-apk.yml` does exactly this and attaches the APK to a
`v1.0.<run_number>` release.

## How the numbers work

- Distance: haversine between consecutive GPS fixes, with a minimum-movement
  filter so stationary drift doesn't accumulate.
- Calories: `MET(speed) × weight(kg) × hours`, MET stepped across walking/jogging/
  running bands (6.0 → 12.8).
- Pace: `elapsed / distance`, formatted `m:ss /km`; anything outside a sane range
  shows `--:--` instead of a fake number.
- Personal records are recomputed from the stored run list every time, so deleting a
  run correctly removes the record it held.

## Storage

Everything lives in `localStorage` on the device — `looprunner_run_sessions`,
`looprunner_saved_places`, `looprunner_settings`. Nothing leaves the phone except
the OpenStreetMap tiles and the optional GitHub release check. Export to GPX any
time from Settings or the log sheet.

## Stack

React 19 + TypeScript + Vite, Tailwind 4, Leaflet for maps, Capacitor 8 for the
Android shell, lucide-react icons. No backend.

## Structure

```
src/
  App.tsx                 screen router + app state
  components/             PlanScreen, ActiveRunScreen, SummaryScreen,
                          HistoryScreen, SavedPlacesScreen, SettingsScreen,
                          LeafletMap, UpdateModal
  services/
    routing.ts            feasibility checks + route generation
    tracking.ts           GPS state, pace/calorie math, session finalisation
    gpx.ts                GPX 1.1 export (single run + whole history)
    storage.ts            localStorage persistence + personal records
    updater.ts            GitHub release check / APK install intent
  types/index.ts          shared domain types
```
