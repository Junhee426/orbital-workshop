# Surface Courier prototype validation

Date: 2026-09-27

## Implemented

- Third-person humanoid courier with walking animation and camera-relative keyboard/touch movement.
- Shared deterministic terrain, rock and station collision, safe valley route and steeper ridge route.
- 18 kg / 32 kg cargo selection; stamina, bracing, balance loss and cargo damage.
- Pickup, shelter activation/rest, delivery and visible relay power restoration.
- Native pause dialog with contained focus; input clearing on blur, hiding and touch release.
- Independent surface page plus offline SURFACE.html. Existing orbital home links to the new mode.

## Executed checks

- `npm test`: 28 tests passed (20 existing orbital/storage tests and 8 surface tests).
- `npm run build`: PLAY.html and SURFACE.html generated successfully.
- `npm run test:surface`: passed. Real keyboard movement from depot through all valley waypoints, shelter interaction, delivery and 100% cargo condition. Telemetry is read-only; no teleport or simulation mutation is used for this browser trip.
- Camera-relative movement, modal pause/focus and restart checked in the browser.
- Real touch press/release and mode toggles checked at 360 x 640; control bounds and non-overlap checked at 360 x 640 and 800 x 450.
- Standalone file boot/pickup and source-page navigation checked; no observed browser errors or external requests in the instrumented desktop surface run.
- Additional PLAY.html file-mode smoke check: original orbital mission starts in approach phase and the new link resolves to SURFACE.html.
- Visually reviewed desktop home, shelter, portrait and landscape screenshots in ignored test-results/.
- `git diff --check` passed.

## Scope and limits

This is a procedural, stylized gameplay prototype. Surface progress lasts for the current session only. No online features, persistent facilities or open-world campaign are implemented. Browser mobile emulation was used; physical phone performance has not been measured. The older orbital save key was verified unchanged during the surface delivery.
