# Architecture: Mutable UDF + Deterministic Lockstep

## Core Idea

One mutable state object. All changes go through a store. Discrete events are logged for replay. Continuous simulation runs every tick without logging.

```
View → store.dispatch(type, payload)
     → logged in store.history
     → handler mutates store.state
     → subscribers notified
```

---

## Dual Loading Strategy

This project has two script loading modes that coexist in the same HTML page.

### Game Logic Layer — IIFE via `<script>`

All game logic (store, systems, config, UI) runs without a server. Files are loaded via `<script>` tags in dependency order and export via `window`.

**Constraints for this layer:**
- NO `import`/`export` — ES modules require HTTP due to CORS.
- NO bundlers (webpack, vite, rollup) — no build process.
- NO npm dependencies — all code is local.
- Each `.js` file wraps its code in an IIFE and exports via `window`.

### 3D Engine Layer — ES module via `<script type="module">`

The 3D rendering engine (BabylonJS + cannon-es) requires ES module loading for cannon-es.

**Stack (current prototypes `battle.html`, `spike-v2.html`):**
- BabylonJS: classic `<script src="vendor/babylon.js">` → `window.BABYLON`
- cannon-es: `<script type="importmap">` maps `"cannon-es"` → `./vendor/cannon-es.js`, then `import` inside `<script type="module">`

**Constraints for this layer:**
- Requires HTTP (`server.mjs` on port 4174, Cloudflare Pages, GitHub Pages, etc.) — **not** `file://`
- **Vendored** dependencies: `vendor/babylon.js`, `vendor/cannon-es.js` (refresh with `npm install` + `npm run vendor:sync`; commit `vendor/` for zero-CDN deploys)
- Target: bridge code in `src/engine/` as ES modules (extraction pending, see `TODO.md` 0C)

### Bridge Between Layers

The 3D engine reads game state and dispatches actions through the global `window.store`:

```
Game logic (IIFE, window globals)
    ↕  window.store
3D engine (ES module, imports)
    ↕  store.subscribe / store.dispatch
Visual output (BabylonJS canvas)
```

- `diceBridge.js` subscribes to the store via `store.subscribe(fn)` and reacts to action types: `ROLL_DICE`, `SELECT_DIE`, `DESELECT_DIE`, `SCORE_SELECTION`, `START_TURN`.
- **Physics determines face values** — no PRNG face correction. After dice settle, the bridge reads each die's physics face value and dispatches `DICE_SETTLED` with the actual values. The store then re-evaluates bust/selecting.
- User interaction on 3D dice dispatches `store.dispatch('SELECT_DIE', { index })` / `DESELECT_DIE`.
- The engine never mutates `store.state` directly — all changes go through `dispatch`.
- The engine module accesses `window.store`, `window.inputHandler`, and other IIFE globals because module scripts execute after classic scripts.
- `window.bridge3D` is set by the module script for IIFE code to detect 3D mode.

**Action flow for a 3D roll:**
```
Button/Sling → ROLL_DICE → bridge throws dice → physics settle
→ bridge reads face values → DICE_SETTLED(values)
→ store re-evaluates bust/selecting → UI unlocks
```

**Sling SVG visualization:** `#slingVizSvg` overlay shows wedge indicator (direction + strength %) during drag, ported from `battle.html`.

```html
<!-- src/index.html — load order matters -->
<script src="store/store.js"></script>
<script src="config/scoring.js"></script>
<script src="config/dice.js"></script>
<script src="config/encounters.js"></script>
<script src="config/balance.js"></script>
<script src="config/strings.js"></script>
<script src="systems/scoringSystem.js"></script>
<script src="systems/turnSystem.js"></script>
<script src="systems/playerSystem.js"></script>
<script src="systems/enemySystem.js"></script>
<script src="systems/matchSystem.js"></script>
<script src="systems/loadoutSystem.js"></script>
<script src="systems/botSystem.js"></script>
<script src="ui/battleUI.js"></script>
<script src="ui/inputHandler.js"></script>
<script src="ui/loadoutUI.js"></script>
<script src="main.js"></script>
<!-- 3D engine layer (ES module, loaded after IIFE globals) -->
<script src="vendor/babylon.js"></script>
<script type="importmap">{ "imports": { "cannon-es": "./vendor/cannon-es.js" } }</script>
<script type="module">
  import * as bridge from './engine/diceBridge.js';
  bridge.init(document.getElementById('renderCanvas'), window.store);
  window.bridge3D = bridge;
</script>
```

---

## Global Export Pattern

Every source file follows this structure:

