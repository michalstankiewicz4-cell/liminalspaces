// First-person walker for the multi-level Great Path world: box-vs-cells collision with step-up (stairs, sills),
// gravity and falling (the chapel floor is 6 m down), jumping onto podiums, head bob. The body crouches and then
// crawls by itself where the ceiling comes down (the long squeeze on the Great Path) and stands up again after.
// `world` ({ blocked, support }) can be swapped (the surface above the halls has its own).
import { clamp } from '../core/util.js';

export const EYE = 1.62;
const R = 0.27, BODY = 1.75, STEP = 0.45, WALK = 2.9, RUN = 5.2, GRAV = 18, JUMP = 5.0;
const HEIGHTS = [1.75, 1.45, 1.15, 0.85, 0.62];   // standing, stooping, crouching, low crouch, crawling

export function createWalker(world) {
  const P = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, ground: true, bob: 0, bobAmp: 0, dist: 0, eyeY: EYE, moving: false, onStep: null, onLand: null,
    body: BODY, hold: false, world, lastFall: 0 };
  // the body height that fits at (x, z, y): the tallest of HEIGHTS not touching anything (0 = blocked even crawling)
  const free = (x, z, y, h) => !P.world.blocked(x - R, z - R, x + R, z + R, y + Math.min(STEP, h - 0.12), y + h);
  const fit = (x, z, y) => {
    if (free(x, z, y, BODY)) return BODY;                          // the usual case: one query
    const low = HEIGHTS[HEIGHTS.length - 1];
    if (!free(x, z, y, low)) return 0;                              // a wall: blocked at any height
    for (let i = 1; i < HEIGHTS.length - 1; i++) if (free(x, z, y, HEIGHTS[i])) return HEIGHTS[i];
    return low;
  };
  // if the body is already inside something (a collider that changed, a teleport), it may move freely until it is out
  let embedded = false;
  const hits = (x, z, y) => { if (embedded) return false; const h = fit(x, z, y); if (!h) return true; if (h < P.body) P.body = h; return false; };

  P.place = (x, z, yaw = 0) => {
    P.x = x; P.z = z; P.yaw = yaw; P.pitch = 0; P.vx = P.vz = P.vy = 0; P.dist = 0;
    const s = P.world.support(x - R, z - R, x + R, z + R, 50);
    P.y = Number.isFinite(s) ? s : 0; P.body = fit(x, z, P.y) || HEIGHTS[HEIGHTS.length - 1]; P.eyeY = P.y + P.body * 0.925; P.ground = true;
  };

  // ctl: { look: {x,y}, turn, move: {x, z}, sprint, jump }
  P.update = (dt, ctl, opts) => {
    const s = 0.0022 * opts.sens;
    P.yaw -= ctl.look.x * s + ctl.turn * 2.2 * dt;
    P.pitch = clamp(P.pitch - ctl.look.y * s * (opts.invertY ? -1 : 1), -1.5, 1.5);
    // stand up again where there is room (one size per frame)
    for (let i = 0; i < HEIGHTS.length - 1; i++) if (HEIGHTS[i + 1] <= P.body + 1e-6 && HEIGHTS[i] > P.body + 1e-6) { if (fit(P.x, P.z, P.y) >= HEIGHTS[i]) P.body = HEIGHTS[i]; break; }
    const low = P.body < 1.5;
    const sp = (ctl.sprint && !low ? RUN : WALK) * (P.body < 0.7 ? 0.28 : P.body < 1.0 ? 0.45 : P.body < 1.3 ? 0.65 : 1) * (P.hold ? 0 : 1);
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const tx = (fx * ctl.move.z + rx * ctl.move.x) * sp, tz = (fz * ctl.move.z + rz * ctl.move.x) * sp;
    const acc = 1 - Math.exp(-(P.ground ? 11 : 2.5) * dt);
    P.vx += (tx - P.vx) * acc; P.vz += (tz - P.vz) * acc;
    if (ctl.jump && P.ground && !low && !P.hold) { P.vy = JUMP; P.ground = false; }

    embedded = !fit(P.x, P.z, P.y);
    // horizontal movement in small sub-steps, axis by axis (slides along walls)
    const ox = P.x, oz = P.z;
    const n = Math.max(1, Math.ceil(Math.hypot(P.vx, P.vz) * dt / 0.08));
    for (let k = 0; k < n; k++) {
      const nx = P.x + P.vx * dt / n;
      if (!hits(nx, P.z, P.y)) P.x = nx; else P.vx *= 0.3;
      const nz = P.z + P.vz * dt / n;
      if (!hits(P.x, nz, P.y)) P.z = nz; else P.vz *= 0.3;
      // step up onto anything within STEP
      const sup = P.world.support(P.x - R, P.z - R, P.x + R, P.z + R, P.y + STEP);
      if (sup > P.y && P.vy <= 0.01) { P.y = sup; P.vy = 0; P.ground = true; }
    }
    // vertical
    P.vy -= GRAV * dt;
    let ny = P.y + P.vy * dt;
    const sup = P.world.support(P.x - R, P.z - R, P.x + R, P.z + R, P.y + 0.05);
    if (P.vy > 0 && P.world.blocked(P.x - R, P.z - R, P.x + R, P.z + R, ny + P.body - 0.05, ny + P.body + 0.02)) { P.vy = 0; ny = P.y; }   // head bump
    if (ny <= sup) { if (!P.ground && P.vy < -4) { P.lastFall = P.vy; if (P.onLand) P.onLand(-P.vy); } P.y = sup; P.vy = 0; P.ground = true; }
    else { P.y = ny; P.ground = ny - sup < 0.03; }

    const moved = Math.hypot(P.x - ox, P.z - oz);
    P.dist += moved;
    P.moving = moved > 0.3 * dt;
    const v = moved / Math.max(dt, 1e-6);
    P.bobAmp += ((P.ground && P.moving ? Math.min(1, v / WALK) : 0) - P.bobAmp) * (1 - Math.exp(-8 * dt));
    if (P.ground && P.moving) { const b0 = Math.floor(P.bob / Math.PI); P.bob += dt * v * 2.1; if (Math.floor(P.bob / Math.PI) !== b0 && P.onStep) P.onStep(); }
    // smooth the eye over step-ups, follow falls immediately
    const target = P.y + P.body * 0.925;
    P.eyeY = target < P.eyeY ? target : P.eyeY + (target - P.eyeY) * (1 - Math.exp(-14 * dt));
  };

  P.eye = (bobOn) => {
    const b = bobOn ? P.bobAmp : 0;
    return { x: P.x + Math.cos(P.yaw) * Math.sin(P.bob) * 0.03 * b, y: P.eyeY + Math.abs(Math.sin(P.bob)) * 0.05 * b - 0.025 * b, z: P.z - Math.sin(P.yaw) * Math.sin(P.bob) * 0.03 * b };
  };
  return P;
}
