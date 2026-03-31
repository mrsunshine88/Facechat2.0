const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://neamrbkjjtfzfifpksud.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYW1yYmtqanRmemZpZnBrc3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTY2OTgsImV4cCI6MjA4OTc3MjY5OH0.fNiFe2p3a4FZ6MkqpX1oH0yfVgoymKAz-iPYjsneX1g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function schemaAudit() {
  console.log('--- SCHEMA AUDIT ON NEAMR... ---');

  // Check tables and columns
  const tables = ['profiles', 'whiteboard', 'guestbook', 'friends', 'notifications'];
  for (const t of tables) {
     const { data, error } = await supabase.from(t).select('*').limit(1);
     if (error) {
       console.log(`Table ${t}: Missing or Access Denied (${error.message})`);
     } else {
       const cols = Object.keys(data[0] || {});
       console.log(`Table ${t}: EXISTS, Columns: ${cols.join(', ')}`);
     }
  }

  // Check for some critical columns in profiles
  const { data: profCols, error: errC } = await supabase.from('profiles').select('is_admin, is_root, auth_email, session_key').limit(1);
  if (errC) console.log('Critical profile columns check failed:', errC.message);
  else console.log('Critical Profile columns: FOUND (is_admin, is_root, auth_email, session_key)');

  console.log('\n--- AUDIT COMPLETE ---');
}

schemaAudit();
