/**
 * dieFactory.js — Die geometry, face detection, die lifecycle.
 * Pure die-level primitives. No scene management, no game logic.
 *
 * ES module. Depends on:
 *   - window.BABYLON (loaded via <script> before this module)
 *   - cannon-es (via importmap)
 */
import * as CANNON from 'cannon-es';

const BABYLON = window.BABYLON;

// ── Geometry constants ──────────────────────────────────────────────────────
export const SEGMENTS   = 40;
export const EDGE_R     = 0.13;
export const NOTCH_R    = 0.14;
export const NOTCH_D    = 0.12;
export const PIP_OFFSET = 0.23;

// ── Face axis table (Y+=1, Y-=6, X+=2, X-=5, Z+=3, Z-=4) ─────────────────
export const FACE_LOCALS = [
  { x:  0, y:  1, z:  0, val: 1 },
  { x:  0, y: -1, z:  0, val: 6 },
  { x:  1, y:  0, z:  0, val: 2 },
  { x: -1, y:  0, z:  0, val: 5 },
  { x:  0, y:  0, z:  1, val: 3 },
  { x:  0, y:  0, z: -1, val: 4 },
];

export const FACE_UP_QUATS = {
  1: BABYLON.Quaternion.Identity(),
  6: BABYLON.Quaternion.FromEulerAngles(Math.PI, 0, 0),
  2: BABYLON.Quaternion.FromEulerAngles(0, 0,  Math.PI / 2),
  5: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 2),
  3: BABYLON.Quaternion.FromEulerAngles(-Math.PI / 2, 0, 0),
  4: BABYLON.Quaternion.FromEulerAngles( Math.PI / 2, 0, 0),
};

// ── Face detection ──────────────────────────────────────────────────────────
const _faceTmp = new CANNON.Vec3();
const _faceLv  = new CANNON.Vec3();

/**
 * Dot-product face detection with quality thresholds.
 * Returns face value 1–6 or null if ambiguous/tilted.
 */
export function readFaceValue(body) {
  const q = body.quaternion;
  const worldUp = new CANNON.Vec3(0, 1, 0);
  let bestDot = -2, secondDot = -2, bestVal = null;
  for (const f of FACE_LOCALS) {
    _faceLv.set(f.x, f.y, f.z);
    q.vmult(_faceLv, _faceTmp);
    const dot = _faceTmp.dot(worldUp);
    if (dot > bestDot) {
      secondDot = bestDot;
      bestDot   = dot;
      bestVal   = f.val;
    } else if (dot > secondDot) {
      secondDot = dot;
    }
  }
  if (bestDot < 0.82) return null;
  if (bestDot - secondDot < 0.10) return null;
  return bestVal;
}

/** Threshold-free fallback for force-settle (always returns a value). */
export function readFaceValueForced(body) {
  const q = body.quaternion;
  const worldUp = new CANNON.Vec3(0, 1, 0);
  let bestDot = -2, bestVal = 1;
  for (const f of FACE_LOCALS) {
    _faceLv.set(f.x, f.y, f.z);
    q.vmult(_faceLv, _faceTmp);
    const dot = _faceTmp.dot(worldUp);
    if (dot > bestDot) { bestDot = dot; bestVal = f.val; }
  }
  return bestVal;
}

// ── Geometry builders (cached by caller) ────────────────────────────────────

