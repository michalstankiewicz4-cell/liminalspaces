# Changelog

Versioning: `MAJOR.MINOR.PATCH`. Every push to the repository is a new version (number in `js/version.js` + an entry here).
The owner creates `vX.Y.Z` tags in GitHub Releases on commits from this history; pushing tags from a Claude session is blocked.
Bug fix = PATCH, new feature = MINOR, big change to gameplay, the save format or world generation (changes every seed) = MAJOR.

## [0.5.0] - 2026-10-29
### Added
- **Story guide** in the Great Path world: 17 places in the order the story visits them (Hub → rings → Wastelands door → Vibra-cable station → deep blue hall → the chapel map → cafeteria → court → explorers' guild → senior office → dead end → rain collector → map library → map machine → the gate → the Great Path). A line at the top shows the next place, its story time, the distance along the route and an arrow; chalk arrows on the floor show the way; the map shows the route and the target; reaching a place shows what happens there in the story. **G** or Options > Graphics turns the guide off. The step is saved.
- **Sound** in the Great Path world: ambience per place (mains hum, tube buzz, room tone, wind, the chapel drone, the mine rumble) with reverb that matches the space (small room, hall, huge chapel, damp mine), footsteps by floor surface (carpet, tile, steel, grit, wood), landing thuds, and sound sources at their places: the map machine, factory machines, dripping rain collectors and mine water, Vibra-cable stations, vents.
- **Scary events** (no people, nothing seen clearly), more often in the outer rings, the Wastelands, the dense rooms, the room of doors and dead ends: a power cut, footsteps behind you that stop when you turn round, a distant door slam, three knocks inside a wall, something running above the ceiling with dust falling, a tube bursting in sparks, the flashlight failing, the Vibra-cable twanging three times, the structure groaning with shaking and dust, the picture tearing like a bad tape. Standing in the dark without the flashlight brings a heartbeat and the edges of the view close in. Options > Graphics can turn the events off.
- **Teleport** on the map: click a place in the list of places found, or double-click an explored spot.

## [0.4.1] - 2026-10-29
### Fixed
- Great Path map: explored places stay revealed. The full map (M) now opens framed on everything you have explored (plus where you are) instead of a fixed zoom around you, so earlier places no longer seem to disappear when you walk away; zoom out further than before.
- The explored map is saved in the browser (`ls:pathmap:v1`) and restored on the next visit; “Reset saved progress” also clears it.

## [0.4.0] - 2026-10-29
### Added
- The Great Path: **scratching at the skylights** (story 04:17). Now and then something scratches at a skylight near you: synthesised claw strokes, taps and knocks, positioned at that skylight (HRTF) and muffled by the glass; a dark shape slides over the glass and the sunbeam dims. More often along the Great Path and the West Path. It is the only sound in this world; Options > Audio can turn it off.
### Fixed
- Ceiling tiles: the water stains were too dark and read as silhouettes; now subtle.
### Added (continued)
- **The sun under the skylights** (story 05:40): standing in a sun square slowly burns — the picture warms up, the air shimmers, then it bleaches to white; warnings appear and you slow down. It wears off in the shade.

## [0.3.0] - 2026-10-29
### Fixed
- Mouse look: sudden jumps of tens of degrees. The pointer lock now asks for raw (unadjusted) mouse movement where the browser supports it, ignores the first events after locking and drops single events that are far larger than the recent movement (a known Chrome pointer-lock glitch).
### Added
- The Great Path: chunks are meshed in a Web Worker (no hitches when crossing into new areas); only the 3×3 chunks around the spawn are built up front.
- Procedural wear: water stains, scuffs, mould and cracks on walls and stains on floors (decals, amount depends on the surface).
- Rare anomalies along the infinite Great Path and West Path: drywall boxes, vents to nowhere, doors into solid wall, missing ceiling panels, a chair facing the wall, a door frame with no wall, small empty side rooms, loose papers.
- Clutter in the dense rooms and the Wastelands hall (papers, boxes).
### Changed
- Carpet stains are subtler (less visible tiling).

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
