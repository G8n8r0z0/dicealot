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
  if (bestDot < 0.96) return null;
  if (bestDot - secondDot < 0.20) return null;
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

/** Rounded box with pip notches. Returns BABYLON.VertexData.
 *  All params optional — defaults match production constants. */
export function createDiceVertexData(edgeR = EDGE_R, notchR = NOTCH_R, notchD = NOTCH_D, pipOffset = PIP_OFFSET) {
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
  const half = 0.5 - edgeR;
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i], y = positions[i+1], z = positions[i+2];
    const sx = Math.sign(x) * half, sy = Math.sign(y) * half, sz = Math.sign(z) * half;
    const ax = x - sx, ay = y - sy, az = z - sz;
    const ox = Math.abs(x) > half, oy = Math.abs(y) > half, oz = Math.abs(z) > half;
    if (ox && oy && oz) { const l = Math.hypot(ax,ay,az)||1; x = sx+ax/l*edgeR; y = sy+ay/l*edgeR; z = sz+az/l*edgeR; }
    else if (ox && oy)  { const l = Math.hypot(ax,ay)||1;    x = sx+ax/l*edgeR; y = sy+ay/l*edgeR; }
    else if (ox && oz)  { const l = Math.hypot(ax,az)||1;    x = sx+ax/l*edgeR; z = sz+az/l*edgeR; }
    else if (oy && oz)  { const l = Math.hypot(ay,az)||1;    y = sy+ay/l*edgeR; z = sz+az/l*edgeR; }
    const nw = v => { v = v / notchR; v = Math.PI * Math.max(-1, Math.min(1, v)); return notchD * (Math.cos(v) + 1); };
    const n = (a, b) => nw(a) * nw(b), o = pipOffset;
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

// ── Pip shape outlines ──────────────────────────────────────────────────────
// Each function: (angle, outerR) => radius at that angle.

// Precompute heart polar lookup from parametric curve
const _heartLUT = (function() {
  const N = 360;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = 2 * Math.PI * i / N;
    const x = Math.pow(Math.sin(t), 3);
    const y = (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t)) / 16;
    pts.push({ x, y });
  }
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= N; cy /= N;
  const polar = new Array(N);
  let maxR = 0;
  for (let i = 0; i < N; i++) {
    const dx = pts[i].x - cx, dy = pts[i].y - cy;
    const r = Math.sqrt(dx*dx + dy*dy);
    polar[i] = { a: Math.atan2(dy, dx), r };
    if (r > maxR) maxR = r;
  }
  polar.sort((a, b) => a.a - b.a);
  for (let i = 0; i < N; i++) polar[i].r /= maxR;
  return polar;
})();

