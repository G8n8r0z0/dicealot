// Scoring engine tests — runnable via: node tests/test-scoring.js
// Loads IIFE scripts via vm to simulate browser globals.

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

load('src/config/scoring.js');
load('src/systems/scoringSystem.js');

const sc = ctx.scoringSystem;
let passed = 0, failed = 0;

function group(name) { console.log('\n  ' + name); }

function assert(name, actual, expected) {
    if (actual === expected) {
        passed++;
        console.log('    \x1b[32m✓\x1b[0m ' + name);
    } else {
        failed++;
        console.log('    \x1b[31m✗\x1b[0m ' + name + ' — expected ' + expected + ', got ' + actual);
    }
}

function assertValid(name, result, expectedScore) {
    assert(name + ' (valid)', result.valid, true);
    assert(name + ' (score)', result.score, expectedScore);
}

function assertInvalid(name, result) {
    assert(name + ' (invalid)', result.valid, false);
}

console.log('\nScoring Engine — Test Suite\n');

// ── Singles ────────────────────────────────────────────────────
group('Singles');
assertValid('single 1', sc.scoreSelection([1]), 100);
assertValid('single 5', sc.scoreSelection([5]), 50);
assertInvalid('single 2', sc.scoreSelection([2]));
assertInvalid('single 3', sc.scoreSelection([3]));
assertInvalid('single 4', sc.scoreSelection([4]));
assertInvalid('single 6', sc.scoreSelection([6]));

// ── Three of a kind ───────────────────────────────────────────
group('Three of a kind');
assertValid('three 1s', sc.scoreSelection([1, 1, 1]), 1000);
assertValid('three 2s', sc.scoreSelection([2, 2, 2]), 200);
assertValid('three 3s', sc.scoreSelection([3, 3, 3]), 300);
assertValid('three 4s', sc.scoreSelection([4, 4, 4]), 400);
assertValid('three 5s', sc.scoreSelection([5, 5, 5]), 500);
assertValid('three 6s', sc.scoreSelection([6, 6, 6]), 600);

// ── Four of a kind (previous × 2) ────────────────────────────
group('Four of a kind');
assertValid('four 1s', sc.scoreSelection([1, 1, 1, 1]), 2000);
assertValid('four 2s', sc.scoreSelection([2, 2, 2, 2]), 400);
assertValid('four 3s', sc.scoreSelection([3, 3, 3, 3]), 600);
assertValid('four 4s', sc.scoreSelection([4, 4, 4, 4]), 800);
assertValid('four 5s', sc.scoreSelection([5, 5, 5, 5]), 1000);
assertValid('four 6s', sc.scoreSelection([6, 6, 6, 6]), 1200);

// ── Five of a kind (previous × 2) ────────────────────────────
group('Five of a kind');
assertValid('five 1s', sc.scoreSelection([1, 1, 1, 1, 1]), 4000);
assertValid('five 4s', sc.scoreSelection([4, 4, 4, 4, 4]), 1600);
assertValid('five 5s', sc.scoreSelection([5, 5, 5, 5, 5]), 2000);

// ── Six of a kind (previous × 2) ─────────────────────────────
group('Six of a kind');
assertValid('six 1s', sc.scoreSelection([1, 1, 1, 1, 1, 1]), 8000);
assertValid('six 4s', sc.scoreSelection([4, 4, 4, 4, 4, 4]), 3200);
assertValid('six 5s', sc.scoreSelection([5, 5, 5, 5, 5, 5]), 4000);
assertValid('six 6s', sc.scoreSelection([6, 6, 6, 6, 6, 6]), 4800);

// ── Straights ─────────────────────────────────────────────────
group('Straights');
assertValid('short straight 1-5', sc.scoreSelection([1, 2, 3, 4, 5]), 500);
assertValid('short straight 2-6', sc.scoreSelection([2, 3, 4, 5, 6]), 750);
assertValid('full straight', sc.scoreSelection([1, 2, 3, 4, 5, 6]), 1500);

// ── Mixed partitions ──────────────────────────────────────────
group('Mixed partitions (scoreSelection)');
assertValid('three 1s + single 5', sc.scoreSelection([1, 1, 1, 5]), 1050);
assertValid('short straight 1-5 + single 1', sc.scoreSelection([1, 1, 2, 3, 4, 5]), 600);
assertValid('short straight 1-5 + single 5', sc.scoreSelection([1, 2, 3, 4, 5, 5]), 550);
assertValid('three 1s + three 5s', sc.scoreSelection([1, 1, 1, 5, 5, 5]), 1500);
assertValid('three 2s + single 1 + single 5', sc.scoreSelection([2, 2, 2, 1, 5]), 350);
assertValid('two singles 1+5', sc.scoreSelection([1, 5]), 150);
assertValid('two 1s', sc.scoreSelection([1, 1]), 200);
assertValid('two 5s', sc.scoreSelection([5, 5]), 100);

