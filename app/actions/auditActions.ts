"use server";

import { createClient } from '@/utils/supabase/server';

/**
 * Loggar en administrativ handling till databasen för granskning.
 */
export async function adminLogAction(action: string, targetId?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: action,
      target_id: targetId
    });
  } catch (e) {
    console.error("Failed to log admin action:", e);
  }
}
