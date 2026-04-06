# Game Design — Dice-a-Lot

## 1. Project Identity

Dice-a-Lot is a browser-first dice RPG prototype. The game must feel like a dice game first at every stage. All systems — progression, combat, loadout, UI — exist to deepen the core dice questions, never to replace them.

**Core loop:** `roll → select → score / bank`

**Locked identity rules:**
- Depth comes from system interaction, risk management, build expression, and progression — not from rule bloat.
- Later systems are allowed only if they strengthen the core dice questions instead of replacing them.
- Reject or defer any feature that weakens `roll → select → score / bank`, adds a big support layer before the current layer is stable, or makes the game feel more like a service economy than a dice game.

**Player promise:** the player should quickly understand what they rolled, what they can keep, and why banking now or pushing deeper matters. The game should become deeper through combinations, loadout identity, progression, and route decisions that stay legible. The game should not drift into a menu-heavy RPG that happens to contain dice.

**Target audience:** casual-to-midcore. Can play and enjoy games like Minecraft or Don't Starve. Understands crafting, resource management, and basic progression.

**Age rating:** PEGI 12. Features more graphic, non-realistic violence, sexual innuendo, or mild bad language.

---

## 2. Core Loop

### 2.1 Turn Structure

1. **Roll** — roll all available dice (6 at the start of a turn).
2. **Read** — the game highlights dice that form valid scoring combinations.
3. **Select** — the player selects a valid scoring subset. The exact selected dice define the scoring result.
4. **Score** — selected dice move to the held zone. Their value adds to accumulated turn score.
5. **Decide:**
   - **Bank** — deal accumulated score as damage to opponent. Turn ends.
   - **Continue** — roll the remaining unheld dice. Return to step 1.
6. **Bust** — if a roll produces no valid scoring dice, all accumulated score is lost. Turn ends.
7. **Hot Hand** — if all six dice are scored during a turn, the turn is automatically banked. After Hot Hand resolves, a new roll starts with all six dice again.

### 2.2 Core Decision Questions

Every meaningful system must strengthen at least one of:
- What should I keep from this roll?
- How much score is enough to bank now?
- When is pushing deeper worth the risk?
- How does my loadout change what counts as a good roll?
- How does my progression change safe versus greedy play?

---

## 3. Scoring Rules

### 3.1 Standard Scoring Table

| Combination | Score | Notes |
|---|---|---|
| Single 1 | 100 | Only 1s and 5s score individually |
| Single 5 | 50 | |
| Three of a kind (1s) | 1000 | 1s special: 10× base |
| Three of a kind (N, N = 2–6) | N × 100 | e.g. three 4s = 400 |
| Four of a kind | Three-of-a-kind × 2 | e.g. four 4s = 800 |
| Five of a kind | Three-of-a-kind × 3 | e.g. five 4s = 1200 |
| Six of a kind | Three-of-a-kind × 4 | e.g. six 4s = 1600 |
| Short Straight (1-2-3-4-5) | 500 | Uses 5 dice |
| Short Straight (2-3-4-5-6) | 750 | Uses 5 dice |
| Straight (1-2-3-4-5-6) | 1500 | All 6 dice → Hot Hand |
| Three pairs | 1500 | All 6 dice → Hot Hand |

### 3.2 Bust Probability

| Dice rolled | Bust chance |
|---|---|
| 6 | ~2.3% |
| 5 | ~7.7% |
| 4 | ~15.7% |
| 3 | ~27.8% |
| 2 | ~44.4% |
| 1 | ~66.7% |

These probabilities create a smooth risk gradient. Continuing with 4+ dice is relatively safe; continuing with 1–2 dice is a gamble the player must weigh against accumulated score.

---

## 4. Joker

The Joker is a loadout special die inside the shared standard ruleset. It is not a separate mode.

**Locked rules:**
- If the Joker rolls `2–6`, it behaves like a normal die.
- If the Joker rolls `1`, it becomes **active**.
- Active Joker alone scores `100`.
- Active Joker in a mixed valid selection acts as a **wildcard substitute** for the best valid combination.
- In a mixed selection, the active Joker does **not** also score a separate `100`.
- The exact selected dice determine the outcome.

**Mandatory examples:**
- `Joker` alone (active) = `100`
- `Joker + 5 + 5 = 500` (Joker substitutes as a third 5)
- `200` for `Joker + 5 + 5` is **impossible** (Joker does not score its own 100 inside a mixed valid selection)

**Click-order rule:** valid player click order defines packet order when that click order already forms a legal resolution. If click order creates a false invalid scatter selection, the resolver may fall back to board order rather than show fake ambiguity.

---

## 5. Hot Hand

**Locked rules:**
- If all six dice are scored during a turn, the turn is **automatically banked**.
- After Hot Hand resolves, a new roll starts with all six dice again.

Hot Hand creates the highest-excitement event. It auto-converts the full accumulated score into damage, then resets the dice for a fresh start.

---

## 6. Player Scoring Contract

- The exact selected dice define the scoring result.
- Player scoring must **not** auto-optimize into a better split than the player chose.
- The system must **not** correct player mistakes. If the player selects a suboptimal combination, misreads the board, or overlooks a better scoring option — that is a valid human error and part of the skill expression. The game preserves the space for inattention and learning.
- Packet resolution is click-order-first when that click order already forms a valid legal resolution.
- If click order produces a false invalid scatter selection, the resolver may fall back to board order instead of showing fake ambiguity.
- This fallback exists to preserve clarity on scattered selections like set-plus-single patterns.
- A valid player click order must remain authoritative even if another order would score differently.

---

## 7. Combat System

### 7.1 Role

Combat turns the existing score race into an RPG-facing pressure layer. It interprets banked score as battle progress. Combat must preserve the existing dice loop instead of replacing it with a separate battle game.

### 7.2 Baseline Model

- Player and enemy both have HP.
- **Score-to-damage conversion:** `finalized banked score = direct damage` (1:1 ratio).
- Damage resolves at bank time and at Hot Hand auto-bank resolution.
- Unbanked score has no combat effect.
- Reaching `0 HP` immediately ends the encounter for that side.

### 7.3 Pacing Baseline

- **Player HP:** 3000 (base, before modifiers)
- **Bot HP:** varies per encounter (3000–57500 across full progression)
- **Per-bank damage:** typically 400–800 for a successful bank
- **Banks to defeat a full-HP target:** roughly 4–6 at baseline HP

### 7.4 Combat Boundaries

