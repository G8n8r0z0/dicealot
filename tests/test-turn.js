// Turn system tests — runnable via: node tests/test-turn.js

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
load('src/systems/scoringSystem.js');
load('src/systems/turnSystem.js');

const store = ctx.store;
let passed = 0, failed = 0;

function group(name) { console.log('\n  ' + name); }

function assert(name, actual, expected) {
    if (actual === expected) {
        passed++;
        console.log('    \x1b[32m✓\x1b[0m ' + name);
    } else {
        failed++;
        console.log('    \x1b[31m✗\x1b[0m ' + name + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
}

function freshGame(seed) {
    store.resetState(seed || 42);
    ctx.turnSystem.init(store);
}

console.log('\nTurn System — Test Suite\n');

// ── Init ──────────────────────────────────────────────────────
group('Init');
freshGame(1);
assert('phase starts idle', store.state.turn.phase, 'idle');
assert('diceCount is 6', store.state.turn.diceCount, 6);
assert('accumulatedScore is 0', store.state.turn.accumulatedScore, 0);
assert('turnNumber is 0', store.state.turn.turnNumber, 0);

// ── START_TURN ────────────────────────────────────────────────
group('START_TURN');
freshGame(1);
store.dispatch('START_TURN');
assert('turnNumber incremented', store.state.turn.turnNumber, 1);
assert('phase idle after start', store.state.turn.phase, 'idle');

// ── ROLL_DICE ─────────────────────────────────────────────────
group('ROLL_DICE — basic');
freshGame(100);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
var t = store.state.turn;
assert('rolledDice has 6 values', t.rolledDice.length, 6);
assert('all values 1-6', t.rolledDice.every(function(v) { return v >= 1 && v <= 6; }), true);
var expectPhase = ctx.scoringSystem.hasPlayableDice(t.rolledDice) ? 'selecting' : 'bust';
assert('phase is selecting or bust', t.phase, expectPhase);

// ── ROLL_DICE — deterministic ─────────────────────────────────
group('ROLL_DICE — deterministic (same seed = same values)');
freshGame(999);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
var roll1 = store.state.turn.rolledDice.slice();

freshGame(999);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
var roll2 = store.state.turn.rolledDice.slice();
assert('same seed same dice', JSON.stringify(roll1), JSON.stringify(roll2));

// ── ROLL_DICE — phase guard ──────────────────────────────────
group('ROLL_DICE — phase guard');
freshGame(100);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
if (store.state.turn.phase === 'selecting') {
    var diceBeforeDoubleRoll = store.state.turn.rolledDice.slice();
    store.dispatch('ROLL_DICE');
    assert('cannot roll during selecting', JSON.stringify(store.state.turn.rolledDice), JSON.stringify(diceBeforeDoubleRoll));
}

// ── SELECT / DESELECT ─────────────────────────────────────────
group('SELECT_DIE / DESELECT_DIE');
freshGame(42);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
t = store.state.turn;
if (t.phase === 'selecting') {
    store.dispatch('SELECT_DIE', { index: 0 });
    assert('selected 1 die', t.selectedIndices.length, 1);
    assert('selectedIndices[0] is 0', t.selectedIndices[0], 0);

    store.dispatch('SELECT_DIE', { index: 0 });
    assert('duplicate select ignored', t.selectedIndices.length, 1);

    store.dispatch('SELECT_DIE', { index: 1 });
    assert('selected 2 dice', t.selectedIndices.length, 2);

    store.dispatch('DESELECT_DIE', { index: 0 });
    assert('deselected → 1 die left', t.selectedIndices.length, 1);
    assert('remaining index is 1', t.selectedIndices[0], 1);

    store.dispatch('DESELECT_DIE', { index: 99 });
    assert('invalid deselect ignored', t.selectedIndices.length, 1);
}

// ── Selection validation ──────────────────────────────────────
group('Selection validation (live score preview)');
// Use a known seed where we can predict dice values
freshGame(7);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
t = store.state.turn;
if (t.phase === 'selecting') {
    // Find a single 1 or 5 in rolled dice
    var scoringIdx = -1;
    for (var i = 0; i < t.rolledDice.length; i++) {
        if (t.rolledDice[i] === 1 || t.rolledDice[i] === 5) { scoringIdx = i; break; }
    }
    if (scoringIdx >= 0) {
        store.dispatch('SELECT_DIE', { index: scoringIdx });
        var expectedScore = t.rolledDice[scoringIdx] === 1 ? 100 : 50;
        assert('single scoring die valid', t.selectionValid, true);
        assert('selection score correct', t.selectionScore, expectedScore);

        store.dispatch('DESELECT_DIE', { index: scoringIdx });
        assert('empty selection invalid', t.selectionValid, false);
        assert('empty selection score 0', t.selectionScore, 0);
    }
}

// ── SCORE_SELECTION ───────────────────────────────────────────
group('SCORE_SELECTION');
freshGame(7);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
t = store.state.turn;
if (t.phase === 'selecting') {
    var scoringIdx2 = -1;
    for (var i2 = 0; i2 < t.rolledDice.length; i2++) {
        if (t.rolledDice[i2] === 1 || t.rolledDice[i2] === 5) { scoringIdx2 = i2; break; }
    }
    if (scoringIdx2 >= 0) {
        var preScore = t.rolledDice[scoringIdx2] === 1 ? 100 : 50;
        store.dispatch('SELECT_DIE', { index: scoringIdx2 });
        store.dispatch('SCORE_SELECTION');

        assert('accumulated score updated', t.accumulatedScore, preScore);
        assert('held dice has 1 entry', t.heldDice.length, 1);
        assert('diceCount reduced to 5', t.diceCount, 5);
        assert('rolledDice reduced to 5', t.rolledDice.length, 5);
        assert('phase is decide', t.phase, 'decide');
        assert('selection cleared', t.selectedIndices.length, 0);
    }
}

// ── BANK ──────────────────────────────────────────────────────
group('BANK');
freshGame(7);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
t = store.state.turn;
if (t.phase === 'selecting') {
    var bankIdx = -1;
    for (var ib = 0; ib < t.rolledDice.length; ib++) {
        if (t.rolledDice[ib] === 1 || t.rolledDice[ib] === 5) { bankIdx = ib; break; }
    }
    if (bankIdx >= 0) {
        var bankExpected = t.rolledDice[bankIdx] === 1 ? 100 : 50;
        store.dispatch('SELECT_DIE', { index: bankIdx });
        store.dispatch('SCORE_SELECTION');
        store.dispatch('BANK');

        assert('lastBankedScore set', t.lastBankedScore, bankExpected);
        assert('accumulatedScore reset', t.accumulatedScore, 0);
        assert('heldDice cleared', t.heldDice.length, 0);
        assert('phase idle after bank', t.phase, 'idle');
        assert('diceCount reset to 6', t.diceCount, 6);
    }
}

// ── BANK phase guard ──────────────────────────────────────────
group('BANK — phase guard');
freshGame(7);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
t = store.state.turn;
if (t.phase === 'selecting') {
    store.dispatch('BANK');
    assert('cannot bank during selecting', t.phase, 'selecting');
}

// ── Continue rolling after score ──────────────────────────────
group('Continue rolling (decide → roll)');
freshGame(7);
store.dispatch('START_TURN');
store.dispatch('ROLL_DICE');
t = store.state.turn;
if (t.phase === 'selecting') {
    var contIdx = -1;
    for (var ic = 0; ic < t.rolledDice.length; ic++) {
        if (t.rolledDice[ic] === 1 || t.rolledDice[ic] === 5) { contIdx = ic; break; }
    }
    if (contIdx >= 0) {
        store.dispatch('SELECT_DIE', { index: contIdx });
        store.dispatch('SCORE_SELECTION');
        var scoreAfterFirst = t.accumulatedScore;
        assert('phase is decide', t.phase, 'decide');

        store.dispatch('ROLL_DICE');
        assert('rolled remaining dice', t.rolledDice.length, 5);
        assert('accumulated preserved across rolls', t.accumulatedScore >= scoreAfterFirst ||
               t.phase === 'bust', true);
    }
}

// ── BUST detection ────────────────────────────────────────────
group('BUST detection via ROLL_DICE');
// Brute-force find a seed that produces a bust on 1 die
var bustSeed = -1;
for (var s = 0; s < 10000; s++) {
    freshGame(s);
    store.dispatch('START_TURN');
    // Simulate: roll 1 die
    store.state.turn.phase = 'idle';
    store.state.turn.diceCount = 1;
    store.dispatch('ROLL_DICE');
    if (store.state.turn.phase === 'bust') {
        bustSeed = s;
        break;
    }
}
if (bustSeed >= 0) {
    freshGame(bustSeed);
    store.dispatch('START_TURN');
    store.state.turn.phase = 'idle';
    store.state.turn.diceCount = 1;
    store.dispatch('ROLL_DICE');
    t = store.state.turn;
    assert('bust detected (seed ' + bustSeed + ')', t.phase, 'bust');
    assert('accumulated cleared on bust', t.accumulatedScore, 0);
} else {
    console.log('    (!) Could not find bust seed in 10000 tries — skipping');
}

// ── Hot Hand ──────────────────────────────────────────────────
group('Hot Hand (all 6 scored → auto-bank)');
freshGame(1);
store.dispatch('START_TURN');
t = store.state.turn;
// Manually set up a scenario: 6 dice all scoring
t.rolledDice = [1, 1, 1, 5, 5, 5];
t.diceCount = 6;
t.phase = 'selecting';
t.heldDice = [];
t.accumulatedScore = 0;

// Select all 6
for (var ih = 0; ih < 6; ih++) {
    store.dispatch('SELECT_DIE', { index: ih });
}
assert('all 6 selected valid', t.selectionValid, true);
assert('selection score is 1500', t.selectionScore, 1500);

store.dispatch('SCORE_SELECTION');
assert('hotHandTriggered', t.hotHandTriggered, true);
assert('lastBankedScore is 1500', t.lastBankedScore, 1500);
assert('accumulatedScore reset after hot hand', t.accumulatedScore, 0);
assert('heldDice cleared', t.heldDice.length, 0);
assert('diceCount reset to 6', t.diceCount, 6);
assert('phase idle (ready for next roll)', t.phase, 'idle');

// ── Hot Hand across multiple scores ───────────────────────────
group('Hot Hand — multi-score (3 + 3 = 6 held)');
freshGame(1);
store.dispatch('START_TURN');
t = store.state.turn;
// First score: 3 dice
t.rolledDice = [1, 1, 1, 2, 3, 4];
t.diceCount = 6;
t.phase = 'selecting';
t.heldDice = [];
t.accumulatedScore = 0;
store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
store.dispatch('SCORE_SELECTION');
assert('first score: accumulated 1000', t.accumulatedScore, 1000);
assert('first score: held 3', t.heldDice.length, 3);
assert('first score: phase decide', t.phase, 'decide');

// Second score: remaining 3 dice (set up as all 5s)
t.rolledDice = [5, 5, 5];
t.diceCount = 3;
t.phase = 'selecting';
store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
store.dispatch('SELECT_DIE', { index: 2 });
store.dispatch('SCORE_SELECTION');
assert('hot hand after 3+3', t.hotHandTriggered, true);
assert('banked 1000+500=1500', t.lastBankedScore, 1500);
assert('accumulated reset', t.accumulatedScore, 0);
assert('held cleared', t.heldDice.length, 0);
assert('dice reset to 6', t.diceCount, 6);

// ── Accumulated score persists across continue rolls ──────────
group('Accumulated score across continue rolls');
freshGame(50);
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [1, 2, 3, 4, 6, 6];
t.diceCount = 6;
t.phase = 'selecting';
t.heldDice = [];
t.accumulatedScore = 0;

store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SCORE_SELECTION');
assert('accumulated after first score', t.accumulatedScore, 100);

t.rolledDice = [5, 3, 4, 6, 6];
t.diceCount = 5;
t.phase = 'selecting';
store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SCORE_SELECTION');
assert('accumulated after second score', t.accumulatedScore, 150);

// ── SCORE_SELECTION with invalid selection does nothing ────────
group('SCORE_SELECTION guards');
freshGame(1);
store.dispatch('START_TURN');
t = store.state.turn;
t.rolledDice = [2, 3, 4, 1, 6, 6];
t.diceCount = 6;
t.phase = 'selecting';
t.accumulatedScore = 0;

// Select non-scoring dice
store.dispatch('SELECT_DIE', { index: 0 });
store.dispatch('SELECT_DIE', { index: 1 });
assert('invalid selection', t.selectionValid, false);
store.dispatch('SCORE_SELECTION');
assert('score_selection did nothing', t.accumulatedScore, 0);
assert('phase still selecting', t.phase, 'selecting');

// ── Summary ───────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
var total = passed + failed;
if (failed === 0) {
    console.log('\x1b[32m  All ' + total + ' assertions passed.\x1b[0m\n');
} else {
    console.log('\x1b[31m  ' + failed + '/' + total + ' FAILED.\x1b[0m\n');
}

process.exit(failed > 0 ? 1 : 0);
