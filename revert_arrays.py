import re

with open("/workspace/part3_game_single (6) (9)(9)(2)(6) (36).html", "r") as f:
    content = f.read()

content = content.replace(
    'q = game._pumpQ = game._pumpQ || [];',
    '(!q || 24e3 > q.length) && (q = game._pumpQ = new Int32Array(24e3));'
)
content = content.replace(
    'out = game._pumpOut = game._pumpOut || [];',
    '(!out || 2048 > out.length) && (out = game._pumpOut = new Int32Array(2048));'
)

content = content.replace(
    'for (vis[sx + sy * w | 0] = curStamp, q.length = 0, out.length = 0, q.push(sx, sy), qLen = 2, compPumpIn.length = 0; qLen > qHead && 24e3 > nodes;) {',
    'for (vis[sx + sy * w | 0] = curStamp, q[qLen++] = (65535 & sx) << 16 | 65535 & sy, compPumpIn.length = 0; qLen > qHead && 24e3 > nodes;) {'
)

content = content.replace(
    'const cx = q[qHead++], cy = q[qHead++];',
    'const v = 0 | q[qHead++],\n                    cx = v >>> 16 & 65535,\n                    cy = 65535 & v;'
)

content = content.replace(
    'id === IDS.PUMP_OUT ? (out.push(cx, cy), outLen += 2) : id === IDS.PUMP_IN && compPumpIn.push((cx << 16) | cy);',
    'id === IDS.PUMP_OUT ? outLen < out.length && (out[outLen++] = (65535 & cx) << 16 | 65535 & cy) : id === IDS.PUMP_IN && compPumpIn.push(v);'
)

content = content.replace(
    '(q.push(cx - 1, cy), qLen += 2);',
    'qLen < q.length && (q[qLen++] = (65535 & (cx - 1)) << 16 | 65535 & cy);'
)
content = content.replace(
    '(q.push(cx + 1, cy), qLen += 2);',
    'qLen < q.length && (q[qLen++] = (65535 & (cx + 1)) << 16 | 65535 & cy);'
)
content = content.replace(
    '(q.push(cx, cy - 1), qLen += 2);',
    'qLen < q.length && (q[qLen++] = (65535 & cx) << 16 | 65535 & (cy - 1));'
)
content = content.replace(
    '(q.push(cx, cy + 1), qLen += 2);',
    'qLen < q.length && (q[qLen++] = (65535 & cx) << 16 | 65535 & (cy + 1));'
)

content = content.replace(
    'out: outLen ? out.slice(0) : null',
    'out: outLen ? out.slice(0, outLen) : null'
)

with open("/workspace/part3_game_single (6) (9)(9)(2)(6) (36).html", "w") as f:
    f.write(content)

print("Arrays revert successful!")
