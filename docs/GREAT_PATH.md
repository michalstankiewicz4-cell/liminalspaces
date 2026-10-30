# The Great Path world — register of the environment

The second world of the game (start screen, right tile) is built from the story **“Rudon's Plane – Part 1”** by Solar Sands (YouTube, video `mA6P2KK49zk`, 55:41) and, for the journey down the Great Path, from the full story **“Rudon's Plane”** (video `yeHm6IBG9tQ`, 1:53:13; its first 57 minutes retell part 1, the journey starts at 57:51). Part 1 times below refer to the first video, **part 2 times (59:21 and later) to the full video**. This file records every description of the surroundings in the story, with its timestamp, and where and how it is built in the game. Fan-made, non-commercial; no text of the story is reproduced in the game — the notes on the walls are written for the game. No people are placed in the world.

Layout code: `js/story/layout.js` (coordinates in metres, +x = east, +z = south, the Hub around (0, 0)). Zone table with story timestamps: `ZONES` in the same file.

## Scale and shortened routes
The story's distances are far too long to walk in a game (hours, days, months). Every shortened stretch has a paper note on the wall (key `gp.n.*` in `js/i18n/en.js` / `pl.js`) saying what the story distance is and what it is in the game. Proportions of rooms are kept: tight places stay tight (closet of the door room, the senior explorer's office, the door-after-door passage, mine tunnels), big places stay big (the chapel is 56 × 56 m with a 9.35 m high hall, the cafeteria and plaza are large).

| Story | In the game | Note |
|---|---|---|
| District rings: Hub, First Outer Ring (~1 mile), Second Outer Ring (4–5 miles), Wastelands (dozens of miles) | Hub ±60 m, Ring 1 to ±100 m, Ring 2 to ±160 m, Wastelands south of z = 160 | `gp.n.hub`, `gp.n.ring1`, `gp.n.ring2` |
| Vibra-cable stations every ~1,000 ft, for 3 miles | every 50 m along the Wastelands hall | `gp.n.cable` |
| Walk from the Wastelands door to the chapel: well over half an hour | ~240 m | `gp.n.wastes` |
| Corridors run straight for an hour or more, then a dead end | ~120 m | `gp.n.deadEndStart`, `gp.n.deadEnd` |
| The Great Path: more than a year of walking (part 2) | ~2.9 km from the gate to the round room; every episode has its stretch and a note (`journey.js`, `JX`) | `gp.n.greatPath`, `gp.n.j.*` |
| Beyond the half-way point: another hallway | infinite | `gp.n.j.beyond` |
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
| 03:25 | The Great Path runs along the right (east) half of the district | Starts at the court gate at x = 60 and runs east (part 2 below) |
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

## Part 2 — the journey down the Great Path (full video `yeHm6IBG9tQ`)
Layout: `js/story/journey.js` (painted per 32 m column; x positions in `JX`), events and the round room: `js/story/journey-run.js`, water and ocean: `water.js`, the surface: `surface.js`, the ending: `epilogue.js`. The hall runs along z = 0, after the offset along z = −1; floor 0, −0.45 after the offset, −7.45 below the shaft, down to −9.45 in the squeeze. Story time in the HUD for these zones is the full video's.