```js
// systems/playerSystem.js
;(function() {
    'use strict'

    var playerSystem = {
        init: function(store) {
            store.state.player = { hp: 100, x: 0, y: 0, isDead: false }

            store.register('PLAYER_HEAL', function(state, payload) {
                state.player.hp = Math.min(config.units.hero.baseHp, state.player.hp + payload.amount)
            }, 'player.hp')
        },
        update: function(state, dt) {
            // continuous simulation
        }
    }

    window.playerSystem = playerSystem
})()
```

Config files:

```js
// config/units.js
;(function() {
    'use strict'
    window.config = window.config || {}
    window.config.units = {
        hero:   { baseHp: 100, speed: 5,  damage: 10 },
        goblin: { baseHp: 30,  speed: 8,  damage: 5  },
    }
})()
```

---

## Store API

```
store.state                         single mutable object, plain data only
store.history                       array of { tick, type, payload }
store.prng                          seeded PRNG bound to store.state.seed
store.currentTick                   current simulation tick number

store.register(type, handler, slice?)   bind handler to action type; declare which slice it changes
store.dispatch(type, payload)           log + execute + notify
store.subscribe(fn(state, type))        called on every action
store.subscribeTo(slice, fn(state))     called only when declared slice changes
store.tick()                            advance tick counter; once per simulation step
store.resetState(seed)                  reset to initial state with explicit seed
store.clearAll()                        full reset: state + handlers + subscribers (for tests)
```

Source: `src/store/store.js` — do not modify without explicit instruction.

---

## Game Loop

Two kinds of state changes — never mix them:

| Kind | Mechanism | Logged? | Examples |
|------|-----------|---------|----------|
| Discrete event | `dispatch()` | Yes | button press, death, pickup, spawn |
| Continuous sim | `system.update(state, dt)` | No | movement, physics, AI tick |

```js
// main.js — entry point (inside IIFE)
function init() {
    var seed = Date.now()       // only place allowed to call Date.now()
    store.resetState(seed)

    playerSystem.init(store)    // registers handlers + sets initial state
    combatSystem.init(store)
}

var FIXED_DT    = 1 / 60
var accumulator = 0
var lastTime    = 0

function gameLoop(timestamp) {
    var elapsed = Math.min((timestamp - lastTime) / 1000, 0.1)
    lastTime = timestamp
    accumulator += elapsed

    while (accumulator >= FIXED_DT) {
        store.tick()                                // first — always
        playerSystem.update(store.state, FIXED_DT)
        combatSystem.update(store.state, FIXED_DT)
        accumulator -= FIXED_DT
    }

    render(store.state)                             // visual only, no game logic
    requestAnimationFrame(gameLoop)
}

init()
requestAnimationFrame(gameLoop)
```

Rules:
- `store.tick()` is the first call in the simulation step, before any system.
- One simulation method per project — fixed or variable, not both.
- Only `main.js` orchestrates `system.update()` calls.
- Inside `system.update()`, do NOT call `dispatch()` — set a flag in state instead; react next tick.

---

## Fixed vs Variable Timestep

Use a fixed `dt` constant (e.g. `1/60`) if any system multiplies by `dt`. Variable `dt` from `requestAnimationFrame` makes physics non-deterministic.

```js
// Option A: simple games without physics (variable dt ok)
function gameLoop(timestamp) {
    var dt = (timestamp - lastTime) / 1000
    lastTime = timestamp
    store.tick()
    playerSystem.update(store.state, dt)
}

// Option B: physics / determinism required (recommended)
var FIXED_DT = 1 / 60
var accumulator = 0

function gameLoop(timestamp) {
    accumulator += Math.min((timestamp - lastTime) / 1000, 0.1)
    lastTime = timestamp

    while (accumulator >= FIXED_DT) {
        store.tick()
        playerSystem.update(store.state, FIXED_DT)
        accumulator -= FIXED_DT
    }

    render(store.state)
    requestAnimationFrame(gameLoop)
}
```

Rule: if any system multiplies something by `dt` — use Option B.

---

## Handlers

Each system's `init()` method registers handlers and sets up initial state for its slice:

```js
// systems/combatSystem.js
;(function() {
    'use strict'

    var combatSystem = {
        init: function(store) {
            store.state.combat = { enemies: [] }

            store.register('SPAWN_ENEMY', function(state, payload) {
                var cfg = config.units[payload.unitType]
                var x = store.prng.next(0, 800)
                state.combat.enemies.push({
                    id: payload.id, type: payload.unitType, hp: cfg.baseHp, x: x
                })
            }, 'combat.enemies')

            store.register('ENEMY_DIE', function(state, payload) {
                state.combat.enemies = state.combat.enemies.filter(function(e) {
                    return e.id !== payload.id
                })
            }, 'combat.enemies')
        },

        update: function(state, dt) {
            for (var i = 0; i < state.combat.enemies.length; i++) {
                var enemy = state.combat.enemies[i]
                enemy.x += (enemy.speed || 1) * dt
            }
        }
    }

    window.combatSystem = combatSystem
})()
```

