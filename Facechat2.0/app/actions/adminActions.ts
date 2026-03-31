"use server";

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';

const ROOT_EMAIL = 'apersson508@gmail.com';

// Setup Supabase Admin Client
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

// Helper to verify permissions via server session
async function verifyAdminPermission(permissionRequired: string) {
  const serverSupabase = await createServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) throw new Error('Du måste vara inloggad.');

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) throw new Error('Profil saknas');
  
  const isRoot = user.email === ROOT_EMAIL;
  const isAdmin = (profile?.is_admin || profile?.perm_roles || isRoot) ?? false;

  if (isRoot || profile.perm_roles) return { userId: user.id, isRoot };

  if (!profile[permissionRequired] && !isAdmin) {
     throw new Error(`Behörighet saknas (${permissionRequired})`);
  }
  
  return { userId: user.id, isRoot };
}

export async function adminMassDeleteSpam(query: string) {
  try {
    await verifyAdminPermission('perm_diagnostics');
    const searchTerm = `%${query.trim()}%`;

    const results = await Promise.all([
      supabaseAdmin.from('whiteboard').delete({ count: 'exact' }).ilike('content', searchTerm),
      supabaseAdmin.from('whiteboard_comments').delete({ count: 'exact' }).ilike('content', searchTerm),
      supabaseAdmin.from('forum_posts').delete({ count: 'exact' }).ilike('content', searchTerm),
      supabaseAdmin.from('forum_threads').delete({ count: 'exact' }).ilike('title', searchTerm),
      supabaseAdmin.from('guestbook').delete({ count: 'exact' }).ilike('content', searchTerm),
      supabaseAdmin.from('chat_messages').delete({ count: 'exact' }).ilike('content', searchTerm),
      supabaseAdmin.from('private_messages').delete({ count: 'exact' }).ilike('content', searchTerm)
    ]);

    const errors = results.map(r => r.error).filter(Boolean);
    const totalDeleted = results.reduce((sum, r) => sum + (r.count || 0), 0);

    if (errors.length > 0) {
      console.error("Mass delete errors:", errors);
      throw new Error(`Radering misslyckades i ${errors.length} tabeller.`);
    }

    return { success: true, count: totalDeleted };
  } catch (err: any) {
    return { error: err.message };
  }
}
