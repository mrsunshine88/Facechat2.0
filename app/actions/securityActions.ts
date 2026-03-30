"use server";

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { headers, cookies } from 'next/headers';

const ROOT_EMAIL = 'apersson508@gmail.com';

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
 * Loggar ut användaren och rensar cookies på servernivå (Säkert)
 */
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('facechat_session_key');
  return { success: true };
}

// --- ORD-FILTER ACTIONS ---

export async function adminAddForbiddenWord(word: string) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) throw new Error('Ej inloggad');

    // Verifiera admin
    const { data: admin } = await getAdminClient().from('profiles').select('is_admin, perm_diagnostics').eq('id', user.id).single();
    if (!admin?.is_admin && !admin?.perm_diagnostics && user.email !== ROOT_EMAIL) throw new Error('Behörighet saknas');

    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) throw new Error('Ordet får inte vara tomt');

    // 1. Lägg till i listan
    const { error } = await getAdminClient().from('forbidden_words').insert({ word: cleanWord });
    if (error) throw error;

    // 2. Vi kör inte längre destruktiv tvätt i databasen. 
    // Maskering sker nu dynamiskt i frontend vid behov.

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

    const { data: admin } = await getAdminClient().from('profiles').select('is_admin, perm_diagnostics').eq('id', user.id).single();
    if (!admin?.is_admin && !admin?.perm_diagnostics && user.email !== ROOT_EMAIL) throw new Error('Behörighet saknas');

    const { error } = await getAdminClient().from('forbidden_words').delete().eq('id', wordId);
    if (error) throw error;

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

    const { data: admin } = await getAdminClient().from('profiles').select('is_admin, perm_users').eq('id', user.id).single();
    if (!admin?.is_admin && !admin?.perm_users && user.email !== ROOT_EMAIL) throw new Error('Behörighet saknas');

    // --- ADMIN / ROOT IP IMMUNITY CHECK ---
    const currentRequesterIP = await getClientIP();
    

    const { data: rootProfile } = await getAdminClient()
      .from('profiles')
      .select('last_ip')
      .eq('auth_email', ROOT_EMAIL)
      .single();

    if (rootProfile && rootProfile.last_ip === ip) {
      throw new Error(`Säkerhetsspärr: Denna IP-adress (${ip}) är skyddad eftersom den tillhör Root-ägaren.`);
    }

    const { error } = await getAdminClient().from('blocked_ips').upsert({ ip, reason }, { onConflict: 'ip' });
    if (error) throw error;

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

    const { data: admin } = await getAdminClient().from('profiles').select('is_admin, perm_users').eq('id', user.id).single();
    if (!admin?.is_admin && !admin?.perm_users && user.email !== ROOT_EMAIL) throw new Error('Behörighet saknas');

    const { error } = await getAdminClient().from('blocked_ips').delete().eq('ip', ip);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
