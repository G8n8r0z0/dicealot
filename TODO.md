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

### 0C. Engine Extraction — DONE (2026-04-08)

Extracted validated battle.html code into production ES modules. Source: `battle.html` (not spike-v2 — battle.html has all physics tuning, face detection, force-settle from 0D–0F).

- [x] **0C1.** Extract `dieFactory.js` — `createDiceVertexData()`, `createPipsVertexData()`, `buildDie()`, `teardownDie()`, `readFaceValue()`, `readFaceValueForced()`, `FACE_LOCALS`, `FACE_UP_QUATS`, collision group helpers. Pure geometry + physics factory + face detection.
  - Source: `battle.html` (lines 1496–1767)
  - Target: `src/engine/dieFactory.js`

- [x] **0C2.** Extract `diceEngine.js` — `BATTLE_TUNE_DEFAULTS`, table layout, scene/camera/lights/shadows/hl, physics world, render loop (sync, anti-edge nudge, force-settle, held animation), throws (`throwPlayer`/`throwBot`), sling (`slingCluster`/`slingRelease`/`slingCancel`), selection, projection, settle timer, `dispose()`.
  - Source: `battle.html` (surgical extraction)
  - Target: `src/engine/diceEngine.js`

- [x] **0C3.** Create `diceBridge.js` — thin pass-through bridge (no store). Phase management, pointer events → sling + selection. API: `roll()`, `rollBot()`, `scoreAndHold()`, `resetTurn()`, `getSelection()`, `getDiceValues()`. Store wiring deferred to Group C.
  - Target: `src/engine/diceBridge.js`
  - **Note:** `store.subscribeTo` / `store.dispatch` blocked until Groups A–C.

- [x] **0C4.** Update `src/index.html` — vendor scripts, importmap, IIFE layer + ES module layer. Smoke test: ROLL, sling, click-to-select, face display.
  - Target: `src/index.html`

**Archival:** `throw-lab.html` + `throw-lab.mjs` — physics tuning complete, `BATTLE_TUNE_DEFAULTS` canonical in `diceEngine.js`. Lab files preserved but unmaintained.

---

## ── MILESTONE: 3D Engine Proven ──

> **Status: COMPLETE.** Full 3D battle prototype validated in `battle.html`. Engine stack: **vendored** BabylonJS + cannon-es, custom procedural geometry. Core mechanics: directional throws, **pull-back sling** or **ROLL**, click-to-select, sandwich table + narrow shelves, camera debug, kinematic dice stash, held zones, Farkle scoring, Hot Hand, bust, bot AI, HP combat, win/lose. Entry: **`index.html`** (HTTP → `battle.html`; `file://` → server instructions).
> **Engine extraction COMPLETE (0C, 2026-04-08):** `dieFactory.js` (geometry, face detection), `diceEngine.js` (scene, physics, throws, `BATTLE_TUNE_DEFAULTS`), `diceBridge.js` (thin pass-through, store wiring deferred). Smoke test at `src/index.html`.
> **Docs (2026 sync):** sling behavior, collision filters, **throw-lab archived** (tuning complete), **canonical `BATTLE_TUNE_DEFAULTS`** (battle + throw-lab, matches shipped physics without `localStorage`), Cloudflare Pages deploy, and “propose → approve → implement” preferences are reflected in `ARCHITECTURE.md`, `DESIGN.md` §14, `AGENTS.md`, `README.md`, and workspace `.cursor/rules/chat-context-and-docs.mdc`.

---

## ── MILESTONE: Battle UI Baseline ──

> **Status: COMPLETE (2026-04-07).** First UI polish pass on `battle.html`:
> - Compact HP widgets (80px avatar circle + bar with inline numbers); player red L-to-R, bot purple R-to-L.
> - 3 dashed badge placeholder slots per combatant.
> - Side turn indicators ("Player Turn" / "Bot Turn") -- text-only fade; removed from center info bar.
> - Info bar simplified: round score + selection score only, docked to top edge, no table overlap.
> - Banner (BANK/BUST/HOT HAND) centered on viewport with fade+scale; bot turn starts 1s after banner disappears.
> - Held zones reshaped to 9x6 rectangles centered per side (inner edge flush with divider).
> - Thin visual border line around roll zone. `DEFAULT_ROLL_DEPTH_STRETCH = 2.8`.
> - Two-row action buttons (primary + secondary reserved for abilities).
> - Ortho frustum padding: `uiPadH=12`, `uiPadV=5`.
>
> **This layout is the baseline for all further work.** Next: dice throw physics feel.

