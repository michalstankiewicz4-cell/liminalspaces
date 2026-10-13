# Architecture and project context

Browser game **Liminal Spaces**: a first-person walk through an endless, procedurally generated building (liminal spaces), 3D rendered at low resolution with a pixel-art filter. No dependencies except three.js (vendored locally), no network requests in single player.

Published at: repo <https://github.com/michalstankiewicz4-cell/liminalspaces>, site <https://michalstankiewicz4-cell.github.io/liminalspaces/> (GitHub Pages, workflow `.github/workflows/static.yml`). Engine origin: <https://github.com/michalstankiewicz4-cell/VS> (Capital Quarantine).

## Quick start for someone returning to the project
1. Read this file, then [`../TODO.md`](../TODO.md) and (for networking) [`MULTIPLAYER.md`](MULTIPLAYER.md).
2. Run locally: `python -m http.server 8000` in the repo folder, open `http://localhost:8000` (ES modules do not work from `file://`).
3. Standing rules: see "Rules" below and [`../CLAUDE.md`](../CLAUDE.md).

## File map
| Path | Role |
|---|---|
| `index.html` | Skeleton, CSP, SEO meta + JSON-LD; empty `#app` (canvas) and `#ui` (all UI is built from JS) |
| `css/base.css`, `css/menu.css`, `css/hud.css` | Base styles; menu/options/multiplayer overlay; HUD |
| `js/main.js` | Entry point: `createApp()` |
| `js/version.js` | `VERSION` (semver) — must stay at this path (the check script reads it) |
| `js/core/app.js` | App shell: renderer, camera + flashlight, world, player, audio, menus, session; modes `menu`/`play`, pause, frame loop, HUD text |
| `js/core/settings.js`, `storage.js`, `util.js` | Sanitised settings store, localStorage wrappers, helpers (PRNG `mulberry32`, stateless hashes `hash4`/`rand4`, `seedFrom`) |
| `js/world/gen.js` | **Pure, deterministic world generator** (no three.js): zones, walls, lights, water, pillars, doors, oddities, collision boxes |
| `js/world/chunks.js` | Chunk → meshes; baked lighting (`lightGrid`, `makeShade`) |
| `js/world/mesh.js` | `MeshBuilder`: subdivided faces/boxes into per-material buffers with vertex colours |
| `js/world/textures.js` | Procedural canvas textures and per-zone surface table |
| `js/world/oddities.js` | Box-built oddity models |
| `js/world/index.js` | World facade: materials, chunk streaming, fog per zone, flicker, water animation, oddity discovery |
| `js/world/player.js` | First-person walker: look, walk/run/jump, circle-vs-box collisions, head bob, footsteps |
| `js/world/avatars.js` | Other players' figures (interpolated) |
| `js/render/pixel-pipeline.js` | `PixelPipeline` from Capital Quarantine: low-res target + final shader (palette, dither, depth outline, vignette) |
| `js/input/bindings.js`, `input.js` | Rebindable actions and key labels; keyboard + mouse look (pointer lock or drag) |
| `js/audio/audio.js` | Synthesised sound (Web Audio) |
| `js/net/transport.js`, `session.js` | WebRTC (manual signalling) and BroadcastChannel transports; session protocol (seed + poses) |
| `js/i18n/{index,en,pl}.js` | `t()`, `bind()`, `setLang()`; English (default/fallback) and Polish dictionaries |
| `js/ui/{dom,hud,menu,multi}.js`, `js/ui/options/*` | DOM builder `h()`, HUD, menu screens, multiplayer screens, options tabs |
| `tools/check-version.mjs` | Version check before pushing |
| `vendor/` | three.js r0.186.1 + `SHA256.txt` + licence |
| `assets/` | `og-image.png` (1200×630 in-game screenshot), `icon.png` |
| `robots.txt`, `sitemap.xml` | SEO |

