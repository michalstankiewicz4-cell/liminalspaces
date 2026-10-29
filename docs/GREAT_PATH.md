# The Great Path world — register of the environment

The second world of the game (start screen, right tile) is built from the story **“Rudon's Plane – Part 1”** by Solar Sands (YouTube, video `mA6P2KK49zk`, 55:41). This file records every description of the surroundings in the story, with its timestamp, and where and how it is built in the game. Fan-made, non-commercial; no text of the story is reproduced in the game — the notes on the walls are written for the game. No people are placed in the world.

Layout code: `js/story/layout.js` (coordinates in metres, +x = east, +z = south, the Hub around (0, 0)). Zone table with story timestamps: `ZONES` in the same file.

## Scale and shortened routes
The story's distances are far too long to walk in a game (hours, days, months). Every shortened stretch has a paper note on the wall (key `gp.n.*` in `js/i18n/en.js` / `pl.js`) saying what the story distance is and what it is in the game. Proportions of rooms are kept: tight places stay tight (closet of the door room, the senior explorer's office, the door-after-door passage, mine tunnels), big places stay big (the chapel is 56 × 56 m with a 9.35 m high hall, the cafeteria and plaza are large).

| Story | In the game | Note |
|---|---|---|
| District rings: Hub, First Outer Ring (~1 mile), Second Outer Ring (4–5 miles), Wastelands (dozens of miles) | Hub ±60 m, Ring 1 to ±100 m, Ring 2 to ±160 m, Wastelands south of z = 160 | `gp.n.hub`, `gp.n.ring1`, `gp.n.ring2` |
| Vibra-cable stations every ~1,000 ft, for 3 miles | every 50 m along the Wastelands hall | `gp.n.cable` |
| Walk from the Wastelands door to the chapel: well over half an hour | ~240 m | `gp.n.wastes` |
| Corridors run straight for an hour or more, then a dead end | ~120 m | `gp.n.deadEndStart`, `gp.n.deadEnd` |
| The Great Path: scouts walked 3 months each way (6 months) | infinite; every 200 m ≈ one day, a note every 200 m | `gp.n.greatPath`, `gp.n.day` |
| The West Path: end never found | infinite, same day notes | `gp.n.westPath`, `gp.n.dayWest` |

