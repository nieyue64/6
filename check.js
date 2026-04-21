const fs = require('fs');
const content = fs.readFileSync('/workspace/part3_game_single (6) (9)(9)(2)(6) (36) (14).html', 'utf-8');

// 简单的 script 提取并验证语法
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(content)) !== null) {
  count++;
  try {
    new Function(match[1]);
    console.log(`Script ${count} syntax OK.`);
  } catch (e) {
    console.error(`Script ${count} syntax ERROR:`, e.message);
    process.exit(1);
  }
}
console.log('All scripts passed syntax check.');
