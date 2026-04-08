// Encounter ladder config — pure data. Source of truth: DESIGN.md §9.3, §9.4, §11
// Loaded via <script> tag — exports to window.ENCOUNTERS.

;(function() {
    'use strict'

    // §9.3 Common Draft Ladder
    var COMMON_LADDER = [
        { win: 1,  unlock: 'frog',          difficulty: 'novice',   encounter: 'Tutorial Bot',        botHP: 3000  },
        { win: 2,  unlock: 'oneLove',       difficulty: 'novice',   encounter: 'Tutorial Bot',        botHP: 3250  },
        { win: 3,  unlock: 'comrade',       difficulty: 'novice',   encounter: 'Duelist',             botHP: 3500  },
        { win: 4,  unlock: 'flipper',       difficulty: 'novice+',  encounter: 'Trickster',           botHP: 3800  },
        { win: 5,  unlock: 'evenDie',       difficulty: 'skilled',  encounter: 'Pair Hunter',         botHP: 4200  },
        { win: 7,  unlock: 'oddDie',        difficulty: 'skilled',  encounter: 'Parity Bot',          botHP: 4600  },
        { win: 9,  unlock: 'bandie',        difficulty: 'skilled',  encounter: 'Sustain Test',        botHP: 5000  },
        { win: 11, unlock: 'mathematician', difficulty: 'veteran',  encounter: 'Pattern Bot',         botHP: 5500  },
        { win: 13, unlock: 'cluster',       difficulty: 'veteran',  encounter: 'Set Boss',            botHP: 6000  },
        { win: 15, unlock: 'bounce',        difficulty: 'veteran',  encounter: 'Tempo Bot',           botHP: 6600  },
        { win: 18, unlock: 'slime',         difficulty: 'elite',    encounter: 'Split Boss',          botHP: 7400  },
        { win: 21, unlock: 'bridge',        difficulty: 'elite',    encounter: 'Straight Boss',       botHP: 8300  },
        { win: 24, unlock: 'match',         difficulty: 'elite',    encounter: 'Set Boss II',         botHP: 9200  },
        { win: 27, unlock: 'chain',         difficulty: 'master',   encounter: 'Precision Boss',      botHP: 10200 },
        { win: 30, unlock: 'shrinking',     difficulty: 'master',   encounter: 'Rhythm Boss',         botHP: 11300 },
        { win: 33, unlock: 'growing',       difficulty: 'master+',  encounter: 'Double Bot',          botHP: 12400 },
        { win: 36, unlock: 'pulse',         difficulty: 'finale',   encounter: 'Common Finale Boss',  botHP: 14000 }
    ]

    // §9.4 Rare Draft Ladder
    var RARE_LADDER = [
        { win: 40,  unlock: 'tuner',        difficulty: 'master',     encounter: 'Rare Gatekeeper',   botHP: 16000 },
        { win: 44,  unlock: 'royalI',       difficulty: 'master',     encounter: 'Straight Hunter',   botHP: 17500 },
        { win: 48,  unlock: 'forgeI',       difficulty: 'master+',    encounter: 'Set Smith',         botHP: 19000 },
        { win: 52,  unlock: 'pin',          difficulty: 'master+',    encounter: 'Pattern Hunter',    botHP: 20500 },
        { win: 56,  unlock: 'devil',        difficulty: 'heroic',     encounter: 'Sixes Boss',        botHP: 22000 },
        { win: 60,  unlock: 'mimic',        difficulty: 'heroic',     encounter: 'Copycat Boss',      botHP: 23500 },
        { win: 65,  unlock: 'clone',        difficulty: 'heroic+',    encounter: 'Double Bot',        botHP: 25500 },
        { win: 70,  unlock: 'blight',       difficulty: 'nightmare',  encounter: 'Infection Boss',    botHP: 27500 },
        { win: 75,  unlock: 'gravity',      difficulty: 'nightmare',  encounter: 'Weight Boss',       botHP: 30000 },
        { win: 81,  unlock: 'mirror',       difficulty: 'nightmare+', encounter: 'Reflective Boss',   botHP: 33000 },
        { win: 87,  unlock: 'sacriDice',    difficulty: 'apex',       encounter: 'Sacrifice Duel',    botHP: 36500 },
        { win: 93,  unlock: 'yin',          difficulty: 'apex',       encounter: 'Twin Boss',         botHP: 40000 },
        { win: 100, unlock: 'secondWind',   difficulty: 'apex+',      encounter: 'Endurance Boss',    botHP: 44000 },
        { win: 107, unlock: 'leech',        difficulty: 'legend',     encounter: 'Gauntlet',          botHP: 48000 },
        { win: 115, unlock: 'siphon',       difficulty: 'legend',     encounter: 'Drain Boss',        botHP: 52500 },
        { win: 123, unlock: 'transfusion',  difficulty: 'legend',     encounter: 'Rare Finale Boss',  botHP: 57500 }
    ]

    // Combined ladder (common first, then rare) — ordered by win threshold
    var FULL_LADDER = COMMON_LADDER.concat(RARE_LADDER)

    // Difficulty tiers (§11 — bot behavior tuning, provisional)
    var DIFFICULTY = {
        'novice':     { riskThreshold: 300, description: 'Banks early, avoids risk' },
        'novice+':    { riskThreshold: 350, description: 'Slightly braver' },
        'skilled':    { riskThreshold: 400, description: 'Holds for decent scores' },
        'veteran':    { riskThreshold: 500, description: 'Pushes for better banks' },
        'elite':      { riskThreshold: 600, description: 'Aggressive scoring' },
        'master':     { riskThreshold: 700, description: 'Calculated risk-taking' },
        'master+':    { riskThreshold: 800, description: 'High-value target banks' },
        'finale':     { riskThreshold: 800, description: 'Common finale boss' },
        'heroic':     { riskThreshold: 900, description: 'Expert scoring patterns' },
        'heroic+':    { riskThreshold: 1000, description: 'Aggressive expert' },
        'nightmare':  { riskThreshold: 1100, description: 'Near-optimal play' },
        'nightmare+': { riskThreshold: 1200, description: 'Deep push strategy' },
        'apex':       { riskThreshold: 1400, description: 'Maximum aggression' },
        'apex+':      { riskThreshold: 1500, description: 'Extreme risk-taker' },
        'legend':     { riskThreshold: 1600, description: 'Legendary difficulty' }
    }

    window.ENCOUNTERS = {
        COMMON_LADDER: COMMON_LADDER,
        RARE_LADDER:   RARE_LADDER,
        FULL_LADDER:   FULL_LADDER,
        DIFFICULTY:    DIFFICULTY
    }

})()