---

## ── MILESTONE: Dice Throw Physics Baseline ── (COMPLETE)

ROLL and sling throw physics tuned and unified. Both use `applyImpulse` with off-center point for realistic spin, single random `f` per throw, quadratic sling strength curve. Key values: gravity −300, mass 3.0, throwMin/Max 100/166, dieScale 3.06, solver.iterations 20, ceiling at FLOOR_Y+28. Smooth force-settle (`FORCE_SETTLE_LERP = 0.08`) replaces instant teleport.

- [x] **0D1.** Audit — identified "moon surface" float, dice interpenetration, sling/ROLL asymmetry.
- [x] **0D2.** Tune ROLL — gravity −200, mass 3.0, throwMin/Max 66/166, stackYStepMul 0.05, THROW_Z_INSET 0.28, single `f` per throw, off-center leverR = dieEdge × 0.10.
- [x] **0D3.** Tune sling — unified with ROLL physics (same `throwMin/Max` + `rollPlayer.*`), quadratic strength curve, 150ms dice-dice collision disable on release, specular 0.08, light Y=50.
- [x] **0D4.** Settle quality — solver.iterations 20, invisible ceiling FLOOR_Y+18, camera.minZ=0.1.
- [x] **0D5.** Bot throw — unchanged (will revisit if needed).
- [x] **0D6.** Sync defaults — `BATTLE_TUNE_DEFAULTS` synced in `battle.html` and `throw-lab.mjs`. Hash-based auto-invalidation of localStorage.

---

## ── MILESTONE: Battle UX Polish ── (COMPLETE)

Shelf, sling, reroll, face reading, UI cleanup after physics baseline.

- [x] **0E1.** Shelf 9×9 — `SHELF_D` 6→9, 3-column grid, `gap = dieEdge × 1.12`, held dice slerp to `FACE_UP_QUATS[value]`.
- [x] **0E2.** Dev tools hidden — Camera/Table/Tune buttons `display:none`, TUNE ±1 hidden. Code preserved.
- [x] **0E3.** Stacked dice reroll — detect (Y > threshold), banner "REROLL!", player taps to re-throw (max 3), bot auto-rerolls in `waitForSettle`.
- [x] **0E4.** Sling single-point cluster — all dice at one clamped point, only 1st visible during aim; `wallPad = dieEdge × 1.0`.
- [x] **0E5.** Wall inset Z — `WALL_INSET_Z = 0.5`, spawn margin `mz = WALL_INSET_Z + 0.1`. Fixes dice-in-wall on ROLL edge spawn.
- [x] **0E6.** Face reading tightened — `readFaceValue` bestDot ≥ 0.90, gap ≥ 0.12 (was 0.72/0.06).
- [x] **0E7.** Info bar compact — `max-width:min(88vw,340px)`, selection info under round score.
- [x] **0E8.** Actions auto-hide — `.actions` hidden when no buttons visible; buttons hidden during bot turn.
- [x] **0E9.** Round score stable width — column layout, doesn't grow on score change.

---

## ── MILESTONE: Battle Stability Fixes ── (COMPLETE)

Bug fixes and settle reliability after UX polish.

- [x] **0F1.** Stack detection threshold — `dieEdge × 1.8` → `1.1` for correct stacked dice detection.
- [x] **0F2.** Face reading relaxed — `readFaceValue` bestDot 0.90→0.82, gap 0.12→0.10. Added `readFaceValueForced()` (no thresholds) for settle timeout.
- [x] **0F3.** Physics ceiling raised — `FLOOR_Y + 18` → `FLOOR_Y + 28`, more room for dice flight.
- [x] **0F4.** Bot turn race guard — `scheduleBotTurn(ms)` with `clearTimeout` replaces all `setTimeout(() => runBotTurn())` calls.
- [x] **0F5.** Settle timeout — `SETTLE_TIMEOUT_MS = 4000`: unsettled dice smoothly animated to rest (kinematic lerp/slerp at `FORCE_SETTLE_LERP = 0.08`). Stacked dice offset sideways.
- [x] **0F6.** Reroll simplified — stacked dice → banner "REROLL!" → phase `waiting` (player re-throws via ROLL/sling). Bot auto-re-throws. Removed old tap-to-reroll phase.
- [x] **0F7.** throwMin raised — 66 → 100 to prevent weak ROLL throws.
- [x] **0F8.** Zero-friction walls — `ContactMaterial(wallMat, diceMat, { friction: 0 })` prevents dice edge-balancing against walls; floor retains normal friction.

