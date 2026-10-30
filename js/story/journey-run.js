// What happens while you walk the journey down the Great Path (the places are painted by journey.js):
//  - the gate shuts behind you a quarter-mile in (60:03) and opens again if you come back to it,
//  - something scurries across the skylights and knocks (74:07),
//  - in the blackout a pale shape that wears Mel Dogger's face stands in the dark; when you turn or come close it is
//    gone and running steps follow you until you reach the light of a skylight (81:30 – 83:26),
//  - the flashlight's battery dies in the squeeze (101:04) and you get stuck for a while (101:25),
//  - the round room: the plate, the platform with the switch under its case, the lever, the staircase that comes
//    down from the ceiling and the sky above it (106:04 – 107:27); the mirror room's staircase is already down.
// It also builds the staircases, which the surface (surface.js) shares, and tells the game mode when the player
// climbs out onto the roof or back down.
import * as THREE from '../../vendor/three.module.js';
import { JX, STAIRS, base, SURFACE_Y } from './journey.js';
import { humanoid } from './statues.js';

const fwdOf = (w) => ({ x: -Math.sin(w.yaw), z: -Math.cos(w.yaw) });
const angDiff = (a, b) => Math.abs(((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);

// Step boxes of a staircase ([x0,y0,z0,x1,y1,z1], world), `drop` = how far it is still pulled up into the ceiling.
export function stairBoxes(st, drop = 0) {
  const { zc, f } = base(st.x0), out = [];
  for (let k = 1; k <= STAIRS.steps; k++) {
    const a = st.x0 + st.dir * (k - 1) * STAIRS.run, b = st.x0 + st.dir * k * STAIRS.run;
    out.push([Math.min(a, b), f + drop, zc - STAIRS.w / 2, Math.max(a, b), f + k * STAIRS.rise + drop, zc + STAIRS.w / 2]);
  }
  return out;
}
// The staircase as a mesh (steps with nosings, two stringers), for the halls and for the surface scene.
export function stairMesh(st, mats) {
  const g = new THREE.Group();
  const conc = mats.concrete || new THREE.MeshStandardMaterial({ color: 0xbfbab0, roughness: 0.85 });
  const steel = mats.steel || new THREE.MeshStandardMaterial({ color: 0x777b80, roughness: 0.4, metalness: 0.8 });
  const plain = (m) => { const c = m.clone(); c.vertexColors = false; return c; };
  const cm = plain(conc), sm = plain(steel);
  cm.color.setScalar(0.85); sm.color.setScalar(0.6);
  const { f } = base(st.x0);
  for (const b of stairBoxes(st)) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(b[3] - b[0], 0.06, b[5] - b[2]), cm);
    top.position.set((b[0] + b[3]) / 2, b[4] - 0.03 - f, (b[2] + b[5]) / 2);
    const rise = new THREE.Mesh(new THREE.BoxGeometry(0.03, STAIRS.rise - 0.062, b[5] - b[2] - 0.01), sm);      // under the tread, a bit narrower
    rise.position.set(st.dir > 0 ? b[0] + 0.015 : b[3] - 0.015, b[4] - 0.062 - (STAIRS.rise - 0.062) / 2 - f, (b[2] + b[5]) / 2);
    g.add(top, rise);
  }
  const L = STAIRS.steps * STAIRS.run, Hh = STAIRS.steps * STAIRS.rise, len = Math.hypot(L, Hh), ang = Math.atan2(Hh, L);
  const { zc } = base(st.x0);
  for (const s of [-1, 1]) {
    const str = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.05), sm);
    str.position.set(st.x0 + st.dir * L / 2, Hh / 2 - 0.1, zc + s * (STAIRS.w / 2 + 0.03));
    str.rotation.z = ang * st.dir;
    g.add(str);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.y = f;
  return g;
}
export const inHole = (st, x, z) => { const { zc } = base(st.x0); return x > st.hole[0] && x < st.hole[1] && Math.abs(z - zc) < 0.75; };

