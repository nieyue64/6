const fs = require('fs');
let code = fs.readFileSync('/workspace/part6_performance_optimization.html', 'utf8');

const workerBlobDef = `
  if (!ss._worker) {
    const blob = new Blob([\`
      self.onmessage = function(e) {
        try {
          const data = e.data;
          const diffMap = data.diffMap;
          const w = data.w;
          
          if (diffMap) {
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
            data.payload.diffs = { fmt: "rle1", w: w, data: out };
          }
          
          const ser = JSON.stringify(data.payload);
          
          let compressed = ser;
          if (ser && ser.length >= 100) {
            const result = [];
            let idx = 0;
            while (idx < ser.length) {
              let count = 1;
              while (idx + count < ser.length && ser[idx] === ser[idx + count] && count < 127) count++;
              if (count > 3) {
                result.push("\\\\0" + String.fromCharCode(count) + ser[idx]);
                idx += count;
              } else {
                result.push(ser[idx]);
                idx++;
              }
            }
            compressed = "\\\\x01" + result.join("");
          }
          
          self.postMessage({ success: true, serLength: ser.length, compressed: compressed });
        } catch(err) {
          self.postMessage({ success: false, err: String(err) });
        }
      };
    \`], { type: 'application/javascript' });
    ss._worker = new Worker(URL.createObjectURL(blob));
  }
`;

const oldSaveImpl = `    const payloadFull = buildFullPayload(ss);
    let ser = "";
    try {
      ser = jstringify(payloadFull);
    } catch {
      window.GameEvents && window.GameEvents.emit && window.GameEvents.emit("ui:toast", "⚠️ 存档序列化失败", 2600);
      return;
    }

    if (isAuto && ser.length > 4194304) {
      enterDegraded(ss, "payloadTooLarge");
      return _saveImpl(ss, reason);
    }

    const w = await writeSave(KEY_FULL, payloadFull, { preferIDB: false });`;

const newSaveImpl = `    const payloadFull = buildFullPayload(ss);
    delete payloadFull.diffs;

    ${workerBlobDef}
    
    const workerResult = await new Promise(resolve => {
      const timeout = setTimeout(() => resolve({ success: false, err: "Worker timeout" }), 15000);
      ss._worker.onmessage = e => {
        clearTimeout(timeout);
        resolve(e.data);
      };
      ss._worker.postMessage({
        payload: payloadFull,
        diffMap: ss.diff,
        w: world.w
      });
    });

    if (!workerResult.success) {
      window.GameEvents && window.GameEvents.emit && window.GameEvents.emit("ui:toast", "⚠️ 存档序列化失败", 2600);
      return;
    }

    if (isAuto && workerResult.serLength > 4194304) {
      enterDegraded(ss, "payloadTooLarge");
      return _saveImpl(ss, reason);
    }

    // Pass the compressed string directly to writeSave using a special option
    const w = await writeSave(KEY_FULL, workerResult.compressed, { preferIDB: false, preCompressed: true });`;

code = code.replace(oldSaveImpl, newSaveImpl);

const oldWriteSave = `    if (!preferIDB && !o.skipLS) {
      try {
        const ser = jstringify(payload);
        const out = compress(ser);
        storage && storage.set(key, out);
        lsOk = true;`;

const newWriteSave = `    if (!preferIDB && !o.skipLS) {
      try {
        const out = o.preCompressed ? payload : compress(jstringify(payload));
        storage && storage.set(key, out);
        lsOk = true;`;

code = code.replace(oldWriteSave, newWriteSave);

fs.writeFileSync('/workspace/part6_performance_optimization.html', code);
console.log("Patched SaveSystem to use Web Worker!");
