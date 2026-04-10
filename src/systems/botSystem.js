// Bot AI — async turn loop with 3 difficulty levels.
// Depends on: window.store, window.scoringSystem, window.inputHandler
// Loaded via <script> tag — exports to window.botSystem.

;(function() {
    'use strict'

    var _store = null
    var _settleResolve = null
    var _botTimer = null
    var _aborted = false

    // ── Subset selection ─────────────────────────────────────────
    // Enumerates all valid scoring subsets via bitmask.
    // Returns { mask, score, indices }.

    function findBestBotChoice(values, difficulty) {
        var n = values.length
        var candidates = []
        for (var mask = 1; mask < (1 << n); mask++) {
            var subset = []
            for (var i = 0; i < n; i++) {
                if (mask & (1 << i)) subset.push(values[i])
            }
            var result = window.scoringSystem.scoreSelection(subset)
            if (result.valid) candidates.push({ mask: mask, score: result.score })
        }
        if (candidates.length === 0) return { mask: 0, score: 0, indices: [] }
        candidates.sort(function(a, b) { return b.score - a.score })

        var chosen
        if (difficulty === 'novice') {
            var r = Math.random()
            if (r < 0.40 || candidates.length === 1) chosen = candidates[0]
            else if (r < 0.70 && candidates[1]) chosen = candidates[1]
            else chosen = candidates[Math.floor(Math.random() * Math.min(4, candidates.length))]
        } else if (difficulty === 'master') {
            chosen = candidates[0]
        } else {
            var r2 = Math.random()
            if (r2 < 0.80 || candidates.length === 1) chosen = candidates[0]
            else if (r2 < 0.95 && candidates[1]) chosen = candidates[1]
            else chosen = candidates[Math.floor(Math.random() * Math.min(4, candidates.length))]
        }

        var indices = []
        for (var j = 0; j < n; j++) {
            if (chosen.mask & (1 << j)) indices.push(j)
        }
        return { mask: chosen.mask, score: chosen.score, indices: indices }
    }

    // ── Bank threshold ───────────────────────────────────────────
    // Returns the minimum accumulated score at which the bot banks.

    function botRiskThreshold(accumulated, diceLeft, difficulty, playerHp, botHp) {
        if (difficulty === 'novice') return 350

        if (difficulty === 'master') {
            var t = 450
            if (botHp < playerHp) t -= 60
            if (playerHp < botHp) t += 80
            if (diceLeft <= 2) t -= 120
            if (diceLeft >= 5) t += 80
            return Math.max(250, Math.min(t, 900))
        }

        var t2 = 480
        if (Math.random() < 0.15) t2 += 120
        if (Math.random() < 0.15) t2 -= 100
        if (diceLeft <= 2) t2 -= 100
        return Math.max(250, Math.min(t2, 900))
    }

    // ── Helpers ──────────────────────────────────────────────────

    function delay(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms) })
    }

    function waitForSettle() {
        return new Promise(function(resolve) { _settleResolve = resolve })
    }

    function banner(text, cls, duration) {
        if (window.inputHandler && window.inputHandler.showBanner) {
            window.inputHandler.showBanner(text, cls, duration)
        }
    }

    function gameOver() {
        return !_store || _store.state.match.phase !== 'battle'
    }

    function showResultBanner() {
        var w = _store.state.match.winner
        var S = window.STRINGS
        log(w === 'player' ? '--- VICTORY ---' : '--- DEFEAT ---', w === 'player' ? '#2ecc71' : '#e74c3c')
        banner(w === 'player' ? S.RESULT_WIN : S.RESULT_LOSE, 'result', 3000)
    }

    // ── Bot turn loop ────────────────────────────────────────────

    function log(text, color) {
        if (window.battleUI) window.battleUI.logHistory(text, color)
    }

    function runBotTurn() {
        if (gameOver()) return
        _aborted = false
        if (window.inputHandler) window.inputHandler.lock()
        log('Bot turn')
        _runLoop()
    }

    async function _runLoop() {
        var difficulty = _store.state.enemy.difficulty || 'advanced'

        while (!_aborted && !gameOver()) {
            _store.dispatch('ROLL_DICE')

            if (window.bridge3D) {
                await waitForSettle()
                if (_aborted || gameOver()) return
            }

            var t = _store.state.turn

            if (t.phase === 'bust') {
                log('Bot BUST!', '#e74c3c')
                banner('BOT BUST!', 'bust', 1050)
                await delay(1350)
                if (_aborted) return
                _store.dispatch('BUST')
                _finishBotTurn()
                return
            }

            await delay(600)
            if (_aborted || gameOver()) return

            var choice = findBestBotChoice(t.rolledDice, difficulty)
            if (choice.score <= 0) {
                log('Bot BUST!', '#e74c3c')
                banner('BOT BUST!', 'bust', 1050)
                await delay(1350)
                if (_aborted) return
                _store.dispatch('BUST')
                _finishBotTurn()
                return
            }

            for (var i = 0; i < choice.indices.length; i++) {
                await delay(500)
                if (_aborted || gameOver()) return
                _store.dispatch('SELECT_DIE', { index: choice.indices[i] })
            }

            await delay(900)
            if (_aborted || gameOver()) return

            _store.dispatch('SCORE_SELECTION')
            t = _store.state.turn
            log('Bot scored +' + choice.score, '#2ecc71')

            if (t.hotHandTriggered) {
                log('Bot HOT HAND!', '#ff9800')
                var hotBanked = t.lastBankedScore
                if (hotBanked > 0) {
                    _store.dispatch('DEAL_DAMAGE', { target: 'player', amount: hotBanked })
                    if (window.battleUI) window.battleUI.showDamage('player', hotBanked)
                    log('Bot deals ' + hotBanked + ' damage', '#e74c3c')
                }
                if (gameOver()) { showResultBanner(); return }
                banner('BOT HOT HAND!', 'hot-hand', 900)
                await delay(1200)
                if (_aborted) return
                continue
            }

            var accum = t.accumulatedScore
            var diceLeft = t.diceCount
            var threshold = botRiskThreshold(accum, diceLeft, difficulty,
                _store.state.player.hp, _store.state.enemy.hp)

            if (accum >= threshold) {
                _store.dispatch('BANK')
                var banked = _store.state.turn.lastBankedScore
                if (banked > 0) {
                    _store.dispatch('DEAL_DAMAGE', { target: 'player', amount: banked })
                    if (window.battleUI) window.battleUI.showDamage('player', banked)
                    log('Bot deals ' + banked + ' damage', '#e74c3c')
                }
                if (gameOver()) { showResultBanner(); return }
                banner('BOT BANK!', 'bank', 850)
                await delay(1150)
                if (_aborted) return
                _finishBotTurn()
                return
            }

            await delay(900)
            if (_aborted || gameOver()) return
        }
    }

    function _finishBotTurn() {
        _store.dispatch('END_TURN')
        _store.dispatch('START_TURN')
        if (window.inputHandler) window.inputHandler.unlock()
    }

    function scheduleBotTurn(ms) {
        clearTimeout(_botTimer)
        _botTimer = setTimeout(runBotTurn, ms || 800)
    }

    function abort() {
        _aborted = true
        _settleResolve = null
        clearTimeout(_botTimer)
    }

    // ── Public API ───────────────────────────────────────────────

    window.botSystem = {
        init: function(store) { _store = store },

        onSettled: function() {
            if (_settleResolve) {
                var fn = _settleResolve
                _settleResolve = null
                fn()
            }
        },

        scheduleBotTurn: scheduleBotTurn,
        abort: abort,
        findBestBotChoice: findBestBotChoice,
        botRiskThreshold: botRiskThreshold
    }

})()
