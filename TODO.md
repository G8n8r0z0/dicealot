# TODO — Dice-a-Lot

> Ordered implementation plan. **3D engine validation first** — resolve the highest-risk unknown before building game logic on top.
> Each task references `DESIGN.md` sections and lists affected files.
> Tasks are grouped by layer. Execute sequentially within each group; groups may overlap where noted.

---

## Reference: Previous Project (`dicing/battle.html`)

The previous 2D prototype (`C:\Users\lgene\Desktop\dicing\battle.html`, ~8900 lines, monolith) contains a working implementation of the following. Use as reference when implementing the corresponding tasks — port, don't rewrite from scratch.

### Scoring Engine (lines 4579–4917)

- **Bitmask DP** for evaluating all valid scoring subsets (2^6 = 64 for 6 dice).
- Standard table: singles (1/5), sets (3-of-a-kind → 6-of-a-kind), short straights (1-5, 2-6), full straight (1-6), three pairs.
- **Joker**: solo = 100, wildcard = tries replacements 1–6 and picks best valid combination.
- **`hasPlayableDice()`**: bust detection — brute-force all subsets.
- **`findBestBotChoice()`**: bot selection logic — sort all valid subsets by score, style-based pick.

### Player Scoring Contract (line 4502)

- **Click-order-first**: `scorePlayerSelection()` uses sequential contiguous-packet decomposition.
- **Board-order fallback**: only if click-order is invalid AND no Chain Die present.
- **Chain Die exception**: strict click-order only, no fallback allowed.

### Chain / Royal / Forge Decoration (lines 7049–7221)

- **Chain**: builds metadata (tier, allowed values, required counts), converts Chain to target value, scores, wraps base scoring functions.
- **Royal**: +150 bonus if any group is a straight containing the Royal die.
- **Forge**: +100 for three-of-a-kind containing Forge (tier II/III scale with set size).
- Pattern: layered decoration applied after base scoring.

### Active Abilities (lines 7751–7814)

- **Frog JUMP**: `randomWeightedDieValue('frog')`, once per turn, clears selection, checks bust after.
- **Flipper FLIP**: opposite face (`1↔6, 2↔5, 3↔4`), once per turn.
- **Tuner TUNE**: `shiftDieValue(value, delta)` (+1/-1, wrapping 1↔6), tier-based targeting (self → adjacent → any).

### Bot AI (lines 8051–8254)

- **Risk threshold**: novice = 500, advanced ≈ 520 (with random variance), master ≈ 450 (adaptive to HP difference).
- **Async turn loop**: roll → try abilities (Tuner, then Frog if bust) → select best → animate → bank/continue.
- **Playback timings** (proven): roll=900ms, choice=900ms, collect=900ms, bank=850ms, bust=1050ms, hotHand=900ms, turnReturn=900ms.

### Weighted Dice (line 6225)

- **One Love**: 30% chance of 1, uniform for 2–6.
- **Comrade**: 30% chance of 5, uniform for 1,2,3,4,6.
- Other weighted dice (Even, Odd, Mathematician, Cluster) NOT implemented in battle.html.

### Combat Flow

- `finalizePlayerBank(amount)`: player banks → `botHp -= amount` (1:1), check win.
- `finalizeBotBank(amount)`: bot banks → `playerHp -= amount`, check win.
- `handlePlayerBust()`: accumulated score lost, switch to bot after 1600ms delay.
- **Hot Hand**: if `keptDice.length === 6` → auto-bank accumulated, restart with 6 dice.

### What battle.html does NOT have (must write from scratch)

- Bounce, Slime, Bridge, Match, Shrinking, Growing (Common dice)
- Mimic, Clone, Blight, SacriDice, Mirror, Pin, Devil, Gravity, Yin/Yang (Rare dice)
- All Utility dice (Bandie, Pulse, Leech, Transfusion, Second Wind, Siphon)
- Weighted distributions for Even, Odd, Mathematician, Cluster
- Cluster synergy (One Love + Comrade interaction)
- 3D BabylonJS + cannon-es integration (engine validated via spike-v2, production wiring pending)
- Progression ladder from DESIGN.md (battle.html has a different, simpler one)

### Key differences from our architecture

| battle.html | Our project |
|---|---|
| Global mutable vars | `store.state` slices via `store.register` |
| `Math.random()` | `store.prng.next()` (deterministic) |
| Single 8900-line file | Config / systems / UI decomposition |
| No IIFE | IIFE + `window` exports |
| Direct DOM mutation | `store.subscribeTo()` → UI subscribers |
| No event logging | `store.dispatch()` → `store.history` |

---

## 0. 3D Engine Validation (BLOCKING)

Resolve the highest-risk unknown first. If the 3D die pipeline doesn't work, everything visual is blocked.

> **Engine validated via `spike-v2.html`.** Stack: BabylonJS (standalone) + cannon-es.
> Custom procedural die geometry (rounded box + pip discs + backing box).
> Old library (`@3d-dice/dice-box`) and atlas-based constructor (`tools/dice-constructor/`) are abandoned — see DESIGN §14.11.

### 0A. Base Pip Die — VALIDATED

- [x] **0A1.** ~~Audit existing dice-constructor pipeline~~ → **Superseded.** Old `tools/dice-constructor/` pipeline abandoned. New custom constructor validated in `spike-v2.html`: procedural `createDiceVertexData()` + `createPipsVertexData()` + backing box. See DESIGN §14.5.

