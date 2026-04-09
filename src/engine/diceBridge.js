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
import * as engine from './diceEngine.js';
import { FACE_UP_QUATS } from './dieFactory.js';

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
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
//  ROLL_DICE → 3D throw
// ═══════════════════════════════════════════════════════════════════════════

function onRollDice() {
    _settled = false;

    if (_slingThrew) {
        _slingThrew = false;
        return;
    }

    engine.syncActiveDice(_ctx, _store.state.turn.diceCount);

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

function handleAllSettled(dice) {
    _settled = true;

    var values = [];
    for (var i = 0; i < dice.length; i++) {
        values.push(dice[i].value);
    }

    _store.dispatch('DICE_SETTLED', { values: values });

    var isBot = _store.state.match.activePlayer === 'enemy';
    if (isBot) {
        if (window.botSystem) window.botSystem.onSettled();
    } else if (_store.state.turn.phase === 'bust') {
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
    var sel  = _store.state.turn.selectedIndices;
    for (var i = 0; i < dice.length; i++) {
        engine.highlightDie(_ctx, dice[i], sel.indexOf(i) !== -1);
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
    for (var i = 0; i < _ctx.heldDice.length; i++) {
        var d = _ctx.heldDice[i];
        d.pips.dispose(); d.backing.dispose(); d.outer.dispose();
        d.root.dispose(); d.oMat.dispose();
    }
    _ctx.heldDice.length = 0;
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

    // ── Sling drag-to-throw (idle phase, player only) ──────────────────
    var isPlayerTurn = _store.state.match.activePlayer === 'player';
    if ((phase === 'idle' && isPlayerTurn) || _slingDrag) {
        if (info.type === BABYLON.PointerEventTypes.POINTERDOWN && ev.button === 0 && phase === 'idle' && isPlayerTurn) {
            var p = engine.pickRollXZ(_ctx, ev.clientX, ev.clientY);
            if (!p) return;

            engine.syncActiveDice(_ctx, _store.state.turn.diceCount);
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

            _slingThrew = true;
            _store.dispatch('ROLL_DICE');
            if (window.inputHandler) window.inputHandler.lock();
            engine.slingRelease(_ctx, aimX, aimZ, strength);
            return;
        }
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
//  DISPOSE
// ═══════════════════════════════════════════════════════════════════════════

export function dispose() {
    if (_ctx) engine.dispose(_ctx);
    _ctx   = null;
    _store = null;
}