---

## 0G. Mobile Layout (Pending)

Adapt `battle.html` for portrait mobile screens. Desktop (2560×1600) is the current baseline; mobile needs a separate layout pass.

- [ ] **0G1.** Analyze viewport constraints — portrait aspect, touch targets, minimum die/button sizes.
- [ ] **0G2.** Responsive layout — HP widgets, info bar, action buttons, held zones reflow for narrow screens. CSS breakpoints or container queries.
- [ ] **0G3.** Touch UX — sling drag on small screens, tap-to-select die sizing, button hit areas ≥ 44px.
- [ ] **0G4.** Camera frustum — `updateBattleOrthoFrustum()` adjustments for portrait aspect ratios.
- [ ] **0G5.** Test on real devices — iOS Safari, Android Chrome. Validate sling, ROLL, selection, banners.

---

## Open Decisions & Deferred Tasks

Items that don't have a task slot yet. Revisit when the corresponding layer is reached.

### Experimental: polygon roll zone (octagon / hexadecagon)

Validated in `battle.html` (2026-04-07). Regular polygon table (8 or 16 sides) eliminates corner-sticking and reduces ping-pong bouncing. Code preserved as a commented block in `battle.html` near the table constants section. To activate: set `POLY_SIDES`, uncomment the polygon block, replace rectangular floor/border/walls with polygon equivalents, swap `clampRollXZ` / sling clamp / force-settle to use `clampToPolygon`. Reverted to rectangle for now — the diagonal walls cut usable table area and the visual style needs further design work. Revisit when table shape becomes a priority.

### Storage: localStorage now, reassess for PvP later

Current approach: `localStorage` for player profile (wins, unlocked dice, loadout), same pattern as `battle.html`. This is sufficient for PvE singleplayer.

**Battle physics:** `battle_tune_json_v1` deep-merges numeric fields into `battleTune` on load. Hash-based versioning auto-clears stale values when code defaults change. **Repo defaults** (`BATTLE_TUNE_DEFAULTS` in `battle.html` / `throw-lab.mjs`) are the canonical shipping tune (gravity −200, mass 3.0, throwMin/Max 66/166, dieScale 3.06); incognito and fresh deploys use those. **Tune → Apply** persists overrides; **Reset** clears the key.

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

## A. Config Foundation — DONE (2026-04-08)

Static data files. No logic, no state. Loaded before everything else. All exported via `window.SCORING`, `window.DICE`, `window.ENCOUNTERS`, `window.BALANCE`, `window.STRINGS`.

- [x] **A1.** Scoring table config — `SINGLES`, `TRIPLE_BASE`, `N_OF_KIND_MULT`, `STRAIGHTS`, `THREE_PAIRS`, `BUST_CHANCE`.
  - Ref: DESIGN §3.1
  - File: `src/config/scoring.js` → `window.SCORING`

- [x] **A2.** Dice definitions — full roster (base + 17 common + 2 common utility + 14 rare + 4 rare utility + 1 exotic). Per die: id, name, rarity, utility flag, maxLevel, ability descriptor, weight distributions per level, visual hints. Plus `OPPOSITES`, `LOADOUT`, `RARITY_ORDER`.
  - Ref: DESIGN §8.1–8.9
  - File: `src/config/dice.js` → `window.DICE`

- [x] **A3.** Encounter definitions — Common ladder (17 entries, win 1–36) + Rare ladder (16 entries, win 40–123). Per entry: win threshold, unlock die id, difficulty tag, encounter name, bot HP. Difficulty tiers with `riskThreshold`.
  - Ref: DESIGN §9.3, §9.4, §11
  - File: `src/config/encounters.js` → `window.ENCOUNTERS`

- [x] **A4.** Balance constants — `DICE_PER_TURN`, `PLAYER_BASE_HP`, `SCORE_TO_DAMAGE`, `HOT_HAND_THRESHOLD`, `HOT_HAND_AUTO_BANK`, pacing reference values.
  - Ref: DESIGN §2, §5, §7.2, §7.3
  - File: `src/config/balance.js` → `window.BALANCE`

