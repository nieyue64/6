const fs = require('fs');
const code = fs.readFileSync('/workspace/part6_performance_optimization.html', 'utf8');

// Replace remaining ArrayBuffer allocations in _packWire
let mCode = code.replace(/const out = new ArrayBuffer\((\d+)\),\n\s+dv = new DataView\(out\);/g, "const { out, dv } = this._getSharedBuffer($1);");
mCode = mCode.replace(/const out = new ArrayBuffer\(17\),\n\s+dv = new DataView\(out\);/g, "const { out, dv } = this._getSharedBuffer(17);");

fs.writeFileSync('/workspace/part6_performance_optimization.html', mCode);
console.log("Replaced ArrayBuffers in _packWire");
