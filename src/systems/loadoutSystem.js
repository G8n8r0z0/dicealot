// Loadout state slice — 6 slots, null = base die.
// Actions: SET_LOADOUT
// Persists to localStorage under 'diceALot_loadout'.

;(function() {
    'use strict'

    var STORAGE_KEY = 'diceALot_loadout'

    function defaultSlots() {
        var s = ['oneLove', 'comrade']
        while (s.length < DICE.LOADOUT.SLOTS) s.push(null)
        return s
    }

    function loadSaved() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return null
            var arr = JSON.parse(raw)
            if (!Array.isArray(arr) || arr.length !== DICE.LOADOUT.SLOTS) return null
            return arr
        } catch (_) { return null }
    }

    function persist(slots) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)) } catch (_) {}
    }

    var loadoutSystem = {
        init: function(store) {
            store.state.loadout = {
                slots: loadSaved() || defaultSlots()
            }

            store.register('SET_LOADOUT', function(state, payload) {
                var next = []
                for (var i = 0; i < DICE.LOADOUT.SLOTS; i++) {
                    next.push(payload.slots[i] || null)
                }
                state.loadout.slots = next
                persist(next)
            }, 'loadout')
        }
    }

    window.loadoutSystem = loadoutSystem
})()