---

## Subscribers (View Layer)

```js
// ui/hpBar.js
;(function() {
    'use strict'

    var unsubscribeHp = null

    var hpBar = {
        mount: function(containerEl) {
            var bar   = containerEl.querySelector('#hp-fill')
            var label = containerEl.querySelector('#hp-label')

            unsubscribeHp = store.subscribeTo('player.hp', function(state) {
                var pct = state.player.hp / config.units.hero.baseHp
                bar.style.width = (pct * 100) + '%'
                label.textContent = String(state.player.hp)
            })
        },

        unmount: function() {
            if (unsubscribeHp) {
                unsubscribeHp()
                unsubscribeHp = null
            }
        }
    }

    window.hpBar = hpBar
})()
```

- Views call `dispatch()` and `subscribeTo()` only — no game logic, no state mutation.
- Prefer `subscribeTo(slice, fn)` over `subscribe(fn)` — fires only when that slice changes.
- Slice name = dot-path into state: `"player.hp"` maps to `state.player.hp`.
- Always call the returned unsubscribe when the view is destroyed.

---

## Replays

```js
// Save
var replay = { seed: store.state.seed, history: store.history }
localStorage.setItem('replay', JSON.stringify(replay))

// Load
var data = JSON.parse(localStorage.getItem('replay'))
store.resetState(data.seed)
playerSystem.init(store)
combatSystem.init(store)

for (var i = 0; i < data.history.length; i++) {
    store.dispatch(data.history[i].type, data.history[i].payload)
}
```

Replay works because:
1. Continuous simulation is deterministic — same seed, same outcome.
2. Discrete events are fully logged with tick timestamps.

---

## Randomness

Never use `Math.random()` — it breaks replays.
Always use `store.prng.next(min, max)`. It is seeded from `store.state.seed` and resets with `resetState()`.

```js
store.register('SPAWN_LOOT', function(state, payload) {
    var x = store.prng.next(0, 800)
    var y = store.prng.next(0, 600)
    state.loot.push({ id: payload.id, x: x, y: y })
}, 'loot')
```

---

## Config vs State

`store.state` holds only values that change during a session.
Static balance data lives in config files — handlers read config, write state.

```js
store.state.player.hp = 75                  // current value (changes in combat)
config.units.hero.baseHp = 100              // starting value (set by designer, constant)
```

| Goes in config | Goes in state |
|----------------|---------------|
| base HP, damage, speed | current HP, position, status |
| item prices, XP multipliers | inventory contents, gold amount |
| wave spawn settings | active enemies list |
| UI strings, animation IDs | flags, timers, counters |

---

## Slice Subscriptions (`subscribeTo`)

`store.subscribe(cb)` fires on every action. `store.subscribeTo(slice, cb)` fires only when the declared slice changes.

Handler declares the slice as a third argument:

```js
store.register('PLAYER_TAKE_DAMAGE', handler, 'player.hp')
store.register('ENEMY_MOVE',         handler, 'combat.enemies')
```

Slice name = dot-path into `store.state`:

| Slice | Maps to | Notifies |
|-------|---------|----------|
| `"player"` | `state.player` | Any player change |
| `"player.hp"` | `state.player.hp` | HP bar only |
| `"combat.enemies"` | `state.combat.enemies` | Minimap, AI |
| `"inventory.gold"` | `state.inventory.gold` | Gold counter |

Invalid slice names: `"heroData"`, `"enemyList"`, `"uiStuff"` — must be a real dot-path into state.

---

## File Structure

