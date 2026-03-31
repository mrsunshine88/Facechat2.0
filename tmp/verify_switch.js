const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function verifySwitch() {
  const envRaw = fs.readFileSync('.env', 'utf8');
  const url = envRaw.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
  const key = envRaw.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];
  
  if (!url || !key) {
    console.error('Failed to read .env values.');
    return;
  }

  const supabase = createClient(url.trim(), key.trim());
  console.log(`Checking connection to: ${url}`);
  
  const sessionId = '917bdd07-f196-4807-9415-e855809add2e';
  const { data, error } = await supabase.from('profiles').select('username').eq('id', sessionId).single();
  
  if (error) {
    console.error(`Verification FAILED: ${error.message}`);
  } else {
    console.log(`Verification SUCCESS: Found profile ${data.username} for ID ${sessionId}`);
  }
}

verifySwitch();
