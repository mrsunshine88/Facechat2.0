const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manuell env-laddning
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim().replace(/^"|"$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function nuclearDiag() {
  const target = 'Coolkatt99';
  console.log(`🔍 Letar efter ${target}...`);
  
  const { data: profile } = await supabase.from('profiles').select('id').eq('username', target).maybeSingle();
  
  if (!profile) {
    console.log(`❌ Hittade inte ${target} i profiles.`);
    return;
  }
  
  const uid = profile.id;
  console.log(`✅ Hittade UID: ${uid}`);

  const tables = [
    'forum_posts', 'forum_threads', 'chat_messages', 'whiteboard', 'whiteboard_comments',
    'guestbook', 'private_messages', 'friendships', 'notifications', 'user_blocks',
    'snake_scores', 'user_secrets', 'reports', 'support_tickets', 'whiteboard_likes',
    'push_subscriptions', 'admin_logs'
  ];

  for (const t of tables) {
    // Vi försöker radera profil-raden direkt. Om det skiter sig så säger DB vilken tabell som refererar den.
    const { error } = await supabase.from('profiles').delete().eq('id', uid);
    
    if (error) {
      console.log(`🚨 BLOCKERAD! Felmeddelande: ${error.message}`);
      if (error.details) console.log(`   Detaljer: ${error.details}`);
      // Vi försöker nu gissa kolumnen utifrån felmeddelandet
      return;
    } else {
      console.log(`🎉 LYCKADES! ${target} raderades nu via skriptet.`);
      return;
    }
  }
}

nuclearDiag();