- [x] **A5.** UI strings — battle banners, button labels, turn indicators, hub labels, result messages, ability buttons, tutorial chapter titles, misc.
  - Ref: DESIGN §10, §12
  - File: `src/config/strings.js` → `window.STRINGS`

`src/index.html` updated: config scripts loaded after `store.js`, before `main.js`.

---

## B. Scoring Engine — DONE (2026-04-08)

Pure evaluation functions. No state ownership — called by turnSystem. Standard dice only; Joker/special-die decorations deferred to Groups J/M.

- [x] **B1.** Base scoring evaluator — bitmask DP partition of dice values into optimal scoring groups. Singles (1/5), N-of-a-kind (3–6, exponential doubling `base × 2^(count−3)`), short straights (1-5 = 500, 2-6 = 750), full straight (1-2-3-4-5-6 = 1500). Three Pairs removed (not in rules). All values must be covered — no leftovers.
  - Ref: DESIGN §3.1
  - File: `src/systems/scoringSystem.js` → `window.scoringSystem`

- [x] **B2.** Selection validator — contiguous-packet decomposition (click-order-first). Each packet is either a valid primitive group or a singles packet (all 1s/5s). Ambiguity detection when valid packets exist but full decomposition fails.
  - Ref: DESIGN §6
  - File: `src/systems/scoringSystem.js`

- [ ] **B3.** Joker wildcard resolution — deferred to exotic dice implementation. Infrastructure ready: scoring accepts plain value arrays, Joker layer can be added on top.
  - Ref: DESIGN §4

- [x] **B4.** Bust detection — brute-force all subsets, check if any valid primitive group exists. Returns boolean.
  - Ref: DESIGN §2.1 step 6
  - File: `src/systems/scoringSystem.js`

- [x] **B5.** Tests — 108 assertions: singles, three/four/five/six of a kind (all faces), straights, mixed partitions, invalid selections, three pairs NOT valid, click-order decomposition, ambiguity detection, bust detection.
  - File: `tests/test-scoring.js` (Node runner) + `tests/test-scoring.html` (browser runner)

**DESIGN.md sync:** §3.1 N-of-a-kind formula corrected (exponential doubling), Three Pairs removed. §5 Hot Hand updated (score locked, not auto-banked; player continues).
**Config sync:** `scoring.js` N_OF_KIND_MULT fixed to `{3:1, 4:2, 5:4, 6:8}`, THREE_PAIRS removed.

---

## C. Turn State Machine — DONE (2026-04-08)

Owns `state.turn`. The core `roll → select → score → decide` loop. Standard dice only; weighted distributions deferred to Group H.

- [x] **C1.** Turn system init — `state.turn`: `rolledDice[]`, `heldDice[]`, `selectedIndices[]`, `accumulatedScore`, `phase` (idle/selecting/decide/bust), `diceCount`, `turnNumber`, `selectionScore`, `selectionValid`, `lastBankedScore`, `hotHandTriggered`.
  - File: `src/systems/turnSystem.js` → `window.turnSystem`

- [x] **C2.** `ROLL_DICE` — generate `diceCount` values via `store.prng.next(1, 6)`. Auto-detect bust via `scoringSystem.hasPlayableDice()`. Phase → `selecting` or `bust`. Phase guard: only from `idle` or `decide`.

- [x] **C3.** `SELECT_DIE` / `DESELECT_DIE` — toggle index in `selectedIndices[]`. Live revalidation via `scoringSystem.scorePlayerSelection()` → sets `selectionScore` and `selectionValid`. Phase guard: only during `selecting`.

- [x] **C4.** `SCORE_SELECTION` — move selected to `heldDice`, accumulate score, reduce `diceCount`. Hot Hand check: if total held ≥ 6 → auto-bank (`lastBankedScore` set, turn reset, `hotHandTriggered = true`, phase `idle`). Otherwise phase → `decide`.

- [x] **C5.** `BANK` — set `lastBankedScore = accumulatedScore`, reset turn state, phase → `idle`. Phase guard: only from `decide`.

- [x] **C6.** `BUST` — explicit bust action (also detected inside ROLL_DICE). Clears accumulated, resets turn, phase → `idle`.

- [x] **C7.** Hot Hand — handled inside SCORE_SELECTION (not a separate action). Auto-bank accumulated score, reset dice to 6, phase `idle`. Player continues with fresh roll.

