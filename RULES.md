# RULES.md — how to work in LoopRunner

Binding for any agent or human touching this repo. It beats generic defaults.

## Stack

- React 19 + TypeScript + Vite 8, Tailwind 4 (`@tailwindcss/vite`), lucide-react icons
- Leaflet + OpenStreetMap tiles for maps (no Google Maps, no API keys)
- Capacitor 8 for the Android shell (`android/`)
- No backend, no accounts, no cloud sync. Data lives in `localStorage`.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build  -> must pass before every push
npm run lint     # oxlint (warnings are pre-existing, do not add new errors)
npm run preview  # serve dist/
```

Android locally:

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

CI (`.github/workflows/build-apk.yml`) does the above on every push to `main` and
publishes `LoopRunner.apk` to release `v1.0.<run_number>`. Never hand-edit versions.

## Conventions

- Screens live in `src/components/*Screen.tsx`, one screen per nav tab; `App.tsx` is
  the only router (`Screen` union) and owns cross-screen state.
- All persistence goes through `src/services/storage.ts`. Never call `localStorage`
  directly from a component.
- Derived numbers (pace, calories, records) live in `services/`, never inline in JSX.
- Dark UI only: `bg-slate-950` canvas, `bg-slate-900` cards, `border-slate-800`,
  accent `sky` / `emerald` / `amber`. Mobile-first, 412 px wide is the design target.
- Icons come from `lucide-react`; no emoji in UI chrome (glyphs render inconsistently
  in the Android WebView).
- Keep units metric (km, km/h, min/km, kg). `unitSystem` exists in settings but the UI
  is metric-only — do not half-implement imperial.

## Do nots

- Do not add a backend, auth, analytics, or ads.
- Do not break the release pipeline (constant applicationId `com.dali951.looprunner`,
  stable signing key) — "App not installed" on update is the worst failure mode.
- Do not fake GPS or fabricate stats for demos; the app must only show measured data.
- Do not `npm install` a mapping SDK that needs an API key.

## Decisions

- 2026-11-07: Settings screen added (body weight, update repo, GPX export, wipe data).
  Weight is the single source of truth for calories; runs keep the calories computed
  at the time they were recorded.
- 2026-11-07: GPX export implemented in `services/gpx.ts` with native share sheet
  first, anchor download fallback. Whole history exports as one multi-track file.
- 2026-11-07: Imperial units deliberately not implemented (scope cut, not a bug).
