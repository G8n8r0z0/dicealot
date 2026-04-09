/**
 * diceEngine.js — Scene, physics, render loop, throws, table layout.
 * Owns the 3D environment. No game logic (phases, scoring, combat).
 *
 * ES module. Depends on:
 *   - window.BABYLON (loaded via <script> before this module)
 *   - cannon-es (via importmap)
 *   - ./dieFactory.js
 */
import * as CANNON from 'cannon-es';
import {
  createDiceVertexData, createPipsVertexData,
  buildDie, teardownDie,
  readFaceValue, readFaceValueForced,
  FACE_UP_QUATS,
  applyStaticEnvCollision,
  STATIC_ENV_GROUP, DICE_COLLISION_GROUP, DICE_COLLISION_MASK,
} from './dieFactory.js';

const BABYLON = window.BABYLON;

// ═══════════════════════════════════════════════════════════════════════════
//  TUNE DEFAULTS — canonical shipping physics (battle.html baseline v4)
// ═══════════════════════════════════════════════════════════════════════════

export const BATTLE_TUNE_DEFAULTS = {
  world:  { gravity: -300, restitution: 0.35, friction: 0.5 },
  body:   { mass: 3.0, linearDamping: 0.05, angularDamping: 0.1, sleepTime: 0.3, sleepSpeed: 0.05, throwMin: 100, throwMax: 166 },
  sling:  { maxPullWorld: 12.5, clickEpsMul: 0.02, pickYOffset: 0.55 },
  spawn:  { minSpacingMul: 1.18, stackYStepMul: 0.05, jitterMul: 0.32 },
  rollPlayer: { spawnYOffset: 1, planeJitter: 0.5, impulseYMul: 0.17, impulseCrossMul: 0.32, mainImpulse: 5.61 },
  rollBot:    { spawnYOffset: 5.5, planeJitter: 0.55, impulseYMul: 0.2, impulseCrossMul: 0.28, mainImpulse: 5.225 },
  rollImpulseLever: 0.28,
  mesh:   { dieScale: 3.06, boxHalfPerScale: 0.48 },
  settle: { alignThreshold: 0.92, angKick: 3, speedLo: 0.02, speedHi: 1.5 },
};

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ═══════════════════════════════════════════════════════════════════════════
//  TABLE LAYOUT (derived from constants — matches battle.html)
// ═══════════════════════════════════════════════════════════════════════════

const TABLE_DEFAULTS = {
  floorY:           -4,
  tableScale:        1.5,
  worldScale:        1.3,
  xStretch:          1.96,
  zStretch:          1.38,
  rollDepthStretch:  2.8,
  centerZRef:        1.5,
  viewYawDeg:       -90,
  cameraBeta:        0.09,
  cameraDistance:     34,
  uiPadH:            12,
  uiPadV:             5,
  shelfW:             9,
  shelfD:             9,
  wallInsetZ:         0.5,
  ceilingOffset:      28,
  bodyColor:         '#f4f2ef',
  pipColor:          '#141414',
};

