const fs = require('fs');
const { execSync } = require('child_process');
const content = fs.readFileSync('/workspace/part3_game_single (6) (9)(9)(2)(6).html', 'utf-8');
const scriptRegex = /<script.*?>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(content)) !== null) {
  const scriptContent = match[1];
  const filename = `temp_script_${count}.js`;
  fs.writeFileSync(filename, scriptContent);
  try {
    execSync(`node -c ${filename}`);
  } catch (e) {
    console.error(`Syntax error in script block ${count} (around line ${content.substring(0, match.index).split('\n').length}):`);
    console.error(e.stderr.toString());
  }
  fs.unlinkSync(filename);
  count++;
}
console.log(`Checked ${count} script blocks.`);