- [x] **0A2.** ~~Create base white pip die~~ → **Done.** Base die with classic pip layout (white body, dark pips) renders correctly in spike-v2. Geometry: 40-segment rounded box per face, 21 flat disc pips with z-offset, dark backing box.

- [x] **0A3.** ~~Validate base die~~ → **Done.** Pips readable, face values correct (Y+=1, X+=2, Z+=3, Z-=4, X-=5, Y-=6), physics feel stable. Anti-edge nudge prevents unrealistic settling.

- [x] **0A4.** ~~Create colored variant~~ → **Done.** Per-die body color + pip color independently configurable. Proven presets: Classic, Red, Green, Blue, Purple, Dark, Gold. Color changes apply in real time.

- [x] **0A5.** ~~Roll mixed dice together~~ → **Done.** 6 dice simultaneously, mixed colors, physics collision works, all dice readable. 60fps smooth.

### 0B. Battle Interface Shell — VALIDATED

> **All tasks validated in `battle.html` prototype.** Fullscreen 3D canvas with UI overlay, directional throws, click-to-select, held zones, HP combat, bot AI, full Farkle scoring.

- [x] **0B1.** ~~Design battle screen layout~~ → **Done.** Fullscreen 3D canvas with semi-transparent UI overlay (3-column grid: player card, center info+buttons, enemy card + history). Approved layout.

- [x] **0B2.** ~~Create 3D dice canvas~~ → **Done.** BabylonJS + cannon-es, ArcRotateCamera (locked angle), HemisphericLight, DirectionalLight, ShadowGenerator, HighlightLayer, physics world with floor + walls + divider barriers.

- [x] **0B3.** ~~Implement basic roll~~ → **Done.** Directional throws: player from bottom, bot from top. Physics walls confine dice to roll zone.

- [x] **0B3b.** ~~Player pull-back sling + polish~~ → **Done (iter. 2026).** Cluster at **pick** along **anchor→cursor** (not bottom-edge snap); aim = **start−end** XZ (slingshot, opposite stretch); linear strength to `SLING_MAX_PULL_WORLD`; no-pull release = **cancel**. Same **velocity** all dice; dice–dice **on** (`mask` = env|dice); shape + body filters; `DICE_STACK_Y_STEP`; SVG **wedge** + % via `rollXZWorldToClient`. `pointercancel` / turn reset. **Orbit** disables sling. Stash until real throw.

- [x] **0B3c.** ~~Table & camera tooling~~ → **Done.** Sandwich table: shared **X** width, wide **roll** strip in Z, **narrow shelves** (~two dice) for held dice. **Camera debug** UI: α, β, radius, target, Apply, Copy JSON, reset, optional orbit.

- [x] **0B3d.** ~~Throw lab + Tune UX~~ → **Done (2026).** `throw-lab.html` + `throw-lab.mjs`: ROLL + sling only; same `battleTune` and `localStorage['battle_tune_json_v1']` as `battle.html`; sling SVG over canvas inside `.lab-main`; current faces + roll history; «Реализм броска» sliders (mass, gravity, power 0.2×–6×, arc, damping); full Tune panel with EN/RU hints — **`PHYSICS_TUNE_FIELDS` must stay in sync** with `battle.html`. Ref: `ARCHITECTURE.md` (Throw lab), `DESIGN.md` §14.12.

- [x] **0B4.** ~~Implement die selection~~ → **Done.** Click-to-select via `scene.onPointerObservable`, `HighlightLayer` green glow, multi-select, real-time score preview.

- [x] **0B5.** ~~Implement held zone~~ → **Done.** Scored dice animate from roll zone to held zone (player at bottom, bot at top). Symmetric zones separated by physics walls and visual dividers.

- [x] **0B6.** ~~Two-player field~~ → **Done.** Turn indicator, HP bars (player red, bot purple), turn alternation, bot AI auto-play, BUST/HOT HAND/BANK banners, round history log. Win/lose detection.

### 0C. Engine Extraction (NEW)

Extract validated spike code into production modules.

- [ ] **0C1.** Extract `dieFactory.js` — `createDiceVertexData()`, `createPipsVertexData()`, `createDie()`, `removeDie()`. Pure geometry + physics factory, no UI or game logic.
  - Source: `spike-v2.html`
  - Target: `src/engine/dieFactory.js`

- [ ] **0C2.** Extract `diceEngine.js` — scene setup, physics world, render loop, anti-edge nudge, face detection. Exports `init(canvas)`, `throwAll()`, `jumpAll()`, `getDice()`, `dispose()`.
  - Source: `spike-v2.html`
  - Target: `src/engine/diceEngine.js`

- [ ] **0C3.** Create `diceBridge.js` — bridge between IIFE game logic and ES module engine. Subscribes to `store.state.turn`, dispatches `SELECT_DIE`/`DESELECT_DIE` on pointer interaction, triggers roll animations on `ROLL_DICE`.
  - Ref: ARCHITECTURE §3D Engine Architecture, §Engine ↔ Game Logic Contract
  - Target: `src/engine/diceBridge.js`

- [ ] **0C4.** Update `src/index.html` — add CDN script tags, importmap, `<script type="module">` that imports engine. Ensure load order: IIFE scripts first, then module script.
  - Ref: ARCHITECTURE §Dual Loading Strategy
  - Target: `src/index.html`

---

## ── MILESTONE: 3D Engine Proven ──

