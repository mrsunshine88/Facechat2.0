"use server";

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

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

export async function adminAddForbiddenWord(word: string, adminId: string) {
  try {
    // Verifiera admin
    const { data: admin } = await supabaseAdmin.from('profiles').select('is_admin, perm_diagnostics').eq('id', adminId).single();
    if (!admin?.is_admin && !admin?.perm_diagnostics) throw new Error('Behörighet saknas');

    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) throw new Error('Ordet får inte vara tomt');

    // 1. Lägg till i listan
    const { error } = await supabaseAdmin.from('forbidden_words').insert({ word: cleanWord });
    if (error) throw error;

    // 2. Kontroll: Tvätta gammal historik direkt (enligt användarens önskemål)
    const { data: res, error: rpcErr } = await supabaseAdmin.rpc('apply_forbidden_word_globally', { p_word: cleanWord });
    if (rpcErr) console.error("Historic cleanup failed:", rpcErr);

    return { success: true, message: res || 'Ord tillagt och historik tvättad.' };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminRemoveForbiddenWord(wordId: string, adminId: string) {
  try {
    const { data: admin } = await supabaseAdmin.from('profiles').select('is_admin, perm_diagnostics').eq('id', adminId).single();
    if (!admin?.is_admin && !admin?.perm_diagnostics) throw new Error('Behörighet saknas');

    const { error } = await supabaseAdmin.from('forbidden_words').delete().eq('id', wordId);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// --- IP BLOCK ACTIONS ---

export async function adminBlockIP(ip: string, reason: string, adminId: string) {
  try {
    const { data: admin } = await supabaseAdmin.from('profiles').select('is_admin, perm_users').eq('id', adminId).single();
    if (!admin?.is_admin && !admin?.perm_users) throw new Error('Behörighet saknas');

    // --- ROOT IP IMMUNITY CHECK ---
    const { data: rootProfile } = await supabaseAdmin
      .from('profiles')
      .select('username, last_ip')
      .eq('username', 'apersson508')
      .single();

    if (rootProfile && rootProfile.last_ip === ip) {
      throw new Error(`Denna IP-adress (${ip}) är skyddad eftersom den används av ett Root-konto.`);
    }

    const { error } = await supabaseAdmin.from('blocked_ips').insert({ ip, reason });
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminUnblockIP(ip: string, adminId: string) {
  try {
    const { data: admin } = await supabaseAdmin.from('profiles').select('is_admin, perm_users').eq('id', adminId).single();
    if (!admin?.is_admin && !admin?.perm_users) throw new Error('Behörighet saknas');

    const { error } = await supabaseAdmin.from('blocked_ips').delete().eq('ip', ip);
    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
