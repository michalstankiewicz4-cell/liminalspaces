# Changelog

Versioning: `MAJOR.MINOR.PATCH`. Every push to the repository is a new release (`VERSION` in `js/version.js` + an entry here). From 0.11.0 each part also has its own version (`VERSIONS`: the start screen, Endless Liminal Spaces, The Great Path / Rudon's Plane); an entry names the parts it changed with their new versions.
The owner creates `vX.Y.Z` tags in GitHub Releases on commits from this history; pushing tags from a Claude session is blocked.
Bug fix = PATCH, new feature = MINOR, big change to gameplay, the save format or world generation (changes every seed) = MAJOR.

## [0.14.0] - 2026-10-30
Parts: start screen 1.4.0 · Endless Liminal Spaces 1.3.0 · The Great Path (Rudon's Plane) 1.3.0
### Changed
- **Each world has its own graphics settings**, and all of them work in both: pixel height, colour levels, dithering, outline, brightness, field of view, view distance and head bob. Options > Graphics has a switch at the top (Endless Liminal Spaces / The Great Path); opened during a walk it shows the world you are in. Before, the Great Path ignored most of these (it had fixed values behind "detailed rendering"). The Great Path also has film grain, the story guide and the scary events there; the FPS counter is shared. Reset resets the shown world only.
- The Great Path's view distance now works: 1–3 sets how many chunks are kept around you (2–4) and how far the fog lets you see.
- Settings format v3: an older save keeps its field of view, brightness and head bob for both worlds; if "detailed rendering" was off, the Great Path takes over the pixel-art values. The "detailed rendering" option is gone (the Great Path's own values replace it).

## [0.13.0] - 2026-10-30
Parts: start screen 1.3.0 · Endless Liminal Spaces 1.2.0 · The Great Path (Rudon's Plane) 1.2.0
### Added
- **Hotbar** at the bottom of the screen (like Minecraft's, in this game's style): eight slots with pixel-art icons — the flashlight (it lights up when on) and, in the Great Path world, the map; the other slots are empty, for things to come. Keys 1–8 select a slot and use its item (flashlight on/off, map open/close); the mouse wheel moves the selection; the selected item's name shows above the bar for a moment. The slot keys can be rebound in Options > Controls. The hotbar hides with the HUD (H).
### Changed
- The control hint and the paper note being read sit higher, above the hotbar.

## [0.12.0] - 2026-10-30
Parts: start screen 1.2.0 · Endless Liminal Spaces 1.1.0 · The Great Path (Rudon's Plane) 1.1.0
### Added
- **Mouse buttons** (with the mouse captured): right button switches the flashlight (both worlds), left button uses things in the Great Path world (the case and the lever in the round room, lying down on the roof). The keys still work. (Start screen 1.2.0: controls and hints.)
- **L on the open map** (Great Path, dev): reveal / hide the whole map, explored or not — the journey's whole length is laid out first. Place names of every place are shown, and double-clicking any walkable spot teleports there. Your explored map is kept; L again goes back to it. (L outside the map still switches the work lights.)

## [0.11.0] - 2026-10-30
Parts: start screen 1.1.0 · Endless Liminal Spaces 1.0.0 · The Great Path (Rudon's Plane) 1.0.1
### Added
- **Separate versions** for each part of the game: the start screen (shell, menus, options), Endless Liminal Spaces and The Great Path. Each tile shows its world's version; the footer shows the start screen's version and the release. Each part starts from 1.0.0 (the state of 0.10.0); this release's changes make the start screen 1.1.0 and The Great Path 1.0.1.
- **Credits on the Great Path tile**: the story's author (Solar Sands) and links to both films — part 1 and the full story; also on the Great Path screen.
- **The menu background follows the world**: pointing at the Great Path tile (or being in its screen) shows that world behind the menu; the endless world renders live behind its own screens.
### Changed (The Great Path 1.0.1)
- **Sunbeams** are soft: each face fades out towards its edges, the top and the floor, with slowly drifting procedural streaks and a slow breathing, different for every beam. **Dust** in the beams is smaller, twinkles and swirls (each mote sinks at its own speed, sways and now and then lifts).

## [0.10.0] - 2026-10-30
### Added
- **Loading screens**: one while the game downloads and starts (no more blank page), and one when a walk starts — the endless world ("Building the space…") and the Great Path, which builds in steps with a progress bar (loading the code, textures/rooms/light, statues and the journey, the surface, placing you). The screen stays until the new world has drawn its first frames (they stutter while shaders compile). A spinning ring keeps turning while the world is built.

## [0.9.1] - 2026-10-30
### Fixed
- **The game froze after the mirror room**: when the next place of the story guide could not be reached through the halls (it is on the roof, or behind the roof), the guide searched for a route again on every frame, allocating big buffers — the frame rate collapsed and grew worse the further you walked. A failed search now waits 1.5 s, and the guide routes through the nearest staircase (its foot in the halls, its hole on the roof); on the roof it points straight at the target.
- **Teleports could drop you under the map**: place labels can lie on a wall, above a drop or over the open air by the ocean. A teleport now lands on the nearest spot where you can stand (low places included). If you ever fall out of the world, you are put back where you last stood.
- The hallway beyond the mirror room had no skylights; it has them now (as in the story).

## [0.9.0] - 2026-10-30
### Added
- **Compass on the minimap** (Great Path world): N E S W on the rim (N in red), ticks every 22.5°, a marker and the number of degrees you are facing (0° = north, clockwise).
### Changed
- Story times of an hour or more are written as h:mm:ss (1:45:42 instead of 105:42) — in the HUD, the map, the guide, the notes and the docs.

## [0.8.1] - 2026-10-30
### Fixed
- **Round shapes were inside-out** in the Great Path world (columns, plants, stools, funnels and bowls, pipes, cups, lamps, wheels…): their faces were wound the wrong way, so the outside was culled and you saw their inside — the columns in the room of columns looked hollow and you could walk "into" them. All such faces are now correct (checked: every one of ~940 000 mesh triangles faces the way its normal points).
- Round colliders are a little smaller (they were squares around the circle, sticking out at the corners). If you ever end up inside something, you can now walk out of it.
- Checked with the model doctor (Space `tools/modeldoctor.js`): the statues' feet now meet their legs; lines and the plaque on the surface no longer flicker against the plane; the stair treads and risers and the shaft walls under the hatches no longer share planes.

## [0.8.0] - 2026-10-30
### Added
- Options > Audio: **Footsteps** volume slider (both worlds: your footsteps and landing). Default 50 % — footsteps are half as loud as before. Footsteps heard as part of scary events are not affected.

## [0.7.1] - 2026-10-30
### Fixed (Great Path world, found with a layout audit: props in walls, overlaps, floating things, notes in the air)
- West Path: the patch of missing ceiling panels could touch a skylight, so the raised ceiling cut into the skylight well; patches now sit between two skylights.
- Room of doors: the doors of its side walls stood in the First Outer Ring 200 m away; they are on the room's walls now. Its note moved to the passage in front (the walls are all doors).
- Notes hanging in the air: the Hub note (in the avenue opening), the First Outer Ring note (no walls left there — now on a pillar), the chapel note (now on the north wall beside the landing), the room of columns note (now on its west wall); the first-night note no longer overlaps a chalk mark.
- Planters (gardens) and lab benches (explorers' guild) reached into the walls; the gate in front of the map machine stood sideways inside the room — it now closes the way in.
- First Outer Ring clutter: stud frames, lumber and rubble no longer cross into walls or float inside the mine.
- Ceiling lamps are no longer placed into stud frames, steel doors and door frames.
- The journey: rain collectors below the shaft were drawn under the floor; cracks and trash went into the walls; a chair and a bed overlapped in the empty district; cupboards of the bar room went into the wall; glow strips in the room of columns went into the wall; the glass path's edge bearers flickered against the glass.

## [0.7.0] - 2026-10-29
### Added
- **The journey down the Great Path** (part 2 of the story, the full video *Rudon's Plane*): the endless east hallway is replaced by a ~2.9 km journey with every episode of the walk, each with a note saying what happened and how much was shortened: the doors shutting behind you, the last Vibra-cable, dusk and the first night (stars in the skylights, the camp), the explorers' marks and Rudon's red chalk, the niches, cracked concrete and the line where carpet begins, intersections with side halls ending in built-in shelves and a ramp, long nights, changing floors (concrete, carpet, floorboards), shapes scurrying over the skylights and a skylight curved outward, the turn-around point, **the blackout** (no light at all — and something that wears Mel Dogger's face, then running behind you until you reach the light), the first skylight, the broken skateboard, the **split that curves back into itself**, the long shallow room with bar stools, the offset hall, the **glass path over rushing water and an opening onto a violent ocean under a cloudy sky**, the **grate over an abyss** with howling wind, the **room of columns**, an **empty district** with muffled commotion that stops when you come near, the **shaft** where the floor gives way, the deeper hall with skylights in ever deeper wells, the **squeeze** (the ceiling comes down until you crawl, the flashlight dies, you get stuck), daylight again, black tiles, the **round room** (plate, platform, case, lever, staircase from the ceiling), the **surface** — a white plane under the sky with the dark dome on timbers and the inscription — the mirror staircase and another hallway that never ends, and the **ending** (lie down: the view rises to a sphere in the void, machines in orbit and the arriving ships).
- 24 new story-guide steps for part 2 (times from the full video), new zones, sounds (water, surf, wind in the abyss, the commotion, silence at night) and materials (taupe carpet, black tiles, floorboards, night sky).
- **E** (use) in the Great Path world; a prompt line and full-screen fades in the HUD.
- The walker stoops, crouches and crawls by itself under low ceilings.
### Changed
- **Statues are no longer solid** — you walk through them (they blocked passages).
- The Great Path statue scene and plaque moved to x = 96; the West Path is still endless with day notes.
- Sunbeams fade out with distance (they ignore fog and showed through from far away).
- The Great Path world's east side is generated differently (the layout of the Hub and part 1 is unchanged); the endless world's seeds are unchanged.

## [0.6.0] - 2026-10-29
### Added
- **Statues** of the story's scenes in the Great Path world: pale stone figures in poses (pointing, reading, sitting at desks, kneeling, climbing…) with faint, broken outlines, grouped where each scene happens, each with a brass plaque (story time and title). They are colliders and are built only near the player.
- **The story starts where the film starts**: “Begin the story” puts you at the gate of the West Court of Luceron and the guide follows the film's order (18 steps): the gate (02:18) → the lecture in the school (03:14) → every variation (06:21) → three explorers (06:45) → a girl with blond hair (10:51) → the permission slip (12:32) → a Vibra-cable station (15:38) → deep blue (15:55) → the chapel (16:44) → the cafeteria (21:16) → the holding room (25:21) → the verdict (35:33) → the senior explorer (42:56) → a mapping trip (45:47) → rain water (47:42) → the machine (49:15) → friends (53:10) → the Great Path. New places: the school (a classroom with a chalkboard, desks and chairs) and the holding room by the court.
- **Flashlight model**: only the torch is shown now (no hand) — an olive military torch with a knurled grip, rubber rings, grip lugs around the head, a black bezel and a lit lens; shorter and kept in the lower right corner; it keeps its size on screen at any field of view.
- **Save versioning**: the save carries a format version (`v`) and the game version; an older save is migrated on load (v1: the guide step is reset because the step order changed). Settings carry a version too. When a newer game version is published, the menu offers to reload.
### Changed
- Default **field of view 60°** (was 75°); a saved setting still at the old default moves to 60°, a value you chose stays.
- Code split: the Great Path game mode moved out of `core/app.js` into `core/path-mode.js`; `story/index.js` was split into `canvas-mats.js`, `signs.js`, `skylights.js`, `gate.js`, `fx.js` and `explored.js`.
### Fixed / faster
- Autosave every 5 s of real time (it used to count capped frame time, so slow machines saved less often).
- Statues reuse shared geometry and outlines (building a group is about 5× faster, no geometry churn); the layered gate's colliders no longer allocate on every collision query; the camera's far plane follows the fog distance in the Great Path world; the guide no longer recomputes its route every 8 s (a periodic hitch).

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
