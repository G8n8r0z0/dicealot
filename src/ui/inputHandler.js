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
    var _rerollPending = false

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

        if (_rerollPending) {
            _rerollPending = false
            _store.dispatch('ROLL_DICE')
            if (window.bridge3D) { lock(); return }
            return
        }

        if (t.phase !== 'idle') return

        _store.dispatch('ROLL_DICE')

        if (window.bridge3D) {
            lock()
            return
        }

        if (_store.state.turn.phase === 'bust') {
            lock()
            if (window.battleUI) {
                window.battleUI.logHistory('Player rolled: [' + _store.state.turn.rolledDice.join(', ') + ']')
                window.battleUI.logHistory('Player BUST!', '#e74c3c')
            }
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
        if (window.battleUI) window.battleUI.logHistory('HOT HAND!', '#ff9800')
        var banked = _store.state.turn.lastBankedScore
        if (banked > 0) {
            _store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: banked })
            if (window.battleUI) {
                window.battleUI.showDamage('enemy', banked)
                window.battleUI.logHistory('Player deals ' + banked + ' damage', '#efc14a')
            }
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

        var selVals = []
        for (var si = 0; si < t.selectedIndices.length; si++) selVals.push(t.rolledDice[t.selectedIndices[si]])
        var scored = t.selectionScore
        _store.dispatch('SCORE_SELECTION')

        if (window.battleUI) {
            window.battleUI.logHistory('Player selected: [' + selVals.join(', ') + ']', '#8eaadb')
            window.battleUI.logHistory('Player scored +' + scored, '#2ecc71')
            var healed = _store.state.turn.lastHealAmount
            if (healed > 0) {
                window.battleUI.showHeal(healed)
                window.battleUI.logHistory('Bandie heals +' + healed + ' HP', '#4ade80')
            }
        }

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

        var selVals = []
        for (var si = 0; si < t.selectedIndices.length; si++) selVals.push(t.rolledDice[t.selectedIndices[si]])
        var scored = t.selectionScore
        _store.dispatch('SCORE_SELECTION')

        if (window.battleUI) {
            window.battleUI.logHistory('Player selected: [' + selVals.join(', ') + ']', '#8eaadb')
            window.battleUI.logHistory('Player scored +' + scored, '#2ecc71')
            var healed2 = _store.state.turn.lastHealAmount
            if (healed2 > 0) {
                window.battleUI.showHeal(healed2)
                window.battleUI.logHistory('Bandie heals +' + healed2 + ' HP', '#4ade80')
            }
        }

        if (_store.state.turn.hotHandTriggered) {
            handleHotHand()
            return
        }

        _store.dispatch('BANK')
        var banked = _store.state.turn.lastBankedScore
        if (banked > 0) {
            _store.dispatch('DEAL_DAMAGE', { target: 'enemy', amount: banked })
            if (window.battleUI) {
                window.battleUI.showDamage('enemy', banked)
                window.battleUI.logHistory('Player deals ' + banked + ' damage', '#efc14a')
            }
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
        if (window.battleUI) {
            var c = m.winner === 'player' ? '#2ecc71' : '#e74c3c'
            window.battleUI.logHistory(m.winner === 'player' ? '--- VICTORY ---' : '--- DEFEAT ---', c)
        }
        showBanner(text, 'result', 3000)
    }

    // ── New Battle ─────────────────────────────────────────────
    function onNewBattle() {
        if (window.botSystem) window.botSystem.abort()
        if (window.battleUI) window.battleUI.clearHistory()
        _store.dispatch('START_BATTLE', { enemyHp: 3000, enemyName: 'Duelist', difficulty: 'advanced' })
        _store.dispatch('START_TURN')
        $('banner').classList.remove('show')
        unlock()
    }

    // ── Bust handler (called by diceBridge after 3D settle) ────
    function handleBust() {
        if (window.battleUI) window.battleUI.logHistory('Player BUST!', '#e74c3c')
        showBanner(S.BANNER_BUST, 'bust', 1500, function() {
            _store.dispatch('BUST')
            _store.dispatch('END_TURN')
            _store.dispatch('START_TURN')
            triggerBotIfNeeded()
        })
    }

    // ── Reroll (dice didn't settle on table) ─────────────────
    function showReroll() {
        lock()
        showBanner(S.BANNER_REROLL, 'reroll', 1200, function() {
            _rerollPending = true
            unlock()
            if (window.battleUI) window.battleUI.refresh()
        })
    }

    function isRerollPending() { return _rerollPending }

    function clearReroll() { _rerollPending = false }

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
        showBanner: showBanner,
        showReroll: showReroll,
        isRerollPending: isRerollPending,
        clearReroll: clearReroll
    }

})()
