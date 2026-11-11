# Architecture — Boatyard Simulator 3D v0.3.3

## Objective and boundaries

Create a small reproducible game built around the complete ferry-to-dry-dock loop. Prefer an inspectable, modular Three.js scene without proprietary engine dependencies or an asset pipeline for the first iteration. All mass, dynamics, capacity and lifting behavior are fictional game abstractions.

## Main subsystems

```text
index.html / styles.css / responsive-ui.css
          │ user input + HUD
          ▼
  main.js (DockyardGame)
      │         │          ├─ camera and render loop
      │         │          ├─ walking / vessel / hoist arcade motion
      │         │          └─ waypoint and minimap presentation
      │         ▼
      │    rules.js
      │    phase metadata, conditions and checkpoints
      │    hoist-steering.js
      │    proposed travel/pivot state (collision-authorized in main.js)
      │    character-motion.js
      │    input-to-velocity, grounded jump and animation phases
      │    collision.js
      │    obstacle definitions and swept 2D overlap
      ▼
  Three.js scene graph
      ├─ world.js     ambient light, ground, water, basin, prop scenery
      └─ geometry.js  player, ferry, travel lift, rigging, markers
```

### Mission state machine

`DISPATCH → SAIL → BOARD_HOIST → POSITION → LIFT → HAUL → LOWER → COMPLETE`

Transitions are gated by location and velocity, except the explicit user interactions and holding virtual lift/lower controls:

- `DISPATCH → SAIL`: interact near dispatch marker.
- `SAIL → BOARD_HOIST`: ferry in pickup radius and nearly stationary; interact.
- `BOARD_HOIST → POSITION`: interact near hoist-side boarding marker.
- `POSITION → LIFT`: hoist over vessel and nearly stationary; interact.
- `LIFT → HAUL`: reach the simulated lifted-clearance height.
- `HAUL → LOWER`: hoist stopped at docking target with sufficient lifting height.
- `LOWER → COMPLETE`: simulated lowering meets the placeholder support elevation.

The single source of gameplay rule constants is `rules.js`; edit thresholds there before adding more difficulty presets.

### v0.2 collision and recovery contracts

- `collision.js` defines the workshop, cargo and forklift positions reused by `world.js`, plus blocker geometry. Minor environmental props remain decorative.
- The walkable world is the union of the main yard and both piers. Character movement uses a 2D circle with axis-wise sliding.
- The ferry has a yawed rectangular footprint. Swept checks reject motion through quays and the basin end wall.
- The travel lift has an oriented body footprint, swept checks against major yard obstacles, and simplified land-contact checks for four wheel stations. It intentionally straddles the basin; basin retaining walls are not body blockers.
- Rotation and translation are checked together, preventing ordinary step-wise tunneling.
- `checkpointForPhase` is defined in `rules.js`. Recovery repositions all entities and resets their velocity, heading and sling/lift state to a safe entry for the **current** stage. No progress is skipped or persisted.
- Startup/runtime failures surface in the UI with a reload option. Node regression tests are not a substitute for desktop and mobile WebGL gameplay tests.

### Coordinate convention

Three.js uses **Y-up**. `X` is horizontal across the shipyard; `Z` runs from the harbor toward inland. Ferry bow points +Z when piloted into the lifting basin. The initial ferry is at `(0, 0, -49)`, basin target `(0, 0, 16)`, and dry-dock target `(34, 0, 108)`. These are fictional world-units. They are **not** actual Thilafushi site coordinates.

The main yard occupies Z ≈ 32…177. Two concrete quays flank a water-filled cutout, each carrying one row of the travel lift's wheels in the basin scene. The vessel hull is carried and moved by an arcade transform synchronized to the hoist in the first iteration; no physical force transfer is computed.

### v0.3.3 responsive UI

- `responsive-ui.css` is loaded **after** the base `styles.css`; it owns adaptive media queries and safe-area touch spacing. Existing game styles remain available and unchanged.
- `main.js` owns transient UI state only: mission instructions expanded/collapsed, map expanded/collapsed, help modal open/close, and pause-button representation. Compact defaults apply on phone-size or short-height viewports, with user interaction taking priority afterward.
- HELP temporarily pauses the existing game loop and restores the previous pause state on close. All touch axes and held buttons are cleared on pause, blur and help open.
- Existing DOM IDs for 3D controls and player input remain intact. RAISE/LOWER disabled states reflect mission phases; the ACTION label reflects the active stage.
- Header PAUSE and HELP buttons are accessible on desktop and touchscreen. No new network calls or UI framework dependencies.
- UI regression tests check action targets, CSS breakpoints, safe areas, user zoom and control compatibility. Pixel-perfect visual acceptance remains a manual real-device task.

