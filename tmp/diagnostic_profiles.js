const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://newmrbkjjtfzflfpkxud.supabase.co';
const supabaseKey = 'sb_secret_FdSoGJo5Derpaij73IoJxw_BaLgcbTe';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
  console.log('--- DIAGNOSTIC REPORT ---');
  
  // 1. Current ID check
  const currentId = '917bdd07-f196-4807-9415-e855809add2e';
  console.log('Checking current ID:', currentId);
  const { data: currentProfile, error: err1 } = await supabase.from('profiles').select('*').eq('id', currentId).single();
  if (err1) console.error('Error fetching current profile:', err1.message);
  else console.log('Current Profile:', JSON.stringify(currentProfile, null, 2));

  // 2. Check for duplicate usernames
  if (currentProfile?.username) {
    console.log('\nChecking for other profiles with username:', currentProfile.username);
    const { data: otherProfiles, error: err2 } = await supabase.from('profiles').select('*').eq('username', currentProfile.username);
    if (err2) console.error('Error fetching other profiles:', err2.message);
    else console.log('Found Profiles with same username:', otherProfiles.length, '(IDs:', otherProfiles.map(p => p.id).join(', '), ')');
  }

  // 3. Check for root email
  console.log('\nChecking for profiles with email apersson508@gmail.com');
  const { data: emailProfiles, error: err3 } = await supabase.from('profiles').select('*').eq('auth_email', 'apersson508@gmail.com');
  if (err3) console.error('Error fetching email profiles:', err3.message);
  else console.log('Found Profiles with root email:', emailProfiles.length, '(IDs:', emailProfiles.map(p => p.id).join(', '), ')');

  // 4. Whiteboard consistency check
  console.log('\nChecking whiteboard post count...');
  const { count, error: err4 } = await supabase.from('whiteboard').select('*', { count: 'exact', head: true });
  console.log('Total whiteboard posts:', count);

  console.log('\nChecking unique author_ids in whiteboard...');
  const { data: authors, error: err5 } = await supabase.from('whiteboard').select('author_id');
  const uniqueAuthors = [...new Set(authors?.map(a => a.author_id) || [])];
  console.log('Unique authors in whiteboard:', uniqueAuthors.length);

  console.log('\nChecking if authors exist in profiles...');
  for (const aid of uniqueAuthors) {
    const { data } = await supabase.from('profiles').select('username').eq('id', aid).single();
    if (!data) {
       const postCount = authors.filter(a => a.author_id === aid).length;
       console.log(`ORPHAN AUTHOR DETECTED: ID ${aid} has ${postCount} posts but NO profile.`);
    }
  }

  console.log('\n--- END OF REPORT ---');
}

diagnostic();