// Full straight vs partition: full straight (1500) should beat 1+5 + leftover fail
assertValid('full straight beats split', sc.scoreSelection([1, 2, 3, 4, 5, 6]), 1500);

// ── Invalid selections ────────────────────────────────────────
group('Invalid selections');
assertInvalid('[2, 3]', sc.scoreSelection([2, 3]));
assertInvalid('[2, 2]', sc.scoreSelection([2, 2]));
assertInvalid('[4, 6]', sc.scoreSelection([4, 6]));
assertInvalid('[1, 1, 6] — 6 cannot be covered', sc.scoreSelection([1, 1, 6]));
assertInvalid('[2, 3, 4, 6]', sc.scoreSelection([2, 3, 4, 6]));

// ── Three pairs is NOT a combo ────────────────────────────────
group('Three pairs is NOT a valid combination');
assertInvalid('[2,2,4,4,6,6]', sc.scoreSelection([2, 2, 4, 4, 6, 6]));
assert('[2,2,4,4,6,6] is bust', sc.hasPlayableDice([2, 2, 4, 4, 6, 6]), false);

// ── Player selection (click-order) ────────────────────────────
group('Player selection — click-order');
assertValid('player [1]', sc.scorePlayerSelection([1]), 100);
assertValid('player [5]', sc.scorePlayerSelection([5]), 50);
assertValid('player [1, 5] singles packet', sc.scorePlayerSelection([1, 5]), 150);
assertValid('player [5, 1] singles packet', sc.scorePlayerSelection([5, 1]), 150);
assertValid('player [1, 1, 5] singles', sc.scorePlayerSelection([1, 1, 5]), 250);
assertValid('player [1, 1, 1] three-of-a-kind beats singles', sc.scorePlayerSelection([1, 1, 1]), 1000);
assertValid('player [5, 5, 5] three-of-a-kind', sc.scorePlayerSelection([5, 5, 5]), 500);

// Contiguous packet splitting
assertValid('player [1, 5, 5, 5] = 100 + 500', sc.scorePlayerSelection([1, 5, 5, 5]), 600);
assertValid('player [1,2,3,4,5,6] full straight', sc.scorePlayerSelection([1, 2, 3, 4, 5, 6]), 1500);
assertValid('player [3,1,4,2,5,6] reordered full straight', sc.scorePlayerSelection([3, 1, 4, 2, 5, 6]), 1500);

// Ambiguous: valid packets exist but full decomposition fails
var ambig = sc.scorePlayerSelection([1, 6, 5]);
assert('player [1, 6, 5] ambiguous (valid)', ambig.valid, false);
assert('player [1, 6, 5] ambiguous flag', ambig.ambiguous, true);

assertInvalid('player [2, 3, 4]', sc.scorePlayerSelection([2, 3, 4]));

// ── Bust detection ────────────────────────────────────────────
group('Bust detection (hasPlayableDice)');
assert('has playable [1, 2, 3]', sc.hasPlayableDice([1, 2, 3]), true);
assert('has playable [5, 6, 6]', sc.hasPlayableDice([5, 6, 6]), true);
assert('has playable [2, 2, 2]', sc.hasPlayableDice([2, 2, 2]), true);
assert('bust [2, 3, 4, 6]', sc.hasPlayableDice([2, 3, 4, 6]), false);
assert('bust [2, 3]', sc.hasPlayableDice([2, 3]), false);
assert('bust [6]', sc.hasPlayableDice([6]), false);
assert('bust [2, 4, 6]', sc.hasPlayableDice([2, 4, 6]), false);
assert('has playable [2, 3, 4, 5, 6]', sc.hasPlayableDice([2, 3, 4, 5, 6]), true);

// ── Summary ───────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
var total = passed + failed;
if (failed === 0) {
    console.log('\x1b[32m  All ' + total + ' assertions passed.\x1b[0m\n');
} else {
    console.log('\x1b[31m  ' + failed + '/' + total + ' FAILED.\x1b[0m\n');
}

process.exit(failed > 0 ? 1 : 0);
