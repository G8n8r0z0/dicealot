/**
 * Throw lab: dice + ROLL + sling + same tune object as battle.html (localStorage battle_tune_json_v1).
 */
import * as CANNON from 'cannon-es';

const $ = (id) => document.getElementById(id);

const LS_ROLL_STRETCH = 'battle_rollDepthStretch';
const LS_TABLE_YAW_DEG = 'battle_tableViewYawDeg';
const DEFAULT_ROLL_DEPTH_STRETCH = 4.5;
const DEFAULT_TABLE_VIEW_YAW_DEG = -90;
const MIN_ROLL_DEPTH_STRETCH = 1.02;
const MAX_ROLL_DEPTH_STRETCH = 20;

function readStoredRollDepthStretch() {
  try {
    const raw = localStorage.getItem(LS_ROLL_STRETCH);
    if (raw == null || raw === '') return DEFAULT_ROLL_DEPTH_STRETCH;
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) return DEFAULT_ROLL_DEPTH_STRETCH;
    return Math.min(MAX_ROLL_DEPTH_STRETCH, Math.max(MIN_ROLL_DEPTH_STRETCH, v));
  } catch {
    return DEFAULT_ROLL_DEPTH_STRETCH;
  }
}
function readStoredTableViewYawDeg() {
  try {
    const raw = localStorage.getItem(LS_TABLE_YAW_DEG);
    if (raw == null || raw === '') return DEFAULT_TABLE_VIEW_YAW_DEG;
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) return DEFAULT_TABLE_VIEW_YAW_DEG;
    return Math.min(180, Math.max(-180, v));
  } catch {
    return DEFAULT_TABLE_VIEW_YAW_DEG;
  }
}

const FLOOR_Y = -4;
const SEGMENTS = 40;
const EDGE_R = 0.07;
const NOTCH_R = 0.14;
const NOTCH_D = 0.12;
const PIP_OFFSET = 0.23;
const LS_BATTLE_TUNE = 'battle_tune_json_v1';

/** Держи в синхроне с battle.html → BATTLE_TUNE_DEFAULTS. */
const BATTLE_TUNE_DEFAULTS = {
  world: { gravity: -93, restitution: 0.35, friction: 0.5 },
  body: {
    mass: 1.35, linearDamping: 0.05, angularDamping: 0.1, sleepTime: 0.3, sleepSpeed: 0.05,
    throwMin: 20, throwMax: 50,
  },
  sling: {
    maxPullWorld: 12.5, clickEpsMul: 0.02, pickYOffset: 0.55,
    impulseHMin: 10.175, impulseHMax: 61.6, impulseYMin: 3.1625, impulseYMax: 11.9625,
  },
  viz: { halfAngle: 0.38, rInner: 12, rSpan: 292, segments: 4 },
  spawn: { minSpacingMul: 1.18, stackYStepMul: 1.12, jitterMul: 0.32 },
  rollPlayer: { spawnYOffset: 1, planeJitter: 0.5, impulseYMul: 0.17, impulseCrossMul: 0.32, mainImpulse: 5.61 },
  rollBot: { spawnYOffset: 5.5, planeJitter: 0.55, impulseYMul: 0.2, impulseCrossMul: 0.28, mainImpulse: 5.225 },
  rollImpulseLever: 0.28,
  mesh: { dieScale: 1.7, boxHalfPerScale: 0.48 },
  settle: { alignThreshold: 0.92, angKick: 3, speedLo: 0.02, speedHi: 1.5 },
};

/** База для ползунков «Реализм» (не меняется в рантайме). */
const REALISM_IMPULSE_BASE = {
  throwMin: BATTLE_TUNE_DEFAULTS.body.throwMin,
  throwMax: BATTLE_TUNE_DEFAULTS.body.throwMax,
  impulseHMin: BATTLE_TUNE_DEFAULTS.sling.impulseHMin,
  impulseHMax: BATTLE_TUNE_DEFAULTS.sling.impulseHMax,
  impulseYMin: BATTLE_TUNE_DEFAULTS.sling.impulseYMin,
  impulseYMax: BATTLE_TUNE_DEFAULTS.sling.impulseYMax,
  rollPlayerYMul: BATTLE_TUNE_DEFAULTS.rollPlayer.impulseYMul,
  rollBotYMul: BATTLE_TUNE_DEFAULTS.rollBot.impulseYMul,
  rollMainPlayer: BATTLE_TUNE_DEFAULTS.rollPlayer.mainImpulse,
  rollMainBot: BATTLE_TUNE_DEFAULTS.rollBot.mainImpulse,
  linearDamping: BATTLE_TUNE_DEFAULTS.body.linearDamping,
  angularDamping: BATTLE_TUNE_DEFAULTS.body.angularDamping,
};

/** Ползунок «Сила броска»: раньше max 1.85 — меньше чем 2× к дефолту, почти незаметно. */
const REALISM_POWER_MIN = 0.2;
const REALISM_POWER_MAX = 6;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function deepCloneTune(obj) {
  return JSON.parse(JSON.stringify(obj));
}
let battleTune = deepCloneTune(BATTLE_TUNE_DEFAULTS);

function deepMergeTune(target, src) {
  if (!src || typeof src !== 'object') return;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
      deepMergeTune(target[k], v);
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      target[k] = v;
    }
  }
}

function tryLoadBattleTuneFromStorage() {
  try {
    const raw = localStorage.getItem(LS_BATTLE_TUNE);
    if (raw == null || raw === '') return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') deepMergeTune(battleTune, parsed);
  } catch (_) {}
}
tryLoadBattleTuneFromStorage();

function getDieEdge() {
  return 2 * battleTune.mesh.boxHalfPerScale * battleTune.mesh.dieScale;
}
function getDiceSpawnMinSpacing() {
  return getDieEdge() * battleTune.spawn.minSpacingMul;
}
function getDiceStackYStep() {
  return getDieEdge() * battleTune.spawn.stackYStepMul;
}
function getSlingPickY() {
  return FLOOR_Y + battleTune.sling.pickYOffset;
}
function slingStrengthLinear(pullLen) {
  return Math.max(0, Math.min(1, pullLen / battleTune.sling.maxPullWorld));
}

const TABLE_SCALE = 1.5;
const TABLE_WORLD_SCALE = 1.3;
const TABLE_X_STRETCH = 1.96;
const TABLE_Z_STRETCH = 1.38;
const TABLE_WIDTH_X = 10 * TABLE_SCALE * TABLE_WORLD_SCALE * TABLE_X_STRETCH;
const ROLL_FLOOR_W = TABLE_WIDTH_X;
const TABLE_CENTER_Z_REF = 1.5;
const Z_HALF_SPAN_REF = 6.5 * TABLE_WORLD_SCALE * TABLE_Z_STRETCH;
const SHELF_DEPTH_Z = 2 * TABLE_WORLD_SCALE * TABLE_Z_STRETCH;
const ROLL_DEPTH_STRETCH = readStoredRollDepthStretch();
const ROLL_DEPTH_Z = (2 * Z_HALF_SPAN_REF - 2 * SHELF_DEPTH_Z) * ROLL_DEPTH_STRETCH;
const TABLE_TOTAL_Z = 2 * SHELF_DEPTH_Z + ROLL_DEPTH_Z;
const Z_HALF_SPAN = TABLE_TOTAL_Z / 2;
const WZ_BOT = TABLE_CENTER_Z_REF - Z_HALF_SPAN;
const WZ_TOP = TABLE_CENTER_Z_REF + Z_HALF_SPAN;
const DIVIDER_Z = WZ_BOT + SHELF_DEPTH_Z;
const BOT_DIVIDER_Z = DIVIDER_Z + ROLL_DEPTH_Z;
const WX = ROLL_FLOOR_W / 2 - 0.5;
const DIVIDER_BAR_W = ROLL_FLOOR_W - 0.5;
const CAMERA_DISTANCE = 34;
const DEFAULT_CAMERA_BETA = 0.09;
const TABLE_VIEW_YAW = readStoredTableViewYawDeg() * Math.PI / 180;
const TABLE_CENTER_Z = (WZ_BOT + WZ_TOP) / 2;

function getSlingClickEpsWorld() {
  return battleTune.sling.clickEpsMul * TABLE_WORLD_SCALE * Math.min(TABLE_X_STRETCH, TABLE_Z_STRETCH);
}

const BODY_COLOR = '#eae8e3';
const PIP_COLOR = '#141414';

const canvas = $('labCanvas');
const engine = new BABYLON.Engine(canvas, true, { stencil: true });
const scene = new BABYLON.Scene(engine);
scene.useRightHandedSystem = true;
scene.clearColor = new BABYLON.Color4(0.06, 0.06, 0.06, 1);

const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, DEFAULT_CAMERA_BETA, CAMERA_DISTANCE,
  new BABYLON.Vector3(0, FLOOR_Y + 0.5, TABLE_CENTER_Z), scene);

let floorFelt = BABYLON.MeshBuilder.CreateGround('floorFelt', { width: 1, height: 1 }, scene);
floorFelt.position.set(0, FLOOR_Y - 0.045, TABLE_CENTER_Z);
const feltMatEarly = new BABYLON.StandardMaterial('feltMat', scene);
feltMatEarly.diffuseColor = new BABYLON.Color3(0.27, 0.185, 0.11);
feltMatEarly.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
floorFelt.material = feltMatEarly;
floorFelt.receiveShadows = true;

