# Phase 3 Report: Persistence & Worker Rebuild

## Date: 2026-04-20
## Status: COMPLETE

## What Was Done

### 1. BlockRegistry (Pain Point #5: ID Drifting)
**Before**: Block IDs were allocated by scanning for the first unused ID starting from a hint. If patch load order changed, different blocks got different IDs, corrupting old save data.

**After**: `TU.BlockRegistry` provides deterministic ID allocation:
- `buildFromBLOCK()` - Imports all base BLOCK enum IDs (0-100+)
- `allocate(name, hintId)` - Allocates by name; returns existing ID if already allocated
- `exportPalette()` - Exports name->ID mapping for save data headers
- `importPalette(palette)` - Restores ID mappings from save data
- Auto-initializes after `game:init:post`

**Integration**: Modified `allocId()` function in biome content patch to pass block names:
- `allocId(206, 'PUMP_IN')` instead of `allocId(206)`
- `allocId(hint, 'PUMP_OUT')` instead of `allocId(hint)`
- Same for PLATE_OFF, PLATE_ON

**Future**: Save system can embed `TU.BlockRegistry.exportPalette()` in save headers, and on load call `TU.BlockRegistry.importPalette(header.palette)` to restore exact ID mappings even if patch order changes.

### 2. StorageAdapter (Pain Point #4)
**Before**: Storage fallback logic was scattered across multiple patches (SaveSystem, IDB patch, autosave degraded patch) with duplicated LS/IDB fallback patterns.

**After**: `TU.StorageAdapter` provides unified storage interface:
- `get(key)` - Reads from LS first, falls back to IDB
- `set(key, value)` - Writes to both LS and IDB for redundancy
- `remove(key)` - Removes from both
- All operations explicitly report quota errors to `GlobalErrorBoundary`
- Returns `{ ok, lsOk, idbOk }` from set() for caller inspection

### 3. Worker toString Validation (Pain Point #2)
**Before**: `NoiseGenerator.toString()` and `WorldGenerator.toString()` were used blindly to build Worker source. If minification or class syntax changed the output, the Worker would silently fail.

**After**: Added validation checks before injecting stringified code:
- Checks output length (minimum 50/100 chars)
- Checks for `[native code]` marker (indicates function can't be stringified)
- Reports failures to `GlobalErrorBoundary` with context
- Still proceeds (best-effort) but now failures are visible in console

### What Was NOT Changed (Intentionally)
- **Worker architecture**: Full replacement of toString() with constant templates or PatchedWorldGenerator subclass would require rebuilding the entire Worker build pipeline. This is noted as future work. The validation guards provide early warning for now.
- **Save system rewrite**: The existing degraded/lite/full save chain is complex but functional. StorageAdapter provides the clean interface; full migration of SaveSystem to use it is future work.

## Backup
- `part4_phase3_persistence_worker.html` - State after Phase 3 completion

## Risk Assessment
- LOW: BlockRegistry is additive - existing allocId falls back to legacy if registry unavailable
- LOW: StorageAdapter is new code, not replacing existing paths yet
- LOW: Worker validation only adds checks, doesn't change behavior