## Register (story order)
| Time | Story element | In the game (where / how) |
|---|---|---|
| 00:22 | Everything exists within an 11 ft tall space | Standard ceiling `H = 3.35` m everywhere (`grid.js`) |
| 00:37 | Labyrinthine rooms and hallways for miles in every direction | Hub rooms, ring hallway grid, dense rooms, infinite paths |
| 00:42 | Ceiling: sheet-rock panels over an indestructible metal | Ceiling tile material; in Ring 1 panels are missing in patches and the metal (`agarite`) shows 15 cm higher |
| 00:55 | Floor can be dug; below only soil and stone | The mine descends 8 m into soil/rock (`mine` zone) |
| 01:20 | Convoluted metal doors, layer after layer, opening right, left, up into the ceiling, down into the floor | The layered gate (6 steel doors) at the east wall of the court; opens in sequence when you start “at the gate” (`gates` in `layout.js`, animation in `story/index.js`) |
| 01:47 | The judge, the court | West Court of Luceron: parquet hall, judge's desk, benches (`court` zone) |
| 02:34 | Long yellow-beige hallway, skylights let squares of sunlight onto the floor | The Great Path: 3 m wide hall, skylight every 8 m with a sun square and a dusty sunbeam |
| 03:25 | The Great Path runs along the right (east) half of the district | Starts at the court gate at x = 60 and runs east forever |
| 04:23 | Stories of creatures scratching at the skylights | Scratching episodes at a skylight near the player (sound positioned at the skylight, muffled by the glass), a dark shape on the glass and a dimmed sunbeam; nothing is ever seen clearly (`story/sounds.js`, `scratchVisual` in `story/index.js`) |
| 05:03 | Scavengers break down walls and take the lumber | Ring 1: open area with pillars, wall stubs, stud frames, lumber piles, drywall rubble |
| 05:20 | A flat endless maze of hallways and skylights | Overall structure; skylights in avenues, gardens, paths |
| 05:52 | Don't sit under skylights for too long (sun radiation) | Sun exposure: standing in a sun square warms, shimmers and bleaches the view, warns and slows you; recovers in the shade (`heat` in the pixel pipeline, exposure in `core/app.js`) |
| 06:26 | Variations noted in a sketch book: a rogue hole in a wall, a piece cut out of the carpet | Dense rooms: a hole through a wall at waist height; a patch of carpet cut out to the subfloor |
| 07:10 | Luceron: four rings; the Hub has cafeterias, tailors, factories, vendors, gardens, offices, everything within half an hour on foot | Hub: plaza, avenues, cafeteria, market with a tailor, factory, gardens, offices |
| 07:40 | First Outer Ring: population falls off; walls knocked down a mile out, then mining in one direction | Ring 1 (`ring1`), mine entrance in its west part, tunnel heading away from the Hub |
| 08:02 | Second Outer Ring: barren hallways, very few rooms | Ring 2: hallway grid every 24 m, six small rooms |
| 08:14 | Wastelands behind steel doors and guards; sparse hallways leading to clusters of dense rooms and unusual structures | Steel door at z = 160 with a guard booth (empty), Wastelands hall, the dense-room cluster |
| 08:37 | A huge empty room with a steel floor, doors every ~4 ft on each wall, each opening to another door, until a room barely big enough for one person | Room of doors (12 × 12 m, steel floor, doors on all walls); one opens into a 1 m passage with six door frames and a 1 × 1 m closet |
| 09:11 | Solid boxes of drywall jutting out of walls | Five drywall boxes in the dense rooms |
| 09:28 | Skirting boards appear in some sections and disappear in others | Skirting per room / per 16 m segment, random |
| 09:34 | Vents near the ceiling leading only a few feet behind the wall | Vent grilles with 1 m deep recesses |
| 12:28 | Security at the Wastelands entrance; a guard with a permission slip | Guard booth with desk, chair, lamp and a window (no person) |
| 13:48 | Vibra-cable: steel cable secured to the wall, stations about every 1,000 ft, speak into a tin cup | Cable on the west wall of the Wastelands hall; stations with a tin cup every 50 m |
| 15:03 | Yellow hallways just like home, random patterns of colour patches and scuff marks | `wallpaperOld` texture: patches, seams, scuffs low on the wall |
| 15:55 | The hallway turns deep blue at the end; the cable stops abruptly | Blue hall (z 370–400) with blue lamps; the cable ends frayed at z = 380 |
| 16:21 | An enormous, roughly square room; the floor falls ~20 ft | The chapel: 56 × 56 m, floor at −6 m |
| 16:38 | Square podiums of every height jutting from the floor and the ceiling | Podiums on a 2.5 m grid, rising and hanging; a 15-step podium stair leads down |
| 16:44 | A beam of sunlight from a square skylight bathes a decoration on the wall: a simplified map | Skylight by the south wall, sunbeam with dust, the builders' symbol relief |
| 16:59 | “A chapel” | Name of the zone |
| 18:50 | Collapses in the farther mining grounds | Collapsed end of the mine cavern (rubble, closed rock) |
| 20:09 | A large cafeteria | Cafeteria: tables with benches, serving counter |
| 36:43 | Mining unit 40 | Note at the mine entrance |
| 42:50 | A cramped office at the end of a room full of scientific equipment | Explorers' guild lab (lab benches, instruments, crates of food bricks, water jugs, bikes with cable drums, backpacks) and the senior explorer's small office |
| 43:28 | The longest corridors end in a blank wall; behind the first layer more ceiling material (Agarite) | Dead-end corridor west of the Wastelands hall; broken drywall, Agarite behind |
| 46:15 | Chalk marks on the left side of the wall | Chalk marks on the left wall of the Wastelands hall and the Great/West Paths |
| 46:43 | Bicycles with huge drums of steel cable | Two bikes with cable drums in the guild |
| 46:56 | Hyper-preserved bricks of dried food in boxes | Crates with food bricks in the guild |
| 47:42 | Rain water collectors: a metal funnel above the ceiling, a pipe down to waist level, a bowl; larger ones in the centre | Small collectors every 160 m along the paths; a big one under the plaza skylight |
| 48:48 | A library of every paper map; at the back, behind a gate, a machine with a lit glass map | Map library (shelves of map rolls, a map table), barred opening, the map machine room |
| 49:25 | The big map: lines from the centre at 90° and 45°; corners marked “2 months” | The machine's screen and the chapel relief (`drawSymbol` in `story/textures.js`) |
| 50:33 | The path opposite (west) — end not found; maybe they connect | The West Path, infinite (they do not connect yet — TODO) |
| 52:50 | A skateboard allowed for the journey | Not placed yet |

## Story guide (`js/story/route.js`)
The story starts where the film starts — at the gate of the West Court of Luceron (01:20) — and the guide follows the film's order: the gate opens (02:18) → the lecture in the school (03:14) → every variation, the sketch (06:21) → three explorers (06:45) → a girl with blond hair (10:51) → the permission slip at the Wastelands door (12:32) → a Vibra-cable station (15:38) → deep blue (15:55) → the chapel (16:44) → the cafeteria (21:16) → the holding room (25:21) → the verdict in the court (35:33) → the senior explorer's office (42:56) → a mapping trip to the dead end (45:47) → rain water at the collector (47:42) → the machine (49:15) → friends' visit (53:10) → the Great Path (02:34, the opening scene).

## Statues (`js/story/statues.js`)
Every guide step has a tableau of pale stone figures with faint broken outlines showing that scene, and a brass plaque on a pedestal with its story time and title. They are interpretations for the game (poses and groups), not exact shots. Rudon is not shown at the gate — the player is Rudon there. New places built for them: the school (03:14; classroom with a chalkboard, desks and chairs, a corridor from the West Court) and the holding room (25:21; a small room with a door off the court). The short texts shown on arrival (`gp.sd.*`) are written for the game.

## Sounds and events
Sound sources and ambience follow the places above (`js/story/audio.js`); the scary events (`js/story/events.js`) are inventions in the spirit of the story's ghost stories and anomalies, not scenes from it — except the Vibra-cable signal (three plucks, 14:09) and the collapses (18:50).

## Not built yet (ideas)
- Districts' homes, hospital area; Rudon's backpack and skateboard at the gate (shown only on the statues).
- The theory that the Great Path and the West Path curve and meet.
