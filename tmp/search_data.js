const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://neamrbkjjtfzfifpksud.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYW1yYmtqanRmemZpZnBrc3VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE5NjY5OCwiZXhwIjoyMDg5NzcyNjk4fQ.-NLNLcIo3PjeGwbtUwYKuyHCIzUyiCmn1TVk2Ikm7xw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findData() {
  console.log('--- SCANNING NEAMR... FOR ANY DATA ---');
  
  const { data: tables, error } = await supabase.rpc('get_table_names'); // Might not work if RPC doesn't exist
  
  const common = ['profiles', 'whiteboard', 'whiteboard_posts', 'forum', 'posts', 'messages', 'chat', 'guestbook'];
  
  for (const t of common) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (!error) console.log(`${t}: ${count} rows`);
  }

  // Check if they are using 'forum' table
  const { count: forumCount } = await supabase.from('forum').select('*', { count: 'exact', head: true });
  console.log('Forum count:', forumCount);

  console.log('--- SCAN COMPLETE ---');
}

findData();