- [x] **C8.** Tests — 60 assertions: init, START_TURN, ROLL_DICE (basic, deterministic, phase guard), SELECT/DESELECT (toggle, duplicate, invalid), selection validation (live score preview), SCORE_SELECTION (accumulate, held, diceCount, phase), BANK (lastBankedScore, reset, phase guard), continue rolling (decide → roll), BUST detection, Hot Hand (single-score and multi-score), accumulated persistence, SCORE_SELECTION guards.
  - File: `tests/test-turn.js`

Actions registered: `START_TURN`, `ROLL_DICE`, `SELECT_DIE`, `DESELECT_DIE`, `SCORE_SELECTION`, `BANK`, `BUST`. All on slice `'turn'`.

---

## D. Combat & Match System ✅

Match lifecycle and HP damage bridge. **DONE.**

Three IIFE systems:

- `playerSystem.js` → `state.player { hp, maxHp, name }`
- `enemySystem.js`  → `state.enemy { hp, maxHp, name, difficulty }`
- `matchSystem.js`  → `state.match { phase, activePlayer, turnCount, winner }`

Actions registered (all on slice `'match'`): `START_BATTLE`, `DEAL_DAMAGE`, `END_TURN`.

Caller sequence: BANK → DEAL_DAMAGE → END_TURN (Hot Hand: DEAL_DAMAGE only, no END_TURN).

- [x] **D1.** `matchSystem.js` — `state.match` with `phase` (hub/battle/result), `activePlayer`, `turnCount`, `winner`.
- [x] **D2.** `START_BATTLE` — payload `{ enemyHp, enemyName, difficulty }`. Sets enemy stats, restores player HP, phase → `battle`, activePlayer → `player`.
- [x] **D3.** `END_TURN` — switches activePlayer, increments turnCount. Phase guard: only in `battle`.
- [x] **D4.** `playerSystem.js` — `state.player` with `hp`, `maxHp`, `name`. Init from `BALANCE.PLAYER_BASE_HP`.
- [x] **D5.** `enemySystem.js` — `state.enemy` with `hp`, `maxHp`, `name`, `difficulty`. Zeroed on init; populated by START_BATTLE.
- [x] **D6.** `DEAL_DAMAGE` — `{ target: 'player'|'enemy', amount }`. Applies `SCORE_TO_DAMAGE` multiplier, reduces HP, clamps to 0. HP ≤ 0 → winner set, phase → `result`. Phase guard: only in `battle`.
- [x] **D7.** Tests — 34 assertions: init, START_BATTLE, DEAL_DAMAGE (enemy, player, kill, overkill, phase guard), END_TURN (toggle, turnCount, phase guard), full battle sequence, no damage after result.
  - File: `tests/test-match.js`

Load order in `src/index.html`: `turnSystem.js` → `playerSystem.js` → `enemySystem.js` → `matchSystem.js`.

---

## E. Battle UI — 2D Shell ✅

HTML + DOM rendering. Dispatches actions, subscribes to state. **DONE.**

Full 2D battle screen: HP bars, rolled dice (clickable), held zone, score display, phase hints, action buttons (Roll / Score'n'Play / Bank'n'Pass), banners (Bust / Bank / Hot Hand / Victory / Defeated), New Battle button.

- [x] **E1.** `src/index.html` — battle UI HTML structure + CSS. Dark theme, centered 520px panel. Canvas hidden (ready for Group F). Load order updated with `ui/battleUI.js` and `ui/inputHandler.js`.
- [x] **E2.** `src/ui/battleUI.js` → `window.battleUI`. mount/unmount, subscribes to store, renders: HP bars, rolled dice with selection highlight, held zone, accumulated + selection score, button enable/disable by phase, turn indicator, phase hints.
- [x] **E3.** `src/ui/inputHandler.js` → `window.inputHandler`. Button clicks → dispatch sequences. Roll (+ bust detection → banner → BUST + START_TURN), Score (+ hot hand → DEAL_DAMAGE + banner), Bank (→ DEAL_DAMAGE → banner → START_TURN). Lock/unlock prevents double-clicks during banners. New Battle button resets match.
- [x] **E4.** `src/main.js` — inits all systems (player, enemy, turn, match), mounts battleUI, binds inputHandler, dispatches START_BATTLE + START_TURN. Removed game loop (not needed for 2D; Group F will add render loop).

---

## ── MILESTONE: Playable Base Game (2D) — COMPLETE (2026-04-08) ──

