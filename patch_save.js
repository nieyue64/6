const fs = require('fs');
const code = fs.readFileSync('/workspace/part6_performance_optimization.html', 'utf8');

const savePatchRegex = /SaveSystem\.prototype\.save = function \(reason = "manual"\) \{([\s\S]*?)this\._disabled = !0, ToastRef && ToastRef\.show && ToastRef\.show\("⚠️ 存档失败：空间不足，已停用自动保存", 2600\)\);\n                \}\n              \}/;

const workerCode = `
const _workerBlob = new Blob([\`
  self.onmessage = function(e) {
    try {
      const data = e.data;
      const diffMap = data.diffMap;
      const w = data.w;
      
      const entries = [];
      for (const [k, id] of diffMap.entries()) {
        let x, y;
        if (typeof k === "number") {
          x = k >> 16;
          y = 65535 & k;
        } else {
          const parts = String(k).split(",");
          x = 0 | +parts[0];
          y = 0 | +parts[1];
        }
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(id)) {
          entries.push([y * w + x, id]);
        }
      }
      entries.sort((a, b) => a[0] - b[0]);
      
      const out = [];
      let i = 0;
      while (i < entries.length) {
        const start = entries[i][0];
        const id = entries[i][1];
        let len = 1;
        while (i + len < entries.length && entries[i + len][1] === id && entries[i + len][0] === start + len) {
          len++;
        }
        out.push(id.toString(36) + "_" + start.toString(36) + "_" + len.toString(36));
        i += len;
      }
      
      data.payload.diffs = {
        fmt: "rle1",
        w: w,
        data: out
      };
      
      const serialized = JSON.stringify(data.payload);
      
      // compress
      let compressed = serialized;
      if (serialized && serialized.length >= 100) {
        const result = [];
        let i = 0;
        while (i < serialized.length) {
          let count = 1;
          while (i + count < serialized.length && serialized[i] === serialized[i + count] && count < 127) count++;
          if (count > 3) {
            result.push("\\0" + String.fromCharCode(count) + serialized[i]);
            i += count;
          } else {
            result.push(serialized[i]);
            i++;
          }
        }
        compressed = "\\x01" + result.join("");
      }
      
      self.postMessage({ success: true, payload: data.payload, compressed: compressed, reason: data.reason });
    } catch(err) {
      self.postMessage({ success: false, err: String(err), reason: e.data ? e.data.reason : 'unknown' });
    }
  };
\`], { type: 'application/javascript' });
`;

const newSave = `SaveSystem.prototype.save = function (reason = "manual") {
                if (!this._disabled) {
                  const g = window.AppServices.get("game"),
                    world = window.AppServices.get("world"),
                    player = window.AppServices.get("player");
                  if (g && world && player && Number.isFinite(player.x) && Number.isFinite(player.y)) {
                    if (this.diff && this.diff.size > 5e4 && "autosave" === reason) return void (this._autosaveDisabled || (this._autosaveDisabled = !0, ToastRef && ToastRef.show && ToastRef.show("⚠️ 改动过多：自动保存已停用（可手动保存/清理存档）", 2800)));
                    var payload = {
                      v: 1,
                      ts: Date.now(),
                      seed: Number.isFinite(g.seed) ? g.seed : Number.isFinite(this.seed) ? this.seed : Date.now(),
                      timeOfDay: Utils.clamp(g.timeOfDay || .35, 0, 1),
                      player: {
                        x: player.x,
                        y: player.y,
                        health: Utils.clamp(player.health || 100, 0, 1e3),
                        mana: Utils.clamp(player.mana || 100, 0, 1e3),
                        inventory: Array.isArray(player.inventory) ? player.inventory.slice(0, 36) : [],
                        selectedSlot: Utils.clamp(player.selectedSlot || 0, 0, 35)
                      },
                      w: world.w,
                      h: world.h
                    };

                    if (!this._worker) {
                      ${workerCode}
                      this._worker = new Worker(URL.createObjectURL(_workerBlob));
                      this._worker.onmessage = (e) => {
                        const res = e.data;
                        if (!res.success) {
                          console.warn("Save Worker Error:", res.err);
                          return;
                        }
                        const out = res.compressed;
                        let lsOk = !1;
                        if (!this._lsFailed) try {
                          window.AppServices.get("storage").set(SaveSystem.KEY, out);
                          lsOk = !0;
                        } catch (err) {
                          this._lsFailed = !0;
                          lsOk = !1;
                        }
                        if (!FLAGS.disableIDBSave) try {
                          idb.set(SaveSystem.KEY, res.payload).then(function (ok) {
                            ok && !lsOk && ToastRef && ToastRef.show && ("manual" === res.reason && ToastRef.show("💾 已保存（IndexedDB）"), "autosave" === res.reason && ToastRef.show("✅ 自动保存（IndexedDB）", 1100));
                          }).catch(_ => {});
                        } catch(err){console.warn('[Catch]',err);}
                        if (lsOk) try {
                          ToastRef && ToastRef.show && ("manual" === res.reason && ToastRef.show("💾 已保存"), "autosave" === res.reason && ToastRef.show("✅ 自动保存", 1100));
                        } catch(err){console.warn('[Catch]',err);} else FLAGS.disableIDBSave && (this._disabled = !0, ToastRef && ToastRef.show && ToastRef.show("⚠️ 存档失败：空间不足，已停用自动保存", 2600));
                      };
                    }
                    
                    this._worker.postMessage({
                      payload: payload,
                      diffMap: this.diff,
                      w: world.w,
                      reason: reason
                    });
                  }
                }
              }`;

const replaced = code.replace(savePatchRegex, newSave);
if (replaced !== code) {
  fs.writeFileSync('/workspace/part6_performance_optimization.html', replaced);
  console.log("Replaced save system with worker!");
} else {
  console.log("Failed to replace save system!");
}
