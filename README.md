# Boatyard Simulator 3D — Prototype v0.2

A playable browser game prototype inspired by a waterfront vessel-repair yard and user-supplied photographs of a large blue mobile marine travel lift. Includes a navigable ferry, a playable 3D travel lift, a complete delivery mission, and responsive HUD controls.

**Scope:** Game only. Vehicle dynamics, lifting behavior, clearances and vessel placement are **fictionalized**. It is not an operator-training program, machinery model, lift plan, or safety assessment.

## Run the game

Clone the repository (or unzip the download), open a terminal inside the project root, and start a simple web server:

```bash
python3 -m http.server 8080
```

Open **http://localhost:8080** in a current Chrome, Edge, Firefox, or Safari browser.

On Windows, `py -m http.server 8080` is an alternative. If Python is not installed, VS Code Live Server or any other local static web server also works. **Do not double-click `index.html` to open it as `file://`**; modern browsers can block ES modules in that mode.

**Internet required on first and subsequent launches:** The prototype loads the pinned Three.js module (`three@0.187.0`) from jsDelivr. Its library is not included in the ZIP. The game assets and geometry are otherwise local and procedurally generated. No install or `npm install` is necessary. For testing on a phone, run the server on a computer connected to the same Wi-Fi and open the computer’s LAN IP with port `8080` from the mobile browser (only on a trusted network).

## Controls

| Action | Desktop | Touch device |
|---|---|---|
| Move / drive / steer | W A S D or arrows | Virtual joystick |
| Interact, board, attach | E | ACTION |
| Lift vessel | Hold R | Hold ▲ RAISE |
| Lower vessel | Hold F | Hold ▼ LOWER |
| Stop / brake | Space | Hold BRAKE |
| Change camera | C | CAM |
| Orbit camera | Drag on 3D viewport | Drag on empty viewport |
| Zoom camera | Mouse wheel | — |
| Sprint on foot | Shift | — |
| Pause / resume | P or Escape | — |
| Recover current mission stage | T or mission panel RECOVER button | RECOVER button |
| Restart | Replay button after completion; pause menu | Replay button after completion |

Three camera modes cycle through *chase*, *tactical overhead*, and *side inspection*.

## Mission 01 — Ferry dry dock

1. Walk to the **Harbor Dispatch** ring and press `E`.
2. Pilot the ferry straight into the narrow lifting basin. Apply the brake; press `E` when stopped at the marker.
3. Walk to the **200T travel lift** and press `E` to operate it.
4. Use `S` to reverse the hoist toward the ferry. Stop aligned above the vessel and press `E` to perform the fictionalized sling-attachment interaction.
5. Hold `R` until the lift indicator completes the required clearance.
6. Drive forward and steer to **Dry Dock Bay 03**. Stop within the gold target ring.
7. Hold `F` to lower the ferry onto the support positions and complete the contract.

The interface shows the next objective and distance to the waypoint. A minimap tracks the ferry, hoist, player and destination. Use the tactical camera when aligning.

## Project structure

```text
boatyard-simulator-3d/
├─ index.html          # HUD, overlays, import map and entry point
├─ styles.css          # Responsive desktop/mobile UI
├─ main.js             # Renderer, control and mission orchestration
├─ world.js            # Harbor, yard, supports and props
├─ geometry.js         # Procedural vehicles, player and markers
├─ rules.js            # Mission stages and checkpoints
├─ collision.js        # Shared colliders and swept collision tests
├─ rules.test.mjs      # Existing mission-rule tests
├─ collision.test.mjs  # Terrain, obstacle and sweep tests
├─ recovery.test.mjs   # Checkpoint validity tests
├─ ARCHITECTURE.md     # System design and assumptions
└─ .github/workflows/  # Pages deployment and validation CI
```

## MVP stabilization in v0.2 (review branch)

- Characters are blocked by waterfront edges, major buildings, cargo stacks, forklifts and basin walls, with axis-wise sliding.
- Ferry movement uses a swept yawed hull footprint to avoid passing through quays or the basin end wall.
- Travel lift uses swept oriented collision checks against yard obstacles and a simplified four-wheel land-contact check, allowing it to straddle the basin.
- A nearby steel-storage prop was shifted to leave space for the approach to Bay 03.
- The RECOVER button (or T) restores a safe entry point for the **current mission stage**; it does not skip stages. The pause menu also offers a recovery action.
- Failed startup, render-loop exceptions, and WebGL context loss now have a clear error panel and reload control.
- Pull requests run JavaScript syntax and Node tests in CI; GitHub Pages deployment remains limited to `main`.

## Verification and release gate

Run `npm run check` and `npm test` from the repository root. The Node suite covers rule logic, collision shapes, test routes and checkpoint validity. It does **not** demonstrate live WebGL rendering or a complete manual playthrough.

**Before merging to main**, manually verify:

1. Scene starts without errors in a WebGL-capable desktop browser and a mobile browser.
2. All eight mission phases can be completed in order (harbor, ferry, hoist, lift, haul, lower, complete).
3. Player, ferry and hoist do not pass through major buildings or water/shore boundaries.
4. RECOVER works in SAIL, POSITION, LIFT, HAUL and LOWER and preserves the active mission stage.
5. Pause, restart, chase/tactical/inspection cameras, touch joystick, lift/lower controls and minimap remain functional.
6. Check mobile frame rate, browser Console and GitHub Actions checks.
7. Review and merge only after the gameplay acceptance checks pass.

**Limits:** This is an arcade game, not real equipment training. Collision shapes are approximations; small props and NPCs lack full collision. No mass, stability, cable-tension or certified lift physics; no autosave, online session or persistent economy. Three.js is loaded from an external CDN.

## License and branding

This is an original demonstration prototype built from new procedural meshes. The hoist now uses neutral in-game labeling and contains no real company decals; obtain permission before adding any third-party branding in future releases. The source ZIP does **not** include the uploaded original photographs or videos.
