// Input handler — maps player clicks to store dispatches.
// Manages action sequences (bank→damage→new turn) and banner display.
// Depends on: window.STRINGS, window.store
// Loaded via <script> tag — exports to window.inputHandler.

;(function() {
    'use strict'

    var S = window.STRINGS
    var _store = null
    var _bannerTimer = null
    var _locked = false

    function $(id) { return document.getElementById(id) }

    // ── Banner (floating toast, opacity transition) ────────────
    function showBanner(text, cls, duration, callback) {
        var banner = $('banner')
        var label = $('bannerText')
        clearTimeout(_bannerTimer)
        label.textContent = text
        banner.className = 'banner ' + (cls || '')
        requestAnimationFrame(function() {
            banner.classList.add('show')
        })
        _bannerTimer = setTimeout(function() {
            banner.classList.remove('show')
            if (callback) setTimeout(callback, 300)
        }, duration || 1500)
    }

    function lock()   { _locked = true }
    function unlock() { _locked = false }

    function triggerBotIfNeeded() {
        if (_store.state.match.activePlayer === 'enemy' && _store.state.match.phase === 'battle') {
            lock()
            if (window.botSystem) window.botSystem.scheduleBotTurn(800)
        } else {
            unlock()
        }
    }

    // ── Roll ───────────────────────────────────────────────────
    function onRollClick() {
        if (_locked) return
        var t = _store.state.turn
        var m = _store.state.match
        if (m.phase === 'result') return
        if (m.activePlayer !== 'player') return
        if (t.phase !== 'idle') return

        _store.dispatch('ROLL_DICE')

        if (window.bridge3D) {
            lock()
            return
        }

        if (_store.state.turn.phase === 'bust') {
            lock()
            showBanner(S.BANNER_BUST, 'bust', 1500, function() {
                _store.dispatch('BUST')
                _store.dispatch('END_TURN')
                _store.dispatch('START_TURN')
                triggerBotIfNeeded()
            })
        }
    }

    // ── Die click (called from battleUI) ──────────────────────
    function onDieClick(index) {
        if (_locked) return
        var t = _store.state.turn
        var m = _store.state.match
        if (m.activePlayer !== 'player') return
        if (t.phase !== 'selecting') return

        if (t.selectedIndices.indexOf(index) !== -1) {
            _store.dispatch('DESELECT_DIE', { index: index })
        } else {
            _store.dispatch('SELECT_DIE', { index: index })
        }
    }

    // ── Hot Hand helper ─────────────────────────────────────────
    function handleHotHand() {
        var banked = _store.state.turn.lastBankedScore
        if (banked > 0) {
            _store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: banked })
        }
        if (_store.state.match.phase === 'result') {
            showResult()
            return true
        }
        lock()
        showBanner(S.BANNER_HOT_HAND, 'hot-hand', 1200, function() {
            unlock()
        })
        return true
    }

    // ── Score (lock selected dice) ──────────────────────────────
    function onScoreClick() {
        if (_locked) return
        var t = _store.state.turn
        if (_store.state.match.activePlayer !== 'player') return
        if (t.phase !== 'selecting' || !t.selectionValid) return

        _store.dispatch('SCORE_SELECTION')

        if (_store.state.turn.hotHandTriggered) {
            handleHotHand()
        }
    }

    // ── Bank (score selection → bank → damage → new turn) ─────
    function onBankClick() {
        if (_locked) return
        var t = _store.state.turn
        if (_store.state.match.activePlayer !== 'player') return
        if (t.phase !== 'selecting' || !t.selectionValid) return

        _store.dispatch('SCORE_SELECTION')

        if (_store.state.turn.hotHandTriggered) {
            handleHotHand()
            return
        }

        _store.dispatch('BANK')
        var banked = _store.state.turn.lastBankedScore
        if (banked > 0) {
            _store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: banked })
        }
        if (_store.state.match.phase === 'result') {
            showResult()
            return
        }
        lock()
        showBanner(S.BANNER_BANK, 'bank', 1000, function() {
            _store.dispatch('END_TURN')
            _store.dispatch('START_TURN')
            triggerBotIfNeeded()
        })
    }

    // ── Result ─────────────────────────────────────────────────
    function showResult() {
        var m = _store.state.match
        var text = m.winner === 'player' ? S.RESULT_WIN : S.RESULT_LOSE
        showBanner(text, 'result', 3000)
    }

    // ── New Battle ─────────────────────────────────────────────
    function onNewBattle() {
        if (window.botSystem) window.botSystem.abort()
        _store.dispatch('START_BATTLE', { enemyHp: 3000, enemyName: 'Duelist', difficulty: 'advanced' })
        _store.dispatch('START_TURN')
        $('banner').classList.remove('show')
        unlock()
    }

    // ── Bust handler (called by diceBridge after 3D settle) ────
    function handleBust() {
        showBanner(S.BANNER_BUST, 'bust', 1500, function() {
            _store.dispatch('BUST')
            _store.dispatch('END_TURN')
            _store.dispatch('START_TURN')
            triggerBotIfNeeded()
        })
    }

    // ── Public API ─────────────────────────────────────────────
    window.inputHandler = {
        bind: function(store) {
            _store = store
            $('btnRoll').addEventListener('click', onRollClick)
            $('btnScore').addEventListener('click', onScoreClick)
            $('btnBank').addEventListener('click', onBankClick)
            $('newBattleBtn').addEventListener('click', onNewBattle)
        },
        onDieClick: onDieClick,
        lock: lock,
        unlock: unlock,
        handleBust: handleBust,
        showBanner: showBanner
    }

})()