- Combat is an interpretation layer on top of banked score and dice outcomes.
- Combat must not replace scoring logic.
- Combat must not add a parallel combat resource before the base bridge is proven.
- Combat must not become a separate tactical language.
- Combat must not require a second independent turn structure.
- Combat must not auto-optimize player selections.
- Future secondary conversions (Heal, Block) must remain subordinate to direct damage.

### 7.5 Combat Resource Model

| Resource | Status | Role |
|---|---|---|
| HP | Baseline now | Primary survival resource and loss condition |
| Damage | Baseline now | Created by banked score at bank resolution |
| Banked Score | Baseline now | Bridge between score play and combat |
| Unbanked Score | Baseline now | Temporary turn progress only |
| Heal | Later | First post-bridge survivability candidate |
| Block | Deferred | Behind first Heal test |
| Shield / Armor | Deferred | After enemy defense layers are introduced |

---

## 8. Dice Roster

### 8.1 Base Dice

Six white standard dice. No special ability. The starting reference point for all players.

### 8.2 Loadout Rules

- The player equips exactly **6 dice**.
- Special dice replace base dice in the loadout.
- Empty loadout slots read as base dice.

### 8.3 Rarity Categories

| Category | Role |
|---|---|
| **Common** | Teaches the starter gameplay layer. Readable, playful, approachable mechanics. |
| **Rare** | Opens the mid-game layer with deeper mechanics and control. |
| **Exotic** | Rule-breaking or higher-complexity dice outside the normal ladders. |
| **Utility** | Cross-rarity functional layer for sustain, recovery, and counterplay. |

### 8.4 Naming Direction

Dice names should be playful, weird, memorable, or slightly absurd. The requirement: rules stay readable, the die fantasy stays clear, and the name helps attention and recall. Preferred outcome: strange but usable, not dry-but-forgettable.

---

### 8.5 Common Dice

#### Frog

- **Role:** light reroll / control die
- **Mechanic:** once per turn, this die may jump to a random face
- **Interaction:** player selects Frog → presses `JUMP` → die changes to a random value
- **Visual:** frog-green body, cream pips. Face 1 uses a single blinking frog eye mark (vertical lens pupil). Hub and battle use the same frog-eye language.
- **Audio:** silent on selection; short croak only on `JUMP` activation.

#### One Love

- **Category:** Common — plain bias die
- **Role:** single-face scoring bias toward `1`
- **Mechanic:** weighted distribution — `1 = 30%`, `2/3/4/5/6 = 14%` each
- **No evolution line.** Standalone.
- **Visual:** pink body, white pips, red heart mark on face 1.

#### Comrade

- **Category:** Common — plain bias die
- **Role:** single-face scoring bias toward `5`
- **Mechanic:** weighted distribution — `5 = 30%`, `1/2/3/4/6 = 14%` each
- **No evolution line.** Standalone.
- **Visual:** crimson-red body, gold pips, gold star marks on face 5.

#### Flipper

- **Role:** light control die (broad)
- **Mechanic:** once per turn, `FLIP` changes the die to its opposite face.
- **Opposite mapping:** `1↔6`, `2↔5`, `3↔4`
- **Level line:**
  - Lv1: flip self
  - Lv2: flip self or one adjacent die
  - Lv3: flip any one die on the field
- **Visual:** ivory body, dolphin marks replace active pips.
- **Relationship to Tuner:** Flipper is the broad, playful control die. Tuner is the more precise control die and belongs in Rare.

#### Even Die

- **Role:** common parity bias die
- **Mechanic:** elevated chance for `2/4/6`.
- **Level line:**
  - Lv1: `2/4/6 = 25%` each, `1/3/5 = 8.3%` each
  - Lv2: `2/4/6 = 28.3%` each, `1/3/5 = 5%` each
  - Lv3: `2/4/6 = 30%` each, `1/3/5 = 3.3%` each

#### Odd Die

- **Role:** common parity bias die
- **Mechanic:** elevated chance for `1/3/5`.
- **Level line:**
  - Lv1: `1/3/5 = 25%` each, `2/4/6 = 8.3%` each
  - Lv2: `1/3/5 = 28.3%` each, `2/4/6 = 5%` each
  - Lv3: `1/3/5 = 30%` each, `2/4/6 = 3.3%` each

#### Mathematician Die

- **Category:** Common — standalone, no evolution line
- **Role:** bias die with specific priority
- **Mechanic:** elevated chance for `3/1/4` in descending priority. `2/5/6` remain least frequent.

#### Cluster Die

- **Role:** set-biased family die
- **Mechanic:** passive bias toward `2/3/4/6` (non-scoring faces).
- **Level line:**
  - Lv1: `2/3/4/6 = 20%` each, `1/5 = 10%` each
  - Lv2: `2/3/4/6 = 21.25%` each, `1/5 = 7.5%` each
  - Lv3: `2/3/4/6 = 22.5%` each, `1/5 = 5%` each
- **Loadout synergy:** if One Love is in the loadout, Cluster leans further from `1`. If Comrade is in the loadout, Cluster leans further from `5`. If both, effects stack — Cluster becomes the "remaining values" die of the family.

#### Bounce Die

- **Role:** return / comeback die
- **Mechanic:** rewards successful scoring by coming back into the turn.
- **Level line:**
  - Lv1: if Bounce scores, it returns once that turn with a random value. No second return.
  - Lv2: if Bounce scores, it returns once that turn with bias toward `1/5`. No second return.
  - Lv3: if Bounce scores, it returns with bias toward `1/5`. If it scores again, may return one more time. Hard cap: 2 returns per turn.
- **Constraint:** Bounce does not pull back other dice from old packets.

#### Slime Die

- **Role:** spawn / split die
- **Trigger:** rolls `6`
- **Level line:**
  - Lv1: on `6`, spawn 1 temporary extra die (visually smaller) with a random value.
  - Lv2: on `6`, spawn 1 temporary normal-sized die with random value. Slime Die itself becomes `5`.
  - Lv3: on `6`, spawn 1 temporary normal-sized die with `1/5 = 50%/50%`. Slime Die itself becomes `5`.
- **Spawned die:** temporary for the current turn only. Can be used like other dice.

#### Bridge Die

- **Role:** straight-only wildcard / continuation die
- **Mechanic:** if Bridge is chosen in a straight packet, it may become the missing value needed to complete that straight. Does **not** help with sets or isolated 1/5 scoring.
- **Level line:**
  - Lv1: Bridge can complete a straight.
  - Lv2: if Bridge helped complete a straight, you may reroll the one remaining die on the table 1 time.
  - Lv3: if Bridge helped complete a straight, you may reroll the one remaining die on the table up to 2 times.