function updateBattleOrthoFrustum() {
  const margin = 0.5;
  const halfTableX = TABLE_WIDTH_X / 2 + margin;
  const halfTableZ = TABLE_TOTAL_Z / 2 + margin;
  const swapAxes = Math.abs(Math.sin(TABLE_VIEW_YAW)) > 0.5;
  const halfXt = swapAxes ? halfTableZ : halfTableX;
  const halfZt = swapAxes ? halfTableX : halfTableZ;
  const ar = engine.getAspectRatio(camera);
  const halfH = Math.max(halfZt, halfXt / ar);
  const halfW = halfH * ar;
  camera.orthoTop = halfH;
  camera.orthoBottom = -halfH;
  camera.orthoLeft = -halfW;
  camera.orthoRight = halfW;
  if (floorFelt) {
    const pad = 1.08;
    if (swapAxes) {
      floorFelt.scaling.x = 2 * halfH * pad;
      floorFelt.scaling.z = 2 * halfW * pad;
    } else {
      floorFelt.scaling.x = 2 * halfW * pad;
      floorFelt.scaling.z = 2 * halfH * pad;
    }
  }
}

function lockCameraFromCurrentPosition() {
  camera.detachControl();
  camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;
  camera.lowerBetaLimit = camera.upperBetaLimit = camera.beta;
  camera.lowerAlphaLimit = camera.upperAlphaLimit = camera.alpha;
  camera.panningSensibility = 0;
}

function loadDefaultBattleCamera() {
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  camera.alpha = -Math.PI / 2 + TABLE_VIEW_YAW;
  camera.beta = DEFAULT_CAMERA_BETA;
  camera.radius = CAMERA_DISTANCE;
  camera.setTarget(new BABYLON.Vector3(0, FLOOR_Y + 0.5, TABLE_CENTER_Z));
  updateBattleOrthoFrustum();
  lockCameraFromCurrentPosition();
}

const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
hemi.intensity = 0.62;
const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.2, -1, -0.25).normalize(), scene);
dir.position.set(0, 22, 6);
dir.intensity = 0.95;
const shadowGen = new BABYLON.ShadowGenerator(1024, dir);
shadowGen.useBlurExponentialShadowMap = true;
shadowGen.blurKernel = 16;
const hl = new BABYLON.HighlightLayer('hl', scene);

const floorRoll = BABYLON.MeshBuilder.CreateGround('floorRoll', { width: ROLL_FLOOR_W, height: ROLL_DEPTH_Z }, scene);
floorRoll.position.set(0, FLOOR_Y, DIVIDER_Z + ROLL_DEPTH_Z / 2);
const floorRollMat = new BABYLON.StandardMaterial('fRollMat', scene);
floorRollMat.diffuseColor = new BABYLON.Color3(0.32, 0.22, 0.13);
floorRollMat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
floorRoll.material = floorRollMat;
floorRoll.receiveShadows = true;

const divMat = new BABYLON.StandardMaterial('divMat', scene);
divMat.diffuseColor = new BABYLON.Color3(0.55, 0.42, 0.25);
divMat.specularColor = BABYLON.Color3.Black();
const dividerMesh = BABYLON.MeshBuilder.CreateBox('divider', { width: DIVIDER_BAR_W, height: 0.04, depth: 0.08 }, scene);
dividerMesh.position.set(0, FLOOR_Y + 0.02, DIVIDER_Z);
dividerMesh.material = divMat;
const botDividerMesh = BABYLON.MeshBuilder.CreateBox('botDivider', { width: DIVIDER_BAR_W, height: 0.04, depth: 0.08 }, scene);
botDividerMesh.position.set(0, FLOOR_Y + 0.02, BOT_DIVIDER_Z);
botDividerMesh.material = divMat;

loadDefaultBattleCamera();

const STATIC_ENV_GROUP = 1;
const STATIC_ENV_MASK = -1;

function applyStaticEnvCollision(body) {
  body.collisionFilterGroup = STATIC_ENV_GROUP;
  body.collisionFilterMask = STATIC_ENV_MASK;
  for (let i = 0; i < body.shapes.length; i++) {
    const sh = body.shapes[i];
    sh.collisionFilterGroup = STATIC_ENV_GROUP;
    sh.collisionFilterMask = STATIC_ENV_MASK;
  }
}

const world = new CANNON.World({ allowSleep: true, gravity: new CANNON.Vec3(0, battleTune.world.gravity, 0) });
world.defaultContactMaterial.restitution = battleTune.world.restitution;
world.defaultContactMaterial.friction = battleTune.world.friction;

const floorBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
floorBody.position.set(0, FLOOR_Y, 0);
applyStaticEnvCollision(floorBody);
world.addBody(floorBody);

for (const w of [
  { pos: [WX, 0, 0], rot: [0, -Math.PI / 2, 0] },
  { pos: [-WX, 0, 0], rot: [0, Math.PI / 2, 0] },
  { pos: [0, 0, WZ_TOP], rot: [0, Math.PI, 0] },
  { pos: [0, 0, WZ_BOT], rot: [0, 0, 0] },
  { pos: [0, 0, DIVIDER_Z], rot: [0, 0, 0] },
  { pos: [0, 0, BOT_DIVIDER_Z], rot: [0, Math.PI, 0] },
]) {
  const b = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  b.position.set(...w.pos);
  b.quaternion.setFromEuler(...w.rot);
  applyStaticEnvCollision(b);
  world.addBody(b);
}

function createDiceVertexData() {
  const s = SEGMENTS;
  const positions = [];
  const indices = [];
  const faces = [
    [1, +0.5, 0, 2], [1, -0.5, 0, 2], [0, +0.5, 2, 1], [0, -0.5, 2, 1], [2, +0.5, 1, 0], [2, -0.5, 1, 0],
  ];
  for (const [fA, fV, uA, vA] of faces) {
    const base = positions.length / 3;
    for (let i = 0; i <= s; i++) for (let j = 0; j <= s; j++) {
      const p = [0, 0, 0];
      p[fA] = fV;
      p[uA] = i / s - 0.5;
      p[vA] = j / s - 0.5;
      positions.push(p[0], p[1], p[2]);
    }
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) {
      const a = base + i * (s + 1) + j;
      const b = a + (s + 1);
      const c = a + 1;
      const d = b + 1;
      if (fV > 0) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, c, b, d);
    }
  }
  const half = 0.5 - EDGE_R;
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    let y = positions[i + 1];
    let z = positions[i + 2];
    const sx = Math.sign(x) * half;
    const sy = Math.sign(y) * half;
    const sz = Math.sign(z) * half;
    const ax = x - sx;
    const ay = y - sy;
    const az = z - sz;
    const ox = Math.abs(x) > half;
    const oy = Math.abs(y) > half;
    const oz = Math.abs(z) > half;
    if (ox && oy && oz) {
      const l = Math.hypot(ax, ay, az) || 1;
      x = sx + (ax / l) * EDGE_R;
      y = sy + (ay / l) * EDGE_R;
      z = sz + (az / l) * EDGE_R;
    } else if (ox && oy) {
      const l = Math.hypot(ax, ay) || 1;
      x = sx + (ax / l) * EDGE_R;
      y = sy + (ay / l) * EDGE_R;
    } else if (ox && oz) {
      const l = Math.hypot(ax, az) || 1;
      x = sx + (ax / l) * EDGE_R;
      z = sz + (az / l) * EDGE_R;
    } else if (oy && oz) {
      const l = Math.hypot(ay, az) || 1;
      y = sy + (ay / l) * EDGE_R;
      z = sz + (az / l) * EDGE_R;
    }
    const nw = (v) => {
      v /= NOTCH_R;
      v = Math.PI * Math.max(-1, Math.min(1, v));
      return NOTCH_D * (Math.cos(v) + 1);
    };
    const n = (a, b) => nw(a) * nw(b);
    const o = PIP_OFFSET;
    if (y === 0.5) y -= n(x, z);
    else if (x === 0.5) {
      x -= n(y + o, z + o);
      x -= n(y - o, z - o);
    } else if (z === 0.5) {
      z -= n(x - o, y + o);
      z -= n(x, y);
      z -= n(x + o, y - o);
    } else if (z === -0.5) {
      z += n(x + o, y + o);
      z += n(x + o, y - o);
      z += n(x - o, y + o);
      z += n(x - o, y - o);
    } else if (x === -0.5) {
      x += n(y + o, z + o);
      x += n(y + o, z - o);
      x += n(y, z);
      x += n(y - o, z + o);
      x += n(y - o, z - o);
    } else if (y === -0.5) {
      y += n(x + o, z + o);
      y += n(x + o, z);
      y += n(x + o, z - o);
      y += n(x - o, z + o);
      y += n(x - o, z);
      y += n(x - o, z - o);
    }
    positions[i] = x;
    positions[i + 1] = y;
    positions[i + 2] = z;
  }
  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  let flip = false;
  for (let i = 0; i < positions.length; i += 3) {
    if (positions[i] > 0.45) {
      if (normals[i] < 0) flip = true;
      break;
    }
  }
  if (flip) {
    for (let i = 0; i < indices.length; i += 3) {
      const t = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = t;
    }
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  }
  const vd = new BABYLON.VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  return vd;
}

