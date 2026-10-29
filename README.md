# Liminal Spaces

A first-person exploration game with two worlds: **Endless Liminal Spaces** — walk forever through procedurally generated empty yellow offices, hotel corridors, parking levels and pool halls — and **The Great Path** — the district of Luceron and its halls, built in real multi-level 3D from the story “Rudon's Plane – Part 1” (Solar Sands). Low-resolution 3D with a pixel-art filter (three.js), built on the engine of [Capital Quarantine](https://github.com/michalstankiewicz4-cell/VS). Play: <https://michalstankiewicz4-cell.github.io/liminalspaces/>

Default controls (all rebindable in Options): click the game to capture the mouse, mouse to look, WASD walk, arrows turn, Shift run, Space jump, F flashlight, H hide/show HUD, Esc pause.

**Documentation:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (context and files) · [`docs/GREAT_PATH.md`](docs/GREAT_PATH.md) (register of the Great Path world) · [`TODO.md`](TODO.md) · [`docs/MULTIPLAYER.md`](docs/MULTIPLAYER.md) · [`CLAUDE.md`](CLAUDE.md) (assistant rules) · [`CHANGELOG.md`](CHANGELOG.md)

## Running locally
ES modules need a web server (they do not work from `file://`):
- VS Code: the *Live Server* extension → "Open with Live Server",
- or in the project folder: `python -m http.server 8000` and open `http://localhost:8000`.

## The world
- Infinite: the world is a grid of 32 m chunks generated on the fly from a **seed**; the same seed always builds the same place. Single Player > "Walk this seed" accepts a number or any text.
- Four zones that blend into each other: **Yellow offices** (maze-like rooms, humming fluorescent tubes), **Hotel corridors** (long red hallways lined with doors), **Parking levels** (dark concrete, pillars, sparse lights) and **Pool halls** (white tiles, shallow water).
- Every chunk border has openings and office/corridor chunks are carved as spanning trees, so everything is reachable.
- **Oddities**: rare objects (a chair facing nothing, a payphone, a door that leads nowhere, an EXIT sign…). Walking close to one counts it as found.
- Your last single-player walk (seed and position) is saved; Single Player > "Continue walk" brings you back.

## The Great Path
- The district of Luceron (Hub, First and Second Outer Ring, mine), the Wastelands (Vibra-cable, dense rooms, the room of doors, a dead end, the deep blue hall, the chapel) and the infinite Great Path and West Path. Start at the gate (the layered doors open), in the Hub or at the Wastelands door; the last position is saved.
- Real 3D: drops, podiums, stairs, windows, tunnels. Procedural PBR materials, baked light with occlusion, sunbeams, flickering lamps, a flashlight that casts shadows (always in hand, F switches it), work lights (L), a map (M).
- Where the story walks for hours or months the route is shortened, and a note on the wall says so. Every element with its story timestamp: [`docs/GREAT_PATH.md`](docs/GREAT_PATH.md). No people and no sound in this world for now.

## Menus and options
Start screen: two tiles — Endless Liminal Spaces (Single Player: New walk, Continue walk, walk a seed; Multiplayer: Host, Join with a code, Same-browser room) and The Great Path (start at the gate, continue, Hub, Wastelands door) — and Options. Esc pauses (Resume / Invite player when hosting / Options / Quit). Options: Graphics (pixel filter, field of view, view distance, head bob, FPS counter), Controls (key bindings), Mouse, Audio (volume, fluorescent hum), Language (English / Polski), Privacy & data.

## Multiplayer
Peer-to-peer over WebRTC with no game server: the host creates an invite code, the friend answers with a reply code (exchange them through any messenger). Up to 4 players. Only the seed, names and positions are sent — every client generates the same world from the seed. A public STUN server is **opt-in** (off by default); without it connections usually work only inside one network. "Same-browser room" connects tabs of one browser (for testing). Details: [`docs/MULTIPLAYER.md`](docs/MULTIPLAYER.md).

## Structure
- `js/main.js` – entry point; `js/core/` – app shell, settings, storage, helpers,
- `js/world/` – endless world: generator (`gen.js`), chunk meshing with baked lighting, textures, oddities, player, other players' avatars,
- `js/story/` – the Great Path world: multi-level cell grid, PBR materials, mesher with baking, props, layout from the story, walker, flashlight model,
- `js/render/` – pixel-art pipeline (low-res target + final shader), shared with Capital Quarantine,
- `js/input/` – key bindings, keyboard and mouse look,
- `js/audio/` – synthesised sound (Web Audio, no files),
- `js/net/` – WebRTC / BroadcastChannel transports and the session protocol,
- `js/i18n/` – English and Polish strings; `js/ui/` – menus, multiplayer screens, options, HUD,
- `vendor/` – three.js 0.186.1 (MIT) vendored locally; SHA-256 sums in `vendor/SHA256.txt`.

## Security and privacy
- no external scripts, CDNs or network requests in single player; the CSP in `index.html` only allows resources from the same origin,
- no `eval`, no `innerHTML`, no stored keys, no analytics, no input statistics,
- multiplayer only starts when you open it; it sends your name, position and direction straight to the other players; every received message is size-limited and validated,
- the STUN server (stun.l.google.com) is used only when you tick the option.

## Versioning
The version lives in `js/version.js` (shown in the menu and the FPS counter), history in `CHANGELOG.md`; every push is a new version (the owner creates `vX.Y.Z` tags in GitHub Releases).
Before every push: bump the version, add a changelog entry and run `node tools/check-version.mjs`.

## SEO
Tags in `index.html`, thumbnail `assets/og-image.png` (an in-game screenshot), `sitemap.xml`. After deployment add the site in Google Search Console ("URL prefix" type) and submit the sitemap.

## Credits
The Great Path world is a non-commercial fan work based on the story “Rudon's Plane – Part 1” by Solar Sands (YouTube); the notes on the walls are written for the game.

Engine pieces (pixel-art pipeline, settings, i18n, menu and options UI) come from Capital Quarantine by the same author. three.js © three.js authors, MIT licence (`vendor/LICENSE-three`).
