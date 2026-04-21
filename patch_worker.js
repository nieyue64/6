const fs = require('fs');
const code = fs.readFileSync('/workspace/part6_performance_optimization.html', 'utf8');

const targetCode1 = `
      case 'tileWrite': {
        if (!tiles) return;
        const x = m.x | 0;
        const y = m.y | 0;
        if (x < 0 || y < 0 || x >= W || y >= H) return;

        const i = idx(x, y);
        const newId = m.id | 0;
        const oldId = tiles[i];
        tiles[i] = newId;

        const mv = m.mv | 0;
        if (mv > 0 && mv !== (machineVersion | 0)) {
          machineVersion = mv;
          invalidateLogicCache(machineVersion);
        } else if (isLogicTopologyTile(oldId) || isLogicTopologyTile(newId)) {
          invalidateLogicCache(0);
        }

        if (newId === WATER) {
          water[i] = MAX;
          scheduleWaterAround(x, y);
        } else if (oldId === WATER && newId !== WATER) {
          water[i] = 0;
          scheduleWaterAround(x, y);
        }

        scheduleLogicAround(x, y);
        break;
      }
`;

const targetCode2 = `
            case 'tileWrite': {
              if (!tiles) return;
              const x = m.x | 0;
              const y = m.y | 0;
              if (x < 0 || y < 0 || x >= W || y >= H) return;

              const i = idx(x, y);
              const newId = m.id | 0;
              const oldId = tiles[i];
              tiles[i] = newId;

              const mv = m.mv | 0;
              if (mv > 0 && mv !== (machineVersion | 0)) {
                machineVersion = mv;
                invalidateLogicCache(machineVersion);
                invalidatePumpCache();
              } else {
                if (isLogicTopologyTile(oldId) || isLogicTopologyTile(newId)) {
                  invalidateLogicCache(0);
                }
                if (isConductor(oldId) || isConductor(newId)) {
                  invalidatePumpCache();
                }
              }

              if (newId === WATER) {
                water[i] = MAX;
                scheduleWaterAround(x, y);
              } else if (oldId === WATER && newId !== WATER) {
                water[i] = 0;
                scheduleWaterAround(x, y);
              }

              scheduleLogicAround(x, y);
              break;
            }
`;

const replacement1 = targetCode1 + `
      case 'tileWriteBatch': {
        if (!tiles || !m.buf) return;
        const arr = new Int32Array(m.buf);
        for (let j = 0; j < arr.length; j += 4) {
          const x = arr[j] | 0;
          const y = arr[j+1] | 0;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;

          const i = idx(x, y);
          const newId = arr[j+2] | 0;
          const oldId = tiles[i];
          tiles[i] = newId;

          const mv = arr[j+3] | 0;
          if (mv > 0 && mv !== (machineVersion | 0)) {
            machineVersion = mv;
            invalidateLogicCache(machineVersion);
          } else if (isLogicTopologyTile(oldId) || isLogicTopologyTile(newId)) {
            invalidateLogicCache(0);
          }

          if (newId === WATER) {
            water[i] = MAX;
            scheduleWaterAround(x, y);
          } else if (oldId === WATER && newId !== WATER) {
            water[i] = 0;
            scheduleWaterAround(x, y);
          }

          scheduleLogicAround(x, y);
        }
        break;
      }
`;

const replacement2 = targetCode2 + `
            case 'tileWriteBatch': {
              if (!tiles || !m.buf) return;
              const arr = new Int32Array(m.buf);
              for (let j = 0; j < arr.length; j += 4) {
                const x = arr[j] | 0;
                const y = arr[j+1] | 0;
                if (x < 0 || y < 0 || x >= W || y >= H) continue;

                const i = idx(x, y);
                const newId = arr[j+2] | 0;
                const oldId = tiles[i];
                tiles[i] = newId;

                const mv = arr[j+3] | 0;
                if (mv > 0 && mv !== (machineVersion | 0)) {
                  machineVersion = mv;
                  invalidateLogicCache(machineVersion);
                  invalidatePumpCache();
                } else {
                  if (isLogicTopologyTile(oldId) || isLogicTopologyTile(newId)) {
                    invalidateLogicCache(0);
                  }
                  if (isConductor(oldId) || isConductor(newId)) {
                    invalidatePumpCache();
                  }
                }

                if (newId === WATER) {
                  water[i] = MAX;
                  scheduleWaterAround(x, y);
                } else if (oldId === WATER && newId !== WATER) {
                  water[i] = 0;
                  scheduleWaterAround(x, y);
                }

                scheduleLogicAround(x, y);
              }
              break;
            }
`;

// These strings are inside JS string literals with \n
const escapeStr = s => s.replace(/\n/g, '\\n').replace(/'/g, "\\'");

let modified = code;
modified = modified.replace(escapeStr(targetCode1), escapeStr(replacement1));
modified = modified.replace(escapeStr(targetCode2), escapeStr(replacement2));

if (modified === code) {
  console.log("Failed to replace");
} else {
  fs.writeFileSync('/workspace/part6_performance_optimization.html', modified);
  console.log("Successfully patched worker string");
}