function createPipsVertexData() {
  const positions = [];
  const indices = [];
  const normals = [];
  const o = PIP_OFFSET;
  const PR = 0.1;
  const SEG = 16;
  const pf = [
    { fA: 1, fV: +0.5, uA: 0, vA: 2, pips: [[0, 0]] },
    { fA: 1, fV: -0.5, uA: 0, vA: 2, pips: [[-o, -o], [-o, 0], [-o, +o], [+o, -o], [+o, 0], [+o, +o]] },
    { fA: 0, fV: +0.5, uA: 2, vA: 1, pips: [[-o, -o], [+o, +o]] },
    { fA: 0, fV: -0.5, uA: 2, vA: 1, pips: [[-o, -o], [-o, +o], [0, 0], [+o, -o], [+o, +o]] },
    { fA: 2, fV: +0.5, uA: 1, vA: 0, pips: [[+o, -o], [0, 0], [-o, +o]] },
    { fA: 2, fV: -0.5, uA: 1, vA: 0, pips: [[-o, -o], [-o, +o], [+o, -o], [+o, +o]] },
  ];
  for (const { fA, fV, uA, vA, pips } of pf) {
    const sign = Math.sign(fV);
    for (const [cu, cv] of pips) {
      const base = positions.length / 3;
      const nn = [0, 0, 0];
      nn[fA] = sign;
      const cc = [0, 0, 0];
      cc[fA] = fV;
      cc[uA] = cu;
      cc[vA] = cv;
      positions.push(cc[0], cc[1], cc[2]);
      normals.push(nn[0], nn[1], nn[2]);
      for (let i = 0; i < SEG; i++) {
        const a = (2 * Math.PI * i) / SEG;
        const v = [0, 0, 0];
        v[fA] = fV;
        v[uA] = cu + Math.cos(a) * PR;
        v[vA] = cv + Math.sin(a) * PR;
        positions.push(v[0], v[1], v[2]);
        normals.push(nn[0], nn[1], nn[2]);
      }
      for (let i = 0; i < SEG; i++) {
        if (sign > 0) indices.push(base, base + 1 + i, base + 1 + ((i + 1) % SEG));
        else indices.push(base, base + 1 + ((i + 1) % SEG), base + 1 + i);
      }
    }
  }
  const vd = new BABYLON.VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  return vd;
}

const cachedOuterVD = createDiceVertexData();
const cachedPipsVD = createPipsVertexData();
const pipMat = new BABYLON.StandardMaterial('pipMat', scene);
pipMat.disableLighting = true;
pipMat.emissiveColor = BABYLON.Color3.FromHexString(PIP_COLOR);
pipMat.diffuseColor = BABYLON.Color3.Black();
pipMat.specularColor = BABYLON.Color3.Black();
pipMat.zOffset = -2;
const backingMat = new BABYLON.StandardMaterial('backMat', scene);
backingMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
backingMat.specularColor = BABYLON.Color3.Black();

const dice = [];
let dieIdCounter = 0;
const DICE_COLLISION_GROUP = 2;
const DICE_COLLISION_MASK = STATIC_ENV_GROUP | DICE_COLLISION_GROUP;

function applyDiceCollisionToShapeAndHull(shape) {
  shape.collisionFilterGroup = DICE_COLLISION_GROUP;
  shape.collisionFilterMask = DICE_COLLISION_MASK;
  const hull = shape.convexPolyhedronRepresentation;
  if (hull) {
    hull.collisionFilterGroup = DICE_COLLISION_GROUP;
    hull.collisionFilterMask = DICE_COLLISION_MASK;
  }
}

function finalizeDiceBodyCollision(body) {
  body.collisionFilterGroup = DICE_COLLISION_GROUP;
  body.collisionFilterMask = DICE_COLLISION_MASK;
  for (let i = 0; i < body.shapes.length; i++) {
    applyDiceCollisionToShapeAndHull(body.shapes[i]);
  }
}

const _faceTmp = new CANNON.Vec3();
const _faceLv = new CANNON.Vec3();
const _faceLocals = [
  { x: 0, y: 1, z: 0, val: 1 }, { x: 0, y: -1, z: 0, val: 6 },
  { x: 1, y: 0, z: 0, val: 2 }, { x: -1, y: 0, z: 0, val: 5 },
  { x: 0, y: 0, z: 1, val: 3 }, { x: 0, y: 0, z: -1, val: 4 },
];

function readFaceValue(body) {
  const q = body.quaternion;
  const worldUp = new CANNON.Vec3(0, 1, 0);
  let bestDot = -2;
  let secondDot = -2;
  let bestVal = null;
  for (const f of _faceLocals) {
    _faceLv.set(f.x, f.y, f.z);
    q.vmult(_faceLv, _faceTmp);
    const dot = _faceTmp.dot(worldUp);
    if (dot > bestDot) {
      secondDot = bestDot;
      bestDot = dot;
      bestVal = f.val;
    } else if (dot > secondDot) secondDot = dot;
  }
  if (bestDot < 0.72) return null;
  if (bestDot - secondDot < 0.06) return null;
  return bestVal;
}

let labPhase = 'waiting';
let labRollIndex = 0;

function updateLabHud() {
  const el = $('labPhaseLine');
  const map = { waiting: 'ожидание', aiming: 'прицел (слинг)', rolling: 'катятся' };
  if (el) el.textContent = `Фаза: ${map[labPhase] || labPhase}`;
}

function appendLabRollHistory(vals) {
  const log = $('labRollLog');
  if (!log) return;
  labRollIndex += 1;
  const div = document.createElement('div');
  div.className = 'entry';
  div.textContent = `#${labRollIndex} — ${vals.join(' ')}`;
  log.insertBefore(div, log.firstChild);
}

function checkLabAllSettled() {
  if (!dice.length || !dice.every((d) => d.settled)) return;
  if (labPhase !== 'rolling') return;
  labPhase = 'waiting';
  const vals = dice.map((d) => d.value);
  const facesEl = $('labFaces');
  const line = vals.every((v) => v != null) ? vals.join(' · ') : vals.map((v) => (v == null ? '?' : v)).join(' · ');
  if (facesEl) facesEl.textContent = line;
  appendLabRollHistory(vals.map((v) => (v == null ? '?' : v)));
  updateLabHud();
}

function createDie() {
  const id = dieIdCounter++;
  const sc = battleTune.mesh.dieScale;
  const oMat = new BABYLON.StandardMaterial(`o${id}`, scene);
  oMat.diffuseColor = BABYLON.Color3.FromHexString(BODY_COLOR);
  oMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  const root = new BABYLON.TransformNode(`die${id}`, scene);
  root.rotationQuaternion = BABYLON.Quaternion.Identity();
  root.scaling.setAll(sc);
  const outer = new BABYLON.Mesh(`outer${id}`, scene);
  cachedOuterVD.applyToMesh(outer);
  outer.material = oMat;
  outer.parent = root;
  outer.receiveShadows = true;
  shadowGen.addShadowCaster(outer);
  const pips = new BABYLON.Mesh(`pips${id}`, scene);
  cachedPipsVD.applyToMesh(pips);
  pips.material = pipMat;
  pips.parent = root;
  const backing = BABYLON.MeshBuilder.CreateBox(`back${id}`, { size: 0.9 }, scene);
  backing.material = backingMat;
  backing.parent = root;
  const hs = battleTune.mesh.boxHalfPerScale * sc;
  const boxShape = new CANNON.Box(new CANNON.Vec3(hs, hs, hs));
  const body = new CANNON.Body({
    mass: battleTune.body.mass,
    shape: boxShape,
    sleepTimeLimit: battleTune.body.sleepTime,
    sleepSpeedLimit: battleTune.body.sleepSpeed,
    linearDamping: battleTune.body.linearDamping,
    angularDamping: battleTune.body.angularDamping,
  });
  finalizeDiceBodyCollision(body);
  world.addBody(body);
  const stashY = FLOOR_Y - 8;
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
  body.addEventListener('sleep', () => {
    body.allowSleep = false;
    const v = readFaceValue(body);
    if (v !== null) {
      die.value = v;
      die.settled = true;
      checkLabAllSettled();
    } else {
      body.allowSleep = true;
    }
  });
  return die;
}

function disposeDie(d) {
  hl.removeMesh(d.outer);
  shadowGen.removeShadowCaster(d.outer);
  d.pips.dispose();
  d.backing.dispose();
  d.outer.dispose();
  d.root.dispose();
  d.oMat.dispose();
  if (d.body) {
    world.removeBody(d.body);
    d.body = null;
  }
}

function syncActiveDice(n) {
  while (dice.length < n) dice.push(createDie());
  while (dice.length > n) disposeDie(dice.pop());
}

function applyTuneToWorld() {
  world.gravity.set(0, battleTune.world.gravity, 0);
  world.defaultContactMaterial.restitution = battleTune.world.restitution;
  world.defaultContactMaterial.friction = battleTune.world.friction;
}

