import fs from 'fs';

const content = fs.readFileSync('./app/krypin/songs.ts', 'utf-8');
const regex = /name:\s*'([^']+)',\s*videoId:\s*'([^']+)'/g;
let match;
const songs = [];
while ((match = regex.exec(content)) !== null) {
  if (match[2] && match[2].length > 0) {
     songs.push({name: match[1], id: match[2]});
  }
}

async function checkId(song) {
  try {
    const res = await fetch('https://www.youtube.com/watch?v=' + song.id);
    const html = await res.text();
    
    // Yt blocks embedding via playabilityStatus
    if (html.includes('"status":"UNPLAYABLE"')) {
        console.log('[BROKEN - UNPLAYABLE] ' + song.name + ' (' + song.id + ')');
    } else if (html.includes('"status":"ERROR"')) {
        console.log('[BROKEN - ERROR] ' + song.name + ' (' + song.id + ')');
    } else if (html.includes('Embedding disabled') || html.includes('allow_embed":"0"')) {
        console.log('[BROKEN - NO EMBED] ' + song.name + ' (' + song.id + ')');
    } else {
        console.log('[OK] ' + song.name + ' (' + song.id + ')');
    }
  } catch (e) {
    console.log('[FETCH ERROR] ' + song.id);
  }
}

async function run() {
  console.log('Testing ' + songs.length + ' songs...');
  for (const song of songs) {
    await checkId(song);
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('Test complete!');
}

run();
