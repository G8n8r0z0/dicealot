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
export function createDiceVertexData(edgeR = EDGE_R, notchR = NOTCH_R, notchD = NOTCH_D, pipOffset = PIP_OFFSET, skipNotchFaces = null) {
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
    const sk = skipNotchFaces;
    if      (y ===  .5) { if (!sk || sk.indexOf(1) === -1) y -= n(x,z); }
    else if (x ===  .5) { if (!sk || sk.indexOf(2) === -1) { x -= n(y+o,z+o); x -= n(y-o,z-o); } }
    else if (z ===  .5) { if (!sk || sk.indexOf(3) === -1) { z -= n(x-o,y+o); z -= n(x,y); z -= n(x+o,y-o); } }
    else if (z === -.5) { if (!sk || sk.indexOf(4) === -1) { z += n(x+o,y+o); z += n(x+o,y-o); z += n(x-o,y+o); z += n(x-o,y-o); } }
    else if (x === -.5) { if (!sk || sk.indexOf(5) === -1) { x += n(y+o,z+o); x += n(y+o,z-o); x += n(y,z); x += n(y-o,z+o); x += n(y-o,z-o); } }
    else if (y === -.5) { if (!sk || sk.indexOf(6) === -1) { y += n(x+o,z+o); y += n(x+o,z); y += n(x+o,z-o); y += n(x-o,z+o); y += n(x-o,z); y += n(x-o,z-o); } }
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
    if (typeof pipShape === 'string') {
      if (pipShape === 'hidden') return null;
      return PIP_SHAPES[pipShape] || PIP_SHAPES.circle;
    }
    const key = pipShape[faceVal] || pipShape.default || 'circle';
    if (key === 'hidden') return null;
    return PIP_SHAPES[key] || PIP_SHAPES.circle;
  }
  for (const { val, fA, fV, uA, vA, pips } of pf) {
    const sign = Math.sign(fV);
    const outline = outlineForFace(val);
    if (!outline) continue;
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

// 7-segment digit segments: [a,b,c,d,e,f,g] top,TR,BR,bot,BL,TL,mid
const SEG7_MAP = {
  0: [1,1,1,1,1,1,0], 1: [0,1,1,0,0,0,0], 2: [1,1,0,1,1,0,1],
  3: [1,1,1,1,0,0,1], 4: [0,1,1,0,0,1,1], 5: [1,0,1,1,0,1,1],
  6: [1,0,1,1,1,1,1], 7: [1,1,1,0,0,0,0], 8: [1,1,1,1,1,1,1],
  9: [1,1,1,1,0,1,1],
};

function drawSeg7Single(ctx2d, cx, cy, h, color) {
  const w = h * 0.55, sw = h * 0.12, hw = w / 2, hh = h / 2;
  const gap = sw * 0.3;
  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = sw;
  ctx2d.lineCap = 'round';
  const segs = [
    [cx - hw + gap, cy - hh,        cx + hw - gap, cy - hh],
    [cx + hw,       cy - hh + gap,   cx + hw,       cy - gap],
    [cx + hw,       cy + gap,        cx + hw,       cy + hh - gap],
    [cx - hw + gap, cy + hh,        cx + hw - gap, cy + hh],
    [cx - hw,       cy + gap,        cx - hw,       cy + hh - gap],
    [cx - hw,       cy - hh + gap,   cx - hw,       cy - gap],
    [cx - hw + gap, cy,              cx + hw - gap, cy],
  ];
  return segs;
}

function drawSeg7Digit(ctx2d, cx, cy, h, digit, color) {
  const map = SEG7_MAP[digit];
  if (!map) return;
  const segs = drawSeg7Single(ctx2d, cx, cy, h, color);
  for (let i = 0; i < 7; i++) {
    if (!map[i]) continue;
    const s = segs[i];
    ctx2d.beginPath();
    ctx2d.moveTo(s[0], s[1]);
    ctx2d.lineTo(s[2], s[3]);
    ctx2d.stroke();
  }
}

function drawSeg7Face(ctx2d, size, digit, color, bgColor) {
  ctx2d.save();
  ctx2d.clearRect(0, 0, size, size);
  if (bgColor) { ctx2d.fillStyle = bgColor; ctx2d.fillRect(0, 0, size, size); }
  const h = size * 0.6;
  drawSeg7Digit(ctx2d, size / 2, size / 2, h, parseInt(digit), color);
  ctx2d.restore();
}

function drawSeg7_314(ctx2d, size, color, bgColor) {
  ctx2d.save();
  ctx2d.clearRect(0, 0, size, size);
  if (bgColor) { ctx2d.fillStyle = bgColor; ctx2d.fillRect(0, 0, size, size); }
  const h = size * 0.28;
  const off = size * 0.27;
  const cx = size / 2, cy = size / 2;
  drawSeg7Digit(ctx2d, cx + off, cy - off, h, 3, color);
  drawSeg7Digit(ctx2d, cx,       cy,       h, 1, color);
  drawSeg7Digit(ctx2d, cx - off, cy + off, h, 4, color);
  ctx2d.restore();
}

const DOLPHIN_SVG_D = 'M 574.500 110.651 C 568.481 111.626, 561.071 114.151, 557.825 116.334 C 552.017 120.238, 552.734 121.995, 563.398 129.975 C 574.601 138.359, 579.872 144.056, 583.918 152.151 C 591.505 167.334, 590.394 184.361, 580.847 199.239 C 579.020 202.086, 569.464 212.760, 559.613 222.958 C 530.936 252.643, 515.030 272.073, 497.766 298.504 C 453.530 366.232, 428.572 436.028, 423.031 507.500 C 421.210 530.997, 421.366 530.322, 416.690 534.997 C 414.386 537.301, 407.550 542.460, 401.500 546.462 C 371.541 566.277, 351.688 585.830, 335.972 611 C 327.277 624.927, 319.703 643.887, 318.808 653.970 C 318.304 659.644, 320.931 658.851, 330.961 650.304 C 346.602 636.977, 349.261 635.045, 357.500 631.019 C 366.181 626.777, 374.858 624.374, 393.565 621.030 C 407.796 618.486, 415.769 614.696, 420.500 608.225 C 423.711 603.833, 425 603.067, 425 605.550 C 425 608.530, 428.061 612.980, 431.243 614.626 C 433.408 615.745, 438.364 616.505, 446.476 616.962 C 455.756 617.484, 459.690 618.161, 463.714 619.927 C 469.493 622.463, 476.134 628.960, 480.415 636.265 C 481.941 638.869, 483.580 641, 484.056 641 C 485.306 641, 487.900 631.764, 489.212 622.642 C 490.053 616.793, 490.052 612.312, 489.208 605.117 C 487.125 587.366, 481.998 574.843, 469.724 557.525 C 465.816 552.011, 461.979 545.598, 461.198 543.274 L 459.778 539.047 L 465.946 526.274 C 484.314 488.233, 506.818 455.545, 533.500 428.152 C 588.334 371.857, 662.503 332.033, 769.344 301.521 C 780.258 298.404, 789.397 296.064, 789.654 296.321 C 790.553 297.220, 784.330 311.663, 780.666 317.185 C 777.025 322.669, 772.788 326.945, 761.861 336.164 C 758.821 338.729, 755.591 342.329, 754.684 344.164 C 753.090 347.389, 753.109 347.562, 755.268 349.370 C 757.234 351.018, 758.571 351.161, 766.500 350.571 C 804.275 347.763, 832.074 331.874, 860.800 296.675 C 866.556 289.621, 872.444 283.386, 873.883 282.819 C 878.373 281.052, 907.261 281.588, 931.500 283.888 C 978.049 288.306, 982.379 289.047, 1014 298.010 C 1043.042 306.241, 1048.622 306.576, 1054.750 300.449 C 1058.784 296.416, 1058.918 293.235, 1055.355 286.085 C 1053.125 281.610, 1050.491 279.014, 1038.571 269.539 C 1021.679 256.114, 1019.006 253.199, 1018.983 248.173 C 1018.928 236.512, 1011.524 218.258, 1001.242 204.430 C 982.884 179.743, 953.748 161.367, 910.157 146.983 C 878.239 136.451, 856.586 132.247, 822.500 129.963 C 793.306 128.008, 761.466 130.210, 732.500 136.188 C 693.969 144.139, 691.945 143.968, 659.012 129.964 C 625.708 115.803, 609.105 111.165, 589.500 110.545 C 582.900 110.336, 576.150 110.383, 574.500 110.651 Z';
const DOLPHIN_BB = { x: 318.3, y: 110.3, w: 740.6, h: 549.3 };

function drawDolphin(ctx2d, size, color, bgColor) {
  ctx2d.save();
  ctx2d.clearRect(0, 0, size, size);
  if (bgColor) {
    ctx2d.fillStyle = bgColor;
    ctx2d.fillRect(0, 0, size, size);
  }

  const margin = size * 0.03;
  const avail = size - margin * 2;
  const bb = DOLPHIN_BB;
  const scale = Math.min(avail / bb.w, avail / bb.h);
  const dx = (size - bb.w * scale) / 2 - bb.x * scale;
  const dy = (size - bb.h * scale) / 2 - bb.y * scale;

  ctx2d.translate(dx, dy);
  ctx2d.scale(scale, scale);

  ctx2d.fillStyle = color;
  const p = new Path2D(DOLPHIN_SVG_D);
  ctx2d.fill(p, 'evenodd');

  ctx2d.restore();
}

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

function drawLetter(ctx2d, size, letter, color, bgColor) {
  ctx2d.save();
  ctx2d.clearRect(0, 0, size, size);
  if (bgColor) {
    ctx2d.fillStyle = bgColor;
    ctx2d.fillRect(0, 0, size, size);
  }
  ctx2d.fillStyle = color;
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.font = `bold ${Math.round(size * 0.72)}px sans-serif`;
  ctx2d.fillText(letter, size / 2, size / 2 + size * 0.04);
  ctx2d.restore();
}

function drawFrogEye(ctx2d, size, color, openAmount) {
  if (openAmount === undefined) openAmount = 1.0;
  const cx = size / 2, cy = size / 2;
  ctx2d.save();
  ctx2d.clearRect(0, 0, size, size);
  if (openAmount > 0.01) {
    ctx2d.fillStyle = color;
    ctx2d.beginPath();
    ctx2d.ellipse(cx, cy, size * 0.08, size * 0.34 * openAmount, 0, 0, Math.PI * 2);
    ctx2d.fill();
  }
  ctx2d.restore();
}

export function createMarkTexture(mark, name, scene) {
  const sz = 128;
  if (mark.shape === 'heart' || mark.shape === 'star') {
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
  if (mark.shape === 'letter') {
    const dt = new BABYLON.DynamicTexture(name, sz, scene, true);
    dt.hasAlpha = true;
    const ctx2d = dt.getContext();
    drawLetter(ctx2d, sz, mark.text || '?', mark.color || '#ffffff', mark.bg || null);
    dt.update(false);
    return dt;
  }
  if (mark.shape === 'seg7') {
    const dt = new BABYLON.DynamicTexture(name, sz, scene, true);
    dt.hasAlpha = true;
    const ctx2d = dt.getContext();
    drawSeg7Face(ctx2d, sz, mark.text || '0', mark.color || '#66ff66', mark.bg || null);
    dt.update(false);
    return dt;
  }
  if (mark.shape === 'seg7_314') {
    const dt = new BABYLON.DynamicTexture(name, sz, scene, true);
    dt.hasAlpha = true;
    const ctx2d = dt.getContext();
    drawSeg7_314(ctx2d, sz, mark.color || '#66ff66', mark.bg || null);
    dt.update(false);
    return dt;
  }
  if (mark.shape === 'dolphin') {
    const dt = new BABYLON.DynamicTexture(name, sz, scene, true);
    dt.hasAlpha = true;
    const ctx2d = dt.getContext();
    drawDolphin(ctx2d, sz, mark.color || '#f0ece2', mark.bg || null);
    dt.update(false);
    return dt;
  }
  if (mark.shape === 'frogEye') {
    const dt = new BABYLON.DynamicTexture(name, sz, scene, true);
    dt.hasAlpha = true;
    const ctx2d = dt.getContext();
    drawFrogEye(ctx2d, sz, mark.color || '#070808');
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

  const useNotchD = opts.notchD != null ? opts.notchD : NOTCH_D;
  const skipNF = opts.skipNotchFaces || null;
  const hasCustomGeom = opts.edgeR != null || opts.pipR != null || opts.pipShape != null || useNotchD !== NOTCH_D || skipNF;
  const outerVD = hasCustomGeom
    ? createDiceVertexData(opts.edgeR ?? EDGE_R, NOTCH_R, useNotchD, PIP_OFFSET, skipNF)
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
  let _frogEyeDT = null, _frogEyeCtx = null, _frogEyeColor = null;
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
      markMeshes.push(plane);
      if (mark.shape === 'frogEye' && tex instanceof BABYLON.DynamicTexture) {
        _frogEyeDT = tex;
        _frogEyeCtx = tex.getContext();
        _frogEyeColor = mark.color || '#070808';
      }
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
    let ox = 0, oy = 0, oz = 0;
    if (opts.bias.faces) {
      for (const fv of opts.bias.faces) {
        const fl = FACE_LOCALS.find(f => f.val === fv);
        if (fl) { ox += fl.x; oy += fl.y; oz += fl.z; }
      }
      const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (len > 0) { ox /= len; oy /= len; oz /= len; }
    } else {
      const fl = FACE_LOCALS.find(f => f.val === opts.bias.face);
      if (fl) { ox = fl.x; oy = fl.y; oz = fl.z; }
    }
    const mag = opts.bias.magnitude * hs;
    if (mag > 0 && (ox || oy || oz)) {
      body.addShape(boxShape, new CANNON.Vec3(ox * mag, oy * mag, oz * mag));
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
    value: null, settled: false,
    _blinkTimer: null, _blinkAnim: null };

  if (_frogEyeDT) {
    const SZ = 128;
    const BLINK_FRAMES = [1.0, 0.5, 0.0, 0.5, 1.0];
    const FRAME_MS = 40;

    function drawBlinkFrame(openAmount) {
      drawFrogEye(_frogEyeCtx, SZ, _frogEyeColor, openAmount);
      _frogEyeDT.update(false);
    }

    die.startBlinkLoop = function () {
      if (die._blinkTimer) return;
      function scheduleBlink() {
        const delay = 1000 + Math.random() * 1000;
        die._blinkTimer = setTimeout(function () {
          let fi = 0;
          die._blinkAnim = setInterval(function () {
            drawBlinkFrame(BLINK_FRAMES[fi]);
            fi++;
            if (fi >= BLINK_FRAMES.length) {
              clearInterval(die._blinkAnim);
              die._blinkAnim = null;
              scheduleBlink();
            }
          }, FRAME_MS);
        }, delay);
      }
      scheduleBlink();
    };

    die.stopBlinkLoop = function () {
      if (die._blinkTimer) { clearTimeout(die._blinkTimer); die._blinkTimer = null; }
      if (die._blinkAnim) { clearInterval(die._blinkAnim); die._blinkAnim = null; }
      drawBlinkFrame(1.0);
    };
  }

  if (opts.onSleep) {
    body.addEventListener('sleep', () => opts.onSleep(die));
  }

  return die;
}

/** Remove die meshes from scene and body from physics world. */
export function teardownDie(die, ctx) {
  if (die.stopBlinkLoop) die.stopBlinkLoop();
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
