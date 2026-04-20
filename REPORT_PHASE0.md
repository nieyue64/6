# Phase 0 Report: Safety Net & Performance Baselines

## Date: 2026-04-20
## Status: COMPLETE

## What Was Done

### 1. TU.Safe.run Enhanced (Pain Point #4: Error Swallowing)
- **Refactored** `TU.Safe.run` to extract shared `_handleError` helper
- **Added** `TU.Safe.runAsync` - async-aware variant that properly catches Promise rejections
- **Impact**: Worker hangs, IDB write failures, and async operations that previously had no error path now have explicit error handling

### 2. GlobalErrorBoundary Introduced
- **Added** `window.TU.GlobalErrorBoundary` - centralized error collection system
- **Captures**: `unhandledrejection` events (Worker hangs, dangling Promises), `window.error` events
- **Classifies**: Fatal errors (IDB quota, Worker errors, save failures) vs warnings
- **Emits**: `error:fatal` event on GameEvents bus for downstream handling
- **Records**: Up to 50 errors with timestamp, source, message, stack trace

### 3. Performance Baseline Collector (TU.PerfBaseline)
- **Added** `window.TU.PerfBaseline` - frame time percentile collector
- **Metrics**: p50 (median), p95, p99 frame times over rolling 300-frame window
- **Auto-starts**: After `game:init:post` event, logs initial snapshot after 5 seconds
- **API**: `start()`, `stop()`, `snapshot()`, `getP95()`, `getP99()`

### 4. IndexedDB Storage - Explicit Error Reporting
- **Fixed**: `IndexedDBStorage.set()` now detects `QuotaExceededError` explicitly
- **Reports**: Quota errors to `GlobalErrorBoundary` and emits `error:fatal` event
- **Changed**: All IDB operations now use `console.error` instead of `console.warn` for failures

### 5. localStorage Storage Adapter - Quota Detection
- **Fixed**: `AppServices.storage.set()` now detects quota exceeded errors
- **Reports**: To `GlobalErrorBoundary` and emits `error:storageQuota` event
- **Impact**: Save data corruption due to silent quota failures is now visible

### 6. game:init:post Double-Fire Fixed (Pain Point #3: Lifecycle Race)
- **Found**: Original `Game.prototype.init` emits `game:init:post` at end
- **Found**: Patch at order 70 wraps `init` and re-emits `game:init:post` after await
- **Fixed**: Removed duplicate emission from the patch wrapper
- **Impact**: Eliminates first-frame stutter caused by double initialization of all listeners

## Files Changed
- `part3_game_single (6) (9)(9)(2)(6).html` - Main game file (all changes in-place)

## Backup
- `part0_original_backup.html` - Pristine original before any changes
- `part1_phase0_safety_net.html` - State after Phase 0 completion

## Verification Checklist
- [x] TU.Safe.run still works synchronously (backward compatible)
- [x] TU.Safe.runAsync available for async operations
- [x] GlobalErrorBoundary captures unhandled rejections
- [x] PerfBaseline auto-starts and collects frame times
- [x] IDB quota errors are explicitly reported
- [x] localStorage quota errors are explicitly reported
- [x] game:init:post fires exactly once
