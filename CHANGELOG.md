# Changelog

Versioning: `MAJOR.MINOR.PATCH`. Every push to the repository is a new version (number in `js/version.js` + an entry here).
The owner creates `vX.Y.Z` tags in GitHub Releases on commits from this history; pushing tags from a Claude session is blocked.
Bug fix = PATCH, new feature = MINOR, big change to gameplay, the save format or world generation (changes every seed) = MAJOR.

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
