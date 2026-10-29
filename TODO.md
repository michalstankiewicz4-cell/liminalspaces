# TODO

Legend: **P1** next, **P2** later, **P3** ideas. State as of v0.4.0. Context: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## The Great Path (register: [`docs/GREAT_PATH.md`](docs/GREAT_PATH.md))
- [ ] P2 More procedural detail: clutter per Hub room, more anomaly kinds, variation of lamp fixtures
- [ ] P2 More sound (hum, footsteps, distant noises) — only the skylight scratching for now, by the owner's choice
- [ ] P2 Homes, hospital area, holding rooms; Rudon's backpack and skateboard at the gate
- [ ] P2 Multiplayer in this world (share the start and poses; the world is static)
- [ ] P3 The theory that the Great Path and the West Path curve and meet

## Look (hiding the rough edges of the graphics)
- [ ] P1 Tune the filter per zone (palette, dither, grain) — e.g. a VHS/camcorder look: scanlines, chroma bleed, timestamp overlay, slight fisheye
- [ ] P1 Film grain and subtle vignette pulse in the post shader; optional "low battery" camera mode
- [ ] P2 Light shafts / bloom around light panels (cheap: additive sprites, filtered by the pixel pass)
- [ ] P2 Better water: refraction-like wobble, caustics on pool floors, sunken pools with steps
- [ ] P2 Baked ambient occlusion in corners (vertex colours already carry lighting)
- [ ] P3 Optional palette themes in Options > Graphics

## World
- [ ] P1 More zones: stairwells (vertical changes), school hallways, mall food courts, endless playground, server rooms
- [ ] P2 Multi-storey chunks (stairs/ramps between levels)
- [ ] P2 Rare "set pieces": a lit room in darkness, a corridor that is too long, a room full of chairs
- [ ] P2 Transitions between zones (doorframe changes, carpet → tiles)
- [ ] P3 Day/night windows (fake skylights)

## Gameplay
- [ ] P2 Collection log of found oddities (per kind), shown in the pause menu
- [ ] P2 Optional quiet goals: find an EXIT sign, reach a distance, photo mode with saved snapshots (local only)
- [ ] P3 Optional subtle "presence" events (sounds behind you, lights going out) — keep it calm, no jump scares by default

## Audio
- [ ] P2 More layered room tones; reverb per zone (ConvolverNode with generated impulse responses)
- [ ] P2 Distant sounds (doors, elevator ding, dripping water)

## Multiplayer (plan in [`docs/MULTIPLAYER.md`](docs/MULTIPLAYER.md))
- [ ] P1 Test the WebRTC flow across two real networks (with and without STUN); document what works
- [ ] P2 Shorter codes (compress SDP) or QR codes
- [ ] P2 Optional signalling relay (opt-in, CSP change, README note) for one-click joining
- [ ] P2 Voice proximity chat? (would need microphone consent) — to be decided
- [ ] P2 Shared oddity finds, pings/markers, emotes

## Menus and settings
- [ ] P2 Touch controls (virtual stick + drag to look) for phones/tablets
- [ ] P2 Gamepad support and bindings
- [ ] P3 More languages (add a dictionary in `js/i18n/` and an entry in `LANGS`)

## Technical
- [ ] P1 E2E test script in the repo (Playwright) instead of ad-hoc scripts
- [ ] P2 Build chunks in a Web Worker (today ~10 ms per chunk on the main thread, one per frame)
- [ ] P2 Performance: profile on weaker GPUs; automatic lowering of `pixelH` / view distance
- [ ] P3 Save format versioning (`ls:save:v1` → migrations)

## Operational
- [ ] Create `vX.Y.Z` tags in GitHub Releases (owner)
- [ ] Enable GitHub Pages (Settings > Pages > Source: GitHub Actions) if it is not on yet
- [ ] Add the site to Google Search Console and submit `sitemap.xml`

## Done (summary)
v0.3.0: worker meshing, wear decals, anomalies and clutter, mouse jump fix. v0.2.0: The Great Path world, tiles, map, flashlight shadows.
First version: infinite deterministic world from a seed with four zones, chunk streaming, baked lighting with flickering and dead lights, pixel-art pipeline from Capital Quarantine, first-person controller with collisions, flashlight, synthesised audio, oddities, menus/options, English UI with Polish option, peer-to-peer multiplayer and same-browser rooms. Details: `CHANGELOG.md`.
