"use server";

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';

const ROOT_EMAIL = 'apersson508@gmail.com';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

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

    const { error } = await supabaseAdmin
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
    const { data: admin } = await supabaseAdmin.from('profiles').select('is_admin, perm_diagnostics').eq('id', user.id).single();
    if (!admin?.is_admin && !admin?.perm_diagnostics && user.email !== ROOT_EMAIL) throw new Error('Behörighet saknas');

    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) throw new Error('Ordet får inte vara tomt');

    // 1. Lägg till i listan
    const { error } = await supabaseAdmin.from('forbidden_words').insert({ word: cleanWord });
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

    const { data: admin } = await supabaseAdmin.from('profiles').select('is_admin, perm_diagnostics').eq('id', user.id).single();
    if (!admin?.is_admin && !admin?.perm_diagnostics && user.email !== ROOT_EMAIL) throw new Error('Behörighet saknas');

    const { error } = await supabaseAdmin.from('forbidden_words').delete().eq('id', wordId);
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

    const { data: admin } = await supabaseAdmin.from('profiles').select('is_admin, perm_users').eq('id', user.id).single();
    if (!admin?.is_admin && !admin?.perm_users && user.email !== ROOT_EMAIL) throw new Error('Behörighet saknas');

    // --- ROOT IP IMMUNITY CHECK ---
    const { data: rootProfile } = await supabaseAdmin
      .from('profiles')
      .select('auth_email, last_ip')
      .eq('auth_email', 'apersson508@gmail.com')
      .single();

    if (rootProfile && rootProfile.last_ip === ip) {
      throw new Error(`Säkerhetsspärr: Denna IP-adress (${ip}) är skyddad eftersom den används av Root-ägaren.`);
    }

    const { error } = await supabaseAdmin.from('blocked_ips').insert({ ip, reason });
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

    const { data: admin } = await supabaseAdmin.from('profiles').select('is_admin, perm_users').eq('id', user.id).single();
    if (!admin?.is_admin && !admin?.perm_users && user.email !== ROOT_EMAIL) throw new Error('Behörighet saknas');

    const { error } = await supabaseAdmin.from('blocked_ips').delete().eq('ip', ip);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
