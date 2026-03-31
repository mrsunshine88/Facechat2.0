const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://neamrbkjjtfzfifpksud.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYW1yYmtqanRmemZpZnBrc3VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE5NjY5OCwiZXhwIjoyMDg5NzcyNjk4fQ.-NLNLcIo3PjeGwbtUwYKuyHCIzUyiCmn1TVk2Ikm7xw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalAudit() {
  console.log('--- FINAL AUDIT ON NEAMR... PROJECT ---');
  
  // 1. Current Session Profile (Check if it exists in THIS DB)
  const sessionId = '917bdd07-f196-4807-9415-e855809add2e';
  const { data: currentProfile, error: err1 } = await supabase.from('profiles').select('*').eq('id', sessionId).single();
  
  if (err1) {
    console.error('Error fetching profile 917...:', err1.message);
  } else {
    console.log('Profile 917... found! Username:', currentProfile.username);
  }

  // 2. Whiteboard scan (Check if posts are linked to this ID or another)
  const { data: posts, error: err2 } = await supabase.from('whiteboard').select('id, author_id, content').limit(20);
  
  if (err2) {
    console.error('Error fetching whiteboard posts:', err2.message);
  } else if (posts) {
    console.log(`Found ${posts.length} posts on Whiteboard.`);
    const authorIds = [...new Set(posts.map(p => p.author_id))];
    
    for (const aid of authorIds) {
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', aid).single();
      const pCount = posts.filter(p => p.author_id === aid).length;
      if (prof) {
        console.log(`Author ${aid} (${prof.username}) has ${pCount} posts in sample.`);
      } else {
        console.log(`ORPHAN AUTHOR DETECTED: ID ${aid} has ${pCount} posts but NO profile row.`);
      }
    }
  }

  // 3. Duplicate Username Search
  const { data: allMrsunshine } = await supabase.from('profiles').select('id, username').ilike('username', 'Mrsunshine88');
  console.log('\nAll profiles named Mrsunshine88:', JSON.stringify(allMrsunshine, null, 2));

  console.log('\n--- AUDIT COMPLETE ---');
}

finalAudit();
