const testIds = ['3eP0r-e75S0', 'qONi6Y-XwOQ', '_M09uN_Iu9U', 'uEUx5sR6keg', '_qWb21Q2q8U', '3n6h4k31tEw', '2aJUnltwsqs', 'M9X5n0V80_E', 'xXk0MvA6EHE', 'gO8N3L_aERg', '2sQw1iA1zWc', 'h2-O1eS62-I', 'O0G_WmbmKHg'];
async function test(id) {
  try {
    const r = await fetch('https://www.youtube.com/watch?v=' + id);
    const text = await r.text();
    if (text.includes('"status":"UNPLAYABLE"') || text.includes('"status":"ERROR"')) {
      console.log('[BAD] ' + id);
    } else {
      console.log('[OK] ' + id);
    }
  } catch(e) {
    console.log('[ERR] ' + id);
  }
}
async function run() {
  for(let id of testIds) {
    await test(id);
    await new Promise(r=>setTimeout(r, 100));
  }
}
run();