export function createJourney({ story, walker, hand, sound, pipe, hud, t, progress }) {
  const scene = story.scene, mats = story.materials;
  const st = { gate: 'open', scurried: false, blackT: 0, ghost: null, chase: null, outT: 99, battery: true, stuck: 0, stuckDone: false,
    lever: 0, leverT: 0, platformT: -1, caseOpen: false };
  const saved = (progress.path && progress.path.j) || {};
  let leverDone = !!saved.lever;

  /* ---- the round room: platform, case, lever, lid, stairs, sky above the hole ---- */
  const A = STAIRS.A, B = STAIRS.B, { zc: rz, f: rf } = base(JX.roomA);
  const stairsA = stairMesh(A, mats), stairsB = stairMesh(B, mats);
  scene.add(stairsA, stairsB);
  const H = 3.35;
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x9a978e, roughness: 0.8 });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(A.hole[1] - A.hole[0], 0.08, 1.5), lidMat);
  lid.position.set((A.hole[0] + A.hole[1]) / 2, rf + H - 0.03, rz);
  scene.add(lid);
  const skyPatch = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbcd6ee, fog: false }));
  skyPatch.position.set(JX.roomA + 4.7, SURFACE_Y + 25, rz);
  const skyPatchB = skyPatch.clone(); skyPatchB.position.x = JX.roomB - 4.7;
  scene.add(skyPatch, skyPatchB);
  const sunIn = new THREE.SpotLight(0xfff4dc, 0, 22, 0.55, 0.6, 1.2);
  sunIn.position.set((A.hole[0] + A.hole[1]) / 2, rf + H + 4, rz); sunIn.target.position.set(JX.roomA + 3, rf, rz);
  scene.add(sunIn, sunIn.target);
  // the platform rises from the floor north of the plate; on it the switch under a clear case (106:09)
  const plat = new THREE.Group();
  const pm = mats.steel.clone(); pm.vertexColors = false; pm.color.setScalar(0.45);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 0.5), pm); post.position.y = 0.475;
  const leverBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.2), pm); leverBase.position.y = 0.98;
  const leverArm = new THREE.Group(); leverArm.position.set(0, 1.0, 0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32), new THREE.MeshStandardMaterial({ color: 0xb0b4b8, metalness: 0.9, roughness: 0.3 }));
  rod.position.y = 0.16;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }));
  grip.position.y = 0.32; leverArm.add(rod, grip); leverArm.rotation.x = -0.6;
  const caseG = new THREE.Group(); caseG.position.set(0, 0.98, -0.12);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.26), new THREE.MeshStandardMaterial({ color: 0xd8e4e8, transparent: true, opacity: 0.28, roughness: 0.25, depthWrite: false }));
  glass.position.set(0, 0.21, 0.12); caseG.add(glass);
  plat.add(post, leverBase, leverArm, caseG);
  plat.position.set(JX.roomA, rf - 1.0, rz - 1.4);
  plat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(plat);
  const platSolid = [[JX.roomA - 0.25, rf, rz - 1.65, JX.roomA + 0.25, rf + 0.95, rz - 1.15]];
  let stairSolidsA = null;
  const stairSolidsB = stairBoxes(B);
  story.addSolids(stairSolidsB);
  function setStairsA(drop) {
    stairsA.position.y = rf + drop;
    if (stairSolidsA) story.removeSolids(stairSolidsA);
    stairSolidsA = drop < 0.01 ? stairBoxes(A) : null;
    if (stairSolidsA) story.addSolids(stairSolidsA);
  }
  function openedState(now) {
    leverDone = true; st.lever = 3; st.platformT = 1;
    plat.position.y = rf; st.caseOpen = true; caseG.rotation.x = -1.9; leverArm.rotation.x = 0.6;
    story.addSolids(platSolid);
    lid.position.z = rz + 1.6; lid.visible = false;
    setStairsA(0); sunIn.intensity = now ? 0 : 30;
  }
  if (leverDone) openedState(false); else setStairsA(STAIRS.steps * STAIRS.rise + 0.2);

  /* ---- the apparition in the dark (81:36) ---- */
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xa8a8a0, transparent: true, opacity: 0.0, fog: false });
  const ghostLine = new THREE.LineDashedMaterial({ color: 0xd0d0c0, transparent: true, opacity: 0.0, dashSize: 0.04, gapSize: 0.06, depthWrite: false });
  const ghost = humanoid({ s: 1.04, g: 0.82, pose: 'limp', hair: 'short' }, ghostMat, ghostLine);
  // "all the body parts of a human but not put together quite right"
  ghost.scale.set(0.92, 1.12, 1); ghost.children[0].rotation.z = 0.14;
  ghost.visible = false;
  scene.add(ghost);

  let promptKey = null;
  const near = (x, z, r) => Math.hypot(walker.x - x, walker.z - z) < r;

  function update(dt, walking, ctx) {
    promptKey = null;
    const zk = story.zoneKeyAt(walker.x, walker.z), x = walker.x;
    /* the gate shuts behind you, opens if you come back */
    if (st.gate === 'open' && x > JX.closeGate && Math.abs(walker.z) < 3) { st.gate = 'shut'; story.setGate(false); sound.shot('door', { x: 58, y: 1.5, z: 0 }, { ref: 14 }); sound.shot('door', { x: 58, y: 1.5, z: 0 }, { ref: 14, delay: 0.4 }); }
    else if (st.gate === 'shut' && x < 64 && x > 58 && Math.abs(walker.z) < 2) { st.gate = 'open'; story.setGate(true); }
    /* scurrying over the skylights, knocking */
    if (!st.scurried && x > JX.scurry && x < JX.scurry + 14 && walking) {
      st.scurried = true;
      const sky = story.pickSkylight(walker);
      if (sky) { sound.trigger(sky); sound.shot('knock', { x: sky.x, y: sky.y, z: sky.z }, { delay: 3.5 }); }
    }
    /* the blackout */
    const inBlack = zk === 'gpBlackout';
    st.outT = inBlack ? 0 : st.outT + dt;
    if (st.outT > 60) { st.blackT = 0; if (!st.chase) st.ghostDone = false; }
    if (inBlack && walking) st.blackT += dt;
    if (inBlack && !st.ghost && !st.chase && !st.ghostDone && st.blackT > 14 && x > JX.blackA + 30 && x < JX.blackB - 20) {
      // it stands ahead of you, along the hall, as if mirroring you
      const f = fwdOf(walker), dir = Math.sign(f.x) || 1;
      const gx = Math.max(JX.blackA + 6, Math.min(JX.blackB - 6, x + dir * 11));
      st.ghost = { t: 0, yaw0: walker.yaw, x: gx };
      ghost.position.set(gx, 0, walker.z * 0.3); ghost.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      ghost.visible = true;
    }
    if (st.ghost) {
      const g = st.ghost; g.t += dt;
      const k = Math.min(1, g.t / 3);
      ghostMat.opacity = 0.55 * k * (0.85 + Math.random() * 0.15); ghostLine.opacity = 0.35 * k;
      if (Math.random() < dt * 0.6) sound.heartbeat(0.8);
      pipe.fear = Math.max(pipe.fear, 0.6 * k);
      const d = Math.abs(walker.x - g.x), toG = Math.atan2(-(g.x - walker.x), -(ghost.position.z - walker.z));
      const looking = angDiff(walker.yaw, toG) < 0.9;
      if (d < 4.5 || (!looking && g.t > 2.5) || g.t > 14) {
        // gone; and then the running behind you
        ghost.visible = false; ghostMat.opacity = 0; st.ghost = null; st.ghostDone = true;
        st.chase = { t: 0, next: 0, dist: 9 };
        hud.toast(t('gp.j.run'), 3);
      }
    }
    if (st.chase) {
      const c = st.chase; c.t += dt; c.next -= dt;
      c.dist = Math.max(2.2, c.dist - dt * 0.5);
      if (c.next <= 0) {
        c.next = 0.22 + Math.random() * 0.05;
        const f = fwdOf(walker);
        sound.shot('step', { x: walker.x - f.x * c.dist, y: walker.y + 0.1, z: walker.z - f.z * c.dist }, { mat: 'grit' });
      }
      pipe.fear = Math.max(pipe.fear, 0.75);
      if (Math.random() < dt * 1.6) sound.heartbeat(1);
      if (!inBlack || story.sunAt(walker.x, walker.z) > 0) { st.chase = null; sound.staticBurst(0.12); }
    }
    /* the squeeze: the battery dies; stuck */
    if (zk === 'gpSqueeze' && x > JX.stuck - 30 && st.battery) {
      st.battery = false; st.batteryT = 0; hud.toast(t('gp.j.battery'), 4);
    }
    if (!st.battery) {
      st.batteryT = (st.batteryT || 0) + dt;
      hand.setOn(st.batteryT < 2.2 ? Math.random() < 0.45 : false);
      if (zk !== 'gpSqueeze' && x > JX.squeeze) { st.battery = true; hand.setOn(true); hud.toast(t('gp.j.batteryBack'), 4); }
      else if (x < JX.squeeze - 31) { st.battery = true; hand.setOn(true); }
    }
    if (!st.stuckDone && x > JX.stuck - 0.5 && x < JX.stuck + 2 && zk === 'gpSqueeze') { st.stuckDone = true; st.stuck = 7.5; hud.toast(t('gp.j.stuck'), 4); }
    if (x < JX.squeeze - 40) st.stuckDone = false;
    if (st.stuck > 0) {
      st.stuck -= dt;
      walker.hold = true;
      const pushing = ctx.move && Math.abs(ctx.move.z) > 0.1;
      ctx.shake.k = Math.max(ctx.shake.k, pushing ? 0.02 : 0.004);
      if (Math.random() < dt * 1.2) sound.heartbeat(1);
      if (st.stuck < 3 && !st.lightSeen) { st.lightSeen = true; hud.toast(t('gp.j.faint'), 4); }
      if (st.stuck <= 0) { walker.hold = false; st.lightSeen = false; hud.toast(t('gp.j.free'), 3); }
    } else walker.hold = false;
    /* the round room */
    if (!leverDone) {
      if (st.platformT < 0 && near(JX.roomA, rz, 0.8) && Math.abs(walker.y - rf) < 0.3) {
        st.platformT = 0; sound.shot('rumble', { x: JX.roomA, y: rf, z: rz }, { ref: 3 }); sound.clunk();
      }
      if (st.platformT >= 0 && st.platformT < 1) {
        st.platformT = Math.min(1, st.platformT + dt / 3.5);
        plat.position.y = rf - 1 + st.platformT;
        if (st.platformT >= 1) story.addSolids(platSolid);
      }
      if (st.platformT >= 1 && near(JX.roomA, rz - 1.4, 1.8)) promptKey = st.caseOpen ? 'gp.j.pull' : 'gp.j.case';
      if (st.lever === 1) {                      // pulled: whirring, the lid slides away, the stairs come down
        st.leverT += dt;
        leverArm.rotation.x = Math.min(0.6, -0.6 + st.leverT * 6);
        if (st.leverT > 1.5) lid.position.z = rz + Math.min(1.6, (st.leverT - 1.5) * 0.8);
        if (st.leverT > 3.5) { sunIn.intensity = Math.min(30, (st.leverT - 3.5) * 10); setStairsA(Math.max(0, (STAIRS.steps * STAIRS.rise + 0.2) * (1 - (st.leverT - 3.5) / 4))); }
        if (st.leverT > 7.6) { st.lever = 3; leverDone = true; lid.visible = false; setStairsA(0); sound.clunk(); hud.toast(t('gp.j.stairs'), 5); }
      }
    }
    return promptKey;
  }

  function use() {
    if (leverDone || st.platformT < 1 || !near(JX.roomA, rz - 1.4, 1.8)) return false;
    if (!st.caseOpen) { st.caseOpen = true; caseG.rotation.x = -1.9; sound.shot('step', { x: JX.roomA, y: rf + 1, z: rz - 1.4 }, { mat: 'tile' }); return true; }
    if (st.lever === 0) {
      st.lever = 1; st.leverT = 0; sound.clunk();
      sound.shot('rumble', { x: JX.roomA + 4, y: rf + 3, z: rz }, { ref: 4, delay: 0.8 });
      return true;
    }
    return false;
  }

  return {
    update, use,
    get flashBlocked() { return !st.battery; },
    get leverDone() { return leverDone; },
    // climbing out of a hole onto the roof (true = now on the surface)
    holeAt(x, z) { return inHole(A, x, z) ? A : inHole(B, x, z) ? B : null; },
    save() { return { lever: leverDone }; },
    reset() { st.gate = 'open'; st.scurried = false; st.ghost = null; st.chase = null; ghost.visible = false; st.battery = true; st.stuck = 0; walker.hold = false; },
  };
}
