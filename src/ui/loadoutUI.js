// Loadout editor modal — two modes: 'rules' (read-only) and 'loadout' (editable).
// mount(store) caches DOM, binds both buttons. open/close/save.
// Slots: CSS pip faces. Detail: interactive 3D BabylonJS preview via bridge3D.

;(function() {
    'use strict'

    var _store
    var _el = {}
    var _editing = []
    var _selectedSlot = null
    var _3dPreview = null
    var _mode = 'rules'

    var PIP_MAP = {
        1: [4],
        2: [2, 6],
        3: [2, 4, 6],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    }

    function pipFaceHTML(faceValue) {
        var cells = PIP_MAP[faceValue] || PIP_MAP[1]
        var h = '<div class="lo-die-face">'
        for (var i = 0; i < 9; i++) {
            var vis = cells.indexOf(i) !== -1
            h += '<span class="lo-pip' + (vis ? '' : ' lo-pip-hide') + '"></span>'
        }
        h += '</div>'
        return h
    }

    function mount(store) {
        _store = store
        _el.rulesBtn   = document.getElementById('rulesBtn')
        _el.loadoutBtn = document.getElementById('loadoutBtn')
        _el.modal      = document.getElementById('loadoutModal')
        _el.backdrop   = document.getElementById('loadoutBackdrop')
        _el.closeBtn   = document.getElementById('closeLoadoutBtn')
        _el.saveBtn    = document.getElementById('saveLoadoutBtn')
        _el.clearBtn   = document.getElementById('clearLoadoutBtn')
        _el.footer     = _el.modal.querySelector('.lo-footer')
        _el.slots      = document.getElementById('loadoutSlots')
        _el.left       = document.getElementById('loadoutLeft')
        _el.leftLabel  = document.getElementById('loadoutLeftLabel')
        _el.detail     = document.getElementById('loadoutDetail')

        _el.rulesBtn.onclick   = function() { openAs('rules') }
        _el.loadoutBtn.onclick = function() { openAs('loadout') }
        _el.closeBtn.onclick   = close
        _el.backdrop.onclick   = close
        _el.saveBtn.onclick    = save
        _el.clearBtn.onclick   = clearLoadout
    }

    // ── open / close / save ──────────────────────────────────────────────

    function openAs(mode) {
        _mode = mode
        _editing = _store.state.loadout.slots.slice()
        _selectedSlot = null
        render()
        _el.backdrop.style.display = 'block'
        _el.modal.style.display = 'grid'
    }

    function close() {
        dispose3D()
        _el.backdrop.style.display = 'none'
        _el.modal.style.display = 'none'
    }

    function save() {
        _store.dispatch('SET_LOADOUT', { slots: _editing.slice() })
        close()
    }

    function clearLoadout() {
        for (var i = 0; i < _editing.length; i++) _editing[i] = null
        _selectedSlot = null
        render()
    }

    function dispose3D() {
        if (_3dPreview) {
            _3dPreview.dispose()
            _3dPreview = null
        }
    }

    // ── render ────────────────────────────────────────────────────────────

    function render() {
        dispose3D()

        if (_mode === 'rules') {
            _el.footer.style.display = 'none'
            _el.leftLabel.textContent = 'GAME RULES'
            _el.left.classList.add('lo-rules')
            renderGameRules()
        } else {
            _el.footer.style.display = 'flex'
            _el.leftLabel.textContent = 'INVENTORY'
            _el.left.classList.remove('lo-rules')
            renderInventory()
        }

        renderSlots()
        renderDetail()
    }

    function getDieDef(slotId) {
        if (slotId && window.DICE && window.DICE.roster[slotId]) return window.DICE.roster[slotId]
        return window.DICE && window.DICE.roster.base || { name: 'Base Die', rarity: 'base' }
    }

    function renderSlots() {
        _el.slots.innerHTML = ''
        for (var i = 0; i < _editing.length; i++) {
            var sel = _selectedSlot === i
            var def = getDieDef(_editing[i])
            var vis = def.visual || {}

            var s = document.createElement('div')
            s.className = 'lo-slot filled' + (sel ? ' selected' : '')
            s.dataset.index = i

            var well = document.createElement('div')
            well.className = 'lo-slot-well'
            if (sel) well.style.borderColor = 'rgba(239,193,74,.7)'
            well.innerHTML = pipFaceHTML(1)
            var face = well.querySelector('.lo-die-face')
            if (face && vis.body && vis.body !== 'white') face.style.backgroundColor = vis.body
            if (vis.pips && vis.pips !== 'black') {
                var dots = well.querySelectorAll('.lo-pip:not(.lo-pip-hide)')
                for (var d = 0; d < dots.length; d++) dots[d].style.backgroundColor = vis.pips
            }

            var label = document.createElement('div')
            label.className = 'lo-slot-name'
            label.textContent = def.name

            s.appendChild(well)
            s.appendChild(label)
            _el.slots.appendChild(s)

            s.onclick = (function(idx) {
                return function() {
                    _selectedSlot = idx
                    render()
                }
            })(i)
        }
    }

    // ── inventory (loadout mode) ─────────────────────────────────────────

    function renderInventory() {
        var roster = window.DICE && window.DICE.roster
        if (!roster) { _el.left.innerHTML = '<div class="lo-empty-msg">No dice available</div>'; return }

        var order = window.DICE.RARITY_ORDER || {}
        var keys = Object.keys(roster).sort(function(a, b) {
            var ra = order[roster[a].rarity] || 0, rb = order[roster[b].rarity] || 0
            return ra - rb || a.localeCompare(b)
        })

        _el.left.innerHTML = ''
        for (var k = 0; k < keys.length; k++) {
            var def = roster[keys[k]]
            var vis = def.visual || {}
            var tile = document.createElement('div')
            tile.className = 'lo-tile'
            tile.dataset.dieId = def.id

            var well = document.createElement('div')
            well.className = 'lo-slot-well'
            well.innerHTML = pipFaceHTML(1)
            var face = well.querySelector('.lo-die-face')
            if (face && vis.body && vis.body !== 'white') face.style.backgroundColor = vis.body
            if (vis.pips && vis.pips !== 'black') {
                var dots = well.querySelectorAll('.lo-pip:not(.lo-pip-hide)')
                for (var d = 0; d < dots.length; d++) dots[d].style.backgroundColor = vis.pips
            }

            var label = document.createElement('div')
            label.className = 'lo-tile-label'
            label.textContent = def.name

            tile.appendChild(well)
            tile.appendChild(label)
            _el.left.appendChild(tile)

            tile.onclick = (function(id) {
                return function() {
                    if (_selectedSlot !== null) {
                        _editing[_selectedSlot] = id
                        render()
                    }
                }
            })(def.id)
        }
    }

    // ── rules (rules mode) ──────────────────────────────────────────────

    function miniDice(values) {
        var h = '<span class="combo-dice">'
        for (var i = 0; i < values.length; i++) h += pipFaceHTML(values[i])
        h += '</span>'
        return h
    }

    function renderGameRules() {
        var S = window.STRINGS
        var h = ''
        h += '<h3>Goal</h3><p>' + S.RULES_GOAL + '</p>'
        h += '<h3>How to Play</h3><p>' + S.RULES_HOW + '</p>'

        h += '<h3>Scoring Combos</h3>'
        h += '<table>'
        h += '<tr><th>Combo</th><th>Points</th></tr>'
        h += '<tr><td>' + miniDice([1]) + ' Single 1</td><td>100</td></tr>'
        h += '<tr><td>' + miniDice([5]) + ' Single 5</td><td>50</td></tr>'
        h += '<tr><td>' + miniDice([1,1,1]) + ' Three 1s</td><td>1 000</td></tr>'
        h += '<tr><td>' + miniDice([2,2,2]) + ' Three 2s</td><td>200</td></tr>'
        h += '<tr><td>' + miniDice([3,3,3]) + ' Three 3s</td><td>300</td></tr>'
        h += '<tr><td>' + miniDice([4,4,4]) + ' Three 4s</td><td>400</td></tr>'
        h += '<tr><td>' + miniDice([5,5,5]) + ' Three 5s</td><td>500</td></tr>'
        h += '<tr><td>' + miniDice([6,6,6]) + ' Three 6s</td><td>600</td></tr>'
        h += '<tr><td>' + miniDice([2,2,2,2]) + ' Four of a Kind</td><td>Three \u00d72</td></tr>'
        h += '<tr><td>' + miniDice([2,2,2,2,2]) + ' Five of a Kind</td><td>Three \u00d74</td></tr>'
        h += '<tr><td>' + miniDice([2,2,2,2,2,2]) + ' Six of a Kind</td><td>Three \u00d78</td></tr>'
        h += '<tr><td>' + miniDice([1,2,3,4,5]) + ' Short 1-5</td><td>500</td></tr>'
        h += '<tr><td>' + miniDice([2,3,4,5,6]) + ' Short 2-6</td><td>750</td></tr>'
        h += '<tr><td>' + miniDice([1,2,3,4,5,6]) + ' Full Straight</td><td>1 500</td></tr>'
        h += '</table>'

        _el.left.innerHTML = h
    }

    // ── detail panel ─────────────────────────────────────────────────────

    function renderDetail() {
        if (_selectedSlot === null) {
            _el.detail.innerHTML = '<div class="lo-detail-placeholder">Select a die to inspect</div>'
            return
        }

        var def = getDieDef(_editing[_selectedSlot])

        _el.detail.innerHTML = ''

        var card = document.createElement('div')
        card.className = 'lo-detail-card'

        var canvasWrap = document.createElement('div')
        canvasWrap.className = 'lo-detail-3d-wrap'

        var canvas = document.createElement('canvas')
        canvas.className = 'lo-detail-3d'
        canvas.width = 280
        canvas.height = 280
        canvasWrap.appendChild(canvas)
        card.appendChild(canvasWrap)

        var hint = document.createElement('div')
        hint.className = 'lo-detail-hint lo-hint-hidden'
        hint.textContent = 'drag to rotate'
        card.appendChild(hint)

        var name = document.createElement('div')
        name.className = 'lo-detail-name'
        name.textContent = def.name
        card.appendChild(name)

        var rarity = document.createElement('div')
        rarity.className = 'lo-detail-rarity lo-rarity-' + def.rarity
        rarity.textContent = def.rarity.toUpperCase()
        card.appendChild(rarity)

        if (def.desc) {
            var desc = document.createElement('div')
            desc.className = 'lo-detail-desc'
            desc.textContent = def.desc
            card.appendChild(desc)
        }

        _el.detail.appendChild(card)

        if (window.bridge3D && window.bridge3D.renderSlotPreview) {
            try {
                _3dPreview = window.bridge3D.renderSlotPreview(canvas, 1, {
                    dieId: _editing[_selectedSlot] || null,
                    onSettle: function() {
                        hint.classList.remove('lo-hint-hidden')
                    }
                })
            } catch (_) {}
        }
    }

    window.loadoutUI = { mount: mount }
})()
