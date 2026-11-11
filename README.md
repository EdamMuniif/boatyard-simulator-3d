# Boatyard Simulator 3D — Prototype v0.3.3

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
| Move / drive / steer | W A S D or arrows | Analog virtual joystick |
| Rotate the hoist at a stop (open yard only) | A / D, release W/S | Hold dedicated ↶ / ↷ buttons, or move joystick left/right |
| Turn the hoist while driving | A / D with W / S | Hold ↶ / ↷ while using joystick throttle |
| Walk camera-relative / turn naturally | WASD while on foot | Analog joystick while on foot |
| Jump on foot | Space | JUMP (same button as vehicle BRAKE) |
| Interact, board, attach | E | ACTION |
| Lift vessel | Hold R | Hold ▲ RAISE |
| Lower vessel | Hold F | Hold ▼ LOWER |
| Stop / brake (vehicles only) | Space | Hold BRAKE |
| Change camera | C | CAM |
| Orbit camera | Drag on 3D viewport | Drag on empty viewport |
| Zoom camera | Mouse wheel | — |
| Sprint on foot | Shift | — |
| Pause / resume | P or Escape | PAUSE / RESUME button |
| Open game controls | H | HELP button |
| Expand or collapse mission instructions | MORE / LESS | MORE / LESS |
| Show or hide mini-map | MAP button | MAP button |
| Recover current mission stage | T or mission panel RECOVER button | RECOVER button |
| Restart | Replay button after completion; pause menu | Replay button after completion |

Three camera modes cycle through *chase*, *tactical overhead*, and *side inspection*.

## Mission 01 — Ferry dry dock

1. Walk to the **Harbor Dispatch** ring and press `E`.
2. Pilot the ferry straight into the narrow lifting basin. Apply the brake; press `E` when stopped at the marker.
3. Walk to the **200T travel lift** and press `E` to operate it.
4. Use `S` to reverse the hoist toward the ferry. Turn using A/D (or the mobile ↶/↷ controls), but **pivot only where there is adequate space**—rotation can be blocked in the narrow basin. Stop aligned above the vessel and press `E` to perform the fictionalized sling-attachment interaction.
5. Hold `R` until the lift indicator completes the required clearance.
6. Drive forward and steer to **Dry Dock Bay 03**. Stop within the gold target ring.
7. Hold `F` to lower the ferry onto the support positions and complete the contract.

The interface shows the next objective and distance to the waypoint. A minimap tracks the ferry, hoist, player and destination. Use the tactical camera when aligning.

## Project structure

```text
boatyard-simulator-3d/
├─ index.html          # HUD, overlays, import map and entry point
├─ styles.css          # Base game UI
├─ responsive-ui.css   # Device-safe adaptive layout and accessible touch controls
├─ main.js             # Renderer, control and mission orchestration
├─ world.js            # Harbor, yard, supports and props
├─ geometry.js         # Procedural vehicles, player and markers
├─ rules.js            # Mission stages and checkpoints
├─ collision.js        # Shared colliders and swept collision tests
├─ rigging-profile.js  # Visual U-sling curve and lifting-block profiles
├─ character-motion.js # Grounded player controller and procedural gait
├─ hoist-steering.js   # Collision-checked hoist turning / low-speed pivot
├─ rules.test.mjs      # Existing mission-rule tests
├─ collision.test.mjs  # Terrain, obstacle and sweep tests
├─ recovery.test.mjs   # Checkpoint validity tests
├─ rigging-profile.test.mjs  # Visual rigging pose/curve tests
├─ character-motion.test.mjs # Motion, camera, collision and jump tests
├─ hoist-steering.test.mjs # Pivot, travel-steering and footprint constraints
├─ ARCHITECTURE.md     # System design and assumptions
└─ .github/workflows/  # Pages deployment and validation CI
```

## v0.3.3 — Adaptive UI/UX for phones, tablets and monitors

- Device-safe layout using `env(safe-area-inset-*)` for iPhone camera cutouts and rounded screens, plus short-height/landscape media queries.
- Expandable mission instructions, accessible stage-recovery action and collapsible mini-map keep the 3D viewport visible on narrow screens.
- Larger mobile targets and separated hoist-turn buttons reduce interference between steering and throttle. Existing touch input remains unchanged.
- In-game HELP dialog explains on-foot, ferry and travel-lift controls for keyboard and touch.
- Always-reachable PAUSE / RESUME control in the header, including on phones and tablets.
- Dynamic touch ACTION labels (BOARD, SECURE, ENTER, ATTACH) and correctly disabled RAISE / LOWER outside their active stages.
- Preserves desktop dashboard while allowing browser zoom (removes `user-scalable=no`).
- Safe pointer cleanup on blur, pause and joystick pointer-capture loss.
- Adds `responsive-ui.css` as an override layer; no changes to 3D geometry, vehicle handling, mission rules or company branding.

### Responsive acceptance checklist

