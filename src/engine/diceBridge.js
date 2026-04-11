/**
 * diceBridge.js — Store-driven bridge between game logic (IIFE) and 3D engine (ES module).
 *
 * Subscribes to window.store for state changes:
 *   ROLL_DICE        → 3D throw (button or sling)
 *   DICE_SETTLED     → (dispatched by this bridge after physics settle)
 *   SELECT/DESELECT  → highlight glow
 *   SCORE_SELECTION  → move dice to held zone
 *   START_TURN       → clear 3D scene
 *
 * Physics determines face values — no PRNG face correction.
 * Sling SVG visualization ported from battle.html.
 *
 * ES module. Depends on: window.BABYLON, ./diceEngine.js, ./dieFactory.js
 */
import * as CANNON from 'cannon-es';
import * as engine from './diceEngine.js?v=8';
import { createDiceVertexData, createPipsVertexData, createMarkTexture, readFaceValue, readFaceValueForced, teardownDie, FACE_UP_QUATS } from './dieFactory.js?v=8';

const BABYLON = window.BABYLON;

let _ctx          = null;
let _store        = null;
let _slingDrag    = null;
let _slingThrew   = false;
let _lastSelected = [];
let _settled      = false;

const SLING_VIZ = { halfAngle: 0.38, rInner: 12, rSpan: 292, segments: 4 };

// ═══════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════