```
project/
├── AGENTS.md              # Rules: AI agent workflow and coding standards
├── ARCHITECTURE.md         # Rules: code architecture (this file)
├── DESIGN_RULES.md         # Rules: game design principles
├── FIRST_PROMPT.md         # Template: user's first message to AI agent
├── DESIGN.md               # Generated: game design document
├── TODO.md                 # Generated: implementation task list
├── package.json            # devDeps: babylonjs, cannon-es; npm run vendor:sync
├── scripts/sync-vendor.mjs # Copies libs into vendor/
├── vendor/                 # babylon.js, cannon-es.js (committed for static hosting)
├── server.mjs              # Local HTTP server for ES module loading (port 4174)
├── spike-v2.html           # 3D engine spike (BabylonJS + cannon-es, standalone)
├── battle.html             # Battle prototype (fullscreen 3D, Farkle + combat + bot + sling)
├── throw-lab.html          # Throw-only sandbox: ROLL + sling, physics tuning (see below)
├── throw-lab.mjs           # ES module: same `battleTune` object + localStorage `battle_tune_json_v1`
├── tools/
│   ├── dice-constructor.html  # Visual die designer: 3D preview + per-face shape/size/color overrides + Copy Config
│   └── calibrate-bias.mjs     # Headless cannon-es bias calibration script
├── index.html              # HTTP → battle; file:// → local-server instructions (RU)
├── src/
│   ├── index.html          # Entry point — loads IIFE scripts + engine module
│   ├── main.js             # Game loop, init, system orchestration (IIFE)
│   ├── store/
│   │   └── store.js        # Store engine — do not modify (IIFE)
│   ├── config/             # Designer data — read-only at runtime (IIFE)
│   │   ├── scoring.js      #   window.config.scoring
│   │   ├── dice.js         #   window.config.dice
│   │   ├── encounters.js   #   window.config.encounters
│   │   ├── balance.js      #   window.config.balance
│   │   └── strings.js      #   window.config.strings
│   ├── systems/            # One file = one state slice (IIFE)
│   │   ├── turnSystem.js   #   FSM: idle → selecting → idle/bust, DICE_SETTLED
│   │   ├── playerSystem.js #   state.player (HP)
│   │   ├── enemySystem.js  #   state.enemy (HP, difficulty)
│   │   ├── matchSystem.js  #   state.match (battle lifecycle, END_TURN)
│   │   ├── loadoutSystem.js#   state.loadout (6 slots, SET_LOADOUT)
│   │   ├── botSystem.js    #   async bot AI: 3 difficulties, findBestBotChoice, risk threshold
│   │   └── scoringSystem.js#   pure scoring functions (bitmask DP, bust detection)
│   ├── engine/             # 3D rendering layer (ES modules, BabylonJS + cannon-es)
│   │   ├── diceEngine.js   #   scene setup, physics world, render loop, throwPlayer/throwBot
│   │   ├── dieFactory.js   #   createDiceVertexData, createPipsVertexData, buildDie, PIP_SHAPES, FACE_UP_QUATS, createMarkTexture
│   │   └── diceBridge.js   #   store subscriber → 3D commands, pointer → dispatch, sling SVG viz, DICE_SETTLED, renderSlotPreview, buildDieConfigs
│   ├── vendor/             # Vendored libs inside src/ for Cloudflare Pages deploy
│   │   ├── babylon.js
│   │   └── cannon-es.js
│   └── ui/                 # View layer — dispatch and subscribeTo only (IIFE)
│       ├── battleUI.js     #   DOM rendering: HP, dice, buttons, phase hints, showDamage fly-up, logHistory/clearHistory (imperative Round History)
│       ├── inputHandler.js #   Player clicks → dispatch, banners, lock/unlock, imperative history calls
│       └── loadoutUI.js    #   Two-mode modal: RULES & DICES (Game Rules + scoring combos) or LOADOUT (inventory grid + editable slots + Clear/Save). Viewport-scaled via clamp+em
└── tests/
    ├── index.html          # Test runner — open in browser
    ├── helpers.js           # TestRunner: assert, assertEqual, printResults
    └── test-*.js            # Test suites
```

Rules:
- `playerSystem.js` touches only `state.player`. If it touches two slices — split the action.
- If a system file exceeds ~500 lines — split it into two domains.
- Each action type is registered in exactly one place.
- `store.state` holds only plain serializable data. No DOM refs, no class instances, no functions.
- `src/engine/` files are the **only** ES modules in the project. Everything else is IIFE.
- Engine files may read `window.store` and `window.config` but must not define game logic.

---

## Adding a New Feature (3 touch points)

1. **Config** — add balance data (if needed): `config/units.js` or `config/balance.js`
2. **System** — one `register()` call with handler: `systems/mySystem.js`
3. **Call site** — one `dispatch()` call: `ui/` or `main.js`

Then add a `<script>` tag to `index.html` (and `tests/index.html` if testing that file).

---

## Testing

Tests live in `tests/` and run by opening `tests/index.html` in a browser (works via `file:///`).

```html
<!-- tests/index.html -->
<script src="../src/store/store.js"></script>
<script src="../src/config/units.js"></script>
<script src="../src/systems/combatSystem.js"></script>
<script src="helpers.js"></script>
<script src="test-combat.js"></script>
<script>TestRunner.printResults()</script>
```

Test pattern (deterministic replay):

