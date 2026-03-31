const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://neamrbkjjtfzfifpksud.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYW1yYmtqanRmemZpZnBrc3VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE5NjY5OCwiZXhwIjoyMDg5NzcyNjk4fQ.-NLNLcIo3PjeGwbtUwYKuyHCIzUyiCmn1TVk2Ikm7xw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  console.log('--- NEAMR... TABLE SCAN ---');
  
  // We can query the information_schema via RPC if possible, 
  // or just try common table names.
  const tables = ['profiles', 'whiteboard', 'guestbook', 'private_messages', 'friends', 'notifications'];
  
  for (const t of tables) {
    const { data, count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) console.log(`Table ${t}: NOT FOUND or ERROR (${error.message})`);
    else console.log(`Table ${t}: FOUND, Row count: ${count}`);
  }

  console.log('\n--- AUDIT COMPLETE ---');
}

listTables();
