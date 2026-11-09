# Boatyard Simulator 3D — Prototype v0.1

A playable browser game prototype inspired by a waterfront vessel-repair yard and user-supplied photographs of an MTCC EDEN TECHNOLOGY MAX 200T marine travel lift. Includes a navigable ferry, a playable 3D travel lift, a complete delivery mission, and responsive HUD controls.

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

The GitHub repository uses a flat root-level source layout:

```text
boatyard-simulator-3d/
├─ index.html          # HUD, overlays, and Three.js entry point
├─ styles.css          # Responsive interface
├─ main.js             # Game loop, controls, cameras and mission flow
├─ world.js            # Shipyard, basin, water and scenery
├─ geometry.js         # Ferry, travel lift, player and markers
├─ rules.js            # Mission state definitions and checks
├─ rules.test.mjs      # Automated mission-rule tests
├─ package.json        # Syntax and test commands
├─ ARCHITECTURE.md     # Design notes
└─ .github/workflows/  # GitHub Pages deployment
```

## Verification performed

- `npm run check` — JavaScript syntax checks **passed**.
- `npm test` — Mission-rule assertions in the automated test suite **passed**.
- Desktop (1365×768) and mobile (390×844) intro interface markup/CSS checks **passed** (including absence of horizontal overflow).
- **Limit:** Live WebGL gameplay was not completed end-to-end in the build environment because the CDN package could not be fetched by the browser in that environment. You should perform a live gameplay run after extracting the project on a network-connected machine. The above tests do not prove gameplay completion or rendering performance.

## Known v0.1 limitations

- The hoist is a recognizable procedural **visual approximation**, not a metrically accurate EMH200 CAD model. Photographs alone do not establish dimensions, load ratings, steering kinematics, or sling engineering.
- Simplified arcade movement, water animation and suspended-vessel position; no rated load simulation, collision damage, tension analysis, or certified operating procedure.
- No saved progress, audio, NPC interaction, physics engine, networking or persistent economy yet.
- Fixed first mission, one ferry and one hoist. Workshop props are mostly decorative.
- Browser needs WebGL, and the Three.js CDN must be reachable.

## Recommended next development iterations

1. v0.2: Confirm live gameplay, tune camera/handling, add obstacle collision and quality-of-life checkpoints; profile mobile GPU usage.
2. v0.3: Replace procedural hoist/ferry with optimized GLB models derived from properly measured reference geometry; introduce animation rigs.
3. v0.4: Add missions for multiple vessels, repair bays, NPCs and progressive goals.
4. v0.5+: Add asset streaming, sound, improved controls, mission persistence and optional management/economy mode.

## License and branding

This is an original demonstration prototype built from new procedural meshes. The name and visual branding on the virtual hoist are for reference/prototyping; secure appropriate permissions before distributing a branded commercial game. The source ZIP does **not** include the uploaded original photographs or videos.
