// Turn state machine — owns state.turn.
// Depends on: window.store, window.BALANCE, window.scoringSystem
// Loaded via <script> tag — exports to window.turnSystem.

;(function() {
    'use strict'

    function revalidateSelection(t) {
        if (t.selectedIndices.length === 0) {
            t.selectionScore = 0
            t.selectionValid = false
            return
        }
        var values = []
        for (var i = 0; i < t.selectedIndices.length; i++) {
            values.push(t.rolledDice[t.selectedIndices[i]])
        }
        var result = window.scoringSystem.scorePlayerSelection(values)
        t.selectionScore = result.score
        t.selectionValid = result.valid
    }

    var turnSystem = {
        init: function(store) {
            var B = window.BALANCE

            store.state.turn = {
                rolledDice:        [],
                heldDice:          [],
                selectedIndices:   [],
                dieSlotMap:        [],
                accumulatedScore:  0,
                phase:             'idle',
                diceCount:         B.DICE_PER_TURN,
                turnNumber:        0,
                selectionScore:    0,
                selectionValid:    false,
                lastBankedScore:   0,
                hotHandTriggered:  false,
                jumpUsed:          false,
                jumpingDie:        -1
            }

            // ── START_TURN ─────────────────────────────────────────
            function initSlotMap(t) {
                t.dieSlotMap = []
                for (var i = 0; i < t.diceCount; i++) t.dieSlotMap.push(i)
            }

            store.register('START_TURN', function(state) {
                var t = state.turn
                t.turnNumber++
                t.rolledDice        = []
                t.heldDice          = []
                t.selectedIndices   = []
                t.accumulatedScore  = 0
                t.diceCount         = B.DICE_PER_TURN
                t.selectionScore    = 0
                t.selectionValid    = false
                t.lastBankedScore   = 0
                t.hotHandTriggered  = false
                t.jumpUsed          = false
                t.jumpingDie        = -1
                initSlotMap(t)
                t.phase             = 'idle'
            }, 'turn')

            // ── ROLL_DICE ──────────────────────────────────────────
            store.register('ROLL_DICE', function(state) {
                var t = state.turn
                if (t.phase !== 'idle') return

                var values = []
                for (var i = 0; i < t.diceCount; i++) {
                    values.push(store.prng.next(1, 6))
                }
                t.rolledDice        = values
                t.selectedIndices   = []
                t.selectionScore    = 0
                t.selectionValid    = false
                t.hotHandTriggered  = false
                if (t.dieSlotMap.length !== t.diceCount) initSlotMap(t)

                if (!window.scoringSystem.hasPlayableDice(values)) {
                    t.phase = 'bust'
                } else {
                    t.phase = 'selecting'
                }
            }, 'turn')

            // ── DICE_SETTLED (3D only) ───────────────────────────────
            // After physics settle, override PRNG values with actual face reads.
            store.register('DICE_SETTLED', function(state, payload) {
                var t = state.turn
                t.rolledDice       = payload.values
                t.selectedIndices  = []
                t.selectionScore   = 0
                t.selectionValid   = false

                if (!window.scoringSystem.hasPlayableDice(payload.values)) {
                    t.phase            = 'bust'
                    t.accumulatedScore = 0
                } else {
                    t.phase = 'selecting'
                }
            }, 'turn')

            // ── SELECT_DIE ─────────────────────────────────────────
            store.register('SELECT_DIE', function(state, payload) {
                var t = state.turn
                if (t.phase !== 'selecting') return
                var idx = payload.index
                if (idx < 0 || idx >= t.rolledDice.length) return
                if (t.selectedIndices.indexOf(idx) !== -1) return
                t.selectedIndices.push(idx)
                revalidateSelection(t)
            }, 'turn')

            // ── DESELECT_DIE ───────────────────────────────────────
            store.register('DESELECT_DIE', function(state, payload) {
                var t = state.turn
                if (t.phase !== 'selecting') return
                var idx = payload.index
                var pos = t.selectedIndices.indexOf(idx)
                if (pos === -1) return
                t.selectedIndices.splice(pos, 1)
                revalidateSelection(t)
            }, 'turn')

            // ── SCORE_SELECTION ────────────────────────────────────
            store.register('SCORE_SELECTION', function(state) {
                var t = state.turn
                if (t.phase !== 'selecting' || !t.selectionValid) return

                var selectedValues = []
                for (var i = 0; i < t.selectedIndices.length; i++) {
                    selectedValues.push(t.rolledDice[t.selectedIndices[i]])
                }

                t.heldDice = t.heldDice.concat(selectedValues)
                t.accumulatedScore += t.selectionScore

                // Remove scored dice from rolled pool (preserve slot mapping)
                var remaining = []
                var remainingMap = []
                for (var j = 0; j < t.rolledDice.length; j++) {
                    if (t.selectedIndices.indexOf(j) === -1) {
                        remaining.push(t.rolledDice[j])
                        remainingMap.push(t.dieSlotMap[j])
                    }
                }
                t.rolledDice      = remaining
                t.dieSlotMap      = remainingMap
                t.diceCount       = remaining.length
                t.selectedIndices = []
                t.selectionScore  = 0
                t.selectionValid  = false

                // Hot Hand: all 6 dice scored this turn → auto-bank
                if (t.heldDice.length >= B.HOT_HAND_THRESHOLD) {
                    t.hotHandTriggered = true
                    t.lastBankedScore  = t.accumulatedScore
                    t.accumulatedScore = 0
                    t.heldDice         = []
                    t.diceCount        = B.DICE_PER_TURN
                    initSlotMap(t)
                    t.phase            = 'idle'
                } else {
                    t.phase = 'idle'
                }
            }, 'turn')

            // ── BANK ───────────────────────────────────────────────
            store.register('BANK', function(state) {
                var t = state.turn
                if (t.phase !== 'idle') return
                t.lastBankedScore   = t.accumulatedScore
                t.accumulatedScore  = 0
                t.heldDice          = []
                t.selectedIndices   = []
                t.rolledDice        = []
                t.diceCount         = B.DICE_PER_TURN
                t.selectionScore    = 0
                t.selectionValid    = false
                t.hotHandTriggered  = false
                t.jumpUsed          = false
                t.jumpingDie        = -1
                initSlotMap(t)
                t.phase             = 'idle'
            }, 'turn')

            // ── BUST ───────────────────────────────────────────────
            // Explicit bust action (also detected inside ROLL_DICE).
            store.register('BUST', function(state) {
                var t = state.turn
                t.lastBankedScore   = 0
                t.accumulatedScore  = 0
                t.heldDice          = []
                t.selectedIndices   = []
                t.rolledDice        = []
                t.diceCount         = B.DICE_PER_TURN
                t.selectionScore    = 0
                t.selectionValid    = false
                t.hotHandTriggered  = false
                initSlotMap(t)
                t.phase             = 'idle'
            }, 'turn')

            // ── USE_ABILITY ─────────────────────────────────────────
            store.register('USE_ABILITY', function(state, payload) {
                var t = state.turn
                if (t.phase !== 'selecting') return
                if (state.match.activePlayer !== 'player') return

                var idx = payload.dieIndex
                if (idx < 0 || idx >= t.rolledDice.length) return

                if (payload.ability === 'reroll') {
                    if (t.jumpUsed) return
                    t.jumpUsed = true
                    t.jumpingDie = idx
                    t.selectedIndices = []
                    t.selectionScore = 0
                    t.selectionValid = false
                    t.phase = 'jumping'
                }
            }, 'turn')

            // ── JUMP_SETTLED — Frog landed after JUMP ───────────────
            store.register('JUMP_SETTLED', function(state, payload) {
                var t = state.turn
                if (t.phase !== 'jumping') return
                t.rolledDice[t.jumpingDie] = payload.value
                t.jumpingDie = -1
                t.selectedIndices = []
                t.selectionScore = 0
                t.selectionValid = false

                if (!window.scoringSystem.hasPlayableDice(t.rolledDice)) {
                    t.phase = 'bust'
                    t.accumulatedScore = 0
                } else {
                    t.phase = 'selecting'
                }
            }, 'turn')
        }
    }

    window.turnSystem = turnSystem

})()
