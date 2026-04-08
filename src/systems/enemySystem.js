// Enemy system — owns state.enemy.
// Loaded via <script> tag — exports to window.enemySystem.

;(function() {
    'use strict'

    var enemySystem = {
        init: function(store) {
            store.state.enemy = {
                hp:         0,
                maxHp:      0,
                name:       '',
                difficulty: ''
            }
        }
    }

    window.enemySystem = enemySystem

})()
