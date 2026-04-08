// Scoring engine — pure evaluation functions, no state.
// Depends on: window.SCORING (config/scoring.js)
// Loaded via <script> tag — exports to window.scoringSystem.

;(function() {
    'use strict'

    var S = window.SCORING

    // ── Straight lookup (built once from config) ───────────────────────

    var STRAIGHT_MAP = {}
    for (var i = 0; i < S.STRAIGHTS.length; i++) {
        STRAIGHT_MAP[S.STRAIGHTS[i].faces.join(',')] = S.STRAIGHTS[i].score
    }

    // ── Primitive group scoring ────────────────────────────────────────
    // Evaluates a single indivisible group of dice values.
    // Returns { valid, score }

    function getPrimitiveScore(values) {
        var n = values.length
        if (n === 0) return { valid: false, score: 0 }

        // Straight check (sorted key lookup)
        var sorted = values.slice().sort(function(a, b) { return a - b })
        var key = sorted.join(',')
        if (STRAIGHT_MAP[key]) {
            return { valid: true, score: STRAIGHT_MAP[key] }
        }

        // Single die
        if (n === 1) {
            var s = S.SINGLES[values[0]]
            return s ? { valid: true, score: s } : { valid: false, score: 0 }
        }

        // N-of-a-kind (all same, count >= 3)
        if (n >= 3) {
            var face = values[0]
            var allSame = true
            for (var j = 1; j < n; j++) {
                if (values[j] !== face) { allSame = false; break }
            }
            if (allSame) {
                var base = S.TRIPLE_BASE[face]
                var mult = S.N_OF_KIND_MULT[n]
                if (base !== undefined && mult !== undefined) {
                    return { valid: true, score: base * mult }
                }
            }
        }

        return { valid: false, score: 0 }
    }

    // ── Bitmask DP: optimal partition ──────────────────────────────────
    // Given an array of face values, find the partition into valid
    // primitive groups that maximizes total score.
    // ALL values must be covered — no leftovers.

    function scoreSelection(values) {
        var n = values.length
        if (n === 0) return { valid: false, score: 0, groups: [] }

        var memo = {}

        function solve(mask) {
            if (mask === 0) return { valid: true, score: 0, groups: [] }
            if (memo[mask] !== undefined) return memo[mask]

            var best = { valid: false, score: 0, groups: [] }
            var firstBit = mask & (-mask)

            for (var submask = mask; submask > 0; submask = (submask - 1) & mask) {
                if ((submask & firstBit) === 0) continue

                var subset = []
                for (var i = 0; i < n; i++) {
                    if (submask & (1 << i)) subset.push(values[i])
                }

                var prim = getPrimitiveScore(subset)
                if (!prim.valid) continue

                var remainder = solve(mask ^ submask)
                if (!remainder.valid) continue

                var total = prim.score + remainder.score
                if (!best.valid || total > best.score) {
                    best = {
                        valid: true,
                        score: total,
                        groups: [{ score: prim.score, values: subset }].concat(remainder.groups)
                    }
                }
            }

            memo[mask] = best
            return best
        }

        return solve((1 << n) - 1)
    }

    // ── Player packet scoring ──────────────────────────────────────────
    // A "packet" is a contiguous sub-sequence from the player's
    // click-ordered selection. It can be:
    //   (a) a valid primitive group, OR
    //   (b) a "singles packet" — all values are 1 or 5, each scored
    //       individually (allows [1,5] or [1,1,5] as one click-packet).
    // Returns the higher-scoring interpretation.

    function scorePacket(values) {
        var n = values.length
        if (n === 0) return { valid: false, score: 0, groups: [] }

        var bestScore = -1
        var bestGroups = []
        var bestValid = false

        // Candidate (a): primitive group
        var prim = getPrimitiveScore(values)
        if (prim.valid) {
            bestValid = true
            bestScore = prim.score
            bestGroups = [{ score: prim.score, values: values.slice() }]
        }

        // Candidate (b): all singles (every value must be 1 or 5)
        var singlesTotal = 0
        var allSingles = true
        for (var i = 0; i < n; i++) {
            var sv = S.SINGLES[values[i]]
            if (!sv) { allSingles = false; break }
            singlesTotal += sv
        }
        if (allSingles) {
            if (!bestValid || singlesTotal > bestScore) {
                bestValid = true
                bestScore = singlesTotal
                bestGroups = values.map(function(v) {
                    return { score: S.SINGLES[v], values: [v] }
                })
            }
        }

        return bestValid
            ? { valid: true, score: bestScore, groups: bestGroups }
            : { valid: false, score: 0, groups: [] }
    }

    // ── Player selection: contiguous-packet decomposition ──────────────
    // Splits the click-ordered selection into contiguous packets,
    // each scored via scorePacket. Maximizes total score.
    //
    // If no full decomposition works but valid packets exist inside
    // the selection, returns { valid:false, ambiguous:true } as a hint
    // to try a different click order or use board-order fallback.

    function scorePlayerSelection(values) {
        var n = values.length
        if (n === 0) return { valid: false, score: 0, groups: [] }

        var memo = {}

        function solve(start) {
            if (start === n) return { valid: true, score: 0, groups: [] }
            if (memo[start] !== undefined) return memo[start]

            var best = { valid: false, score: 0, groups: [] }

            for (var end = start; end < n; end++) {
                var packet = scorePacket(values.slice(start, end + 1))
                if (!packet.valid) continue

                var remainder = solve(end + 1)
                if (!remainder.valid) continue

                var total = packet.score + remainder.score
                if (!best.valid || total > best.score) {
                    best = {
                        valid: true,
                        score: total,
                        groups: packet.groups.concat(remainder.groups)
                    }
                }
            }

            memo[start] = best
            return best
        }

        var result = solve(0)
        if (result.valid) return result

        // Ambiguity check: are there ANY valid contiguous packets?
        for (var s = 0; s < n; s++) {
            for (var e = s; e < n; e++) {
                if (scorePacket(values.slice(s, e + 1)).valid) {
                    return { valid: false, score: 0, groups: [], ambiguous: true }
                }
            }
        }

        return { valid: false, score: 0, groups: [] }
    }

    // ── Bust detection ─────────────────────────────────────────────────
    // Returns true if at least one non-empty subset of the given values
    // forms a valid scoring combination.

    function hasPlayableDice(values) {
        var n = values.length
        for (var mask = 1; mask < (1 << n); mask++) {
            var subset = []
            for (var i = 0; i < n; i++) {
                if (mask & (1 << i)) subset.push(values[i])
            }
            if (getPrimitiveScore(subset).valid) return true
        }
        return false
    }

    // ── Public API ─────────────────────────────────────────────────────

    window.scoringSystem = {
        scoreSelection:       scoreSelection,
        scorePlayerSelection: scorePlayerSelection,
        scorePacket:          scorePacket,
        hasPlayableDice:      hasPlayableDice,
        _getPrimitiveScore:   getPrimitiveScore
    }

})()
