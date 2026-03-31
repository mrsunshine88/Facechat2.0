const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const env = dotenv.parse(fs.readFileSync('.env.local'));
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testDelete() {
  const username = 'Coolkatt99';
  const { data: user } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  
  if (!user) {
    console.log(`Hittade inte ${username} i profiles.`);
    return;
  }

  console.log(`Försöker radera ${username} (ID: ${user.id})...`);

  // Vi raderar profil-raden direkt för att se om det finns en Foreign Key som blockerar
  const { error } = await supabase.from('profiles').delete().eq('id', user.id);

  if (error) {
    console.log('FEL VID RADERING:');
    console.log(JSON.stringify(error, null, 2));
  } else {
    console.log('Radering lyckades nu! (Märkligt att det inte gick i UI:t)');
  }
}

testDelete();
