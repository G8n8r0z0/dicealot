# Dice Constructor

This folder contains the narrow constructor pipeline for the `dice-a-lot` sandbox.

Target architecture:

- `DicePreset`
- `face tiles`
- `atlas builder`
- `theme output`

The current implementation is intentionally scoped to the active `d6` workstream.
It does not rewrite `@3d-dice/dice-box`.
It generates a normal theme folder that the sandbox can preload and roll.

## Current Presets

- `white-classic-reference`
- `red-joker-reference`
- `white-fit-probe`

## Build

From the sandbox root:

```powershell
node .\tools\dice-constructor\build.mjs white-classic-reference
```

That command regenerates:

- `assets/themes/white-classic-constructor/theme.config.json`
- `assets/themes/white-classic-constructor/default.json`
- `assets/themes/white-classic-constructor/diffuse-light.svg`
- `assets/themes/white-classic-constructor/diffuse-dark.svg`
- `assets/themes/white-classic-constructor/design-net.svg`
- `assets/themes/white-classic-constructor/build-info.json`

## Current Decisions

- The mesh preset owns the extracted UV slot bounds for the current `d6`.
- The builder verifies `value -> slot` against `colliderFaceMap` from the source mesh file.
- Face art is generated tile-by-tile, then assembled into one atlas.
- The builder also emits a flat net preview so face design can be checked in human-readable cube space.
- The output stays compatible with the existing sandbox theme loader.

## Current Limitation

UV slot bounds are still fixed constructor metadata for the current `d6` mesh preset.
They are no longer edited blindly in the atlas itself, but they are not auto-derived yet.
