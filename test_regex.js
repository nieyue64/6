const fs = require('fs');
const code = fs.readFileSync('/workspace/part6_performance_optimization.html', 'utf8');

const regex = /case 'tileWrite': \{[\s\S]*?break;\\n      \}/g;
const matches = code.match(regex);
console.log(matches ? matches.length + " matches found" : "No matches");
if(matches) {
    let mCode = code;
    for (let m of matches) {
        const replacement = m + "\\n\\n" + m.replace(/tileWrite/, 'tileWriteBatch').replace(/const x = m\.x \| 0;/, 'if (!m.buf) return;\\n        const arr = new Int32Array(m.buf);\\n        for (let j = 0; j < arr.length; j += 4) {\\n          const x = arr[j] | 0;').replace(/const y = m\.y \| 0;/, 'const y = arr[j+1] | 0;').replace(/if \(x < 0 \|\| y < 0 \|\| x >= W \|\| y >= H\) return;/, 'if (x < 0 || y < 0 || x >= W || y >= H) continue;').replace(/const newId = m\.id \| 0;/, 'const newId = arr[j+2] | 0;').replace(/const mv = m\.mv \| 0;/, 'const mv = arr[j+3] | 0;').replace(/break;\\n      \}/, '}\\n        break;\\n      }');
        mCode = mCode.replace(m, replacement);
    }
    if(mCode !== code) {
        fs.writeFileSync('/workspace/part6_performance_optimization.html', mCode);
        console.log("Successfully replaced with regex!");
    }
}
