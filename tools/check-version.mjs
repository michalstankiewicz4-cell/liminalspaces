// Version check before pushing: node tools/check-version.mjs
// Verifies: (1) the release VERSION in js/version.js equals the newest CHANGELOG.md entry,
// (2) the release is higher than the last pushed one (origin/main) and than the highest vX.Y.Z tag (if any),
// (3) every part's version (VERSIONS: start screen, worlds) is valid and not lower than the pushed one.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const RE = /VERSION\s*=\s*'(\d+\.\d+\.\d+)'/;
const parse = (v) => v.split('.').map(Number);
const gt = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
const fail = (m) => { console.error('Version error: ' + m); process.exit(1); };

const ver = RE.exec(readFileSync(new URL('../js/version.js', import.meta.url), 'utf8'))?.[1];
if (!ver) fail('VERSION not found in js/version.js');
const log = /^## \[(\d+\.\d+\.\d+)\]/m.exec(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'))?.[1];
if (log !== ver) fail(`js/version.js = ${ver}, but the first CHANGELOG.md entry = ${log}`);

sh('git fetch -q origin +refs/heads/main:refs/remotes/origin/main');   // refresh the reference point (best effort)
const head = sh('git rev-parse HEAD'), remote = sh('git rev-parse origin/main');
const dirty = !!sh('git status --porcelain');
if (head && head === remote && !dirty) { console.log(`OK: version ${ver}, HEAD == origin/main (nothing new to push)`); process.exit(0); }
if (dirty) console.log('Note: there are uncommitted changes — the version must be higher than the pushed one.');

const baseline = [];
const parts = (src) => Object.fromEntries([...(/VERSIONS\s*=\s*\{([^}]*)\}/.exec(src)?.[1] || '').matchAll(/(\w+):\s*'(\d+\.\d+\.\d+)'/g)].map((m) => [m[1], m[2]]));
const mine = parts(readFileSync(new URL('../js/version.js', import.meta.url), 'utf8'));
if (!Object.keys(mine).length) fail('VERSIONS (versions of the parts) not found in js/version.js');
const theirs = parts(sh('git show origin/main:js/version.js'));
for (const [k, v] of Object.entries(theirs)) {
  if (!mine[k]) fail(`part "${k}" was removed from VERSIONS`);
  if (gt(parse(v), parse(mine[k]))) fail(`part "${k}" went down: ${v} -> ${mine[k]}`);
}
console.log('Parts: ' + Object.entries(mine).map(([k, v]) => `${k} ${v}` + (theirs[k] && theirs[k] !== v ? ` (was ${theirs[k]})` : '')).join(', '));
const sent = RE.exec(sh('git show origin/main:js/version.js'))?.[1];
if (sent) baseline.push(['origin/main', sent]);
const tag = sh("git tag --list 'v*.*.*' --sort=-v:refname").split('\n').filter(Boolean)[0]?.slice(1);
if (tag) baseline.push(['tag v' + tag, tag]);
for (const [name, v] of baseline) if (!gt(parse(ver), parse(v))) fail(`version ${ver} is not higher than ${name} (${v}) — bump it`);
console.log(`OK: version ${ver}` + (baseline.length ? ' (> ' + baseline.map(([n, v]) => `${n} ${v}`).join(', ') + ')' : ' (no reference point)'));