> **Status: COMPLETE.** Full 3D battle prototype validated in `battle.html`. Engine stack: **vendored** BabylonJS + cannon-es, custom procedural geometry. Core mechanics: directional throws, **pull-back sling** or **ROLL**, click-to-select, sandwich table + narrow shelves, camera debug, kinematic dice stash, held zones, Farkle scoring, Hot Hand, bust, bot AI, HP combat, win/lose. Entry: **`index.html`** (HTTP → `battle.html`; `file://` → server instructions).
> **Remaining:** engine extraction (0C1–0C4) to wire prototype logic through `store.dispatch` + preserve sling/physics tuning in `diceBridge` / `diceEngine`.
> **Docs (2026 sync):** sling behavior, collision filters, wedge HUD, **throw-lab** (shared Tune, realism sliders, HUD layering), Tune field copy (EN/RU), **canonical `BATTLE_TUNE_DEFAULTS`** (battle + throw-lab, matches shipped physics without `localStorage`), Cloudflare Pages deploy, and “propose → approve → implement” preferences are reflected in `ARCHITECTURE.md`, `DESIGN.md` §14, `AGENTS.md`, `README.md`, and workspace `.cursor/rules/chat-context-and-docs.mdc`.

---

## Open Decisions & Deferred Tasks

Items that don't have a task slot yet. Revisit when the corresponding layer is reached.

### Storage: localStorage now, reassess for PvP later

Current approach: `localStorage` for player profile (wins, unlocked dice, loadout), same pattern as `battle.html`. This is sufficient for PvE singleplayer.

**Battle physics:** `battle_tune_json_v1` deep-merges numeric fields into `battleTune` on load. **Repo defaults** (`BATTLE_TUNE_DEFAULTS` in `battle.html` / `throw-lab.mjs`) are the canonical shipping tune (strong ROLL + sling, gravity −93, etc.); incognito and fresh deploys use those. **Tune → Apply** persists overrides; **Reset** clears the key.

**Revisit trigger:** when PvP / live multiplayer enters active scope. A shared session or server-side storage will be needed. Flag this question at that point.

### Die level-up mechanic (Lv1 → Lv2 → Lv3): needs design

DESIGN.md defines level lines for many dice but does not specify **how** a die levels up. No acquisition path exists yet.

**Baseline ideas (not locked):**
- a) Shards — a resource the player earns through progression, spent to level up a specific die.
- b) Player level — global level tied to win count; reaching a threshold auto-upgrades eligible dice.
- c) Usage-based — using a die N times triggers the upgrade.

**Action:** when implementation reaches the first die with a level line (Flipper at task I3, or Even/Odd at H1), pause and design the level-up system first. Add a DESIGN.md section + TODO tasks at that point.

### Group 0B → Group F overlap: resolved

Group 0B is complete — `battle.html` is a standalone prototype with full battle mechanics. Group F will extract and wire the proven logic through `store.subscribeTo`. The prototype serves as the reference implementation for Group F.

### 3D adjacency for targeting abilities

Abilities that reference "neighboring die" (Mimic, Blight, Flipper Lv2, Mirror) need a proximity definition in 3D. Working direction: **physical distance threshold** between settled die `CANNON.Body.position` vectors. The engine already tracks positions for all dice — only the threshold constant needs calibration. TBD when implementing the first adjacency-dependent ability (Flipper Lv2 at I3 or Mimic at M2).

---

## A. Config Foundation

Static data files. No logic, no state. Loaded before everything else.

- [ ] **A1.** Scoring table config — standard combinations, scores, dice counts, short straights.
  - Ref: DESIGN §3.1
  - File: `src/config/scoring.js` → `window.config.scoring`

- [ ] **A2.** Dice definitions — every die type: id, name, category, rarity, mechanic summary, weight distributions per level, ability type, level line data, visual hints.
  - Ref: DESIGN §8.2–8.9
  - File: `src/config/dice.js` → `window.config.dice`

- [ ] **A3.** Encounter definitions — bot entries from Common + Rare ladders: id, name, HP, difficulty tag, personality.
  - Ref: DESIGN §9.3, §9.4, §11
  - File: `src/config/encounters.js` → `window.config.encounters`

- [ ] **A4.** Balance constants — player base HP, score-to-damage ratio, Hot Hand rules, bust thresholds.
  - Ref: DESIGN §7.2, §7.3, §5
  - File: `src/config/balance.js` → `window.config.balance`

- [ ] **A5.** UI strings — all player-facing text (button labels, phase names, result messages, tutorial text stubs).
  - Ref: DESIGN §10, §12
  - File: `src/config/strings.js` → `window.config.strings`

---

## B. Scoring Engine

Pure evaluation functions. No state ownership — called by turnSystem.

- [ ] **B1.** Base scoring evaluator — given an array of dice values, return all valid scoring combinations from the standard table (singles 1/5, three-of-a-kind through six-of-a-kind, short straights, full straight, three pairs).
  - Ref: DESIGN §3.1
  - File: `src/systems/scoringSystem.js` → `window.scoringSystem`

- [ ] **B2.** Selection validator — given a player's selected dice subset, determine if it forms a valid scoring combination. Return score or invalid. Respect click-order-first contract: do NOT auto-optimize.
  - Ref: DESIGN §6
  - File: `src/systems/scoringSystem.js`

- [ ] **B3.** Joker wildcard resolution — if Joker (value 1 = active) is in the selection, resolve as wildcard substitute for best valid combination in that exact selection. Joker alone = 100. Mixed selection: no separate 100.
  - Ref: DESIGN §4
  - File: `src/systems/scoringSystem.js`

- [ ] **B4.** Bust detection — given remaining dice values, determine if any valid scoring subset exists. If none → bust.
  - Ref: DESIGN §2.1 step 6
  - File: `src/systems/scoringSystem.js`

