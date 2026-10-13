// First-person walker: mouse/keyboard look, walk/sprint/jump, circle-vs-box collision against the generated world,
// head bob and footstep events. Pure logic; the camera only copies its pose.
import { clamp } from '../core/util.js';
import { CELL } from './gen.js';

export const EYE = 1.6;
const RADIUS = 0.3, WALK = 3.0, RUN = 5.4, GRAV = 18, JUMP = 5.2;

export function createPlayer() {
  const P = {
    x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, vx: 0, vz: 0,
    ground: true, bob: 0, bobAmp: 0, dist: 0, moving: false,
    onStep: null,          // (inWater) => void
    onLand: null,
  };
  const boxes = [];

  P.place = (x, z, yaw = 0) => { P.x = x; P.z = z; P.y = 0; P.vy = 0; P.vx = P.vz = 0; P.yaw = yaw; P.pitch = 0; P.dist = 0; };

  // Pushes the player's circle out of every nearby box (two passes resolve corners).
  function collide(gen) {
    gen.solidsNear(P.x, P.z, boxes);
    for (let pass = 0; pass < 2; pass++) for (const b of boxes) {
      const nx = clamp(P.x, b[0], b[2]), nz = clamp(P.z, b[1], b[3]);
      const dx = P.x - nx, dz = P.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (RADIUS - d) / d; P.x += dx * k; P.z += dz * k; }
      else {   // centre inside the box: leave by the shortest side
        const l = P.x - b[0], r = b[2] - P.x, u = P.z - b[1], w = b[3] - P.z, m = Math.min(l, r, u, w);
        if (m === l) P.x = b[0] - RADIUS; else if (m === r) P.x = b[2] + RADIUS; else if (m === u) P.z = b[1] - RADIUS; else P.z = b[3] + RADIUS;
      }
    }
  }

  // ctl: { look: {x,y} pixels, turn: -1..1, move: {x (strafe), z (forward)}, sprint, jump }
  P.update = (dt, ctl, opts, gen) => {
    const s = 0.0022 * opts.sens;
    P.yaw -= ctl.look.x * s + ctl.turn * 2.2 * dt;
    P.pitch = clamp(P.pitch - ctl.look.y * s * (opts.invertY ? -1 : 1), -1.45, 1.45);

    const speed = ctl.sprint ? RUN : WALK;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const tx = (fx * ctl.move.z + rx * ctl.move.x) * speed, tz = (fz * ctl.move.z + rz * ctl.move.x) * speed;
    const acc = 1 - Math.exp(-(P.ground ? 12 : 3) * dt);
    P.vx += (tx - P.vx) * acc; P.vz += (tz - P.vz) * acc;

    if (ctl.jump && P.ground) { P.vy = JUMP; P.ground = false; }
    P.vy -= GRAV * dt;
    P.y += P.vy * dt;
    if (P.y <= 0) { if (!P.ground && P.vy < -4 && P.onLand) P.onLand(); P.y = 0; P.vy = 0; P.ground = true; }

    const ox = P.x, oz = P.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(P.vx, P.vz) * dt / 0.2));
    for (let k = 0; k < steps; k++) { P.x += P.vx * dt / steps; P.z += P.vz * dt / steps; collide(gen); }
    const moved = Math.hypot(P.x - ox, P.z - oz);
    P.dist += moved;
    P.moving = moved > 0.3 * dt;

    // head bob + footsteps (one step per half bob cycle)
    const sp = moved / Math.max(dt, 1e-6);
    P.bobAmp += ((P.ground && P.moving ? Math.min(1, sp / WALK) : 0) - P.bobAmp) * (1 - Math.exp(-8 * dt));
    if (P.ground && P.moving) {
      const before = Math.floor(P.bob / Math.PI);
      P.bob += dt * sp * 2.1;
      if (Math.floor(P.bob / Math.PI) !== before && P.onStep) P.onStep(!!gen.waterAt(Math.floor(P.x / CELL), Math.floor(P.z / CELL)));
    }
  };

  // Camera pose: eye position with optional head bob.
  P.eye = (bobOn) => {
    const b = bobOn ? P.bobAmp : 0;
    return { x: P.x + Math.cos(P.yaw) * Math.sin(P.bob) * 0.03 * b, y: P.y + EYE + Math.abs(Math.sin(P.bob)) * 0.05 * b - 0.025 * b, z: P.z - Math.sin(P.yaw) * Math.sin(P.bob) * 0.03 * b };
  };
  return P;
}
