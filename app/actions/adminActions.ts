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

  if (isAdmin) {
     return { userId: user.id, isRoot }; 
  }
  
  if (!profile[permissionRequired]) {
     throw new Error(`Behörighet saknas (${permissionRequired})`);
  }
  
  return { userId: user.id, isRoot: false };
}

export async function toggleBlockUser(userId: string, newStatus: boolean) {
  try {
    const { isRoot } = await verifyAdminPermission('perm_users');

    // Root Protection
    // Root Protection (mrsunshine88 / apersson508@gmail.com)
    // We fetch the target email from auth.users via admin client
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (targetUser?.user?.email === ROOT_EMAIL) {
      throw new Error('Säkerhetsspärr: Root-administratören kan aldrig bannlysas.');
    }

    const { error } = await supabaseAdmin.from('profiles').update({ is_banned: newStatus }).eq('id', userId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminDeleteContent(table: string, id: string) {
  try {
    const perm = table === 'chat_messages' ? 'perm_chat' : 'perm_content';
    const { isRoot } = await verifyAdminPermission(perm);

    // Hardened Whitelist
    const ALLOWED_TABLES = [
      'forum_posts', 'forum_threads', 'chat_messages', 
      'whiteboard', 'whiteboard_comments', 'guestbook', 
      'private_messages', 'reports', 'snake_scores'
    ];

    if (!ALLOWED_TABLES.includes(table)) {
      throw new Error(`Otillåten tabell för radering: ${table}`);
    }

    // Protection for root admin content (if applicable)
    // For simplicity we check if the table has an author_id/sender_id/user_id we want to protect
    // But mostly we just care that they don't delete from profiles/auth.users here.

    const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminResolveReport(reportId: string, status: string) {
  try {
    const { userId: executorId, isRoot } = await verifyAdminPermission('perm_content');

    // Kolla om anmälningen rör admin själv (jäv)
    const { data: report } = await supabaseAdmin.from('reports').select('reported_user_id').eq('id', reportId).single();
    if (report && report.reported_user_id === executorId && !isRoot) {
      throw new Error('Jäv: Du kan inte hantera anmälningar som rör dig själv.');
    }

    const { error } = await supabaseAdmin.from('reports').update({ status }).eq('id', reportId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminRoomAction(action: string, roomId: string | null, payload: any) {
  try {
    await verifyAdminPermission('perm_rooms');
    let error = null;
    
    if (action === 'insert') {
      const resp = await supabaseAdmin.from('chat_rooms').insert(payload);
      error = resp.error;
    } else if (action === 'delete') {
      const resp = await supabaseAdmin.from('chat_rooms').delete().eq('id', roomId);
      error = resp.error;
    } else if (action === 'update') {
      const resp = await supabaseAdmin.from('chat_rooms').update(payload).eq('id', roomId);
      error = resp.error;
    }
    
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminAddSecretUserToRoom(roomId: string, targetUserId: string) {
  try {
    await verifyAdminPermission('perm_rooms');
    const { data: room, error: fetchErr } = await supabaseAdmin.from('chat_rooms').select('allowed_users').eq('id', roomId).single();
    if (fetchErr) throw fetchErr;
    let users = room?.allowed_users || [];
    if (!users.includes(targetUserId)) {
      users.push(targetUserId);
      const { error: updateErr } = await supabaseAdmin.from('chat_rooms').update({ allowed_users: users }).eq('id', roomId);
      if (updateErr) throw updateErr;
    }
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminRemoveSecretUserFromRoom(roomId: string, targetUserId: string) {
  try {
    await verifyAdminPermission('perm_rooms');
    const { data: room, error: fetchErr } = await supabaseAdmin.from('chat_rooms').select('allowed_users').eq('id', roomId).single();
    if (fetchErr) throw fetchErr;
    let users = room?.allowed_users || [];
    users = users.filter((id: string) => id !== targetUserId);
    const { error: updateErr } = await supabaseAdmin.from('chat_rooms').update({ allowed_users: users }).eq('id', roomId);
    if (updateErr) throw updateErr;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminUpdatePermissions(userId: string, payload: any) {
  try {
    await verifyAdminPermission('perm_roles');

    // Root Protection
    const { data: targetProfile } = await supabaseAdmin.from('profiles').select('auth_email').eq('id', userId).single();
    if (targetProfile?.auth_email === ROOT_EMAIL) {
      throw new Error('Säkerhetsspärr: Root-administratörens roller kan aldrig ändras.');
    }

    const { error } = await supabaseAdmin.from('profiles').update(payload).eq('id', userId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminDeleteSnakeScore(scoreId: string | null, deleteAll: boolean = false, gameId: string | null = null) {
  try {
    await verifyAdminPermission('perm_content');
    if (deleteAll) {
      if (gameId && gameId !== 'all') {
         const { error } = await supabaseAdmin.from('snake_scores').delete().eq('game_id', gameId);
         if (error) throw error;
      } else {
         const { error } = await supabaseAdmin.from('snake_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         if (error) throw error;
      }
    } else if (scoreId) {
      const { error } = await supabaseAdmin.from('snake_scores').delete().eq('id', scoreId);
      if (error) throw error;
    }
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// SOFT DELETE for Support tickets (Döljs för admin, men finns kvar för användaren på Mina Sidor)
export async function adminDeleteSupportTicket(ticketId: string) {
  try {
    await verifyAdminPermission('perm_support');
    const { error } = await supabaseAdmin.from('support_tickets').update({ admin_deleted: true }).eq('id', ticketId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminResetAvatar(targetUserId: string) {
  try {
    const { isRoot } = await verifyAdminPermission('perm_images');
    
    // Root-skydd
    const { data: target } = await supabaseAdmin.from('profiles').select('auth_email').eq('id', targetUserId).single();
    if (target?.auth_email === ROOT_EMAIL) {
       throw new Error('Säkerhetsspärr: Root-administratörens bild kan inte nollställas här.');
    }

    const { error } = await supabaseAdmin.from('profiles').update({ avatar_url: null }).eq('id', targetUserId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminResetPresentation(targetUserId: string) {
  try {
    const { isRoot } = await verifyAdminPermission('perm_content');
    
    // Root-skydd
    const { data: target } = await supabaseAdmin.from('profiles').select('auth_email').eq('id', targetUserId).single();
    if (target?.auth_email === ROOT_EMAIL) {
       throw new Error('Säkerhetsspärr: Root-administratörens bio kan inte nollställas här.');
    }

    const { error } = await supabaseAdmin.from('profiles').update({ presentation: '' }).eq('id', targetUserId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminResetTheme(targetUserId: string) {
  try {
    await verifyAdminPermission('perm_content');
    
    // Root-skydd
    const { data: target } = await supabaseAdmin.from('profiles').select('auth_email').eq('id', targetUserId).single();
    if (target?.auth_email === ROOT_EMAIL) {
       throw new Error('Säkerhetsspärr: Root-administratörens tema kan inte nollställas här.');
    }

    const { error } = await supabaseAdmin.from('profiles').update({ custom_style: null }).eq('id', targetUserId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminRunDeepScan() {
  try {
    await verifyAdminPermission('perm_diagnostics');
    let issues: any[] = [];
    
    // 1. Spökpoäng i Snake
    try {
      const { count: snakeZeros } = await supabaseAdmin.from('snake_scores').select('*', { count: 'exact', head: true }).eq('score', 0);
      if (snakeZeros && snakeZeros > 0) {
        issues.push({ id: 'cleanup_snake', title: 'Snake Skräpdata', message: `Hittade ${snakeZeros} ogiltiga spök-poäng (0 poäng).` });
      }
    } catch(e) {}

    // 2. Tunga CSS-profiler (Risk för lagg)
    try {
      const { data: cssProfiles } = await supabaseAdmin.from('profiles').select('id, username, custom_style').not('custom_style', 'is', null);
      let heavyCss = 0;
      if (cssProfiles) {
         cssProfiles.forEach((p:any) => { if (p.custom_style && p.custom_style.length > 5000) heavyCss++; });
      }
      if (heavyCss > 0) {
        issues.push({ id: 'cleanup_css', title: 'Extrem Krypin-CSS', message: `Hittade ${heavyCss} profiler med massiv CSS-kod (>5000 tecken). Panik-risk!` });
      }
    } catch(e) {}

    // 3. Tomma/Gamla Chattrum (Inaktiva > 7 dagar)
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: oldRooms } = await supabaseAdmin.from('chat_rooms').select('*', { count: 'exact', head: true }).lt('created_at', sevenDaysAgo.toISOString()).ilike('room_type', '%temp%');
      if (oldRooms && oldRooms > 0) {
         issues.push({ id: 'cleanup_rooms', title: 'Övergivna Chattrum', message: `Hittade ${oldRooms} tillfälliga chattrum som är inaktiva och tar plats.` });
      }
    } catch(e) {}

    // 4. Urgamla Meddelanden i Inkorg (> 30 dagar och lästa)
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: oldMails } = await supabaseAdmin.from('private_messages').select('*', { count: 'exact', head: true }).lt('created_at', thirtyDaysAgo.toISOString()).eq('is_read', true);
      if (oldMails && oldMails > 0) {
         issues.push({ id: 'cleanup_mail', title: 'Urgamla Inkorg-Mejl', message: `Hittade ${oldMails} urgamla och lästa mejl (> 30 dygn).` });
      }
    } catch(e) {}

    // 5. Halva Gästbok-inlägg (Orphans fallback om inte DB-cascade tog dem)
    try {
      const { count: emptyGuests } = await supabaseAdmin.from('guestbook').select('*', { count: 'exact', head: true }).eq('content', '');
      if (emptyGuests && emptyGuests > 0) {
        issues.push({ id: 'cleanup_guests', title: 'Tomma Gästboks-inlägg', message: `Hittade ${emptyGuests} trasiga gästboksinlägg utan innehåll.` });
      }
    } catch(e) {}

    // 7. Föräldralösa inlägg (GDPR - Raderade konton som lämnat kvar data)
    try {
      let totalOrphans = 0;
      
      // Vi kollar bara ett stickprov på 200 rader per tabell för snabbhet i "Scan"
      const forumOrphans = await supabaseAdmin.from('forum_posts').select('id, profiles(id)').limit(200);
      totalOrphans += forumOrphans.data?.filter((p: any) => !p.profiles).length || 0;
      
      const guestOrphans = await supabaseAdmin.from('guestbook').select('id, sender:sender_id(id)').limit(200);
      totalOrphans += guestOrphans.data?.filter((p: any) => !p.sender).length || 0;

      const whiteboardOrphans = await supabaseAdmin.from('whiteboard').select('id, profiles(id)').limit(200);
      totalOrphans += whiteboardOrphans.data?.filter((p: any) => !p.profiles).length || 0;

    } catch(e) {
      console.error("Scan error:", e);
    }

    // 8. Dubbelkoll: Root-Admin IP Spärrad (Säkerhetsnät)
    try {
      const { data: rootData } = await supabaseAdmin.from('profiles').select('last_ip').eq('auth_email', 'apersson508@gmail.com').single();
      if (rootData?.last_ip) {
        const { count: isBlocked } = await supabaseAdmin.from('blocked_ips').select('*', { count: 'exact', head: true }).eq('ip', rootData.last_ip);
        if (isBlocked && isBlocked > 0) {
          issues.push({ id: 'cleanup_root_ip', title: 'KRITISK: Root-IP Spärrad', status: 'warning', message: `Din nuvarande hem-IP (${rootData.last_ip}) är listad som spärrad. Detta kan orsaka problem!` });
        }
      }
    } catch(e) {}
    
    // 9. Oanvända/Herrelösa Profilbilder (Fallback om RPC saknas)
    try {
      const { data: storageFiles } = await supabaseAdmin.storage.from('avatars').list('', { limit: 1000 });
      const { data: activeProfiles } = await supabaseAdmin.from('profiles').select('avatar_url').not('avatar_url', 'is', null);
      
      if (storageFiles && activeProfiles) {
        const activeFileNames = new Set(
          activeProfiles
            .map((p: any) => p.avatar_url?.split('/').pop()?.split('?')[0])
            .filter(Boolean)
        );
        
        const orphans = storageFiles
          .map((f: any) => f.name)
          .filter((name: string) => name !== '.emptyFolderPlaceholder' && !activeFileNames.has(name));
          
        if (orphans.length > 0) {
          issues.push({ 
            id: 'cleanup_orphan_files', 
            title: 'Herrelösa Profilbilder', 
            message: `Hittade ${orphans.length} filer i storage som inte tillhör någon användare.` 
          });
        }
      }
    } catch (e) {}

    return { success: true, issues };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminFixDeepScanIssue(issueId: string) {
  try {
    await verifyAdminPermission('perm_diagnostics');
    let fixedMsg = '';

    if (issueId === 'cleanup_snake') {
      await supabaseAdmin.from('snake_scores').delete().eq('score', 0);
      fixedMsg = 'Raderade 0-poängsvariablerna i Snake.';
    } else if (issueId === 'cleanup_css') {
      const { data: cssProfiles } = await supabaseAdmin.from('profiles').select('id, custom_style').not('custom_style', 'is', null);
      if (cssProfiles) {
        for (const p of cssProfiles) {
          if (p.custom_style && p.custom_style.length > 5000) {
            await supabaseAdmin.from('profiles').update({ custom_style: '' }).eq('id', p.id);
          }
        }
      }
      fixedMsg = 'Nollställde CSS för de med extrema datamängder.';
    } else if (issueId === 'cleanup_rooms') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      await supabaseAdmin.from('chat_rooms').delete().lt('created_at', sevenDaysAgo.toISOString()).ilike('room_type', '%temp%');
      fixedMsg = 'Raderade gamla inaktiva tillfälliga chattrum.';
    } else if (issueId === 'cleanup_mail') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      await supabaseAdmin.from('private_messages').delete().lt('created_at', thirtyDaysAgo.toISOString()).eq('is_read', true);
      fixedMsg = 'Rensade bort extremt gamla inkorgmeddelanden (>30d).';
    } else if (issueId === 'cleanup_guests') {
      await supabaseAdmin.from('guestbook').delete().eq('content', '');
      fixedMsg = 'Rensade bort tomma gästboksinlägg.';
    } else if (issueId === 'cleanup_root_ip') {
      const { data: rootData } = await supabaseAdmin.from('profiles').select('last_ip').eq('auth_email', 'apersson508@gmail.com').single();
      if (rootData?.last_ip) {
        await supabaseAdmin.from('blocked_ips').delete().eq('ip', rootData.last_ip);
      }
      fixedMsg = 'Tog bort spärren för din nuvarande Root-IP.';
    } else if (issueId === 'cleanup_forum') {
      await supabaseAdmin.from('forum_posts').delete().eq('content', '');
      fixedMsg = 'Rensade bort tomma foruminlägg.';
    } else if (issueId === 'cleanup_orphans') {
      const tableConfigs = [
        { name: 'forum_posts', rel: 'profiles(id)' },
        { name: 'forum_threads', rel: 'profiles(id)' },
        { name: 'chat_messages', rel: 'profiles(id)' },
        { name: 'whiteboard', rel: 'profiles(id)' },
        { name: 'whiteboard_comments', rel: 'profiles(id)' },
        { name: 'guestbook', rel: 'sender:sender_id(id)' },
        { name: 'guestbook', rel: 'receiver:receiver_id(id)' },
        { name: 'private_messages', rel: 'sender:sender_id(id)' },
        { name: 'private_messages', rel: 'receiver:receiver_id(id)' },
        { name: 'notifications', rel: 'actor:actor_id(id)' },
        { name: 'notifications', rel: 'receiver:receiver_id(id)' },
        { name: 'user_blocks', rel: 'blocker:blocker_id(id)' },
        { name: 'user_blocks', rel: 'blocked:blocked_id(id)' },
        { name: 'snake_scores', rel: 'profiles:user_id(id)' },
        { name: 'user_secrets', rel: 'profiles:user_id(id)' },
        { name: 'reports', rel: 'reporter:reporter_id(id)' },
        { name: 'reports', rel: 'reported:reported_user_id(id)' },
        { name: 'support_tickets', rel: 'profiles:user_id(id)' },
        { name: 'admin_logs', rel: 'admin:admin_id(id)' },
        { name: 'whiteboard_likes', rel: 'profiles:user_id(id)' }
      ];
      let totalDeleted = 0;
      let tablesProcessed = 0;
      
      for (const config of tableConfigs) {
        try {
          const { data: records } = await supabaseAdmin.from(config.name).select(`id, ${config.rel}`).limit(1000);
          if (records) {
            const relAlias = config.rel.split(':')[0].split('(')[0];
            const toDelete = records.filter((r: any) => !r[relAlias]).map((r: any) => r.id);
            if (toDelete.length > 0) {
              const { error: delErr } = await supabaseAdmin.from(config.name).delete().in('id', toDelete);
              if (!delErr) totalDeleted += toDelete.length;
            }
          }
          tablesProcessed++;
        } catch(e) {
          console.error(`Error processing ${config.name}:`, e);
        }
      }
      fixedMsg = `Sanering klar. Raderade totalt ${totalDeleted} föräldralösa rader i ${tablesProcessed} tabeller.`;
    } else if (issueId === 'cleanup_orphan_files') {
      const { data: storageFiles } = await supabaseAdmin.storage.from('avatars').list('', { limit: 1000 });
      const { data: activeProfiles } = await supabaseAdmin.from('profiles').select('avatar_url').not('avatar_url', 'is', null);
      
      if (storageFiles && activeProfiles) {
        const activeFileNames = new Set(
          activeProfiles
            .map((p: any) => p.avatar_url?.split('/').pop()?.split('?')[0])
            .filter(Boolean)
        );
        
        const orphans = storageFiles
          .map((f: any) => f.name)
          .filter((name: string) => name !== '.emptyFolderPlaceholder' && !activeFileNames.has(name));
          
        if (orphans.length > 0) {
          const { error } = await supabaseAdmin.storage.from('avatars').remove(orphans);
          if (error) throw error;
          fixedMsg = `Raderade ${orphans.length} herrelösa profilbilder från storage.`;
        } else {
          fixedMsg = 'Inga herrelösa bilder hittades vid försök till fix.';
        }
      }
    } else {
      throw new Error('Ogiltigt åtgärds-ID.');
    }

    return { success: true, message: fixedMsg };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminMassDeleteSpam(query: string) {
  try {
    await verifyAdminPermission('perm_diagnostics');
    const searchTerm = `%${query.trim()}%`;

    const tasks = [
      supabaseAdmin.from('whiteboard').delete().ilike('content', searchTerm),
      supabaseAdmin.from('whiteboard_comments').delete().ilike('content', searchTerm),
      supabaseAdmin.from('forum_posts').delete().ilike('content', searchTerm),
      supabaseAdmin.from('forum_threads').delete().ilike('title', searchTerm),
      supabaseAdmin.from('guestbook').delete().ilike('content', searchTerm),
      supabaseAdmin.from('chat_messages').delete().ilike('content', searchTerm),
      supabaseAdmin.from('private_messages').delete().ilike('content', searchTerm)
    ];

    const results = await Promise.all(tasks);
    const errors = results.map(r => r.error).filter(Boolean);

    if (errors.length > 0) {
      console.error("Mass delete errors:", errors);
      throw new Error(`Radering misslyckades i ${errors.length} tabeller.`);
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