/** Rounded box with pip notches. Returns BABYLON.VertexData. */
export function createDiceVertexData() {
  const s = SEGMENTS, positions = [], indices = [];
  const faces = [
    [1,+.5,0,2],[1,-.5,0,2],[0,+.5,2,1],[0,-.5,2,1],[2,+.5,1,0],[2,-.5,1,0],
  ];
  for (const [fA, fV, uA, vA] of faces) {
    const base = positions.length / 3;
    for (let i = 0; i <= s; i++) for (let j = 0; j <= s; j++) {
      const p = [0,0,0]; p[fA] = fV; p[uA] = i / s - 0.5; p[vA] = j / s - 0.5;
      positions.push(p[0], p[1], p[2]);
    }
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) {
      const a = base + i * (s + 1) + j, b = a + (s + 1), c = a + 1, d = b + 1;
      if (fV > 0) indices.push(a, c, b, b, c, d);
      else        indices.push(a, b, c, c, b, d);
    }
  }
  const half = 0.5 - EDGE_R;
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i], y = positions[i+1], z = positions[i+2];
    const sx = Math.sign(x) * half, sy = Math.sign(y) * half, sz = Math.sign(z) * half;
    const ax = x - sx, ay = y - sy, az = z - sz;
    const ox = Math.abs(x) > half, oy = Math.abs(y) > half, oz = Math.abs(z) > half;
    if (ox && oy && oz) { const l = Math.hypot(ax,ay,az)||1; x = sx+ax/l*EDGE_R; y = sy+ay/l*EDGE_R; z = sz+az/l*EDGE_R; }
    else if (ox && oy)  { const l = Math.hypot(ax,ay)||1;    x = sx+ax/l*EDGE_R; y = sy+ay/l*EDGE_R; }
    else if (ox && oz)  { const l = Math.hypot(ax,az)||1;    x = sx+ax/l*EDGE_R; z = sz+az/l*EDGE_R; }
    else if (oy && oz)  { const l = Math.hypot(ay,az)||1;    y = sy+ay/l*EDGE_R; z = sz+az/l*EDGE_R; }
    const nw = v => { v = v / NOTCH_R; v = Math.PI * Math.max(-1, Math.min(1, v)); return NOTCH_D * (Math.cos(v) + 1); };
    const n = (a, b) => nw(a) * nw(b), o = PIP_OFFSET;
    if      (y ===  .5) { y -= n(x,z); }
    else if (x ===  .5) { x -= n(y+o,z+o); x -= n(y-o,z-o); }
    else if (z ===  .5) { z -= n(x-o,y+o); z -= n(x,y); z -= n(x+o,y-o); }
    else if (z === -.5) { z += n(x+o,y+o); z += n(x+o,y-o); z += n(x-o,y+o); z += n(x-o,y-o); }
    else if (x === -.5) { x += n(y+o,z+o); x += n(y+o,z-o); x += n(y,z); x += n(y-o,z+o); x += n(y-o,z-o); }
    else if (y === -.5) { y += n(x+o,z+o); y += n(x+o,z); y += n(x+o,z-o); y += n(x-o,z+o); y += n(x-o,z); y += n(x-o,z-o); }
    positions[i] = x; positions[i+1] = y; positions[i+2] = z;
  }
  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  let flip = false;
  for (let i = 0; i < positions.length; i += 3) { if (positions[i] > .45) { if (normals[i] < 0) flip = true; break; } }
  if (flip) {
    for (let i = 0; i < indices.length; i += 3) { const t = indices[i+1]; indices[i+1] = indices[i+2]; indices[i+2] = t; }
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  }
  const vd = new BABYLON.VertexData();
  vd.positions = positions; vd.indices = indices; vd.normals = normals;
  return vd;
}

/** 21 flat disc pips across 6 faces. Returns BABYLON.VertexData. */
export function createPipsVertexData() {
  const positions = [], indices = [], normals = [], o = PIP_OFFSET, PR = 0.1, SEG = 16;
  const pf = [
    { fA:1, fV:+.5, uA:0, vA:2, pips:[[0,0]] },
    { fA:1, fV:-.5, uA:0, vA:2, pips:[[-o,-o],[-o,0],[-o,+o],[+o,-o],[+o,0],[+o,+o]] },
    { fA:0, fV:+.5, uA:2, vA:1, pips:[[-o,-o],[+o,+o]] },
    { fA:0, fV:-.5, uA:2, vA:1, pips:[[-o,-o],[-o,+o],[0,0],[+o,-o],[+o,+o]] },
    { fA:2, fV:+.5, uA:1, vA:0, pips:[[+o,-o],[0,0],[-o,+o]] },
    { fA:2, fV:-.5, uA:1, vA:0, pips:[[-o,-o],[-o,+o],[+o,-o],[+o,+o]] },
  ];
  for (const { fA, fV, uA, vA, pips } of pf) {
    const sign = Math.sign(fV);
    for (const [cu, cv] of pips) {
      const base = positions.length / 3, nn = [0,0,0]; nn[fA] = sign;
      const cc = [0,0,0]; cc[fA] = fV; cc[uA] = cu; cc[vA] = cv;
      positions.push(cc[0], cc[1], cc[2]); normals.push(nn[0], nn[1], nn[2]);
      for (let i = 0; i < SEG; i++) {
        const a = 2 * Math.PI * i / SEG, v = [0,0,0];
        v[fA] = fV; v[uA] = cu + Math.cos(a) * PR; v[vA] = cv + Math.sin(a) * PR;
        positions.push(v[0], v[1], v[2]); normals.push(nn[0], nn[1], nn[2]);
      }
      for (let i = 0; i < SEG; i++) {
        if (sign > 0) indices.push(base, base + 1 + i, base + 1 + (i + 1) % SEG);
        else          indices.push(base, base + 1 + (i + 1) % SEG, base + 1 + i);
      }
    }
  }
  const vd = new BABYLON.VertexData();
  vd.positions = positions; vd.indices = indices; vd.normals = normals;
  return vd;
}

// ── Die lifecycle ───────────────────────────────────────────────────────────

let _idCounter = 0;