#### Match Die

- **Role:** direct set helper
- **Mechanic:** works only with `2/3/4/6` sets. If the selected packet already contains at least 2 matching dice from `2/3/4/6`, Match Die counts as one more of that value.
- **Interaction:** player chooses Match Die, then chooses which matching value group it joins. The game must **not** silently assign Match to the best set. If multiple valid targets exist, the player must choose.
- **Level line:**
  - Lv1: supports pair → triple
  - Lv2: supports pair → triple, triple → four
  - Lv3: supports pair → triple, triple → four, four → five
- **No charge rule** — Match leaves the table as part of the scoring packet.

#### Chain Die

- **Role:** targeted helper for 1/5 scoring routes
- **Mechanic:** Chain supports only `1` and/or `5` depending on tier. Not a wildcard.
- **Interaction:** player selects Chain, then selects the die it should work with (click-order targeting). If a selection with Chain is invalid in click order, board-order fallback must **not** rewrite it into a valid chain combo.
- **Level line:**
  - Lv1: works only with `5`. Requires two real 5s + Chain. Example: `Chain + 5 + 5 = 500`
  - Lv2: works with `1` or `5`. Requires two real matching + Chain. Examples: `Chain + 1 + 1 = 1000`, `Chain + 5 + 5 = 500`
  - Lv3: works with `1` or `5`. Requires only one real matching + Chain. Examples: `Chain + 1 = 200`, `Chain + 5 = 100`. Lv3 does not make Chain count as two dice — it only reduces the activation requirement.
- **Visual:** rust-textured body. `CH` badge in preview. Chain/link marks as pip replacement.

#### Shrinking Die

- **Role:** directional rhythm die
- **Mechanic:** each turn trends toward `-1` from its previous value. Loops `1 → 6`.
- **Visual:** no pips — shows the current number as the face. Number size shrinks with the value.

#### Growing Die

- **Role:** directional rhythm die
- **Mechanic:** each new roll steps by `+1`. Loops `6 → 1`.
- **Visual:** no pips — shows the current number as the face. Number size grows with the value.

---

### 8.6 Common Utility Dice

#### Bandie

- **Category:** Common Utility — Sustain / Recovery
- **Status:** Locked Baseline
- **Mechanic:** if Bandie scores by itself, it heals the player. Healing triggers only when Bandie itself is the scored packet.
- **Level line:**
  - Lv1: heal `100 HP`
  - Lv2: heal `200 HP`
  - Lv3: heal `300 HP`
- **Visual:** white die body, red `✚` marks.

#### Pulse Die

- **Category:** Common Utility — Sustain / Recovery
- **Status:** Locked Baseline
- **Mechanic:** heals based on the size of the scored packet it joins. The bigger the packet, the stronger the healing pulse.
- **Level line:**
  - Lv1: heal `100 HP` per die in the scored packet
  - Lv2: heal `200 HP` per die in the scored packet
  - Lv3: heal `300 HP` per die in the scored packet
- **Examples:** Pulse alone = 100/200/300. Pulse + 1 other = 200/400/600. Pulse + 2 others = 300/600/900.

---

### 8.7 Rare Dice

#### Tuner

- **Role:** precision support / control die
- **Mechanic:** once per turn, shift a die by `+1` or `-1`.
- **Level line:**
  - Lv1: shift self by `+1/-1`
  - Lv2: shift self or one adjacent die by `+1/-1`
  - Lv3: shift any one die by `+1/-1`
- **Relationship to Flipper:** Tuner is the precise counterpart to the broader Flipper.

#### Royal I

- **Role:** straight-focused bonus die
- **Mechanic:** if the scored selection is `1-2-3-4-5-6`, add `+150` score.

#### Forge I

- **Role:** pure-set bonus die
- **Mechanic:** if the scored selection is exactly one three-of-a-kind, add `+100` score.

#### Pin Die

- **Role:** value-memory die
- **Mechanic:** if Pin Die scores, it pins the value it had in that scored packet. On the next roll, it returns with that exact value guaranteed. After that next roll, the pin is cleared.
- **Pin source:** final scored value (if another effect changed Pin Die before scoring, it pins the modified value).

#### Devil Die

- **Role:** six-route payoff die
- **Mechanic:** if there are two other visible `6` values on the table, Devil Die may count as the third `6`.
  - If Devil Die is not naturally `6`: result is a normal `3×6 = 600`.
  - If Devil Die is naturally `6`: that `3×6` result is scored twice = `1200`.
- **Visual:** bright devil-red body, white pips.

#### Mimic Die

- **Role:** adaptive value-copy die
- **Mechanic:** copies only the numeric value (not special function) of a neighboring die.
- **Interaction:** player selects Mimic → `MIMIC` button → selects one neighboring die → Mimic copies that die's value for the current roll state.
- **No evolution line.**
- **Visual:** gray die body, large copy sign `⧉`. During roll animation, faces alternate between marked and blank-looking states. When settled, always shows `⧉`.

#### Clone Die

- **Role:** self-copy value rewrite die
- **Mechanic:** does not spawn an extra die. Instead rewrites one chosen die into Clone Die's current value. Copies value only, not special function.
- **Interaction:** player selects Clone → `CLONE` button → selects one other die → that die changes to Clone Die's value.
- **No evolution line.**
- **Exotic separation:** Replicant (Exotic) is the stronger cousin that copies full die objects.

#### Blight Die

- **Role:** infective value-conversion die
- **Mechanic:** infects one neighboring die and changes it to Blight's current value. If not activated, Blight behaves like a normal die.
- **Interaction:** player selects Blight → `INFECT` button → selects one neighboring die → neighbor changes to Blight's value.
- **No evolution line.**
- **Visual:** bright toxic green body, red biohazard marks. Face 1 uses a large centered red `☣`.
- **Naming:** Plague is reserved for a future stronger Exotic infection die.

#### SacriDice

- **Role:** sacrifice conversion die
- **Mechanic:** sacrifices itself during the current roll state. Its value is added into one chosen die on a `1..6` loop. SacriDice then disappears for the rest of that roll state. Returns on the next roll.
- **Value loop:** `2 + 3 = 5`, `5 + 3 = 2`, `6 + 2 = 2` (wraps around).
- **Interaction:** player selects SacriDice → `SACRIFICE` button → selects one other die → target becomes wrapped sum.
- **No evolution line.**
- **Trade-off:** gives up board width to upgrade one target die.