- [ ] **B5.** Tests for scoring — all standard combinations, edge cases, Joker resolution, short straights, bust detection, click-order contract.
  - File: `tests/test-scoring.js`

---

## C. Turn State Machine

Owns `state.turn`. The core `roll → select → score → decide` loop.

- [ ] **C1.** Turn system init — register state slice `state.turn` with: `rolledDice[]`, `heldDice[]`, `selectedIndices[]`, `accumulatedScore`, `phase` (roll/select/scored/decide), `bustFlag`, `hotHandFlag`, `diceCount`, `turnNumber`, `activeAbilities`.
  - Ref: DESIGN §2.1, §16.1
  - File: `src/systems/turnSystem.js` → `window.turnSystem`

- [ ] **C2.** `ROLL_DICE` handler — generate values for `diceCount` dice via `store.prng.next(1, 6)`. Apply weighted distributions if special dice are in loadout. Set phase to `select`. Auto-detect bust (call scoringSystem).
  - Ref: DESIGN §2.1 step 1, §14.7
  - File: `src/systems/turnSystem.js`

- [ ] **C3.** `SELECT_DIE` / `DESELECT_DIE` handlers — toggle die in `selectedIndices[]`. Validate selection via scoringSystem on each change (enable/disable Score button).
  - Ref: DESIGN §2.1 step 3, §6
  - File: `src/systems/turnSystem.js`

- [ ] **C4.** `SCORE_SELECTION` handler — move selected dice to `heldDice[]`, add score to `accumulatedScore`, reduce `diceCount`. Check Hot Hand (all 6 held → auto-bank). Set phase to `decide`.
  - Ref: DESIGN §2.1 steps 4–5, §5
  - File: `src/systems/turnSystem.js`

- [ ] **C5.** `BANK` handler — finalize `accumulatedScore`, set `bankReady` flag for matchSystem to convert to damage. Reset turn state.
  - Ref: DESIGN §2.1 step 5, §7.2
  - File: `src/systems/turnSystem.js`

- [ ] **C6.** `BUST` handler — clear `accumulatedScore`, set `bustFlag`, reset turn state.
  - Ref: DESIGN §2.1 step 6
  - File: `src/systems/turnSystem.js`

- [ ] **C7.** `HOT_HAND` handler — auto-bank when all 6 dice scored in a turn. Bank accumulated score, then start fresh roll with 6 dice.
  - Ref: DESIGN §5
  - File: `src/systems/turnSystem.js`

- [ ] **C8.** Tests for turn flow — roll, select, score, bank, bust, hot hand, accumulated score tracking.
  - File: `tests/test-turn.js`

---

## D. Combat & Match System

Match lifecycle and HP damage bridge.

- [ ] **D1.** Match system init — register `state.match` with: `phase` (hub/loadout/battle/result), `activePlayer` (player/enemy), `turnCount`, `winner`.
  - Ref: DESIGN §10.1, §16.1
  - File: `src/systems/matchSystem.js` → `window.matchSystem`

- [ ] **D2.** `START_BATTLE` handler — load encounter from config, initialize enemy HP, set phase to `battle`, set `activePlayer` to `player`.
  - Ref: DESIGN §10.4
  - File: `src/systems/matchSystem.js`

- [ ] **D3.** `END_TURN` handler — switch `activePlayer`, increment `turnCount`. If bank flag is set, dispatch `DEAL_DAMAGE`.
  - Ref: DESIGN §7.2
  - File: `src/systems/matchSystem.js`

- [ ] **D4.** Player system init — register `state.player` with: `hp`, `loadout[]`, `collection[]`, `wins`, `name`.
  - Ref: DESIGN §7.3, §16.1
  - File: `src/systems/playerSystem.js` → `window.playerSystem`

- [ ] **D5.** Enemy system init — register `state.enemy` with: `hp`, `maxHp`, `name`, `personality`, `loadout[]`.
  - Ref: DESIGN §11, §16.1
  - File: `src/systems/enemySystem.js` → `window.enemySystem`

- [ ] **D6.** `DEAL_DAMAGE` handler — reduce target HP by banked score (1:1 ratio). If HP ≤ 0 → set `winner`, set phase to `result`.
  - Ref: DESIGN §7.2
  - File: `src/systems/playerSystem.js` (for player HP), `src/systems/enemySystem.js` (for enemy HP)

- [ ] **D7.** Tests for combat — start battle, deal damage, HP reduction, win/lose detection, turn switching.
  - File: `tests/test-match.js`

---

## E. Battle UI — 2D Shell

HTML + DOM rendering. Dispatches actions, subscribes to state.

- [ ] **E1.** Battle screen HTML structure — dice area placeholder, held zone, HP bars (player + enemy), accumulated score display, turn indicator, action buttons (Roll / Bank / Continue), round history panel.
  - Ref: DESIGN §10.5
  - File: `src/index.html`

- [ ] **E2.** Battle UI module — mount/unmount, subscribe to `state.turn`, `state.player.hp`, `state.enemy.hp`, `state.match`. Update DOM on state changes.
  - Ref: DESIGN §10.5
  - File: `src/ui/battleUI.js` → `window.battleUI`

- [ ] **E3.** Input handler — button click → `store.dispatch()` for ROLL_DICE, SELECT_DIE, SCORE_SELECTION, BANK. Enable/disable buttons based on turn phase.
  - Ref: DESIGN §2.1
  - File: `src/ui/inputHandler.js` → `window.inputHandler`

