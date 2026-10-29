# Changelog

Versioning: `MAJOR.MINOR.PATCH`. Every push to the repository is a new version (number in `js/version.js` + an entry here).
The owner creates `vX.Y.Z` tags in GitHub Releases on commits from this history; pushing tags from a Claude session is blocked.
Bug fix = PATCH, new feature = MINOR, big change to gameplay, the save format or world generation (changes every seed) = MAJOR.

## [0.2.0] - 2026-10-29
### Added
- Start screen with two tiles: **Endless Liminal Spaces** (the procedural world) and **The Great Path** (new world).
- **The Great Path**: the district of Luceron and its halls, built from the story “Rudon's Plane – Part 1” (Solar Sands): the Hub (plaza with a rain collector, avenues, cafeteria, offices, explorers' guild with the senior explorer's office, map library and the map machine, the court with a 6-layer gate, gardens, market with a tailor, factory), the First Outer Ring with knocked-down walls and a mine descending 8 m, the Second Outer Ring, the Wastelands door with a guard booth, the Wastelands hall with the Vibra-cable and stations, the dense rooms and their anomalies, the room of doors, a dead end with Agarite behind the drywall, the deep blue hall and the 56 × 56 m chapel with podiums and a sunbeam on the builders' map, and the infinite Great Path and West Path. Every element is listed with its story timestamp in `docs/GREAT_PATH.md`.
- Real multi-level 3D for this world: every 0.5 m cell has its own floor and ceiling height (drops, podiums, stairs, windows, lintels, tunnels, hanging blocks); walker with step-up, falling and jumping.
- Procedural PBR materials (albedo, normal, roughness/metalness maps generated in the browser), baked lighting with occlusion and corner shading, sun squares and dusty sunbeams under skylights, flickering and dead lamps, fog per place, ACES tone mapping and film grain.
- A flashlight always in hand (visible model) that casts shadows; **L** turns on work lights to see a whole area.
- Map: minimap and a full map (**M**) with zoom, pan, place labels and a journal of places found with their story timestamps; only what you have seen is drawn.
- “Route shortened” notes on the walls wherever the story walks for hours, days or months; reading a note shows it large on screen.
- Flashlight shadows in the endless world too.
### Changed
- Options > Graphics: “Great Path: detailed rendering” and “film grain”. Controls: work lights (L), map (M).
- The Great Path world has no sound for now.

## [0.1.0] - 2026-10-13
### Added
- First version of **Liminal Spaces**: a first-person walk through an endless, procedurally generated building. The world is generated in 32 m chunks from a seed (same seed = same place) and streamed around the player.
- Four zones in large regions: Yellow offices, Hotel corridors (with doors), Parking levels (pillars, sparse lights) and Pool halls (shallow water). Everything is reachable: chunk borders always have openings and office/corridor layouts are spanning trees.
- Baked lighting in vertex colours from ceiling panels, some flickering and some dead; fog tinted per zone; a flashlight (F).
- Oddities: 14 kinds of rare objects; walking close to one counts it as found (chime + message).
- Synthesised audio (Web Audio): mains hum and tube buzz, room tone per zone, footsteps per floor type, splashes in water.
- Menus: Single Player (New walk, Continue walk, walk a typed seed), Multiplayer (Host, Join with a code, Same-browser room), pause (Resume, Invite player, Options, Quit), Options (Graphics, Controls, Mouse, Audio, Language, Privacy & data). English by default, Polish available.
- Multiplayer: peer-to-peer WebRTC with copy/paste invite and reply codes (no game server, up to 4 players, optional STUN), same-browser rooms over BroadcastChannel; players see each other as simple coloured figures.
- Engine from Capital Quarantine (VS): pixel-art pipeline, settings store, i18n, menu and options widgets, version check script.
- Documentation (README, architecture, multiplayer, TODO, assistant rules), SEO tags, thumbnail and icon from in-game screenshots.