function applyTuneToAllDiceBodies() {
  const b = battleTune.body;
  for (const d of dice) {
    const body = d.body;
    if (!body) continue;
    body.mass = b.mass;
    body.linearDamping = b.linearDamping;
    body.angularDamping = b.angularDamping;
    body.sleepTimeLimit = b.sleepTime;
    body.sleepSpeedLimit = b.sleepSpeed;
    body.updateMassProperties();
  }
}

let lastTuneMeshKey = `${battleTune.mesh.dieScale}|${battleTune.mesh.boxHalfPerScale}`;

function meshTuneKey() {
  return `${battleTune.mesh.dieScale}|${battleTune.mesh.boxHalfPerScale}`;
}

function applyLabTuneFromMemory() {
  applyTuneToWorld();
  const mk = meshTuneKey();
  const n = dice.length;
  if (mk !== lastTuneMeshKey) {
    syncActiveDice(0);
    syncActiveDice(n);
    lastTuneMeshKey = mk;
    labPhase = 'waiting';
    updateLabHud();
  } else {
    applyTuneToAllDiceBodies();
  }
  try {
    localStorage.setItem(LS_BATTLE_TUNE, JSON.stringify(battleTune));
  } catch (_) {}
  const ro = $('labTuneReadout');
  if (ro) {
    const s = JSON.stringify(battleTune);
    ro.textContent = (s.length > 200 ? `${s.slice(0, 197)}…` : s) + '\n✓ saved';
  }
}

function rollSpawnOffsetsEdgeFrame(i, n, tx, tz, nx, nz) {
  const cols = 3;
  const rows = Math.ceil(n / cols) || 1;
  const row = Math.floor(i / cols);
  const col = i % cols;
  const inRow = Math.min(cols, n - row * cols);
  const capAlong = Math.min(ROLL_FLOOR_W * 0.2, 1.05 * TABLE_WORLD_SCALE * TABLE_X_STRETCH);
  const capIn = Math.min(ROLL_DEPTH_Z * 0.22, 0.52 * TABLE_WORLD_SCALE * TABLE_Z_STRETCH);
  const spreadAlong = Math.max(getDiceSpawnMinSpacing(), capAlong);
  const spreadIn = Math.max(getDiceSpawnMinSpacing(), capIn);
  const u = (col - (inRow - 1) / 2) * spreadAlong;
  const v = (row - (rows - 1) / 2) * spreadIn;
  return { ox: tx * u + nx * v, oz: tz * u + nz * v };
}

function findRollScreenBottomTopEdges() {
  const yRef = getSlingPickY();
  const czMid = DIVIDER_Z + ROLL_DEPTH_Z * 0.5;
  const m = 0.42;
  const xLo = -WX + m;
  const xHi = WX - m;
  const zLo = DIVIDER_Z + m;
  const zHi = BOT_DIVIDER_Z - m;
  const pts = [
    { x: 0, z: zLo },
    { x: 0, z: zHi },
    { x: xLo, z: czMid },
    { x: xHi, z: czMid },
  ];
  const w = engine.getRenderWidth();
  const h = engine.getRenderHeight();
  const worldM = BABYLON.Matrix.Identity();
  const transform = scene.getTransformMatrix();
  const vp = camera.viewport.toGlobal(w, h);
  let maxSy = -Infinity;
  let minSy = Infinity;
  let bottom = pts[0];
  let top = pts[0];
  for (const p of pts) {
    const projected = BABYLON.Vector3.Project(new BABYLON.Vector3(p.x, yRef, p.z), worldM, transform, vp);
    const sy = projected.y;
    if (sy > maxSy) {
      maxSy = sy;
      bottom = p;
    }
    if (sy < minSy) {
      minSy = sy;
      top = p;
    }
  }
  const rollCx = 0;
  const rollCz = czMid;
  const dirPlayer = { x: rollCx - bottom.x, z: rollCz - bottom.z };
  const lenP = Math.hypot(dirPlayer.x, dirPlayer.z) || 1;
  dirPlayer.x /= lenP;
  dirPlayer.z /= lenP;
  const dirBot = { x: rollCx - top.x, z: rollCz - top.z };
  const lenB = Math.hypot(dirBot.x, dirBot.z) || 1;
  dirBot.x /= lenB;
  dirBot.z /= lenB;
  const tangPlayer = { x: -dirPlayer.z, z: dirPlayer.x };
  const tangBot = { x: -dirBot.z, z: dirBot.x };
  return { bottom, top, dirPlayer, dirBot, tangPlayer, tangBot };
}

const THROW_Z_INSET = 0.12;

function throwFromBottomLab() {
  const rp = battleTune.rollPlayer;
  const fr = findRollScreenBottomTopEdges();
  const edge = fr.bottom;
  const dirIn = fr.dirPlayer;
  const tang = fr.tangPlayer;
  const inset = Math.min(ROLL_DEPTH_Z, ROLL_FLOOR_W * 0.35) * THROW_Z_INSET;
  const baseX = edge.x + dirIn.x * inset;
  const baseZ = edge.z + dirIn.z * inset;
  for (const d of dice) {
    d.value = null;
    d.settled = false;
    hl.removeMesh(d.outer);
  }
  labPhase = 'rolling';
  const facesEl = $('labFaces');
  if (facesEl) facesEl.textContent = '…';
  updateLabHud();
  const jCap = getDiceSpawnMinSpacing() * battleTune.spawn.jitterMul;
  const jTanMax = Math.min(battleTune.rollImpulseLever * TABLE_WORLD_SCALE * TABLE_X_STRETCH, jCap);
  const jInMax = Math.min(rp.planeJitter * TABLE_WORLD_SCALE * TABLE_Z_STRETCH, jCap);
  const perpX = -dirIn.z;
  const perpZ = dirIn.x;
  for (let i = 0; i < dice.length; i++) {
    const d = dice[i];
    d.outer.setEnabled(true);
    d.pips.setEnabled(true);
    d.backing.setEnabled(true);
    d.body.type = CANNON.Body.DYNAMIC;
    d.body.velocity.setZero();
    d.body.angularVelocity.setZero();
    const { ox, oz } = rollSpawnOffsetsEdgeFrame(i, dice.length, tang.x, tang.z, dirIn.x, dirIn.z);
    const jx = (Math.random() - 0.5) * jTanMax;
    const jz = (Math.random() - 0.5) * jInMax;
    d.body.position.set(
      baseX + ox + jx * tang.x + jz * dirIn.x,
      FLOOR_Y + rp.spawnYOffset + i * getDiceStackYStep(),
      baseZ + oz + jx * tang.z + jz * dirIn.z,
    );
    d.body.quaternion.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    d.body.quaternion.normalize();
    const f = battleTune.body.throwMin + Math.random() * (battleTune.body.throwMax - battleTune.body.throwMin);
    const cross = (Math.random() - 0.5) * f * rp.impulseCrossMul;
    d.body.applyImpulse(
      new CANNON.Vec3(
        dirIn.x * f * rp.mainImpulse + perpX * cross,
        f * rp.impulseYMul,
        dirIn.z * f * rp.mainImpulse + perpZ * cross,
      ),
      new CANNON.Vec3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3),
    );
    d.body.allowSleep = true;
    d.body.wakeUp();
  }
}

let slingDrag = null;

function slingVizSegmentCount() {
  return Math.min(4, Math.max(1, Math.floor(battleTune.viz.segments)));
}

function hideSlingViz() {
  const svg = $('slingVizSvg');
  if (svg) svg.style.visibility = 'hidden';
  const pow = $('slingVizPow');
  if (pow) pow.style.display = 'none';
  for (let k = 0; k < slingVizSegmentCount(); k++) {
    const seg = $(`slingSeg${k}`);
    if (seg) seg.setAttribute('d', '');
  }
}

function slingWedgeBandPath(ax, ay, theta, beta, rIn, rOut) {
  const cl = Math.cos(theta - beta);
  const sl = Math.sin(theta - beta);
  const cr = Math.cos(theta + beta);
  const sr = Math.sin(theta + beta);
  const x0 = ax + rIn * cl;
  const y0 = ay + rIn * sl;
  const x1 = ax + rIn * cr;
  const y1 = ay + rIn * sr;
  const x2 = ax + rOut * cr;
  const y2 = ay + rOut * sr;
  const x3 = ax + rOut * cl;
  const y3 = ay + rOut * sl;
  return `M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z`;
}

