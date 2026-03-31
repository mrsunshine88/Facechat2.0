const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://newmrbkjjtfzflfpkxud.supabase.co';
const supabaseKey = 'sb_secret_FdSoGJo5Derpaij73IoJxw_BaLgcbTe';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrphans() {
  console.log('--- DETAILED DATABASE AUDIT ---');
  
  // 1. Current Session Profile
  const sessionId = '917bdd07-f196-4807-9415-e855809add2e';
  const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', sessionId).single();
  console.log('\n[SESSION ID] profile:', sessionId);
  console.log('Username in DB for this ID:', currentProfile?.username || 'NOT FOUND');

  // 2. Whiteboard scan
  console.log('\n[WHITEBOARD SCAN]');
  const { data: posts, error } = await supabase.from('whiteboard').select('id, author_id, content').limit(20);
  
  if (error) {
    console.error('Error fetching posts:', error.message);
    return;
  }

  const authorIds = [...new Set(posts.map(p => p.author_id))];
  console.log('Unique author IDs found in recent posts:', authorIds);

  for (const aid of authorIds) {
    const { data: prof } = await supabase.from('profiles').select('username').eq('id', aid).single();
    if (prof) {
      console.log(`Author ID ${aid} is known as: ${prof.username}`);
    } else {
      const pCount = posts.filter(p => p.author_id === aid).length;
      console.log(`Author ID ${aid} is UNKNOWN (Orphaned). Post count (in sample): ${pCount}`);
      // Find if there is a profile with a similar username but different ID
      // Or search for the name the user EXPECTS to be there.
    }
  }

  // 3. Search profiles for username "Mrsunshine88" case-insensitive
  console.log('\n[PROFILE SEARCH] Searching for all usernames like Mrsunshine88...');
  const { data: allProfiles } = await supabase.from('profiles').select('id, username').ilike('username', 'Mrsunshine88');
  console.log('Profiles found with similar username:', JSON.stringify(allProfiles, null, 2));

  console.log('\n--- AUDIT COMPLETE ---');
}

checkOrphans();
