# HANDOFF.md

_Last updated: 2026-11-07_

## Done

- Planner: distance-targeted loop / point-to-point routes, zone radius, avoid-highways,
  route rotation, saved places, map pick.
- Live run: GPS tracking with jump filtering, pause/resume, live stats HUD, auto-follow
  camera, re-route.
- Summary with PR detection; Progress with records, SVG trend chart, log sheet.
- In-app APK updater (checks GitHub releases, installs via intent).
- **New (2026-11-07):** Settings screen — body weight (30–200 kg, steppers + clamp,
  instant save, live kcal preview), update repository setting, export whole history as
  GPX, two-tap erase-all. Per-run GPX export added to the log sheet.
- README rewritten from the Vite template into real docs.

## In progress

- Nothing half-finished.

## Next step

1. Push and confirm the CI release built a new `v1.0.<n>` APK.
2. Install it and record one real run — the weight setting only matters once it drives
   a real calorie number.
3. Candidate next work: weekly goal + streak (runs per week), audio km-split cues,
   pause auto-detect when speed < 1 km/h for 60 s.

## Blocked

- Nothing.

## Watch-outs

- `npm run lint` has pre-existing warnings (exhaustive-deps, set-state-in-effect).
  Do not treat them as new breakage.
- Verified in Chromium at 412×900: no horizontal overflow, nav visible, weight
  persistence + clamping + GPX contents + erase flow all pass with 0 console errors.
  Visual pixel review was not performed.