export function init(canvas, store, opts) {
    opts = opts || {};
    _store = store;

    _ctx = engine.init(canvas, {
        tune:  opts.tune,
        table: opts.table,
        onAllSettled: handleAllSettled,
        onEdgeReroll: handleEdgeReroll,
    });

    _ctx.scene.onPointerObservable.add(handlePointer);

    store.subscribe(function(state, type) {
        switch (type) {
            case 'ROLL_DICE':
                onRollDice();
                break;
            case 'SELECT_DIE':
            case 'DESELECT_DIE':
                _lastSelected = state.turn.selectedIndices.slice();
                syncHighlights();
                break;
            case 'SCORE_SELECTION':
                onScoreSelection();
                break;
            case 'START_TURN':
                resetScene();
                break;
            case 'USE_ABILITY':
                if (state.turn.phase === 'jumping') {
                    onJump(state.turn.jumpingDie);
                }
                if (state.turn.phase === 'flipping') {
                    onFlip(state.turn.flippingDie);
                }
                if (state.turn.phase === 'flipTargeting') {
                    onFlipTargeting();
                }
                break;
            case 'FLIP_TARGET':
                if (state.turn.phase === 'flipping') {
                    onFlip(state.turn.flippingDie);
                }
                break;
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
//  LOADOUT → per-die config
// ═══════════════════════════════════════════════════════════════════════════

function buildDieConfigs(count) {
    var configs = [];
    var slots = _store.state.loadout ? _store.state.loadout.slots : [];
    for (var i = 0; i < count; i++) {
        var slotId = slots[i] || null;
        var def = slotId && window.DICE && window.DICE.roster[slotId]
            ? window.DICE.roster[slotId]
            : null;
        if (!def) { configs.push({}); continue; }
        var cfg = {};
        var v = def.visual || {};
        if (v.body && v.body !== 'white') cfg.bodyColor = v.body;
        if (v.pips && v.pips !== 'black') cfg.pipColor = v.pips;
        if (v.marks && Array.isArray(v.marks)) cfg.faceMarks = v.marks;
        if (v.specular != null) cfg.specular = v.specular;
        if (v.edgeR != null)    cfg.edgeR = v.edgeR;
        if (v.pipR != null)     cfg.pipR = v.pipR;
        if (v.pipShape)         cfg.pipShape = v.pipShape;
        if (v.pipColors)        cfg.pipColors = v.pipColors;
        if (v.notchD != null)   cfg.notchD = v.notchD;
        if (v.skipNotchFaces)   cfg.skipNotchFaces = v.skipNotchFaces;
        if (def.biasOffset) {
            if (def.biasFaces) {
                cfg.bias = { faces: def.biasFaces, magnitude: def.biasOffset };
            } else if (def.biasFace) {
                cfg.bias = { face: def.biasFace, magnitude: def.biasOffset };
            }
        }
        configs.push(cfg);
    }
    return configs;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ROLL_DICE → 3D throw
// ═══════════════════════════════════════════════════════════════════════════

function onRollDice() {
    _settled = false;
    stopBlinkLoops();

    if (_slingThrew) {
        _slingThrew = false;
        return;
    }

    var count = _store.state.turn.diceCount;
    engine.syncActiveDice(_ctx, count, buildDieConfigs(count));

    var isBot = _store.state.match.activePlayer === 'enemy';
    if (isBot) {
        engine.throwBot(_ctx);
    } else {
        engine.throwPlayer(_ctx);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SETTLE → read physics faces → dispatch DICE_SETTLED
// ═══════════════════════════════════════════════════════════════════════════

function startBlinkLoops(dice) {
    for (var i = 0; i < dice.length; i++) {
        if (dice[i].startBlinkLoop) dice[i].startBlinkLoop();
    }
}

function stopBlinkLoops() {
    var dice = engine.getDice(_ctx);
    for (var i = 0; i < dice.length; i++) {
        if (dice[i].stopBlinkLoop) dice[i].stopBlinkLoop();
    }
}

function handleAllSettled(dice) {
    _settled = true;

    startBlinkLoops(dice);

    var values = [];
    for (var i = 0; i < dice.length; i++) {
        values.push(dice[i].value);
    }

    console.log('[DICE_SETTLED] engine values:', values.join(', '));
    _store.dispatch('DICE_SETTLED', { values: values });

    var who = _store.state.match.activePlayer === 'enemy' ? 'Bot' : 'Player';
    if (window.battleUI) {
        window.battleUI.logHistory(who + ' rolled: [' + values.join(', ') + ']');
    }

    var isBot = _store.state.match.activePlayer === 'enemy';
    if (isBot) {
        if (window.botSystem) window.botSystem.onSettled();
    } else if (_store.state.turn.phase === 'bust') {
        if (window.inputHandler) window.inputHandler.handleBust();
    } else {
        if (window.inputHandler) window.inputHandler.unlock();
    }
}

function handleEdgeReroll() {
    console.log('[EDGE_REROLL] dice not settled on table — reroll needed');
    var isBot = _store.state.match.activePlayer === 'enemy';
    if (isBot) {
        setTimeout(function() { engine.throwBot(_ctx); }, 600);
    } else {
        if (window.inputHandler) window.inputHandler.showReroll();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  FROG JUMP — physical rethrow of a single die
// ═══════════════════════════════════════════════════════════════════════════

var _jumpRetries = 0;
var JUMP_MAX_RETRIES = 3;

function onJump(dieIndex) {
    var dice = engine.getDice(_ctx);
    if (dieIndex < 0 || dieIndex >= dice.length) return;
    var d = dice[dieIndex];

    _jumpRetries = 0;
    stopBlinkLoops();
    clearHighlights();
    applyJumpImpulse(d);
}

// ── Jump tuning ──────────────────────────────────────────────────────────
var JUMP = {
    upSpeed:     90,     // vertical velocity (units/s)
    upRandom:    15,     // ± random added to upSpeed (max ~105 → height ~18, ceiling at 28)
    hSpeed:      12,     // max horizontal drift (±)
    spin:        30,     // max angular velocity per axis (±)
    sleepDelay:  400     // ms before body can sleep again
};

function applyJumpImpulse(d) {
    d.settled = false;
    d.value = null;

    d.body.type = CANNON.Body.DYNAMIC;
    d.body.sleepState = 0;
    d.body.allowSleep = false;
    d.body.wakeUp();

    _ctx._allSettledFired = false;
    _ctx._settleFrames = 0;

    d.body.velocity.set(
        (Math.random() - 0.5) * JUMP.hSpeed,
        JUMP.upSpeed + Math.random() * JUMP.upRandom,
        (Math.random() - 0.5) * JUMP.hSpeed
    );
    d.body.angularVelocity.set(
        (Math.random() - 0.5) * JUMP.spin,
        (Math.random() - 0.5) * JUMP.spin,
        (Math.random() - 0.5) * JUMP.spin
    );

    setTimeout(function() {
        d.body.allowSleep = true;
    }, JUMP.sleepDelay);

    _ctx.onAllSettled = handleJumpSettled;
    _ctx.onEdgeReroll = handleJumpEdge;
    engine.startSettleTimer(_ctx);
}

function handleJumpSettled(dice) {
    _ctx.onAllSettled = handleAllSettled;
    _ctx.onEdgeReroll = handleEdgeReroll;

    var t = _store.state.turn;
    var idx = t.jumpingDie;
    if (idx < 0 || idx >= dice.length) return;

    var d = dice[idx];
    var val = d.value;
    if (val === null) val = readFaceValue(d.body);
    if (val === null) {
        handleJumpEdge(dice);
        return;
    }

    console.log('[JUMP_SETTLED] Frog landed on', val);
    startBlinkLoops(dice);
    _store.dispatch('JUMP_SETTLED', { value: val });

    if (_store.state.turn.phase === 'bust') {
        if (window.inputHandler) window.inputHandler.handleBust();
    } else {
        if (window.inputHandler) window.inputHandler.unlock();
    }
}

function handleJumpEdge(dice) {
    _jumpRetries++;
    var t = _store.state.turn;
    var idx = t.jumpingDie;
    if (idx < 0 || idx >= dice.length) return;

    if (_jumpRetries >= JUMP_MAX_RETRIES) {
        console.log('[JUMP] max retries — force settling');
        _ctx.onAllSettled = handleAllSettled;
        _ctx.onEdgeReroll = handleEdgeReroll;
        var d = dice[idx];
        var val = readFaceValueForced(d.body);
        d.value = val;
        d.settled = true;
        startBlinkLoops(dice);
        _store.dispatch('JUMP_SETTLED', { value: val });
        if (_store.state.turn.phase === 'bust') {
            if (window.inputHandler) window.inputHandler.handleBust();
        } else {
            if (window.inputHandler) window.inputHandler.unlock();
        }
        return;
    }

    console.log('[JUMP] die stuck, retry', _jumpRetries);
    applyJumpImpulse(dice[idx]);
}

// ═══════════════════════════════════════════════════════════════════════════
//  FLIPPER FLIP — deterministic opposite-face flip
// ═══════════════════════════════════════════════════════════════════════════

var OPPOSITE = { 1:6, 6:1, 2:5, 5:2, 3:4, 4:3 };
var _flipCandidates = [];

var FLIP = {
    upSpeed:    55,
    upRandom:   10,
    hSpeed:     4,
    spinSlow:   6,
    slerpDur:   400,
    blue: null
};

function getFlipBlue() {
    if (!FLIP.blue) FLIP.blue = new BABYLON.Color3(0.15, 0.55, 0.95);
    return FLIP.blue;
}

function onFlipTargeting() {
    var dice = engine.getDice(_ctx);
    var t    = _store.state.turn;
    var flipperIdx = t.flipperIndex;
    var level = 1;

    clearHighlights();
    stopBlinkLoops();
    _flipCandidates = [];

    if (level >= 3) {
        for (var i = 0; i < dice.length; i++) _flipCandidates.push(i);
    } else {
        _flipCandidates.push(flipperIdx);
        var nearIdx = -1, nearDist = Infinity;
        var fp = dice[flipperIdx].body.position;
        for (var j = 0; j < dice.length; j++) {
            if (j === flipperIdx) continue;
            var dp = dice[j].body.position;
            var dx = dp.x - fp.x, dz = dp.z - fp.z;
            var dist = dx * dx + dz * dz;
            if (dist < nearDist) { nearDist = dist; nearIdx = j; }
        }
        if (nearIdx !== -1) _flipCandidates.push(nearIdx);
    }

    var blue = getFlipBlue();
    for (var k = 0; k < _flipCandidates.length; k++) {
        engine.highlightDie(_ctx, dice[_flipCandidates[k]], true, blue);
    }
}

function onFlip(dieIndex) {
    var dice = engine.getDice(_ctx);
    if (dieIndex < 0 || dieIndex >= dice.length) return;
    var d = dice[dieIndex];

    var currentValue = readFaceValue(d.body);
    if (currentValue === null) currentValue = readFaceValueForced(d.body);
    var targetValue = OPPOSITE[currentValue] || 6;

    stopBlinkLoops();
    clearHighlights();
    _flipCandidates = [];

    startFlipAnimation(d, dieIndex, targetValue);
}

function startFlipAnimation(d, dieIndex, targetValue) {
    d.settled = false;
    d.value = null;

    d.body.type = CANNON.Body.DYNAMIC;
    d.body.sleepState = 0;
    d.body.allowSleep = false;
    d.body.wakeUp();

    _ctx._allSettledFired = true;
    _ctx._settleFrames = 0;

    d.body.velocity.set(
        (Math.random() - 0.5) * FLIP.hSpeed,
        FLIP.upSpeed + Math.random() * FLIP.upRandom,
        (Math.random() - 0.5) * FLIP.hSpeed
    );
    d.body.angularVelocity.set(
        (Math.random() - 0.5) * FLIP.spinSlow,
        (Math.random() - 0.5) * FLIP.spinSlow,
        (Math.random() - 0.5) * FLIP.spinSlow
    );

    var targetQuat = FACE_UP_QUATS[targetValue] || BABYLON.Quaternion.Identity();
    var tableY = _ctx.td.floorY + engine.getDieEdge(_ctx) * 0.5;

    function monitorApex() {
        if (d.body.velocity.y > 0) {
            requestAnimationFrame(monitorApex);
            return;
        }

        var posX = d.body.position.x;
        var posZ = d.body.position.z;
        var posY = d.body.position.y;

        d.body.type = CANNON.Body.STATIC;
        d.body.velocity.set(0, 0, 0);
        d.body.angularVelocity.set(0, 0, 0);

        var startQuat = d.root.rotationQuaternion.clone();
        var startY = posY;
        var startTime = performance.now();

        function animateSlerp() {
            var elapsed = performance.now() - startTime;
            var progress = Math.min(1, elapsed / FLIP.slerpDur);
            var ease = 1 - (1 - progress) * (1 - progress);

            BABYLON.Quaternion.SlerpToRef(startQuat, targetQuat, ease, d.root.rotationQuaternion);
            d.root.position.y = startY + (tableY - startY) * ease;

            d.body.quaternion.set(
                d.root.rotationQuaternion.x,
                d.root.rotationQuaternion.y,
                d.root.rotationQuaternion.z,
                d.root.rotationQuaternion.w
            );
            d.body.position.set(posX, d.root.position.y, posZ);

            if (progress < 1) {
                requestAnimationFrame(animateSlerp);
                return;
            }

            d.body.position.set(posX, tableY, posZ);
            d.root.position.y = tableY;
            d.body.type = CANNON.Body.DYNAMIC;
            d.body.velocity.set(0, 0, 0);
            d.body.angularVelocity.set(0, 0, 0);
            d.body.allowSleep = false;

            d.value = targetValue;
            d.settled = true;

            handleFlipSettled(dieIndex, targetValue);
        }

        requestAnimationFrame(animateSlerp);
    }

    requestAnimationFrame(monitorApex);
}

function handleFlipSettled(dieIndex, targetValue) {
    var dice = engine.getDice(_ctx);
    startBlinkLoops(dice);

    console.log('[FLIP_SETTLED] Flipper flipped die', dieIndex, 'to', targetValue);
    _store.dispatch('FLIP_SETTLED', { dieIndex: dieIndex, value: targetValue });

    if (_store.state.turn.phase === 'bust') {
        if (window.inputHandler) window.inputHandler.handleBust();
    } else {
        if (window.inputHandler) window.inputHandler.unlock();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SELECTION highlights
// ═══════════════════════════════════════════════════════════════════════════

function syncHighlights() {
    var dice = engine.getDice(_ctx);
    var t    = _store.state.turn;
    var sel  = t.selectedIndices;
    var invalid = sel.length >= 2 && !t.selectionValid;
    var color = invalid
        ? new BABYLON.Color3(0.9, 0.1, 0.1)
        : new BABYLON.Color3(0.1, 0.9, 0.15);
    for (var i = 0; i < dice.length; i++) {
        engine.highlightDie(_ctx, dice[i], sel.indexOf(i) !== -1, color);
    }
}

function clearHighlights() {
    var dice = engine.getDice(_ctx);
    for (var i = 0; i < dice.length; i++) {
        engine.highlightDie(_ctx, dice[i], false);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCORE_SELECTION → move to held zone
// ═══════════════════════════════════════════════════════════════════════════

function onScoreSelection() {
    var state = _store.state.turn;

    if (state.hotHandTriggered) {
        clearHighlights();
        disposeHeldDice();
        engine.clearSettleTimer(_ctx);
        engine.syncActiveDice(_ctx, 0);
        _lastSelected = [];
        _settled = false;
        return;
    }

    if (_lastSelected.length === 0) return;

    var dice   = engine.getDice(_ctx);
    var toMove = [];
    for (var i = 0; i < _lastSelected.length; i++) {
        if (dice[_lastSelected[i]]) toMove.push(dice[_lastSelected[i]]);
    }

    var de     = engine.getDieEdge(_ctx);
    var gap    = de * 1.12;
    var cols   = 3;
    var baseY  = _ctx.td.floorY + de * 0.5;
    var isBot  = _store.state.match.activePlayer === 'enemy';
    var baseZ  = isBot
        ? _ctx.tbl.botDividerZ + _ctx.td.shelfD / 2
        : _ctx.tbl.dividerZ - _ctx.td.shelfD / 2;
    var zDir   = isBot ? 1 : -1;
    var heldN  = _ctx.heldDice.length;

    for (var k = 0; k < toMove.length; k++) {
        var slot = heldN + k;
        var col  = slot % cols;
        var row  = Math.floor(slot / cols);
        var tx   = (col - (cols - 1) / 2) * gap;
        var tz   = baseZ + zDir * row * gap;
        engine.highlightDie(_ctx, toMove[k], false);
        engine.moveToHeld(_ctx, toMove[k], tx, baseY, tz, toMove[k].value);
    }

    _lastSelected = [];
    clearHighlights();
    _settled = false;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCENE RESET (on START_TURN)
// ═══════════════════════════════════════════════════════════════════════════

function resetScene() {
    _settled      = false;
    _lastSelected = [];
    _slingThrew   = false;
    _slingDrag    = null;

    clearHighlights();
    engine.clearSettleTimer(_ctx);
    engine.syncActiveDice(_ctx, 0);
    disposeHeldDice();
    hideSlingViz();
}

function disposeHeldDice() {
    while (_ctx.heldDice.length) {
        teardownDie(_ctx.heldDice.pop(), _ctx);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SLING SVG VISUALIZATION
// ═══════════════════════════════════════════════════════════════════════════

function $(id) { return document.getElementById(id); }

function hideSlingViz() {
    var svg = $('slingVizSvg');
    if (svg) svg.style.visibility = 'hidden';
    var pow = $('slingVizPow');
    if (pow) pow.style.display = 'none';
    for (var k = 0; k < SLING_VIZ.segments; k++) {
        var seg = $('slingSeg' + k);
        if (seg) seg.setAttribute('d', '');
    }
}

function slingWedgePath(ax, ay, theta, beta, rIn, rOut) {
    var cl = Math.cos(theta - beta), sl = Math.sin(theta - beta);
    var cr = Math.cos(theta + beta), sr = Math.sin(theta + beta);
    return 'M ' + (ax + rIn * cl) + ' ' + (ay + rIn * sl) +
           ' L ' + (ax + rIn * cr) + ' ' + (ay + rIn * sr) +
           ' L ' + (ax + rOut * cr) + ' ' + (ay + rOut * sr) +
           ' L ' + (ax + rOut * cl) + ' ' + (ay + rOut * sl) + ' Z';
}

function slingStrengthLinear(pullLenWorld) {
    return Math.max(0, Math.min(1, pullLenWorld / _ctx.tune.sling.maxPullWorld));
}

function updateSlingViz(clientX, clientY) {
    var svg = $('slingVizSvg');
    var anchor = $('slingVizAnchor');
    var pow = $('slingVizPow');
    if (!_slingDrag || !svg || !anchor) return;

    var sx0 = _slingDrag.start.x, sz0 = _slingDrag.start.z;
    var piv = engine.rollXZToClient(_ctx, sx0, sz0);
    var ax = piv.clientX, ay = piv.clientY;

    var pick = engine.pickRollXZ(_ctx, clientX, clientY);
    var pullLenW = pick ? Math.hypot(pick.x - sx0, pick.z - sz0) : 0;
    var strength = slingStrengthLinear(pullLenW);

    var minDraw = 14;
    var x2, y2;
    if (pick) {
        var tp = engine.rollXZToClient(_ctx, pick.x, pick.z);
        x2 = tp.clientX; y2 = tp.clientY;
        var sdist = Math.hypot(x2 - ax, y2 - ay);
        if (sdist < minDraw) {
            var wpx = pick.x - sx0, wpz = pick.z - sz0;
            var wl = Math.hypot(wpx, wpz);
            if (wl < 1e-5) { x2 = ax; y2 = ay - minDraw; }
            else {
                var ux = wpx / wl, uz = wpz / wl;
                var e = 0.28;
                var pA = engine.rollXZToClient(_ctx, sx0 + ux * e, sz0 + uz * e);
                var pB = engine.rollXZToClient(_ctx, sx0 - ux * e, sz0 - uz * e);
                var sdx = pA.clientX - pB.clientX, sdy = pA.clientY - pB.clientY;
                var sl = Math.hypot(sdx, sdy) || 1;
                x2 = ax + (sdx / sl) * minDraw;
                y2 = ay + (sdy / sl) * minDraw;
            }
        }
    } else {
        x2 = ax; y2 = ay - minDraw;
    }

    anchor.setAttribute('cx', String(ax));
    anchor.setAttribute('cy', String(ay));

    var stretchLen = Math.hypot(x2 - ax, y2 - ay);
    var ux2 = (x2 - ax) / Math.max(stretchLen, 1e-6);
    var uy2 = (y2 - ay) / Math.max(stretchLen, 1e-6);
    var theta = Math.atan2(uy2, ux2);
    var vz = SLING_VIZ;
    var beta = vz.halfAngle;
    var R_eff = vz.rInner + strength * vz.rSpan;
    var quarter = vz.rSpan / vz.segments;

    for (var k = 0; k < vz.segments; k++) {
        var seg = $('slingSeg' + k);
        if (!seg) continue;
        var rStart = vz.rInner + k * quarter;
        if (R_eff <= rStart + 0.25) { seg.setAttribute('d', ''); continue; }
        var rEnd = Math.min(R_eff, vz.rInner + (k + 1) * quarter);
        seg.setAttribute('d', slingWedgePath(ax, ay, theta, beta, rStart, rEnd));
    }

    svg.style.visibility = 'visible';
    if (pow && pullLenW > engine.getSlingClickEpsWorld(_ctx)) {
        var pct = Math.max(1, Math.min(100, Math.round(strength * 100)));
        pow.textContent = pct + '%';
        var midR = vz.rInner + (R_eff - vz.rInner) * 0.52;
        pow.setAttribute('x', String(ax + midR * Math.cos(theta)));
        pow.setAttribute('y', String(ay + midR * Math.sin(theta) - 10));
        pow.style.display = 'block';
    } else if (pow) {
        pow.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  POINTER (sling + 3D die selection)
// ═══════════════════════════════════════════════════════════════════════════

function handlePointer(info) {
    var ev = info.event;
    if (!_store) return;
    var phase = _store.state.turn.phase;

    // ── Sling drag-to-throw (idle phase or reroll, player only) ────────
    var isPlayerTurn = _store.state.match.activePlayer === 'player';
    var rerollReady = window.inputHandler && window.inputHandler.isRerollPending();
    var canStartSling = (phase === 'idle' || rerollReady) && isPlayerTurn;
    if (canStartSling || _slingDrag) {
        if (info.type === BABYLON.PointerEventTypes.POINTERDOWN && ev.button === 0 && canStartSling) {
            var p = engine.pickRollXZ(_ctx, ev.clientX, ev.clientY);
            if (!p) return;

            var sCount = _store.state.turn.diceCount;
            engine.syncActiveDice(_ctx, sCount, buildDieConfigs(sCount));
            var dice = engine.getDice(_ctx);
            for (var i = 0; i < dice.length; i++) delete dice[i]._slingPose;

            _slingDrag = { start: { x: p.x, z: p.z }, pointerId: ev.pointerId };
            engine.slingCluster(_ctx, p.x, p.z, p.x, p.z);
            updateSlingViz(ev.clientX, ev.clientY);
            try { _ctx.canvas.setPointerCapture(ev.pointerId); } catch (_) {}
            return;
        }

        if (_slingDrag && info.type === BABYLON.PointerEventTypes.POINTERMOVE) {
            if (ev.pointerType !== 'touch' && !(ev.buttons & 1)) return;
            var pm = engine.pickRollXZ(_ctx, ev.clientX, ev.clientY);
            if (pm) engine.slingCluster(_ctx, _slingDrag.start.x, _slingDrag.start.z, pm.x, pm.z);
            updateSlingViz(ev.clientX, ev.clientY);
            return;
        }

        if (_slingDrag && info.type === BABYLON.PointerEventTypes.POINTERUP && ev.button === 0) {
            var start = _slingDrag.start;
            _slingDrag = null;
            hideSlingViz();
            try { _ctx.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}

            var end     = engine.pickRollXZ(_ctx, ev.clientX, ev.clientY) || start;
            var pullX   = end.x - start.x, pullZ = end.z - start.z;
            var pullLen = Math.hypot(pullX, pullZ);

            if (pullLen <= engine.getSlingClickEpsWorld(_ctx)) {
                engine.slingCancel(_ctx);
                engine.syncActiveDice(_ctx, 0);
                return;
            }

            var aimX     = -pullX / pullLen;
            var aimZ     = -pullZ / pullLen;
            var strength = engine.slingStrength(_ctx, pullLen);

            if (window.inputHandler && window.inputHandler.isRerollPending()) {
                window.inputHandler.clearReroll();
            }
            _slingThrew = true;
            _store.dispatch('ROLL_DICE');
            if (window.inputHandler) window.inputHandler.lock();
            engine.slingRelease(_ctx, aimX, aimZ, strength);
            return;
        }
    }

    // ── Flip targeting click (flipTargeting phase) ────────────────────────
    if (phase === 'flipTargeting' && isPlayerTurn) {
        if (info.type === BABYLON.PointerEventTypes.POINTERUP && ev.button === 0) {
            var tDie = engine.findDieAtPick(_ctx, info.pickInfo);
            if (!tDie) return;
            var tDiceArr = engine.getDice(_ctx);
            var tIdx = tDiceArr.indexOf(tDie);
            if (tIdx === -1) return;
            if (_flipCandidates.indexOf(tIdx) === -1) return;
            _store.dispatch('FLIP_TARGET', { targetIndex: tIdx });
        }
        return;
    }

    // ── 3D die click (selecting phase, player only, after settle) ────────
    if (phase === 'selecting' && _settled && isPlayerTurn) {
        if (info.type === BABYLON.PointerEventTypes.POINTERUP && ev.button === 0) {
            var die  = engine.findDieAtPick(_ctx, info.pickInfo);
            if (!die) return;
            var diceArr = engine.getDice(_ctx);
            var idx  = diceArr.indexOf(die);
            if (idx === -1) return;

            if (_store.state.turn.selectedIndices.indexOf(idx) !== -1) {
                _store.dispatch('DESELECT_DIE', { index: idx });
            } else {
                _store.dispatch('SELECT_DIE', { index: idx });
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SLOT PREVIEW — mini BabylonJS scene for loadout die preview
// ═══════════════════════════════════════════════════════════════════════════

export function renderSlotPreview(canvasEl, faceValue, opts) {
    opts = opts || {};

    var pEng = new BABYLON.Engine(canvasEl, true, { alpha: true }, true);
    var scene = new BABYLON.Scene(pEng);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

    // ── Camera (orbit locked until settle) ───────────────────────────────
    var cam = new BABYLON.ArcRotateCamera('pcam', -0.75, 0.85, 4.0,
        new BABYLON.Vector3(0, 0.5, 0), scene);
    cam.lowerRadiusLimit = 2.4;
    cam.upperRadiusLimit = 6.0;
    cam.wheelPrecision   = 60;
    cam.panningSensibility = 0;

    // ── Lights ────────────────────────────────────────────────────────────
    new BABYLON.HemisphericLight('phemi', new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.85;
    var dir = new BABYLON.DirectionalLight('pdir', new BABYLON.Vector3(-0.4, -1, 0.3), scene);
    dir.intensity = 0.65;

    // ── Floor visual (subtle dark disc) ──────────────────────────────────
    var floor = BABYLON.MeshBuilder.CreateDisc('pfloor', { radius: 2.5, tessellation: 48 }, scene);
    floor.rotation.x = Math.PI / 2;
    var floorMat = new BABYLON.StandardMaterial('pfmat', scene);
    floorMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.14);
    floorMat.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
    floorMat.backFaceCulling = false;
    floor.material = floorMat;

    // ── Die visual config from roster ────────────────────────────────────
    var dieDef = opts.dieId && window.DICE && window.DICE.roster[opts.dieId]
        ? window.DICE.roster[opts.dieId] : null;
    var vis = dieDef ? dieDef.visual || {} : {};
    var bodyHex = (vis.body && vis.body !== 'white') ? vis.body : '#f4f2ef';
    var pipHex  = (vis.pips && vis.pips !== 'black') ? vis.pips : '#141414';
    var spec    = vis.specular != null ? vis.specular : 0.18;

    // ── Geometry ──────────────────────────────────────────────────────────
    var outerVD = createDiceVertexData(
        vis.edgeR != null ? vis.edgeR : undefined,
        undefined,
        vis.notchD != null ? vis.notchD : undefined,
        undefined,
        vis.skipNotchFaces || null
    );

    var oMat = new BABYLON.StandardMaterial('po', scene);
    oMat.diffuseColor  = BABYLON.Color3.FromHexString(bodyHex);
    oMat.specularColor = new BABYLON.Color3(spec, spec, spec);

    function _prevPipMat(name, hex) {
        var m = new BABYLON.StandardMaterial(name, scene);
        m.disableLighting = true;
        m.emissiveColor = BABYLON.Color3.FromHexString(hex);
        m.diffuseColor  = BABYLON.Color3.Black();
        m.specularColor = BABYLON.Color3.Black();
        m.zOffset = -2;
        return m;
    }

    var backMat = new BABYLON.StandardMaterial('pback', scene);
    backMat.diffuseColor = new BABYLON.Color3(0.06, 0.06, 0.06);

    var root = new BABYLON.TransformNode('proot', scene);
    root.rotationQuaternion = BABYLON.Quaternion.Identity();

    var outer = new BABYLON.Mesh('pouter', scene);
    outerVD.applyToMesh(outer);
    outer.material = oMat;
    outer.parent = root;

    if (vis.pipColors && typeof vis.pipColors === 'object') {
        var allFaces = [1,2,3,4,5,6];
        var defHex = vis.pipColors.default || pipHex;
        var grp = {};
        for (var fi2 = 0; fi2 < allFaces.length; fi2++) {
            var fv2 = allFaces[fi2];
            var h = vis.pipColors[fv2] || defHex;
            if (!grp[h]) grp[h] = [];
            grp[h].push(fv2);
        }
        var gKeys = Object.keys(grp);
        for (var gi = 0; gi < gKeys.length; gi++) {
            var gHex = gKeys[gi];
            var gFaces = grp[gHex];
            var gVD = createPipsVertexData(vis.pipR != null ? vis.pipR : undefined, undefined, vis.pipShape || 'circle', gFaces);
            var gMesh = new BABYLON.Mesh('ppips_' + gi, scene);
            gVD.applyToMesh(gMesh);
            gMesh.material = _prevPipMat('ppip_' + gi, gHex);
            gMesh.parent = root;
        }
    } else {
        var pipsVD = createPipsVertexData(vis.pipR != null ? vis.pipR : undefined, undefined, vis.pipShape || 'circle');
        var pipMat = new BABYLON.StandardMaterial('ppip', scene);
        if (vis.pips && vis.pips !== 'black') {
            pipMat.disableLighting = true;
            pipMat.emissiveColor = BABYLON.Color3.FromHexString(pipHex);
            pipMat.diffuseColor  = BABYLON.Color3.Black();
            pipMat.specularColor = BABYLON.Color3.Black();
        } else {
            pipMat.diffuseColor = BABYLON.Color3.FromHexString(pipHex);
        }
        var pips = new BABYLON.Mesh('ppips', scene);
        pipsVD.applyToMesh(pips);
        pips.material = pipMat;
        pips.parent = root;
    }

    var prevEdgeR = vis.edgeR != null ? vis.edgeR : 0.13;
    var prevCornerR = (0.5 - prevEdgeR) + prevEdgeR / Math.sqrt(3);
    var prevBackSize = Math.max(0.3, 2 * prevCornerR - 0.03);
    var backing = BABYLON.MeshBuilder.CreateBox('pback', { size: prevBackSize }, scene);
    backing.material = backMat;
    backing.parent = root;

    // ── Face mark overlays (heart, etc.) ──────────────────────────────────
    if (vis.marks && Array.isArray(vis.marks)) {
        var FACE_LOCALS = [
            { x:  0, y:  1, z:  0, val: 1 },
            { x:  0, y: -1, z:  0, val: 6 },
            { x:  1, y:  0, z:  0, val: 2 },
            { x: -1, y:  0, z:  0, val: 5 },
            { x:  0, y:  0, z:  1, val: 3 },
            { x:  0, y:  0, z: -1, val: 4 },
        ];
        for (var mi = 0; mi < vis.marks.length; mi++) {
            var mark = vis.marks[mi];
            var fl = null;
            for (var fi = 0; fi < FACE_LOCALS.length; fi++) {
                if (FACE_LOCALS[fi].val === mark.face) { fl = FACE_LOCALS[fi]; break; }
            }
            if (!fl) continue;
            var plane = BABYLON.MeshBuilder.CreatePlane('pmark' + mi,
              { size: 0.65, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
            var mMat = new BABYLON.StandardMaterial('pmarkMat' + mi, scene);
            var tex = createMarkTexture(mark, 'pmarkTex' + mi, scene);
            if (!tex) continue;
            mMat.diffuseTexture = tex;
            mMat.diffuseTexture.hasAlpha = true;
            mMat.useAlphaFromDiffuseTexture = true;
            mMat.specularColor = oMat.specularColor.clone();
            mMat.zOffset = -4;
            plane.material = mMat;
            plane.parent = root;
            var off = 0.505;
            plane.position.set(fl.x * off, fl.y * off, fl.z * off);
            if (fl.y !== 0) {
                plane.rotation.x = fl.y > 0 ? -Math.PI / 2 : Math.PI / 2;
            } else if (fl.x !== 0) {
                plane.rotation.y = fl.x > 0 ? Math.PI / 2 : -Math.PI / 2;
            } else {
                plane.rotation.y = fl.z > 0 ? 0 : Math.PI;
            }
        }
    }

    // ── Physics world ────────────────────────────────────────────────────
    var world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
    world.allowSleep = true;

    var floorBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: new CANNON.Material({ friction: 0.4, restitution: 0.3 })
    });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floorBody);

    var hs = 0.48;
    var dieBody = new CANNON.Body({
        mass: 2.0,
        shape: new CANNON.Box(new CANNON.Vec3(hs, hs, hs)),
        material: new CANNON.Material({ friction: 0.35, restitution: 0.25 }),
        sleepTimeLimit: 0.4,
        sleepSpeedLimit: 0.15,
        linearDamping: 0.15,
        angularDamping: 0.2,
    });
    dieBody.position.set(0, 4.0, 0);
    var rx = (Math.random() - 0.5) * 3;
    var ry = (Math.random() - 0.5) * 3;
    var rz = (Math.random() - 0.5) * 3;
    dieBody.quaternion.setFromEuler(rx, ry, rz);
    dieBody.angularVelocity.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6
    );
    world.addBody(dieBody);

    // ── Settle detection ─────────────────────────────────────────────────
    var settled = false;

    dieBody.addEventListener('sleep', function() {
        if (settled) return;
        settled = true;
        cam.attachControl(canvasEl, true);
        if (opts.onSettle) opts.onSettle();
    });

    // ── Render loop ──────────────────────────────────────────────────────
    pEng.runRenderLoop(function() {
        if (!settled) {
            world.fixedStep();
            root.position.set(dieBody.position.x, dieBody.position.y, dieBody.position.z);
            root.rotationQuaternion.set(
                dieBody.quaternion.x, dieBody.quaternion.y,
                dieBody.quaternion.z, dieBody.quaternion.w
            );
        }
        scene.render();
    });

    return {
        dispose: function() {
            cam.detachControl();
            pEng.stopRenderLoop();
            scene.dispose();
            pEng.dispose();
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
//  DISPOSE
// ═══════════════════════════════════════════════════════════════════════════

export function dispose() {
    if (_ctx) engine.dispose(_ctx);
    _ctx   = null;
    _store = null;
}