- [ ] **E4.** Update `main.js` — wire system inits, system updates, battle UI mount. Update `index.html` script load order.
  - File: `src/main.js`, `src/index.html`

---

## ── MILESTONE: Playable Base Game (2D) ──

> After groups A–E: standard Farkle with combat works in 2D (dice shown as text/numbers). Player can roll, select, score, bank, bust. HP damage works. Win/lose detected. No special dice, no 3D, no bot.

---

## F. 3D Rendering Bridge

Connects store state to the custom BabylonJS + cannon-es engine.

> **Note:** Most of the 3D rendering primitives are already validated in spike-v2 and will be extracted in Group 0C. Group F focuses on wiring the extracted engine to the store-driven game logic.

- [ ] **F1.** Bridge initialization — `diceBridge.init(canvasEl)` calls `diceEngine.init()`, reads `config.dice` for die type definitions, subscribes to relevant state slices.
  - Ref: DESIGN §14.2, §14.4, ARCHITECTURE §Engine ↔ Game Logic Contract
  - File: `src/engine/diceBridge.js`

- [ ] **F2.** Roll rendering — subscribe to `state.turn.rolledDice`. On `ROLL_DICE`, call `diceEngine.throwAll(values)` with predetermined face values. Engine animates dice to land on those faces.
  - Ref: DESIGN §14.7
  - File: `src/engine/diceBridge.js`

- [ ] **F3.** Die selection in 3D — pointer observable on settled die → `store.dispatch('SELECT_DIE', { dieIndex })`. HighlightLayer glow on selected dice driven by `state.turn.selectedIndices`.
  - Ref: DESIGN §14.3 items 5, §2.1 step 3
  - File: `src/engine/diceBridge.js`

- [ ] **F4.** Held zone rendering — on `SCORE_SELECTION`, animate scored dice into held area. On new roll, remaining dice re-throw.
  - Ref: DESIGN §2.1 step 4
  - File: `src/engine/diceBridge.js`

- [ ] **F5.** Per-die-type visuals — read die type from loadout → apply body color, pip color, and any custom marks from `config.dice[type].visual`.
  - Ref: DESIGN §14.5.6, §13
  - File: `src/engine/diceBridge.js`, `src/config/dice.js`

- [ ] **F6.** Drag-and-drop integration — (a) **roll sling**: table-plane pull-back → cluster kinematic → release → dynamic + impulse (see `battle.html`). (b) Future: drag dice to held / ability zones if design requires per-die pickup (spike-style).
  - Ref: DESIGN §14.3, ARCHITECTURE §Interaction Model
  - File: `src/engine/diceBridge.js`, `diceEngine.js`

---

## G. Bot AI

Same roll/select/score/bank structure as player. Automated decision-making.

- [ ] **G1.** Bot turn logic — when `activePlayer === 'enemy'`: auto-roll, evaluate all valid combinations via scoringSystem, select highest-value combination, decide bank vs continue based on risk threshold.
  - Ref: DESIGN §11
  - File: `src/systems/botSystem.js` → `window.botSystem`

- [ ] **G2.** Bot risk profiles — Cautious (bank early), Balanced, Greedy (push deep). Threshold driven by encounter personality from config.
  - Ref: DESIGN §11
  - File: `src/systems/botSystem.js`, `src/config/encounters.js`

- [ ] **G3.** Bot turn visualization — animate bot actions on the 3D board with delays: roll → pause → select → pause → bank/continue. Player watches live.
  - Ref: DESIGN §10.5
  - File: `src/systems/botSystem.js`, `src/bridge/diceBridge.js`

- [ ] **G4.** Tests for bot — correct selection logic, risk threshold behavior, turn completion.
  - File: `tests/test-bot.js`

---

## ── MILESTONE: Playable 3D Battle ──

> After groups A–G: full 3D Farkle battle against a bot. Roll, select, score, bank in 3D. Bot plays back. HP combat works. Win/lose detected. Base dice only.

---

## H. Common Dice — Passive Mechanics

Weighted rolls and passive triggers. No player activation button needed.

- [ ] **H1.** Weighted roll support — during ROLL_DICE, check each die's weight distribution from config. Use `store.prng` with weighted random selection instead of uniform.
  - Ref: DESIGN §8.5 (One Love, Comrade, Even, Odd, Mathematician, Cluster)
  - File: `src/systems/turnSystem.js`

- [ ] **H2.** Cluster loadout synergy — if One Love and/or Comrade in loadout, adjust Cluster weights per design.
  - Ref: DESIGN §8.5 Cluster
  - File: `src/systems/turnSystem.js`

- [ ] **H3.** Bounce Die — if Bounce scores, return it to the dice pool once with random value (Lv1) / biased value (Lv2–3). Hard cap on returns per turn.
  - Ref: DESIGN §8.5 Bounce
  - File: `src/systems/turnSystem.js`

- [ ] **H4.** Slime Die — on roll result `6`, spawn 1 temporary extra die with random/biased value. Slime itself may change to `5` at higher levels.
  - Ref: DESIGN §8.5 Slime
  - File: `src/systems/turnSystem.js`

- [ ] **H5.** Shrinking / Growing Die — track direction state per die. Each roll steps value by -1/+1 with loop (1↔6).
  - Ref: DESIGN §8.5 Shrinking, Growing
  - File: `src/systems/turnSystem.js`

- [ ] **H6.** Tests for passive dice.
  - File: `tests/test-dice-passive.js`

---

## I. Common Dice — Active Abilities

Require player activation via a button press.

