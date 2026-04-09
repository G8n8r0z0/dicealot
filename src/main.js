// Entry point — seed, system init, UI mount, game start.
// This is the only file allowed to call Date.now().

;(function() {
    'use strict'

    function init() {
        var seed = Date.now()
        store.resetState(seed)

        playerSystem.init(store)
        enemySystem.init(store)
        turnSystem.init(store)
        matchSystem.init(store)
        loadoutSystem.init(store)
        botSystem.init(store)

        battleUI.mount(store)
        inputHandler.bind(store)
        loadoutUI.mount(store)

        store.dispatch('START_BATTLE', {
            enemyHp: 3000,
            enemyName: 'Duelist',
            difficulty: 'advanced'
        })
        store.dispatch('START_TURN')
    }

    init()

})()
