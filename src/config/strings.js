// Player-facing text — pure data. Source of truth: DESIGN.md §10, §12
// Loaded via <script> tag — exports to window.STRINGS.
// All UI text in one place for future i18n.

;(function() {
    'use strict'

    window.STRINGS = {

        // ─── Battle banners ────────────────────────────────────────────
        BANNER_BANK:      'BANK!',
        BANNER_BUST:      'BUST',
        BANNER_HOT_HAND:  'HOT HAND',
        BANNER_REROLL:    'REROLL!',

        // ─── Battle buttons ────────────────────────────────────────────
        BTN_ROLL:         'ROLL',
        BTN_SCORE:        "SCORE'N'PLAY",
        BTN_BANK:         "BANK'N'PASS",

        // ─── Turn indicator ────────────────────────────────────────────
        TURN_PLAYER:      'Player Turn',
        TURN_BOT:         'Bot Turn',

        // ─── Info bar ──────────────────────────────────────────────────
        LABEL_ROUND_SCORE:  'Round Score',
        LABEL_SELECTION:    'Selection',

        // ─── Hub ───────────────────────────────────────────────────────
        HUB_PLAY:         'Play',
        HUB_LOADOUT:      'Loadout',
        HUB_TUTORIAL:     'Tutorial',
        HUB_RESET:        'Reset',
        HUB_UNLOCK:       'Unlock Status',

        // ─── Battle result ─────────────────────────────────────────────
        RESULT_WIN:       'Victory!',
        RESULT_LOSE:      'Defeated',

        // ─── Loadout editor ────────────────────────────────────────────
        LOADOUT_TITLE:    'Loadout',
        LOADOUT_EMPTY:    'Empty (Base Die)',

        // ─── Ability buttons (match DICE.roster[x].ability.button) ────
        BTN_JUMP:         'JUMP',
        BTN_FLIP:         'FLIP',
        BTN_TUNE:         'TUNE',
        BTN_MIMIC:        'MIMIC',
        BTN_CLONE:        'CLONE',
        BTN_INFECT:       'INFECT',
        BTN_SACRIFICE:    'SACRIFICE',
        BTN_MIRROR:       'MIRROR',

        // ─── Tutorial chapter titles (§12.1) ──────────────────────────
        TUT_CH1: 'Core Scoring Basics',
        TUT_CH2: 'Bust And Risk',
        TUT_CH3: 'Joker',
        TUT_CH4: 'Action Dice',
        TUT_CH5: 'Pattern Dice',

        // ─── Misc ──────────────────────────────────────────────────────
        DICE_STACKED:     'Dice stacked! Re-throwing…',
        NO_SCORING_DICE:  'No scoring dice'
    }

})()
