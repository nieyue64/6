# Phase 2 Report: Render Pipeline & API Isolation

## Date: 2026-04-20
## Status: COMPLETE

## What Was Done

### 1. Post-FX Pipeline Architecture (Pain Point #1: Onion Model)
**Before**: `applyPostFX` was wrapped 4 times in an "onion" pattern:
- Layer 0: Base (experience patch) - vignette, grain, color grading
- Layer 1: Weather tint - weather color overlay + lightning
- Layer 2: Weather optimized - same as layer 1 but with "suppression" of layer 1
- Layer 3: Underwater fog - deep water tint + underwater screen

Each layer called `prev.call(this, ...)` creating a deep call stack that defeated V8 JIT optimization.

**After**: Linear `Renderer._postFxPipeline` array with explicit ordering:
- Added `_postFxPipeline` array to Renderer constructor
- Added `registerPostFxStage(name, order, fn)` instance method
- Added `_runPostFxPipeline(time, depth01, reducedMotion)` execution method
- Added `Renderer._pendingPostFxStages` class-level array for patches that run before instance creation
- Lazy-merges class-level stages into instance on first call

**Pipeline stages registered:**
| Order | Name | Source |
|-------|------|--------|
| 10 | `weather:tintOptimized` | weather_canvas_fx_perf_v1 patch |
| 30 | `underwater:fog` | biome_content_v1 patch |

### 2. Weather Tint De-duplication
- **Removed**: Older weather tint wrapper (`__weatherPostTintInstalled`) - superseded
- **Converted**: Optimized weather tint to pipeline stage - no more wrapper
- **Eliminated**: The "temporary zero" suppression pattern where the optimized tint would zero out `weatherFx` params, call `prev`, then restore them
- **Impact**: Single-pass weather tinting, no suppression needed

### 3. Underwater Fog Linearized
- **Converted**: From `prev.call(this, ...)` wrapper to pipeline stage (order 30)
- **Adapted**: Changed `this` references to `renderer` parameter
- **Impact**: No more closure chain for underwater effects

### 4. Global Canvas getContext Hijack Replaced (Pain Point #1)
**Before**: `HTMLCanvasElement.prototype.getContext` was globally overridden, affecting:
- Game canvas (intended target)
- Minimap canvas (unnecessary overhead)
- All chunk cache canvases (unnecessary overhead)
- OffscreenCanvas fallbacks (potentially breaking)
- Third-party canvas elements

**After**: `TU.CanvasOptimizer` utility with scoped `optimize(ctx)` method:
- Only applied to the game renderer's main context
- Auto-applies after `game:init:post` event
- Other canvases use native `getContext` without overhead
- `optimize(ctx)` is available for explicit use on other contexts if needed

## Backup
- `part3_phase2_pipeline_isolation.html` - State after Phase 2 completion

## Risk Assessment
- MEDIUM: Pipeline stage execution order matters - weather must come before underwater
- LOW: Canvas optimizer scoping is strictly safer than global override
- LOW: Existing code that checks `ctx.__tu_optimized` will still work

## Performance Impact
- Eliminates 3-4 levels of nested function calls per frame in applyPostFX
- Removes global prototype override overhead from all non-game canvases
- Weather tint suppression pattern eliminated (was doing 2 sets of param reads/writes per frame)
