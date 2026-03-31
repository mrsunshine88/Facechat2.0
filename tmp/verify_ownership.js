const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://newmrbkjjtfzflfpkxud.supabase.co';
const supabaseKey = 'sb_secret_FdSoGJo5Derpaij73IoJxw_BaLgcbTe';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findDataOwner() {
  console.log('--- FINDING OWNER IN NEWMRB... ---');
  
  // Find all authors in whiteboard
  const { data: posts } = await supabase.from('whiteboard').select('author_id, content').limit(50);
  
  if (posts && posts.length > 0) {
    const counts = {};
    posts.forEach(p => counts[p.author_id] = (counts[p.author_id] || 0) + 1);
    
    for (const [aid, count] of Object.entries(counts)) {
       const { data: prof } = await supabase.from('profiles').select('username').eq('id', aid).single();
       console.log(`ID ${aid} has ${count} posts. Username: ${prof?.username || 'UNKNOWN'}`);
       
       // Peek at content to see if it looks like the user's
       const p = posts.find(x => x.author_id === aid);
       console.log(`  Sample: "${p.content.substring(0, 50)}..."`);
    }
  }

  // Check if there is ANY profile with username 'Mrsunshine88'
  const { data: m88 } = await supabase.from('profiles').select('*').ilike('username', 'Mrsunshine88');
  console.log('\nMrsunshine88 profiles in NEWMRB:', JSON.stringify(m88, null, 2));

  console.log('\n--- AUDIT COMPLETE ---');
}

findDataOwner();
