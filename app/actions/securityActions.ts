"use server";

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';

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

    const { error } = await getAdminClient()
      .from('profiles')
      .update({ last_ip: ip })
      .eq('id', userId);

    if (error) throw error;
    return { success: true, ip };
  } catch (err: any) {
    return { error: err.message };
  }
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
      .select('auth_email, last_ip')
      .eq('auth_email', ROOT_EMAIL)
      .single();

    // SÄKERHETSSKYDD: Skydda Root-IP (mejladress) och den aktuella administratörens egen IP.
    const isRootTarget = (rootProfile && rootProfile.last_ip === ip);
    const isSelfIP = (currentRequesterIP === ip);
    // Om användaren är Root, se till att deras inloggade IP alltid är skyddad live.
    const isRootLiveIP = (user.email === ROOT_EMAIL && currentRequesterIP === ip);

    if (isRootTarget || isSelfIP || isRootLiveIP) {
      throw new Error(`Säkerhetsspärr: Denna IP-adress (${ip}) är skyddad för Root-ägaren eller din aktuella session.`);
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