| Time | Story element | In the game (x, where / how) |
|---|---|---|
| 57:51 – 59:13 | The layered doors, the judge, "No sir", Adam, Nestor, Rebecca and the family; the long yellow-beige hallway with squares of sunlight | The gate of the court (part 1); statue scene and plaque at x ≈ 96 |
| 59:21 – 59:57 | Dull concrete, yellow walls, skylights every ~15 ft; scuff marks, trash that thins out | x 60 – 140: concrete floor, old wallpaper, trash and papers fading out (`trash`, `papers`) |
| 1:00:03 | The doors clank shut behind him a quarter-mile back | The gate closes when you pass x = 112; it opens again if you walk back to it |
| 1:00:31 | The first and last Vibra-cable, two miles in: "You are clear to proceed" | x 150 – 186: cable on the left wall, a station at x = 170 |
| 1:01:03 – 1:01:54 | No more decay; the sun weakens, 6 PM; the food cube on the stove | x 196 – 256: dusk zone (warm, weaker skylights), the meal at x = 229 |
| 1:02:00 – 1:02:58 | Night: he can hardly see; mattress, sleeping bag, one pillow; the silence | x 256 – 336: night zone — stars in the skylights, starlight only; the camp at x = 300; near-silent ambience |
| 1:03:15 – 1:03:42 | Explorers' marks at waist level on the left wall; he starts his own red chalk marks | x = 344: a group of white marks low on the left wall; red marks every 32 m from here to the end |
| 1:04:28 | Skateboarding; a rain funnel, water through the filter | Rain collectors under skylights every 160 m (x 84, 244, 404, …) |
| 1:05:21 – 1:06:21 | Reading while walking; human-sized niches with a hole at the bottom, every hour or so | Niches in the right wall at x 424, 464, 1012, 1396, 1572, 2236, 2780 (`toilet`) |
| 1:07:12 | An area with more cracks in the concrete | x 500 – 560: cracks in the floor (`crack`) |
| 1:07:28 – 1:08:06 | The floor turns to brownish-grey carpet at a straight line between skylights | x = 560 (between the skylights at 556 and 564) |
| 1:09:32 – 1:09:58 | The first intersection; side halls end after ~20 minutes | x = 640: a cross hall 38 m each way, dead ends |
| 1:11:20 – 1:12:15 | More intersections; one side hall ends with shelves built in, one with a ramp down to a wall ~12 ft deep | x = 720 (south arm: built-in shelves), x = 784 (north arm: 6 m ramp down 3.6 m) |
| 1:12:25 – 1:12:55 | Days shorter, nights longer, the light of the stars | x 808 – 896: night zone again |
| 1:13:44 – 1:13:59 | Concrete → carpet for a week → wooden floorboards → concrete; skylights always the same; counting them | x 904 – 1046: concrete, carpet, floorboards (`boards`), concrete |
| 1:14:07 – 1:14:36 | Something scurries across the skylights, a shadow, knocking | Passing x ≈ 1048 triggers a scratching episode at a skylight and knocks |
| 1:14:42 – 1:15:10 | A skylight curved outward; books stacked to peek over the edge | x = 1076: a glass dome over the skylight, a stack of books under it |
| 1:15:33 – 1:15:59 | Day 92: the turn-around intersection (explorers went right for 6 hours); "blackout" on the map | x = 1120: cross hall, south arm 40 m with a note at its end |
| 1:16:05 – 1:23:20 | No skylights: pitch black for more than a day; he turns back; a pale shape wearing Mel Dogger's face blocks the way; running steps behind him until the first skylight | x 1168 – 1304: no light at all (fog black). After ~14 s inside, a pale, wrong-proportioned figure stands ahead; when you come close or look away it is gone and running steps follow you until you leave the dark or reach a sun square |
| 1:23:16 – 1:23:46 | The first skylight; no force could make him turn back | x = 1308 |
| 1:23:58 – 1:24:34 | One year; the watch stopped; the skateboard broke | x = 1360: the broken skateboard |
| 1:25:22 – 1:28:09 | A split: a path to the left at a shallow angle; days later a three-way intersection with his own red mark — the path curved back into itself | x = 1442: a branch to a ring corridor (radius 24 m) that comes back to the branch; red marks on the ring |
| 1:28:47 – 1:29:05 | Half the food is gone | x = 1540: half a stack of empty boxes |
| 1:29:25 – 1:29:42 | A long shallow room on the left: bar stools bolted to the floor, a counter, cupboards | x 1610 – 1638, open to the hall |
| 1:29:48 | The hall continues offset a few feet to the left and down | x = 1680: 1 m to the left, 0.45 m down |
| 1:29:54 – 1:30:55 | A glass path with blue water and white foam flowing underneath; an opening to the outside: sun, an ocean flowing violently | x 1728 – 1832: glass panes over an animated water channel; x 1764 – 1796: an opening in the left wall with a sill; outside an animated ocean to the horizon and a sky with clouds (`water.js`; cells outside are "open to the sky", `F.OUT`) |
| 1:30:55 – 1:31:05 | Brownish carpet again | x 1832 – 1904 |
| 1:31:07 – 1:31:22 | A metal grate over a dark abyss, howling wind | x 1904 – 1952: a walkable grate over a 40 m deep pit, wind sound |
| 1:31:28 – 1:32:05 | A room of columns in a grid, no windows, a gentle glow along the path, footsteps like a roaring animal | x 1968 – 2088: 80 m wide room, columns every 5 m, glow strips, huge reverb |
| 1:32:07 – 1:33:06 | Halls branch off more and more; rooms with windows, dusty furniture; an empty district; muffled commotion that stops when he comes near | x 2104 – 2264: side halls every 16 m with two rooms each (interior windows, tables, chairs, beds, shelves); murmurs that fade as you approach |
| 1:33:17 – 1:35:16 | What seemed a wall goes down below the floor: a shaft, the path continues 20–30 ft below; he drops and breaks his arm; holds carved into the wall | x = 2304: a 4 m gap, the lower hall 7 m down; holds on the wall below the ledge; a hard landing shakes the view |
| 1:35:47 – 1:36:46 | Skylights built much higher into the ceiling; darker; broken glass, torn material, string | x 2308 – 2400: skylights in 2–4 m deep wells, trash at x 2340 – 2380 |
| 1:36:47 – 1:39:43 | Going deeper at a rate too slow to see; skylights higher, smaller, dimmer; the ceiling comes down; crouching, crawling | x 2400 – 2600: the floor sinks 2 m, the skylight wells deepen to 10 m, the ceiling comes down to 1.25 m; the walker stoops, crouches and crawls by itself |
| 1:39:43 – 1:43:19 | Pitch black squeeze; the flashlight runs out; stuck; "Help!"; a faint light beyond the backpack; through | x 2600 – 2700: the hall narrows to 1 m and the ceiling to 0.65 m; the flashlight dies; at x = 2676 you are stuck for a few seconds; then the ceiling rises again |
| 1:43:25 – 1:44:21 | The first skylight; a straight uninterrupted path | x = 2712 |
| 1:44:30 – 1:44:41 | The last meal at a rain spout | x = 2756 |
| 1:45:22 – 1:45:40 | Black square tiles that reflect the sunlight | x 2800 – 2886 (`blackTile`) |
| 1:45:42 – 1:46:51 | A large round room with skylights along its curved border; the hallway ends; a plate in the floor; a platform with a switch under a transparent case; the lever; a collapsible staircase comes down from the ceiling | Round room (radius 10 m) at x = 2896; step on the plate, the platform rises; **E** opens the case and pulls the lever; the lid slides away, the stairs come down, sunlight |
| 1:46:59 – 1:48:17 | Direct sunlight is warm, not burning; a white, flat, desolate plane forever; wind; the great blue sky | The surface (`surface.js`): white panels to the horizon, sky with moving clouds, wind; no sun burn up here |
| 1:48:17 – 1:49:06 | A dark bluish building with a domed roof, window spaces without glass, timbers underneath; a plaque covering the footprint: symbols, a circle with a line down the middle and a dot at its midpoint | The dome half-way between the two hatches, on 18 timber posts; the plaque under it |
| 1:49:06 – 1:49:49 | Lines in the floor into the distance; another gap and staircase — a mirror of his; his backpack; another hallway | Lines at 45° and 90°; the mirror room at x = 2976 with its stairs already down, and a hallway beyond it that never ends; his backpack lies in the first room |
| 1:49:57 – 1:50:48 | Letters, then our language: "You are at the half-way point of this Design – 20 … Codename: Rat Maze … Congratulations traveler"; technical jargon | Standing under the dome shows the inscription |
| 1:51:47 – 1:53:12 | He lies down and stares at the sky; rising above: a black speck on a white sheet, clouds, the plane curves into a sphere in a black void, machines in low orbit, ships arriving in ever greater numbers | After reading the inscription, **E** outside the dome: the ending cut scene (`epilogue.js`) |

Not built from part 2: his parents' goodbye in person, the books' content, washing clothes, the beard; the watch and day counting are only in the notes.
