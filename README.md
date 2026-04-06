# Dice-a-Lot — 3D Dice Battle Game

A browser-first dice RPG prototype inspired by Farkle. Special dice with unique abilities, loadout building, PvE bot battles, HP-based combat, and a full progression ladder — all rendered with 3D physics dice.

## 3D Engine

The game uses a custom dice rendering engine:

| Layer | Technology |
|-------|-----------|
| Rendering | **BabylonJS** (`vendor/babylon.js`, synced from npm) |
| Physics | **cannon-es** (`vendor/cannon-es.js`, synced from npm) |
| Geometry | Procedural rounded box with flat pip discs |

Dice are built entirely in code — no external 3D models or texture atlases. Each die is a rounded box with geometric pip notches, flat circular pip meshes, and a dark backing box. Physics simulation handles rolling, collisions, and settling. Engine validated in `spike-v2.html`, full battle prototype in `battle.html`, **physics / throw feel** iterated in **`throw-lab.html`** (same Babylon + cannon-es stack, shared `battle_tune_json_v1` with battle).

**Vendored libs (no CDN at runtime):** `battle.html` and `spike-v2.html` load from `vendor/`. After changing versions in `package.json`, run `npm install` then `npm run vendor:sync`. Commit `vendor/babylon.js` and `vendor/cannon-es.js` so GitHub Pages and static hosts work without `npm install`. `node_modules/` is gitignored.

### GitHub: новый проект на `main`, старый не потерять

1. **Зафиксировать старое состояние** (пока ещё старый код на `main`):
   ```bash
   git checkout main && git pull
   git branch archive/old-main-before-dice-a-lot
   git push -u origin archive/old-main-before-dice-a-lot
   ```
   При желании ещё тег: `git tag archive/old-main-YYYY-MM-DD && git push origin archive/old-main-YYYY-MM-DD`.

2. **Подставить новый контент** в рабочую копию (например весь каталог `dice-a-lot/` как корень репозитория, или смержить папки осознанно). Старый корневой `index.html` из этого репо перенесён в `legacy/dice-box-spike.html`.

3. **Точка входа для браузера:** в корне репо лежит `index.html` — он сразу ведёт на `battle.html`. На GitHub Pages URL вида `https://<user>.github.io/<repo>/` откроет игру.

4. **Включить Pages:** репозиторий → **Settings → Pages** → Source: ветка **`main`**, папка **`/ (root)`** (если сайт — корень репо). Если публикуешь только подпапку, настрой **/docs** и положи туда копию с `index.html` и `battle.html` + `vendor/`.

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

**Battle prototype (`battle.html`)** today: fullscreen 3D Farkle vs bot, **vendored** Babylon.js + cannon-es, **pull-back sling** (anchor→release in world XZ, wedge HUD projected from the same line; **ROLL** = classic bottom throw), **camera debug** (orbit + copy JSON), sandwich table (wide **roll** strip, narrow **shelves**). **`throw-lab.html`** — throw-only sandbox with the same `battle_tune_json_v1` tuning. Details: `ARCHITECTURE.md` (Battle Prototype, Throw lab), `DESIGN.md` section 14.

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
├── legacy/
│   └── dice-box-spike.html  # Older full-page dice-box prototype (was root index.html)
├── src/
│   ├── index.html           # Entry point — IIFE scripts + engine module
│   ├── main.js              # Game loop skeleton (IIFE)
│   ├── store/
│   │   └── store.js         # State management engine (don't modify)
│   └── engine/              # 3D rendering layer (ES modules) — to be extracted from spike
└── tests/
    ├── index.html           # Test runner — open in browser
    ├── helpers.js            # Minimal test framework (assert, assertEqual)
    └── test-store.js         # Store engine tests (28 tests)
```

**Rules** (permanent, define standards):
- `AGENTS.md` — how the coding agent should work: 4-phase workflow, guard behavior that blocks rule-violating changes, coding conventions
- `ARCHITECTURE.md` — Mutable UDF + Deterministic Lockstep: one mutable state object, dispatched events logged for replay. Dual loading: game logic via IIFE, 3D engine via ES modules
- `DESIGN_RULES.md` — 9 game design principles: intuitive affordances, emergent gameplay, wave-like difficulty, player agency, PEGI 12 compliance, etc.

## Key Constraints

- **Local HTTP server required for `battle.html` / `spike-v2.html`.** They use `<script type="module">` + an import map pointing at **`./vendor/cannon-es.js`**. Browsers block this under `file://`. Use `node server.mjs` (port 4174) or any static host (e.g. GitHub Pages). **`npm install`** is only needed to refresh vendored files (`npm run vendor:sync`); the playable site does not require a bundler at runtime.
- **Dual loading strategy (target architecture).** Game logic in `src/` uses IIFEs and `window` globals. The 3D engine layer (`src/engine/`) is planned to use ES modules. The current **`battle.html`** prototype is a single self-contained module script for speed; future work is to extract it per `TODO.md` group 0C.
- **Deterministic replay.** All randomness goes through a seeded PRNG (`store.prng.next()`). `Math.random()` is forbidden in game logic. 3D physics animation is visual-only — face values are predetermined.
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
# http://127.0.0.1:4174/battle.html      — 3D battle prototype (play here)
# http://127.0.0.1:4174/throw-lab.html   — throw tuning lab (shared Tune JSON)
# http://127.0.0.1:4174/spike-v2.html   — 3D dice engine sandbox
# http://127.0.0.1:4174/src/index.html   — game entry point (WIP)
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