#### Gravity Die

- **Role:** board-reactive value-attraction die
- **Mechanic:** pulled toward the strongest value currently on the board. Gains strong bias toward that value.
- **Strength order:** `1` > `5` > `2/3/4/6` (by game scoring value).
- **Tie rule:** if two or more visible values are tied for strongest influence, Gravity Die gets no special bias (behaves normally).
- **No evolution line.**
- **Visual:** dark purple / deep violet body, `🌑` pips, face 1 uses large centered `G`.
- **Animation:** rolls normally, but shows a short tremble before settling when attraction applies.

#### Mirror Die

- **Role:** reflective side-face die
- **Mechanic:** looks into one neighboring die and reveals one of its side faces. Player may accept or cancel.
- **Interaction:** player selects Mirror → `MIRROR` button → selects one neighboring die → Mirror reveals a side-face value → player chooses `ACCEPT` or `CANCEL`. Cancel reverts Mirror to its original value but spends the die's use for the turn.
- **Side-face mapping:**
  - `1` → sides `2/3/5/4`
  - `2` → sides `1/4/6/3`
  - `3` → sides `1/2/6/5`
  - `4` → sides `1/5/6/2`
  - `5` → sides `1/3/6/4`
  - `6` → sides `2/4/5/3`
- **Level line:**
  - Lv1: all valid side faces equally likely (25% each)
  - Lv2: weighted — `1 = 1.75×`, `5 = 1.5×`, others = `1×`
  - Lv3: weighted — `1 = 2.5×`, `5 = 2×`, others = `1×`
- **Visual:** transparent blue / mirror-glass body. `✦` replaces normal pips.

#### Yin / Yang Dice

- **Role:** paired complementary dice (two separate dice)
- **Mechanic:** only activate pair behavior when both are present on the table in the same roll state.
- **Pair rule:** Yin is the leader. Yang is the follower. When both active on the table, Yang takes the complementary value of Yin.
- **Complement mapping:** `1↔6`, `2↔5`, `3↔4`
- **Table-state rule:** once one is scored or removed from the table, the link is gone for the rest of that roll state.
- **No evolution line.**
- **Visual:** Yin = fully white body, black pips. Yang = fully black body, white pips.

---

### 8.8 Rare Utility Dice

#### Leech Die

- **Category:** Rare Utility — Sustain / Recovery
- **Mechanic:** activates a temporary vampiric effect for the rest of the current turn. The packet containing Leech only activates the effect (no self-healing). Each **later** successful scoring packet heals the player for a percentage of that packet's score.
- **Turn flow:** score Leech in a packet → Leech active → later packets heal → on Bank or Bust, Leech effect ends.
- **Separation rule:** the packet containing Leech does not grant healing itself.
- **Level line:**
  - Lv1: heal `20%` of each later scoring packet
  - Lv2: heal `30%` of each later scoring packet
  - Lv3: heal `40%` of each later scoring packet

#### Transfusion Die

- **Category:** Rare Utility — Sustain / Recovery
- **Mechanic:** marks only the scored packet it joined. That packet may later be converted into healing instead of damage.
- **Turn flow:** score Transfusion in a packet → packet marked as `transfusion packet` → continue normally → if player banks, the game offers a choice for the marked packet: `HEAL` or `DAMAGE`.
  - `HEAL`: full score of the transfusion packet becomes healing. No damage dealt.
  - `DAMAGE`: full score deals damage. No healing.
- **Separation rule:** only the packet containing Transfusion is affected. All other packets remain normal damage.
- **No evolution line.**

#### Second Wind Die

- **Category:** Rare Utility — Sustain / Recovery
- **Mechanic:** one-shot per battle emergency recovery die.
- **Trigger:** checked after an enemy damage event. If the player would die or falls below a threshold, Second Wind triggers.
- **Level line:**
  - Lv1: if player survives a hit at below `50% HP` or the hit was lethal → survive at `1 HP`, heal `300 HP` at start of next player turn
  - Lv2: same trigger → heal `500 HP`
  - Lv3: if player survives at below `500 HP` or the hit was lethal → survive at `1 HP`, heal `1000 HP`

#### Siphon Die

- **Category:** Rare Utility — Sustain / Recovery
- **Mechanic:** feeds on enemy damage that got through to the player. Does not prevent the hit. Restores a share of the actual HP damage taken.
- **Trigger:** after an enemy damage event, if the player survives.
- **Level line:**
  - Lv1: restore `10%` of HP damage taken
  - Lv2: restore `20%` of HP damage taken
  - Lv3: restore `30%` of HP damage taken

---

### 8.9 Exotic Backlog

| Die | Notes |
|---|---|
| **Joker** | See §4. Exotic by nature. Implemented in shared ruleset. |
| **Super Mimic** | Copies the full neighboring die including special functionality |
| **Replicant** | Copies another die as a full die object with functionality |
| **Fuse Die** | Modifies or combines two other dice without sacrificing itself |
| **Plague Die** | Stronger Exotic infection die (Blight is the Rare version) |
| **Curse / Sabotage Dice** | Dice that interfere with the opponent's turn |

---

### 8.10 Utility Layer Design Guardrails

- Utility dice should change tempo, not erase the core battle loop.
- Healing should be readable and capped enough that fights do not stall.
- Enemy interaction should feel like counterplay, not arbitrary denial.
- If a utility die often makes the opponent's successful turn feel invalid, it is likely too strong or belongs in Exotic.

**Rarity guidance:**
- **Common Utility:** soft side. Small healing. No direct enemy score manipulation.
- **Rare Utility:** stronger sustain, score-to-heal conversion, light enemy counterplay, small reflection/siphon.
- **Exotic Utility:** strong enemy score manipulation, larger reflection, direct score theft, aggressive counterplay.

---

## 9. Progression & Unlocks

### 9.1 Progression Model

The active design progression model is built around three pillars:
1. **Common progression** — teaches the starter gameplay layer
2. **Rare progression** — opens the mid-game layer with deeper mechanics
3. **Exotic** — sits above both as a special/backlog layer

Joker belongs to the Exotic layer by nature. It must not be forced into Common or Rare ladders.

### 9.2 How Unlocks Are Earned

- Every standard bot-battle **win** adds `+1` to total wins.
- Tutorial battles add `+0`.
- Losses and manual exits add `+0`.
- Unlock checks happen against total wins inside the staged ladder.
- Unlock surfacing lives on the hub and on the battle result overlay.

