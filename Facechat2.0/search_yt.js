const https = require('https');

async function searchYoutube(query) {
  return new Promise((resolve, reject) => {
    https.get('https://www.youtube.com/results?search_query=' + encodeURIComponent(query), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const matches = [...data.matchAll(/"videoId":"([^"]{11})"/g)];
        const ids = [...new Set(matches.map(m => m[1]))].slice(0, 15);
        resolve(ids);
      });
    }).on('error', reject);
  });
}

async function testId(id) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.youtube.com',
      port: 443,
      path: '/watch?v=' + id,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };
    const req = https.request(options, (res) => {
      let text = '';
      res.on('data', chunk => text += chunk);
      res.on('end', () => {
        if (text.includes('"status":"UNPLAYABLE"') || text.includes('"status":"ERROR"')) {
          resolve(false);
        } else {
          resolve(true); 
        }
      });
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

const queries = [
  "Spongebob Tomfoolery 1 hour",
  "Spongebob Tomfoolery music",
  "Spongebob Trap Remix Tomfoolery"
];

async function run() {
  for (const q of queries) {
    console.log('Searching for: ' + q);
    const ids = await searchYoutube(q);
    for (const id of ids) {
      const ok = await testId(id);
      if (ok) {
        console.log(`  [OK] ${q} -> ${id}`);
        return; // exit early if we find one
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

run();
