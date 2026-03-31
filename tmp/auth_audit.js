const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://neamrbkjjtfzfifpksud.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYW1yYmtqanRmemZpZnBrc3VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE5NjY5OCwiZXhwIjoyMDg5NzcyNjk4fQ.-NLNLcIo3PjeGwbtUwYKuyHCIzUyiCmn1TVk2Ikm7xw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuthUsers() {
  console.log('--- NEAMR... AUTH AUDIT ---');
  
  // List auth users
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error listing users:', error.message);
  } else {
    console.log(`Found ${users.length} auth users.`);
    for (const u of users) {
      console.log(`- ID ${u.id} (${u.email})`);
    }
  }

  // Check profiles table again
  const { data: profs } = await supabase.from('profiles').select('id, username, auth_email');
  console.log('\nProfiles table contents:', JSON.stringify(profs, null, 2));

  // Check whiteboard again
  const { data: posts } = await supabase.from('whiteboard').select('count', { count: 'exact' });
  console.log('\nWhiteboard post count:', posts?.[0]?.count || 0);

  console.log('\n--- AUDIT COMPLETE ---');
}

checkAuthUsers();
