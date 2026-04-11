// Slime Die spawn tests — runnable via: node tests/test-slime.js

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, Math, setTimeout, clearTimeout, window: {} });
ctx.window = ctx;

function load(relPath) {
    const code = fs.readFileSync(path.join(root, relPath), 'utf-8');
    vm.runInContext(code, ctx, { filename: relPath });
}

load('src/store/store.js');
load('src/config/scoring.js');
load('src/config/balance.js');
load('src/config/dice.js');
load('src/systems/scoringSystem.js');
load('src/systems/turnSystem.js');

const store = ctx.store;
let passed = 0, failed = 0;

function group(name) { console.log('\n  ' + name); }

function assert(name, actual, expected) {
    if (actual === expected) {
        passed++;
        console.log('    \x1b[32m\u2713\x1b[0m ' + name);
    } else {
        failed++;
        console.log('    \x1b[31m\u2717\x1b[0m ' + name + ' \u2014 expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
}

function freshGame(seed) {
    store.resetState(seed || 42);
    ctx.turnSystem.init(store);
    store.state.loadout = { slots: ['base', 'base', 'base', 'base', 'base', 'base'] };
}

function setLoadoutSlot(idx, dieId) {
    store.state.loadout.slots[idx] = dieId;
}

console.log('\nSlime Die \u2014 Test Suite\n');

// ── detectSlimeSpawns: Slime rolls 6 → phase spawning ──────────
group('Slime rolls 6 → spawning phase');
freshGame(1);
setLoadoutSlot(2, 'slime');
store.dispatch('START_TURN');
var t = store.state.turn;
t.rolledDice = [3, 4, 6, 2, 5, 1];
t.diceCount = 6;
t.phase = 'selecting';
store.dispatch('DICE_SETTLED', { values: [3, 4, 6, 2, 5, 1] });
t = store.state.turn;
assert('phase is spawning', t.phase, 'spawning');
assert('slimeSpawns has 1 entry', t.slimeSpawns.length, 1);
assert('parentIndex is 2', t.slimeSpawns[0].parentIndex, 2);
assert('level is 1', t.slimeSpawns[0].level, 1);
assert('spawnCount is 1', t.slimeSpawns[0].spawnCount, 1);

// ── Non-6 value → no spawn ──────────────────────────────────────
group('Slime rolls non-6 → no spawn');
freshGame(2);
setLoadoutSlot(0, 'slime');
store.dispatch('START_TURN');
store.dispatch('DICE_SETTLED', { values: [3, 4, 5, 2, 1, 6] });
t = store.state.turn;
assert('phase is selecting (not spawning)', t.phase, 'selecting');
assert('slimeSpawns empty', t.slimeSpawns.length, 0);

// ── Non-slime die rolls 6 → no spawn ───────────────────────────
group('Non-slime die rolls 6 → no spawn');
freshGame(3);
store.dispatch('START_TURN');
store.dispatch('DICE_SETTLED', { values: [6, 6, 6, 6, 6, 6] });
t = store.state.turn;
assert('phase is selecting (no slime in loadout)', t.phase, 'selecting');

// ── SLIME_SPAWNED Lv1: adds temp die, Slime stays 6 ────────────
group('SLIME_SPAWNED Lv1');
freshGame(10);
setLoadoutSlot(0, 'slime');
store.dispatch('START_TURN');
store.dispatch('DICE_SETTLED', { values: [6, 3, 4, 2, 5, 1] });
t = store.state.turn;
assert('phase spawning before SLIME_SPAWNED', t.phase, 'spawning');

store.dispatch('SLIME_SPAWNED', {
    spawns: [{ value: 3 }],
    parentLevel: 1,
    parentIndex: 0
});
t = store.state.turn;
assert('phase selecting after spawn', t.phase, 'selecting');
assert('slimeTriggered is true', t.slimeTriggered, true);
assert('rolledDice now has 7 values', t.rolledDice.length, 7);
assert('7th die value is 3', t.rolledDice[6], 3);
assert('dieSlotMap[6] is -1 (temp)', t.dieSlotMap[6], -1);
assert('diceCount is 7', t.diceCount, 7);
assert('tempDiceCount is 1', t.tempDiceCount, 1);
assert('parent (index 0) stays 6', t.rolledDice[0], 6);

// ── SLIME_SPAWNED Lv2: 2 temp dice, parent → 5 ────────────────
group('SLIME_SPAWNED Lv2');
freshGame(20);
setLoadoutSlot(1, 'slime');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [4, 6, 3, 2, 5, 1];
t.diceCount = 6;
t.phase = 'spawning';
t.slimeSpawns = [{ parentIndex: 1, level: 2, spawnCount: 2 }];

store.dispatch('SLIME_SPAWNED', {
    spawns: [{ value: 4 }, { value: 2 }],
    parentLevel: 2,
    parentIndex: 1
});
t = store.state.turn;
assert('rolledDice now has 8 values', t.rolledDice.length, 8);
assert('temp die 1 value is 4', t.rolledDice[6], 4);
assert('temp die 2 value is 2', t.rolledDice[7], 2);
assert('dieSlotMap[6] is -1', t.dieSlotMap[6], -1);
assert('dieSlotMap[7] is -1', t.dieSlotMap[7], -1);
assert('diceCount is 8', t.diceCount, 8);
assert('tempDiceCount is 2', t.tempDiceCount, 2);
assert('parent (index 1) becomes 5', t.rolledDice[1], 5);

// ── SLIME_SPAWNED Lv3: 1 temp die value=1, parent → 5 ─────────
group('SLIME_SPAWNED Lv3');
freshGame(30);
setLoadoutSlot(3, 'slime');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [2, 4, 5, 6, 1, 3];
t.diceCount = 6;
t.phase = 'spawning';
t.slimeSpawns = [{ parentIndex: 3, level: 3, spawnCount: 1 }];

store.dispatch('SLIME_SPAWNED', {
    spawns: [{ value: 1 }],
    parentLevel: 3,
    parentIndex: 3
});
t = store.state.turn;
assert('rolledDice has 7 values', t.rolledDice.length, 7);
assert('temp die value is 1 (guaranteed)', t.rolledDice[6], 1);
assert('parent (index 3) becomes 5', t.rolledDice[3], 5);
assert('tempDiceCount is 1', t.tempDiceCount, 1);

// ── Once per turn: second 6 → no spawn ──────────────────────────
group('Once per turn \u2014 second 6 does not trigger spawn');
freshGame(40);
setLoadoutSlot(0, 'slime');
store.dispatch('START_TURN');
store.dispatch('DICE_SETTLED', { values: [6, 3, 4, 2, 5, 1] });
t = store.state.turn;
assert('first 6 → spawning', t.phase, 'spawning');

store.dispatch('SLIME_SPAWNED', {
    spawns: [{ value: 5 }],
    parentLevel: 1,
    parentIndex: 0
});
assert('slimeTriggered true', t.slimeTriggered, true);

// Score the temp die (value 5) to continue
t.phase = 'selecting';
store.dispatch('SELECT_DIE', { index: 6 });
store.dispatch('SCORE_SELECTION');

// Simulate next roll within same turn — slime rolls 6 again
t.phase = 'selecting';
store.dispatch('DICE_SETTLED', { values: [6, 3, 4, 2, 5, 1] });
t = store.state.turn;
assert('second 6 → still selecting (no spawn)', t.phase, 'selecting');
assert('slimeSpawns empty', t.slimeSpawns.length, 0);

// ── Temp die does not trigger spawn (dieSlotMap -1) ─────────────
group('Temp die rolling 6 does not trigger spawn');
freshGame(50);
setLoadoutSlot(0, 'slime');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [3, 4, 5, 2, 1, 3, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5, -1];
t.diceCount = 7;
t.slimeTriggered = false;
t.phase = 'selecting';

store.dispatch('DICE_SETTLED', { values: [3, 4, 5, 2, 1, 3, 6] });
t = store.state.turn;
assert('temp die 6 → no spawn (selecting)', t.phase, 'selecting');

// ── Cleanup on BANK ─────────────────────────────────────────────
group('Cleanup on BANK');
freshGame(60);
setLoadoutSlot(0, 'slime');
store.dispatch('START_TURN');
t = store.state.turn;
t.tempDiceCount = 1;
t.slimeTriggered = true;
t.diceCount = 7;
t.rolledDice = [6, 3, 4, 2, 5, 1, 5];
t.dieSlotMap = [0, 1, 2, 3, 4, 5, -1];
t.heldDice = [1];
t.accumulatedScore = 100;
t.phase = 'idle';

store.dispatch('BANK');
t = store.state.turn;
assert('tempDiceCount reset to 0', t.tempDiceCount, 0);
assert('slimeTriggered reset', t.slimeTriggered, false);
assert('slimeSpawns empty', t.slimeSpawns.length, 0);
assert('diceCount reset to 6', t.diceCount, 6);
assert('dieSlotMap has 6 entries', t.dieSlotMap.length, 6);

// ── Cleanup on BUST ─────────────────────────────────────────────
group('Cleanup on BUST');
freshGame(70);
store.dispatch('START_TURN');
t = store.state.turn;
t.tempDiceCount = 2;
t.slimeTriggered = true;

store.dispatch('BUST');
t = store.state.turn;
assert('tempDiceCount reset', t.tempDiceCount, 0);
assert('slimeTriggered reset', t.slimeTriggered, false);
assert('slimeSpawns empty', t.slimeSpawns.length, 0);

// ── Hot Hand with 7 dice (6 + 1 temp) ──────────────────────────
group('Hot Hand with 7 dice (6 original + 1 temp)');
freshGame(80);
setLoadoutSlot(0, 'slime');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 1, 1, 5, 5, 5, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5, -1];
t.diceCount = 7;
t.tempDiceCount = 1;
t.slimeTriggered = true;
t.phase = 'selecting';
t.heldDice = [];
t.accumulatedScore = 0;

for (var i = 0; i < 7; i++) {
    store.dispatch('SELECT_DIE', { index: i });
}
assert('all 7 selected valid', t.selectionValid, true);

store.dispatch('SCORE_SELECTION');
assert('hotHandTriggered', t.hotHandTriggered, true);
assert('banked score correct (4×1=2000 + 3×5=500 = 2500)', t.lastBankedScore, 2500);
assert('accumulated reset', t.accumulatedScore, 0);
assert('held cleared', t.heldDice.length, 0);
assert('diceCount reset to 6', t.diceCount, 6);
assert('tempDiceCount reset', t.tempDiceCount, 0);
assert('slimeTriggered reset', t.slimeTriggered, false);

// ── Hot Hand with 8 dice (6 + 2 temp from Lv2) ─────────────────
group('Hot Hand with 8 dice (6 original + 2 temp from Lv2)');
freshGame(90);
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 5, 1, 5, 1, 5, 1, 5];
t.dieSlotMap = [0, 1, 2, 3, 4, 5, -1, -1];
t.diceCount = 8;
t.tempDiceCount = 2;
t.slimeTriggered = true;
t.phase = 'selecting';
t.heldDice = [];
t.accumulatedScore = 0;