### v0.3.2 turning controls

- `hoist-steering.js` is a pure module for proposing the hoist heading/position change: moving steering remains proportional to travel speed; near zero speed with no throttle, left/right input produces a slow in-place pivot.
- `main.js` always checks the proposed transform with the existing swept yard collision before committing it. No collision boundaries are relaxed. A turn may fail at the narrow water basin, deliberately.
- Dedicated mobile ↶/↷ press-and-hold buttons supplement the joystick in hoist-driving phases; keyboard A/D already provides steering. Buttons reset on pause, blur, and checkpoint recovery.
- Each wheel retains an outer steering pivot and a child rolling group. `main.js` updates them independently, showing tangential wheel alignment in pivot mode. The animation is not a mechanical steering calibration.
- The model, vessel transfer, mission phases and desktop/mobile UI remain otherwise unchanged. In-place rotation is **fictional arcade gameplay**, not a statement about actual equipment capabilities.

### v0.3.1 player motion

- `character-motion.js` is a pure deterministic ground controller without Three.js or external physics dependencies. It produces camera-relative horizontal movement, acceleration, deceleration, sprint speed, gravity/jump state, smooth heading and gait phase.
- `main.js` passes existing keyboard/touch axes into the controller, then updates the avatar mesh transform. While walking, the camera orbit does not follow avatar heading; camera-relative controls therefore avoid a self-reinforcing turning loop.
- `geometry.js` retains `createPlayer()` API with a low-poly articulated rig and adds `animatePlayer()` for opposing leg/arm swing and torso bob. One set of scene objects is created during startup; no per-frame mesh allocations.
- `collision.js` remains the authoritative 2D circle boundary test; player movement is substepped and slides against obstructions. Jump physics affect only Y on flat ground and cannot cross the basin shoreline.
- On disembark or checkpoint recovery, player motion and pose reset. Vessel, hoist, mission state, camera selection, and mobile controls remain active.
- Player motion speeds are fictional game units, not surveyed measurements. Rapier-based full 3D collision is outside the scope of this minimal incremental version.

### v0.3 rendering/animation separation

- `rigging-profile.js` owns deterministic, tested U-shaped webbing and simplified lift-block heights. `geometry.js` consumes its curves and updates persistent BufferGeometry, avoiding per-frame geometry allocation.
- In-game sling geometry resembles the supplied photographs: four transverse loops, tan/dark fabric, overhead wire falls, suspended blue lifting-block pairs and open unloaded cradle shape.
- `createFerry()` returns both stable `root` and child `visual` groups. Only `visual` receives cosmetic sway; the mission, ferry position, docking logic and collision footprint keep using the stable root.
- `main.js` retains existing input, collision, controls, and recovery, with adjusted chase/overhead camera offsets and a mobile pixel ratio cap.
- `world.js` adds facade/ground/sea details while keeping buildings inside shared obstacle footprints. Mobile gets reduced shadow-map resolution.
- No real-world company branding or certified mechanical information is included. Sling curves and movement are aesthetic, not load-bearing calculations.

### Rendering and assets

- Renderer: `WebGLRenderer`, antialiasing, ACES tone mapping, sRGB output.
- Scene: hemisphere and directional lighting with shadow mapping, light fog.
- Environment: tiling concrete CanvasTexture, flat sea shader, procedural warehouses and props.
- Ferry: custom triangulated hull with cabin, windows, trim and railings.
- Travel lift: four structural columns, two longitudinal rails, cross beams, wheel stations, winch drum details, and animated sling representation.
- HUD: ordinary HTML and CSS; minimap drawn on a separate 2D Canvas.

### Safety and verification constraints

Visual labels and textures do not encode certified machinery ratings. The in-game travel lift uses generic, fictional signage; no machine capacity is validated by this simulation. Never rely on the game for real vessel weight estimates, sling placement, clearances or operator procedures.

### Improvement strategy

Keep scene rendering, mission rules, and controls separated. Add a GLB loader only after the external models and units have been verified. Introduce collision layers and a physics plugin as an independent adapter, retaining stable gameplay behavior. Replace arcade motion per subsystem rather than rewriting all mission states. Preserve visible user controls and provide regression tests for new phase logic. Capture production browser FPS and input latency before adding more meshes.
