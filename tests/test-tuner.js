// Tuner Die tests — runnable via: node tests/test-tuner.js

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
    store.state.match = { phase: 'battle', activePlayer: 'player' };
}

function setLoadoutSlot(idx, dieId) {
    store.state.loadout.slots[idx] = dieId;
}

console.log('\nTuner Die \u2014 Test Suite\n');

// ── Tune +1: 3 → 4 ─────────────────────────────────────────────
group('Tune +1: 3 \u2192 4');
freshGame(1);
setLoadoutSlot(0, 'tuner');
store.dispatch('START_TURN');
var t = store.state.turn;
t.rolledDice = [3, 6, 6, 2, 5, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('USE_ABILITY', { dieIndex: 0, ability: 'tune', dieId: 'tuner', direction: 1 });
t = store.state.turn;
assert('phase is tuning', t.phase, 'tuning');
assert('tuneUsed is true', t.tuneUsed, true);
assert('tuningDie is 0', t.tuningDie, 0);
assert('tuneDirection is 1', t.tuneDirection, 1);

store.dispatch('TUNE_SETTLED', { dieIndex: 0, value: 4 });
t = store.state.turn;
assert('phase is selecting after settle', t.phase, 'selecting');
assert('rolledDice[0] is 4', t.rolledDice[0], 4);
assert('tuningDie reset to -1', t.tuningDie, -1);

// ── Tune -1: 3 → 2 ─────────────────────────────────────────────
group('Tune -1: 3 \u2192 2');
freshGame(2);
setLoadoutSlot(0, 'tuner');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [3, 6, 6, 2, 5, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('USE_ABILITY', { dieIndex: 0, ability: 'tune', dieId: 'tuner', direction: -1 });
t = store.state.turn;
assert('phase is tuning', t.phase, 'tuning');

store.dispatch('TUNE_SETTLED', { dieIndex: 0, value: 2 });
t = store.state.turn;
assert('rolledDice[0] is 2', t.rolledDice[0], 2);

// ── Wrap 6 + 1 → 1 ─────────────────────────────────────────────
group('Wrap: 6 + 1 \u2192 1');
freshGame(3);
setLoadoutSlot(0, 'tuner');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [6, 5, 3, 2, 4, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('USE_ABILITY', { dieIndex: 0, ability: 'tune', dieId: 'tuner', direction: 1 });
store.dispatch('TUNE_SETTLED', { dieIndex: 0, value: 1 });
t = store.state.turn;
assert('rolledDice[0] is 1 (wrapped from 6+1)', t.rolledDice[0], 1);

// ── Wrap 1 - 1 → 6 ─────────────────────────────────────────────
group('Wrap: 1 - 1 \u2192 6');
freshGame(4);
setLoadoutSlot(0, 'tuner');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 5, 3, 2, 4, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('USE_ABILITY', { dieIndex: 0, ability: 'tune', dieId: 'tuner', direction: -1 });
store.dispatch('TUNE_SETTLED', { dieIndex: 0, value: 6 });
t = store.state.turn;
assert('rolledDice[0] is 6 (wrapped from 1-1)', t.rolledDice[0], 6);

// ── tuneUsed prevents double use ────────────────────────────────
group('tuneUsed prevents double use');
freshGame(5);
setLoadoutSlot(0, 'tuner');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [3, 5, 3, 2, 4, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('USE_ABILITY', { dieIndex: 0, ability: 'tune', dieId: 'tuner', direction: 1 });
store.dispatch('TUNE_SETTLED', { dieIndex: 0, value: 4 });
t = store.state.turn;
assert('tuneUsed is true after first use', t.tuneUsed, true);

t.rolledDice[0] = 4;
t.phase = 'selecting';
store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('USE_ABILITY', { dieIndex: 0, ability: 'tune', dieId: 'tuner', direction: 1 });
t = store.state.turn;
assert('phase stays selecting (second tune blocked)', t.phase, 'selecting');

// ── Invalid direction is rejected ───────────────────────────────
group('Invalid direction rejected');
freshGame(6);
setLoadoutSlot(0, 'tuner');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [3, 5, 3, 2, 4, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('USE_ABILITY', { dieIndex: 0, ability: 'tune', dieId: 'tuner', direction: 2 });
t = store.state.turn;
assert('phase stays selecting (invalid direction)', t.phase, 'selecting');
assert('tuneUsed stays false', t.tuneUsed, false);

// ── Phase guards: TUNE_SETTLED only in tuning phase ─────────────
group('TUNE_SETTLED phase guard');
freshGame(7);
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [3, 5, 3, 2, 4, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('TUNE_SETTLED', { dieIndex: 0, value: 4 });
t = store.state.turn;
assert('phase unchanged (not tuning)', t.phase, 'selecting');
assert('rolledDice[0] unchanged', t.rolledDice[0], 3);

// ── TUNE_TARGET phase guard ──────────────────────────────────────
group('TUNE_TARGET phase guard');
freshGame(8);
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [3, 5, 3, 2, 4, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('TUNE_TARGET', { targetIndex: 1 });
t = store.state.turn;
assert('phase unchanged (not tuneTargeting)', t.phase, 'selecting');

// ── Tune into bust (all non-scorable after shift) ────────────────
group('Tune into bust');
freshGame(9);
setLoadoutSlot(0, 'tuner');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [5, 3, 2, 6, 4, 3];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('USE_ABILITY', { dieIndex: 0, ability: 'tune', dieId: 'tuner', direction: -1 });
store.dispatch('TUNE_SETTLED', { dieIndex: 0, value: 4 });
t = store.state.turn;
assert('phase is bust (no scorable dice: [4,3,2,6,4,3])', t.phase, 'bust');

// ── Reset on START_TURN ──────────────────────────────────────────
group('tuneUsed resets on START_TURN');
freshGame(10);
setLoadoutSlot(0, 'tuner');
store.dispatch('START_TURN');
t = store.state.turn;
t.tuneUsed = true;
t.tuningDie = 2;

store.dispatch('START_TURN');
t = store.state.turn;
assert('tuneUsed reset', t.tuneUsed, false);
assert('tuningDie reset', t.tuningDie, -1);

// ── Reset on BANK ────────────────────────────────────────────────
group('tuneUsed resets on BANK');
freshGame(11);
setLoadoutSlot(0, 'tuner');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 3, 4, 2, 6, 4];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';
store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SCORE_SELECTION');
t = store.state.turn;
t.tuneUsed = true;
t.phase = 'idle';
store.dispatch('BANK');
t = store.state.turn;
assert('tuneUsed reset after bank', t.tuneUsed, false);

// ── Summary ───────────────────────────────────────────────────
console.log('\n' + '\u2500'.repeat(50));
var total = passed + failed;
if (failed === 0) {
    console.log('\x1b[32m  All ' + total + ' assertions passed.\x1b[0m\n');
} else {
    console.log('\x1b[31m  ' + failed + '/' + total + ' FAILED.\x1b[0m\n');
}

process.exit(failed > 0 ? 1 : 0);