### 9.3 Common Draft Ladder

| Win | Unlock | Notes | Difficulty | Encounter | Bot HP |
|---|---|---|---|---|---|
| 1 | Frog | | Novice | Tutorial Bot | 3000 |
| 2 | One Love | plain bias die | Novice | Tutorial Bot | 3250 |
| 3 | Comrade | plain bias die | Novice | Duelist | 3500 |
| 4 | Flipper | | Novice+ | Trickster | 3800 |
| 5 | Even Die | | Skilled | Pair Hunter | 4200 |
| 7 | Odd Die | | Skilled | Parity Bot | 4600 |
| 9 | Bandie | first heal unlock | Skilled | Sustain Test | 5000 |
| 11 | Mathematician Die | | Veteran | Pattern Bot | 5500 |
| 13 | Cluster Die | | Veteran | Set Boss | 6000 |
| 15 | Bounce Die | | Veteran | Tempo Bot | 6600 |
| 18 | Slime Die | | Elite | Split Boss | 7400 |
| 21 | Bridge Die | | Elite | Straight Boss | 8300 |
| 24 | Match Die | | Elite | Set Boss II | 9200 |
| 27 | Chain Die | | Master | Precision Boss | 10200 |
| 30 | Shrinking Die | | Master | Rhythm Boss | 11300 |
| 33 | Growing Die | | Master+ | Double Bot | 12400 |
| 36 | Pulse Die | second heal unlock | Common Finale | Common Finale Boss | 14000 |

### 9.4 Rare Draft Ladder

| Win | Unlock | Notes | Difficulty | Encounter | Bot HP |
|---|---|---|---|---|---|
| 40 | Tuner | | Master | Rare Gatekeeper | 16000 |
| 44 | Royal I | | Master | Straight Hunter | 17500 |
| 48 | Forge I | | Master+ | Set Smith | 19000 |
| 52 | Pin Die | | Master+ | Pattern Hunter | 20500 |
| 56 | Devil Die | | Heroic | Sixes Boss | 22000 |
| 60 | Mimic Die | | Heroic | Copycat Boss | 23500 |
| 65 | Clone Die | | Heroic+ | Double Bot | 25500 |
| 70 | Blight Die | | Nightmare | Infection Boss | 27500 |
| 75 | Gravity Die | | Nightmare | Weight Boss | 30000 |
| 81 | Mirror Die | | Nightmare+ | Reflective Boss | 33000 |
| 87 | SacriDice | | Apex | Sacrifice Duel | 36500 |
| 93 | Yin / Yang Dice | pair unlock | Apex | Twin Boss | 40000 |
| 100 | Second Wind Die | rare sustain | Apex+ | Endurance Boss | 44000 |
| 107 | Leech Die | rare sustain | Legend | Gauntlet (2 fights) | 48000 |
| 115 | Siphon Die | rare sustain | Legend | Drain Boss | 52500 |
| 123 | Transfusion Die | rare sustain finale | Legend Finale | Rare Finale Boss | 57500 |

### 9.5 Draft Reading Notes

- This is a planning draft, not a locked live baseline.
- Exact bot AI kits, bot HP, and encounter packaging are provisional tuning.
- Common carries onboarding + first sustain beats (Bandie at 9, Pulse at 36).
- Rare carries mid-game sustain layer (Second Wind at 100, Leech at 107, Siphon at 115, Transfusion at 123).
- If testing shows fatigue or overload, cadence should change before encounter HP is treated as final.

---

## 10. Hub & Battle Flow

### 10.1 Active Flow

`Hub → Battle → Hub`

### 10.2 Hub Actions

- **Play** — launches one bot fight
- **Bot Difficulty** — selectable on hub (Novice / Advanced / Master)
- **Loadout** — opens loadout editor modal
- **Tutorial** — launches tutorial-tagged bot battle (no unlock rewards)
- **Unlock Status** — shows win/loss, unlocked dice, next die requirement
- **Reset** — profile reset

### 10.3 Loadout Editor

- Left: owned dice pool (clean cards)
- Right top: 6 active slots for the next battle
- Right bottom: selected-die detail card (name, effect, evolution, action button)
- Equipped dice leave the left pool; return when removed from loadout
- Empty slots read as base dice
- Joker is a normal special die in this flow

### 10.4 Battle Entry Contract

```
entrySource: hub | tutorial
battleType: bot
ruleset: standard
loadout: active
botDifficulty: novice | advanced | master
```

### 10.5 Battle UI Priorities

- Dice readability above all
- Round title, Round Score, dice field, HP readability, core combat actions
- **Player roll affordance:** primary reference is **drag on the 3D table** (pull-back sling into the roll zone); **ROLL** remains a clear fallback for mouse-averse players and accessibility
- Bot turns play back on the live board: animated roll, sequential packet selection, held-dice collect, round-score update, bank or bust
- Secondary action buttons (JUMP, TUNE, FLIP, etc.) in a fixed row under main actions (prototype UI may show stubs; abilities not fully wired in `battle.html`)
- Round History in the right rail under bot block
- **Developer tooling:** optional **camera debug** on the battle screen to copy ArcRotateCamera view JSON for locking a default shot

---

## 11. Bot Opponents

Bots use the same roll/select/score/bank structure as the player. Current safe opponent model is a mirrored duel.

Bot behavior: bots always hold the highest-value valid scoring combination available. Challenge comes from HP pool and risk profile, not irrational play.

Bot difficulty currently maps to encounter HP and risk thresholds (exact tuning is provisional).

---

## 12. Tutorial

Interactive tutorial launched from hub. Teaches through guided actions on real dice and real buttons.

### 12.1 Chapters

| Chapter | Goal |
|---|---|
| 1. Core Scoring Basics | Valid selections, three-of-a-kind, straights, invalid selections |
| 2. Bust And Risk | No playable scoring dice, push-your-luck loss |
| 3. Joker | Normal vs active, wildcard resolution, `Joker + 5 + 5 = 500` |
| 4. Action Dice | Frog JUMP, Tuner TUNE |
| 5. Pattern Dice | One Love bias, Royal straight bonus, Forge set bonus |

### 12.2 Tutorial Rules

- Teaches the current live dice baseline — no parallel simplified ruleset.
- Interactive, not text-only.
- Reuses current battle runtime.
- Short guided actions on real dice and real buttons.
- Tutorial battles grant no persistent unlock rewards.

---

## 13. Visual Identity