- [ ] **I1.** `USE_ABILITY` handler scaffold — generic handler that routes to ability-specific logic based on `payload.ability`.
  - Ref: DESIGN §16.2
  - File: `src/systems/diceAbilitySystem.js` → `window.diceAbilitySystem`

- [ ] **I2.** Frog — JUMP: reroll selected Frog die to a random face via `store.prng`. Once per turn.
  - Ref: DESIGN §8.5 Frog
  - File: `src/systems/diceAbilitySystem.js`

- [ ] **I3.** Flipper — FLIP: change die to opposite face (1↔6, 2↔5, 3↔4). Level line: self → adjacent → any.
  - Ref: DESIGN §8.5 Flipper
  - File: `src/systems/diceAbilitySystem.js`

- [ ] **I4.** Ability button UI — secondary action button row under main buttons. Show/hide per ability availability. JUMP, FLIP buttons dispatch `USE_ABILITY`.
  - Ref: DESIGN §10.5
  - File: `src/ui/abilityUI.js` → `window.abilityUI`

- [ ] **I5.** 3D ability feedback — die rotation/value-change animation when ability activates.
  - Ref: DESIGN §14.8
  - File: `src/bridge/diceBridge.js`

- [ ] **I6.** Tests for active abilities.
  - File: `tests/test-dice-active.js`

---

## J. Common Dice — Pattern Helpers

Modify scoring evaluation when present in a selection.

- [ ] **J1.** Chain Die integration — in scoringSystem, if Chain is in selection, allow it to count as extra `1` or `5` per level rules. Click-order targeting enforced.
  - Ref: DESIGN §8.5 Chain
  - File: `src/systems/scoringSystem.js`

- [ ] **J2.** Match Die integration — in scoringSystem, if Match is in selection with 2+ matching `2/3/4/6`, count Match as one more. Player must choose target if ambiguous.
  - Ref: DESIGN §8.5 Match
  - File: `src/systems/scoringSystem.js`, `src/ui/abilityUI.js` (target chooser)

- [ ] **J3.** Bridge Die integration — in scoringSystem, if Bridge is in a straight-attempt selection, it may complete the missing value. Does not help with sets.
  - Ref: DESIGN §8.5 Bridge
  - File: `src/systems/scoringSystem.js`

- [ ] **J4.** Tests for pattern helpers.
  - File: `tests/test-dice-pattern.js`

---

## K. Hub & Loadout

Game shell outside of battle.

- [ ] **K1.** Hub screen HTML — Play button, bot difficulty selector, Loadout button, Tutorial button, Unlock Status display, Reset button.
  - Ref: DESIGN §10.2
  - File: `src/index.html`

- [ ] **K2.** Hub UI module — show/hide hub vs battle, subscribe to `state.match.phase`. Dispatch `START_BATTLE` on play.
  - Ref: DESIGN §10.1
  - File: `src/ui/hubUI.js` → `window.hubUI`

- [ ] **K3.** Loadout editor — left: owned dice pool, right: 6 active slots, detail card. Dispatch `SET_LOADOUT` on confirm. Empty slots = base dice.
  - Ref: DESIGN §10.3
  - File: `src/ui/loadoutUI.js` → `window.loadoutUI`

- [ ] **K4.** Phase transitions — hub → loadout → battle → result → hub. matchSystem handles phase changes, UI modules mount/unmount accordingly.
  - Ref: DESIGN §10.1
  - File: `src/systems/matchSystem.js`, `src/ui/hubUI.js`, `src/ui/battleUI.js`

---

## L. Progression System

Win counter and staged unlock ladder.

- [ ] **L1.** Campaign system init — register `state.campaign` with: `totalWins`, `unlockedDice[]`, `completedEncounters[]`.
  - Ref: DESIGN §9.1, §16.1
  - File: `src/systems/campaignSystem.js` → `window.campaignSystem`

- [ ] **L2.** `UNLOCK_DIE` handler — on battle win, increment `totalWins`, check against Common + Rare ladders, unlock newly earned dice.
  - Ref: DESIGN §9.2, §9.3, §9.4
  - File: `src/systems/campaignSystem.js`

- [ ] **L3.** Result overlay — battle result screen (win/lose), unlocked die notification, next die requirement preview. Return to hub button.
  - Ref: DESIGN §9.2
  - File: `src/ui/resultOverlay.js` → `window.resultOverlay`

- [ ] **L4.** Unlock status on hub — display total wins, next unlock target, owned dice count.
  - File: `src/ui/hubUI.js`

- [ ] **L5.** Persistence via `localStorage` — save/load player profile (wins, unlocked dice, loadout, completed encounters). Load on page open, save after each state change. Pattern from `battle.html` (`PROFILE_STORAGE_KEY`).
  - Ref: battle.html reference (lines 5531–5603)
  - File: `src/systems/campaignSystem.js`

- [ ] **L6.** Tests for progression — win counting, unlock ladder checks, collection updates, save/load roundtrip.
  - File: `tests/test-campaign.js`

---

## ── MILESTONE: Full Common Layer ──

> After groups A–L: all Common dice playable with active/passive mechanics. Hub ↔ Battle flow works. Loadout editor works. Common progression ladder functional. Bot battles with increasing difficulty.

---

## M. Rare Dice — Active

More complex abilities with targeting.

- [ ] **M1.** Tuner — TUNE: shift selected die +1/-1. Level line: self → adjacent → any.
  - Ref: DESIGN §8.7 Tuner
  - File: `src/systems/diceAbilitySystem.js`

- [ ] **M2.** Mimic — MIMIC: copy neighbor's numeric value. Player selects Mimic → button → selects neighbor.
  - Ref: DESIGN §8.7 Mimic
  - File: `src/systems/diceAbilitySystem.js`