```js
;(function() {
    store.clearAll()
    store.resetState(42)
    combatSystem.init(store)

    store.dispatch('SPAWN_ENEMY', { id: 'e1', unitType: 'goblin' })
    store.dispatch('SPAWN_ENEMY', { id: 'e2', unitType: 'goblin' })

    var snapshot = JSON.parse(JSON.stringify(store.state))
    var history  = store.history.slice()

    store.clearAll()
    store.resetState(42)
    combatSystem.init(store)

    for (var i = 0; i < history.length; i++) {
        store.dispatch(history[i].type, history[i].payload)
    }

    TestRunner.assertDeepEqual(store.state, snapshot, 'Combat replay produces identical state')
})()
```

---

## Scaling

| Signal | Solution |
|--------|----------|
| Session > 15 min or > 5000 actions | Snapshotting: save full state every N ticks, replay from nearest checkpoint |
| More than 5–7 top-level state keys | Subsystems: explicit slice ownership per file |
| Need logging, network, validation | Middleware: wrap `dispatch()` in a chain |

Middleware intercepts but never mutates state directly — that is the handler's job.

---

## 3D Engine Architecture

### Engine Stack

| Component | Technology | Role |
|-----------|-----------|------|
| Rendering | BabylonJS (`vendor/babylon.js`) | Scene, camera, materials, lights, shadows, highlight layer |
| Physics | cannon-es (`vendor/cannon-es.js` + import map) | Gravity, collision, rigid bodies, sleep detection |
| Custom geometry | Procedural `VertexData` | Rounded box with pip notches — no external mesh files |

### Scene Setup

```js
const engine = new BABYLON.Engine(canvas, true)
const scene = new BABYLON.Scene(engine)
scene.useRightHandedSystem = true

const camera = new BABYLON.ArcRotateCamera(...)
const light = new BABYLON.HemisphericLight(...)
const dirLight = new BABYLON.DirectionalLight(...)
const shadowGen = new BABYLON.ShadowGenerator(1024, dirLight)
const hl = new BABYLON.HighlightLayer('hl', scene)
```

### Physics World

```js
import * as CANNON from 'cannon-es'
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, cfg.gravity, 0) })
world.broadphase = new CANNON.NaiveBroadphase()
world.solver.iterations = 10
world.allowSleep = true
```

### Die Composition

Each die is a `TransformNode` parent with visual children + 1 physics body:

```
TransformNode (root)
├── Mesh: outer          — rounded box geometry (body color material, per-die specular)
├── Mesh: pips           — default pip meshes (default pip color, shape, size; zOffset=-2)
├── Mesh[]: extraPips    — additional pip meshes for faces with non-default pip color (via pipColors)
├── Mesh: backing        — dark interior box (size scales with edgeR)
├── Mesh[]: marks        — face mark planes (legacy; DOUBLESIDE, DynamicTexture, isPickable=false)
└── CANNON.Body          — Box(0.48 * scale), mass, sleep events, optional center-of-mass offset
```

Per-die visual customization: `buildDie(ctx, opts)` accepts `bodyColor`, `pipColor`, `specular`, `edgeR`, `pipR` (number or per-face object), `pipShape` (string or per-face object), `pipColors` (object `{default, N}` for per-face pip colors), `faceMarks` (array of `{face, shape, color, bg}`), `bias` (`{face, magnitude}`). Custom geometry generated on the fly when params differ from defaults; otherwise shared cached `VertexData` is used.

When `pipColors` is set, faces are grouped by color and each group gets its own pip mesh with a dedicated material. Extra pip meshes are stored in `_extraPipMeshes` / `_extraPipMats` and disposed with the die.

### Render Loop

```js
engine.runRenderLoop(() => {
    world.fixedStep()                          // advance physics
    for (const d of dice) {
        d.root.position.copyFrom(d.body.position)
        d.root.rotationQuaternion.copyFrom(d.body.quaternion)
        // anti-edge nudge: if slow + misaligned → angular impulse
    }
    scene.render()
})
```

### Interaction Model

**Spike (`spike-v2.html`) — per-die drag:**

```
POINTERDOWN → find die under cursor → start drag or start selection
POINTERMOVE → if dragging → raycast to plane → kinematic body follows cursor
POINTERUP   → if dragged  → drop die (dynamic body + velocity impulse)
            → if clicked  → toggle selection (HighlightLayer glow)
```

Drag threshold: 6px. Below threshold = click (select/deselect). Above threshold = drag.

**Battle prototype (`battle.html`) — table-level sling + selection:**

