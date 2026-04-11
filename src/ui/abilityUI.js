// Ability Panel UI — contextual action buttons for active-ability dice.
// Shows when exactly 1 on-table die with a non-passive ability is selected.
// Loaded via <script> tag — exports to window.abilityUI.

;(function () {
    'use strict'

    var _store
    var _el = {}
    var _unsub = null
    var _currentAbility = null

    var ABILITY_STYLE = {
        reroll:    { cls: 'frog',    label: 'JUMP' },
        flip:      { cls: 'flipper', label: 'FLIP' },
        tune:      { cls: 'tuner',   label: 'TUNE' },
        mirror:    { cls: 'mirror',  label: 'MIRROR' },
        mimic:     { cls: 'generic', label: 'MIMIC' },
        clone:     { cls: 'generic', label: 'CLONE' },
        infect:    { cls: 'generic', label: 'INFECT' },
        sacrifice: { cls: 'generic', label: 'SACRIFICE' }
    }

    function $(id) { return document.getElementById(id) }

    function getSelectedAbilityDie() {
        var t = _store.state.turn
        if (t.phase !== 'selecting') return null
        if (t.selectedIndices.length !== 1) return null
        if (_store.state.match.activePlayer !== 'player') return null

        var idx = t.selectedIndices[0]
        var slotMap = t.dieSlotMap || []
        var originalSlot = slotMap[idx]
        if (originalSlot === undefined) return null

        var slots = _store.state.loadout ? _store.state.loadout.slots : []
        var dieId = slots[originalSlot] || null
        if (!dieId || !window.DICE || !window.DICE.roster[dieId]) return null

        var def = window.DICE.roster[dieId]
        if (!def.ability || def.ability.passive !== false || !def.ability.button) return null

        return { index: idx, dieId: dieId, def: def, ability: def.ability }
    }

    function isAbilityUsed(abilityType) {
        var t = _store.state.turn
        if (abilityType === 'reroll') return !!t.jumpUsed
        if (abilityType === 'flip')   return !!t.flipUsed
        return false
    }

    function refresh() {
        var t = _store.state.turn
        if (t.phase === 'flipTargeting' || t.phase === 'flipping') {
            hide()
            return
        }

        var info = getSelectedAbilityDie()
        if (!info) {
            hide()
            return
        }

        var style = ABILITY_STYLE[info.ability.type] || { cls: 'generic', label: info.ability.button }
        var used = isAbilityUsed(info.ability.type)

        _el.mainBtn.className = 'ability-main-btn ' + style.cls
        _el.mainBtn.textContent = used ? 'USED' : style.label
        _el.mainBtn.disabled = used

        _el.subRow.innerHTML = ''

        _currentAbility = info
        show()
    }

    function show() {
        _el.panel.style.display = 'flex'
        requestAnimationFrame(function () {
            _el.panel.classList.add('visible')
        })
    }

    function hide() {
        _el.panel.classList.remove('visible')
        _currentAbility = null
        setTimeout(function () {
            if (!_el.panel.classList.contains('visible')) {
                _el.panel.style.display = 'none'
            }
        }, 220)
    }

    function onMainClick() {
        if (!_currentAbility) return
        if (_el.mainBtn.disabled) return
        _store.dispatch('USE_ABILITY', {
            dieIndex: _currentAbility.index,
            ability: _currentAbility.ability.type,
            dieId: _currentAbility.dieId
        })
    }

    window.abilityUI = {
        mount: function (store) {
            _store = store
            _el.panel   = $('abilityPanel')
            _el.mainBtn = $('abilityMainBtn')
            _el.subRow  = $('abilitySubRow')

            _el.mainBtn.addEventListener('click', onMainClick)

            _unsub = store.subscribe(function () { refresh() })
        },

        unmount: function () {
            if (_unsub) _unsub()
            _unsub = null
            hide()
        },

        refresh: refresh
    }
})()