- [ ] Android portrait (360–430 CSS px) and landscape: no overlap between joystick, hoist-turn buttons, mission and touch actions.
- [ ] iPhone portrait (375–430 CSS px) and landscape, including safe-area insets.
- [ ] Small phone (320 CSS px): actions remain reachable and scrollable overlays fit.
- [ ] Tablet portrait/landscape (768–1024 CSS px): visible controls and readable objective.
- [ ] Desktop 1366–1920 CSS px: normal map, HUD, mission and help controls.
- [ ] Open / close mission and map, Help (from start and pause), pause and resume.
- [ ] Board ferry and hoist, steer, lift, recover, complete the mission; verify touch-action controls still work.
- [ ] Real-browser WebGL, performance, keyboard focus, and iOS Safari touch behavior.

This layout is a **responsive interface change**, not new lift physics. Automated Node tests check HTML/CSS/JS contracts; real-device visual gameplay checks remain required before merging.

## v0.3.2 — Hoist turning and mobile rotation

- The travel lift can **rotate at a stop** on clear ground: use A/D with no throttle (desktop), or hold the dedicated ↶/↷ mobile buttons. Joystick left/right still works.
- Keep W/S for forward and reverse travel. While moving, steering continues to curve the path; when nearly stationary and without throttle, the turn input produces a slow pivot.
- Pivoting and driving both use the existing `sweepVehicle(...,canHoistAt)` collision checks. The narrow lifting basin and buildings can prevent a rotation; move to a wider location before turning.
- Separate wheel steering yaw from rolling rotation, with an approximate tangential orientation for a stationary turn.
- Preserve ferry/character controls, cargo/collision boundaries, game cameras, dry-dock mission flow and checkpoint recovery.
- Mobile touch turn controls appear only while the player is in the hoist's POSITION or HAUL driving stages; they are press-and-hold and reset on blur or pause.

**Limitation:** A stationary pivot is an arcade game maneuver. These graphics and turn rates must not be treated as a confirmed capability or operating method for the photographed equipment.

**Manual acceptance:** Verify turning 360° in a clear yard area, denial of rotation through buildings and basin edges, wheel yaw animation, alignment and transfer through Bay 03, desktop A/D/W/S, mobile simultaneous steer and throttle, brake, stage recovery and full mission completion.

## v0.3.1 — Character movement stabilization

- Camera-relative walking rather than fixed world-axis translation; camera direction stays independent of the player's body heading.
- Kinematic momentum (accelerate, slow down, sprint) and consistent diagonal speed; mobile analog joystick controls pace and automatically sprints near full deflection.
- Procedural jointed humanoid with animated hips, knees, arms and torso lean plus smooth heading turns and landing/idle transitions.
- Flat-ground gravity and an arcade jump (Space on foot, shared JUMP/BRAKE touch button); the same key continues to brake vehicles.
- Preserve existing `canWalkAt()` obstacle/basin boundaries with incremental, axis-wise sliding and blocked-axis velocity reset. Jumping does not bypass horizontal collision.
- Recovery and ferry disembark reset the motion state to avoid stale velocity/animations.
- No added package dependencies and no branded model content.

**Physics limitation:** This is a game-style kinematic controller on a flat ground plane (Y = 0), not a ragdoll, skeletal-mesh animation asset, or 3D capsule rigid-body simulation. Slopes, stairs, and dynamic-object pushes remain future work.

**Pre-merge testing:** Verify keyboard/touch acceleration, braking, turning, jump/landing, camera relative direction in all 3 views, shipyard boundaries, stage recovery, ferry boarding, and full dry-dock mission completion.

## v0.3 — Visual and handling improvements

- The original simplified straight sling bars are replaced by **four hanging U-shaped fabric slings**, matching the broad arrangements visible in the supplied photos.
- Unloaded straps hang near the pavement; when a vessel is attached, fabric loops, moving blue lifting blocks and paired cable falls rise with the existing game lift height.
- Four-leg blue travel lift gains column base ribs, steering turntable details, gantry guardrails, drum flanges and additional hardware details. No real company names or logos.
- Ferry has extra window frames, roof vents and deck details; the interactive label is **FERRY 01**.
- Small **visual-only** roll/pitch animations animate the ferry when carried, leaving its existing gameplay transform, checkpoints, and collision footprint untouched.
- Workshop facade ribs, roof skylights, basin fenders, yard stains and sea lighting are enhanced.
- Lower WebGL pixel ratio and shadow texture size on coarse-pointer devices reduce GPU demand on typical mobile devices.
- Three existing camera modes remain; hoist chase, tactical and side offsets are refined.

**Important:** The source photographs are visual references, not surveyed dimensions. The hoist, slings, wheel spacing, wire paths, capacity and clearances are still **approximate game geometry**, not a mechanical replica or an operator training tool.

**Release gate:** Before merging, verify game startup, all eight mission phases, sling positions empty and loaded, Bay 03 transport, camera behavior, collisions, recovery and touch controls on real devices. Node tests cannot substitute for WebGL visual confirmation.

## MVP stabilization in v0.2 (included)

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
