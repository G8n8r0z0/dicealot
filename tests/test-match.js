// Match / combat system tests — runnable via: node tests/test-match.js

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
load('src/systems/playerSystem.js');
load('src/systems/enemySystem.js');
load('src/systems/matchSystem.js');

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
    ctx.playerSystem.init(store);
    ctx.enemySystem.init(store);
    ctx.matchSystem.init(store);
    ctx.turnSystem.init(store);
}

console.log('\nMatch / Combat System — Test Suite\n');

// ── Init ──────────────────────────────────────────────────────
group('Init');
freshGame(1);
assert('match phase is hub', store.state.match.phase, 'hub');
assert('activePlayer null', store.state.match.activePlayer, null);
assert('player hp is 3000', store.state.player.hp, 3000);
assert('enemy hp is 0', store.state.enemy.hp, 0);

// ── START_BATTLE ──────────────────────────────────────────────
group('START_BATTLE');
freshGame(1);
store.dispatch('START_BATTLE', { enemyHp: 5000, enemyName: 'Duelist', difficulty: 'skilled' });
assert('match phase battle', store.state.match.phase, 'battle');
assert('activePlayer is player', store.state.match.activePlayer, 'player');
assert('turnCount is 0', store.state.match.turnCount, 0);
assert('winner is null', store.state.match.winner, null);
assert('enemy hp set', store.state.enemy.hp, 5000);
assert('enemy maxHp set', store.state.enemy.maxHp, 5000);
assert('enemy name set', store.state.enemy.name, 'Duelist');
assert('enemy difficulty set', store.state.enemy.difficulty, 'skilled');
assert('player hp restored to max', store.state.player.hp, 3000);

// ── DEAL_DAMAGE to enemy ─────────────────────────────────────
group('DEAL_DAMAGE — enemy takes damage');
freshGame(1);
store.dispatch('START_BATTLE', { enemyHp: 3000 });
store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: 500 });
assert('enemy hp reduced', store.state.enemy.hp, 2500);
assert('phase still battle', store.state.match.phase, 'battle');
assert('no winner yet', store.state.match.winner, null);

// ── DEAL_DAMAGE to player ────────────────────────────────────
group('DEAL_DAMAGE — player takes damage');
freshGame(1);
store.dispatch('START_BATTLE', { enemyHp: 3000 });
store.dispatch('DEAL_DAMAGE', { target: 'player', amount: 800 });
assert('player hp reduced', store.state.player.hp, 2200);

// ── DEAL_DAMAGE — enemy killed ───────────────────────────────
group('DEAL_DAMAGE — enemy killed (player wins)');
freshGame(1);
store.dispatch('START_BATTLE', { enemyHp: 1000 });
store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: 1000 });
assert('enemy hp is 0', store.state.enemy.hp, 0);
assert('winner is player', store.state.match.winner, 'player');
assert('phase is result', store.state.match.phase, 'result');

// ── DEAL_DAMAGE — player killed ──────────────────────────────
group('DEAL_DAMAGE — player killed (enemy wins)');
freshGame(1);
store.dispatch('START_BATTLE', { enemyHp: 3000 });
store.dispatch('DEAL_DAMAGE', { target: 'player', amount: 3000 });
assert('player hp is 0', store.state.player.hp, 0);
assert('winner is enemy', store.state.match.winner, 'enemy');
assert('phase is result', store.state.match.phase, 'result');

// ── DEAL_DAMAGE — overkill clamped to 0 ──────────────────────
group('DEAL_DAMAGE — overkill');
freshGame(1);
store.dispatch('START_BATTLE', { enemyHp: 500 });
store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: 9999 });
assert('enemy hp clamped to 0', store.state.enemy.hp, 0);
assert('winner is player', store.state.match.winner, 'player');

// ── DEAL_DAMAGE — ignored outside battle ─────────────────────
group('DEAL_DAMAGE — phase guard');
freshGame(1);
store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: 500 });
assert('damage ignored in hub phase', store.state.enemy.hp, 0);

// ── END_TURN ──────────────────────────────────────────────────
group('END_TURN');
freshGame(1);
store.dispatch('START_BATTLE', { enemyHp: 3000 });
assert('active is player', store.state.match.activePlayer, 'player');
store.dispatch('END_TURN');
assert('active switched to enemy', store.state.match.activePlayer, 'enemy');
assert('turnCount incremented', store.state.match.turnCount, 1);
store.dispatch('END_TURN');
assert('active switched back to player', store.state.match.activePlayer, 'player');
assert('turnCount is 2', store.state.match.turnCount, 2);

// ── END_TURN — phase guard ───────────────────────────────────
group('END_TURN — phase guard');
freshGame(1);
store.dispatch('END_TURN');
assert('end_turn ignored in hub', store.state.match.turnCount, 0);

// ── Full battle sequence ──────────────────────────────────────
group('Full battle sequence');
freshGame(42);
store.dispatch('START_BATTLE', { enemyHp: 1500, enemyName: 'Test Bot', difficulty: 'novice' });
store.dispatch('START_TURN');

// Player turn: roll, select a 1, score, bank
store.dispatch('ROLL_DICE');
var t = store.state.turn;
if (t.phase === 'selecting') {
    var idx1 = -1;
    for (var i = 0; i < t.rolledDice.length; i++) {
        if (t.rolledDice[i] === 1) { idx1 = i; break; }
    }
    if (idx1 >= 0) {
        store.dispatch('SELECT_DIE', { index: idx1 });
        store.dispatch('SCORE_SELECTION');
        store.dispatch('BANK');
        var banked = t.lastBankedScore;
        store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: banked });
        assert('enemy took damage', store.state.enemy.hp, 1500 - banked);
        store.dispatch('END_TURN');
        assert('active is enemy after end_turn', store.state.match.activePlayer, 'enemy');
    }
}

// ── Damage does not fire after result ─────────────────────────
group('No damage after result');
freshGame(1);
store.dispatch('START_BATTLE', { enemyHp: 100 });
store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: 100 });
assert('match is result', store.state.match.phase, 'result');
store.dispatch('DEAL_DAMAGE', { target: 'player', amount: 9999 });
assert('player hp untouched after result', store.state.player.hp, 3000);

// ── Summary ───────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
var total = passed + failed;
if (failed === 0) {
    console.log('\x1b[32m  All ' + total + ' assertions passed.\x1b[0m\n');
} else {
    console.log('\x1b[31m  ' + failed + '/' + total + ' FAILED.\x1b[0m\n');
}

process.exit(failed > 0 ? 1 : 0);
