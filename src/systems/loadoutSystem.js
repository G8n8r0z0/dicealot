// Loadout state slice — 6 slots, null = base die.
// Actions: SET_LOADOUT

;(function() {
    'use strict'

    function defaultSlots() {
        var s = ['oneLove', 'comrade']
        while (s.length < DICE.LOADOUT.SLOTS) s.push(null)
        return s
    }

    var loadoutSystem = {
        init: function(store) {
            store.state.loadout = {
                slots: defaultSlots()
            }

            store.register('SET_LOADOUT', function(state, payload) {
                var next = []
                for (var i = 0; i < DICE.LOADOUT.SLOTS; i++) {
                    next.push(payload.slots[i] || null)
                }
                state.loadout.slots = next
            }, 'loadout')
        }
    }

    window.loadoutSystem = loadoutSystem
})()
