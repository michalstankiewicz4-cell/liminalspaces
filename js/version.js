// Versions (semver).
// VERSION is the release of the whole repository: every push = a new release (bump it, add an entry to
// CHANGELOG.md, run `node tools/check-version.mjs`). Each part of the game also has its own version, bumped when
// that part changes, and named in the changelog entry: the start screen (shell, menus, options) and every world.
export const VERSION = '0.19.0';
export const VERSIONS = {
  menu: '1.7.0',       // start screen, menus, options, HUD shell
  endless: '2.0.1',    // Endless Liminal Spaces (procedural world, multiplayer)
  path: '1.6.2',       // The Great Path — "Rudon's Plane" by Solar Sands
  tumi: '1.0.0',       // Tumithak of the Corridors — the story by Charles R. Tanner (caves)
};
