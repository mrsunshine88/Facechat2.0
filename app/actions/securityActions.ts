"use server";

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { headers, cookies } from 'next/headers';

import { hasPermission } from './userActions';
import { adminLogAction } from './auditActions';

// ROOT_EMAILS är nu utfasat till förmån för 'is_root' kolumnen i databasen.

// Setup Supabase Admin Client
let supabaseAdmin: any;

try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (url && key) {
    supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
} catch (e) {
  console.error("Supabase Admin Client (Security) could not be initialized:", e);
}

// Internal helper to ensure admin client exists
function getAdminClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin Client is not configured. Missing SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

// Helper för att hämta IP-adress
export async function getClientIP() {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const realIp = headerList.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return realIp || '127.0.0.1';
}

// Spara användarens IP (Körs vid varje sidladdning eller login)
export async function updateUserIP(userId: string) {
  try {
    const ip = await getClientIP();
    if (!ip || ip === '::1' || ip === '127.0.0.1') return { success: true };

    // SÄKERHETSSKRUV: Uppdatera bara databasen om vi har ett RIKTIGT UUID (Inte 'guest' eller tomt)
    const isGuest = !userId || userId === 'guest' || userId.length < 20;

    if (!isGuest) {
        const { error } = await getAdminClient()
          .from('profiles')
          .update({ last_ip: ip })
          .eq('id', userId);

        if (error) {
            // Logga men tillåt att gå vidare med IP-kollen för blockerade adresser
            console.error(`[updateUserIP] Failed to update profile for ${userId}:`, error.message);
        }
    }

    return { success: true, ip };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * SYNC HEARTBEAT: Uppdaterar både last_seen OCH last_ip i realtid.
 * Körs var 60:e sekund från Header.tsx för att säkerställa att Admin-panelen
 * alltid visar rätt IP även om användaren byter nätverk (WiFi -> Mobil).
 */
export async function syncUserHeartbeatAction(userId: string) {
  try {
    if (!userId || userId === 'guest') return { success: true };
    
    const ip = await getClientIP();
    const admin = getAdminClient();
    
    const { error } = await admin
      .from('profiles')
      .update({ 
        last_seen: new Date().toISOString(),
        last_ip: (ip && ip !== '::1' && ip !== '127.0.0.1') ? ip : null 
      })
      .eq('id', userId);

    if (error) throw error;
    return { success: true, ip };
  } catch (err: any) {
    console.error('[syncUserHeartbeatAction] Failed:', err.message);
    return { error: err.message };
  }
}

/**
 * BANG-INLOGGNING: Konsoliderad säkerhetskontroll
 * Utför både session_key-uppdatering och IP-registrering i EN ENDA databastransaktion.
 * Detta minimerar väntetid och förhindrar krockar mellan olika enheter.
 */
export async function completeLoginProcess(userId: string, sessionKey: string) {
  try {
    let ip = '127.0.0.1';
    try {
      ip = await getClientIP();
    } catch (ipErr) {
      console.warn('[completeLoginProcess] Could not determine IP:', ipErr);
    }
    
    const admin = getAdminClient();
    
    // 1. Sätt sessions-cookie för Middleware (SERVER-SIDE)
    try {
      const cookieStore = await cookies();
      cookieStore.set('facechat_session_key', sessionKey, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 dagar
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    } catch (cookieErr) {
      console.warn('[completeLoginProcess] Could not set cookie:', cookieErr);
    }
    
    const { data: profile, error } = await admin
      .from('profiles')
      .update({ 
        session_key: sessionKey,
        last_ip: (ip && ip !== '::1' && ip !== '127.0.0.1') ? ip : null 
      })
      .eq('id', userId)
      .select('is_banned, auth_email')
      .maybeSingle();

    if (error) return { error: error.message };
    
    return { 
      success: true, 
      profile: profile ? { is_banned: profile.is_banned, auth_email: profile.auth_email } : null, 
      ip 
    };
  } catch (err: any) {
    console.error('[completeLoginProcess] Fatal error:', err);
    return { error: err.message || String(err) };
  }
}

/**
 * Loggar ut användaren och rensar cookies på servernivå samt i databasen (Fullständig utloggning)
 */
export async function logoutAction() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // 1. Nollställ sessions-nyckeln i databasen för att döda sessionen på servern
      const admin = getAdminClient();
      await admin
        .from('profiles')
        .update({ session_key: null })
        .eq('id', user.id);
      
      // 2. Logga ut från Supabase Auth
      await supabase.auth.signOut();
    }

    // 3. Rensa Middleware-cookien
    const cookieStore = await cookies();
    cookieStore.delete('facechat_session_key');
    
    return { success: true };
  } catch (err: any) {
    console.error('[logoutAction] Cleanup failed:', err.message);
    // Vi rensar cookien ändå för att användaren ska bli "utloggad" lokalt
    const cookieStore = await cookies();
    cookieStore.delete('facechat_session_key');
    return { success: true };
  }
}

// --- ORD-FILTER ACTIONS ---

export async function adminAddForbiddenWord(word: string) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) throw new Error('Ej inloggad');

    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) throw new Error('Ordet får inte vara tomt');

    const authorized = await hasPermission(user.id, 'perm_diagnostics');
    if (!authorized) throw new Error('Behörighet saknas för att ändra ord-filter.');

    const { error } = await getAdminClient().from('forbidden_words').insert({ word: cleanWord });
    if (error) throw error;

    await adminLogAction(`LA TILL förbjudet ord: ${cleanWord}`);
    return { success: true, message: 'Ord tillagt i globala filtret.' };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminRemoveForbiddenWord(wordId: string) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) throw new Error('Ej inloggad');

    const authorized = await hasPermission(user.id, 'perm_diagnostics');
    if (!authorized) throw new Error('Behörighet saknas.');

    const { error } = await getAdminClient().from('forbidden_words').delete().eq('id', wordId);
    if (error) throw error;

    await adminLogAction(`TOG BORT förbjudet ord ID: ${wordId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// --- IP BLOCK ACTIONS ---

export async function adminBlockIP(ip: string, reason: string) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) throw new Error('Ej inloggad');

    const authorized = await hasPermission(user.id, 'perm_users');
    if (!authorized) throw new Error('Behörighet saknas.');

    // --- ROOT IP IMMUNITY CHECK (Baserat på is_root flaggan) ---
    const { data: rootProfiles } = await getAdminClient()
      .from('profiles')
      .select('last_ip')
      .eq('is_root', true);

    const rootIps = rootProfiles?.map((p: any) => p.last_ip).filter(Boolean) || [];
    if (rootIps.includes(ip)) {
      throw new Error(`Säkerhetsspärr: Denna IP-adress (${ip}) är skyddad eftersom den tillhör en Root-administratör.`);
    }

    const { error } = await getAdminClient().from('blocked_ips').upsert({ ip, reason }, { onConflict: 'ip' });
    if (error) throw error;

    await adminLogAction(`BLOCKERADE IP: ${ip}`, ip);
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminUnblockIP(ip: string) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) throw new Error('Ej inloggad');

    const authorized = await hasPermission(user.id, 'perm_users');
    if (!authorized) throw new Error('Behörighet saknas.');

    const { error } = await getAdminClient().from('blocked_ips').delete().eq('ip', ip);
    if (error) throw error;

    await adminLogAction(`AVBLOCKERADE IP: ${ip}`, ip);
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
