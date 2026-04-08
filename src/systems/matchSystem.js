// Match system — owns state.match. Orchestrates battle lifecycle.
// Depends on: window.BALANCE, state.player (playerSystem), state.enemy (enemySystem)
// Loaded via <script> tag — exports to window.matchSystem.
//
// Caller sequence after player banks:
//   1. BANK            → turnSystem sets lastBankedScore
//   2. DEAL_DAMAGE     → matchSystem reduces target HP, checks win/lose
//   3. END_TURN        → matchSystem switches activePlayer
//
// Hot Hand: DEAL_DAMAGE after auto-bank, but NO END_TURN (player continues).
// Bust:    END_TURN only (no damage).

;(function() {
    'use strict'

    var matchSystem = {
        init: function(store) {
            var B = window.BALANCE

            store.state.match = {
                phase:        'hub',
                activePlayer: null,
                turnCount:    0,
                winner:       null
            }

            // ── START_BATTLE ───────────────────────────────────────
            store.register('START_BATTLE', function(state, payload) {
                state.enemy.hp         = payload.enemyHp   || 3000
                state.enemy.maxHp      = payload.enemyHp   || 3000
                state.enemy.name       = payload.enemyName  || 'Bot'
                state.enemy.difficulty = payload.difficulty  || 'novice'

                state.player.hp = state.player.maxHp

                state.match.phase        = 'battle'
                state.match.activePlayer = 'player'
                state.match.turnCount    = 0
                state.match.winner       = null
            }, 'match')

            // ── DEAL_DAMAGE ────────────────────────────────────────
            store.register('DEAL_DAMAGE', function(state, payload) {
                if (state.match.phase !== 'battle') return
                var amount = Math.floor(payload.amount * B.SCORE_TO_DAMAGE)
                if (amount <= 0) return

                if (payload.target === 'enemy') {
                    state.enemy.hp = Math.max(0, state.enemy.hp - amount)
                    if (state.enemy.hp <= 0) {
                        state.match.winner = 'player'
                        state.match.phase  = 'result'
                    }
                } else if (payload.target === 'player') {
                    state.player.hp = Math.max(0, state.player.hp - amount)
                    if (state.player.hp <= 0) {
                        state.match.winner = 'enemy'
                        state.match.phase  = 'result'
                    }
                }
            }, 'match')

            // ── END_TURN ───────────────────────────────────────────
            store.register('END_TURN', function(state) {
                if (state.match.phase !== 'battle') return
                state.match.turnCount++
                state.match.activePlayer =
                    state.match.activePlayer === 'player' ? 'enemy' : 'player'
            }, 'match')
        }
    }

    window.matchSystem = matchSystem

})()
