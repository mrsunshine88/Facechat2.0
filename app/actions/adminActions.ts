"use server";

import { createClient } from '@supabase/supabase-js';

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

// Helper to verify permissions
async function verifyAdminPermission(requestingUserId: string, permissionRequired: string) {
  const { data: profList } = await supabaseAdmin.from('profiles').select('*').eq('id', requestingUserId).limit(1);
  const profile = profList && profList.length > 0 ? profList[0] : null;
  if (!profile) throw new Error('User not found');
  
  if (profile.auth_email === 'apersson508@gmail.com' || profile.is_admin || profile.perm_roles) {
     return true; 
  }
  if (!profile[permissionRequired]) {
     throw new Error(`Behörighet saknas (${permissionRequired})`);
  }
  return true;
}

export async function toggleBlockUser(userId: string, requestingUserId: string, newStatus: boolean) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_users');
    const { error } = await supabaseAdmin.from('profiles').update({ is_banned: newStatus }).eq('id', userId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminDeleteContent(table: string, id: string, requestingUserId: string) {
  try {
    if (table === 'chat_messages') {
      await verifyAdminPermission(requestingUserId, 'perm_chat');
    } else {
      await verifyAdminPermission(requestingUserId, 'perm_content');
    }
    const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminResolveReport(reportId: string, status: string, requestingUserId: string) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_content');
    const { data: profList } = await supabaseAdmin.from('profiles').select('auth_email').eq('id', requestingUserId).limit(1);
    const profile = profList && profList.length > 0 ? profList[0] : null;
    const isRoot = profile?.auth_email === 'apersson508@gmail.com';

    // Kolla om anmälningen rör admin själv (jäv)
    const { data: repList } = await supabaseAdmin.from('reports').select('reported_user_id').eq('id', reportId).limit(1);
    const report = repList && repList.length > 0 ? repList[0] : null;
    if (report && report.reported_user_id === requestingUserId && !isRoot) {
      throw new Error('Jäv: Du kan inte hantera anmälningar som rör dig själv.');
    }

    const { error } = await supabaseAdmin.from('reports').update({ status }).eq('id', reportId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminRoomAction(action: string, roomId: string | null, payload: any, requestingUserId: string) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_rooms');
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

export async function adminAddSecretUserToRoom(roomId: string, targetUserId: string, requestingUserId: string) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_rooms');
    const { data: roomList, error: fetchErr } = await supabaseAdmin.from('chat_rooms').select('allowed_users').eq('id', roomId).limit(1);
    const room = roomList && roomList.length > 0 ? roomList[0] : null;
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

export async function adminRemoveSecretUserFromRoom(roomId: string, targetUserId: string, requestingUserId: string) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_rooms');
    const { data: roomList, error: fetchErr } = await supabaseAdmin.from('chat_rooms').select('allowed_users').eq('id', roomId).limit(1);
    const room = roomList && roomList.length > 0 ? roomList[0] : null;
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

export async function adminUpdatePermissions(userId: string, payload: any, requestingUserId: string) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_roles');
    const { error } = await supabaseAdmin.from('profiles').update(payload).eq('id', userId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminDeleteSnakeScore(scoreId: string | null, requestingUserId: string, deleteAll: boolean = false, gameId: string | null = null) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_content');
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
export async function adminDeleteSupportTicket(ticketId: string, requestingUserId: string) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_support');
    const { error } = await supabaseAdmin.from('support_tickets').update({ admin_deleted: true }).eq('id', ticketId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminRunDeepScan(requestingUserId: string) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_diagnostics');
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

      if (totalOrphans > 0) {
        issues.push({ id: 'cleanup_orphans', title: 'GDPR: Föräldralösa inlägg', message: `Hittade föräldralös data (Forum, Gästbok m.m.). Kör "Fixa Auto" för komplett sanering.` });
      }
    } catch(e) {
      console.error("Scan error:", e);
    }

    return { success: true, issues };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function adminFixDeepScanIssue(issueId: string, requestingUserId: string) {
  try {
    await verifyAdminPermission(requestingUserId, 'perm_diagnostics');
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
        { name: 'private_messages', rel: 'receiver:receiver_id(id)' }
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
    } else {
      throw new Error('Ogiltigt åtgärds-ID.');
    }

    return { success: true, message: fixedMsg };
  } catch (err: any) {
    return { error: err.message };
  }
}
