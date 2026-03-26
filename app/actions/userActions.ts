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
    // 1. Hämta profil-info för att kunna rensa lagring (t.ex. avatar)
    const { data: profile } = await supabaseAdmin.from('profiles').select('avatar_url, is_admin').eq('id', userId).maybeSingle();

    // 2. Radera all användardata från olika tabeller (GDPR - "No Trace")
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
      { name: 'user_secrets', col: 'user_id' },
      { name: 'reports', col: 'reporter_id' },
      { name: 'reports', col: 'reported_user_id' },
      { name: 'support_tickets', col: 'user_id' },
      { name: 'whiteboard_likes', col: 'user_id' }
    ];

    for (const t of tables) {
      await supabaseAdmin.from(t.name).delete().eq(t.col, userId);
    }

    // 2.5 Rensa special-referenser (t.ex. arrayer i rums-listor)
    // Vi tar bort användarens ID från 'allowed_users' arrayen i alla chat_rooms (GDPR)
    const { data: rooms } = await supabaseAdmin.from('chat_rooms').select('id, allowed_users').filter('allowed_users', 'cs', `["${userId}"]`);
    if (rooms && rooms.length > 0) {
      for (const room of rooms) {
        const newAllowed = (room.allowed_users as string[]).filter(id => id !== userId);
        await supabaseAdmin.from('chat_rooms').update({ allowed_users: newAllowed }).eq('id', room.id);
      }
    }

    // Om personen var admin, radera även deras loggar för "No Trace"
    if (profile?.is_admin) {
      await supabaseAdmin.from('admin_logs').delete().eq('admin_id', userId);
    }

    // 3. Rensa användarens profil
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    
    // 4. RADERA PROFILBILD FRÅN STORAGE (GDPR)
    if (profile?.avatar_url && profile.avatar_url.includes('/avatars/')) {
      const fileName = profile.avatar_url.split('/').pop()?.split('?')[0];
      if (fileName) {
        await supabaseAdmin.storage.from('avatars').remove([fileName]);
      }
    }
    
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

/**
 * GDPR & UX: Rensar bort ett konto som ALDRIG blivit bekräftat via mejl.
 * Detta gör att användaren kan "ansöka på nytt" om de tappat bort sitt mejl
 * eller skrivit fel användarnamn första gången.
 */
export async function prepareNewSignup(email: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Serverkonfiguration saknas.' };
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

  try {
    // 1. Hitta användaren i auth-tabellen
    // listUsers() returnerar alla, vi letar efter rätt mejl
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) throw listError;

    const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // 2. Om användaren finns men INTE är bekräftad -> RADERA
    if (existingUser && !existingUser.email_confirmed_at) {
      console.log(`Rensar gammalt obekräftat konto för: ${email}`);
      
      // Detta raderar även profiles-raden via DB-cascade (om den skapats)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      if (deleteError) throw deleteError;
      
      return { success: true, cleaned: true };
    }

    // 3. Om ingen användare fanns, eller om den redan är bekräftad, gör inget
    return { success: true, cleaned: false };

  } catch (err: any) {
    console.error("Fel i prepareNewSignup:", err);
    return { error: err.message };
  }
}