function updateSlingViz(clientX, clientY) {
  const svg = $('slingVizSvg');
  const anchor = $('slingVizAnchor');
  const pow = $('slingVizPow');
  if (!slingDrag || slingDrag.start == null || !svg || !anchor) return;
  const sx0 = slingDrag.start.x;
  const sz0 = slingDrag.start.z;
  const piv = rollXZWorldToClient(sx0, sz0);
  const ax = piv.clientX;
  const ay = piv.clientY;
  const pick = pickRollXZFromClient(clientX, clientY);
  const pullLenW = pick ? Math.hypot(pick.x - sx0, pick.z - sz0) : 0;
  const strength = slingStrengthLinear(pullLenW);
  const minDraw = 14;
  let x2;
  let y2;
  if (pick) {
    const tp = rollXZWorldToClient(pick.x, pick.z);
    x2 = tp.clientX;
    y2 = tp.clientY;
    let sdist = Math.hypot(x2 - ax, y2 - ay);
    if (sdist < minDraw) {
      const wpx = pick.x - sx0;
      const wpz = pick.z - sz0;
      const wl = Math.hypot(wpx, wpz);
      if (wl < 1e-5) {
        x2 = ax;
        y2 = ay - minDraw;
      } else {
        const ux = wpx / wl;
        const uz = wpz / wl;
        const e = 0.28;
        const pA = rollXZWorldToClient(sx0 + ux * e, sz0 + uz * e);
        const pB = rollXZWorldToClient(sx0 - ux * e, sz0 - uz * e);
        const sdx = pA.clientX - pB.clientX;
        const sdy = pA.clientY - pB.clientY;
        const sl = Math.hypot(sdx, sdy) || 1;
        x2 = ax + (sdx / sl) * minDraw;
        y2 = ay + (sdy / sl) * minDraw;
      }
    }
  } else {
    x2 = ax;
    y2 = ay - minDraw;
  }
  anchor.setAttribute('cx', String(ax));
  anchor.setAttribute('cy', String(ay));
  const stretchLen = Math.hypot(x2 - ax, y2 - ay);
  const ux = (x2 - ax) / Math.max(stretchLen, 1e-6);
  const uy = (y2 - ay) / Math.max(stretchLen, 1e-6);
  const theta = Math.atan2(uy, ux);
  const vz = battleTune.viz;
  const nSeg = slingVizSegmentCount();
  const beta = vz.halfAngle;
  const rIn = vz.rInner;
  const rSpan = vz.rSpan;
  const R_eff = rIn + strength * rSpan;
  const quarter = rSpan / nSeg;
  for (let k = 0; k < nSeg; k++) {
    const seg = $(`slingSeg${k}`);
    if (!seg) continue;
    const rStart = rIn + k * quarter;
    if (R_eff <= rStart + 0.25) {
      seg.setAttribute('d', '');
      continue;
    }
    const rEndNom = rIn + (k + 1) * quarter;
    const rEnd = Math.min(R_eff, rEndNom);
    seg.setAttribute('d', slingWedgeBandPath(ax, ay, theta, beta, rStart, rEnd));
  }
  svg.style.visibility = 'visible';
  if (pow && pullLenW > getSlingClickEpsWorld()) {
    const pct = Math.max(1, Math.min(100, Math.round(strength * 100)));
    pow.textContent = `${pct}%`;
    const midR = rIn + (R_eff - rIn) * 0.52;
    pow.setAttribute('x', String(ax + midR * Math.cos(theta)));
    pow.setAttribute('y', String(ay + midR * Math.sin(theta) - 10));
    pow.style.display = 'block';
  } else if (pow) {
    pow.style.display = 'none';
  }
}

function clampRollXZ(x, z) {
  const margin = 0.4;
  const xCl = Math.max(-WX + margin, Math.min(WX - margin, x));
  const zLo = DIVIDER_Z + margin;
  const zHi = BOT_DIVIDER_Z - margin;
  return { x: xCl, z: Math.max(zLo, Math.min(zHi, z)) };
}

function pickRollXZFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const rw = engine.getRenderWidth();
  const rh = engine.getRenderHeight();
  const sx = ((clientX - rect.left) / Math.max(rect.width, 1)) * rw;
  const sy = ((clientY - rect.top) / Math.max(rect.height, 1)) * rh;
  const ray = scene.createPickingRay(sx, sy, null, camera);
  const oy = ray.origin.y;
  const dy = ray.direction.y;
  if (Math.abs(dy) < 1e-5) return null;
  const t = (getSlingPickY() - oy) / dy;
  if (t < 0) return null;
  const x = ray.origin.x + ray.direction.x * t;
  const z = ray.origin.z + ray.direction.z * t;
  return clampRollXZ(x, z);
}

function rollXZWorldToClient(xw, zw) {
  const w = engine.getRenderWidth();
  const h = engine.getRenderHeight();
  const rect = canvas.getBoundingClientRect();
  const vp = camera.viewport.toGlobal(w, h);
  const worldM = BABYLON.Matrix.Identity();
  const transform = scene.getTransformMatrix();
  const projected = BABYLON.Vector3.Project(
    new BABYLON.Vector3(xw, getSlingPickY(), zw),
    worldM,
    transform,
    vp,
  );
  return {
    clientX: rect.left + (projected.x / Math.max(w, 1)) * rect.width,
    clientY: rect.top + (projected.y / Math.max(h, 1)) * rect.height,
  };
}

function positionKinematicClusterSling(anchorX, anchorZ, pickX, pickZ) {
  let pullX = pickX - anchorX;
  let pullZ = pickZ - anchorZ;
  let pullLen = Math.hypot(pullX, pullZ);
  if (pullLen < 1e-5) {
    pullX = 0;
    pullZ = 1;
    pullLen = 1;
  } else {
    pullX /= pullLen;
    pullZ /= pullLen;
  }
  const tangX = -pullZ;
  const tangZ = pullX;
  const inX = -pullX;
  const inZ = -pullZ;
  const baseX = pickX;
  const baseZ = pickZ;
  const spawnYBase = FLOOR_Y + battleTune.rollPlayer.spawnYOffset;
  for (let i = 0; i < dice.length; i++) {
    const d = dice[i];
    d.body.type = CANNON.Body.KINEMATIC;
    d.body.velocity.setZero();
    d.body.angularVelocity.setZero();
    d.outer.setEnabled(true);
    d.pips.setEnabled(true);
    d.backing.setEnabled(true);
    const { ox, oz } = rollSpawnOffsetsEdgeFrame(i, dice.length, tangX, tangZ, inX, inZ);
    d.body.position.set(baseX + ox, spawnYBase, baseZ + oz);
    if (!d._slingPose) {
      d._slingPose = true;
      d.body.quaternion.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      d.body.quaternion.normalize();
    }
    d.body.allowSleep = false;
  }
}

/**
 * Слинг в лабе: та же схема, что ROLL (`throwDice` в battle) — свой f на кубик,
 * applyImpulse не в центре, cross по перпендикуляру к прицелу, случайный quaternion.
 * Сила натяжения масштабирует throwMin…throwMax (0.12…1.0 от слабого к полному).
 * В battle.html слинг пока по старой схеме (общая скорость); здесь намеренно иначе для эксперимента.
 */
function applyRollImpulsesFromCurrentPositions(sling) {
  const aimX = sling.aimX;
  const aimZ = sling.aimZ;
  const strength = sling.strength;
  for (const d of dice) {
    d.value = null;
    d.settled = false;
    hl.removeMesh(d.outer);
  }
  labPhase = 'rolling';
  const facesEl = $('labFaces');
  if (facesEl) facesEl.textContent = '…';
  updateLabHud();
  const rp = battleTune.rollPlayer;
  const perpX = -aimZ;
  const perpZ = aimX;
  const sm = 0.12 + 0.88 * strength;
  const tMin = battleTune.body.throwMin * sm;
  const tMax = battleTune.body.throwMax * sm;

  for (let i = 0; i < dice.length; i++) {
    const d = dice[i];
    d.body.type = CANNON.Body.DYNAMIC;
    d.body.velocity.setZero();
    d.body.angularVelocity.setZero();
    d.body.quaternion.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    d.body.quaternion.normalize();
    delete d._slingPose;

    const span = tMax - tMin;
    const f = span > 0 ? tMin + Math.random() * span : tMin;
    const cross = (Math.random() - 0.5) * f * rp.impulseCrossMul;
    d.body.applyImpulse(
      new CANNON.Vec3(
        aimX * f * rp.mainImpulse + perpX * cross,
        f * rp.impulseYMul,
        aimZ * f * rp.mainImpulse + perpZ * cross,
      ),
      new CANNON.Vec3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3),
    );
    d.body.allowSleep = true;
    d.body.wakeUp();
  }
}

function finishPlayerSling(ev) {
  if (!slingDrag) return;
  const start = slingDrag.start;
  slingDrag = null;
  hideSlingViz();
  try {
    canvas.releasePointerCapture(ev.pointerId);
  } catch (_) {}

  const end = pickRollXZFromClient(ev.clientX, ev.clientY) || start;
  const pullX = end.x - start.x;
  const pullZ = end.z - start.z;
  const pullLen = Math.hypot(pullX, pullZ);

  if (pullLen <= getSlingClickEpsWorld()) {
    labPhase = 'waiting';
    syncActiveDice(0);
    syncLabDiceCount();
    updateLabHud();
    return;
  }
  const aimX = -pullX / pullLen;
  const aimZ = -pullZ / pullLen;
  const strength = slingStrengthLinear(pullLen);
  applyRollImpulsesFromCurrentPositions({ aimX, aimZ, strength });
}

function getLabDiceCount() {
  const inp = $('labDiceCount');
  const n = inp ? parseInt(inp.value, 10) : 6;
  return Math.min(12, Math.max(1, Number.isFinite(n) ? n : 6));
}

function syncLabDiceCount() {
  syncActiveDice(getLabDiceCount());
}

