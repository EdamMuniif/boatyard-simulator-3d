# Boatyard Simulator 3D — Prototype v0.5.0

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
| Show or hide radar | MAP button | MAP button |
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

The mission panel shows the current objective, a checklist of every stage and the distance to the waypoint. The circular radar turns with the camera and shows the target (gold; it sits on the rim when out of range), the ferry, the hoist, the workers and the A–E yard locations. Use the tactical camera when aligning.

**Money:** the contract pays **$15,000**. Driving the ferry or the travel lift into something at speed costs **$500 per impact**. Creeping into a wall or pivoting against a limit is free. The completion screen shows the payout, the damage and your new bank balance. MATERIALS in the status bar is a fixed display value until a supply system is added.

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
├─ worker-avatar.js    # Hero/NPC blue coverall models and jointed animation
├─ npc-navigation.js   # Safe pedestrian routing and walkable ground tests
├─ npc-system.js       # Autonomous yard-worker runtime and obstacle avoidance
├─ touch-controls.js   # Pointer-safe touch controls and analog joystick
├─ vessels.js          # Procedural yachts, work boats, ferries, barges, dhow and sailboats
├─ static-merge.js     # Merges static scenery and rigid model parts to cut draw calls
├─ human-avatar.js     # Rigged human hero/workers: dressing, props, animation blending
├─ physics.js          # Load pendulum, travel-lift mass dynamics, ferry hydrodynamics
├─ assets/characters/  # worker-base.glb (rigged human body + motion-capture clips)
├─ hoist-steering.js   # Collision-checked hoist turning / low-speed pivot
├─ rules.test.mjs      # Existing mission-rule tests
├─ collision.test.mjs  # Terrain, obstacle and sweep tests
├─ recovery.test.mjs   # Checkpoint validity tests
├─ rigging-profile.test.mjs  # Visual rigging pose/curve tests
├─ character-motion.test.mjs # Motion, camera, collision and jump tests
├─ hoist-steering.test.mjs # Pivot, travel-steering and footprint constraints
├─ touch-controls.test.mjs # Joystick/hold interactions, pointer cancellation and reset
├─ ARCHITECTURE.md     # System design and assumptions
└─ .github/workflows/  # Pages deployment and validation CI
```

## v0.5.0 — Realistic characters and real-time physics

**Characters**
- The hero and the yard workers are now a rigged human body with realistic adult proportions (1.8 m) and motion-captured idle, walk and run animations. They replace the box figures.
- Walk and run blend by ground speed, and playback speed is matched to the movement measured from the clips themselves, so the feet don't slide. Workers sometimes nod or shake their head while standing around.
- **Dressed to match the two references:**
  - **Both:** blue coveralls, a skin-coloured face and hands, and brown boots, coloured from the skeleton weights. A beard, brows, eyes, nose and ears are fitted to the measured head shape, along with chest and cargo pockets.
  - **Hero:** white hardhat.
  - **Workers:** blue hardhats, reflective chest, shoulder, arm and shin tape, and a brown belt with a silver buckle.
- If the model fails to load, the previous procedural figure is used instead.
- **Swapping in a different character:** the body uses the standard Mixamo skeleton. Any character downloaded from Mixamo as a skinned model and converted to `.glb` can replace `assets/characters/worker-base.glb` and keep these animations.

**Physics** (`physics.js`, unit-tested; simplified models tuned for play, not engineering models)
- **Suspended load:** the ferry hangs from the slings as a damped two-axis pendulum. The length is the distance from the lifting blocks to the hull, about 11.6 m at haul height, giving a swing period of about 6.8 s. It swings back when the lift accelerates, forward when it brakes, and outward in turns. The HUD shows the swing angle. **You cannot lower the hull onto the stands until the swing settles** (under 1.7°).
- **Travel lift mass:** the same traction and brakes act on 85 t empty or 145 t loaded, so a loaded lift is noticeably slower to speed up and to stop.
- **Ferry:**
  - Thrust works against quadratic water drag, and a crash stop from full speed takes about 3 s.
  - The rudder only turns the ferry when it's moving through the water. A small bow thruster turns it slowly at rest.
  - Turning builds up and dies away gradually, the ferry heels outward in turns, and the bow lifts under power.
  - It also rolls and pitches on the swell.

**Credits and licence note:** the base character body and its animations are the "X Bot" character from Adobe Mixamo, as distributed with the three.js examples (`examples/models/gltf/Xbot.glb`), trimmed to five clips. Mixamo characters and animations are free for use in projects. Mixamo's terms don't allow redistributing them as standalone assets, so keep this file inside the game rather than offering it as a separate download.

## v0.4.0 — Open-world yard look and HUD

Based on the concept art (A–E yard locations, status strip, mission checklist, radar) and the reference drone photo of the yard.

- **Busy yard:** yachts on keel blocks and jack stands on the west quay (C, yacht refitting). Coloured work boats, a ferry, a landing craft and a barge on the east quay (D, vessel repairs). A rusty barge and a tug are moored offshore, and yachts, sailboats and a ferry lie at the anchorage (A). There are also palm trees, gable roofs in blue, grey and teal, sandy ground patches, a scrap pile and an excavator. All hull and stand footprints are solid for the player, and the moored vessels are solid for the ferry.
- **Tropical look:** a gradient sky dome with sun glow and drifting clouds, turquoise shallows fading to deep blue water, foam along the quay edges, sun glint, and warmer light.
- **HUD:** a MONEY / WORKERS / MATERIALS / STATUS strip, a mission checklist that ticks off each stage, a circular radar that turns with the camera (with a sweep), and lettered A–E markers in the world and on the radar. Location E rides on the travel lift.
- **Contract economy:** a payout and per-impact damage, settled on the completion screen.
- **Performance:** static scenery merges into about 60 meshes, and characters, the hoist and the ferry merge per rigid part. In testing, draw calls per frame fell from about 1,500 to about 400 even with all the new scenery.
- **Phones:** the chase camera pulls back in portrait so the travel lift no longer fills the screen.
- The speed panel header no longer runs into its unit label.

This version uses the open-world genre conventions (radar, money HUD, map blips). It does not copy any specific game's logo, fonts or HUD.

## v0.3.6 — Hero appearance and autonomous boatyard workers

- **Playable hero:** a procedural, articulated Three.js character based on the first supplied illustration: white hardhat, royal-blue coveralls with chest and cargo pockets, dark beard, brown work boots and a hands-on-hips idle pose. Walking uses the existing character acceleration, corrected joystick direction, gravity and jointed limb motion.
- **Autonomous workers:** the second illustration informs their blue hardhats, blue coveralls, reflective bands and brown work boots. Three workers roam on typical touch devices, and five on desktop, to limit GPU costs.
- **Reference fidelity pass:** the hands-on-hips idle now lands each hand on the hip at the waistline (checked by a forward-kinematics test). Cargo pockets sit on the outer side of both thighs. The hero has an open collar with a dark undershirt and a gathered elastic waistband. Workers have shoulder-to-chest reflective straps clear of their pockets and a brown belt with a silver buckle. Both have hardhats with a front peak and chunkier lace-up boots, and the beard no longer shows through the back of the head.
- **Independent movement:** workers choose destinations in side-yard areas, calculate routes around workshop, cargo and forklift footprints, pause at destinations, then walk elsewhere. They avoid the central moving-hoist corridor, water, nearby pedestrians and moving machinery.
- **Architecture:** `worker-avatar.js` builds shared-geometry lightweight 3D rigged characters; `npc-navigation.js` owns pure testable walkable pathfinding; `npc-system.js` updates only ambient NPC visuals. The existing `createPlayer()` / `animatePlayer()` API remains supported.
- Removed the four old static worker figures so they are not duplicated. NPC movement pauses when the game is paused and does not modify vessel/hoist rules or mission checkpoints.
- The supplied illustrations are **visual references**. Procedural geometry cannot reproduce the illustrated faces and fabrics exactly; a future artist-made and properly rigged GLB model would provide higher fidelity.

**Review gate:** Test all worker routes, walking joints, camera views, obstacle avoidance, player interactions, hoist clearance, mobile FPS, stage recovery, and the full ferry-to-Bay-03 mission before merging.

## v0.3.5 — Fix reversed player left/right movement

- Corrected the camera-relative screen-right vector in `character-motion.js`: horizontal input now maps to the camera's right/left rather than the opposite direction.
- Applies to both mobile joystick and A/D keyboard movement **on foot only**; ferry and hoist turning are unchanged.
- Updated earlier camera and shore-boundary regression tests, and added independent joystick-to-screen-direction tests for multiple camera headings.
- Same acceleration, jump, animation, player collision and mission recovery behavior.
- Pre-merge browser check: walking in chase, overhead and side views should match the joystick's left/right direction while the camera is moving.

## v0.3.4 — Control input reliability

- Introduced `touch-controls.js` to manage joystick and hold-button pointer IDs, analog deadzones, global pointer release, and safe pointer-capture fallback.
- Touch input releases on pause, reset, stage transition, page blur, pagehide, visibility changes and pointer cancellation. These prevent stuck throttle, raising, braking, or steering after interruptions.
- ACTION, CAMERA, and PAUSE become enabled immediately after starting; touch controls are refreshed immediately on mission stage changes.
- Pedestrian movement follows the **actual camera look direction** rather than hard-coded chase/overhead angles.
- Keyboard Space still jumps/brakes during gameplay but does not intercept Space/Enter used to activate focused on-screen buttons.
- Canvas regains focus when starting, resuming, or closing Help, so normal keyboard controls work without manually clicking into the world.
- Hoist rotation is permitted at rest while BRAKE is held; idle steering slows residual coasting faster. Existing `canHoistAt` swept collision checks remain in force, including basin wheel-contact restrictions.
- Pressed mobile controls receive visible highlight feedback.
- Updated tests now exercise real pointer-event state transitions in a DOM-like Node harness, rather than only asserting presence of handler strings.

**Release limitation:** The tests do not replace an actual WebGL/iOS Safari/Android Chrome gameplay run. Verify walk/board/drive/lift/drop and touch releases on physical devices or browser emulation before merging.

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
