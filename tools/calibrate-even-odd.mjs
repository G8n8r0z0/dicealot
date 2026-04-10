/**
 * Headless cannon-es calibration for Even / Odd diagonal bias.
 *
 * Even Die: bias toward faces 2,4,6 — diagonal (+1,-1,-1)/√3
 * Odd  Die: bias toward faces 1,3,5 — diagonal (-1,+1,+1)/√3  (mirror)
 *
 * Target distribution (Lv1): biased faces 25% each, others 8.3% each.
 *
 * Usage: node tools/calibrate-even-odd.mjs
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

// ── Even Die: bias toward corner where faces 2(X+), 4(Z-), 6(Y-) meet ──────
const INV_SQRT3 = 1 / Math.sqrt(3);
const EVEN_DIR = new CANNON.Vec3(INV_SQRT3, -INV_SQRT3, -INV_SQRT3);

const THROWS_PER_OFFSET = 3000;
const OFFSET_MIN  = 0.25;
const OFFSET_MAX  = 0.75;
const OFFSET_STEP = 0.025;

console.log('=== Even Die calibration (faces 2,4,6 target ~25% each) ===');
console.log(`Diagonal bias direction: (+1,-1,-1)/√3`);
console.log(`Throws per offset: ${THROWS_PER_OFFSET}`);
console.log(`Physics: gravity=${GRAVITY}, mass=${DIE_MASS}, scale=${DIE_SCALE}`);
console.log('');
console.log('offset  | f1%    f2%    f3%    f4%    f5%    f6%    | even%  odd%');
console.log('--------+------------------------------------------+------------');

const results = [];

for (let offset = OFFSET_MIN; offset <= OFFSET_MAX + 0.0001; offset += OFFSET_STEP) {
  const mag = offset * HALF_EXTENT;
  const offsetVec = new CANNON.Vec3(
    EVEN_DIR.x * mag,
    EVEN_DIR.y * mag,
    EVEN_DIR.z * mag
  );

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (let t = 0; t < THROWS_PER_OFFSET; t++) {
    const face = simulateThrow(offsetVec);
    counts[face]++;
  }

  const pcts = {};
  for (let f = 1; f <= 6; f++) {
    pcts[f] = ((counts[f] / THROWS_PER_OFFSET) * 100).toFixed(1).padStart(5);
  }

  const evenPct = ((counts[2] + counts[4] + counts[6]) / THROWS_PER_OFFSET * 100).toFixed(1).padStart(5);
  const oddPct  = ((counts[1] + counts[3] + counts[5]) / THROWS_PER_OFFSET * 100).toFixed(1).padStart(5);
  const label = offset.toFixed(3).padStart(6);

  console.log(
    `${label}  | ${pcts[1]}  ${pcts[2]}  ${pcts[3]}  ${pcts[4]}  ${pcts[5]}  ${pcts[6]}  | ${evenPct}  ${oddPct}`
  );

  results.push({
    offset: +offset.toFixed(3),
    counts,
    evenPct: +(evenPct.trim()),
    perFaceEven: [counts[2], counts[4], counts[6]].map(c => +(c / THROWS_PER_OFFSET * 100).toFixed(1)),
  });
}

console.log('');
console.log('Target: each even face ~25%, total even ~75%, each odd face ~8.3%');
console.log('Odd Die uses the same offset with mirrored direction (-1,+1,+1)/√3.');
console.log('');
console.log('Done.');