> After groups A–E: standard Farkle with combat works in 2D (dice shown as text/numbers). Player can roll, select, score, bank, bust. HP damage works. Win/lose detected. No special dice, no 3D, no bot.

---

## F. 3D Rendering Bridge

Connects store state to the custom BabylonJS + cannon-es engine.

> **Note:** Most of the 3D rendering primitives are already validated in spike-v2 and will be extracted in Group 0C. Group F focuses on wiring the extracted engine to the store-driven game logic.

- [x] **F1.** Bridge initialization — `diceBridge.init(canvas, store)` calls `diceEngine.init()`, subscribes to store actions (`ROLL_DICE`, `SELECT/DESELECT_DIE`, `SCORE_SELECTION`, `START_TURN`). Exposes `window.bridge3D`.
  - File: `src/engine/diceBridge.js`

- [x] **F2.** Roll rendering — on `ROLL_DICE`, bridge calls `engine.throwPlayer()`. After physics settle, reads face values and dispatches `DICE_SETTLED` to sync store. **No face correction** — physics IS the outcome. `turnSystem.js` has new `DICE_SETTLED` action that overrides PRNG values and re-evaluates bust.
  - Files: `src/engine/diceBridge.js`, `src/systems/turnSystem.js`

- [x] **F3.** Die selection in 3D — pointer up on settled die → `store.dispatch('SELECT_DIE', { index })` / `DESELECT_DIE`. HighlightLayer glow driven by `state.turn.selectedIndices` via store subscriber.
  - File: `src/engine/diceBridge.js`

- [x] **F4.** Held zone rendering — on `SCORE_SELECTION`, scored 3D dice animate into player held zone (3-column grid, lerp). Hot Hand clears all held dice.
  - File: `src/engine/diceBridge.js`

- [ ] **F5.** Per-die-type visuals — DEFERRED. Uses default body/pip colors. Will read from `config.dice[type].visual` when loadout system is built.
  - File: `src/engine/diceBridge.js`, `src/config/dice.js`

- [x] **F6.** Sling drag-to-throw — table-plane pull-back → cluster kinematic → release → `ROLL_DICE` dispatch + sling physics. SVG wedge visualization (anchor + segments + %) ported from `battle.html`. Sling works in `idle` phase (including after SCORE).
  - Files: `src/engine/diceBridge.js`, `src/index.html` (SVG + CSS)

- [x] **F7.** UI layout refactor — ported `battle.html` layout to `src/index.html`: three-column layout (side HP widgets with avatar circles + badge slots, center info-bar top, action buttons bottom, glass morphism). `battleUI.js` updated with new DOM targets, `display:none` button toggling, `syncActionsVisibility()`.
  - Files: `src/index.html`, `src/ui/battleUI.js`

**FSM changes in Group F:** removed `decide` phase. After `SCORE_SELECTION`, phase → `idle` (sling/ROLL available). `BANK` only from `selecting` with valid selection. Both SCORE and BANK buttons require valid selection. Matches `battle.html` 3D and `dicing/battle.html` 2D flow.

---

## G. Bot AI

Same roll/select/score/bank structure as player. Automated decision-making.

- [x] **G1.** Bot turn logic — `botSystem.js` async loop: ROLL_DICE → wait 3D settle → findBestBotChoice → SELECT_DIE ×N (500ms each) → SCORE_SELECTION → threshold check → BANK or continue. Dispatches END_TURN + START_TURN on finish. inputHandler triggers bot via `scheduleBotTurn(800)` after player bank/bust.
  - File: `src/systems/botSystem.js` → `window.botSystem`

- [x] **G2.** Three difficulty levels: **Novice** (40% optimal subset, low bank threshold 350), **Advanced** (80% optimal, threshold ~480 with jitter), **Master** (always optimal, adaptive threshold based on HP/diceLeft). Default = `'advanced'`, passed via `START_BATTLE` payload `difficulty`.
  - File: `src/systems/botSystem.js`

- [x] **G3.** 3D integration — `diceBridge` uses `engine.throwBot()` for enemy rolls, notifies `botSystem.onSettled()` after physics settle, places held dice on bot shelf (`botDividerZ + shelfD/2`). Sling and die-click blocked during bot turn.
  - Files: `src/engine/diceBridge.js`, `src/systems/botSystem.js`

- [ ] **G4.** Tests for bot — correct selection logic, risk threshold behavior, turn completion.
  - File: `tests/test-bot.js`

