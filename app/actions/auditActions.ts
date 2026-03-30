"use server";

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let _auditAdmin: any = null;
function getAuditAdmin() {
  if (!_auditAdmin && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    _auditAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _auditAdmin;
}

/**
 * Loggar en administrativ handling till databasen för granskning.
 */
export async function adminLogAction(action: string, targetId?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const adminDb = getAuditAdmin();
    if (!adminDb) {
      // Fallback till vanlig klient om env variabler saknas
      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action: action
      });
      return;
    }

    // Tvinga in loggen med Service Role så att ingen Row Level Security (RLS) kan blockera när man kraschar säkerhetsspärrar
    await adminDb.from('admin_logs').insert({
      admin_id: user.id,
      action: action
    });
  } catch (e) {
    console.error("Failed to log admin action:", e);
  }
}