function computeTable(td) {
  const tableWidthX  = 10 * td.tableScale * td.worldScale * td.xStretch;
  const rollFloorW   = tableWidthX;
  const zHalfRef     = 6.5 * td.worldScale * td.zStretch;
  const shelfDepthZ  = 2   * td.worldScale * td.zStretch;
  const rollDepthZ   = (2 * zHalfRef - 2 * shelfDepthZ) * td.rollDepthStretch;
  const tableTotalZ  = 2 * shelfDepthZ + rollDepthZ;
  const zHalf        = tableTotalZ / 2;
  const wzBot        = td.centerZRef - zHalf;
  const wzTop        = td.centerZRef + zHalf;
  const dividerZ     = wzBot + shelfDepthZ;
  const botDividerZ  = dividerZ + rollDepthZ;
  const wx           = rollFloorW / 2 - 0.5;
  const tableCenterZ = (wzBot + wzTop) / 2;
  const viewYaw      = td.viewYawDeg * Math.PI / 180;
  const ceilingY     = td.floorY + td.ceilingOffset;
  return {
    tableWidthX, rollFloorW, shelfDepthZ, rollDepthZ, tableTotalZ,
    wzBot, wzTop, dividerZ, botDividerZ, wx, tableCenterZ, viewYaw, ceilingY,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getDieEdge(ctx) {
  return 2 * ctx.tune.mesh.boxHalfPerScale * ctx.tune.mesh.dieScale;
}

export function getSlingPickY(ctx) {
  return ctx.td.floorY + ctx.tune.sling.pickYOffset;
}

function getDiceSpawnMinSpacing(ctx) {
  return getDieEdge(ctx) * ctx.tune.spawn.minSpacingMul;
}

function getDiceStackYStep(ctx) {
  return getDieEdge(ctx) * ctx.tune.spawn.stackYStepMul;
}

function getSlingClickEpsWorld(ctx) {
  return ctx.tune.sling.clickEpsMul * ctx.td.worldScale * Math.min(ctx.td.xStretch, ctx.td.zStretch);
}

function slingStrengthQuadratic(pullLen, ctx) {
  const t = Math.max(0, Math.min(1, pullLen / ctx.tune.sling.maxPullWorld));
  return t * t;
}

// ═══════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {object} [opts.tune]   — deep-merged over BATTLE_TUNE_DEFAULTS
 * @param {object} [opts.table]  — overrides TABLE_DEFAULTS
 * @param {function} [opts.onDieSettled]  — (die) called when a single die settles
 * @param {function} [opts.onAllSettled]  — (dice[]) called when all active dice have settled
 * @returns {object} ctx — engine context
 */
export function init(canvas, opts = {}) {
  const tune = deepClone(BATTLE_TUNE_DEFAULTS);
  if (opts.tune) deepMerge(tune, opts.tune);

  const td = Object.assign({}, TABLE_DEFAULTS, opts.table || {});
  const tbl = computeTable(td);

  // ── BabylonJS ────────────────────────────────────────────────────────
  const eng = new BABYLON.Engine(canvas, true, { stencil: true });
  const scene = new BABYLON.Scene(eng);
  scene.useRightHandedSystem = true;
  scene.clearColor = new BABYLON.Color4(0.06, 0.06, 0.06, 1);

  const camera = new BABYLON.ArcRotateCamera('cam',
    -Math.PI / 2 + tbl.viewYaw, td.cameraBeta, td.cameraDistance,
    new BABYLON.Vector3(0, td.floorY + 0.5, tbl.tableCenterZ), scene);
  camera.minZ = 0.1;
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.62;
  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.2, -1, -0.25).normalize(), scene);
  dir.position.set(0, 50, 6);
  dir.intensity = 0.95;
  const shadowGen = new BABYLON.ShadowGenerator(1024, dir);
  shadowGen.useBlurExponentialShadowMap = true;
  shadowGen.blurKernel = 16;
  const hl = new BABYLON.HighlightLayer('hl', scene);

  // ── Floor meshes ─────────────────────────────────────────────────────
  const rollFloorMat = new BABYLON.StandardMaterial('fRollMat', scene);
  rollFloorMat.diffuseColor = new BABYLON.Color3(0.32, 0.22, 0.13);
  rollFloorMat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
  const rollFloor = BABYLON.MeshBuilder.CreateGround('floorRoll', { width: tbl.rollFloorW, height: tbl.rollDepthZ }, scene);
  rollFloor.position.set(0, td.floorY, tbl.dividerZ + tbl.rollDepthZ / 2);
  rollFloor.material = rollFloorMat;
  rollFloor.receiveShadows = true;

  const heldFloorMat = new BABYLON.StandardMaterial('fHeldMat', scene);
  heldFloorMat.diffuseColor = new BABYLON.Color3(0.22, 0.15, 0.09);
  heldFloorMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

  const playerHeldFloor = BABYLON.MeshBuilder.CreateGround('floorPlayerHeld', { width: td.shelfW, height: td.shelfD }, scene);
  playerHeldFloor.position.set(0, td.floorY, tbl.dividerZ - td.shelfD / 2);
  playerHeldFloor.material = heldFloorMat; playerHeldFloor.receiveShadows = true;

  const botHeldFloor = BABYLON.MeshBuilder.CreateGround('floorBotHeld', { width: td.shelfW, height: td.shelfD }, scene);
  botHeldFloor.position.set(0, td.floorY, tbl.botDividerZ + td.shelfD / 2);
  botHeldFloor.material = heldFloorMat; botHeldFloor.receiveShadows = true;

  const divMat = new BABYLON.StandardMaterial('divMat', scene);
  divMat.diffuseColor = new BABYLON.Color3(0.55, 0.42, 0.25);
  divMat.specularColor = BABYLON.Color3.Black();
  const divW = tbl.rollFloorW - 0.5;
  const div1 = BABYLON.MeshBuilder.CreateBox('divider', { width: divW, height: 0.04, depth: 0.08 }, scene);
  div1.position.set(0, td.floorY + 0.02, tbl.dividerZ); div1.material = divMat;
  const div2 = BABYLON.MeshBuilder.CreateBox('botDivider', { width: divW, height: 0.04, depth: 0.08 }, scene);
  div2.position.set(0, td.floorY + 0.02, tbl.botDividerZ); div2.material = divMat;

  const feltMat = new BABYLON.StandardMaterial('feltMat', scene);
  feltMat.diffuseColor = new BABYLON.Color3(0.10, 0.08, 0.06);
  feltMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
  const floorFelt = BABYLON.MeshBuilder.CreateGround('floorFelt', { width: 1, height: 1 }, scene);
  floorFelt.position.set(0, td.floorY - 0.045, tbl.tableCenterZ);
  floorFelt.material = feltMat; floorFelt.receiveShadows = true;

  {
    const bY = td.floorY + 0.01, hx = tbl.rollFloorW / 2;
    const pts = [
      new BABYLON.Vector3(-hx, bY, tbl.dividerZ),
      new BABYLON.Vector3( hx, bY, tbl.dividerZ),
      new BABYLON.Vector3( hx, bY, tbl.botDividerZ),
      new BABYLON.Vector3(-hx, bY, tbl.botDividerZ),
      new BABYLON.Vector3(-hx, bY, tbl.dividerZ),
    ];
    const border = BABYLON.MeshBuilder.CreateLines('rollBorder', { points: pts }, scene);
    border.color = new BABYLON.Color3(0.52, 0.42, 0.30);
    border.alpha = 0.7;
  }

  // ── cannon-es Physics ────────────────────────────────────────────────
  const world = new CANNON.World({ allowSleep: true, gravity: new CANNON.Vec3(0, tune.world.gravity, 0) });
  world.solver.iterations = 20;
  world.defaultContactMaterial.restitution = tune.world.restitution;
  world.defaultContactMaterial.friction = tune.world.friction;

  const wallMat = new CANNON.Material('wall');
  const diceMat = new CANNON.Material('dice');
  world.addContactMaterial(new CANNON.ContactMaterial(wallMat, diceMat, {
    friction: 0.0,
    restitution: tune.world.restitution,
  }));

  const floorBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  floorBody.position.set(0, td.floorY, 0);
  applyStaticEnvCollision(floorBody);
  world.addBody(floorBody);

  for (const w of [
    { pos: [ tbl.wx, 0, 0],     rot: [0, -Math.PI / 2, 0] },
    { pos: [-tbl.wx, 0, 0],     rot: [0,  Math.PI / 2, 0] },
    { pos: [0, 0, tbl.wzTop],   rot: [0,  Math.PI,     0] },
    { pos: [0, 0, tbl.wzBot],   rot: [0,  0,           0] },
    { pos: [0, 0, tbl.dividerZ    + td.wallInsetZ], rot: [0, 0,        0] },
    { pos: [0, 0, tbl.botDividerZ - td.wallInsetZ], rot: [0, Math.PI,  0] },
  ]) {
    const b = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: wallMat });
    b.position.set(...w.pos);
    b.quaternion.setFromEuler(...w.rot);
    applyStaticEnvCollision(b);
    world.addBody(b);
  }

  const ceilBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  ceilBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
  ceilBody.position.set(0, tbl.ceilingY, 0);
  applyStaticEnvCollision(ceilBody);
  world.addBody(ceilBody);

  // ── Materials (shared) ───────────────────────────────────────────────
  const pipMat = new BABYLON.StandardMaterial('pipMat', scene);
  pipMat.disableLighting = true;
  pipMat.emissiveColor = BABYLON.Color3.FromHexString(td.pipColor);
  pipMat.diffuseColor  = BABYLON.Color3.Black();
  pipMat.specularColor = BABYLON.Color3.Black();
  pipMat.zOffset = -2;

  const backingMat = new BABYLON.StandardMaterial('backMat', scene);
  backingMat.diffuseColor  = new BABYLON.Color3(0.05, 0.05, 0.05);
  backingMat.specularColor = BABYLON.Color3.Black();

  // ── Cached geometry ──────────────────────────────────────────────────
  const cachedOuterVD = createDiceVertexData();
  const cachedPipsVD  = createPipsVertexData();

  // ── Context object ───────────────────────────────────────────────────
  const ctx = {
    canvas, eng, scene, camera, shadowGen, hl, world,
    tune, td, tbl,
    pipMat, backingMat, diceMat, wallMat,
    cachedOuterVD, cachedPipsVD,
    floorY: td.floorY,
    bodyColor: td.bodyColor,
    floorFelt,
    dice: [],
    heldDice: [],
    _settleTimer: 0,
    _slingCollisionTimer: null,
    _allSettledFired: false,
    onDieSettled: opts.onDieSettled || null,
    onAllSettled: opts.onAllSettled || null,
  };

  // ── Ortho frustum ────────────────────────────────────────────────────
  updateOrthoFrustum(ctx);

  // ── Camera lock ──────────────────────────────────────────────────────
  camera.detachControl();
  camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;
  camera.lowerBetaLimit   = camera.upperBetaLimit   = camera.beta;
  camera.lowerAlphaLimit  = camera.upperAlphaLimit  = camera.alpha;
  camera.panningSensibility = 0;

  // ── Render loop ──────────────────────────────────────────────────────
  eng.runRenderLoop(() => renderTick(ctx));
  window.addEventListener('resize', () => {
    eng.resize();
    updateOrthoFrustum(ctx);
  });

  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ORTHO FRUSTUM