function physicsTuneInputId(path) {
  return `labTune_${path.replace(/\./g, '_')}`;
}

function getTuneAtPath(obj, path) {
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function setTuneAtPath(obj, path, val) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = val;
}

/** EN + RU: что меняется в игре; дублируется в battle.html PHYSICS_TUNE_FIELDS — при добавлении полей правь оба. */
const PHYSICS_TUNE_FIELDS = [
  { section: 'World', path: 'world.gravity', label: 'Gravity Y', step: 1,
    en: 'Pull strength downward. More negative = faster fall and harder impacts.',
    ru: 'Сила притяжения вниз. Чем отрицательнее — тем быстрее падают кубики и сильнее удары о стол.' },
  { section: 'World', path: 'world.restitution', label: 'Restitution', step: 0.05,
    en: 'How much energy stays after a bounce. Higher = bouncier dice and walls; lower = dead drops.',
    ru: 'Доля энергии после отскока. Выше — сильнее подпрыгивают от стола и бортов; ниже — почти без отскока.' },
  { section: 'World', path: 'world.friction', label: 'Friction', step: 0.05,
    en: 'Grip when surfaces slide. Higher = dice skid less and roll shorter; lower = more sliding.',
    ru: 'Сцепление при скольжении. Выше — меньше проскальзывание, короче катание; ниже — больше скольжения по столу.' },
  { section: 'Body & ROLL impulse', path: 'body.mass', label: 'Mass', step: 0.1,
    en: 'Heavier dice need a stronger impulse for the same speed (sling and ROLL).',
    ru: 'Масса тела: при той же силе броска тяжелее кубики разгоняются слабее (слинг и ROLL).' },
  { section: 'Body & ROLL impulse', path: 'body.linearDamping', label: 'Linear damping', step: 0.01,
    en: 'Air-like drag on movement. Higher = straight-line speed dies off faster.',
    ru: 'Затухание поступательной скорости. Выше — быстрее гасится движение по прямой.' },
  { section: 'Body & ROLL impulse', path: 'body.angularDamping', label: 'Angular damping', step: 0.01,
    en: 'Spin slowdown. Higher = tumbling stops sooner; lower = longer wobble.',
    ru: 'Затухание вращения. Выше — быстрее перестаёт крутиться; ниже — дольше шатается.' },
  { section: 'Body & ROLL impulse', path: 'body.sleepTime', label: 'Sleep time', step: 0.05,
    en: 'Seconds nearly still before the engine may freeze the body (saves CPU).',
    ru: 'Сколько секунд «почти покой», прежде чем движок может усыпить тело (экономия расчёта).' },
  { section: 'Body & ROLL impulse', path: 'body.sleepSpeed', label: 'Sleep speed', step: 0.01,
    en: 'Max speed still counted as “at rest” for sleep. Lower = stricter “fully stopped”.',
    ru: 'Порог скорости «ещё покой» для усыпления. Ниже — строже условие «уже стоит».' },
  { section: 'Body & ROLL impulse', path: 'body.throwMin', label: 'ROLL throw min', step: 0.5,
    en: 'Weakest scripted ROLL impulse (player/bot); actual throw picks random between min and max.',
    ru: 'Минимальная сила скриптового ROLL; реальный бросок — случайно между min и max.' },
  { section: 'Body & ROLL impulse', path: 'body.throwMax', label: 'ROLL throw max', step: 0.5,
    en: 'Strongest scripted ROLL impulse; together with min sets how hard ROLL can be.',
    ru: 'Максимальная сила скриптового ROLL; вместе с min задаёт диапазон силы броска.' },
  { section: 'Sling physics', path: 'sling.maxPullWorld', label: 'Max pull (world)', step: 0.5,
    en: 'Rubber-band length in world units that maps to 100% sling power (linear scale).',
    ru: 'Длина натяжения в мировых единицах, которой соответствует 100% силы слинга (линейная шкала).' },
  { section: 'Sling physics', path: 'sling.clickEpsMul', label: 'Click cancel ε mul', step: 0.005,
    en: 'Tiny pull below (this × table scale) counts as a click cancel, not a throw.',
    ru: 'Натяжение меньше (это × масштаб стола) считается отменой кликом, а не броском.' },
  { section: 'Sling physics', path: 'sling.pickYOffset', label: 'Pick plane Y offset', step: 0.05,
    en: 'Height of the invisible floor used for aim ray; shifts where the sling line meets the table.',
    ru: 'Высота невидимой плоскости прицела; сдвигает точку, куда «приземляется» луч прицела.' },
  { section: 'Sling physics', path: 'sling.impulseHMin', label: 'Impulse H min', step: 0.1,
    en: 'Horizontal kick at 0% sling (before ÷ mass). Sets weak-side sideways speed.',
    ru: 'Горизонтальный импульс при 0% силы (до ÷ масса). Задаёт слабую сторону по горизонтали.' },
  { section: 'Sling physics', path: 'sling.impulseHMax', label: 'Impulse H max', step: 0.1,
    en: 'Horizontal kick at 100% sling (before ÷ mass).',
    ru: 'Горизонтальный импульс при 100% силы (до ÷ масса).' },
  { section: 'Sling physics', path: 'sling.impulseYMin', label: 'Impulse Y min', step: 0.1,
    en: 'Upward kick at 0% sling.',
    ru: 'Вертикальный импульс вверх при 0% силы.' },
  { section: 'Sling physics', path: 'sling.impulseYMax', label: 'Impulse Y max', step: 0.1,
    en: 'Upward kick at 100% sling.',
    ru: 'Вертикальный импульс вверх при 100% силы.' },
  { section: 'Sling HUD (SVG)', path: 'viz.halfAngle', label: 'Wedge half-angle (rad)', step: 0.02,
    en: 'Half the angular width of each power wedge in the on-screen fan.',
    ru: 'Половина угловой ширины каждой полосы веера силы на экране.' },
  { section: 'Sling HUD (SVG)', path: 'viz.rInner', label: 'Inner radius (px)', step: 1,
    en: 'Hole in the middle of the wedge fan (pixels).',
    ru: 'Внутренний «вырез» веера в пикселях.' },
  { section: 'Sling HUD (SVG)', path: 'viz.rSpan', label: 'Radius span (px)', step: 4,
    en: 'How much the fan grows in radius from 0% to 100% power.',
    ru: 'Насколько веер растёт по радиусу от 0% до 100% силы.' },
  { section: 'Sling HUD (SVG)', path: 'viz.segments', label: 'Segments (1–4)', step: 1,
    en: 'How many colored bands; max 4 (one SVG path each).',
    ru: 'Сколько цветных полос; не больше 4 (в разметке по одному path).' },
  { section: 'Spawn grid', path: 'spawn.minSpacingMul', label: 'Min spacing × edge', step: 0.02,
    en: 'Minimum gap between dice centers as a fraction of die edge length.',
    ru: 'Минимальный зазор между центрами кубиков в долях длины ребра.' },
  { section: 'Spawn grid', path: 'spawn.stackYStepMul', label: 'Stack Y step × edge', step: 0.02,
    en: 'Vertical step between stacked dice as a fraction of die edge.',
    ru: 'Вертикальный шаг стопки в долях ребра кубика.' },
  { section: 'Spawn grid', path: 'spawn.jitterMul', label: 'Plane jitter × spacing', step: 0.02,
    en: 'Random sideways shift cap as a fraction of min spacing (breaks perfect grids).',
    ru: 'Предел случайного сдвига в плоскости как доля минимального шага (ломает идеальную сетку).' },
  { section: 'ROLL — player', path: 'rollPlayer.spawnYOffset', label: 'Spawn Y (floor+)', step: 0.1,
    en: 'How high above the floor player ROLL dice appear.',
    ru: 'Насколько выше пола появляются кубики при ROLL игрока.' },
  { section: 'ROLL — player', path: 'rollPlayer.planeJitter', label: 'Plane jitter', step: 0.05,
    en: 'Random spread in the roll zone (scaled with table); wider = less aligned spawns.',
    ru: 'Разброс позиции в зоне броска (с масштабом стола); больше — менее ровная постановка.' },
  { section: 'ROLL — player', path: 'rollPlayer.impulseYMul', label: 'Impulse Y mul', step: 0.02,
    en: 'Vertical part of ROLL impulse as a fraction of the base throw strength.',
    ru: 'Доля вертикали в импульсе ROLL от базовой силы броска.' },
  { section: 'ROLL — player', path: 'rollPlayer.impulseCrossMul', label: 'Cross mul', step: 0.02,
    en: 'Sideways “cross” impulse as a fraction of base throw (spread across the roll band).',
    ru: 'Поперечный импульс как доля базы (разнос по ширине зоны).' },
  { section: 'ROLL — player', path: 'rollPlayer.mainImpulse', label: 'Main impulse mul', step: 0.02,
    en: 'Multiplier on impulse along the main roll direction.',
    ru: 'Множитель импульса вдоль основного направления броска.' },
  { section: 'ROLL — bot', path: 'rollBot.spawnYOffset', label: 'Spawn Y (floor+)', step: 0.1,
    en: 'Spawn height for bot ROLL (same idea as player).',
    ru: 'Высота спавна ROLL бота (тот же смысл, что у игрока).' },
  { section: 'ROLL — bot', path: 'rollBot.planeJitter', label: 'Plane jitter', step: 0.05,
    en: 'In-plane randomness for bot scripted throws.',
    ru: 'Случайный разброс в плоскости для броска бота.' },
  { section: 'ROLL — bot', path: 'rollBot.impulseYMul', label: 'Impulse Y mul', step: 0.02,
    en: 'Vertical fraction of base throw for bot.',
    ru: 'Вертикальная доля базового броска для бота.' },
  { section: 'ROLL — bot', path: 'rollBot.impulseCrossMul', label: 'Cross mul', step: 0.02,
    en: 'Cross impulse fraction for bot.',
    ru: 'Доля поперечного импульса для бота.' },
  { section: 'ROLL — bot', path: 'rollBot.mainImpulse', label: 'Main impulse mul', step: 0.02,
    en: 'Along-direction multiplier for bot ROLL.',
    ru: 'Множитель вдоль направления броска для бота.' },
  { section: 'ROLL tangent cap', path: 'rollImpulseLever', label: 'Tangent jitter cap', step: 0.02,
    en: 'Scales max sideways jitter vs table X stretch (feeds the tangent noise limit).',
    ru: 'Масштабирует предел бокового джиттера к растяжению стола по X (влияет на предел тангенса).' },
  { section: 'Mesh & physics box', path: 'mesh.dieScale', label: 'Die mesh scale', step: 0.05,
    en: 'Visual size and physics box size together (uniform scale).',
    ru: 'Размер кубика на экране и в физике меняются вместе (равномерный масштаб).' },
  { section: 'Mesh & physics box', path: 'mesh.boxHalfPerScale', label: 'Box half / scale', step: 0.02,
    en: 'Physics half-extent factor before dieScale (hitbox vs mesh tuning).',
    ru: 'Множитель полуребра физической коробки до dieScale (подгон коллайдера к мешу).' },
  { section: 'Settling nudge', path: 'settle.alignThreshold', label: 'Face align threshold', step: 0.01,
    en: 'If a die is slow but a face is not flat enough, apply a small spin nudge.',
    ru: 'Если кубик почти стоит, но грань «криво», добавляется лёгкое вращение для доводки.' },
  { section: 'Settling nudge', path: 'settle.angKick', label: 'Angular kick', step: 0.5,
    en: 'Strength of that corrective spin when nudging.',
    ru: 'Сила этого корректирующего вращения.' },
  { section: 'Settling nudge', path: 'settle.speedLo', label: 'Speed band low', step: 0.01,
    en: 'Only nudge if combined speed is above this (ignore nearly still dice).',
    ru: 'Пинок только если скорость выше порога (не трогать уже стоящие).' },
  { section: 'Settling nudge', path: 'settle.speedHi', label: 'Speed band high', step: 0.1,
    en: 'Only nudge if combined speed is below this (do not kick mid-flight).',
    ru: 'Пинок только если скорость ниже порога (не мешать полёту).' },
];