for (var j = 0; j < 8; j++) {
    store.dispatch('SELECT_DIE', { index: j });
}
store.dispatch('SCORE_SELECTION');
assert('hotHandTriggered with 8 dice', t.hotHandTriggered, true);
assert('banked score (4×1=2000 + 4×5=1000 = 3000)', t.lastBankedScore, 3000);
assert('diceCount reset to 6', t.diceCount, 6);
assert('tempDiceCount reset', t.tempDiceCount, 0);

// ── SLIME_SPAWNED phase guard ───────────────────────────────────
group('SLIME_SPAWNED phase guard');
freshGame(100);
store.dispatch('START_TURN');
t = store.state.turn;
t.phase = 'selecting';
var beforeDiceCount = t.diceCount;

store.dispatch('SLIME_SPAWNED', {
    spawns: [{ value: 3 }],
    parentLevel: 1,
    parentIndex: 0
});
assert('no effect when phase is not spawning', t.diceCount, beforeDiceCount);
assert('slimeTriggered still false', t.slimeTriggered, false);

// ── START_TURN resets slime state ───────────────────────────────
group('START_TURN resets slime state');
freshGame(110);
store.dispatch('START_TURN');
t = store.state.turn;
t.slimeTriggered = true;
t.tempDiceCount = 1;
t.slimeSpawns = [{ parentIndex: 0, level: 1, spawnCount: 1 }];

