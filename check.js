const fs = require('fs');
const code = fs.readFileSync('/workspace/part3_game_single (6) (9)(9)(2)(6) (36).html', 'utf8');
const scriptMatches = code.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);
let error = false;
scriptMatches.forEach((m, i) => {
    const js = m.replace(/<script[\s\S]*?>|<\/script>/gi, '');
    try {
        new Function(js);
    } catch(e) {
        console.error(`Script ${i} syntax error:`, e);
        error = true;
    }
});
if (!error) console.log("All scripts passed syntax check.");
