# FORGE — Browser Game Engine

FORGE is a browser-based 3D scene editor hosted from this folder through GitHub Pages.

**Live editor:** https://coolboy8297.github.io/ai/game-engine/  
**Source:** https://github.com/Coolboy8297/ai/tree/main/game-engine

## Open it

Open the live editor in a modern browser with WebGL enabled and an internet connection. The editor loads Three.js from jsDelivr, so the first load needs access to that CDN.

## Included tools

- Real-time Three.js 3D viewport with lighting, fog, shadows, grid, and orbit camera
- Scene hierarchy and object selection
- Create boxes, spheres, cylinders, cones, toruses, capsules, planes, point lights, and cameras
- Inspector for object names, position, rotation, scale, color, and material roughness
- Translate, rotate, and scale gizmos
- Play mode with WASD movement, mouse look, Space to move up, Shift to move down, and Escape to stop
- Modular runtime core (`engine-core.js`) with entity/component storage, event bus, vector math, AABB/ray queries, action bindings, asset cache, fixed-step clock, and Web Audio helpers
- Per-object JavaScript update scripts
- Import GLB/GLTF models
- Save a scene in browser storage, export JSON, and import JSON
- Screenshot export, undo/redo history, and FPS display

## Editor controls

- Drag with left mouse: orbit the viewport
- Drag with right mouse: pan
- Mouse wheel: zoom
- W / E / R: move, rotate, and scale gizmo modes
- F: focus selected object
- Delete / Backspace: delete selected object
- 1 / 2 / 3: add a box, sphere, or light
- Ctrl+Z / Ctrl+Y: undo / redo
- F1: debug overlay is reserved for a future toggle
- Play: enter fly-camera mode; WASD moves, mouse looks, Space rises, Shift descends, Escape exits

## Scene scripting

Select an object, click **{ } Script**, then use this format:

```js
function update(dt, object, api) {
  object.rotation.y += dt;
  object.position.x += Math.sin(performance.now() * 0.001) * dt;
}
```

The script runs only in Play mode. The API object exposes `scene`, `camera`, `THREE`, `playMode`, and `engine`, `world`, `events`, `input`, `assets`, `audio`, plus `Vec3`, `AABB`, `EventBus`, `World`, `Entity`, `rayAABB`, and `FixedStepClock`. Scripts execute as JavaScript in the page, so only run scripts you trust.

## Persistence

**Save** stores scene JSON in the current browser's local storage. **Export Scene** downloads a portable JSON file. **Import JSON** loads a previously exported FORGE scene. Imported GLB/GLTF models are currently runtime-only and are not included in scene JSON.

## Runtime core quick example

Inside an object script, use the core utilities like this:

```js
function update(dt, object, api) {
  const direction = new api.Vec3(1, 0, 0).multiplyScalar(dt);
  object.position.x += direction.x;
  api.events.emit('sample:tick', { time: performance.now() });
}
```

The core's `World` and components are available to scripts and extensions. They are currently a general runtime layer; the visual scene objects are still represented by Three.js objects and are not automatically mirrored into the ECS world.

## Current limitations

FORGE is an evolving browser editor, not yet a full production engine. It does not currently provide a full ECS, a physics solver, sound playback/mixing, a gamepad rebinding UI, multi-scene project packaging, a standalone runtime build, or a dockable native editor. The play mode is a fly camera rather than a character controller. The renderer requires WebGL and a working CDN connection.

## Next engineering milestones

1. Add reusable component definitions and entity lifecycle APIs.
2. Add collider components, raycasts, and a simple rigid-body/trigger update.
3. Add sound playback and volume controls.
4. Add a game project/runtime export path separate from the editor.
5. Add test scenes and automated smoke checks.