---

## ── MILESTONE: Playable 3D Battle — v1.0.0 (COMPLETE 2026-04-08) ──

> After groups A–G: full 3D Farkle battle against a bot. Roll, select, score, bank in 3D. Bot plays back (3 difficulties). HP combat works. Win/lose detected. Base dice only. Glass morphism UI overlay. Sling + ROLL. Force-settle without rotation. Hot Hand, Bust, banners. Tagged `v1.0.0` on GitHub.

### Post-v1.0.0 incremental updates

- **v1.0.1** — Repo cleanup: removed legacy files (old themes, tools, spikes, npm config).
- **v1.0.2** — Moved `vendor/` into `src/vendor/` for Cloudflare Pages deploy (`wrangler pages deploy ./src/`).
- **v1.0.3** — Loadout system scaffold (K3), bot AI 3D integration (G1–G3), lighter dice body color (`#f4f2ef`, specular 0.15), Invalid Selection UI feedback, held dice highlight fix, unused imports cleaned from `diceBridge.js`.

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

- [x] **K3.** Loadout editor (scaffold) — modal with 6 slots, click-to-place, detail panel, LOADOUT button under player card. `loadoutSystem.js` manages `state.loadout`, `loadoutUI.js` renders the modal. Currently all slots show base dice (special dice inventory empty until Groups H–O populate `DICE.roster`). Drag-and-drop deferred.
  - Ref: DESIGN §10.3
  - Files: `src/systems/loadoutSystem.js` → `window.loadoutSystem`, `src/ui/loadoutUI.js` → `window.loadoutUI`

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
| **3D Engine Proven** | 0 | Full 3D battle: sling or ROLL, select, held, scoring, combat, bot AI | **DONE** |
| **Engine Extraction** | 0C | dieFactory + diceEngine + diceBridge modules, smoke test at src/index.html | **DONE** (2026-04-08) |
| **Config Foundation** | A | scoring.js, dice.js, encounters.js, balance.js, strings.js — all game data | **DONE** (2026-04-08) |
| **Scoring Engine** | B | scoringSystem.js — bitmask DP, click-order validation, bust detection, 108 tests green | **DONE** (2026-04-08) |
| **Turn State Machine** | C | turnSystem.js — roll/select/score/bank/bust/hot hand, 60 tests green | **DONE** (2026-04-08) |
| **Combat & Match System** | D | playerSystem + enemySystem + matchSystem, START_BATTLE / DEAL_DAMAGE / END_TURN, 34 tests green | **DONE** (2026-04-08) |
| **Battle UI — 2D Shell** | E | battleUI + inputHandler, full 2D battle: roll/select/score/bank/bust/hot-hand, banners, HP bars, New Battle | **DONE** (2026-04-08) |
| **Battle UI Baseline** | 0 | Polished HP widgets, side turn indicators, compact info bar, 9x6 held zones, centered banners, badge slots | **DONE** (2026-04-07) |
| **Dice Throw Physics Baseline** | 0D | ROLL + sling unified, gravity −300, mass 3.0, dieScale 3.06, smooth force-settle | **DONE** (2026-04-08) |
| **Battle UX Polish** | 0E | Shelf 9×9, sling single-point, reroll, face reading, UI cleanup | **DONE** (2026-04-07) |
| **Battle Stability Fixes** | 0F | Stack detection, settle timeout, face reading relaxed, bot race guard, reroll simplified | **DONE** (2026-04-07) |
| **Mobile Layout** | 0G | Responsive portrait layout, touch UX, camera for mobile | Pending |
| **Playable Base Game (2D logic)** | 0 + A–E | Standard Farkle scoring + combat logic wired to the 3D battle shell | **DONE** (2026-04-08) |
| **Playable 3D Battle (v1.0.0)** | 0 + A–G | Full 3D battle against bot (3 difficulties), base dice, glass morphism UI | **DONE** (2026-04-08) |
| **v1.0.3 — Loadout + Polish** | 0 + A–G + K3 | Loadout scaffold, lighter dice, Invalid Selection UI, held dice fix | **DONE** (2026-04-08) |
| **Full Common Layer** | 0 + A–L | All Common dice, hub, loadout, progression | Pending |
| **Full Dice Roster** | 0 + A–O | All dice types, full progression ladder | Pending |
| **Feature Complete** | 0 + A–S | Tutorial, themes, polish, tests passing | Pending |