## Modes and flow (`js/core/app.js`)
`menu` (start screen: a slowly turning view of a fixed seed, `MENU_SEED`) → Single Player: New walk (random seed) / Continue walk (last seed and position from the save) / walk a typed seed (`seedFrom`: digits are used as the number, other text is hashed) → `play`.
**Esc** in `play` pauses (`paused = true`, pointer lock released) and opens the pause menu (Resume / Invite player — host only / Options / Quit to main menu); inside Options or Invite it goes back; on the pause menu it resumes. Losing pointer lock (the browser's own Esc handling) also pauses; a guard (`lockPauseAt`) stops the same Esc from immediately resuming. In `menu` mode Esc goes back one screen.
`startWalk(seed, spawn, session)` resets the world, places the player, preloads all chunks in view, hides the menu and requests pointer lock.

## World generation (`js/world/gen.js`)
- Units: metres. `CELL = 4` m, `N = 8` cells per chunk, `CHUNK = 32` m, wall height `H = 3`, thickness `T = 0.2`.
- **Determinism**: every chunk is built only from `(seed, i, j)` with `mulberry32(hash4(seed, i, j, salt))`; global features (zones, borders, lights, water) use stateless `rand4`. No `Math.random()` here. An LRU cache keeps 600 chunks.
- **Zones**: staggered 3×3-chunk regions (each region row is shifted by a random 0–2 chunks so the borders do not form a grid); weighted random theme per region (offices 40 %, corridors 22 %, garage 20 %, pools 18 %); the spawn region is always offices. Per-theme parameters in `THEME` (border openings, braid, rooms, lintels, ambient light, tint, light layout).
- **Walls** on cell edges: `east[x+z*N]` / `south[x+z*N]`. The last column/row is the border with the next chunk, generated by `border(i, j, axis)` from both chunks' themes and the chunk coordinates — both sides always agree, and every border has at least one opening.
- **Offices/corridors**: all internal walls up, then a randomised DFS spanning tree (corridors prefer to keep going straight), then braiding (extra openings) and open rooms; carved openings may get a lintel (`lintE`/`lintS`, from `LINTEL = 2.3` m to the ceiling). **Garage/pools**: open halls with a few wall pieces and pillars (`PILLAR = 0.7`); pools get water blobs.
- **Lights**: per cell `0` none, `1` on, `2` flickering, `3` dead (`lightOf`). Garage: only every other cell, many dead.
- **Oddities** (`ODDITIES`): at most one per chunk (≈42 % of chunks); kind filtered by theme, rare kinds less likely; `wall` kinds stick to the cell's east/south wall when there is one. `oddityPos()` gives the world position.
- **Collision**: `solidsNear(x, z)` returns AABBs of walls in the 3×3 cells around a point, plus pillars and solid oddities. Lintels are above head height and do not collide.
- **Reachability check** (in a throwaway script during development): BFS over cells for several seeds reaches all cells in a 64×64-cell window.

## Chunk meshes and lighting (`js/world/chunks.js`, `mesh.js`)
- One `Group` per chunk with one mesh per material bucket (`<theme>:wall|floor|ceil`, `door`, `prop`, `glow`, `lightOn`, `lightFlicker`, `lightDead`, `water`). Faces are subdivided (~1.4 m segments, floors/ceilings 3×3 per cell) so vertex lighting has enough resolution.
- **Baked lighting**: `lightGrid()` samples light state, ambient and tint for the chunk plus a 2-cell margin (so lighting is seamless across chunk borders); `makeShade()` returns per-vertex colour = ambient (bilinear) + Σ light power / (1 + d²/2.4²) over a 5×5 cell window, times the zone tint. Materials are `MeshLambertMaterial` with `vertexColors`, lit only by an `AmbientLight` of intensity π (so final colour = texture × vertex colour). The flashlight (`SpotLight` on the camera) adds real light on top.
- **Flicker**: all flickering panels share `materials.lightFlicker`, whose colour is modulated in `world.update()`; the tube buzz in audio follows it when you stand under one.
- Streaming (`world.stream`): chunks within `viewDist` (1–3) are built nearest first, at most one per frame (~10 ms each); chunks beyond `viewDist + 1` are disposed. Fog distance follows the view distance; fog colour follows the zone.

## Player (`js/world/player.js`)
Eye height 1.6 m, radius 0.3, walk 3 m/s, run 5.4 m/s, jump 5.2 m/s, gravity 18 m/s². Movement is sub-stepped (≤ 0.2 m) and resolved with two passes of circle-vs-AABB push-out. Yaw/pitch from mouse movement (`sens` setting, optional Y inversion) and the turn keys. Footsteps fire every half head-bob cycle and pick the sound by zone (or a splash in water).

## UI and i18n
All UI is built with `h(tag, props, ...kids)` (`js/ui/dom.js`) — no `innerHTML`. Static text uses `bind(el, key)` / `tx(key)` and follows the language automatically; dynamic text (HUD, pause info) is recomputed with `t(key, params)`. Add a language: new dictionary in `js/i18n/`, register it in `index.js` (`dicts`, `LANGS`) and in the settings sanitiser. Missing keys fall back to English, then to the key itself.
Screens (`js/ui/menu.js`, `js/ui/multi.js`): `main`, `single`, `multi`, `host`, `join`, `room`, `pause`, `options`, with a small history stack (`go`/`back`). Each screen may have an `onShow` refresher. Options tabs (`js/ui/options/`): Graphics, Controls, Mouse, Audio, Language, Privacy & data.

## Settings (`js/core/settings.js`)
Stored in `localStorage` key `ls:settings:v1`: `lang`, `gfx` (pixelH, levels, dither, edge, bright, fov, viewDist, headBob, showFps), `mouse` (sens, invertY), `audio` (volume, hum), `hud.show`, `net` (name, stun), `keys` (action → two `KeyboardEvent.code` slots). Everything passes through `sanitize()` (clamps, whitelists, a key code can be used by one slot only; `Escape` is reserved; names are filtered by `cleanName`). Change settings only via `settings.update(draft => …)`.
Key actions (`js/input/bindings.js`): moveFwd/Back/Left/Right, turnLeft/Right, sprint, jump, flashlight, toggleHud.

## Rendering (`js/render/pixel-pipeline.js`)
Unchanged from Capital Quarantine: scene → `WebGLRenderTarget` of height `pixelH` (default 200 px) with a `DepthTexture` → full-screen shader: brightness, quantisation to `levels` with 4×4 Bayer dithering, outlines from depth differences (perspective depth is linearised), vignette. Defaults here are tuned for first person (outline 0.6, brightness 1.15, FOV 75°).

## Audio (`js/audio/audio.js`)
Everything is synthesised: a looping noise buffer through filters (room tone, water, garage rumble), a 60 Hz sine + filtered 120 Hz saw (hum/buzz), short filtered noise bursts (footsteps, landing, flashlight click), two sine tones (find chime). The context starts on the first click (autoplay rules). Zone changes cross-fade the mix.

## Multiplayer (`js/net/`)
See [`MULTIPLAYER.md`](MULTIPLAYER.md). In short: the session shares only the seed and poses; transports are WebRTC DataChannels (manual copy/paste signalling, star topology through the host) or BroadcastChannel for same-browser rooms; every message is validated.

## Persistence (localStorage)
- `ls:save:v1` — `{ dist, odd, last: { seed, x, z, yaw } }` (total metres walked, oddities found, last single-player walk; saved every 5 s while walking, on pause/quit and on page unload)
- `ls:settings:v1` — settings
Storage errors are swallowed (private mode etc.).

## Privacy and security
- CSP in `index.html`: `script-src 'self'`, `connect-src 'self'`, no external scripts/CDNs, no `eval`/`innerHTML`, no API keys. WebRTC is not covered by `connect-src`; it only starts from the multiplayer screens.
- No statistics, analytics or telemetry. Multiplayer sends name, position and direction to the connected players only. The public STUN server is opt-in.
- Incoming messages: max 4000 characters, JSON object with a string `t`, numbers checked for finiteness and range, ids must match `^[a-z0-9]{1,12}$`, names filtered; invite/reply codes have a prefix (`LS1.`), a size limit and a type check.

## Versioning (standing rule)
Every push to `main` is a new semver version: bump `js/version.js`, add an entry at the top of `CHANGELOG.md`, run `node tools/check-version.mjs`, then push. The owner creates `vX.Y.Z` tags in GitHub Releases. Changes to world generation change every seed — mention it in the changelog.

## Testing (headless)
Playwright (Python) with Chromium and `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` gives working WebGL2 without a GPU. Serve the folder with `python -m http.server`, open the page and get the app with `(await import('/js/main.js')).default` (it exposes `world`, `player`, `camera`, `settings`, `progress`, `session`, `mode`, `paused`, `startWalk(seed, spawn)`, `pause()`, `goMenu()`…). **Stub pointer lock** with an init script (`HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve()`): a granted pointer lock in headless Chromium drops the frame rate to ~2 fps. Listen to `pageerror` and `console` errors. Scope button selectors to `.screen:not([hidden])`. WebRTC works between two browser contexts in one headless browser without STUN; same-browser rooms need two pages in the same context.
