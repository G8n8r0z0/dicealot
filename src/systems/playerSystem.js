// Player system — owns state.player.
// Depends on: window.BALANCE
// Loaded via <script> tag — exports to window.playerSystem.

;(function() {
    'use strict'

    var playerSystem = {
        init: function(store) {
            var B = window.BALANCE

            store.state.player = {
                hp:    B.PLAYER_BASE_HP,
                maxHp: B.PLAYER_BASE_HP,
                name:  'Player'
            }
        }
    }

    window.playerSystem = playerSystem

})()
