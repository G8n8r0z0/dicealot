// Bandie heal tests — runnable via: node tests/test-bandie.js

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
load('src/systems/playerSystem.js');
load('src/systems/enemySystem.js');
load('src/systems/matchSystem.js');
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
    ctx.playerSystem.init(store);
    ctx.enemySystem.init(store);
    ctx.matchSystem.init(store);
    ctx.turnSystem.init(store);
    store.state.loadout = { slots: ['base', 'base', 'base', 'base', 'base', 'base'] };
    store.dispatch('START_BATTLE', { enemyHp: 3000, enemyName: 'Bot', difficulty: 'novice' });
}

function setLoadoutSlot(idx, dieId) {
    store.state.loadout.slots[idx] = dieId;
}

console.log('\nBandie \u2014 Test Suite\n');

// ── Bandie scores 1 → heal 100 ─────────────────────────────────
group('Bandie scores single 1 \u2192 heal 100');
freshGame(1);
setLoadoutSlot(0, 'bandie');
store.state.player.hp = 2000;
store.state.player.maxHp = 3000;
store.dispatch('START_TURN');
var t = store.state.turn;
t.rolledDice = [1, 3, 4, 2, 6, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SCORE_SELECTION');
assert('player hp healed to 2100', store.state.player.hp, 2100);
assert('lastHealAmount is 100', store.state.turn.lastHealAmount, 100);

// ── Bandie scores 5 → heal 100 ─────────────────────────────────
group('Bandie scores single 5 \u2192 heal 100');
freshGame(2);
setLoadoutSlot(0, 'bandie');
store.state.player.hp = 2500;
store.state.player.maxHp = 3000;
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [5, 3, 4, 2, 6, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SCORE_SELECTION');
assert('player hp healed to 2600', store.state.player.hp, 2600);

// ── Bandie scores 3 → no heal ───────────────────────────────────
group('Bandie scores 3 (in triple) \u2192 no heal');
freshGame(3);
setLoadoutSlot(0, 'bandie');
store.state.player.hp = 2000;
store.state.player.maxHp = 3000;
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [3, 3, 3, 2, 6, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
store.dispatch('SCORE_SELECTION');
assert('player hp unchanged (2000)', store.state.player.hp, 2000);
assert('lastHealAmount is 0', store.state.turn.lastHealAmount, 0);

// ── Bandie(1) in triple 1s → heal ──────────────────────────────
group('Bandie(1) in triple 1s \u2192 heal');
freshGame(4);
setLoadoutSlot(0, 'bandie');
store.state.player.hp = 2000;
store.state.player.maxHp = 3000;
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 1, 1, 2, 6, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
store.dispatch('SCORE_SELECTION');
assert('player hp healed to 2100 (1 bandie in triple)', store.state.player.hp, 2100);
assert('score is 1000 (triple 1s)', store.state.turn.accumulatedScore, 1000);

// ── Heal capped at maxHp ────────────────────────────────────────
group('Heal capped at maxHp');
freshGame(5);
setLoadoutSlot(0, 'bandie');
store.state.player.hp = 2950;
store.state.player.maxHp = 3000;
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 3, 4, 2, 6, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SCORE_SELECTION');
assert('player hp capped at 3000', store.state.player.hp, 3000);

// ── Non-bandie die scoring 1 → no heal ──────────────────────────
group('Non-bandie die scoring 1 \u2192 no heal');
freshGame(6);
store.state.player.hp = 2000;
store.state.player.maxHp = 3000;
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 3, 4, 2, 6, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SCORE_SELECTION');
assert('player hp unchanged (no bandie)', store.state.player.hp, 2000);
assert('lastHealAmount is 0', store.state.turn.lastHealAmount, 0);

// ── Multiple bandies in selection ───────────────────────────────
group('Two bandies, both roll 1 \u2192 heal twice');
freshGame(7);
setLoadoutSlot(0, 'bandie');
setLoadoutSlot(1, 'bandie');
store.state.player.hp = 2000;
store.state.player.maxHp = 3000;
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 1, 1, 2, 6, 6];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
store.dispatch('SCORE_SELECTION');
assert('player hp healed to 2200 (2 bandies x 100)', store.state.player.hp, 2200);
assert('lastHealAmount is 200', store.state.turn.lastHealAmount, 200);

// ── Bandie rolls 6 → no heal (scored in combo) ─────────────────
group('Bandie rolls 6 in triple 6s \u2192 no heal');
freshGame(8);
setLoadoutSlot(0, 'bandie');
store.state.player.hp = 2000;
store.state.player.maxHp = 3000;
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [6, 6, 6, 2, 5, 1];
t.dieSlotMap = [0, 1, 2, 3, 4, 5];
t.diceCount = 6;
t.phase = 'selecting';

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
store.dispatch('SCORE_SELECTION');
assert('player hp unchanged (bandie rolled 6, not 1/5)', store.state.player.hp, 2000);

// ── Summary ───────────────────────────────────────────────────
console.log('\n' + '\u2500'.repeat(50));
var total = passed + failed;
if (failed === 0) {
    console.log('\x1b[32m  All ' + total + ' assertions passed.\x1b[0m\n');
} else {
    console.log('\x1b[31m  ' + failed + '/' + total + ' FAILED.\x1b[0m\n');
}

process.exit(failed > 0 ? 1 : 0);
