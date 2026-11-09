# Architecture — Boatyard Simulator 3D v0.1

## Objective and boundaries

Create a small reproducible game built around the complete ferry-to-dry-dock loop. Prefer an inspectable, modular Three.js scene without proprietary engine dependencies or an asset pipeline for the first iteration. All mass, dynamics, capacity and lifting behavior are fictional game abstractions.

## Main subsystems

```text
index.html / styles.css
          │ user input + HUD
          ▼
  main.js (DockyardGame)
      │         │          ├─ camera and render loop
      │         │          ├─ walking / vessel / hoist arcade motion
      │         │          └─ waypoint and minimap presentation
      │         ▼
      │    rules.js
      │    phase metadata + conditions
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

### Coordinate convention

Three.js uses **Y-up**. `X` is horizontal across the shipyard; `Z` runs from the harbor toward inland. Ferry bow points +Z when piloted into the lifting basin. The initial ferry is at `(0, 0, -49)`, basin target `(0, 0, 16)`, and dry-dock target `(34, 0, 108)`. These are fictional world-units. They are **not** actual Thilafushi site coordinates.

The main yard occupies Z ≈ 32…177. Two concrete quays flank a water-filled cutout, each carrying one row of the travel lift's wheels in the basin scene. The vessel hull is carried and moved by an arcade transform synchronized to the hoist in the first iteration; no physical force transfer is computed.

### Rendering and assets

- Renderer: `WebGLRenderer`, antialiasing, ACES tone mapping, sRGB output.
- Scene: hemisphere and directional lighting with shadow mapping, light fog.
- Environment: tiling concrete CanvasTexture, flat sea shader, procedural warehouses and props.
- Ferry: custom triangulated hull with cabin, windows, trim and railings.
- Travel lift: four structural columns, two longitudinal rails, cross beams, wheel stations, winch drum details, and animated sling representation.
- HUD: ordinary HTML and CSS; minimap drawn on a separate 2D Canvas.

### Safety and verification constraints

Visual labels and textures do not encode certified machinery ratings. The reference photo branding `MAX 200T` is not a verified specification for this 3D simulation. Never rely on the game for real vessel weight estimates, sling placement, clearances or operator procedures.

### Improvement strategy

Keep scene rendering, mission rules, and controls separated. Add a GLB loader only after the external models and units have been verified. Introduce collision layers and a physics plugin as an independent adapter, retaining stable gameplay behavior. Replace arcade motion per subsystem rather than rewriting all mission states. Preserve visible user controls and provide regression tests for new phase logic. Capture production browser FPS and input latency before adding more meshes.