- **Player roll:** pull-back **sling** — pointer down stores **anchor** `(x,z)` on the sling pick plane (`SLING_PICK_Y`). All dice positioned at **single point** (clamped pick, `wallPad = dieEdge × 1.0`); only first die visible during aiming, rest revealed on release. **Release:** world pull ≤ `SLING_CLICK_EPS_WORLD` → **cancel** (`waiting`, `syncActiveDice(0)`). Else **aim** = `normalize(start − end)` in XZ (slingshot: from release point toward anchor, opposite stretch vector), **strength** = `min(1, pullLen / SLING_MAX_PULL_WORLD)` (linear). All dice get the **same `applyImpulse`** using ROLL parameters (`throwMin`/`throwMax` * `rollPlayer.mainImpulse` / `impulseYMul`), with strength (quadratic) selecting `f` in that range. Off-center application point (scaled to die size) generates spin. Dice-dice collisions disabled for 150ms after release to prevent cluster artifacts. **Dice–dice:** `collisionFilterGroup = 2`, `collisionFilterMask = 3` (`STATIC_ENV_GROUP | DICE_COLLISION_GROUP`) on **`CANNON.Box` shape** + hull copy — collide with table (group 1) and other dice (group 2), so dice are solid to each other. Body matches for broadphase. **Stack step:** `DICE_STACK_Y_STEP = DIE_EDGE × 1.06`. **ROLL** uses `throwFromBottom()` unchanged. **Camera debug “Orbit”** disables sling capture on the canvas.
- **Sling HUD:** SVG `#slingVizSvg` — **wedge** (4 radial bands by strength) + exact **%** label; wedge direction from **projected** anchor→pick (`rollXZWorldToClient`), aligned with physics under table yaw. In **`battle.html`** the SVG is fixed to the viewport; in **`throw-lab.html`** it sits inside **`.lab-main`** over `#labCanvas` with `width/height: 100%` so picking / HUD shares the same pixel space as the canvas (sidebar has higher `z-index` for UI clicks).
- **Selection (after settle):** pointer up on a die toggles **HighlightLayer** selection (unchanged).
- **Bot:** still uses scripted **throwFromTop()** (no sling).

### Face Detection

After physics sleep event fires, read the die's quaternion and determine which face axis aligns with world Y+:

```js
const up = new CANNON.Vec3(0, 1, 0)
const localUp = body.quaternion.conjugate().vmult(up)
// maxComponent(abs(localUp.x), abs(localUp.y), abs(localUp.z)) → face axis
// sign → positive/negative direction → face value 1-6
```

### Engine ↔ Game Logic Contract

| Direction | Mechanism | Example |
|-----------|-----------|---------|
| State → Engine | `store.subscribeTo(slice, fn)` | `turn.rolledDice` changes → trigger roll animation |
| Engine → State | `store.dispatch(type, payload)` | Click on die → `dispatch('SELECT_DIE', { dieIndex })` |
| Config → Engine | Read `window.DICE.roster[id]` | Load die color, pip shape/size/color, bias from config |

**Per-die config pipeline:** `diceBridge.buildDieConfigs(count)` reads `store.state.loadout.slots`, looks up each die in `DICE.roster`, and constructs per-die config objects with `bodyColor`, `pipColor`, `specular`, `edgeR`, `pipR`, `pipShape`, `pipColors`, `faceMarks`, `bias`. These are passed to `engine.syncActiveDice(count, dieConfigs)` → `dieFactory.buildDie(ctx, opts)`.

**Physics bias:** center-of-mass offset implemented by shifting the collision shape relative to body origin: `body.addShape(boxShape, new CANNON.Vec3(fl.x * mag, fl.y * mag, fl.z * mag))` where `fl` is the `FACE_LOCALS` direction for the bias face and `mag` is the bias magnitude.

The engine never stores game-relevant data. All authoritative state lives in `store.state`.

---

## Battle Prototype (`battle.html`)

A standalone prototype implementing the full battle loop in a single HTML file. This is the approved reference implementation for the 3D battle screen — not yet wired to `store.dispatch` architecture.

### What it contains

