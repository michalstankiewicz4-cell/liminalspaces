# Guidance for the assistant (Claude Code) working in this repo

Project: browser game "Liminal Spaces" (first-person, endless procedural liminal spaces, three.js, pixel-art filter). Full context: `docs/ARCHITECTURE.md`; plan: `TODO.md`, `docs/MULTIPLAYER.md`. Engine origin: the owner's repo `michalstankiewicz4-cell/VS` (Capital Quarantine).

## Standing rules (from the owner)
- **Every push = a new version**: bump the release `VERSION` in `js/version.js`, add an entry at the top of `CHANGELOG.md`, run `node tools/check-version.mjs`, then push to `main`; state the version number in your reply.
- **Each part has its own version** (`VERSIONS` in `js/version.js`: the start screen `menu`, and every world/story — `endless`, `path` (Rudon's Plane), and future ones): bump the version of every part a push changes and name those parts with their new versions in the changelog entry (e.g. "Rudon's Plane 1.0.2"). Versions are shown on the start screen (tiles and footer).
- **Do not push tags** (the owner creates tags in Releases).
- No external scripts/CDNs; CSP `script-src 'self'`. three.js only locally from `vendor/`.
- Network only in multiplayer and only after the player opens it; the STUN server stays opt-in.
- Change only what was asked ("don't change anything else").
- Reply to the owner in Polish, concisely; say what was and was not verified. Everything in the repo (UI, code comments, docs) is in English; Polish exists only as the optional interface language in `js/i18n/pl.js`.
- Keep the module/folder structure (see the file map in `docs/ARCHITECTURE.md`); put new UI strings in both `js/i18n/en.js` and `pl.js`.
- The generator must stay deterministic: no `Math.random()` in `js/world/gen.js` (multiplayer relies on every client building the same world from the seed). Changing generation changes every seed — note it in the changelog.

## Practice
- The remote `main` may be ahead (workflow changes): `git pull --rebase origin main`.
- Headless tests: see "Testing" in `docs/ARCHITECTURE.md` (Playwright + SwiftShader; stub pointer lock).
