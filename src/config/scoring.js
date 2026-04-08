// Scoring config — pure data. Source of truth: DESIGN.md §3.1
// Loaded via <script> tag — exports to window.SCORING.

;(function() {
    'use strict'

    window.SCORING = {

        // Face values that score individually
        SINGLES: { 1: 100, 5: 50 },

        // Three-of-a-kind base scores (multiplied for 4/5/6 of a kind)
        TRIPLE_BASE: {
            1: 1000,
            2: 200,
            3: 300,
            4: 400,
            5: 500,
            6: 600
        },

        // Multiplier applied to TRIPLE_BASE for N-of-a-kind
        // Each tier doubles the previous: base × 2^(count − 3)
        N_OF_KIND_MULT: {
            3: 1,
            4: 2,
            5: 4,
            6: 8
        },

        STRAIGHTS: [
            { faces: [1, 2, 3, 4, 5],    score: 500,  id: 'shortLow'  },
            { faces: [2, 3, 4, 5, 6],    score: 750,  id: 'shortHigh' },
            { faces: [1, 2, 3, 4, 5, 6], score: 1500, id: 'full'      }
        ],

        // Bust probability by dice count (informational, not used in logic)
        BUST_CHANCE: {
            6: 0.023,
            5: 0.077,
            4: 0.157,
            3: 0.278,
            2: 0.444,
            1: 0.667
        }
    }

})()