| Feature | Implementation |
|---------|---------------|
| **3D Canvas** | Fullscreen BabylonJS canvas (`.canvas-wrap` `position:fixed; inset:0`); **`#slingVizSvg`** fixed over the viewport (wedge HUD). Optional **camera debug** panel (bottom-left): numeric α, β, radius, target, Apply, **Copy view as JSON**, reset; checkbox **Orbit / zoom** attaches Babylon controls for tuning shots |
| **UI overlay layout** | `.battle-scene` fixed over the viewport (`z-index` above canvas). **Side panels** (`.side-left` / `.side-right`): compact HP widget, 3 badge placeholder slots, side turn indicators. **Center** (`.center`): `.info-bar` docked to top (round score + selection info, compact `max-width:min(88vw,340px)`). `.actions` at bottom — **auto-hidden** when no buttons visible (`syncActionsVisibility`); buttons hidden during bot turn. Dev tools (Camera/Table/Tune) **hidden** via `display:none` (code preserved). **Banner**: centered on viewport (fade+scale, 2200ms). **Stacked dice reroll**: if die Y > `FLOOR_Y + dieEdge × 1.1` after all dice settle → banner "REROLL!", phase returns to `waiting` so player re-throws all dice via ROLL or sling. Bot auto-re-throws. **Settle timeout** (`SETTLE_TIMEOUT_MS = 4000`): if dice remain unsettled 4s after throw, `forceSettleUnsettled()` smoothly animates them to rest (body → kinematic, lerp position + slerp quaternion each frame at `FORCE_SETTLE_LERP = 0.08`, finalize when distance < 0.05); stacked dice offset ~1.2 dieEdge sideways. **Bot turn guard**: `scheduleBotTurn(ms)` prevents duplicate `runBotTurn` via `clearTimeout`. |
| **Physics defaults** | **`BATTLE_TUNE_DEFAULTS`** in `battle.html` seeds `battleTune` before **`localStorage['battle_tune_json_v1']`** is merged (numeric fields only). Hash-based versioning auto-clears stale `localStorage` when code defaults change. **Tune → Apply** saves the full tune; **Reset** removes the key. **`throw-lab.mjs`** duplicates the same defaults object — **keep both files in sync** when changing shipped feel. **Baseline v4 (current):** gravity −300, mass 3.0, throwMin/Max 100/166, dieScale 3.06, solver.iterations 20, invisible ceiling at FLOOR_Y+28, specularColor 0.08, directional light Y=50. `readFaceValue` thresholds: bestDot ≥ 0.82, gap ≥ 0.10. `readFaceValueForced` — threshold-free fallback for force-settle. **Smooth force-settle:** unsettled dice after `SETTLE_TIMEOUT_MS` are set to kinematic and lerp/slerp to target position/rotation (`FORCE_SETTLE_LERP = 0.08`) over ~12–15 frames instead of instant teleport; finalized to dynamic+settled when distance < 0.05. **Zero-friction walls:** `ContactMaterial(wallMat, diceMat, { friction: 0 })` — dice slide off walls instead of edge-balancing; floor keeps normal friction via `defaultContactMaterial`. |
| **Table layout** | Sandwich along Z: **roll zone** (center, `ROLL_DEPTH_Z`, stretch `DEFAULT_ROLL_DEPTH_STRETCH=2.8`) + **held zones** (player / bot). Held zones are **9 × 9 unit squares** (`SHELF_W=9`, `SHELF_D=9`) centered on each side; inner edge flush with the physics divider, zone expands outward. Held dice in **3-column grid** with `gap = dieEdge × 1.12`, slerp to `FACE_UP_QUATS[value]` for correct face display. Thin **border line** (`CreateLines`, warm brown, alpha 0.7) outlines the roll zone perimeter. Physics **walls** at `DIVIDER_Z + 0.5` / `BOT_DIVIDER_Z - 0.5` (`WALL_INSET_Z`) confine dice with visual clearance from border. Ortho frustum padding: `uiPadH=12`, `uiPadV=5`. **Experimental polygon table** (8/16-sided regular polygon with `CANNON.Plane` walls per side + `clampToPolygon` helper) validated and preserved as commented code — see `TODO.md` "Open Decisions". |
| **Directional throws** | Player: `throwFromBottom()` (ROLL) or **sling** — sling velocity along **start−end** in XZ + vertical scale by strength (see Interaction Model). Bot: `throwFromTop()`. |
| **Dice lifecycle** | New dice are **KINEMATIC**, **hidden** under the table until a throw; on throw they become **DYNAMIC** and visible — avoids “phantom” rolls before the bot’s or player’s real roll. |
| **Farkle scoring** | Full standard table: singles (1/5), sets (3-of-a-kind to 6-of-a-kind), short straights (1-5, 2-6), full straight, three pairs. All-dice-must-score validation. |
| **Click-to-select** | After settle: `scene.onPointerObservable` + `HighlightLayer` (green glow). Real-time score preview. |
| **Player roll input** | **Drag sling** (phase `aiming`) or **ROLL**. Sling cancel: release with no pull (see `SLING_CLICK_EPS_WORLD`). `pointercancel` / turn change clears sling like cancel. |
| **Buttons** | ROLL, SCORE'N'PLAY, BANK'N'PASS. Hot Hand: only SCORE button shown (auto-bank, no manual bank allowed). |
| **Held zone** | Scored dice animate to the current player's held zone (lerp). |
| **Hot Hand** | Triggers when all 6 dice scored in a turn. Auto-banks damage, resets to 6 fresh dice, same player continues. |
| **Bust** | No playable subset → round score lost, turn ends. |
| **Combat** | 3000 HP each. Banked score = direct damage (1:1). 0 HP → immediate win/lose. |
| **Bot AI** | Finds best scoring subset, banks when accumulated ≥ 450 or ≤ 1 die remaining. Timed delays for playback. |
| **UI overlay** | HP bars (player red, bot purple), turn indicator, round score, selection info, round history log, BUST/BANK/HOT HAND banners. |
| **Dependencies** | `vendor/babylon.js`, `vendor/cannon-es.js` (no runtime CDN). |

