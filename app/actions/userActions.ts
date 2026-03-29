"use server";

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { sanitizeCSS } from '@/utils/securityUtils';

export async function deleteUserAccount(userId: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Serverkonfiguration saknas (SUPABASE_SERVICE_ROLE_KEY saknas i .env.local).' };
  }

  const serverSupabase = await createServerClient();
  const { data: { user: requestingUser } } = await serverSupabase.auth.getUser();

  if (!requestingUser) {
    return { error: 'Du måste vara inloggad för att utföra denna åtgärd.' };
  }

  // Enkel behörighetskontroll: Man får radera sig själv, eller så måste man vara admin
  // Vi kollar faktiskt isAdmin på servern via profilen
  const { data: requestingProfile } = await serverSupabase.from('profiles').select('is_admin').eq('id', requestingUser.id).single();
  const isActualAdmin = requestingProfile?.is_admin || requestingUser.email === 'apersson508@gmail.com';

  if (userId !== requestingUser.id && !isActualAdmin) {
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

  const { data: profList } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).limit(1);
  const userProfile = profList && profList.length > 0 ? profList[0] : null;
  const isRoot = userProfile?.username?.toLowerCase() === 'apersson508' || userProfile?.username?.toLowerCase() === 'mrsunshine88';
  if (isRoot) {
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

/**
 * Kontrollerar om ett konto är bekräftat/aktiverat.
 * Används för att stoppa lösenordsåterställning för icke-existerande/obekräftade konton.
 */
export async function isUserConfirmed(email: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Vi hämtar användaren via admin-API för att se email_confirmed_at
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    // Om användaren finns OCH är bekräftad
    return !!(user && user.email_confirmed_at);
  } catch (err) {
    console.error("Fel vid verifiering av användarstatus:", err);
    return false;
  }
}

/**
 * Sparar användarens Krypin-design och presentation på ett säkert sätt.
 * Inkluderar strikt CSS-sanering (Fortnox Standard).
 */
export async function saveKrypinDesign(draftCss: string, presentationText: string) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return { error: 'Du måste vara inloggad för att spara din design.' };
    }

    // 1. Sanera CSS-koden (Skydd mot CSS-exfiltrering och XSS)
    const cleanedCss = sanitizeCSS(draftCss);

    // 2. Sanera presentationen (Enkel trim och längdkontroll)
    const cleanedPresentation = presentationText?.substring(0, 10000) || "";

    // 3. Uppdatera databasen via Admin (för att bypassa eventuella RLS-hinder för design-fältet)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabaseAdmin.from('profiles').update({
      custom_style: cleanedCss,
      presentation: cleanedPresentation
    }).eq('id', user.id);

    if (error) throw error;

    return { 
      success: true, 
      message: 'Din design har sparats och säkerhetskontrollerats! 🛡️',
      cleanedCss 
    };
  } catch (err: any) {
    console.error("Error saving design:", err);
    return { error: err.message || 'Kunde inte spara designen.' };
  }
}

/**
 * Uppdaterar användarens profil (username, city, intressen) på ett säkert sätt.
 */
