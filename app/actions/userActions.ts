"use server";

import { createClient } from '@supabase/supabase-js';

export async function deleteUserAccount(userId: string, requestingUserId: string, isAdmin: boolean) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Serverkonfiguration saknas (SUPABASE_SERVICE_ROLE_KEY saknas i .env.local).' };
  }

  // Enkel behörighetskontroll: Man får radera sig själv, eller så måste man vara admin
  if (userId !== requestingUserId && !isAdmin) {
    return { error: 'Behörighet saknas för att radera detta konto.' };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // Prevent deletion of apersson508
  const { data: profList } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).limit(1);
  const userProfile = profList && profList.length > 0 ? profList[0] : null;
  if (userProfile?.username?.toLowerCase() === 'apersson508') {
    return { error: 'Säkerhetsspärr: Detta konto är skyddat som root-administratör och kan aldrig raderas.' };
  }

  try {
    // 1. Radera all användardata från olika tabeller (GDPR)
    const tables = [
      { name: 'forum_posts', col: 'author_id' },
      { name: 'forum_threads', col: 'author_id' },
      { name: 'chat_messages', col: 'author_id' },
      { name: 'whiteboard', col: 'author_id' },
      { name: 'whiteboard_comments', col: 'author_id' },
      { name: 'guestbook', col: 'sender_id' },
      { name: 'guestbook', col: 'receiver_id' },
      { name: 'private_messages', col: 'sender_id' },
      { name: 'private_messages', col: 'receiver_id' },
      { name: 'friendships', col: 'user_id_1' },
      { name: 'friendships', col: 'user_id_2' },
      { name: 'notifications', col: 'actor_id' },
      { name: 'notifications', col: 'receiver_id' },
      { name: 'user_blocks', col: 'blocker_id' },
      { name: 'user_blocks', col: 'blocked_id' },
      { name: 'snake_scores', col: 'user_id' },
      { name: 'user_secrets', col: 'user_id' }
    ];

    for (const t of tables) {
      await supabaseAdmin.from(t.name).delete().eq(t.col, userId);
    }

    // 2. Rensa användarens profil
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    
    // 3. Radera själva auth.users-kontot så att e-postadressen frigörs
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (error) {
      console.error("Fel vid radering av auth-konto:", error);
      return { error: error.message };
    }
    
    return { success: true };
  } catch (err: any) {
    console.error("Crash under radering:", err);
    return { error: err.message || 'Ett oväntat fel uppstod.' };
  }
}