// ═══════════════════════════════════════════════════════════════════════════

function updateOrthoFrustum(ctx) {
  const { tbl, td, camera, eng, floorFelt } = ctx;
  const margin = 0.5;
  const halfTableX = tbl.tableWidthX / 2 + margin;
  const halfTableZ = tbl.tableTotalZ / 2 + margin;
  const swapAxes = Math.abs(Math.sin(tbl.viewYaw)) > 0.5;
  const halfXt = (swapAxes ? halfTableZ : halfTableX) + td.uiPadH;
  const halfZt = (swapAxes ? halfTableX : halfTableZ) + td.uiPadV;
  const ar = eng.getAspectRatio(camera);
  const halfH = Math.max(halfZt, halfXt / ar);
  const halfW = halfH * ar;
  camera.orthoTop    =  halfH;
  camera.orthoBottom = -halfH;
  camera.orthoLeft   = -halfW;
  camera.orthoRight  =  halfW;
  if (floorFelt) {
    const pad = 1.08;
    if (swapAxes) { floorFelt.scaling.x = 2 * halfH * pad; floorFelt.scaling.z = 2 * halfW * pad; }
    else          { floorFelt.scaling.x = 2 * halfW * pad; floorFelt.scaling.z = 2 * halfH * pad; }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  RENDER TICK
// ═══════════════════════════════════════════════════════════════════════════

const FORCE_SETTLE_LERP = 0.08;

function renderTick(ctx) {
  ctx.world.fixedStep();

  for (const d of ctx.dice) {
    if (d._forceSettle) {
      const t = d._forceSettle, p = d.body.position, q = d.body.quaternion;
      p.x += (t.tx - p.x) * FORCE_SETTLE_LERP;
      p.y += (t.ty - p.y) * FORCE_SETTLE_LERP;
      p.z += (t.tz - p.z) * FORCE_SETTLE_LERP;
      const bq = new BABYLON.Quaternion(q.x, q.y, q.z, q.w);
      const tq = new BABYLON.Quaternion(t.qx, t.qy, t.qz, t.qw);
      BABYLON.Quaternion.SlerpToRef(bq, tq, FORCE_SETTLE_LERP, bq);
      q.set(bq.x, bq.y, bq.z, bq.w);
      const dist = Math.abs(p.x - t.tx) + Math.abs(p.y - t.ty) + Math.abs(p.z - t.tz);
      if (dist < 0.05) {
        p.set(t.tx, t.ty, t.tz);
        q.set(t.qx, t.qy, t.qz, t.qw);
        d.body.type = CANNON.Body.DYNAMIC;
        d.body.allowSleep = false;
        d.value = t.val;
        d.settled = true;
        d._forceSettle = null;
        checkSettled(ctx);
      }
    }

    d.root.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
    d.root.rotationQuaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);

    if (!d.settled) {
      const spd = d.body.velocity.length() + d.body.angularVelocity.length();
      const st = ctx.tune.settle;
      if (spd > st.speedLo && spd < st.speedHi) {
        const { x: qx, y: qy, z: qz, w: qw } = d.body.quaternion;
        const align = Math.max(
          Math.abs(2 * (qx * qy + qw * qz)),
          Math.abs(1 - 2 * (qx * qx + qz * qz)),
          Math.abs(2 * (qy * qz - qw * qx))
        );
        if (align < st.alignThreshold) {
          d.body.angularVelocity.x += (Math.random() - 0.5) * st.angKick;
          d.body.angularVelocity.z += (Math.random() - 0.5) * st.angKick;
        }
      }
    }
  }

  for (const d of ctx.dice) {
    if (d.settled) continue;
    const spd2 = d.body.velocity.lengthSquared() + d.body.angularVelocity.lengthSquared();
    if (spd2 >= 0.0004) continue;
    const v = readFaceValue(d.body);
    if (v !== null) {
      d.body.allowSleep = false;
      d.value = v;
      d.settled = true;
      checkSettled(ctx);
    }
  }

  for (const d of ctx.heldDice) {
    if (d.animTarget) {
      const t = d.animTarget, p = d.root.position;
      p.x += (t.x - p.x) * 0.12;
      p.y += (t.y - p.y) * 0.12;
      p.z += (t.z - p.z) * 0.12;
      const tq = d._heldTargetQuat || BABYLON.Quaternion.Identity();
      BABYLON.Quaternion.SlerpToRef(d.root.rotationQuaternion, tq, 0.10, d.root.rotationQuaternion);
      if (Math.abs(p.x - t.x) < .02 && Math.abs(p.y - t.y) < .02 && Math.abs(p.z - t.z) < .02) {
        p.set(t.x, t.y, t.z);
        d.animTarget = null;
      }
    }
  }

  ctx.scene.render();
}

function checkSettled(ctx) {
  if (!ctx.dice.length) return;
  if (!ctx.dice.every(d => d.settled)) return;
  if (ctx._allSettledFired) return;
  ctx._allSettledFired = true;
  if (ctx.onAllSettled) ctx.onAllSettled(ctx.dice);
}

// ═══════════════════════════════════════════════════════════════════════════
//  DICE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

export function syncActiveDice(ctx, n, dieConfigs) {
  while (ctx.dice.length < n) {
    const idx = ctx.dice.length;
    const cfg = (dieConfigs && dieConfigs[idx]) || {};
    const die = buildDie(ctx, Object.assign({
      onSleep: (d) => {
        d.body.allowSleep = false;
        const v = readFaceValue(d.body);
        if (v !== null) { d.value = v; d.settled = true; checkSettled(ctx); }
        else { d.body.allowSleep = true; }
      },
    }, cfg));
    ctx.dice.push(die);
  }
  while (ctx.dice.length > n) teardownDie(ctx.dice.pop(), ctx);
}

export function getDice(ctx) { return ctx.dice; }
export function getHeldDice(ctx) { return ctx.heldDice; }

// ═══════════════════════════════════════════════════════════════════════════
//  DIRECTIONAL THROW
// ═══════════════════════════════════════════════════════════════════════════

function findScreenBottomTopEdges(ctx) {
  const pickY = getSlingPickY(ctx);
  const czMid = ctx.tbl.dividerZ + ctx.tbl.rollDepthZ * 0.5;
  const m = 0.42;
  const mz = ctx.td.wallInsetZ + 0.1;
  const xLo = -ctx.tbl.wx + m, xHi = ctx.tbl.wx - m;
  const zLo = ctx.tbl.dividerZ + mz, zHi = ctx.tbl.botDividerZ - mz;

  const pts = [
    { x: 0, z: zLo }, { x: 0, z: zHi },
    { x: xLo, z: czMid }, { x: xHi, z: czMid },
  ];
  const w = ctx.eng.getRenderWidth(), h = ctx.eng.getRenderHeight();
  const worldMat = BABYLON.Matrix.Identity();
  const transform = ctx.scene.getTransformMatrix();
  const vp = ctx.camera.viewport.toGlobal(w, h);

  let maxSy = -Infinity, minSy = Infinity, bottom = pts[0], top = pts[0];
  for (const p of pts) {
    const proj = BABYLON.Vector3.Project(new BABYLON.Vector3(p.x, pickY, p.z), worldMat, transform, vp);
    if (proj.y > maxSy) { maxSy = proj.y; bottom = p; }
    if (proj.y < minSy) { minSy = proj.y; top = p; }
  }

  const rollCx = 0, rollCz = czMid;
  const mkDir = (from) => {
    const dx = rollCx - from.x, dz = rollCz - from.z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  };
  const dirP = mkDir(bottom), dirB = mkDir(top);
  return {
    bottom, top, dirPlayer: dirP, dirBot: dirB,
    tangPlayer: { x: -dirP.z, z: dirP.x },
    tangBot:    { x: -dirB.z, z: dirB.x },
  };
}

function rollSpawnOffsetsEdgeFrame(i, n, tx, tz, nx, nz, ctx) {
  const cols = 3;
  const rows = Math.ceil(n / cols) || 1;
  const row = Math.floor(i / cols), col = i % cols;
  const inRow = Math.min(cols, n - row * cols);
  const capAlong = Math.min(ctx.tbl.rollFloorW * 0.2, 1.05 * ctx.td.worldScale * ctx.td.xStretch);
  const capIn    = Math.min(ctx.tbl.rollDepthZ * 0.22, 0.52 * ctx.td.worldScale * ctx.td.zStretch);
  const spreadAlong = Math.max(getDiceSpawnMinSpacing(ctx), capAlong);
  const spreadIn    = Math.max(getDiceSpawnMinSpacing(ctx), capIn);
  const u = (col - (inRow - 1) / 2) * spreadAlong;
  const v = (row - (rows - 1) / 2) * spreadIn;
  return { ox: tx * u + nx * v, oz: tz * u + nz * v };
}

const THROW_Z_INSET = 0.28;

/**
 * Throw dice from a screen edge (bottom for player, top for bot).
 * Resets dice state, applies impulses.
 */
function throwDiceDirectional(ctx, who, opts = {}) {
  const floorY = ctx.td.floorY;
  const spawnYBase     = opts.spawnYBase     ?? floorY + 3;
  const spawnYStep     = opts.spawnYStep     ?? 0.3;
  const planeJitter    = opts.planeJitter    ?? 0.55;
  const impulseYMul    = opts.impulseYMul    ?? 0.35;
  const impulseCrossMul = opts.impulseCrossMul ?? 0.32;
  const mainImpulse    = opts.mainImpulse    ?? 0.95;

  const fr = findScreenBottomTopEdges(ctx);
  const isPlayer = who === 'player';
  const edge = isPlayer ? fr.bottom : fr.top;
  const dirIn = isPlayer ? fr.dirPlayer : fr.dirBot;
  const tang  = isPlayer ? fr.tangPlayer : fr.tangBot;
  const inset = Math.min(ctx.tbl.rollDepthZ, ctx.tbl.rollFloorW * 0.35) * THROW_Z_INSET;
  const baseX = edge.x + dirIn.x * inset;
  const baseZ = edge.z + dirIn.z * inset;

  resetDiceForThrow(ctx);

  const jCap = getDiceSpawnMinSpacing(ctx) * ctx.tune.spawn.jitterMul;
  const jTanMax = Math.min(ctx.tune.rollImpulseLever * ctx.td.worldScale * ctx.td.xStretch, jCap);
  const jInMax  = Math.min(planeJitter * ctx.td.worldScale * ctx.td.zStretch, jCap);
  const perpX = -dirIn.z, perpZ = dirIn.x;
  const f = ctx.tune.body.throwMin + Math.random() * (ctx.tune.body.throwMax - ctx.tune.body.throwMin);
  const leverR = getDieEdge(ctx) * 0.10;

  for (let i = 0; i < ctx.dice.length; i++) {
    const d = ctx.dice[i];
    showDie(d);
    d.body.type = CANNON.Body.DYNAMIC;
    d.body.velocity.setZero(); d.body.angularVelocity.setZero();
    const { ox, oz } = rollSpawnOffsetsEdgeFrame(i, ctx.dice.length, tang.x, tang.z, dirIn.x, dirIn.z, ctx);
    const jx = (Math.random() - 0.5) * jTanMax;
    const jz = (Math.random() - 0.5) * jInMax;
    d.body.position.set(
      baseX + ox + jx * tang.x + jz * dirIn.x,
      spawnYBase + i * spawnYStep,
      baseZ + oz + jx * tang.z + jz * dirIn.z
    );
    d.body.quaternion.set(Math.random() - .5, Math.random() - .5, Math.random() - .5, Math.random() - .5);
    d.body.quaternion.normalize();
    const cross = (Math.random() - 0.5) * f * impulseCrossMul;
    d.body.applyImpulse(
      new CANNON.Vec3(
        dirIn.x * f * mainImpulse + perpX * cross,
        f * impulseYMul,
        dirIn.z * f * mainImpulse + perpZ * cross
      ),
      new CANNON.Vec3((Math.random() - .5) * leverR, (Math.random() - .5) * leverR, (Math.random() - .5) * leverR)
    );
    d.body.allowSleep = true; d.body.wakeUp();
  }
}

function resetDiceForThrow(ctx) {
  ctx._allSettledFired = false;
  for (const d of ctx.dice) {
    d.value = null; d.settled = false; d._forceSettle = null; d._rerollCount = 0;
    ctx.hl.removeMesh(d.outer);
  }
}

function showDie(d) {
  d.outer.setEnabled(true);
  d.pips.setEnabled(true);
  d.backing.setEnabled(true);
  if (d.markMeshes) for (const m of d.markMeshes) m.setEnabled(true);
}

export function throwPlayer(ctx) {
  const rp = ctx.tune.rollPlayer;
  throwDiceDirectional(ctx, 'player', {
    spawnYBase:     ctx.td.floorY + rp.spawnYOffset,
    spawnYStep:     getDiceStackYStep(ctx),
    impulseYMul:    rp.impulseYMul,
    impulseCrossMul: rp.impulseCrossMul,
    mainImpulse:    rp.mainImpulse,
    planeJitter:    rp.planeJitter,
  });
  startSettleTimer(ctx);
}

export function throwBot(ctx) {
  const rb = ctx.tune.rollBot;
  throwDiceDirectional(ctx, 'bot', {
    spawnYBase:     ctx.td.floorY + rb.spawnYOffset,
    spawnYStep:     getDiceStackYStep(ctx),
    impulseYMul:    rb.impulseYMul,
    impulseCrossMul: rb.impulseCrossMul,
    mainImpulse:    rb.mainImpulse,
    planeJitter:    rb.planeJitter,
  });
  startSettleTimer(ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SLING
// ═══════════════════════════════════════════════════════════════════════════

/** Position all dice at a single clamped point (kinematic cluster). Only first die visible. */
export function slingCluster(ctx, anchorX, anchorZ, pickX, pickZ) {
  const de = getDieEdge(ctx);
  const wallPad = de * 1.0;
  const cx = Math.max(-ctx.tbl.rollFloorW / 2 + wallPad, Math.min(ctx.tbl.rollFloorW / 2 - wallPad, pickX));
  const cz = Math.max(ctx.tbl.dividerZ + wallPad, Math.min(ctx.tbl.botDividerZ - wallPad, pickZ));
  const spawnY = ctx.td.floorY + ctx.tune.rollPlayer.spawnYOffset;

  for (let i = 0; i < ctx.dice.length; i++) {
    const d = ctx.dice[i];
    d.body.type = CANNON.Body.KINEMATIC;
    d.body.velocity.setZero();
    d.body.angularVelocity.setZero();
    const show = (i === 0);
    d.outer.setEnabled(show);
    d.pips.setEnabled(show);
    d.backing.setEnabled(show);
    if (d.markMeshes) for (const m of d.markMeshes) m.setEnabled(show);
    d.body.position.set(cx, spawnY, cz);
    if (!d._slingPose) {
      d._slingPose = true;
      d.body.quaternion.set(Math.random() - .5, Math.random() - .5, Math.random() - .5, Math.random() - .5);
      d.body.quaternion.normalize();
    }
    d.body.allowSleep = false;
  }
}

/** Release sling: apply impulse in aim direction with given strength [0,1]. */
export function slingRelease(ctx, aimX, aimZ, strength) {
  resetDiceForThrow(ctx);
  const b  = ctx.tune.body;
  const rp = ctx.tune.rollPlayer;
  const perpX = -aimZ, perpZ = aimX;
  const leverR = getDieEdge(ctx) * 0.10;
  const fBase = b.throwMin + (b.throwMax - b.throwMin) * strength;

  slingDisableDiceDice(ctx, 150);

  for (let i = 0; i < ctx.dice.length; i++) {
    const d = ctx.dice[i];
    showDie(d);
    d.body.type = CANNON.Body.DYNAMIC;
    d.body.velocity.setZero();
    d.body.angularVelocity.setZero();
    const cross = (Math.random() - 0.5) * fBase * rp.impulseCrossMul;
    d.body.applyImpulse(
      new CANNON.Vec3(
        aimX * fBase * rp.mainImpulse + perpX * cross,
        fBase * rp.impulseYMul,
        aimZ * fBase * rp.mainImpulse + perpZ * cross
      ),
      new CANNON.Vec3((Math.random() - .5) * leverR, (Math.random() - .5) * leverR, (Math.random() - .5) * leverR)
    );
    d.body.allowSleep = true; d.body.wakeUp();
  }
  startSettleTimer(ctx);
}

/** Cancel sling — hide all dice, return to stash. */
export function slingCancel(ctx) {
  syncActiveDice(ctx, 0);
}

export function slingStrength(ctx, pullLen) {
  return slingStrengthQuadratic(pullLen, ctx);
}

export { getSlingClickEpsWorld };

// ═══════════════════════════════════════════════════════════════════════════
//  COLLISION MASK TOGGLE (for sling dice-dice disable)
// ═══════════════════════════════════════════════════════════════════════════

const DICE_ENV_ONLY_MASK = STATIC_ENV_GROUP;

function setDiceMask(ctx, mask) {
  for (const d of ctx.dice) {
    d.body.collisionFilterMask = mask;
    for (let i = 0; i < d.body.shapes.length; i++) {
      d.body.shapes[i].collisionFilterMask = mask;
      const hull = d.body.shapes[i].convexPolyhedronRepresentation;
      if (hull) hull.collisionFilterMask = mask;
    }
  }
}

function slingDisableDiceDice(ctx, ms) {
  if (ctx._slingCollisionTimer) clearTimeout(ctx._slingCollisionTimer);
  setDiceMask(ctx, DICE_ENV_ONLY_MASK);
  ctx._slingCollisionTimer = setTimeout(() => {
    setDiceMask(ctx, DICE_COLLISION_MASK);
    ctx._slingCollisionTimer = null;
  }, ms);
}

// ═══════════════════════════════════════════════════════════════════════════
//  FORCE SETTLE
// ═══════════════════════════════════════════════════════════════════════════

const SETTLE_TIMEOUT_MS = 4000;

export function startSettleTimer(ctx) {
  clearSettleTimer(ctx);
  ctx._settleTimer = setTimeout(() => forceSettleDice(ctx), SETTLE_TIMEOUT_MS);
}

export function clearSettleTimer(ctx) {
  if (ctx._settleTimer) { clearTimeout(ctx._settleTimer); ctx._settleTimer = 0; }
}

export function forceSettleDice(ctx) {
  ctx._settleTimer = 0;
  const unsettled = ctx.dice.filter(d => !d.settled);
  if (!unsettled.length) return;

  const de = getDieEdge(ctx);
  const stackY = ctx.td.floorY + de * 1.1;
  const floorY = ctx.td.floorY + de * 0.5;

  for (const d of unsettled) {
    let px = d.body.position.x;
    let pz = d.body.position.z;
    if (d.body.position.y > stackY) {
      const angle = Math.random() * Math.PI * 2;
      px += Math.cos(angle) * de * 1.2;
      pz += Math.sin(angle) * de * 1.2;
    }
    const hw = ctx.tbl.rollFloorW / 2 - de;
    px = Math.max(-hw, Math.min(hw, px));
    pz = Math.max(ctx.tbl.dividerZ + de * 0.6, Math.min(ctx.tbl.botDividerZ - de * 0.6, pz));

    const val = readFaceValueForced(d.body);
    const cq = d.body.quaternion;
    d.body.type = CANNON.Body.KINEMATIC;
    d.body.velocity.set(0, 0, 0);
    d.body.angularVelocity.set(0, 0, 0);
    d._forceSettle = {
      tx: px, ty: floorY, tz: pz,
      qx: cq.x, qy: cq.y, qz: cq.z, qw: cq.w,
      val,
    };
  }
}

/** Returns dice that settled on top of another (Y > threshold). */
export function getStackedDice(ctx) {
  const stackY = ctx.td.floorY + getDieEdge(ctx) * 1.1;
  return ctx.dice.filter(d => d.settled && d.body && d.body.position.y > stackY);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SELECTION
// ═══════════════════════════════════════════════════════════════════════════

export function highlightDie(ctx, die, on) {
  if (on) ctx.hl.addMesh(die.outer, new BABYLON.Color3(0.1, 0.9, 0.15));
  else    ctx.hl.removeMesh(die.outer);
}

// ═══════════════════════════════════════════════════════════════════════════
//  HELD DICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Move a die from active to held zone with lerp animation.
 * Removes physics body; die becomes visual-only.
 */
export function moveToHeld(ctx, die, targetX, targetY, targetZ, faceValue) {
  const idx = ctx.dice.indexOf(die);
  if (idx !== -1) ctx.dice.splice(idx, 1);
  if (die.body) { ctx.world.removeBody(die.body); die.body = null; }
  die.animTarget = { x: targetX, y: targetY, z: targetZ };
  die._heldTargetQuat = FACE_UP_QUATS[faceValue] || BABYLON.Quaternion.Identity();
  ctx.heldDice.push(die);
}

// ═══════════════════════════════════════════════════════════════════════════
//  PROJECTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function clampRollXZ(ctx, x, z) {
  const margin = 0.4;
  const xCl = Math.max(-ctx.tbl.wx + margin, Math.min(ctx.tbl.wx - margin, x));
  const zLo = ctx.tbl.dividerZ + margin, zHi = ctx.tbl.botDividerZ - margin;
  return { x: xCl, z: Math.max(zLo, Math.min(zHi, z)) };
}

/** Raycast from client coords to the sling pick plane (Y = FLOOR_Y + pickYOffset). */
export function pickRollXZ(ctx, clientX, clientY) {
  const rect = ctx.canvas.getBoundingClientRect();
  const rw = ctx.eng.getRenderWidth(), rh = ctx.eng.getRenderHeight();
  const sx = ((clientX - rect.left) / Math.max(rect.width, 1)) * rw;
  const sy = ((clientY - rect.top) / Math.max(rect.height, 1)) * rh;
  const ray = ctx.scene.createPickingRay(sx, sy, null, ctx.camera);
  const dy = ray.direction.y;
  if (Math.abs(dy) < 1e-5) return null;
  const t = (getSlingPickY(ctx) - ray.origin.y) / dy;
  if (t < 0) return null;
  const x = ray.origin.x + ray.direction.x * t;
  const z = ray.origin.z + ray.direction.z * t;
  return clampRollXZ(ctx, x, z);
}

/** Project a table point back to client coords. */
export function rollXZToClient(ctx, xw, zw) {
  const w = ctx.eng.getRenderWidth(), h = ctx.eng.getRenderHeight();
  const rect = ctx.canvas.getBoundingClientRect();
  const vp = ctx.camera.viewport.toGlobal(w, h);
  const worldMat = BABYLON.Matrix.Identity();
  const transform = ctx.scene.getTransformMatrix();
  const proj = BABYLON.Vector3.Project(
    new BABYLON.Vector3(xw, getSlingPickY(ctx), zw), worldMat, transform, vp
  );
  return {
    clientX: rect.left + (proj.x / Math.max(w, 1)) * rect.width,
    clientY: rect.top  + (proj.y / Math.max(h, 1)) * rect.height,
  };
}

/** Find which die mesh was hit by a pick result. */
export function findDieAtPick(ctx, pickInfo) {
  if (!pickInfo || !pickInfo.hit) return null;
  const m = pickInfo.pickedMesh;
  return ctx.dice.find(d => d.outer === m || d.pips === m || d.backing === m) || null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DISPOSE
// ═══════════════════════════════════════════════════════════════════════════

export function dispose(ctx) {
  clearSettleTimer(ctx);
  if (ctx._slingCollisionTimer) clearTimeout(ctx._slingCollisionTimer);
  while (ctx.dice.length) teardownDie(ctx.dice.pop(), ctx);
  while (ctx.heldDice.length) {
    const d = ctx.heldDice.pop();
    d.pips.dispose(); d.backing.dispose(); d.outer.dispose(); d.root.dispose(); d.oMat.dispose();
  }
  ctx.eng.dispose();
}

// ═══════════════════════════════════════════════════════════════════════════
//  INTERNAL: deep merge (numeric fields only, same shape)
// ═══════════════════════════════════════════════════════════════════════════

function deepMerge(target, src) {
  if (!src || typeof src !== 'object') return;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
      deepMerge(target[k], v);
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      target[k] = v;
    }
  }
}