**Game phases (battle.html prototype):** `waiting` → (`aiming` during sling) → `rolling` → `selecting` → … — `aiming` is player-only and hides the ROLL button until release.

**Game phases (src/index.html production):** `idle` → `selecting` → `idle` (after SCORE) or end turn (after BANK). No `decide` phase. `bust` detected via `DICE_SETTLED` after physics settle. `ROLL_DICE` generates PRNG values for 2D fallback; `DICE_SETTLED` overrides with physics values when 3D is active.

### Standalone architecture

`battle.html` uses a plain `game` object for state (not `store.dispatch`). This is intentional — it's a prototype. When extracting to production:

- Game state → `store.state.turn`, `store.state.player`, `store.state.enemy`
- Button clicks → `store.dispatch('ROLL_DICE')`, `store.dispatch('SCORE_SELECTION')`, etc.
- Pointer sling → same hooks as roll (e.g. `ROLL_DICE` with `{ aimX, aimZ, strength }` or discrete `AIM_ROLL` / `RELEASE_ROLL` — TBD). Preserve: `positionKinematicClusterSling`, `applyRollImpulsesFromCurrentPositions`, projected HUD parity.
- Scoring functions → `src/config/scoring.js` + `src/systems/turnSystem.js`
- 3D engine → `src/engine/diceEngine.js`, `src/engine/dieFactory.js`, `src/engine/diceBridge.js`
- Bot logic → `src/systems/botSystem.js`

---

## Throw lab (`throw-lab.html` + `throw-lab.mjs`)

**Purpose:** isolate **ROLL + pull-back sling + physics** without combat, scoring, or bot flow — for tuning how throws feel and for inspecting face results after settle.

| Topic | Detail |
|-------|--------|
| **Shared tuning** | Same in-memory shape as battle: `battleTune` (world, body, sling, viz, spawn, rollPlayer/bot, mesh, settle, …). **`BATTLE_TUNE_DEFAULTS`** in **`throw-lab.mjs`** must match **`battle.html`**. Persisted under **`localStorage['battle_tune_json_v1']`** — changes in the lab apply to **`battle.html`** on next load (and vice versa). |
| **Full Tune panel** | Duplicate field list as **`battle.html` → Tune**: `PHYSICS_TUNE_FIELDS` in both files must stay in sync when adding keys (comment in each file points to the other). Each field has **EN + RU** help text describing gameplay effect (not just JSON paths). |
| **Sling release (unified)** | Same impulse logic as **ROLL** in both lab and battle: single random `f` per throw in scaled `throwMin`…`throwMax`, `applyImpulse` with off-center point (`dieEdge × 0.10`), `rollPlayer` `mainImpulse` / `impulseYMul` / `impulseCrossMul`, aim = slingshot direction in XZ. **Pull strength** (quadratic curve) scales the throw band (`0.12 + 0.88 × strength`). Legacy `sling.impulseH/Y` fields still in defaults but unused by release code. |
| **«Реализм броска»** | High-level sliders: **mass**, **gravity Y**, **throw power** (scales ROLL + sling `throwMin`/`throwMax` and `mainImpulse`; power range **0.2×–6×**), **arc** (`rollPlayer`/`rollBot` `impulseYMul`), **damping** (linear + angular together). Ballistic hint uses **throwMax × impulseYMul / mass**. Sling and ROLL are now fully unified — both use the same impulse path. |
| **UX** | Current roll faces + **history log**; **Сброс стола** clears dice; **Очистить историю** clears the log. Sidebar typography widened for readability. |
| **Runtime** | ES module + import map (HTTP only), same as battle. Lab uses `Math.random()` for ROLL jitter / quaternions (visual only); not wired to `store.prng`. |

**Extraction note:** When implementing `diceEngine` / `diceBridge`, consider moving **`PHYSICS_TUNE_FIELDS`** (and optional realism presets) to a small shared module so battle, lab, and future tools do not drift.
