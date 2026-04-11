// Turn state machine — owns state.turn.
// Depends on: window.store, window.BALANCE, window.scoringSystem
// Loaded via <script> tag — exports to window.turnSystem.

;(function() {
    'use strict'

    function revalidateSelection(t) {
        if (t.selectedIndices.length === 0) {
            t.selectionScore = 0
            t.selectionValid = false
            t.devilBonus = 0
            return
        }
        var values = []
        for (var i = 0; i < t.selectedIndices.length; i++) {
            values.push(t.rolledDice[t.selectedIndices[i]])
        }

        var devilResult = applyDevilSubstitution(t, values)
        var result = window.scoringSystem.scoreSelection(devilResult.values)
        t.selectionScore = result.score + devilResult.bonus
        t.selectionValid = result.valid
        t.devilBonus = devilResult.bonus
    }

    function applyDevilSubstitution(t, values) {
        var slots = window.store && window.store.state.loadout
            ? window.store.state.loadout.slots : []
        var slotMap = t.dieSlotMap || []
        var devilIdx = -1
        var sixCount = 0

        for (var i = 0; i < t.selectedIndices.length; i++) {
            var ri = t.selectedIndices[i]
            var slot = slotMap[ri]
            if (slot >= 0 && slots[slot] === 'devil') {
                devilIdx = i
            } else if (values[i] === 6) {
                sixCount++
            }
        }

        if (devilIdx === -1 || sixCount < 2) return { values: values, bonus: 0 }

        var modified = values.slice()
        var natural6 = modified[devilIdx] === 6
        modified[devilIdx] = 6

        var bonus = 0
        if (natural6) {
            var tripleBase = window.SCORING ? window.SCORING.TRIPLE_BASE[6] : 600
            bonus = tripleBase
        }
        return { values: modified, bonus: bonus }
    }

    function checkBandieHeal(state, t) {
        t.lastHealAmount = 0
        var slots = state.loadout ? state.loadout.slots : []
        var slotMap = t.dieSlotMap || []
        var roster = window.DICE ? window.DICE.roster : {}
        for (var i = 0; i < t.selectedIndices.length; i++) {
            var ri = t.selectedIndices[i]
            var slot = slotMap[ri]
            if (slot == null || slot < 0) continue
            if (slots[slot] !== 'bandie') continue
            var val = t.rolledDice[ri]
            if (val !== 1 && val !== 5) continue
            var def = roster['bandie']
            var level = 1
            var healAmount = def && def.healPerLevel ? def.healPerLevel[level - 1] : 100
            t.lastHealAmount += healAmount
            window.store.dispatch('HEAL_PLAYER', { amount: healAmount })
        }
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
                jumpingDie:        -1,
                flipUsed:          false,
                flippingDie:       -1,
                flipperIndex:      -1,
                slimeSpawns:       [],
                slimeTriggered:    false,
                tempDiceCount:     0,
                devilBonus:        0,
                lastHealAmount:    0,
                tuneUsed:          false,
                tuningDie:         -1,
                tunerIndex:        -1,
                tuneDirection:     0
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
                t.flipUsed          = false
                t.flippingDie       = -1
                t.flipperIndex      = -1
                t.tuneUsed          = false
                t.tuningDie         = -1
                t.tunerIndex        = -1
                t.tuneDirection     = 0
                t.slimeSpawns       = []
                t.slimeTriggered    = false
                t.tempDiceCount     = 0
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
            // Also detects Slime spawn triggers (Slime rolled 6 → phase 'spawning').
            store.register('DICE_SETTLED', function(state, payload) {
                var t = state.turn
                t.rolledDice       = payload.values
                t.selectedIndices  = []
                t.selectionScore   = 0
                t.selectionValid   = false

                var spawns = detectSlimeSpawns(state)
                if (spawns.length > 0) {
                    t.slimeSpawns = spawns
                    t.phase = 'spawning'
                    return
                }

                if (!window.scoringSystem.hasPlayableDice(payload.values)) {
                    t.phase            = 'bust'
                    t.accumulatedScore = 0
                } else {
                    t.phase = 'selecting'
                }
            }, 'turn')

            function detectSlimeSpawns(state) {
                var t = state.turn
                if (t.slimeTriggered) return []
                var slots = state.loadout ? state.loadout.slots : []
                var spawns = []
                for (var i = 0; i < t.rolledDice.length; i++) {
                    if (t.rolledDice[i] !== 6) continue
                    var slotIdx = t.dieSlotMap[i]
                    if (slotIdx == null || slotIdx < 0) continue
                    var dieId = slots[slotIdx]
                    if (dieId !== 'slime') continue
                    var level = 1
                    var spawnCount = level >= 2 ? 2 : 1
                    spawns.push({ parentIndex: i, level: level, spawnCount: spawnCount })
                }
                return spawns
            }

            // ── SLIME_SPAWNED — temp die(s) settled after spawn ─────────
            store.register('SLIME_SPAWNED', function(state, payload) {
                var t = state.turn
                if (t.phase !== 'spawning') return

                t.slimeTriggered = true

                for (var i = 0; i < payload.spawns.length; i++) {
                    var sp = payload.spawns[i]
                    t.rolledDice.push(sp.value)
                    t.dieSlotMap.push(-1)
                    t.diceCount++
                    t.tempDiceCount++
                }

                // Lv2+: Slime parent becomes 5
                if (payload.parentLevel >= 2 && payload.parentIndex != null) {
                    t.rolledDice[payload.parentIndex] = 5
                }

                t.slimeSpawns = []

                if (!window.scoringSystem.hasPlayableDice(t.rolledDice)) {
                    t.phase = 'bust'
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

                checkBandieHeal(state, t)

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

                // Hot Hand: all dice on table scored (works with temp dice too)
                if (remaining.length === 0) {
                    t.hotHandTriggered = true
                    t.lastBankedScore  = t.accumulatedScore
                    t.accumulatedScore = 0
                    t.heldDice         = []
                    t.diceCount        = B.DICE_PER_TURN
                    t.tempDiceCount    = 0
                    t.slimeSpawns      = []
                    t.slimeTriggered   = false
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
                t.flipUsed          = false
                t.flippingDie       = -1
                t.flipperIndex      = -1
                t.tuneUsed          = false
                t.tuningDie         = -1
                t.tunerIndex        = -1
                t.tuneDirection     = 0
                t.slimeSpawns       = []
                t.slimeTriggered    = false
                t.tempDiceCount     = 0
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
                t.tuneUsed          = false
                t.tuningDie         = -1
                t.tunerIndex        = -1
                t.tuneDirection     = 0
                t.slimeSpawns       = []
                t.slimeTriggered    = false
                t.tempDiceCount     = 0
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

                if (payload.ability === 'flip') {
                    if (t.flipUsed) return
                    t.flipUsed = true
                    t.selectedIndices = []
                    t.selectionScore = 0
                    t.selectionValid = false
                    var level = 1
                    if (level === 1) {
                        t.flippingDie = idx
                        t.phase = 'flipping'
                    } else {
                        t.flipperIndex = idx
                        t.phase = 'flipTargeting'
                    }
                }

                if (payload.ability === 'tune') {
                    if (t.tuneUsed) return
                    var dir = payload.direction
                    if (dir !== 1 && dir !== -1) return
                    t.tuneUsed = true
                    t.tuneDirection = dir
                    t.selectedIndices = []
                    t.selectionScore = 0
                    t.selectionValid = false
                    var tuneLevel = 1
                    if (tuneLevel === 1) {
                        t.tuningDie = idx
                        t.phase = 'tuning'
                    } else {
                        t.tunerIndex = idx
                        t.phase = 'tuneTargeting'
                    }
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

            // ── FLIP_TARGET — player picked a target during flipTargeting ──
            store.register('FLIP_TARGET', function(state, payload) {
                var t = state.turn
                if (t.phase !== 'flipTargeting') return
                var idx = payload.targetIndex
                if (idx < 0 || idx >= t.rolledDice.length) return
                t.flippingDie = idx
                t.selectedIndices = []
                t.selectionScore = 0
                t.selectionValid = false
                t.phase = 'flipping'
            }, 'turn')

            // ── FLIP_SETTLED — die landed on opposite face ───────────────
            store.register('FLIP_SETTLED', function(state, payload) {
                var t = state.turn
                if (t.phase !== 'flipping') return
                t.rolledDice[t.flippingDie] = payload.value
                t.flippingDie = -1
                t.flipperIndex = -1
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

            // ── TUNE_TARGET — player chose die to tune (Lv2+) ────────────
            store.register('TUNE_TARGET', function(state, payload) {
                var t = state.turn
                if (t.phase !== 'tuneTargeting') return
                var idx = payload.targetIndex
                if (idx < 0 || idx >= t.rolledDice.length) return
                t.tuningDie = idx
                t.phase = 'tuning'
            }, 'turn')

            // ── TUNE_SETTLED — die shifted to new face ───────────────────
            store.register('TUNE_SETTLED', function(state, payload) {
                var t = state.turn
                if (t.phase !== 'tuning') return
                t.rolledDice[t.tuningDie] = payload.value
                t.tuningDie = -1
                t.tunerIndex = -1
                t.tuneDirection = 0
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
