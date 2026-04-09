// Loadout editor modal — click-to-place, detail panel with interactive 3D die.
// mount(store) caches DOM, binds button. open/close/save.
// Slots: CSS pip faces. Detail: interactive 3D BabylonJS preview via bridge3D.

;(function() {
    'use strict'

    var _store
    var _el = {}
    var _editing = []
    var _selectedSlot = null
    var _3dPreview = null

    // ── pip layout: 9-cell grid (0-8), which cells get a dot per face value ──
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

    function dispose3D() {
        if (_3dPreview) {
            _3dPreview.dispose()
            _3dPreview = null
        }
    }

    // ── render ────────────────────────────────────────────────────────────

    function render() {
        dispose3D()
        renderSlots()
        renderInventory()
        renderDetail()
    }

    function renderSlots() {
        _el.slots.innerHTML = ''
        for (var i = 0; i < _editing.length; i++) {
            var sel = _selectedSlot === i

            var s = document.createElement('div')
            s.className = 'lo-slot filled' + (sel ? ' selected' : '')
            s.dataset.index = i

            var well = document.createElement('div')
            well.className = 'lo-slot-well'
            if (sel) well.style.borderColor = 'rgba(239,193,74,.7)'
            well.innerHTML = pipFaceHTML(1)

            var label = document.createElement('div')
            label.className = 'lo-slot-name'
            label.textContent = 'Base Die'

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

    function renderInventory() {
        _el.inv.innerHTML = '<div class="lo-empty-msg">No special dice available yet</div>'
    }

    function renderDetail() {
        if (_selectedSlot === null) {
            _el.detail.innerHTML = '<div class="lo-detail-placeholder">Select a die to inspect</div>'
            return
        }

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
        name.textContent = 'Base Die'
        card.appendChild(name)

        var rarity = document.createElement('div')
        rarity.className = 'lo-detail-rarity lo-rarity-base'
        rarity.textContent = 'BASE'
        card.appendChild(rarity)

        _el.detail.appendChild(card)

        if (window.bridge3D && window.bridge3D.renderSlotPreview) {
            try {
                _3dPreview = window.bridge3D.renderSlotPreview(canvas, 1, {
                    onSettle: function() {
                        hint.classList.remove('lo-hint-hidden')
                    }
                })
            } catch (_) {}
        }
    }

    window.loadoutUI = { mount: mount }
})()