- Base dice stay white.
- Common special dice can use ivory or controlled material shifts.
- Strong full-body color should be used sparingly.
- Visual identity must not break fast d6 readability.
- Hub preview and battle render should represent the same die object language.

---

## 14. 3D Engine

### 14.1 Architecture Intent

- The game shell (UI, buttons, loadout, score/bank logic, menus) remains **2D**.
- The 3D layer is **only for dice**: their physics, animation, and direct interaction.
- This is not a full 3D game — only the dice box area needs 3D presentation.
- The current main project ruleset remains the gameplay source of truth.

### 14.2 Engine Stack

**Confirmed stack (validated via `spike-v2.html`):**

| Layer | Technology | Loading |
|---|---|---|
| Rendering | BabylonJS (standalone) | Vendored: `vendor/babylon.js` |
| Physics | cannon-es | Vendored: `vendor/cannon-es.js` (import map) |
| Script type | ES module (`<script type="module">`) | Requires HTTP server |

**Why this stack:**
- BabylonJS has built-in `HighlightLayer`, `ArcRotateCamera`, `ShadowGenerator`, `scene.onPointerObservable` — all critical for dice interaction without extra libraries.
- cannon-es is lightweight, supports sleep events, kinematic bodies, and has no WASM dependency.
- The combination gives full control over die geometry, physics, and interaction — no black-box library constraints.

**Superseded:** `@3d-dice/dice-box` (BabylonJS + AmmoJS + Web Workers). Abandoned due to UV atlas fragility, crooked pip rendering, and inability to fix face alignment issues within the library's theme system.

### 14.3 Proven Capabilities

The following have been validated in the spike (`spike-v2.html`) and battle prototype (`battle.html`):

1. **Custom die geometry** — rounded box with geometric notches for pips, built via procedural `VertexData` (40-segment grid per face, edge rounding, cosine-profile notch depressions).
2. **Flat pip disc rendering** — 21 circular disc meshes (1+2+3+4+5+6 pips) rendered on face surfaces via `zOffset = -2`. Unlit pip material (`disableLighting = true`) ensures crisp dark pips regardless of camera angle or lighting.
3. **Dark backing box** — internal box (size 0.9) fills edge gaps with consistent dark color.
4. **Per-die color identity** — body color and pip color independently configurable per die. Proven presets: Classic (white/black), Red, Green, Blue, Purple, Dark, Gold.
5. **Click-to-select** — `scene.onPointerObservable` + `HighlightLayer` for green selection glow on individual dice (battle: after dice settle).
6. **Per-die drag-and-drop** — click-hold on die → die follows cursor on horizontal plane (kinematic) → release → dynamic drop with inertia. 6px threshold: click vs drag. **Validated in `spike-v2.html`**, not the primary roll mechanic in battle.
7. **Table-level sling roll** — **Validated in `battle.html`:** anchor = first pick on sling plane; cluster follows **current pick** (vector anchor→cursor in world XZ). Release applies **identical velocity** to all dice along **start−end** (slingshot: toward anchor from release); strength linear in world pull length to `SLING_MAX_PULL_WORLD`; click-without-pull **cancels** (no throw). HUD: projected **wedge** + % aligned with that shot direction. Die–die: `collisionFilterMask` включает и стол, и другие кубики — тела цельные, без взаимного проникновения (см. `ARCHITECTURE.md`). Complements **ROLL** (`throwFromBottom`).
8. **Multiple dice** — dynamic creation/removal of 1–6 dice, each with independent physics body, materials, and state. Smooth at 60fps.
9. **Physics collision** — dice collide with floor, walls, and **each other** (`mask` = env group | dice group). Settle detection via sleep events.
10. **Face value detection** — Euler angle reading from settled quaternion maps to face values 1–6.
11. **Directional throws & table layout** — player throws from bottom, bot from top; **sandwich** layout: common **width in X** for floor strips, **wide roll band** in Z, **narrow shelves** (~two dice wide in X) for held dice; divider planes confine rolling dice.
12. **Jump** — in-place bounce with random angular velocity, re-settles on new face (spike; battle may omit or differ).
13. **Die scale** — runtime-adjustable from 0.5× to 2.0×, rebuilds both visual mesh and physics box (spike).
14. **Anti-edge settling** — per-frame check: if die is slow but no face aligns with world up (quaternion dot < 0.92), apply angular nudge. Prevents unrealistic edge-balancing with high friction.
15. **Shadows** — `ShadowGenerator` with blur exponential shadow map on the floor surface.
16. **Fullscreen 3D canvas with UI overlay** — canvas fills entire viewport, UI (HP bars, buttons, info, history) overlaid with semi-transparent backdrop-blur panels and pointer-events passthrough.
17. **Held zone animation** — scored dice animate from roll zone to dedicated held zone (player at bottom, bot at top) with smooth lerp transition.
18. **Dice stash before throw** — dice spawn kinematic and hidden below the table until the real throw (avoids phantom rolls, e.g. before the bot’s turn).
19. **Camera debug (battle)** — panel to orbit/zoom, edit α/β/radius/target, copy view JSON, reset — for locking a production default camera.
20. **Full Farkle scoring engine** — singles, sets, short straights, full straight, three pairs. All-dice-must-score validation. Bust detection via brute-force subset check.
21. **Hot Hand** — automatic bank when all 6 dice scored during a turn. Deals damage, resets dice, same player continues.
22. **Bot AI** — find best scoring subset, bank when accumulated ≥ 450 or ≤ 1 die remaining. Timed delays for visual playback.
23. **HP-based combat** — 3000 HP each side, banked score = direct damage (1:1), 0 HP = immediate end.
24. **Throw lab** — `throw-lab.html` / `throw-lab.mjs`: same table geometry as battle, without combat UI. **Sling release in the lab** reuses **ROLL-style** physics (per-die `f`, off-center `applyImpulse`, `rollPlayer` multipliers, random orientation on release); **`battle.html`** sling remains the older **uniform velocity** + `sling.impulse*` model until unified. Shared **`battle_tune_json_v1`**; **«Реализм броска»** sliders; full **Tune** with EN/RU hints. Current roll + history log; sling wedge over the lab canvas.

### 14.4 Physics Baseline

**Battle / throw-lab (canonical shipping defaults)** — object **`BATTLE_TUNE_DEFAULTS`** in **`battle.html`** and **`throw-lab.mjs`** (must stay identical). On load, **`localStorage['battle_tune_json_v1']`** deep-merges numeric overrides; without storage, the table below is what every fresh session and static deploy uses.