/** Верхняя оценка Δv после слинга в лабе (сила 100%): как ROLL, f ≤ throwMax·sm. */
function labSlingApproxMaxDeltaVAtFullStrength() {
  const m = battleTune.body.mass;
  const sm = 0.12 + 0.88 * 1;
  const fMax = battleTune.body.throwMax * sm;
  const rp = battleTune.rollPlayer;
  return {
    vy: (fMax * rp.impulseYMul) / m,
    vh: (fMax * rp.mainImpulse) / m,
  };
}

function estimateBallisticTimeSlingToFloor() {
  const h = battleTune.rollPlayer.spawnYOffset;
  if (!(h > 0)) return null;
  const { vy } = labSlingApproxMaxDeltaVAtFullStrength();
  const g = battleTune.world.gravity;
  if (!(vy > 0) || !(g < 0)) return null;
  const disc = vy * vy - 2 * g * h;
  if (disc < 0) return null;
  const rt = Math.sqrt(disc);
  const t = (-vy - rt) / g;
  if (!Number.isFinite(t) || t <= 0 || t > 90) return null;
  return t;
}

function updateRealismPanelLabels() {
  const mEl = $('labRmMass');
  const gEl = $('labRmGrav');
  const pEl = $('labRmPower');
  const aEl = $('labRmArc');
  const dEl = $('labRmDrag');
  const mv = $('labRmMassV');
  const gv = $('labRmGravV');
  const pv = $('labRmPowerV');
  const av = $('labRmArcV');
  const dv = $('labRmDragV');
  if (mv && mEl) mv.textContent = `${Number(mEl.value).toFixed(2)}`;
  if (gv && gEl) gv.textContent = `${Number(gEl.value).toFixed(0)}`;
  if (pv && pEl) pv.textContent = `${Number(pEl.value).toFixed(2)}×`;
  if (av && aEl) av.textContent = `${Number(aEl.value).toFixed(2)}×`;
  if (dv && dEl) dv.textContent = `${Number(dEl.value).toFixed(2)}×`;
}

function updateRealismEstimateText() {
  const el = $('labRealismEst');
  if (!el) return;
  const t = estimateBallisticTimeSlingToFloor();
  const { vy, vh } = labSlingApproxMaxDeltaVAtFullStrength();
  const lines = [];
  if (t != null) {
    lines.push(`До касания пола (слинг 100%, только вертикаль + g, без демпфа): ~${t.toFixed(2)} с`);
  } else {
    lines.push('Время до пола не оценить (проверь высоту спавна и импульс Y).');
  }
  lines.push(`После слинга 100%: верт. скорость ≈ ${vy.toFixed(2)}, гориз. ≈ ${vh.toFixed(2)} (усл. ед./с; v = импульс / масса).`);
  lines.push('В симуляции скорость ещё гасит «затухание» — это не настоящее сопротивление воздуха.');
  el.textContent = lines.join('\n');
}

function syncRealismSlidersFromTune() {
  const rb = REALISM_IMPULSE_BASE;
  const massEl = $('labRmMass');
  const gravEl = $('labRmGrav');
  const powEl = $('labRmPower');
  const arcEl = $('labRmArc');
  const dragEl = $('labRmDrag');
  if (!massEl || !gravEl || !powEl || !arcEl || !dragEl) return;
  massEl.value = String(clamp(battleTune.body.mass, 0.25, 4));
  gravEl.value = String(clamp(battleTune.world.gravity, -85, -22));
  const pm = rb.throwMin > 1e-6 ? battleTune.body.throwMin / rb.throwMin : 1;
  powEl.value = String(clamp(pm, REALISM_POWER_MIN, REALISM_POWER_MAX));
  const power = parseFloat(powEl.value);
  const arcRaw = (rb.impulseYMax > 1e-6 ? battleTune.sling.impulseYMax / rb.impulseYMax : 1) / (power > 0.05 ? power : 1);
  arcEl.value = String(clamp(arcRaw, 0.45, 1.75));
  const dragMul = rb.linearDamping > 1e-8 ? battleTune.body.linearDamping / rb.linearDamping : 1;
  dragEl.value = String(clamp(dragMul, 0.15, 2.8));
  updateRealismPanelLabels();
  updateRealismEstimateText();
}

function applyRealismFromSliders() {
  const rb = REALISM_IMPULSE_BASE;
  const num = (el, fb) => {
    const n = parseFloat(el?.value);
    return Number.isFinite(n) ? n : fb;
  };
  const mass = clamp(num($('labRmMass'), battleTune.body.mass), 0.25, 4);
  const grav = clamp(num($('labRmGrav'), battleTune.world.gravity), -85, -22);
  const power = clamp(num($('labRmPower'), 1), REALISM_POWER_MIN, REALISM_POWER_MAX);
  const arc = clamp(num($('labRmArc'), 1), 0.45, 1.75);
  const dragMul = clamp(num($('labRmDrag'), 1), 0.15, 2.8);
  battleTune.body.mass = mass;
  battleTune.world.gravity = grav;
  battleTune.body.throwMin = rb.throwMin * power;
  battleTune.body.throwMax = rb.throwMax * power;
  battleTune.sling.impulseHMin = rb.impulseHMin * power;
  battleTune.sling.impulseHMax = rb.impulseHMax * power;
  battleTune.sling.impulseYMin = rb.impulseYMin * power * arc;
  battleTune.sling.impulseYMax = rb.impulseYMax * power * arc;
  battleTune.rollPlayer.impulseYMul = clamp(rb.rollPlayerYMul * arc, 0.08, 1.2);
  battleTune.rollBot.impulseYMul = clamp(rb.rollBotYMul * arc, 0.08, 1.2);
  battleTune.rollPlayer.mainImpulse = clamp(rb.rollMainPlayer * power, 0.15, 8);
  battleTune.rollBot.mainImpulse = clamp(rb.rollMainBot * power, 0.15, 8);
  battleTune.body.linearDamping = rb.linearDamping * dragMul;
  battleTune.body.angularDamping = rb.angularDamping * dragMul;
  applyLabTuneFromMemory();
  syncFormFromBattleTune();
  updateRealismPanelLabels();
  updateRealismEstimateText();
}

