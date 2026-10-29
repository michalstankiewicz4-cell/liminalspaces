// First-person walker for the multi-level Great Path world: box-vs-cells collision with step-up (stairs, sills),
// gravity and falling (the chapel floor is 6 m down), jumping onto podiums, crouch-free 1.75 m body, head bob.
import { clamp } from '../core/util.js';

export const EYE = 1.62;
const R = 0.27, BODY = 1.75, STEP = 0.45, WALK = 2.9, RUN = 5.2, GRAV = 18, JUMP = 5.0;

export function createWalker(world) {
  const P = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, ground: true, bob: 0, bobAmp: 0, dist: 0, eyeY: EYE, moving: false, onStep: null, onLand: null };
  const hits = (x, z, y) => world.blocked(x - R, z - R, x + R, z + R, y + STEP, y + BODY);

  P.place = (x, z, yaw = 0) => {
    P.x = x; P.z = z; P.yaw = yaw; P.pitch = 0; P.vx = P.vz = P.vy = 0; P.dist = 0;
    const s = world.support(x - R, z - R, x + R, z + R, 50);
    P.y = Number.isFinite(s) ? s : 0; P.eyeY = P.y + EYE; P.ground = true;
  };

  // ctl: { look: {x,y}, turn, move: {x, z}, sprint, jump }
  P.update = (dt, ctl, opts) => {
    const s = 0.0022 * opts.sens;
    P.yaw -= ctl.look.x * s + ctl.turn * 2.2 * dt;
    P.pitch = clamp(P.pitch - ctl.look.y * s * (opts.invertY ? -1 : 1), -1.5, 1.5);
    const sp = ctl.sprint ? RUN : WALK;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const tx = (fx * ctl.move.z + rx * ctl.move.x) * sp, tz = (fz * ctl.move.z + rz * ctl.move.x) * sp;
    const acc = 1 - Math.exp(-(P.ground ? 11 : 2.5) * dt);
    P.vx += (tx - P.vx) * acc; P.vz += (tz - P.vz) * acc;
    if (ctl.jump && P.ground) { P.vy = JUMP; P.ground = false; }

    // horizontal movement in small sub-steps, axis by axis (slides along walls)
    const ox = P.x, oz = P.z;
    const n = Math.max(1, Math.ceil(Math.hypot(P.vx, P.vz) * dt / 0.08));
    for (let k = 0; k < n; k++) {
      const nx = P.x + P.vx * dt / n;
      if (!hits(nx, P.z, P.y)) P.x = nx; else P.vx *= 0.3;
      const nz = P.z + P.vz * dt / n;
      if (!hits(P.x, nz, P.y)) P.z = nz; else P.vz *= 0.3;
      // step up onto anything within STEP
      const sup = world.support(P.x - R, P.z - R, P.x + R, P.z + R, P.y + STEP);
      if (sup > P.y && P.vy <= 0.01) { P.y = sup; P.vy = 0; P.ground = true; }
    }
    // vertical
    P.vy -= GRAV * dt;
    let ny = P.y + P.vy * dt;
    const sup = world.support(P.x - R, P.z - R, P.x + R, P.z + R, P.y + 0.05);
    if (P.vy > 0 && world.blocked(P.x - R, P.z - R, P.x + R, P.z + R, ny + BODY - 0.05, ny + BODY + 0.02)) { P.vy = 0; ny = P.y; }   // head bump
    if (ny <= sup) { if (!P.ground && P.vy < -4 && P.onLand) P.onLand(); P.y = sup; P.vy = 0; P.ground = true; }
    else { P.y = ny; P.ground = ny - sup < 0.03; }

    const moved = Math.hypot(P.x - ox, P.z - oz);
    P.dist += moved;
    P.moving = moved > 0.3 * dt;
    const v = moved / Math.max(dt, 1e-6);
    P.bobAmp += ((P.ground && P.moving ? Math.min(1, v / WALK) : 0) - P.bobAmp) * (1 - Math.exp(-8 * dt));
    if (P.ground && P.moving) { const b0 = Math.floor(P.bob / Math.PI); P.bob += dt * v * 2.1; if (Math.floor(P.bob / Math.PI) !== b0 && P.onStep) P.onStep(); }
    // smooth the eye over step-ups, follow falls immediately
    const target = P.y + EYE;
    P.eyeY = target < P.eyeY ? target : P.eyeY + (target - P.eyeY) * (1 - Math.exp(-14 * dt));
  };

  P.eye = (bobOn) => {
    const b = bobOn ? P.bobAmp : 0;
    return { x: P.x + Math.cos(P.yaw) * Math.sin(P.bob) * 0.03 * b, y: P.eyeY + Math.abs(Math.sin(P.bob)) * 0.05 * b - 0.025 * b, z: P.z - Math.sin(P.yaw) * Math.sin(P.bob) * 0.03 * b };
  };
  return P;
}
