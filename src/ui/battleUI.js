// Battle UI — DOM rendering layer.
// Subscribes to store, updates all visual elements on state change.
// Layout matches battle.html: side HP widgets + center info/actions.
// Depends on: window.STRINGS
// Loaded via <script> tag — exports to window.battleUI.

;(function() {
    'use strict'

    var S = window.STRINGS
    var _store = null
    var _unsub = null

    var _el = {}

    function cacheElements() {
        var ids = [
            'battleUI',
            'playerHpFill', 'playerHp', 'playerHpMax', 'playerName',
            'enemyHpFill', 'enemyHp', 'enemyHpMax', 'enemyName',
            'playerTurnLabel', 'botTurnLabel',
            'accScore', 'selScore', 'phaseHint',
            'btnRoll', 'btnScore', 'btnBank', 'newBattleBtn', 'actionsWrap'
        ]
        for (var i = 0; i < ids.length; i++) {
            _el[ids[i]] = document.getElementById(ids[i])
        }
    }

    function renderHp() {
        var p = _store.state.player
        var e = _store.state.enemy

        var ePct = e.maxHp > 0 ? (e.hp / e.maxHp * 100) : 0
        _el.enemyHpFill.style.width = ePct + '%'
        _el.enemyHp.textContent = e.hp
        _el.enemyHpMax.textContent = e.maxHp
        _el.enemyName.textContent = e.name || 'Bot'

        var pPct = p.maxHp > 0 ? (p.hp / p.maxHp * 100) : 0
        _el.playerHpFill.style.width = pPct + '%'
        _el.playerHp.textContent = p.hp
        _el.playerHpMax.textContent = p.maxHp
        _el.playerName.textContent = p.name || 'Player'
    }

    function renderScore() {
        var t = _store.state.turn
        _el.accScore.textContent = t.accumulatedScore || '0'

        if (t.selectionValid && t.selectionScore > 0) {
            var vals = []
            for (var i = 0; i < t.selectedIndices.length; i++) {
                vals.push(t.rolledDice[t.selectedIndices[i]])
            }
            _el.selScore.textContent = vals.join(', ') + ' = ' + t.selectionScore + ' pts'
            _el.selScore.style.color = '#2ecc71'
        } else if (t.selectedIndices.length > 0) {
            var vals = []
            for (var i = 0; i < t.selectedIndices.length; i++) {
                vals.push(t.rolledDice[t.selectedIndices[i]])
            }
            _el.selScore.textContent = vals.join(', ') + ' = Invalid Selection'
            _el.selScore.style.color = '#e74c3c'
        } else {
            _el.selScore.textContent = '\u00a0'
            _el.selScore.style.color = ''
        }
    }

    function syncActionsVisibility() {
        var btns = [_el.btnRoll, _el.btnScore, _el.btnBank, _el.newBattleBtn]
        var any = false
        for (var i = 0; i < btns.length; i++) {
            if (btns[i].style.display !== 'none') { any = true; break }
        }
        _el.actionsWrap.style.display = any ? '' : 'none'
    }

    function renderButtons() {
        var t = _store.state.turn
        var m = _store.state.match
        var isPlayer = m.activePlayer === 'player'

        if (m.phase === 'result') {
            _el.btnRoll.style.display = 'none'
            _el.btnScore.style.display = 'none'
            _el.btnBank.style.display = 'none'
            _el.newBattleBtn.style.display = ''
            syncActionsVisibility()
            return
        }
        _el.newBattleBtn.style.display = 'none'

        var rerollPending = window.inputHandler && window.inputHandler.isRerollPending()
        _el.btnRoll.style.display = ((t.phase === 'idle' && isPlayer) || rerollPending) ? '' : 'none'
        _el.btnRoll.textContent = rerollPending ? 'REROLL' : S.BTN_ROLL

        var canAct = t.phase === 'selecting' && t.selectionValid && isPlayer
        _el.btnScore.style.display = canAct ? '' : 'none'
        _el.btnBank.style.display = canAct ? '' : 'none'

        if (canAct) {
            _el.btnScore.textContent = S.BTN_SCORE
        }

        syncActionsVisibility()
    }

    function renderTurnInfo() {
        var m = _store.state.match

        if (m.phase === 'result') {
            _el.playerTurnLabel.classList.remove('active')
            _el.botTurnLabel.classList.remove('active')
            return
        }

        var isPlayer = m.activePlayer === 'player'
        _el.playerTurnLabel.classList.toggle('active', isPlayer)
        _el.botTurnLabel.classList.toggle('active', !isPlayer)
    }

    function renderPhaseHint() {
        var t = _store.state.turn
        var m = _store.state.match
        var hint = ''

        var rerollPending = window.inputHandler && window.inputHandler.isRerollPending()
        if (rerollPending) {
            hint = 'Dice not on table — press REROLL or drag to throw'
        } else if (m.phase === 'result') {
            hint = m.winner === 'player' ? S.RESULT_WIN : S.RESULT_LOSE
        } else if (t.phase === 'idle') {
            hint = 'Drag on the table or press ROLL'
        } else if (t.phase === 'selecting') {
            hint = 'Click dice to select'
        } else if (t.phase === 'bust') {
            hint = ''
        }

        _el.phaseHint.textContent = hint
    }

    function renderAll() {
        renderHp()
        renderScore()
        renderButtons()
        renderTurnInfo()
        renderPhaseHint()
    }

    // ── Round History (imperative — callers push lines directly) ───────────
    var _historyEl = null

    function initHistory() {
        _historyEl = document.getElementById('historyLog')
        if (_historyEl) _historyEl.innerHTML = ''
    }

    function logHistory(text, color) {
        if (!_historyEl) _historyEl = document.getElementById('historyLog')
        if (!_historyEl) return
        var line = document.createElement('div')
        line.textContent = text
        if (color) line.style.color = color
        _historyEl.appendChild(line)
        _historyEl.scrollTop = _historyEl.scrollHeight
    }

    function clearHistory() {
        if (!_historyEl) _historyEl = document.getElementById('historyLog')
        if (_historyEl) _historyEl.innerHTML = ''
    }

    function showDamage(target, amount) {
        if (!amount || amount <= 0) return
        var isEnemy = target === 'enemy'
        var widget = document.querySelector(isEnemy ? '.hp-widget-enemy' : '.hp-widget-player')
        var barBody = widget ? widget.querySelector('.hp-bar-body') : null
        if (!widget) return

        var fly = document.createElement('div')
        fly.className = 'damage-fly'
        fly.textContent = '-' + amount
        widget.appendChild(fly)
        fly.addEventListener('animationend', function() { fly.remove() })

        if (barBody) {
            barBody.classList.add('hp-flash')
            barBody.addEventListener('animationend', function h() {
                barBody.classList.remove('hp-flash')
                barBody.removeEventListener('animationend', h)
            })
        }
        widget.classList.add('hp-shake')
        widget.addEventListener('animationend', function h2() {
            widget.classList.remove('hp-shake')
            widget.removeEventListener('animationend', h2)
        })
    }

    window.battleUI = {
        mount: function(store) {
            _store = store
            cacheElements()
            initHistory()
            _el.battleUI.style.display = 'block'
            _unsub = store.subscribe(function() { renderAll() })
            renderAll()
        },

        unmount: function() {
            if (_unsub) _unsub()
            _unsub = null
            if (_el.battleUI) _el.battleUI.style.display = 'none'
        },

        refresh: function() {
            if (_store) renderAll()
        },

        showDamage: showDamage,
        logHistory: logHistory,
        clearHistory: clearHistory
    }

})()
