const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://newmrbkjjtfzflfpkxud.supabase.co';
const supabaseKey = 'sb_secret_FdSoGJo5Derpaij73IoJxw_BaLgcbTe';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOldProject() {
  console.log('--- AUDIT ON OLD PROJECT (NEWMR...) ---');
  
  // Check whiteboard
  const { data: posts, error } = await supabase.from('whiteboard').select('id, author_id, content').limit(10);
  if (error) console.error('Error:', error.message);
  else {
    console.log(`Found ${posts.length} posts.`);
    const authorIds = [...new Set(posts.map(p => p.author_id))];
    for (const aid of authorIds) {
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', aid).single();
      if (prof) console.log(`Author ${aid} is ${prof.username}`);
      else console.log(`Author ${aid} is UNKNOWN`);
    }
  }

  // Check if current user ID 917... exists here
  const { data: currentProf } = await supabase.from('profiles').select('username').eq('id', '917bdd07-f196-4807-9415-e855809add2e').single();
  console.log('Current ID 917... in this DB:', currentProf ? `EXISTS (${currentProf.username})` : 'NOT FOUND');

  console.log('--- AUDIT COMPLETE ---');
}

checkOldProject();
