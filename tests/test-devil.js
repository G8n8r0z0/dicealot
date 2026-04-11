// Devil Die scoring tests — runnable via: node tests/test-devil.js

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

console.log('\nDevil Die \u2014 Test Suite\n');

// ── Devil + 2x6 on table = 600 (Devil not 6) ───────────────────
group('Devil (not 6) + two 6s = 3\u00d76 = 600');
freshGame(1);
setLoadoutSlot(0, 'devil');
store.dispatch('START_TURN');
var t = store.state.turn;
t.rolledDice = [3, 6, 6, 2, 5, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
t = store.state.turn;
assert('selection valid', t.selectionValid, true);
assert('score is 600 (3\u00d76)', t.selectionScore, 600);
assert('devilBonus is 0 (not natural 6)', t.devilBonus, 0);

// ── Devil (natural 6) + 2x6 = 1200 (doubled) ───────────────────
group('Devil (natural 6) + two 6s = 1200');
freshGame(2);
setLoadoutSlot(0, 'devil');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [6, 6, 6, 2, 5, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
t = store.state.turn;
assert('selection valid', t.selectionValid, true);
assert('score is 1200 (600 + 600 bonus)', t.selectionScore, 1200);
assert('devilBonus is 600', t.devilBonus, 600);

// ── Devil without 2 other 6s = normal scoring ───────────────────
group('Devil without 2 other 6s \u2014 normal scoring');
freshGame(3);
setLoadoutSlot(0, 'devil');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [3, 6, 4, 2, 5, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
t = store.state.turn;
assert('selection invalid (3 + 6 = not scorable)', t.selectionValid, false);
assert('devilBonus is 0', t.devilBonus, 0);

// ── Devil alone, rolled 1 → scores as normal 100 ───────────────
group('Devil alone, rolled 1 \u2014 normal single scoring');
freshGame(4);
setLoadoutSlot(0, 'devil');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 6, 4, 2, 3, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
t = store.state.turn;
assert('selection valid (single 1)', t.selectionValid, true);
assert('score is 100', t.selectionScore, 100);
assert('devilBonus is 0', t.devilBonus, 0);

// ── Devil with only 1 other 6 = no substitution ────────────────
group('Devil + only one 6 \u2014 no substitution');
freshGame(5);
setLoadoutSlot(0, 'devil');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [4, 6, 3, 2, 5, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
t = store.state.turn;
assert('selection invalid (4 + 6 not scorable)', t.selectionValid, false);
assert('devilBonus is 0', t.devilBonus, 0);

// ── Devil (not 6) + 2x6 + extra scoring dice ───────────────────
group('Devil (not 6) + 2x6 + extra 1 = 600 + 100 = 700');
freshGame(6);
setLoadoutSlot(0, 'devil');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [3, 6, 6, 1, 5, 2];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
store.dispatch('SELECT_DIE', { index: 3 });
t = store.state.turn;
assert('selection valid', t.selectionValid, true);
assert('score is 700 (3\u00d76=600 + single 1=100)', t.selectionScore, 700);

// ── No Devil in loadout + 3x6 = normal 600 ─────────────────────
group('No Devil in loadout \u2014 3x6 = normal 600');
freshGame(7);
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [6, 6, 6, 2, 3, 4];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
t = store.state.turn;
assert('score is 600 (no devil)', t.selectionScore, 600);
assert('devilBonus is 0', t.devilBonus, 0);

// ── Devil (not 6) + 3x6 on table, select Devil + 2 of the 6s ──
group('Devil(2) + two 6s selected (third 6 not selected)');
freshGame(8);
setLoadoutSlot(0, 'devil');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [2, 6, 6, 6, 5, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
t = store.state.turn;
assert('selection valid (Devil->6 + 6 + 6 = 3\u00d76)', t.selectionValid, true);
assert('score is 600', t.selectionScore, 600);

// ── Deselect clears devilBonus ──────────────────────────────────
group('Deselect clears devilBonus');
freshGame(9);
setLoadoutSlot(0, 'devil');
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [6, 6, 6, 2, 3, 4];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
assert('devilBonus set', t.devilBonus, 600);

store.dispatch('DESELECT_DIE', { index: 0 });
t = store.state.turn;
assert('devilBonus cleared after deselect', t.devilBonus, 0);

// ── Summary ───────────────────────────────────────────────────
console.log('\n' + '\u2500'.repeat(50));
var total = passed + failed;
if (failed === 0) {
    console.log('\x1b[32m  All ' + total + ' assertions passed.\x1b[0m\n');
} else {
    console.log('\x1b[31m  ' + failed + '/' + total + ' FAILED.\x1b[0m\n');
}

process.exit(failed > 0 ? 1 : 0);
