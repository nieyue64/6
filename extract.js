const fs = require('fs');
const html = fs.readFileSync('part6_performance_optimization.html', 'utf8');
const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
if (match) {
  fs.writeFileSync('test.js', match[1]);
  console.log('Extracted to test.js');
}
