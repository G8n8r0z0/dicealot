# Dice-a-Lot — 3D Dice Battle Game

**v1.0.6 — Battle UI polish: damage fly-up + HP flash, Rules & Dices panel, red invalid highlights, die descriptions, imperative Round History**

A browser-first dice RPG prototype inspired by Farkle. Special dice with unique abilities, loadout building, PvE bot battles, HP-based combat, and a full progression ladder — all rendered with 3D physics dice.

### What's playable now

- Full Farkle scoring: singles (1/5), N-of-a-kind (exponential), straights, Hot Hand
- 3D physics dice with pull-back sling throw + ROLL button
- Bot AI with 3 difficulty levels (Novice / Advanced / Master)
- HP combat: 3000 HP each, banked score = direct damage, win/lose detection
- Glass morphism UI overlay: side HP widgets, top info bar, bottom action buttons
- Bust, Hot Hand, turn switching, victory/defeat banners
- Loadout editor with interactive 3D detail panel (physics die drop, orbit-after-settle, CSS pip slot icons)
- **Damage visualization** — fly-up numbers + HP bar flash/shake on bank
- **Rules & Dices panel** — scoring combos with inline mini dice, Goal, How to Play (was Loadout/Inventory)
- **Invalid selection red highlights** — 3D dice glow red when combo is invalid
- **Round History** — imperative event log (rolled values, scores, damage, bust, hot hand, result)
- **Die descriptions** — each die shows its ability text in the detail panel
- **One Love die** — pink (#ff5ccd), white pips, red heart-shaped pip on face 1 (via PIP_SHAPES.heart), ~30% bias toward 1 (physics center-of-mass offset)
- **Comrade die** — bright red (#cc0000), gold star pips on face 5, circle pips on other faces, ~30% bias toward 5 (physics center-of-mass offset)
- **Per-die visual system** — custom body/pip colors, specular, edge rounding, pip size/shape per face, per-face pip colors (multiple pip meshes per die)
- **Dice Constructor** (`tools/dice-constructor.html`) — interactive 3D tool for designing die visuals with per-face overrides (shape/size/color per face), config export

## 3D Engine

The game uses a custom dice rendering engine:

| Layer | Technology |
|-------|-----------|
| Rendering | **BabylonJS** (`vendor/babylon.js`, synced from npm) |
| Physics | **cannon-es** (`vendor/cannon-es.js`, synced from npm) |
| Geometry | Procedural rounded box with flat pip discs |

Dice are built entirely in code — no external 3D models or texture atlases. Each die is a rounded box with geometric pip notches, flat circular pip meshes, and a dark backing box. Physics simulation handles rolling, collisions, and settling. Engine validated in `spike-v2.html`, full battle prototype in `battle.html`, **physics / throw feel** iterated in **`throw-lab.html`** (same Babylon + cannon-es stack, shared `battle_tune_json_v1` with battle).

**Vendored libs (no CDN at runtime):** `battle.html` and `spike-v2.html` load from `vendor/`. After changing versions in `package.json`, run `npm install` then `npm run vendor:sync`. Commit `vendor/babylon.js` and `vendor/cannon-es.js` so static hosts work without `npm install`. `node_modules/` is gitignored.

### Production deploy

Pushes to **`main`** deploy the repo root to **Cloudflare Pages** via `.github/workflows/deploy.yml` (`wrangler pages deploy`, project name `dicealot`). The GitHub repo is the source of truth; the live game URL is the one Cloudflare assigns (or your custom domain).

**Battle physics defaults:** `BATTLE_TUNE_DEFAULTS` in `battle.html` and `throw-lab.mjs` is the canonical “shipping” feel for ROLL + sling. Visitors without saved data get that. Optional **Tune → Apply** in battle still persists overrides in `localStorage` under `battle_tune_json_v1` (same key as throw-lab). When changing defaults, edit **both** files in one commit.

### GitHub: новый проект на `main`, старый не потерять

1. **Зафиксировать старое состояние** (пока ещё старый код на `main`):
   ```bash
   git checkout main && git pull
   git branch archive/old-main-before-dice-a-lot
   git push -u origin archive/old-main-before-dice-a-lot
   ```
   При желании ещё тег: `git tag archive/old-main-YYYY-MM-DD && git push origin archive/old-main-YYYY-MM-DD`.

2. **Подставить новый контент** в рабочую копию (например весь каталог `dice-a-lot/` как корень репозитория, или смержить папки осознанно). Старый корневой `index.html` из этого репо перенесён в `legacy/dice-box-spike.html`.

3. **Точка входа для браузера:** в корне репо лежит `index.html` — он сразу ведёт на `battle.html`. Основной прод сейчас через **Cloudflare Pages** (см. выше). Альтернатива: **GitHub Pages** — `https://<user>.github.io/<repo>/`, ветка **`main`**, папка **`/ (root)`** (или **/docs** с копией `index.html`, `battle.html`, `vendor/`).

5. **Не смешивать файлы:** либо новый проект = новый корень (рекомендуется), либо старое целиком в `archive/old-site/` одним коммитом, затем добавить новые файлы отдельными коммитами.

## How It Works

1. Clone this repo
2. Open in an IDE with a coding agent (Cursor, VS Code + Copilot, etc.)
3. Start the local server from the **`dice-a-lot`** folder: `node server.mjs` → open **`http://127.0.0.1:4174/`** (not `file://` — `battle.html` uses ES modules and will not run from a double‑clicked file).
4. **`index.html`** on `http://` immediately redirects to `battle.html`. If opened as **`file://`**, it stays on a short **Russian help page** explaining that you must use the local server (modules + physics require HTTP).
5. Open `battle.html` directly **via the same server**; `spike-v2.html` for the engine sandbox; **`throw-lab.html`** for throw-only tuning (ROLL + sling, no combat UI).
6. The coding agent reads the rules and follows a 4-phase workflow:

| Phase | What happens | Output |
|-------|-------------|--------|
| 1. Design | Agent writes a game design document | `DESIGN.md` |
| 2. Planning | Agent creates an ordered task list | `TODO.md` |
| 3. Implementation | Agent builds the game task by task | `src/` |
| 4. Testing | Agent writes tests, fixes failures until all pass | `tests/` |

The coding agent checks every change against the architecture and design rules. If your request would violate a rule, it warns you and proposes alternatives before writing any code.

**Production game (`src/index.html`)** today: fullscreen 3D Farkle vs bot, **vendored** Babylon.js + cannon-es, **pull-back sling** (single-point cluster, 1 die visible during aim) + **ROLL**. **UI (v1.0.6):** compact HP widgets, damage fly-up + HP flash/shake, side turn indicators, compact top-docked info bar, green valid / red invalid selection colors, centered banners (incl. REROLL!), 9×9 held zones with correct face-up display, auto-hiding action buttons, imperative Round History log. **Rules & Dices panel** with scoring combos and die descriptions. **Physics baseline:** unified ROLL/sling impulse, gravity −300, mass 3.0, dieScale 3.06. **Stacked dice reroll** mechanic (player taps, bot auto). **`throw-lab.html`** — throw-only sandbox with the same `battle_tune_json_v1` tuning. Details: `ARCHITECTURE.md` (Battle Prototype, Throw lab), `DESIGN.md` section 10.6 + 14.

For subsequent changes (new features, balance tweaks, mechanic removals), use `NEXT_ITERATION_PROMPT.md` — it ensures the agent updates `DESIGN.md` first, then plans and implements, rather than jumping straight to code.

## What's Inside

When the project lives inside a parent folder (e.g. **3D Dicing**), Cursor may load **`.cursor/rules/*.mdc`** from that parent — see `chat-context-and-docs.mdc` for chat-context warnings and doc-sync expectations.

```
├── AGENTS.md                # Coding agent rules: workflow, guard behavior, coding standards
├── ARCHITECTURE.md          # Code architecture: store API, dual loading, 3D engine arch
├── DESIGN.md                # Game design document (scoring, dice roster, progression, 3D engine)
├── DESIGN_RULES.md          # Game design principles: balance, UX, progression, etc.
├── TODO.md                  # Implementation task list with milestone tracking
├── package.json             # devDependencies: babylonjs, cannon-es; script vendor:sync
├── scripts/
│   └── sync-vendor.mjs      # Copies babylon.js + cannon-es.js into vendor/
├── vendor/                  # Runtime copies of libs (commit for GitHub Pages, no CDN)
│   ├── babylon.js
│   └── cannon-es.js
├── index.html               # Entry: HTTP → battle.html; file:// → help (RU) + link to battle
├── server.mjs               # Local HTTP server (port 4174)
├── spike-v2.html            # 3D engine validation spike (BabylonJS + cannon-es)
├── battle.html              # Battle prototype — full 3D Farkle + combat + bot AI + sling throw
├── throw-lab.html           # Throw sandbox: ROLL + sling, tune + «Реализм броска», roll log
├── throw-lab.mjs            # Module for throw-lab (same battleTune shape as battle)
├── tools/
│   ├── dice-constructor.html # Visual die designer with 3D preview + Copy Config
│   └── calibrate-bias.mjs    # Headless cannon-es bias calibration
├── legacy/
│   └── dice-box-spike.html  # Older full-page dice-box prototype (was root index.html)
├── src/
│   ├── index.html           # Entry point — IIFE scripts + engine module + SVG sling viz
│   ├── main.js              # Init, system wiring, START_BATTLE + START_TURN (IIFE)
│   ├── store/
│   │   └── store.js         # State management engine (don't modify)
│   ├── config/              # Designer data — read-only at runtime (IIFE)
│   │   ├── scoring.js       #   Scoring table, N-of-a-kind multipliers
│   │   ├── dice.js          #   Die type definitions
│   │   ├── encounters.js    #   Encounter list
│   │   ├── balance.js       #   HP, bot thresholds
│   │   └── strings.js       #   UI strings
│   ├── systems/             # One file = one state slice (IIFE)
│   │   ├── turnSystem.js    #   FSM: idle → selecting → idle/bust, DICE_SETTLED
│   │   ├── playerSystem.js  #   state.player (HP, loadout)
│   │   ├── enemySystem.js   #   state.enemy (HP, AI)
│   │   ├── matchSystem.js   #   state.match (battle lifecycle)
│   │   ├── loadoutSystem.js #   state.loadout (6 slots, SET_LOADOUT)
│   │   ├── botSystem.js     #   async bot AI: 3 difficulties, risk threshold
│   │   └── scoringSystem.js #   pure scoring (bitmask DP, bust detection)
│   ├── engine/              # 3D rendering layer (ES modules, BabylonJS + cannon-es)
│   │   ├── diceEngine.js    #   Scene, physics, render loop, throw functions
│   │   ├── dieFactory.js    #   Procedural die geometry, FACE_UP_QUATS
│   │   └── diceBridge.js    #   Store↔3D bridge, sling SVG viz, DICE_SETTLED, renderSlotPreview
│   ├── vendor/              # Vendored libs (BabylonJS, cannon-es) — inside src/ for deploy
│   │   ├── babylon.js
│   │   └── cannon-es.js
│   └── ui/                  # View layer — dispatch and subscribeTo only (IIFE)
│       ├── battleUI.js      #   DOM rendering: HP, dice, buttons, phase hints
│       ├── inputHandler.js  #   Player clicks → dispatch, banners, lock/unlock
│       └── loadoutUI.js     #   Loadout editor modal (6 slots, inventory, detail panel)
└── tests/
    ├── index.html           # Test runner — open in browser
    ├── helpers.js            # Minimal test framework (assert, assertEqual)
    ├── test-store.js         # Store engine tests (28 tests)
    ├── test-scoring.html     # Scoring engine browser tests
    ├── test-scoring.js       # Scoring logic tests
    ├── test-turn.js          # Turn FSM tests
    └── test-match.js         # Match system tests
```

**Rules** (permanent, define standards):
- `AGENTS.md` — how the coding agent should work: 4-phase workflow, guard behavior that blocks rule-violating changes, coding conventions
- `ARCHITECTURE.md` — Mutable UDF + Deterministic Lockstep: one mutable state object, dispatched events logged for replay. Dual loading: game logic via IIFE, 3D engine via ES modules
- `DESIGN_RULES.md` — 9 game design principles: intuitive affordances, emergent gameplay, wave-like difficulty, player agency, PEGI 12 compliance, etc.

## Key Constraints

- **Local HTTP server required for `battle.html` / `spike-v2.html`.** They use `<script type="module">` + an import map pointing at **`./vendor/cannon-es.js`**. Browsers block this under `file://`. Use `node server.mjs` (port 4174) or any static host (e.g. GitHub Pages). **`npm install`** is only needed to refresh vendored files (`npm run vendor:sync`); the playable site does not require a bundler at runtime.
- **Dual loading strategy (target architecture).** Game logic in `src/` uses IIFEs and `window` globals. The 3D engine layer (`src/engine/`) is planned to use ES modules. The current **`battle.html`** prototype is a single self-contained module script for speed; future work is to extract it per `TODO.md` group 0C.
- **Deterministic replay (2D).** All randomness goes through a seeded PRNG (`store.prng.next()`). `Math.random()` is forbidden in game logic. **In 3D mode**, physics determines actual face values — the bridge dispatches `DICE_SETTLED` with physics-read results, overriding PRNG values in the store.
- **Pure state.** `store.state` contains only plain serializable data (numbers, strings, booleans, objects, arrays). No DOM refs, no class instances.
- **Custom 3D dice.** No external 3D models or texture atlases. Dice geometry is procedural code (BabylonJS `VertexData`).

## Architecture at a Glance

```
User Input → store.dispatch(type, payload)
           → logged in store.history
           → handler mutates store.state
           → subscribers notified → UI updates
```

Two kinds of state changes, kept strictly separate:

| Kind | How | Logged? | Use for |
|------|-----|---------|---------|
| Discrete events | `store.dispatch()` | Yes | inputs, spawns, deaths |
| Continuous simulation | `system.update(state, dt)` | No | movement, physics, AI |

## Running

```bash
# Start the local server
node server.mjs

# Open in browser
# http://127.0.0.1:4174/battle.html                — 3D battle prototype (play here)
# http://127.0.0.1:4174/src/index.html              — game entry point (v1.0.0+ playable)
# http://127.0.0.1:4174/tools/dice-constructor.html — dice visual designer tool
# http://127.0.0.1:4174/throw-lab.html              — throw tuning lab (shared Tune JSON)
# http://127.0.0.1:4174/spike-v2.html              — 3D dice engine sandbox
```

## Running Tests

Open `tests/index.html` in a browser via the local server. All results display on the page.

Or run via Node.js:

```bash
node -e "
globalThis.window = globalThis;
globalThis.document = { getElementById: function() { return null }, title: '' };
require('./src/store/store.js');
require('./tests/helpers.js');
require('./tests/test-store.js');
var r = TestRunner.results, p = 0, f = 0;
r.forEach(function(t) { t.pass ? p++ : (f++, console.log('FAIL:', t.message)); });
console.log(p + ' passed, ' + f + ' failed');
process.exit(f);
"
```

## License

MIT