| Group | Key fields (representative) | Shipping default |
|---|---|---|
| `world` | `gravity`, `restitution`, `friction` | −93, 0.35, 0.5 |
| `body` | `mass`, `linearDamping`, `angularDamping`, `throwMin`, `throwMax` | 1.35, 0.05, 0.1, 20, 50 |
| `sling` | `impulseHMin` / `impulseHMax`, `impulseYMin` / `impulseYMax` | 10.175 / 61.6, 3.1625 / 11.9625 |
| `rollPlayer` | `mainImpulse`, `impulseYMul`, `spawnYOffset`, … | 5.61, 0.17, 1, … |
| `rollBot` | `mainImpulse`, … | 5.225, … |
| `mesh` | `dieScale`, `boxHalfPerScale` | 1.7, 0.48 (physics half-extent tracks `boxHalfPerScale × dieScale`) |

ROLL uses `throwMin`…`throwMax` with `rollPlayer` / `rollBot` multipliers; battle sling uses shared linear velocity from **`sling.impulse*`** scaled by pull strength (see `ARCHITECTURE.md`).

**Historical spike-v2 reference** (older sandbox; not equal to battle defaults):

| Parameter | Spike-era value | Notes |
|---|---|---|
| `gravity` | −50 | Wider Tune range in spike UI |
| `restitution` / `friction` | 0.3 / 0.6 | |
| `mass` | 1 | |
| `throwMin` / `throwMax` | 3 / 8 | Different naming in spike |
| `angularDamping` | 0.15 | Battle shipping uses 0.1 |

### 14.5 Custom Dice Constructor

The project uses a fully custom procedural die geometry — no external mesh files, no UV atlases, no texture baking.

**Location:** `spike-v2.html` (validated prototype). To be extracted into `src/engine/` modules.

#### 14.5.1 Outer Geometry — `createDiceVertexData()`

Generates a 1×1×1 rounded box with pip notch depressions:

- **Grid:** 6 faces × 41×41 vertex grid (SEGMENTS=40) = 10,086 vertices total.
- **Edge rounding:** vertices where 2+ axes exceed threshold (0.43) are projected onto a sphere of radius EDGE_R (0.07). Produces smooth rounded edges/corners.
- **Pip notches:** cosine-profile depressions at standard d6 pip positions. Parameters: NOTCH_R=0.14 (radius), NOTCH_D=0.12 (depth), PIP_OFFSET=0.23 (spacing).
- **Face-to-pip mapping:** Y+=1 pip, X+=2, Z+=3, Z-=4, X-=5, Y-=6 (opposite faces sum to 7).
- **Normals:** computed via `BABYLON.VertexData.ComputeNormals` with automatic flip detection.

#### 14.5.2 Pip Discs — `createPipsVertexData()`

21 flat circular disc meshes (16-segment fan each) positioned flush with each face surface:

- Rendered via `StandardMaterial` with `zOffset = -2` — always visible on top of the outer surface.
- Pip color is independent of body color — shared `pipMat` updated in real time.
- Pip radius: 0.1 units on a 1-unit face (20% of face width).

#### 14.5.3 Backing Box

`BABYLON.MeshBuilder.CreateBox` at size 0.9, dark material. Fills gaps between the six face grids at die edges.

#### 14.5.4 Die Assembly

Each die consists of 4 components parented to a `TransformNode`:
1. **Outer mesh** — rounded box with notches (body color material)
2. **Pips mesh** — 21 flat discs (pip color material, z-offset)
3. **Backing mesh** — dark interior box
4. **Physics body** — `CANNON.Box(0.48 * scale)` with sleep events

#### 14.5.5 Verified Face-to-Axis Mapping

| Value | Face normal axis | Positive direction |
|---|---|---|
| 1 | Y+ | Top |
| 2 | X+ | Right |
| 3 | Z+ | Front |
| 4 | Z- | Back |
| 5 | X- | Left |
| 6 | Y- | Bottom |

#### 14.5.6 Extending the Constructor for Special Dice

The per-die color system is proven. For dice with custom face marks (Frog eye, Joker J, biohazard symbol), the path forward is:
- Replace specific pip discs with custom glyph meshes or textured quads
- Per-face override in a die definition config
- The outer geometry (rounded box) stays identical — only the surface decoration changes

### 14.6 Audio Baseline

- Roll sound was validated technically in the original spike (local `assets/dice-roll.mp3`)
- Currently disabled because simple button-triggered playback feels desynced from actual die-to-surface contact
- Next audio pass should use cannon-es collision events or settle events for timing

### 14.7 Deterministic Resolution

Dice face values are determined by `store.prng.next(1, 6)`, not by 3D physics. The 3D animation is purely visual — it lands on the predetermined face. This ensures deterministic replay per `ARCHITECTURE.md`.

**Implementation note:** the current spike uses `Math.random()` for physics throw direction/force (visual only). In production, the visual throw parameters can also use the seeded PRNG for reproducible animation, though this is cosmetic.

### 14.8 3D Adaptation Questions for Dice Mechanics

| Mechanic | 3D Status |
|---|---|
| **Adjacency** (Mimic, Blight, Flipper Lv2, Mirror) | Physical proximity on table after settling. Distance threshold TBD — `CANNON.Body.position` distance between settled dice is straightforward. |
| **Visual feedback** for abilities | Die value change = rebuild pip mesh or swap material. Particle effects available via BabylonJS `ParticleSystem`. |
| **Spawning** (Slime Die) | `createDie()` dynamically adds dice mid-turn — proven in multi-dice system. |
| **Value changes** (Tuner, Flipper, SacriDice, Frog, Blight, Clone) | Swap pip mesh to reflect new value. Could animate a quick spin before settling on new face. |
| **Six-dice readability** | **Validated** — 6 dice at once are readable with distinct pips, shadows, and per-die colors. |
| **Drag-and-drop for loadout** | **Spike validated** — per-die drag with physics drop. Inventory ↔ loadout not built yet. Battle uses **table sling** for rolling, not per-die pickup. |
| **Die scale for visual hierarchy** | **Validated** — 0.5× to 2.0× scale. Could use smaller dice for spawned/temporary dice (Slime). |

### 14.9 Not Yet Proven

- Production integration with store/dispatch architecture (battle.html runs standalone, not wired to store)
- Per-face custom glyph rendering (Frog eye, Joker J, biohazard — only solid-color pips proven)
- Production audio sync with physics events
- Smooth return-from-held to roll zone (held dice are currently disposed at turn end)

