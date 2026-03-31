const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const env = dotenv.parse(fs.readFileSync('.env.local'));
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const targetUsername = 'Coolkatt99';

async function diag() {
  const { data: user } = await supabase.from('profiles').select('*').eq('username', targetUsername).maybeSingle();
  if (!user) {
    console.log(`Ingen profil hittades för ${targetUsername}. (Den kanske raderades ändå?)`);
    return;
  }
  const userId = user.id;
  console.log(`Diagnostiserar radering för ${targetUsername} (ID: ${userId})`);

  // Lista på ALLA möjliga tabeller som kan ha referenser
  const tables = [
    'profiles', 'forbidden_words', 'blocked_ips', 'notifications', 'support_tickets', 
    'forum_posts', 'forum_threads', 'chat_messages', 'whiteboard', 'whiteboard_comments', 
    'guestbook', 'private_messages', 'friendships', 'user_blocks', 'snake_scores', 
    'user_secrets', 'reports', 'whiteboard_likes', 'push_subscriptions', 'chat_rooms',
    'search_history', 'arcade_games', 'arcade_scores', 'admin_logs', 'forum_likes',
    'comment_likes', 'user_ips', 'user_badges', 'friend_requests'
  ];

  for (const table of tables) {
    try {
       // Vi letar efter rader som har detta userId i NÅGON kolumn
       const { data, error } = await supabase.rpc('get_table_columns', { table_name: table }); 
       // Om rpc saknas, kör vi bara en brute-force sökning på vanliga namn
       const columns = ['user_id', 'author_id', 'sender_id', 'receiver_id', 'actor_id', 'blocker_id', 'blocked_id', 'admin_id', 'reporter_id', 'reported_user_id', 'id'];
       
       for (const col of columns) {
         try {
           const { data: rows, error: rowError } = await supabase.from(table).select('*').eq(col, userId).limit(5);
           if (rows && rows.length > 0) {
              console.log(`[HITTAD!] Tabell: ${table}, Kolumn: ${col} - ${rows.length} rader kvar.`);
           }
         } catch (e) { /* Tabell eller kolumn saknas */ }
       }
    } catch (e) { /* Tabell saknas */ }
  }
  console.log('Diagnostik slutförd.');
}

diag();