- [ ] **M3.** Clone — CLONE: rewrite one chosen die to Clone's current value.
  - Ref: DESIGN §8.7 Clone
  - File: `src/systems/diceAbilitySystem.js`

- [ ] **M4.** Blight — INFECT: change one neighbor to Blight's value.
  - Ref: DESIGN §8.7 Blight
  - File: `src/systems/diceAbilitySystem.js`

- [ ] **M5.** SacriDice — SACRIFICE: add SacriDice value into target on 1..6 loop, SacriDice removed for current roll.
  - Ref: DESIGN §8.7 SacriDice
  - File: `src/systems/diceAbilitySystem.js`

- [ ] **M6.** Mirror — MIRROR: reveal side-face of neighbor, player accepts or cancels. Level-line weighted side-face probabilities.
  - Ref: DESIGN §8.7 Mirror
  - File: `src/systems/diceAbilitySystem.js`

- [ ] **M7.** Ability buttons for Rare — TUNE, MIMIC, CLONE, INFECT, SACRIFICE, MIRROR. Target selection UI (click second die after activation).
  - File: `src/ui/abilityUI.js`

- [ ] **M8.** 3D feedback for Rare abilities — value-change animations, removal animation (SacriDice), side-face reveal (Mirror).
  - File: `src/bridge/diceBridge.js`

- [ ] **M9.** Tests for Rare active dice.
  - File: `tests/test-dice-rare-active.js`

---

## N. Rare Dice — Passive

Scoring modifiers and board-reactive behaviors.

- [ ] **N1.** Royal I — if scored selection is full straight (1-2-3-4-5-6), add +150 bonus.
  - Ref: DESIGN §8.7 Royal I
  - File: `src/systems/scoringSystem.js`

- [ ] **N2.** Forge I — if scored selection is exactly three-of-a-kind, add +100 bonus.
  - Ref: DESIGN §8.7 Forge I
  - File: `src/systems/scoringSystem.js`

- [ ] **N3.** Pin Die — if Pin scores, store its value. On next roll, Pin returns with that exact value. Pin clears after one roll.
  - Ref: DESIGN §8.7 Pin
  - File: `src/systems/turnSystem.js`

- [ ] **N4.** Devil Die — if two other `6` values visible, Devil counts as third `6`. Natural `6` on Devil = double score.
  - Ref: DESIGN §8.7 Devil
  - File: `src/systems/scoringSystem.js`

- [ ] **N5.** Gravity Die — bias toward strongest visible value on board (`1` > `5` > `2/3/4/6`). Tied = no bias.
  - Ref: DESIGN §8.7 Gravity
  - File: `src/systems/turnSystem.js`

- [ ] **N6.** Yin / Yang — paired dice. When both on table, Yang takes complement of Yin (1↔6, 2↔5, 3↔4). Link breaks when one is scored.
  - Ref: DESIGN §8.7 Yin/Yang
  - File: `src/systems/turnSystem.js`

- [ ] **N7.** Tests for Rare passive dice.
  - File: `tests/test-dice-rare-passive.js`

---

## O. Utility Dice

Healing, recovery, and counterplay layer.

- [ ] **O1.** Common Utility: Bandie — if Bandie scores by itself (solo packet), heal player HP per level.
  - Ref: DESIGN §8.6 Bandie
  - File: `src/systems/turnSystem.js`, `src/systems/playerSystem.js`

- [ ] **O2.** Common Utility: Pulse — heal player based on packet size. Bigger packet = stronger heal.
  - Ref: DESIGN §8.6 Pulse
  - File: `src/systems/turnSystem.js`, `src/systems/playerSystem.js`

- [ ] **O3.** Rare Utility: Leech — activate vampiric effect for rest of turn. Later scoring packets heal player by percentage.
  - Ref: DESIGN §8.8 Leech
  - File: `src/systems/turnSystem.js`, `src/systems/playerSystem.js`

- [ ] **O4.** Rare Utility: Transfusion — mark packet. At bank time, player chooses HEAL or DAMAGE for that packet.
  - Ref: DESIGN §8.8 Transfusion
  - File: `src/systems/turnSystem.js`, `src/ui/battleUI.js`

- [ ] **O5.** Rare Utility: Second Wind — one-shot per battle. If player would die or drops below threshold, survive at 1 HP + delayed heal.
  - Ref: DESIGN §8.8 Second Wind
  - File: `src/systems/playerSystem.js`

- [ ] **O6.** Rare Utility: Siphon — after enemy damage event, restore percentage of HP damage taken.
  - Ref: DESIGN §8.8 Siphon
  - File: `src/systems/playerSystem.js`

- [ ] **O7.** Tests for utility dice.
  - File: `tests/test-dice-utility.js`

---

## ── MILESTONE: Full Dice Roster ──

> After groups A–O: all Common, Rare, and Utility dice implemented. Full progression ladder playable. Loadout building with all dice.

---

## P. Tutorial

Interactive guided play using real battle runtime.

- [ ] **P1.** Tutorial system — chapter state machine, scripted roll scenarios (seeded), step tracking, constraint enforcement (e.g. forced selections).
  - Ref: DESIGN §12.1, §12.2
  - File: `src/systems/tutorialSystem.js` → `window.tutorialSystem`

- [ ] **P2.** Chapter 1: Core Scoring Basics — valid selections, three-of-a-kind, straights, invalid attempts.
  - Ref: DESIGN §12.1
  - File: `src/systems/tutorialSystem.js`