store.dispatch('START_TURN');
t = store.state.turn;
assert('slimeTriggered reset', t.slimeTriggered, false);
assert('tempDiceCount reset', t.tempDiceCount, 0);
assert('slimeSpawns reset', t.slimeSpawns.length, 0);

// ── SLIME_SPAWNED into bust ─────────────────────────────────────
group('SLIME_SPAWNED into bust (all non-scorable)');
freshGame(120);
setLoadoutSlot(0, 'slime');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [6, 2, 3, 4, 6, 2];
t.diceCount = 6;
t.phase = 'spawning';
t.slimeSpawns = [{ parentIndex: 0, level: 1, spawnCount: 1 }];

store.dispatch('SLIME_SPAWNED', {
    spawns: [{ value: 4 }],
    parentLevel: 1,
    parentIndex: 0
});
t = store.state.turn;
assert('phase is bust (no playable dice)', t.phase, 'bust');
assert('accumulated reset on bust', t.accumulatedScore, 0);

// ── Summary ───────────────────────────────────────────────────
console.log('\n' + '\u2500'.repeat(50));
var total = passed + failed;
if (failed === 0) {
    console.log('\x1b[32m  All ' + total + ' assertions passed.\x1b[0m\n');
} else {
    console.log('\x1b[31m  ' + failed + '/' + total + ' FAILED.\x1b[0m\n');
}

process.exit(failed > 0 ? 1 : 0);