function initRealismPanel() {
  if (!$('labRmMass')) return;
  const ids = ['labRmMass', 'labRmGrav', 'labRmPower', 'labRmArc', 'labRmDrag'];
  for (const id of ids) {
    $(id)?.addEventListener('input', () => applyRealismFromSliders());
  }
  $('labRealismReset')?.addEventListener('click', () => {
    const d = BATTLE_TUNE_DEFAULTS;
    battleTune.world.gravity = d.world.gravity;
    battleTune.body.mass = d.body.mass;
    battleTune.body.throwMin = d.body.throwMin;
    battleTune.body.throwMax = d.body.throwMax;
    battleTune.body.linearDamping = d.body.linearDamping;
    battleTune.body.angularDamping = d.body.angularDamping;
    battleTune.sling.impulseHMin = d.sling.impulseHMin;
    battleTune.sling.impulseHMax = d.sling.impulseHMax;
    battleTune.sling.impulseYMin = d.sling.impulseYMin;
    battleTune.sling.impulseYMax = d.sling.impulseYMax;
    battleTune.rollPlayer.impulseYMul = d.rollPlayer.impulseYMul;
    battleTune.rollBot.impulseYMul = d.rollBot.impulseYMul;
    battleTune.rollPlayer.mainImpulse = d.rollPlayer.mainImpulse;
    battleTune.rollBot.mainImpulse = d.rollBot.mainImpulse;
    applyLabTuneFromMemory();
    syncFormFromBattleTune();
    syncRealismSlidersFromTune();
  });
}

function mountLabTunePanel() {
  const host = $('labTuneFields');
  if (!host || host.dataset.mounted) return;
  host.dataset.mounted = '1';
  let lastSec = '';
  const frag = document.createDocumentFragment();
  for (const f of PHYSICS_TUNE_FIELDS) {
    if (f.section !== lastSec) {
      lastSec = f.section;
      const h = document.createElement('h4');
      h.className = 'physics-tune-h4';
      h.textContent = f.section;
      frag.appendChild(h);
    }
    const id = physicsTuneInputId(f.path);
    const wrap = document.createElement('div');
    wrap.className = 'physics-tune-field';
    wrap.innerHTML = `
      <label for="${id}">${f.label}</label>
      <p class="physics-tune-en"></p>
      <p class="physics-tune-ru"></p>
      <input type="number" id="${id}" step="${f.step}" autocomplete="off">
    `;
    wrap.querySelector('.physics-tune-en').textContent = f.en;
    wrap.querySelector('.physics-tune-ru').textContent = f.ru;
    frag.appendChild(wrap);
  }
  host.appendChild(frag);
}

function readFormIntoBattleTune() {
  for (const f of PHYSICS_TUNE_FIELDS) {
    const inp = $(physicsTuneInputId(f.path));
    if (!inp) continue;
    const v = parseFloat(inp.value);
    if (Number.isFinite(v)) setTuneAtPath(battleTune, f.path, v);
  }
  battleTune.viz.segments = Math.min(4, Math.max(1, Math.floor(battleTune.viz.segments)));
}

function syncFormFromBattleTune() {
  for (const f of PHYSICS_TUNE_FIELDS) {
    const inp = $(physicsTuneInputId(f.path));
    if (!inp) continue;
    const v = getTuneAtPath(battleTune, f.path);
    if (typeof v === 'number' && Number.isFinite(v)) inp.value = String(v);
  }
}

mountLabTunePanel();
syncFormFromBattleTune();
initRealismPanel();
syncRealismSlidersFromTune();

$('labBtnRoll')?.addEventListener('click', () => {
  if (labPhase === 'rolling') return;
  syncLabDiceCount();
  if (dice.length === 0) return;
  throwFromBottomLab();
});

$('labBtnStash')?.addEventListener('click', () => {
  slingDrag = null;
  hideSlingViz();
  labPhase = 'waiting';
  syncActiveDice(0);
  syncLabDiceCount();
  const facesEl = $('labFaces');
  if (facesEl) facesEl.textContent = '—';
  updateLabHud();
});

$('labBtnClearHistory')?.addEventListener('click', () => {
  const log = $('labRollLog');
  if (log) log.innerHTML = '';
  labRollIndex = 0;
});

$('labTuneApply')?.addEventListener('click', () => {
  readFormIntoBattleTune();
  applyLabTuneFromMemory();
  syncRealismSlidersFromTune();
});

$('labTuneReset')?.addEventListener('click', () => {
  battleTune = deepCloneTune(BATTLE_TUNE_DEFAULTS);
  try {
    localStorage.removeItem(LS_BATTLE_TUNE);
  } catch (_) {}
  syncFormFromBattleTune();
  applyLabTuneFromMemory();
  syncRealismSlidersFromTune();
});

$('labTuneCopy')?.addEventListener('click', async () => {
  readFormIntoBattleTune();
  const text = JSON.stringify(battleTune, null, 2);
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = $('labTunePasteArea');
    if (ta) ta.value = text;
  }
});

$('labTunePaste')?.addEventListener('click', () => {
  const ta = $('labTunePasteArea');
  if (!ta) return;
  try {
    const raw = ta.value.trim();
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    deepMergeTune(battleTune, parsed);
    battleTune.viz.segments = Math.min(4, Math.max(1, Math.floor(battleTune.viz.segments)));
    syncFormFromBattleTune();
    syncRealismSlidersFromTune();
    const ro = $('labTuneReadout');
    if (ro) ro.textContent = 'Merged — Apply tune to use';
  } catch (_) {
    const ro = $('labTuneReadout');
    if (ro) ro.textContent = 'JSON error';
  }
});

scene.onPointerObservable.add((info) => {
  const ev = info.event;
  if (labPhase === 'waiting' || labPhase === 'aiming') {
    if (info.type === BABYLON.PointerEventTypes.POINTERDOWN && ev.button === 0) {
      if (labPhase !== 'waiting') return;
      const p = pickRollXZFromClient(ev.clientX, ev.clientY);
      if (!p) return;
      if (dice.length === 0) syncLabDiceCount();
      for (const d of dice) delete d._slingPose;
      slingDrag = {
        start: { x: p.x, z: p.z },
        pointerId: ev.pointerId,
        clientStartX: ev.clientX,
        clientStartY: ev.clientY,
      };
      labPhase = 'aiming';
      positionKinematicClusterSling(p.x, p.z, p.x, p.z);
      updateLabHud();
      updateSlingViz(ev.clientX, ev.clientY);
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch (_) {}
      return;
    }
    if (slingDrag && info.type === BABYLON.PointerEventTypes.POINTERMOVE) {
      if (ev.pointerType !== 'touch' && !(ev.buttons & 1)) return;
      const p = pickRollXZFromClient(ev.clientX, ev.clientY);
      if (p) positionKinematicClusterSling(slingDrag.start.x, slingDrag.start.z, p.x, p.z);
      updateSlingViz(ev.clientX, ev.clientY);
      return;
    }
    if (slingDrag && info.type === BABYLON.PointerEventTypes.POINTERUP && ev.button === 0) {
      finishPlayerSling(ev);
      updateLabHud();
      return;
    }
  }
});

canvas.addEventListener('pointercancel', (ev) => {
  if (!slingDrag || ev.pointerId !== slingDrag.pointerId) return;
  slingDrag = null;
  hideSlingViz();
  try {
    canvas.releasePointerCapture(ev.pointerId);
  } catch (_) {}
  if (labPhase === 'aiming') {
    labPhase = 'waiting';
    syncActiveDice(0);
    syncLabDiceCount();
    updateLabHud();
  }
});

engine.runRenderLoop(() => {
  world.fixedStep();
  for (const d of dice) {
    d.root.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
    d.root.rotationQuaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
    if (!d.settled) {
      const spd = d.body.velocity.length() + d.body.angularVelocity.length();
      const st = battleTune.settle;
      if (spd > st.speedLo && spd < st.speedHi) {
        const { x: qx, y: qy, z: qz, w: qw } = d.body.quaternion;
        const align = Math.max(
          Math.abs(2 * (qx * qy + qw * qz)),
          Math.abs(1 - 2 * (qx * qx + qz * qz)),
          Math.abs(2 * (qy * qz - qw * qx)),
        );
        if (align < st.alignThreshold) {
          const k = st.angKick;
          d.body.angularVelocity.x += (Math.random() - 0.5) * k;
          d.body.angularVelocity.z += (Math.random() - 0.5) * k;
        }
      }
    }
  }
  if (labPhase === 'rolling') {
    for (const d of dice) {
      if (d.settled) continue;
      const spd2 = d.body.velocity.lengthSquared() + d.body.angularVelocity.lengthSquared();
      if (spd2 >= 0.0004) continue;
      const v = readFaceValue(d.body);
      if (v !== null) {
        d.body.allowSleep = false;
        d.value = v;
        d.settled = true;
        checkLabAllSettled();
      }
    }
  }
  scene.render();
});

window.addEventListener('resize', () => {
  engine.resize();
  if (camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) updateBattleOrthoFrustum();
});

syncLabDiceCount();
updateLabHud();
const ro = $('labTuneReadout');
if (ro) ro.textContent = 'Готово. ROLL / слинг. Apply tune без перезагрузки.';