export async function updateUserProfile(payload: { 
  username?: string, 
  city?: string, 
  interests?: string[], 
  show_interests?: boolean,
  notif_sound?: string
}) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return { error: 'Du måste vara inloggad för att ändra din profil.' };
    }

    const updateData: any = {};
    
    // 1. Sanera och validera Användarnamn
    if (payload.username !== undefined) {
      const cleanUsername = payload.username.trim().replace(/[<>\"\'\&]/g, '').substring(0, 30);
      if (cleanUsername.length < 3) {
        return { error: 'Användarnamnet måste vara minst 3 tecken.' };
      }
      // Kolla kollision (ignorerar nuvarande)
      const { data: existing } = await serverSupabase.from('profiles').select('id').ilike('username', cleanUsername).neq('id', user.id).limit(1);
      if (existing && existing.length > 0) {
        return { error: 'Detta användarnamn är tyvärr redan upptaget.' };
      }
      updateData.username = cleanUsername;
    }

    // 2. City & Intressen
    if (payload.city !== undefined) {
      updateData.city = payload.city.substring(0, 50).replace(/[<>\"\'\&]/g, '');
    }
    if (payload.interests !== undefined) {
      updateData.interests = payload.interests;
    }
    if (payload.show_interests !== undefined) {
      updateData.show_interests = payload.show_interests;
    }
    if (payload.notif_sound !== undefined) {
      updateData.notif_sound = payload.notif_sound;
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabaseAdmin.from('profiles').update(updateData).eq('id', user.id);
    if (error) throw error;

    return { success: true, message: 'Din profil har uppdaterats säkert!' };
  } catch (err: any) {
    console.error("Error updating profile:", err);
    return { error: err.message || 'Kunde inte uppdatera profilen.' };
  }
}

/**
 * Hanterar blockering/avblockering av en användare (Client -> Server Action).
 * Detta kringgår CORS-problem i frontend.
 */
export async function toggleUserBlockAction(targetUserId: string, shouldBlock: boolean) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return { error: 'Du måste vara inloggad för att utföra denna åtgärd.' };
    }

    if (user.id === targetUserId) {
      return { error: 'Du kan inte blockera dig själv.' };
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Säkerhetskontroll: Kan inte blockera Root eller Admins
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('username, is_admin, perm_users, perm_content, perm_rooms, perm_roles, perm_support, perm_logs, perm_stats, perm_diagnostics, perm_chat, auth_email')
      .eq('id', targetUserId)
      .single();

    if (targetProfile) {
      const isAdmin = targetProfile.is_admin || 
                      targetProfile.perm_users || 
                      targetProfile.perm_content || 
                      targetProfile.perm_rooms || 
                      targetProfile.perm_roles || 
                      targetProfile.perm_support || 
                      targetProfile.perm_logs || 
                      targetProfile.perm_stats || 
                      targetProfile.perm_diagnostics || 
                      targetProfile.perm_chat;
      
      const isRoot = targetProfile.auth_email === 'apersson508@gmail.com' || 
                     targetProfile.username?.toLowerCase() === 'mrsunshine88';

      if (isAdmin || isRoot) {
        return { error: 'Det går inte att blockera en administratör.' };
      }
    }

    // 2. Utför åtgärd
    if (shouldBlock) {
      const { error } = await supabaseAdmin
        .from('user_blocks')
        .insert({ blocker_id: user.id, blocked_id: targetUserId });
      
      if (error && error.code !== '23505') { // Ignorera om redan blockad (unikt index)
        throw error;
      }
      return { success: true, status: 'blocked' };
    } else {
      const { error } = await supabaseAdmin
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId);
      
      if (error) throw error;
      return { success: true, status: 'unblocked' };
    }

  } catch (err: any) {
    console.error("Error in toggleUserBlockAction:", err);
    return { error: err.message || 'Ett oväntat fel uppstod vid blockering.' };
  }
}

/**
 * Hämtar antal olästa support-ärenden (Server Action för att undvika CORS).
 */
export async function getUnreadSupportCountAction() {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) return { count: 0 };

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Hämta profil för att kolla behörighet
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, perm_support, perm_roles, auth_email')
      .eq('id', user.id)
      .single();

    if (!profile) return { count: 0 };

    const isSuperAdmin = profile.auth_email?.toLowerCase() === 'apersson508@gmail.com' || profile.perm_roles;
    const canManageSupport = isSuperAdmin || profile.is_admin || profile.perm_support;

    if (canManageSupport) {
      // Admin: Räkna alla öppna ohanterade ärenden som inte är raderade
      const { count, error } = await supabaseAdmin
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('has_unread_admin', true)
        .eq('status', 'open')
        .eq('admin_deleted', false);
      
      if (error) throw error;
      return { count: count || 0 };
    } else {
      // Vanlig användare: Räkna bara egna olästa svar på öppna ärenden
      const { count, error } = await supabaseAdmin
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('has_unread_user', true)
        .eq('status', 'open');
      
      if (error) throw error;
      return { count: count || 0 };
    }

  } catch (err: any) {
    console.error("Error in getUnreadSupportCountAction:", err);
    return { count: 0, error: err.message };
  }
}

/**
 * Hämtar alla användar-ID:n som är blockerade av eller blockerar den inloggade användaren.
 * Används för att slippa CORS-fel i Header-menyn.
 */
export async function getUserBlocksAction() {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) return { data: [] };

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabaseAdmin
      .from('user_blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

    if (error) throw error;

    // Returnera en lista på alla unika ID:n som är involverade i blockeringen
    const blockIds = new Set<string>();
    data.forEach(b => {
      blockIds.add(b.blocker_id);
      blockIds.add(b.blocked_id);
    });

    return { data: Array.from(blockIds) };
  } catch (err: any) {
    console.error("Error in getUserBlocksAction:", err);
    return { data: [], error: err.message };
  }
}



