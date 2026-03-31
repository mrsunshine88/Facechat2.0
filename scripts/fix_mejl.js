const fs = require('fs');
let content = fs.readFileSync('app/krypin/page.tsx', 'utf8');

content = content.replace(
  /\{activeTab === 'Mejl' && \(\r?\n\s*<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '1\.5rem' \}\}>/,
  () => `{activeTab === 'Mejl' && (\n             <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }} className="krypin-inbox-wrapper">\n                {!isComposingNew && !selectedThreadUserId && (`
);

content = content.replace(
  /\+ Skriv Nytt Mejl<\/button>\r?\n\s*<\/div>\r?\n\s*\{isComposingNew && \(/g,
  () => `+ Skriv Nytt Mejl</button>\n                </div>\n                )}\n                \n                {isComposingNew && (`
);

fs.writeFileSync('app/krypin/page.tsx', content);
console.log("Done");