function _heartRadius(angle) {
  let a = ((angle % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
  if (a > Math.PI) a -= 2*Math.PI;
  let lo = 0, hi = _heartLUT.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (_heartLUT[mid].a < a) lo = mid + 1; else hi = mid;
  }
  const i0 = lo === 0 ? 0 : lo - 1;
  const i1 = lo;
  const p0 = _heartLUT[i0], p1 = _heartLUT[i1];
  const span = p1.a - p0.a || 1e-9;
  const t = Math.max(0, Math.min(1, (a - p0.a) / span));
  return p0.r + (p1.r - p0.r) * t;
}

export const PIP_SHAPES = {
  circle: (_a, r) => r,
  star5: (a, r) => {
    const inner = r * 0.42;
    const norm = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const idx = Math.floor(norm / (Math.PI / 5));
    return idx % 2 === 0 ? r : inner;
  },
  heart: (a, r) => _heartRadius(a) * r,
};

/** 21 flat pips across 6 faces. Returns BABYLON.VertexData.
 *  pipShape: 'circle' | 'star5' | 'heart' (all faces) OR { default:'circle', 1:'heart' } (per-face)
 *  facesFilter: optional array of face values to include (e.g. [1] or [2,3,4,5,6]) */
export function createPipsVertexData(pipR = 0.1, pipOffset = PIP_OFFSET, pipShape = 'circle', facesFilter = null) {
  const positions = [], indices = [], normals = [], o = pipOffset;
  const defaultPR = typeof pipR === 'number' ? pipR : (pipR.default || 0.1);
  function prForFace(faceVal) {
    if (typeof pipR === 'number') return pipR;
    return pipR[faceVal] != null ? pipR[faceVal] : defaultPR;
  }
  let pf = [
    { val:1, fA:1, fV:+.5, uA:0, vA:2, pips:[[0,0]] },
    { val:6, fA:1, fV:-.5, uA:0, vA:2, pips:[[-o,-o],[-o,0],[-o,+o],[+o,-o],[+o,0],[+o,+o]] },
    { val:2, fA:0, fV:+.5, uA:2, vA:1, pips:[[-o,-o],[+o,+o]] },
    { val:5, fA:0, fV:-.5, uA:2, vA:1, pips:[[-o,-o],[-o,+o],[0,0],[+o,-o],[+o,+o]] },
    { val:3, fA:2, fV:+.5, uA:1, vA:0, pips:[[+o,-o],[0,0],[-o,+o]] },
    { val:4, fA:2, fV:-.5, uA:1, vA:0, pips:[[-o,-o],[-o,+o],[+o,-o],[+o,+o]] },
  ];
  if (facesFilter) pf = pf.filter(f => facesFilter.indexOf(f.val) !== -1);
  function outlineForFace(faceVal) {
    if (typeof pipShape === 'string') return PIP_SHAPES[pipShape] || PIP_SHAPES.circle;
    const key = pipShape[faceVal] || pipShape.default || 'circle';
    return PIP_SHAPES[key] || PIP_SHAPES.circle;
  }
  for (const { val, fA, fV, uA, vA, pips } of pf) {
    const sign = Math.sign(fV);
    const outline = outlineForFace(val);
    const PR = prForFace(val);
    const isCircle = outline === PIP_SHAPES.circle;
    const isHeart  = outline === PIP_SHAPES.heart;
    const SEG = isCircle ? 16 : isHeart ? 24 : 10;
    for (const [cu, cv] of pips) {
      const base = positions.length / 3, nn = [0,0,0]; nn[fA] = sign;
      const cc = [0,0,0]; cc[fA] = fV; cc[uA] = cu; cc[vA] = cv;
      positions.push(cc[0], cc[1], cc[2]); normals.push(nn[0], nn[1], nn[2]);
      for (let i = 0; i < SEG; i++) {
        const a = 2 * Math.PI * i / SEG;
        const rad = outline(a, PR);
        const v = [0,0,0];
        v[fA] = fV; v[uA] = cu + Math.cos(a) * rad; v[vA] = cv + Math.sin(a) * rad;
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

// ── Procedural mark textures ─────────────────────────────────────────────────

function drawHeart(ctx2d, size, color, bgColor) {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.42;
  ctx2d.save();
  ctx2d.clearRect(0, 0, size, size);
  // Solid background disc to mask the pip underneath
  if (bgColor) {
    ctx2d.fillStyle = bgColor;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, size * 0.47, 0, Math.PI * 2);
    ctx2d.fill();
  }
  ctx2d.fillStyle = color;
  ctx2d.beginPath();
  ctx2d.moveTo(cx, cy + r * 0.6);
  ctx2d.bezierCurveTo(cx - r * 1.3, cy - r * 0.2, cx - r * 0.7, cy - r * 1.1, cx, cy - r * 0.4);
  ctx2d.bezierCurveTo(cx + r * 0.7, cy - r * 1.1, cx + r * 1.3, cy - r * 0.2, cx, cy + r * 0.6);
  ctx2d.fill();
  ctx2d.restore();
}

function drawStar(ctx2d, size, color, bgColor) {
  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.44, innerR = size * 0.18;
  const points = 5;
  ctx2d.save();
  ctx2d.clearRect(0, 0, size, size);
  if (bgColor) {
    ctx2d.fillStyle = bgColor;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, size * 0.47, 0, Math.PI * 2);
    ctx2d.fill();
  }
  ctx2d.fillStyle = color;
  ctx2d.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = Math.PI / 2 * -1 + (Math.PI / points) * i;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
  }
  ctx2d.closePath();
  ctx2d.fill();
  ctx2d.restore();
}

export function createMarkTexture(mark, name, scene) {
  if (mark.shape === 'heart' || mark.shape === 'star') {
    const sz = 128;
    const dt = new BABYLON.DynamicTexture(name, sz, scene, true);
    dt.hasAlpha = true;
    const ctx2d = dt.getContext();
    if (mark.shape === 'heart') {
      drawHeart(ctx2d, sz, mark.color || '#cc2244', mark.bg || null);
    } else {
      drawStar(ctx2d, sz, mark.color || '#ffd700', mark.bg || null);
    }
    dt.update(false);
    return dt;
  }
  if (mark.texture) {
    const tex = new BABYLON.Texture(mark.texture, scene);
    tex.hasAlpha = true;
    return tex;
  }
  return null;
}

// ── Die lifecycle ───────────────────────────────────────────────────────────

let _idCounter = 0;

/**
 * Build a single die: TransformNode + outer/pips/backing meshes + CANNON.Body.
 * Starts kinematic + hidden under the table (stash).
 *
 * @param {object} ctx — engine context (scene, world, shadowGen, materials, tune, etc.)
 * @param {object} [opts]
 * @param {function} [opts.onSleep]   — called when physics body sleeps
 * @param {string}   [opts.bodyColor] — hex, overrides ctx.bodyColor
 * @param {string}   [opts.pipColor]  — hex, creates per-die pip material
 * @param {object}   [opts.pipColors] — { default:'#fff', 1:'#dc143c' } per-face pip color
 * @param {number}   [opts.specular]  — specular intensity (default 0.15)
 * @param {number}   [opts.edgeR]     — roundness override (generates custom geometry)
 * @param {number}   [opts.pipR]      — pip radius override (generates custom geometry)
 * @param {string}   [opts.pipShape]  — pip shape key ('circle', 'star5', etc.)
 * @param {Array}    [opts.faceMarks] — [{ face, texture }] overlays on specific faces
 * @param {object}   [opts.bias]      — { face, magnitude } center-of-mass offset
 * @returns {object} die
 */
export function buildDie(ctx, opts = {}) {
  const id = _idCounter++;
  const sc = ctx.tune.mesh.dieScale;

  const spec = opts.specular != null ? opts.specular : 0.15;
  const oMat = new BABYLON.StandardMaterial(`o${id}`, ctx.scene);
  oMat.diffuseColor  = BABYLON.Color3.FromHexString(opts.bodyColor || ctx.bodyColor || '#f4f2ef');
  oMat.specularColor = new BABYLON.Color3(spec, spec, spec);

  const root = new BABYLON.TransformNode(`die${id}`, ctx.scene);
  root.rotationQuaternion = BABYLON.Quaternion.Identity();
  root.scaling.setAll(sc);

  const hasCustomGeom = opts.edgeR != null || opts.pipR != null || opts.pipShape != null;
  const outerVD = hasCustomGeom
    ? createDiceVertexData(opts.edgeR ?? EDGE_R, NOTCH_R, NOTCH_D, PIP_OFFSET)
    : ctx.cachedOuterVD;

  const outer = new BABYLON.Mesh(`outer${id}`, ctx.scene);
  outerVD.applyToMesh(outer);
  outer.material = oMat;
  outer.parent = root;
  outer.receiveShadows = true;
  ctx.shadowGen.addShadowCaster(outer);

  function _makePipMat(name, hex) {
    const m = new BABYLON.StandardMaterial(name, ctx.scene);
    m.disableLighting = true;
    m.emissiveColor = BABYLON.Color3.FromHexString(hex);
    m.diffuseColor  = BABYLON.Color3.Black();
    m.specularColor = BABYLON.Color3.Black();
    m.zOffset = -2;
    return m;
  }

  const extraPipMeshes = [];
  const extraPipMats   = [];
  let pips, usePipMat;

  if (opts.pipColors && typeof opts.pipColors === 'object') {
    const allFaces = [1,2,3,4,5,6];
    const defaultHex = opts.pipColors.default || opts.pipColor || '#141414';
    const groups = {};
    for (const fv of allFaces) {
      const hex = opts.pipColors[fv] || defaultHex;
      (groups[hex] = groups[hex] || []).push(fv);
    }
    const colorKeys = Object.keys(groups);
    let mainMesh = null;
    for (let ci = 0; ci < colorKeys.length; ci++) {
      const hex = colorKeys[ci];
      const faces = groups[hex];
      const vd = createPipsVertexData(opts.pipR ?? 0.1, PIP_OFFSET, opts.pipShape || 'circle', faces);
      const mesh = new BABYLON.Mesh(`pips${id}_${ci}`, ctx.scene);
      vd.applyToMesh(mesh);
      const mat = _makePipMat(`pip${id}_${ci}`, hex);
      mesh.material = mat;
      mesh.parent = root;
      if (!mainMesh) {
        mainMesh = mesh;
        usePipMat = mat;
      } else {
        extraPipMeshes.push(mesh);
        extraPipMats.push(mat);
      }
    }
    pips = mainMesh;
  } else {
    const pipsVD = hasCustomGeom
      ? createPipsVertexData(opts.pipR ?? 0.1, PIP_OFFSET, opts.pipShape || 'circle')
      : ctx.cachedPipsVD;

    usePipMat = ctx.pipMat;
    if (opts.pipColor) {
      usePipMat = _makePipMat(`pip${id}`, opts.pipColor);
    }

    pips = new BABYLON.Mesh(`pips${id}`, ctx.scene);
    pipsVD.applyToMesh(pips);
    pips.material = usePipMat;
    pips.parent = root;
  }

  const useEdgeR = opts.edgeR != null ? opts.edgeR : EDGE_R;
  const cornerR  = (0.5 - useEdgeR) + useEdgeR / Math.sqrt(3);
  const backSize = Math.max(0.3, 2 * cornerR - 0.03);
  const backing = BABYLON.MeshBuilder.CreateBox(`back${id}`, { size: backSize }, ctx.scene);
  backing.material = ctx.backingMat;
  backing.parent = root;

  // Face mark overlays (heart, frog-eye, star, etc.)
  const markMeshes = [];
  if (opts.faceMarks) {
    for (const mark of opts.faceMarks) {
      const fl = FACE_LOCALS.find(f => f.val === mark.face);
      if (!fl) continue;
      const plane = BABYLON.MeshBuilder.CreatePlane(`mark${id}_f${mark.face}`,
        { size: 0.65, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, ctx.scene);
      const mMat = new BABYLON.StandardMaterial(`markMat${id}_f${mark.face}`, ctx.scene);
      const tex = createMarkTexture(mark, `markTex${id}_f${mark.face}`, ctx.scene);
      mMat.diffuseTexture = tex;
      mMat.diffuseTexture.hasAlpha = true;
      mMat.useAlphaFromDiffuseTexture = true;
      mMat.specularColor = oMat.specularColor.clone();
      mMat.zOffset = -4;
      plane.material = mMat;
      plane.parent = root;
      const offset = 0.505;
      plane.position.set(fl.x * offset, fl.y * offset, fl.z * offset);
      if (fl.y !== 0) {
        plane.rotation.x = fl.y > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else if (fl.x !== 0) {
        plane.rotation.y = fl.x > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        plane.rotation.y = fl.z > 0 ? 0 : Math.PI;
      }
      plane.isPickable = false;
      markMeshes.push(plane);
    }
  }

  // Physics body — shape offset for bias dice
  const hs = ctx.tune.mesh.boxHalfPerScale * sc;
  const boxShape = new CANNON.Box(new CANNON.Vec3(hs, hs, hs));
  const body = new CANNON.Body({
    mass:           ctx.tune.body.mass,
    material:       ctx.diceMat,
    sleepTimeLimit: ctx.tune.body.sleepTime,
    sleepSpeedLimit:ctx.tune.body.sleepSpeed,
    linearDamping:  ctx.tune.body.linearDamping,
    angularDamping: ctx.tune.body.angularDamping,
  });

  if (opts.bias) {
    const fl = FACE_LOCALS.find(f => f.val === opts.bias.face);
    if (fl) {
      const mag = opts.bias.magnitude * hs;
      body.addShape(boxShape, new CANNON.Vec3(fl.x * mag, fl.y * mag, fl.z * mag));
    } else {
      body.addShape(boxShape);
    }
  } else {
    body.addShape(boxShape);
  }

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
  for (const ep of extraPipMeshes) ep.setEnabled(false);
  backing.setEnabled(false);
  for (const m of markMeshes) m.setEnabled(false);

  const _ownsPipMat = !!(opts.pipColor || (opts.pipColors && typeof opts.pipColors === 'object'));
  const die = { id, root, outer, pips, backing, body, oMat, markMeshes,
    _pipMat: _ownsPipMat ? usePipMat : null, _extraPipMeshes: extraPipMeshes, _extraPipMats: extraPipMats,
    value: null, settled: false };

  if (opts.onSleep) {
    body.addEventListener('sleep', () => opts.onSleep(die));
  }

  return die;
}

/** Remove die meshes from scene and body from physics world. */
export function teardownDie(die, ctx) {
  ctx.hl.removeMesh(die.outer);
  ctx.shadowGen.removeShadowCaster(die.outer);
  if (die.markMeshes) {
    for (const m of die.markMeshes) { if (m.material) m.material.dispose(); m.dispose(); }
  }
  if (die._pipMat) die._pipMat.dispose();
  if (die._extraPipMeshes) {
    for (const m of die._extraPipMeshes) m.dispose();
  }
  if (die._extraPipMats) {
    for (const m of die._extraPipMats) m.dispose();
  }
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