### 14.10 Server Requirement

`battle.html` and `spike-v2.html` load **vendored** BabylonJS (`vendor/babylon.js`) and cannon-es (`vendor/cannon-es.js` via import map). They still require **HTTP** — browsers block ES modules (and reliable WASM/physics) on **`file://`**. Use `node server.mjs` (port 4174), or deploy to static hosting (e.g. **Cloudflare Pages** from `main` via `.github/workflows/deploy.yml`, or GitHub Pages / Netlify). Root **`index.html`**: on `file://` shows instructions (RU) instead of redirecting.

Game logic in `src/` (store, systems, config) follows the IIFE pattern per `ARCHITECTURE.md`. The rendering bridge will connect store state to the 3D engine via `store.subscribeTo`.

### 14.11 Failed Experiments (Do Not Repeat)

- **`@3d-dice/dice-box` library** — UV atlas system produced crooked/misaligned pips that could not be fixed by adjusting `contentBoxes` or regenerating themes. The library's internal mesh-to-UV pipeline has invisible assumptions. Abandoned in favor of fully custom geometry.
- **Atlas-based dice constructor** (`tools/dice-constructor/`) — SVG tile generation → atlas assembly approach. Produced correct pip layouts but live rendering still showed alignment issues due to the underlying `dice-box` mesh UV mapping. The tool itself works but is coupled to the abandoned library.
- **Rounded die mesh by deforming stock d6** — caused lighting issues (bad normals), crooked settling.
- **Decorative 3D tabletop overlay** — interfered with physics floor. Use 2D backdrop behind canvas instead.
- **Inner plane approach for pip contrast** — six dark quads inside the die at inset positions, intended to show through notch depressions. Unreliable: depth buffer precision issues, edge bleed, pip visibility depended on notch depth. Replaced by flat pip disc meshes with z-offset.

### 14.12 Throw lab (instrumentation)

**Files:** `throw-lab.html`, `throw-lab.mjs` (ES module, HTTP only).

**Intent:** tune **how throws feel** (speed, arc, mass, gravity, damping) and inspect outcomes without playing a full battle. Uses the same **sandwich table**, **ROLL** (`throwFromBottom` analogue) and **sling** (kinematic cluster → release → shared initial velocity) as battle.

**Persistence:** `localStorage['battle_tune_json_v1']` — identical key to **`battle.html`**. Editing Tune or realism in the lab affects battle on next load unless one overwrites the other.

**Repo defaults:** **`BATTLE_TUNE_DEFAULTS`** in **`battle.html`** and **`throw-lab.mjs`** defines the shipping feel when no JSON is stored (e.g. incognito, first visit on deploy). Change both files together when rebasing the default feel.

**UI layers:** (1) **Реализм броска** — coarse sliders tied to `battleTune` subsets (power scales `throwMin`/`throwMax`, sling H/Y from **lab default anchors**, `rollPlayer`/`rollBot` `mainImpulse`, vertical multipliers for arc). (2) **Full Tune** — every numeric field with EN+RU explanations; list **`PHYSICS_TUNE_FIELDS`** is **duplicated** in `battle.html` and `throw-lab.mjs` — add new keys in both when extending tuning.

**Sling vs battle:** In the lab, sling impulses follow the same pattern as **ROLL** (`throwMin`/`throwMax` scaled by pull strength, `rollPlayer.*`, random torque offset). In **battle.html**, sling still sets one shared linear velocity from **`sling.impulseH/Y`**.

**Determinism:** Lab ROLL/sling still use **`Math.random()`** for placement/rotation jitter (visual). Production goal remains **seeded PRNG** for any outcome-linked logic per §14.7; the lab is a designer tool, not the replay contract.

---

## 15. Parked Future Systems

These systems are documented in the old project but are **not** part of the active scope. They should not drive current decisions unless explicitly reactivated.

| System | Status | Old Reference |
|---|---|---|
| Class system (Warrior/Rogue/Mage/Mystic/Engineer/Manager) | Parked | `CLASS_SYSTEM_SPEC.md` |
| Class dice and class combat hooks | Parked | `CLASS_SYSTEM_SPEC.md` |
| Tavern services (healer, inn, merchant, upgrade bench) | Parked | `TAVERN_HUB_SPEC.md` |
| Adventure route progression (map, campfire, flask, fatigue) | Parked | `PROGRESSION_AND_ECONOMY_SPEC.md` |
| Equipment / relics | Parked | `CLASS_SYSTEM_SPEC.md` |
| Economy resources (Coins, Dust, Shard) | Parked | `PROGRESSION_AND_ECONOMY_SPEC.md` |
| PvP / live multiplayer | Future | — |
| Shield / Armor / Block combat layers | Deferred | `COMBAT_SYSTEM_SPEC.md` |
| Combat statuses | Deferred | `COMBAT_SYSTEM_SPEC.md` |
| Shield-flavored utility dice (Bubble, Guard) | Postponed | `DICE_LIBRARY_SPEC.md` |

---

## 16. Architecture Notes

### 16.1 State Slices

| Slice | Contents | System File |
|---|---|---|
| `state.match` | Phase (hub/loadout/battle/result), active player, turn count | `matchSystem.js` |
| `state.player` | HP, loadout, collection, wins | `playerSystem.js` |
| `state.enemy` | HP, loadout, personality, name | `enemySystem.js` |
| `state.turn` | Rolled dice values, held dice, accumulated score, phase (roll/hold/decide), bust flag, hot hand flag, active die effects | `turnSystem.js` |
| `state.campaign` | Unlock ladder progress, completed encounters | `campaignSystem.js` |

### 16.2 Key Actions

| Action | Payload | Slice |
|---|---|---|
| `ROLL_DICE` | `{ count }` | `turn` |
| `SELECT_DIE` | `{ dieIndex }` | `turn` |
| `DESELECT_DIE` | `{ dieIndex }` | `turn` |
| `SCORE_SELECTION` | `{}` | `turn` |
| `BANK` | `{}` | `turn`, `player`/`enemy` HP |
| `BUST` | `{}` | `turn` |
| `HOT_HAND` | `{}` | `turn` |
| `END_TURN` | `{}` | `match` |
| `USE_ABILITY` | `{ dieIndex, ability, target? }` | `turn` |
| `START_BATTLE` | `{ enemyId, difficulty }` | `match`, `enemy` |
| `SET_LOADOUT` | `{ dice[] }` | `player` |
| `UNLOCK_DIE` | `{ dieType }` | `player`, `campaign` |
