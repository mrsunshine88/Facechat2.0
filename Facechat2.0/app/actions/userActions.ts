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

  // Skapa Supabase Admin Client med service_role key (går förbi RLS och har admin-rättigheter)
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
    // 1. Rensa användarens profil (här tar cascadesoft delete över för t.ex user_secrets)
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    
    // 2. Radera själva auth.users-kontot så att e-postadressen frigörs (Detta är centralt för GDPR)
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
