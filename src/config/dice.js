// Dice roster config — pure data. Source of truth: DESIGN.md §8
// Loaded via <script> tag — exports to window.DICE.
//
// Structure per entry:
//   id        — unique key (matches loadout references)
//   name      — display name
//   rarity    — 'base' | 'common' | 'rare' | 'exotic'
//   utility   — true if utility sub-category
//   maxLevel  — 1 when no evolution line
//   ability   — { type, button?, passive? } or null
//   weights   — array[level-1] of { face: probability } for bias dice, null otherwise
//   visual    — { body, pips, marks? } (rendering hints)

;(function() {
    'use strict'

    var U = true  // utility shorthand

    var roster = {

        // ─── Base ──────────────────────────────────────────────────────

        base: {
            id: 'base', name: 'Base Die', rarity: 'base', utility: false, maxLevel: 1,
            desc: 'Just a simple die without any abilities.',
            ability: null, weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        // ─── Common ────────────────────────────────────────────────────

        frog: {
            id: 'frog', name: 'Frog', rarity: 'common', utility: false, maxLevel: 1,
            desc: 'Reroll this die once per turn.',
            ability: { type: 'reroll', button: 'JUMP', passive: false },
            weights: null,
            visual: {
                body: '#2c8217', pips: '#f7d746',
                specular: 0.08, edgeR: 0.13,
                pipR: { default: 0.12, 1: 0.22 },
                pipColors: { default: '#f7d746', 1: '#c8b87a' },
                marks: [{ face: 1, shape: 'frogEye', color: '#070808' }]
            }
        },

        oneLove: {
            id: 'oneLove', name: 'One Love', rarity: 'common', utility: false, maxLevel: 1,
            desc: 'Higher chance of rolling 1 (30%).',
            ability: { type: 'bias', passive: true },
            weights: [
                { 1: 0.30, 2: 0.14, 3: 0.14, 4: 0.14, 5: 0.14, 6: 0.14 }
            ],
            biasOffset: 0.41,
            biasFace: 1,
            visual: {
                body: '#ff5ccd', pips: '#ffffff',
                specular: 0.1, edgeR: 0.2,
                pipR: { default: 0.09, 1: 0.28 },
                pipShape: { default: 'circle', 1: 'heart' },
                pipColors: { default: '#ffffff', 1: '#ff0000' }
            }
        },

        comrade: {
            id: 'comrade', name: 'Comrade', rarity: 'common', utility: false, maxLevel: 1,
            desc: 'Higher chance of rolling 5 (30%).',
            ability: { type: 'bias', passive: true },
            weights: [
                { 1: 0.14, 2: 0.14, 3: 0.14, 4: 0.14, 5: 0.30, 6: 0.14 }
            ],
            biasOffset: 0.41,
            biasFace: 5,
            visual: {
                body: '#cc0000', pips: '#ffd700',
                pipShape: { default: 'circle', 5: 'star5' },
                specular: 0, edgeR: 0.02, pipR: { default: 0.1, 5: 0.15 }
            }
        },

        flipper: {
            id: 'flipper', name: 'Flipper', rarity: 'common', utility: false, maxLevel: 3,
            desc: 'Flip a die to its opposite face once per turn. 1\u21946  2\u21945  3\u21944',
            ability: { type: 'flip', button: 'FLIP', passive: false },
            weights: null,
            visual: {
                body: '#2878a8', pips: '#f0ece2',
                specular: 0.14, edgeR: 0.18, pipR: 0.105,
                skipNotchFaces: [1],
                pipShape: { default: 'circle', 1: 'hidden' },
                marks: [{ face: 1, shape: 'dolphin', color: '#f0ece2' }]
            }
        },

        evenDie: {
            id: 'evenDie', name: 'Even Die', rarity: 'common', utility: false, maxLevel: 3,
            desc: 'Higher chance of rolling even numbers (2, 4, 6).',
            ability: { type: 'bias', passive: true },
            weights: [
                { 1: 0.083, 2: 0.25,  3: 0.083, 4: 0.25,  5: 0.083, 6: 0.25  },
                { 1: 0.05,  2: 0.283, 3: 0.05,  4: 0.283, 5: 0.05,  6: 0.283 },
                { 1: 0.033, 2: 0.30,  3: 0.033, 4: 0.30,  5: 0.033, 6: 0.30  }
            ],
            biasOffset: 0.55,
            biasFaces: [2, 4, 6],
            visual: { body: 'white', pips: 'black' }
        },

        oddDie: {
            id: 'oddDie', name: 'Odd Die', rarity: 'common', utility: false, maxLevel: 3,
            desc: 'Higher chance of rolling odd numbers (1, 3, 5).',
            ability: { type: 'bias', passive: true },
            weights: [
                { 1: 0.25,  2: 0.083, 3: 0.25,  4: 0.083, 5: 0.25,  6: 0.083 },
                { 1: 0.283, 2: 0.05,  3: 0.283, 4: 0.05,  5: 0.283, 6: 0.05  },
                { 1: 0.30,  2: 0.033, 3: 0.30,  4: 0.033, 5: 0.30,  6: 0.033 }
            ],
            biasOffset: 0.55,
            biasFaces: [1, 3, 5],
            visual: { body: 'white', pips: 'black' }
        },

        mathematician: {
            id: 'mathematician', name: 'Mathematician Die', rarity: 'common', utility: false, maxLevel: 1,
            desc: 'π tribute — faces 3, 1, 4 come up more often.',
            ability: { type: 'bias', passive: true },
            weights: [
                { 1: 0.20, 2: 0.14, 3: 0.24, 4: 0.14, 5: 0.14, 6: 0.14 }
            ],
            biasOffset: 0.325,
            biasFaces: [1, 3, 3],
            visual: {
                body: '#1a1a1a', pips: '#66ff66',
                specular: 0.05, edgeR: 0.10, pipR: 0.105,
                notchD: 0,
                marks: [
                    { face: 1, shape: 'seg7', text: '1', color: '#66ff66' },
                    { face: 2, shape: 'seg7', text: '2', color: '#66ff66' },
                    { face: 3, shape: 'seg7_314', color: '#66ff66' },
                    { face: 4, shape: 'seg7', text: '4', color: '#66ff66' },
                    { face: 5, shape: 'seg7', text: '5', color: '#66ff66' },
                    { face: 6, shape: 'seg7', text: '6', color: '#66ff66' }
                ],
                pipShape: { default: 'hidden' }
            }
        },

        cluster: {
            id: 'cluster', name: 'Cluster Die', rarity: 'common', utility: false, maxLevel: 3,
            desc: 'Biased towards 2, 3, 4, 6 — builds sets fast.',
            ability: { type: 'bias', passive: true, synergy: ['oneLove', 'comrade'] },
            weights: [
                { 1: 0.10, 2: 0.20, 3: 0.20, 4: 0.20, 5: 0.10, 6: 0.20 },
                { 1: 0.075, 2: 0.2125, 3: 0.2125, 4: 0.2125, 5: 0.075, 6: 0.2125 },
                { 1: 0.05, 2: 0.225, 3: 0.225, 4: 0.225, 5: 0.05, 6: 0.225 }
            ],
            visual: { body: 'white', pips: 'black' }
        },

        bounce: {
            id: 'bounce', name: 'Bounce Die', rarity: 'common', utility: false, maxLevel: 3,
            desc: 'On bust, one random die re-rolls itself.',
            ability: { type: 'bounce', passive: true },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        slime: {
            id: 'slime', name: 'Slime Die', rarity: 'common', utility: false, maxLevel: 3,
            desc: 'Rolling 6 spawns an extra temporary die.',
            ability: { type: 'spawn', passive: true, trigger: 6 },
            weights: null,
            visual: { body: '#4caf50', pips: 'white' }
        },

        bridge: {
            id: 'bridge', name: 'Bridge Die', rarity: 'common', utility: false, maxLevel: 3,
            desc: 'Fills a gap of 1 in a straight sequence.',
            ability: { type: 'bridge', passive: true },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        match: {
            id: 'match', name: 'Match Die', rarity: 'common', utility: false, maxLevel: 3,
            desc: 'Copies the value of an adjacent die (2, 3, 4, 6).',
            ability: { type: 'match', passive: true, validFaces: [2, 3, 4, 6] },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        chain: {
            id: 'chain', name: 'Chain Die', rarity: 'common', utility: false, maxLevel: 3,
            desc: 'Links with identical neighbours for bonus points.',
            ability: { type: 'chain', passive: true },
            weights: null,
            visual: { body: '#8d6e63', pips: 'chain-marks', marks: 'CH badge' }
        },

        shrinking: {
            id: 'shrinking', name: 'Shrinking Die', rarity: 'common', utility: false, maxLevel: 1,
            desc: 'Each roll decreases its value by 1.',
            ability: { type: 'directional', passive: true, step: -1 },
            weights: null,
            visual: { body: 'white', pips: 'number' }
        },

        growing: {
            id: 'growing', name: 'Growing Die', rarity: 'common', utility: false, maxLevel: 1,
            desc: 'Each roll increases its value by 1.',
            ability: { type: 'directional', passive: true, step: 1 },
            weights: null,
            visual: { body: 'white', pips: 'number' }
        },

        // ─── Common Utility ────────────────────────────────────────────

        bandie: {
            id: 'bandie', name: 'Bandie', rarity: 'common', utility: U, maxLevel: 3,
            desc: 'Heals you for a flat amount each turn.',
            ability: { type: 'heal_self', passive: true },
            healPerLevel: [100, 200, 300],
            weights: null,
            visual: { body: 'white', pips: 'red', marks: 'red cross' }
        },

        pulse: {
            id: 'pulse', name: 'Pulse Die', rarity: 'common', utility: U, maxLevel: 3,
            desc: 'Heals per die scored this turn.',
            ability: { type: 'heal_packet', passive: true },
            healPerDiePerLevel: [100, 200, 300],
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        // ─── Rare ──────────────────────────────────────────────────────

        tuner: {
            id: 'tuner', name: 'Tuner', rarity: 'rare', utility: false, maxLevel: 3,
            desc: 'Manually set this die to any face value.',
            ability: { type: 'tune', button: 'TUNE', passive: false },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        royalI: {
            id: 'royalI', name: 'Royal I', rarity: 'rare', utility: false, maxLevel: 1,
            desc: '+150 bonus when scoring a straight.',
            ability: { type: 'straight_bonus', passive: true, bonus: 150 },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        forgeI: {
            id: 'forgeI', name: 'Forge I', rarity: 'rare', utility: false, maxLevel: 1,
            desc: '+100 bonus when scoring a set (3+ of a kind).',
            ability: { type: 'set_bonus', passive: true, bonus: 100 },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        pin: {
            id: 'pin', name: 'Pin Die', rarity: 'rare', utility: false, maxLevel: 1,
            desc: 'Keeps its value between rolls.',
            ability: { type: 'pin', passive: true },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        devil: {
            id: 'devil', name: 'Devil Die', rarity: 'rare', utility: false, maxLevel: 1,
            desc: 'Acts as a joker — counts as any value.',
            ability: { type: 'devil', passive: true },
            weights: null,
            visual: { body: '#d32f2f', pips: 'white' }
        },

        mimic: {
            id: 'mimic', name: 'Mimic Die', rarity: 'rare', utility: false, maxLevel: 1,
            desc: 'Copy another die\'s value.',
            ability: { type: 'mimic', button: 'MIMIC', passive: false },
            weights: null,
            visual: { body: 'gray', pips: 'black', marks: 'copy sign' }
        },

        clone: {
            id: 'clone', name: 'Clone Die', rarity: 'rare', utility: false, maxLevel: 1,
            desc: 'Duplicate a scored die for double value.',
            ability: { type: 'clone', button: 'CLONE', passive: false },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        blight: {
            id: 'blight', name: 'Blight Die', rarity: 'rare', utility: false, maxLevel: 1,
            desc: 'Infect an enemy die, locking its value.',
            ability: { type: 'infect', button: 'INFECT', passive: false },
            weights: null,
            visual: { body: '#76ff03', pips: 'red', marks: 'biohazard on face 1' }
        },

        sacriDice: {
            id: 'sacriDice', name: 'SacriDice', rarity: 'rare', utility: false, maxLevel: 1,
            desc: 'Sacrifice this die for a large score boost.',
            ability: { type: 'sacrifice', button: 'SACRIFICE', passive: false },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        gravity: {
            id: 'gravity', name: 'Gravity Die', rarity: 'rare', utility: false, maxLevel: 1,
            desc: 'Pulls nearby dice towards matching values.',
            ability: { type: 'gravity', passive: true },
            weights: null,
            visual: { body: '#4a148c', pips: 'moon', marks: 'G on face 1' }
        },

        mirror: {
            id: 'mirror', name: 'Mirror Die', rarity: 'rare', utility: false, maxLevel: 3,
            desc: 'Rotate to a side face — weighted towards 1 and 5.',
            ability: { type: 'mirror', button: 'MIRROR', passive: false },
            sideFaces: {
                1: [2, 3, 5, 4],
                2: [1, 4, 6, 3],
                3: [1, 2, 6, 5],
                4: [1, 5, 6, 2],
                5: [1, 3, 6, 4],
                6: [2, 4, 5, 3]
            },
            mirrorWeights: [
                null,
                { 1: 1.75, 5: 1.50 },
                { 1: 2.50, 5: 2.00 }
            ],
            weights: null,
            visual: { body: '#42a5f5', pips: 'sparkle' }
        },

        yin: {
            id: 'yin', name: 'Yin', rarity: 'rare', utility: false, maxLevel: 1,
            desc: 'Paired with Yang — Yang mirrors Yin\'s opposite face.',
            ability: { type: 'yinyang', passive: true, role: 'leader', partner: 'yang' },
            complement: { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        yang: {
            id: 'yang', name: 'Yang', rarity: 'rare', utility: false, maxLevel: 1,
            desc: 'Paired with Yin — automatically shows the opposite face.',
            ability: { type: 'yinyang', passive: true, role: 'follower', partner: 'yin' },
            complement: { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 },
            weights: null,
            visual: { body: 'black', pips: 'white' }
        },

        // ─── Rare Utility ──────────────────────────────────────────────

        leech: {
            id: 'leech', name: 'Leech Die', rarity: 'rare', utility: U, maxLevel: 3,
            desc: 'Heal for a % of damage dealt.',
            ability: { type: 'leech', passive: true },
            healPctPerLevel: [0.20, 0.30, 0.40],
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        transfusion: {
            id: 'transfusion', name: 'Transfusion Die', rarity: 'rare', utility: U, maxLevel: 1,
            desc: 'Converts excess damage into healing.',
            ability: { type: 'transfusion', passive: true },
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        secondWind: {
            id: 'secondWind', name: 'Second Wind Die', rarity: 'rare', utility: U, maxLevel: 3,
            desc: 'Saves you from a lethal hit once per battle.',
            ability: { type: 'second_wind', passive: true },
            thresholds: [
                { triggerBelow: 0.50, lethalSave: true, healDelay: 300 },
                { triggerBelow: 0.50, lethalSave: true, healDelay: 500 },
                { triggerBelowHP: 500, lethalSave: true, healDelay: 1000 }
            ],
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        siphon: {
            id: 'siphon', name: 'Siphon Die', rarity: 'rare', utility: U, maxLevel: 3,
            desc: 'Restores HP equal to a % of your round score.',
            ability: { type: 'siphon', passive: true },
            restorePctPerLevel: [0.10, 0.20, 0.30],
            weights: null,
            visual: { body: 'white', pips: 'black' }
        },

        // ─── Exotic ────────────────────────────────────────────────────

        joker: {
            id: 'joker', name: 'Joker', rarity: 'exotic', utility: false, maxLevel: 1,
            desc: 'Wild card — adds 1 to any combination.',
            ability: { type: 'joker', passive: true, activeFace: 1 },
            weights: null,
            visual: {
                body: '#d54141', pips: '#ffffff',
                specular: 0.12,
                pipShape: { default: 'circle', 1: 'hidden' },
                marks: [{ face: 1, shape: 'letter', text: 'J', color: '#ffffff' }]
            }
        }
    }

    // Opposite-face mapping shared by Flipper and Yin/Yang
    var OPPOSITES = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 }

    // Loadout rules (§8.2)
    var LOADOUT = {
        SLOTS: 6,
        DEFAULT_FILL: 'base'
    }

    // Rarity sort order
    var RARITY_ORDER = { base: 0, common: 1, rare: 2, exotic: 3 }

    var IMPLEMENTED = [
        'base', 'frog', 'oneLove', 'comrade',
        'evenDie', 'oddDie', 'flipper'
    ]

    window.DICE = {
        roster:       roster,
        OPPOSITES:    OPPOSITES,
        LOADOUT:      LOADOUT,
        RARITY_ORDER: RARITY_ORDER,
        IMPLEMENTED:  IMPLEMENTED
    }

})()
