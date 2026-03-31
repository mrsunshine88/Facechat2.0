const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://newmrbkjjtfzflfpkxud.supabase.co';
const supabaseKey = 'sb_secret_FdSoGJo5Derpaij73IoJxw_BaLgcbTe';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findOldId() {
  console.log('--- FINDING OLD ID IN NEWMRB... ---');
  
  // Find profiles named Mrsunshine88
  const { data: profs } = await supabase.from('profiles').select('id, username, auth_email').ilike('username', 'Mrsunshine88');
  console.log('Profiles in NEWMRB found:', JSON.stringify(profs, null, 2));

  // Find most frequent author_id in whiteboard
  const { data: posts } = await supabase.from('whiteboard').select('author_id');
  const counts = {};
  posts?.forEach(p => { counts[p.author_id] = (counts[p.author_id] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  
  console.log('\nTop authors in whiteboard (NEWMRB):');
  for (const [id, count] of sorted.slice(0, 5)) {
     const { data: prof } = await supabase.from('profiles').select('username').eq('id', id).single();
     console.log(`- ID ${id}: ${count} posts (${prof?.username || 'UNKNOWN'})`);
  }

  console.log('\n--- AUDIT COMPLETE ---');
}

findOldId();
