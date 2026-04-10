/**
 * Headless cannon-es calibration for Mathematician Die.
 *
 * Bias toward face 3 (Z+) strongest, face 1 (Y+) secondary.
 * Combined direction vector (0, Yw, Zw) normalized, Zw > Yw.
 *
 * Target: 3 ≈ 24%, 1 ≈ 20%, rest ≈ 14% each.
 *
 * Usage: node tools/calibrate-mathematician.mjs
 */

import * as CANNON from '../src/vendor/cannon-es.js';

const GRAVITY        = -300;
const DIE_MASS       = 3.0;
const DIE_SCALE      = 3.06;
const BOX_HALF       = 0.48;
const HALF_EXTENT    = BOX_HALF * DIE_SCALE;
const DIE_EDGE       = 2 * HALF_EXTENT;
const THROW_MIN      = 100;
const THROW_MAX      = 166;
const MAIN_IMPULSE   = 5.61;
const IMPULSE_Y_MUL  = 0.17;
const CROSS_MUL      = 0.32;
const LEVER_R        = DIE_EDGE * 0.10;
const SOLVER_ITER    = 20;
const RESTITUTION    = 0.35;
const FRICTION       = 0.5;
const SLEEP_TIME     = 0.3;
const SLEEP_SPEED    = 0.05;
const FLOOR_Y        = -4;

const FACE_LOCALS = [
  { x:  0, y:  1, z:  0, val: 1 },
  { x:  0, y: -1, z:  0, val: 6 },
  { x:  1, y:  0, z:  0, val: 2 },
  { x: -1, y:  0, z:  0, val: 5 },
  { x:  0, y:  0, z:  1, val: 3 },
  { x:  0, y:  0, z: -1, val: 4 },
];

function readFaceForced(q) {
  const up = new CANNON.Vec3(0, 1, 0);
  const tmp = new CANNON.Vec3();
  const lv  = new CANNON.Vec3();
  let bestDot = -2, bestVal = 1;
  for (const f of FACE_LOCALS) {
    lv.set(f.x, f.y, f.z);
    q.vmult(lv, tmp);
    const dot = tmp.dot(up);
    if (dot > bestDot) { bestDot = dot; bestVal = f.val; }
  }
  return bestVal;
}

function simulateThrow(biasOffsetVec) {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, GRAVITY, 0),
    allowSleep: true,
  });
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = SOLVER_ITER;

  const floorMat = new CANNON.Material({ friction: FRICTION, restitution: RESTITUTION });
  const dieMat   = new CANNON.Material({ friction: FRICTION, restitution: RESTITUTION });

  const floor = new CANNON.Body({ mass: 0, material: floorMat });
  floor.addShape(new CANNON.Plane());
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  floor.position.set(0, FLOOR_Y, 0);
  world.addBody(floor);

  const boxShape = new CANNON.Box(new CANNON.Vec3(HALF_EXTENT, HALF_EXTENT, HALF_EXTENT));
  const die = new CANNON.Body({
    mass: DIE_MASS,
    material: dieMat,
    linearDamping: 0.05,
    angularDamping: 0.1,
    sleepTimeLimit: SLEEP_TIME,
    sleepSpeedLimit: SLEEP_SPEED,
  });
  die.addShape(boxShape, biasOffsetVec);
  die.position.set(0, FLOOR_Y + DIE_EDGE * 3, 0);

  die.quaternion.set(Math.random() - .5, Math.random() - .5, Math.random() - .5, Math.random() - .5);
  die.quaternion.normalize();
  world.addBody(die);

  const f = THROW_MIN + Math.random() * (THROW_MAX - THROW_MIN);
  const dirX = 0, dirZ = 1;
  const cross = (Math.random() - 0.5) * f * CROSS_MUL;
  die.applyImpulse(
    new CANNON.Vec3(
      dirX * f * MAIN_IMPULSE + (-dirZ) * cross,
      f * IMPULSE_Y_MUL,
      dirZ * f * MAIN_IMPULSE + dirX * cross
    ),
    new CANNON.Vec3(
      (Math.random() - .5) * LEVER_R,
      (Math.random() - .5) * LEVER_R,
      (Math.random() - .5) * LEVER_R
    )
  );

  die.allowSleep = true;
  die.wakeUp();

  const DT = 1 / 60;
  const MAX_STEPS = 3000;
  for (let step = 0; step < MAX_STEPS; step++) {
    world.step(DT);
    if (die.sleepState === CANNON.Body.SLEEPING) break;
  }

  return readFaceForced(die.quaternion);
}

// ── Sweep: direction (0, Yw, Zw) with Zw > Yw ──────────────────────────────
// Phase 1: fix ratio Yw/Zw = 0.5 (face 3 gets ~2× the pull of face 1), sweep magnitude
const YW = 0.5;
const ZW = 1.0;
const norm = Math.sqrt(YW * YW + ZW * ZW);
const DIR = new CANNON.Vec3(0, YW / norm, ZW / norm);

const THROWS_PER_OFFSET = 5000;
const OFFSET_MIN  = 0.20;
const OFFSET_MAX  = 0.55;
const OFFSET_STEP = 0.025;

console.log(`=== Mathematician Die calibration ===`);
console.log(`Target: face 3 ≈ 24%, face 1 ≈ 20%, rest ≈ 14%`);
console.log(`Bias direction: (0, ${(YW/norm).toFixed(3)}, ${(ZW/norm).toFixed(3)})`);
console.log(`Throws per offset: ${THROWS_PER_OFFSET}`);
console.log(`Physics: gravity=${GRAVITY}, mass=${DIE_MASS}, scale=${DIE_SCALE}`);
console.log('');
console.log('offset  | f1%    f2%    f3%    f4%    f5%    f6%    | f3-f1 gap');
console.log('--------+------------------------------------------+----------');

for (let offset = OFFSET_MIN; offset <= OFFSET_MAX + 0.0001; offset += OFFSET_STEP) {
  const mag = offset * HALF_EXTENT;
  const offsetVec = new CANNON.Vec3(
    DIR.x * mag,
    DIR.y * mag,
    DIR.z * mag
  );

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (let t = 0; t < THROWS_PER_OFFSET; t++) {
    const face = simulateThrow(offsetVec);
    counts[face]++;
  }

  const pcts = {};
  const pctNums = {};
  for (let f = 1; f <= 6; f++) {
    pctNums[f] = (counts[f] / THROWS_PER_OFFSET) * 100;
    pcts[f] = pctNums[f].toFixed(1).padStart(5);
  }

  const gap = (pctNums[3] - pctNums[1]).toFixed(1).padStart(5);
  const label = offset.toFixed(3).padStart(6);

  console.log(
    `${label}  | ${pcts[1]}  ${pcts[2]}  ${pcts[3]}  ${pcts[4]}  ${pcts[5]}  ${pcts[6]}  | ${gap}`
  );
}

console.log('');
console.log('Look for offset where f3 ≈ 24%, f1 ≈ 20%, gap ≈ 4.');
console.log('If f1 too high relative to f3, increase ZW/YW ratio and re-run.');
console.log('If both too low, increase offset. If both too high, decrease offset.');
console.log('');
console.log('Done.');
