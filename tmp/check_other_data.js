const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://neamrbkjjtfzfifpksud.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYW1yYmtqanRmemZpZnBrc3VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE5NjY5OCwiZXhwIjoyMDg5NzcyNjk4fQ.-NLNLcIo3PjeGwbtUwYKuyHCIzUyiCmn1TVk2Ikm7xw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOtherData() {
  console.log('--- SCANNING NEAMR... FOR OTHER DATA ---');
  const tables = ['guestbook', 'private_messages', 'friends'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (!error) console.log(`${t}: ${count} rows`);
    else console.log(`${t}: NOT FOUND or ERROR (${error.message})`);
  }
}

checkOtherData();
