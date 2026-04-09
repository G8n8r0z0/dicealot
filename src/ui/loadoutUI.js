// Loadout editor modal — click-to-place, detail panel.
// mount(store) caches DOM, binds button. open/close/save.

;(function() {
    'use strict'

    var _store
    var _el = {}
    var _editing = []
    var _selectedSlot = null
    var _selectedInvId = null

    function mount(store) {
        _store = store
        _el.btn        = document.getElementById('loadoutBtn')
        _el.modal      = document.getElementById('loadoutModal')
        _el.backdrop   = document.getElementById('loadoutBackdrop')
        _el.closeBtn   = document.getElementById('closeLoadoutBtn')
        _el.saveBtn    = document.getElementById('saveLoadoutBtn')
        _el.slots      = document.getElementById('loadoutSlots')
        _el.inv        = document.getElementById('loadoutInventory')
        _el.detail     = document.getElementById('loadoutDetail')

        _el.btn.onclick       = open
        _el.closeBtn.onclick  = close
        _el.backdrop.onclick  = close
        _el.saveBtn.onclick   = save
    }

    // ── open / close / save ──────────────────────────────────────────────

    function open() {
        _editing = _store.state.loadout.slots.slice()
        _selectedSlot = null
        _selectedInvId = null
        render()
        _el.backdrop.style.display = 'block'
        _el.modal.style.display = 'grid'
    }

    function close() {
        _el.backdrop.style.display = 'none'
        _el.modal.style.display = 'none'
    }

    function save() {
        _store.dispatch('SET_LOADOUT', { slots: _editing.slice() })
        close()
    }

    // ── render ────────────────────────────────────────────────────────────

    function render() {
        renderSlots()
        renderInventory()
        renderDetail()
    }

    function dieColor(def) {
        var b = def.visual.body
        if (b === 'white' || b === 'ivory') return '#e8e8ee'
        if (b === 'pink') return '#e091a0'
        if (b === 'gray') return '#888'
        return b
    }

    function renderSlots() {
        _el.slots.innerHTML = ''
        for (var i = 0; i < _editing.length; i++) {
            var id  = _editing[i]
            var def = id ? DICE.roster[id] : DICE.roster.base
            var sel = _selectedSlot === i

            var s = document.createElement('div')
            s.className = 'lo-slot' + (sel ? ' selected' : '') + (id ? ' filled' : '')
            s.innerHTML =
                '<div class="lo-slot-well" style="border-color:' + (sel ? 'rgba(239,193,74,.7)' : '') + '">' +
                    '<div class="lo-slot-icon" style="background:' + dieColor(def) + '"></div>' +
                '</div>' +
                '<div class="lo-slot-name">' + def.name + '</div>'
            s.dataset.index = i
            s.onclick = function(e) {
                var idx = Number(e.currentTarget.dataset.index)
                _selectedSlot = idx
                _selectedInvId = null
                render()
            }
            _el.slots.appendChild(s)
        }
    }

    function renderInventory() {
        _el.inv.innerHTML = ''

        var used = {}
        for (var i = 0; i < _editing.length; i++) {
            if (_editing[i]) used[_editing[i]] = true
        }

        var available = []
        var keys = Object.keys(DICE.roster)
        for (var k = 0; k < keys.length; k++) {
            var d = DICE.roster[keys[k]]
            if (d.rarity === 'base') continue
            if (used[d.id]) continue
            available.push(d)
        }

        if (available.length === 0) {
            _el.inv.innerHTML = '<div class="lo-empty-msg">No special dice available yet</div>'
            return
        }

        for (var j = 0; j < available.length; j++) {
            var die = available[j]
            var tile = document.createElement('div')
            tile.className = 'lo-tile' + (_selectedInvId === die.id ? ' selected' : '')
            tile.innerHTML =
                '<div class="lo-tile-icon" style="background:' + dieColor(die) + '"></div>' +
                '<div class="lo-tile-label">' + die.name + '</div>'
            tile.dataset.id = die.id
            tile.onclick = function(e) {
                _selectedInvId = e.currentTarget.dataset.id
                _selectedSlot = null
                render()
            }
            _el.inv.appendChild(tile)
        }
    }

    function renderDetail() {
        var dieId = null
        var isSlot = false

        if (_selectedInvId) {
            dieId = _selectedInvId
        } else if (_selectedSlot !== null && _editing[_selectedSlot]) {
            dieId = _editing[_selectedSlot]
            isSlot = true
        }

        if (!dieId || !DICE.roster[dieId]) {
            _el.detail.innerHTML = '<div class="lo-detail-placeholder">Select a die to see details</div>'
            return
        }

        var def = DICE.roster[dieId]
        var rarityClass = 'lo-rarity-' + def.rarity

        var h = '<div class="lo-detail-card">' +
            '<div class="lo-detail-icon-wrap"><div class="lo-detail-icon" style="background:' + dieColor(def) + '"></div></div>' +
            '<div class="lo-detail-name">' + def.name + '</div>' +
            '<div class="lo-detail-rarity ' + rarityClass + '">' + def.rarity.toUpperCase() + (def.utility ? ' UTILITY' : '') + '</div>'

        if (def.ability) {
            var label = def.ability.button || def.ability.type
            h += '<div class="lo-detail-ability">' + label + (def.ability.passive ? ' &middot; passive' : ' &middot; active') + '</div>'
        }

        if (!isSlot) {
            h += '<button class="lo-action-btn lo-place-btn" id="loPlaceBtn">Place in Slot</button>'
        } else {
            if (dieId !== 'base') {
                h += '<button class="lo-action-btn lo-remove-btn" id="loRemoveBtn">Remove</button>'
            }
        }

        h += '</div>'
        _el.detail.innerHTML = h

        var plc = document.getElementById('loPlaceBtn')
        if (plc) plc.onclick = function() {
            if (!_selectedInvId) return
            var target = _selectedSlot
            if (target === null) {
                for (var i = 0; i < _editing.length; i++) {
                    if (!_editing[i]) { target = i; break }
                }
            }
            if (target === null) target = 0
            _editing[target] = _selectedInvId
            _selectedInvId = null
            _selectedSlot = target
            render()
        }

        var rem = document.getElementById('loRemoveBtn')
        if (rem) rem.onclick = function() {
            if (_selectedSlot === null) return
            _editing[_selectedSlot] = null
            _selectedSlot = null
            render()
        }
    }

    window.loadoutUI = { mount: mount }
})()
