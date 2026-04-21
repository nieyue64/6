/* ============================================
   TU PERFORMANCE OPTIMIZATION MODULES
   ============================================ */
(function() {
  'use strict';
  const TU = window.TU || (window.TU = {});
  
  /* --- _safeExecute: Prevent V8 De-optimization --- */
  function _safeExecute(fn, arg, ctx) {
    try {
      if (ctx) fn.call(ctx, arg);
      else fn(arg);
    } catch (e) {
      console.warn('[SafeExecute Error]', e);
    }
  }

  /* --- AnimFrame: Batched requestAnimationFrame --- */
  TU.AnimFrame = {
    _queue: [],
    _running: false,
    _id: 0,
    add(fn, priority = 0) {
      const id = ++this._id;
      this._queue.push({ id, fn, priority });
      this._queue.sort((a, b) => b.priority - a.priority);
      if (!this._running) this._start();
      return id;
    },
    remove(id) {
      this._queue = this._queue.filter(item => item.id !== id);
    },
    _start() {
      if (this._running) return;
      this._running = true;
      const tick = (ts) => {
        if (this._queue.length === 0) {
          this._running = false;
          return;
        }
        for (let i = 0; i < this._queue.length; i++) {
          _safeExecute(this._queue[i].fn, ts);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    clear() { this._queue = []; this._running = false; }
  };
  
  /* --- Delegate: Event Delegation Manager --- */
  TU.Delegate = {
    _handlers: new Map(),
    on(root, type, selector, handler) {
      const key = `${type}:${selector}`;
      if (this._handlers.has(key)) return;
      const wrapper = (e) => {
        const target = e.target.closest(selector);
        if (target && root.contains(target)) handler(e, target);
      };
      root.addEventListener(type, wrapper, { passive: true });
      this._handlers.set(key, { root, type, wrapper });
    },
    off(selector, type) {
      const key = `${type}:${selector}`;
      const h = this._handlers.get(key);
      if (h) {
        h.root.removeEventListener(h.type, h.wrapper);
        this._handlers.delete(key);
      }
    },
    clear() {
      for (const [, h] of this._handlers) {
        h.root.removeEventListener(h.type, h.wrapper);
      }
      this._handlers.clear();
    }
  };
  
  /* --- DOMBatch: Batched DOM Read/Write --- */
  TU.DOMBatch = {
    _reads: [],
    _writes: [],
    _scheduled: false,
    read(fn) { this._reads.push(fn); this._schedule(); },
    write(fn) { this._writes.push(fn); this._schedule(); },
    _schedule() {
      if (this._scheduled) return;
      this._scheduled = true;
      requestAnimationFrame(() => {
        const reads = this._reads.slice();
        const writes = this._writes.slice();
        this._reads = [];
        this._writes = [];
        this._scheduled = false;
        for (const fn of reads) _safeExecute(fn);
        for (const fn of writes) _safeExecute(fn);
      });
    },
    clear() { this._reads = []; this._writes = []; this._scheduled = false; }
  };
  
  /* --- Throttle: Limit execution rate --- */
  TU.throttle = (fn, limit = 100) => {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last >= limit) {
        last = now;
        return fn.apply(this, args);
      }
    };
  };
  
  /* --- Debounce: Delay execution --- */
  TU.debounce = (fn, delay = 100) => {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  };
  
  /* --- Expose to global --- */
  window.TU = TU;
})();
