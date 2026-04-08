// Balance config — pure data. Source of truth: DESIGN.md §2, §5, §7
// Loaded via <script> tag — exports to window.BALANCE.

;(function() {
    'use strict'

    window.BALANCE = {

        DICE_PER_TURN: 6,

        PLAYER_BASE_HP: 3000,

        // §7.2 — banked score converts to damage at this ratio
        SCORE_TO_DAMAGE: 1,

        // §5 — all six dice scored → auto-bank, fresh roll with 6 dice
        HOT_HAND_THRESHOLD: 6,
        HOT_HAND_AUTO_BANK: true,

        // Per-bank damage pacing reference (§7.3, informational)
        TYPICAL_BANK_LOW:  400,
        TYPICAL_BANK_HIGH: 800,
        TYPICAL_BANKS_TO_KILL: [4, 6]
    }

})()