- [ ] **P3.** Chapter 2: Bust And Risk — no valid scoring dice, push-your-luck loss scenario.
  - Ref: DESIGN §12.1
  - File: `src/systems/tutorialSystem.js`

- [ ] **P4.** Chapter 3: Joker — normal vs active, wildcard resolution, mandatory example.
  - Ref: DESIGN §12.1
  - File: `src/systems/tutorialSystem.js`

- [ ] **P5.** Chapter 4: Action Dice — Frog JUMP, Tuner TUNE in guided scenario.
  - Ref: DESIGN §12.1
  - File: `src/systems/tutorialSystem.js`

- [ ] **P6.** Chapter 5: Pattern Dice — One Love bias, Royal straight bonus, Forge set bonus.
  - Ref: DESIGN §12.1
  - File: `src/systems/tutorialSystem.js`

- [ ] **P7.** Tutorial UI overlay — step prompt text, highlight target elements, arrow/glow indicators, next/skip controls.
  - File: `src/ui/tutorialUI.js` → `window.tutorialUI`

---

## Q. 3D Die Themes

Per-die visual identity using the custom procedural constructor.

> The custom constructor (DESIGN §14.5) already supports per-die body color + pip color. This group adds special face marks (glyphs, symbols) and per-die-type configs.

- [ ] **Q1.** Die visual config system — `config.dice[type].visual = { bodyColor, pipColor, faceOverrides }`. Engine reads this to configure each die's materials and any custom face decorations.
  - Ref: DESIGN §14.5.6, §13
  - File: `src/config/dice.js`, `src/engine/dieFactory.js`

- [ ] **Q2.** Common die visuals — Frog (green body, cream pips, frog-eye on face 1), One Love (pink, white pips, heart on face 1), Comrade (crimson, gold pips, star on face 5), Flipper (ivory, dolphin marks), and others per DESIGN §8.5.
  - Ref: DESIGN §8.5 visual descriptions
  - File: `src/config/dice.js`, `src/engine/dieFactory.js`

- [ ] **Q3.** Rare die visuals — Blight (toxic green, red ☣ on face 1), Mimic (gray, ⧉ on all faces), Mirror (transparent blue, ✦ marks), Devil (bright red), and others per DESIGN §8.7.
  - Ref: DESIGN §8.7 visual descriptions
  - File: `src/config/dice.js`, `src/engine/dieFactory.js`

- [ ] **Q4.** Custom glyph rendering — for dice that replace pips with symbols (Frog eye, Joker J, Chain links, biohazard): textured quads or path-based meshes positioned on specific faces via `faceOverrides`.
  - Ref: DESIGN §14.5.6
  - File: `src/engine/dieFactory.js`

---

## R. Polish & Feedback

Visual and audio juice.

- [ ] **R1.** Bust feedback — screen shake or dice scatter animation on bust.
  - Ref: DESIGN §2.1 step 6
  - File: `src/bridge/diceBridge.js`, `src/ui/battleUI.js`

- [ ] **R2.** Bank feedback — score fly-up animation, HP bar flash on damage dealt.
  - Ref: DESIGN §7.2
  - File: `src/ui/battleUI.js`

- [ ] **R3.** Hot Hand feedback — burst/glow effect when all 6 dice scored.
  - Ref: DESIGN §5
  - File: `src/bridge/diceBridge.js`, `src/ui/battleUI.js`

- [ ] **R4.** Audio — collision-aware or settle-aware die-to-surface sounds. Per-ability activation sounds (Frog croak, etc.).
  - Ref: DESIGN §14.6, §8.5 (Frog audio)
  - File: `src/bridge/diceBridge.js`, `assets/audio/`

- [ ] **R5.** Six-dice readability pass — validate 6 simultaneous 3D dice are readable under gameplay pacing. Adjust scale/spacing if needed.
  - Ref: DESIGN §14.8, §14.9
  - File: `src/bridge/diceBridge.js`

---

## S. Final Testing & Compliance

- [ ] **S1.** Deterministic replay test — save `{ seed, history }`, replay from seed, assert identical final state.
  - Ref: ARCHITECTURE §Replays
  - File: `tests/test-replay.js`

- [ ] **S2.** Architecture compliance audit — verify: no `Math.random()`, no ES modules in game logic, all files IIFE, state is plain data, each action registered once, each system touches one slice.
  - Ref: ARCHITECTURE, AGENTS §Coding Rules
  - File: all `src/`

- [ ] **S3.** Full test suite pass — run all `tests/test-*.js` via `tests/index.html`. Fix any failures. Re-run until green.
  - File: `tests/index.html`, all test files

---

## Milestones Summary

| Milestone | After Group | What's Playable | Status |
|---|---|---|---|
| **3D Engine Proven** | 0 | Full 3D battle: sling or ROLL, select, held, scoring, combat, bot AI | **DONE** — `battle.html` + `throw-lab.html` (shared Tune) + vendored libs + `index.html` entry. Engine extraction (0C) pending. |
| **Playable Base Game (2D logic)** | 0 + A–E | Standard Farkle scoring + combat logic wired to the 3D battle shell | Pending |
| **Playable 3D Battle** | 0 + A–G | Full 3D battle against bot, base dice only | Pending |
| **Full Common Layer** | 0 + A–L | All Common dice, hub, loadout, progression | Pending |
| **Full Dice Roster** | 0 + A–O | All dice types, full progression ladder | Pending |
| **Feature Complete** | 0 + A–S | Tutorial, themes, polish, tests passing | Pending |
