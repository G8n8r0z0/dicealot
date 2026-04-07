# Next Iteration Prompt

Read the following project files before doing anything:
1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `DESIGN_RULES.md`
4. `DESIGN.md` (especially §14 for 3D / `battle.html` behavior)
5. `TODO.md`

Confirm that you understand the rules and the current state of the project, then proceed with the iteration workflow.

**Note:** The live battle prototype is **`battle.html`** (vendored Babylon + cannon-es, sling: anchor→release in world XZ, wedge HUD, camera debug). If the change touches 3D UX, sling, or table layout, update **§14** in `DESIGN.md` and **Battle Prototype / Interaction Model** in `ARCHITECTURE.md`, not only code. If chat context is thin, sync those docs explicitly after the change.

## What I Want to Change

User is asking for change or implementation

## Instructions

Follow the iteration workflow from `AGENTS.md`:

1. **Validate** — check my request against `DESIGN_RULES.md` and `ARCHITECTURE.md`. If it violates any rule, warn me and propose alternatives before proceeding.
2. **Update DESIGN.md** — modify the design document to reflect the change. Do not delete unrelated sections. Validate updated design against `DESIGN_RULES.md`. Show me the diff for approval.
3. **Update TODO.md** — add new tasks for the change. Mark previously completed tasks as done, don't remove them. Show me the new tasks for approval.
4. **Implement** — execute the new tasks sequentially.
5. **Test** — update existing tests and write new ones. Run all tests (not just new ones). Fix failures, re-run until all pass.

Do NOT skip straight to code. Start with step 1.