/**
 * Build a single die: TransformNode + outer/pips/backing meshes + CANNON.Body.
 * Starts kinematic + hidden under the table (stash).
 *
 * @param {object} ctx — engine context (scene, world, shadowGen, materials, tune, etc.)
 * @param {object} [opts]
 * @param {function} [opts.onSleep] — called when physics body sleeps (caller handles settle)
 * @returns {object} die — { id, root, outer, pips, backing, body, oMat, value, settled }
 */
export function buildDie(ctx, opts = {}) {
  const id = _idCounter++;
  const sc = ctx.tune.mesh.dieScale;

  const oMat = new BABYLON.StandardMaterial(`o${id}`, ctx.scene);
  oMat.diffuseColor  = BABYLON.Color3.FromHexString(ctx.bodyColor || '#f4f2ef');
  oMat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);

  const root = new BABYLON.TransformNode(`die${id}`, ctx.scene);
  root.rotationQuaternion = BABYLON.Quaternion.Identity();
  root.scaling.setAll(sc);

  const outer = new BABYLON.Mesh(`outer${id}`, ctx.scene);
  ctx.cachedOuterVD.applyToMesh(outer);
  outer.material = oMat;
  outer.parent = root;
  outer.receiveShadows = true;
  ctx.shadowGen.addShadowCaster(outer);

  const pips = new BABYLON.Mesh(`pips${id}`, ctx.scene);
  ctx.cachedPipsVD.applyToMesh(pips);
  pips.material = ctx.pipMat;
  pips.parent = root;

  const backing = BABYLON.MeshBuilder.CreateBox(`back${id}`, { size: 0.9 }, ctx.scene);
  backing.material = ctx.backingMat;
  backing.parent = root;

  const hs = ctx.tune.mesh.boxHalfPerScale * sc;
  const boxShape = new CANNON.Box(new CANNON.Vec3(hs, hs, hs));
  const body = new CANNON.Body({
    mass:           ctx.tune.body.mass,
    shape:          boxShape,
    material:       ctx.diceMat,
    sleepTimeLimit: ctx.tune.body.sleepTime,
    sleepSpeedLimit:ctx.tune.body.sleepSpeed,
    linearDamping:  ctx.tune.body.linearDamping,
    angularDamping: ctx.tune.body.angularDamping,
  });
  applyDiceCollision(body, ctx);
  ctx.world.addBody(body);

  const stashY = ctx.floorY - 8;
  body.type = CANNON.Body.KINEMATIC;
  body.velocity.setZero();
  body.angularVelocity.setZero();
  body.position.set(0, stashY, 0);
  body.quaternion.set(0, 0, 0, 1);
  root.position.set(0, stashY, 0);
  root.rotationQuaternion = BABYLON.Quaternion.Identity();
  outer.setEnabled(false);
  pips.setEnabled(false);
  backing.setEnabled(false);

  const die = { id, root, outer, pips, backing, body, oMat, value: null, settled: false };

  if (opts.onSleep) {
    body.addEventListener('sleep', () => opts.onSleep(die));
  }

  return die;
}

/** Remove die meshes from scene and body from physics world. */
export function teardownDie(die, ctx) {
  ctx.hl.removeMesh(die.outer);
  ctx.shadowGen.removeShadowCaster(die.outer);
  die.pips.dispose();
  die.backing.dispose();
  die.outer.dispose();
  die.root.dispose();
  die.oMat.dispose();
  if (die.body) {
    ctx.world.removeBody(die.body);
    die.body = null;
  }
}

// ── Collision group helpers ─────────────────────────────────────────────────
export const STATIC_ENV_GROUP     = 1;
export const DICE_COLLISION_GROUP = 2;
export const DICE_COLLISION_MASK  = STATIC_ENV_GROUP | DICE_COLLISION_GROUP;
const STATIC_ENV_MASK = -1;

function applyShapeCollision(shape, group, mask) {
  shape.collisionFilterGroup = group;
  shape.collisionFilterMask  = mask;
  const hull = shape.convexPolyhedronRepresentation;
  if (hull) { hull.collisionFilterGroup = group; hull.collisionFilterMask = mask; }
}

export function applyDiceCollision(body, ctx) {
  body.collisionFilterGroup = DICE_COLLISION_GROUP;
  body.collisionFilterMask  = DICE_COLLISION_MASK;
  for (let i = 0; i < body.shapes.length; i++) {
    applyShapeCollision(body.shapes[i], DICE_COLLISION_GROUP, DICE_COLLISION_MASK);
  }
}

export function applyStaticEnvCollision(body) {
  body.collisionFilterGroup = STATIC_ENV_GROUP;
  body.collisionFilterMask  = STATIC_ENV_MASK;
  for (let i = 0; i < body.shapes.length; i++) {
    const sh = body.shapes[i];
    sh.collisionFilterGroup = STATIC_ENV_GROUP;
    sh.collisionFilterMask  = STATIC_ENV_MASK;
  }
}
