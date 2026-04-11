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
    var _drag = null

    var PIP_MAP = {
        1: [4],
        2: [2, 6],
        3: [2, 4, 6],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    }

    var COMRADE_STAR_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="translate(0 1)">'
        + '<path fill="#d89c24" d="M32 6L39.2 20.8L55.4 23.1L43.6 34.2L47 50L32 42.1L17 50L20.4 34.2L8.6 23.1L24.8 20.8z"/>'
        + '<path fill="#ffe36a" d="M32 8.7L38.5 22.1L53.3 24.2L42.5 34.4L45.6 48.8L32 41.6L18.4 48.8L21.5 34.4L10.7 24.2L25.5 22.1z"/>'
        + '<path fill="#f6d36f" d="M32 10.8L37.7 22.7L50.9 24.6L41.3 33.6L44 46.4L32 40.1L20 46.4L22.7 33.6L13.1 24.6L26.3 22.7z"/>'
        + '</g></svg>'

    var SHOWCASE_FACE = { comrade: 5, oneLove: 1, frog: 1, flipper: 1, slime: 6, devil: 6, bandie: 1, tuner: 1 }

    function buildMiniDie(dieId, faceValue) {
        var def = getDieDef(dieId)
        var cls = dieId || 'base'
        if (SHOWCASE_FACE[cls]) faceValue = SHOWCASE_FACE[cls]
        var die = document.createElement('div')
        die.className = 'mini-die ' + cls

        if (cls === 'joker') {
            var j = document.createElement('div')
            j.className = 'mini-die-joker'
            j.textContent = 'J'
            die.appendChild(j)
            return die
        }

        var cells = PIP_MAP[faceValue] || PIP_MAP[1]
        var isFrog = cls === 'frog'
        var isLove = cls === 'oneLove'
        var isComradeStar = cls === 'comrade' && faceValue === 5

        for (var i = 0; i < 9; i++) {
            var active = cells.indexOf(i) !== -1
            var pip = document.createElement('span')
            pip.className = 'pip' + (active ? '' : ' pip-hide')

            if (isComradeStar && active) {
                pip.classList.add('comrade-star-slot')
                var star = document.createElement('span')
                star.className = 'mini-pip-comrade-star'
                star.innerHTML = COMRADE_STAR_SVG
                pip.appendChild(star)
            }
            die.appendChild(pip)
        }

        if (isFrog && faceValue === 1) {
            var fm = document.createElement('span')
            fm.className = 'mini-frogmark'
            var eye = document.createElement('span')
            eye.className = 'mini-frog-eye'
            fm.appendChild(eye)
            die.appendChild(fm)
        }
        if (isLove && faceValue === 1) {
            var centerPip = die.querySelectorAll('.pip')[4]
            if (centerPip) centerPip.style.visibility = 'hidden'
            var lm = document.createElement('span')
            lm.className = 'mini-lovemark'
            var heart = document.createElement('span')
            heart.className = 'mini-love-heart'
            lm.appendChild(heart)
            die.appendChild(lm)
        }
        if (cls === 'flipper' && faceValue === 1) {
            var centerPip = die.querySelectorAll('.pip')[4]
            if (centerPip) centerPip.style.visibility = 'hidden'
            var dm = document.createElement('span')
            dm.className = 'mini-flippermark'
            dm.innerHTML = '<svg viewBox="0 0 1376 768" xmlns="http://www.w3.org/2000/svg"><path d="M574.5 110.7c-6 1-13.4 3.5-16.7 5.7-5.8 3.9-5.1 5.7 5.6 13.7 11.2 8.4 16.5 14.1 20.5 22.2 7.6 15.2 6.5 32.2-3 47.1-1.8 2.8-11.4 13.5-21.3 23.7-28.7 29.7-44.6 49.1-61.8 75.5-44.2 67.7-69.2 137.5-74.7 209-1.8 23.5-1.7 22.8-6.4 27.5-2.3 2.3-9.1 7.5-15.2 11.5-30 19.8-49.8 39.4-65.5 64.6-8.7 13.9-16.3 32.9-17.2 43 0 5.7 2.6 4.9 12.7-3.7 15.6-13.3 18.3-15.3 26.5-19.3 8.7-4.2 17.4-6.6 36.1-10 14.2-2.5 22.2-6.3 26.9-12.8 3.2-4.4 4.5-5.2 4.5-2.7 0 3 3.1 7.4 6.2 9.1 2.2 1.1 7.2 1.9 15.3 2.3 9.3.5 13.2 1.2 17.2 3 5.8 2.5 12.4 9 16.7 16.3 1.5 2.6 3.2 4.7 3.7 4.7 1.2 0 3.8-9.2 5.2-18.4.8-5.8.8-10.3 0-17.5-2.1-17.8-7.2-30.3-19.5-47.6-3.9-5.5-7.7-11.9-8.5-14.3l-1.4-4.2 6.2-12.8c18.4-38 40.9-70.7 67.6-98.1 54.8-56.3 129-96.1 235.8-126.6 10.9-3.1 20.1-5.5 20.3-5.2.9.9-5.3 15.3-9 20.9-3.6 5.5-7.8 9.8-18.8 19 -3 2.6-6.2 6.2-7.1 8-.1.6 3.3 1.8 2.2 3.6 4.4 1.6 5.8 1.7 11.2 1.1 37.8-2.8 65.6-18.7 94.3-53.9 5.8-7.1 11.7-13.3 13.1-13.9 4.5-1.8 33.4-1.2 57.6 1.1 46.5 4.4 50.9 5.1 82.5 14.1 29 8.2 34.6 8.6 40.7 2.4 4-4 4.2-7.2.6-14.4-2.2-4.5-4.9-7.1-16.8-16.5-16.9-13.4-19.6-16.4-19.6-21.4 0-11.7-7.4-29.9-17.7-43.7-18.4-24.7-47.5-43.1-91.1-57.4-31.9-10.5-53.6-14.7-87.7-17-29.2-2-61-0.2-90 5.8-38.5 8-40.6 7.8-73.5-6.2-33.3-14.2-49.9-18.8-69.5-19.4-6.6-.2-13.4-.2-15 .1z" fill="#f0ece2"/></svg>'
            die.appendChild(dm)
        }
        if (cls === 'bandie' && faceValue === 1) {
            var centerPip = die.querySelectorAll('.pip')[4]
            if (centerPip) centerPip.style.visibility = 'hidden'
            var bm = document.createElement('span')
            bm.className = 'mini-bandie-cross'
            bm.innerHTML = '<svg viewBox="0 0 64 64"><rect x="22" y="8" width="20" height="48" rx="3" fill="#cc2222"/><rect x="8" y="22" width="48" height="20" rx="3" fill="#cc2222"/></svg>'
            die.appendChild(bm)
        }
        if (cls === 'devil' && faceValue === 6) {
            var allPips = die.querySelectorAll('.pip')
            for (var pi = 0; pi < allPips.length; pi++) allPips[pi].style.visibility = 'hidden'
            var pm = document.createElement('span')
            pm.className = 'mini-devil-penta'
            pm.innerHTML = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="#000" stroke-width="2.8"/><polygon points="32,4 48.5,54.7 5.4,23.3 58.6,23.3 15.5,54.7" fill="none" stroke="#000" stroke-width="2.8" stroke-linejoin="round"/></svg>'
            die.appendChild(pm)
        }



        return die
    }

    function pipFaceHTML(faceValue) {
        var cells = PIP_MAP[faceValue] || PIP_MAP[1]
        var h = '<div class="mini-die base">'
        for (var i = 0; i < 9; i++) {
            var vis = cells.indexOf(i) !== -1
            h += '<span class="pip' + (vis ? '' : ' pip-hide') + '"></span>'
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

    // ── drag'n'drop ───────────────────────────────────────────────────────

    var DRAG_THRESHOLD = 8

    function startDrag(source, srcEl, ev) {
        if (_mode !== 'loadout' || ev.button > 0) return
        ev.preventDefault()
        _drag = {
            source: source,
            srcEl: srcEl,
            startX: ev.clientX,
            startY: ev.clientY,
            active: false,
            ghost: null
        }
        document.addEventListener('pointermove', onDragMove)
        document.addEventListener('pointerup', onDragEnd)
        document.addEventListener('pointercancel', onDragEnd)
    }

    function onDragMove(ev) {
        if (!_drag) return
        var dx = ev.clientX - _drag.startX
        var dy = ev.clientY - _drag.startY
        if (!_drag.active && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            _drag.active = true
            _drag.srcEl.classList.add('drag-source')
            var dieId = _drag.source.type === 'slot'
                ? _editing[_drag.source.index]
                : _drag.source.dieId
            var ghost = document.createElement('div')
            ghost.className = 'lo-drag-ghost'
            ghost.appendChild(buildMiniDie(dieId, 1))
            document.body.appendChild(ghost)
            _drag.ghost = ghost
        }
        if (_drag.active && _drag.ghost) {
            _drag.ghost.style.left = ev.clientX + 'px'
            _drag.ghost.style.top = ev.clientY + 'px'
        }
        clearDropTargets()
        var el = document.elementFromPoint(ev.clientX, ev.clientY)
        if (el) {
            var slot = el.closest('.lo-slot[data-index]')
            if (slot) slot.classList.add('drop-target')
        }
    }

    function onDragEnd(ev) {
        if (!_drag) return
        var wasDrag = _drag.active
        var source = _drag.source
        clearDropTargets()
        if (_drag.ghost && _drag.ghost.parentNode) _drag.ghost.parentNode.removeChild(_drag.ghost)
        _drag.srcEl.classList.remove('drag-source')
        document.removeEventListener('pointermove', onDragMove)
        document.removeEventListener('pointerup', onDragEnd)
        document.removeEventListener('pointercancel', onDragEnd)

        if (wasDrag) {
            var el = document.elementFromPoint(ev.clientX, ev.clientY)
            var targetSlot = el ? el.closest('.lo-slot[data-index]') : null
            var targetInv = el ? el.closest('#loadoutLeft') : null

            if (targetSlot) {
                var ti = Number(targetSlot.dataset.index)
                if (source.type === 'slot') {
                    var tmp = _editing[ti]
                    _editing[ti] = _editing[source.index]
                    _editing[source.index] = tmp
                } else {
                    _editing[ti] = source.dieId
                }
                _selectedSlot = ti
                render()
            } else if (targetInv && source.type === 'slot') {
                _editing[source.index] = null
                _selectedSlot = null
                render()
            }
        } else {
            if (source.type === 'slot') {
                _selectedSlot = source.index
                render()
            } else if (source.type === 'inventory' && _selectedSlot !== null) {
                _editing[_selectedSlot] = source.dieId
                render()
            }
        }

        _drag = null
    }

    function clearDropTargets() {
        var els = document.querySelectorAll('.lo-slot.drop-target')
        for (var i = 0; i < els.length; i++) els[i].classList.remove('drop-target')
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

            var s = document.createElement('div')
            s.className = 'lo-slot filled' + (sel ? ' selected' : '')
            s.dataset.index = i

            var well = document.createElement('div')
            well.className = 'lo-slot-well'
            if (sel) well.style.borderColor = 'rgba(239,193,74,.7)'
            well.appendChild(buildMiniDie(_editing[i], 1))

            var label = document.createElement('div')
            label.className = 'lo-slot-name'
            label.textContent = def.name

            s.appendChild(well)
            s.appendChild(label)
            _el.slots.appendChild(s)

            if (_mode === 'rules') {
                s.onclick = (function(idx) {
                    return function() {
                        _selectedSlot = idx
                        renderSlots()
                        renderDetail()
                    }
                })(i)
            } else {
                s.onpointerdown = (function(idx, el) {
                    return function(ev) {
                        startDrag({ type: 'slot', index: idx }, el, ev)
                    }
                })(i, s)
            }
        }
    }

    // ── inventory (loadout mode) ─────────────────────────────────────────

    function renderInventory() {
        var roster = window.DICE && window.DICE.roster
        if (!roster) { _el.left.innerHTML = '<div class="lo-empty-msg">No dice available</div>'; return }

        var impl = window.DICE.IMPLEMENTED || []
        var order = window.DICE.RARITY_ORDER || {}
        var keys = Object.keys(roster).filter(function(k) {
            return impl.indexOf(k) !== -1
        }).sort(function(a, b) {
            var ra = order[roster[a].rarity] || 0, rb = order[roster[b].rarity] || 0
            return ra - rb || a.localeCompare(b)
        })

        _el.left.innerHTML = ''
        for (var k = 0; k < keys.length; k++) {
            var def = roster[keys[k]]
            var tile = document.createElement('div')
            tile.className = 'lo-tile'
            tile.dataset.dieId = def.id

            var well = document.createElement('div')
            well.className = 'lo-slot-well'
            well.appendChild(buildMiniDie(def.id, 1))

            var label = document.createElement('div')
            label.className = 'lo-tile-label'
            label.textContent = def.name

            tile.appendChild(well)
            tile.appendChild(label)
            _el.left.appendChild(tile)

            tile.onpointerdown = (function(id, el) {
                return function(ev) {
                    startDrag({ type: 'inventory', dieId: id }, el, ev)
                }
            })(def.id, tile)
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
            var msg = _mode === 'rules'
                ? 'Tap a die above to preview'
                : 'Select a die to inspect'
            _el.detail.innerHTML = '<div class="lo-detail-placeholder">' + msg + '</div>'
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
