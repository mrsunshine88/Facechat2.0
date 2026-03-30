"use client"

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Send, Users, Hash, Lock, Trash2, ChevronDown, ChevronUp, ShieldAlert, AlertTriangle, LogOut, UserPlus, XCircle, Edit, PlusCircle, Plus } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWordFilter } from '@/hooks/useWordFilter';

export default function Chattrum() {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Laddar chattrum...</div>}>
      <ChattrumContent />
    </Suspense>
  )
}

function ChattrumContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlRoomName = searchParams?.get('room');
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportCategory, setReportCategory] = useState('Spam');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [friends, setFriends] = useState<any[]>([]);

  const blockedIdsRef = useRef<string[]>([]);
  const channelRef = useRef<any>(null);
  const currentUserRef = useRef<any>(null);
  const activeRoomRef = useRef<any>(null);

  const { mask } = useWordFilter(() => {
    if (activeRoomRef.current) fetchMessages(activeRoomRef.current.id);
  });

  const supabase = createClient();

  useEffect(() => {
    async function fetchRoomsData(profile: any) {
      let query = supabase.from('chat_rooms').select('*').order('created_at', { ascending: true });
      if (profile) {
         const isRoot = profile.username === 'mrsunshine88' || profile.auth_email === 'apersson508@gmail.com' || profile.perm_roles === true;
         const hasModeratorPerms = profile.perm_rooms || isRoot;
         const isAnyAdmin = profile.is_admin || hasModeratorPerms;

         if (hasModeratorPerms) {
             // Root och de med 'perm_rooms' (redigera chattrum) ser alla rum
         } else if (isAnyAdmin) {
             // Vanliga admins ser publika rum + egna inbjudningar + det speciella "Admin"-rummet
             let filter = `is_secret.eq.false,is_secret.is.null,allowed_users.cs.{${profile.id}},name.eq.Admin`;
             query = query.or(filter);
         } else {
             // För alla andra: Visa publika rum + rum de är inbjudna till
             let filter = `is_secret.eq.false,is_secret.is.null,allowed_users.cs.{${profile.id}}`;
             query = query.or(filter);
         }
      } else {
         query = query.or(`is_secret.eq.false,is_secret.is.null`);
      }
      return await query;
    }

    async function initialLoad() {
      try {
        // OPTIMERING: Hämta publika rum DIREKT för att slippa tom lista
        supabase.from('chat_rooms').select('*').or('is_secret.eq.false,is_secret.is.null').order('created_at', { ascending: true }).then(({data}) => {
           if (data) setRooms(data);
        });

        // 1. Hämta session och blockeringar
        const [sessionRes, bDataRes] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from('user_blocks').select('*')
        ]);

        const user = sessionRes.data.session?.user;
        if (!user) { /* Vänta på UserContext grace period */ return; }

        // 2. Hämta profil
        const { data: pData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const profile = pData;

        if (profile) {
          const fullProfile = { ...profile, auth_email: user.email };
          setCurrentUser(fullProfile);
          currentUserRef.current = fullProfile;

          // Hantera blockeringar
          if (bDataRes.data) {
            blockedIdsRef.current = bDataRes.data.map((b: any) => 
               b.blocker_id === user.id ? b.blocked_id : b.blocker_id
            );
          }

          // 3. Hämta utökad rumslista (inkl. privata/admin rum)
          const { data: roomsData } = await fetchRoomsData(fullProfile);
          if (roomsData) {
            setRooms(roomsData);
            if (urlRoomName) {
              const targetRoom = roomsData.find((r: any) => r.name === urlRoomName || r.id === urlRoomName);
              if (targetRoom) {
                if (targetRoom.password) {
                  const pw = prompt(`Rummet "${targetRoom.name}" är skyddat med lösenord. Ange lösenord för att komma in:`);
                  if (pw === targetRoom.password) setActiveRoom(targetRoom);
                  else alert('Skamvrån! Fel lösenord.');
                } else {
                  setActiveRoom(targetRoom);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Initial load error:", err);
      }
    }
    initialLoad();

    const roomsChannel = supabase.channel('realtime_rooms_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, async (payload: any) => {
         const { data } = await fetchRoomsData(currentUserRef.current);
         if (data) {
            setRooms(data);
            if (payload.event === 'DELETE' && activeRoomRef.current?.id === payload.old.id) {
               setActiveRoom(null);
               alert('Detta rummet har stängts eller raderats.');
            }
         }
      })
      .subscribe();

    return () => { supabase.removeChannel(roomsChannel); };
  }, [supabase, urlRoomName]);

  // Ref för att rums-lyssnaren ska veta vilket rum som är aktivt utan att ladda om hela listan
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  const handleJoinRoom = (room: any) => {
    if (activeRoom?.id === room.id) {
       setMobileDropdownOpen(false);
       return;
    }
    
    if (room.password) {
      const pw = prompt(`Rummet "${room.name}" är skyddat med lösenord. Ange lösenord för att komma in:`);
      if (pw !== room.password) {
        alert('Skamvrån! Fel lösenord.');
        return;
      }
    }
    
    setActiveRoom(room);
    setMessages([]);
    setMobileDropdownOpen(false);
  };

  useEffect(() => {
    if (!activeRoom || !currentUser) return;
    setOnlineUsers([]);
    fetchMessages(activeRoom.id);
    
    const roomChannel = supabase.channel(`room-${activeRoom.id}`, {
      config: { presence: { key: currentUser.id } },
    });
    channelRef.current = roomChannel;

    roomChannel
      .on('presence', { event: 'sync' }, () => {
        const state = roomChannel.presenceState();
        const users = Object.values(state).flatMap((presences: any) => presences.map((p: any) => p.user));
        const unique = [];
        const seen = new Set();
        for (const u of users) {
          if (u && !seen.has(u.id) && !blockedIdsRef.current.includes(u.id)) {
            seen.add(u.id);
            unique.push(u);
          }
        }
        setOnlineUsers(unique);
      })
      .on('broadcast', { event: 'new_message' }, () => { fetchMessages(activeRoom.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoom.id}` }, () => { fetchMessages(activeRoom.id); })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChannel.track({ user: { id: currentUser.id, username: currentUser.username } });
        }
      });

    return () => { roomChannel.untrack().then(() => { supabase.removeChannel(roomChannel); }); };
  }, [activeRoom, currentUser, supabase]);

  async function fetchMessages(roomId: string) {
    let blockedIds = blockedIdsRef.current;
    const { data } = await supabase.from('chat_messages').select('*, profiles(username)').eq('room_id', roomId).order('created_at', { ascending: true }).limit(100);
    if(data) {
      const filtered = data.filter((m: any) => !blockedIds.includes(m.author_id));
      setMessages(filtered);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }

  const isRoot = currentUser?.username === 'mrsunshine88' || currentUser?.auth_email === 'apersson508@gmail.com' || currentUser?.perm_roles === true;
  const isModerator = (currentUser?.perm_rooms === true || isRoot); // Kan se allt och radera inlägg
  const isOwner = activeRoom?.created_by === currentUser?.id;
  const isAdminRoom = activeRoom?.name?.toLowerCase() === 'admin';
  const isSpectator = activeRoom?.is_secret && isModerator && !isAdminRoom && !(activeRoom?.allowed_users?.includes(currentUser?.id));

  // Endast skaparen eller ROOT kan bjuda in/kicka i ett privat rum. 
  // Vanliga admins (som Helena) ska inte kunna "styra" någon annans privata rum om de bara är inbjudna.
  const canManageMembers = isOwner || isRoot; 


  const handleSend = async () => {
    if (!inputVal.trim() || !activeRoom || !currentUser) return;
    if (isSpectator && !isAdminRoom) {
       alert('Du är i moderator-läge och kan inte skriva i detta hemliga rum.');
       return;
    }
    const txt = inputVal.trim();
    setInputVal('');
    const { error } = await supabase.from('chat_messages').insert({ room_id: activeRoom.id, author_id: currentUser.id, content: txt });
    if (error) {
       if (error.message?.includes('DUPLICATE_LIMIT_REACHED')) { setShowDuplicateModal(true); return; }
       alert('Kunde inte skicka meddelande: ' + error.message);
       return;
    }

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: participants } = await supabase.from('chat_messages').select('author_id').eq('room_id', activeRoom.id).gt('created_at', fortyEightHoursAgo).limit(200);
    if (participants) {
       const uniqueIds = Array.from(new Set(participants.map(p => p.author_id))).filter(id => id !== currentUser.id && !blockedIdsRef.current.includes(id));
       if (uniqueIds.length > 0) {
          let preview = txt;
          if (preview.length > 20) preview = preview.substring(0, 20) + '...';
          const payloads = uniqueIds.map(uid => ({ receiver_id: uid, actor_id: currentUser.id, type: 'chat', content: `skrev i "${activeRoom.name}": "${preview}"`, link: `/chattrum?room=${encodeURIComponent(activeRoom.name)}` }));
          await supabase.from('notifications').insert(payloads);
          uniqueIds.forEach(uid => {
             fetch('/api/send-push', { method: 'POST', body: JSON.stringify({ userId: uid, title: `Facechat: Nytt i ${activeRoom.name}`, message: `${currentUser.username}: ${preview}`, url: `/chattrum?room=${encodeURIComponent(activeRoom.name)}` }), headers: { 'Content-Type': 'application/json' } }).catch(console.error);
          });
       }
    }
    await fetchMessages(activeRoom.id);
    if (channelRef.current) { channelRef.current.send({ type: 'broadcast', event: 'new_message', payload: {} }); }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if(!confirm('Ta bort detta meddelande från chatten?')) return;
    const { error } = await supabase.from('chat_messages').delete().eq('id', msgId);
    if (error) { alert(`Åtkomst nekad: Du har inte rättigheter att radera meddelanden. (${error.message})`); return; }
    if(isModerator) { await supabase.from('admin_logs').insert({ admin_id: currentUser.id, action: `Raderade ett chattmeddelande i rummet "${activeRoom?.name}"` }); }
    await fetchMessages(activeRoom.id);
    if (channelRef.current) { channelRef.current.send({ type: 'broadcast', event: 'new_message', payload: {} }); }
  };

  const handleReportMessage = async () => {
    if (!reportReason.trim() || !currentUser || !reportTarget) return;
    const finalReason = `[${reportCategory}] ${reportReason.trim()}`;
    const { error } = await supabase.from('reports').insert({ 
      reporter_id: currentUser.id, 
      reported_user_id: reportTarget.reportedUserId, 
      item_type: 'chat_message', 
      item_id: reportTarget.id, 
      reason: finalReason, 
      category: reportCategory, 
      status: 'open', 
      reported_content: `CHATT: ${activeRoom?.name}\n\n${reportTarget.content}` 
    });

    if (!error) {
       // Notifiera admins om den nya anmälan (med jäv-filter)
       const { data: admins } = await supabase.from('profiles').select('id, username').or('is_admin.eq.true,perm_content.eq.true');
       if (admins) {
          const filteredAdmins = admins.filter(admin => {
             const isReported = admin.id === reportTarget.reportedUserId;
             const isRoot = admin.username === 'mrsunshine88' || admin.username === 'apersson508';
             if (isReported && !isRoot) return false;
             return true;
          });

          const adminNotifs = filteredAdmins.map(admin => ({
             receiver_id: admin.id,
             actor_id: currentUser.id,
             type: 'report',
             content: `ny chatt-anmälan i rummet: ${activeRoom?.name || 'Okänt'}`,
             link: '/admin?tab=reports'
          }));
          await supabase.from('notifications').insert(adminNotifs);
       }
       alert('Din anmälan har skickats till våra moderatorer. Tack!');
    } else {
       alert('Kunde inte skicka anmälan: ' + error.message);
    }
    
    setShowReportModal(false); 
    setReportReason(''); 
    setReportTarget(null);
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom || !currentUser || isAdminRoom) return;
    if (activeRoom.is_secret && activeRoom.created_by === currentUser.id) {
       if ((activeRoom.allowed_users || []).length > 1) { alert('Du kan inte lämna rummet så länge det finns andra medlemmar kvar. Kicka dem först.'); return; }
       if (!confirm(`Om du lämnar kommer rummet att raderas. Vill du fortsätta?`)) return;
       await supabase.from('chat_rooms').delete().eq('id', activeRoom.id);
       setActiveRoom(null); return;
    }
    if (!confirm(`Vill du verkligen lämna rummet "${activeRoom.name}"?`)) return;
    await supabase.rpc('leave_chat_room', { p_room_id: activeRoom.id });
    
    // Skicka notis till rummets ägare om att någon lämnat
    if (activeRoom.created_by && activeRoom.created_by !== currentUser.id) {
       await supabase.from('notifications').insert({
          receiver_id: activeRoom.created_by,
          actor_id: currentUser.id,
          type: 'chat_user_left',
          content: `har lämnat rummet "${activeRoom.name}".`,
          link: `/chattrum?room=${encodeURIComponent(activeRoom.name)}`
       });
    }
    setActiveRoom(null);
  };

  const handleKickUser = async (targetId: string, targetName: string) => {
    if (!activeRoom || !currentUser || targetId === currentUser.id) return;
    if (!confirm(`Ska vi verkligen kicka ut ${targetName}?`)) return;

    const newAllowed = (activeRoom.allowed_users || []).filter((id: string) => id !== targetId);
    const willDeleteRoom = !isAdminRoom && newAllowed.length === 1 && newAllowed[0] === activeRoom.created_by;

    if (willDeleteRoom) {
       if (!confirm(`Om du kickar hen kommer rummet att raderas då inga medlemmar är kvar (förutom ägaren). Fortsätta?`)) return;
       
       // 1. Notis till den som kickas
       await supabase.from('notifications').insert({ 
          receiver_id: targetId, 
          actor_id: currentUser.id, 
          type: 'chat_kick', 
          content: `har tagit bort dig från rummet "${activeRoom.name}".`, 
          link: '/chattrum' 
       });

       // 2. Notis till ägaren om moderatorn stänger rummet
       if (activeRoom.created_by && activeRoom.created_by !== currentUser.id) {
          await supabase.from('notifications').insert({ 
             receiver_id: activeRoom.created_id || activeRoom.created_by, 
             actor_id: currentUser.id, 
             type: 'chat_room_closed', 
             content: `har stängt ner ditt rum "${activeRoom.name}" genom att kicka sista medlemmen (${targetName}).`, 
             link: '/chattrum' 
          });
       }

       // 3. Logg till admin
       if (isModerator) {
          await supabase.from('admin_logs').insert({ 
             admin_id: currentUser.id, 
             action: `MODERERING: Stängt rummet "${activeRoom.name}" och kickat ut ${targetName} (Ägare: ${activeRoom.created_by})` 
          });
       }

       // 4. Radera rummet
       await supabase.from('chat_rooms').delete().eq('id', activeRoom.id);
       setActiveRoom(null);
       return;
    }

    // Vanlig kick (fler medlemmar kvar)
    const { error } = await supabase.from('chat_rooms').update({ allowed_users: newAllowed }).eq('id', activeRoom.id);
    if (error) {
       alert('Kunde inte kicka användaren: ' + error.message);
       return;
    }

    setActiveRoom({ ...activeRoom, allowed_users: newAllowed });
    await supabase.from('notifications').insert({ receiver_id: targetId, actor_id: currentUser.id, type: 'chat_kick', content: `har tagit bort dig från rummet "${activeRoom.name}".`, link: '/chattrum' });
    
    // Logga om en moderator kickar någon i någon annans rum
    if (isModerator && activeRoom.created_by !== currentUser.id) {
       await supabase.from('admin_logs').insert({ admin_id: currentUser.id, action: `MODERERING: Kickat ut ${targetName} från rummet "${activeRoom.name}" (Ägare: ${activeRoom.created_by})` });
    }
  };

  const handleRenameRoom = async () => {
    if (!activeRoom) return;
    const newName = prompt('Ange nytt namn för rummet:', activeRoom.name);
    if (!newName || newName.trim() === activeRoom.name) return;
    const { error } = await supabase.from('chat_rooms').update({ name: newName.trim() }).eq('id', activeRoom.id);
    if (!error) setActiveRoom({ ...activeRoom, name: newName.trim() });
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const { data: roomId, error } = await supabase.rpc('create_chat_room', { p_name: newRoomName.trim(), p_is_secret: true });
    if (error) { alert('Kunde inte skapa rum: ' + error.message); }
    else { setShowCreateModal(false); setNewRoomName(''); }
  };

  const handleInviteUser = async (targetId: string, targetName: string) => {
    if (!activeRoom || !currentUser) return;
    const currentAllowed = activeRoom.allowed_users || [];
    if (currentAllowed.includes(targetId)) return;
    const newAllowed = [...currentAllowed, targetId];
    const { error } = await supabase.from('chat_rooms').update({ allowed_users: newAllowed }).eq('id', activeRoom.id);
    if (!error) {
       setActiveRoom({ ...activeRoom, allowed_users: newAllowed });
       await supabase.from('notifications').insert({ receiver_id: targetId, actor_id: currentUser.id, type: 'chat_invite', content: `har bjudit in dig till rummet "${activeRoom.name}"!`, link: `/chattrum?room=${encodeURIComponent(activeRoom.name)}` });
       
       // Logga om en moderator bjuder in någon i någon annans rum
       if (isModerator && activeRoom.created_by !== currentUser.id) {
          await supabase.from('admin_logs').insert({ admin_id: currentUser.id, action: `MODERERING: Bjudit in ${targetName} till rummet "${activeRoom.name}" (Ägare: ${activeRoom.created_by})` });
       }
    }
  };

  const openInviteModal = async () => {
     if (!currentUser) return;
     const { data: f1 } = await supabase.from('friendships').select('user_id_2, profiles:profiles!friendships_user_id_2_fkey(id, username)').eq('user_id_1', currentUser.id).eq('status', 'accepted');
     const { data: f2 } = await supabase.from('friendships').select('user_id_1, profiles:profiles!friendships_user_id_1_fkey(id, username)').eq('user_id_2', currentUser.id).eq('status', 'accepted');
     setFriends([...(f1?.map(f => f.profiles) || []), ...(f2?.map(f => f.profiles) || [])].filter(Boolean));
     setShowInviteModal(true);
  };

  return (
    <div style={{ height: 'calc(100vh - 140px)', display: 'grid', gridTemplateColumns: '250px 1fr 200px', gap: '1.5rem', alignItems: 'stretch' }} className="krypin-layout chat-layout">
      
      {/* Vänster: Rumlista (Desktop) */}
      <div className="card krypin-sidebar hide-on-mobile" style={{ margin: 0, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--text-main)', fontWeight: '600' }}>Rum (Realtime)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rooms.map(room => (
            <button key={room.id} onClick={() => handleJoinRoom(room)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', borderRadius: '12px', backgroundColor: activeRoom?.id === room.id ? 'var(--theme-chat)' : 'var(--bg-card)', color: activeRoom?.id === room.id ? 'white' : 'var(--text-main)', fontWeight: activeRoom?.id === room.id ? 'bold' : '500', border: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Hash size={18} opacity={activeRoom?.id === room.id ? 1 : 0.5} /> {room.name} {room.password && <Lock size={14} color={activeRoom?.id === room.id ? "white" : "#ef4444"} />}</span>
            </button>
          ))}
          <button onClick={() => setShowCreateModal(true)} style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', border: '2px dashed var(--theme-chat)', color: 'var(--theme-chat)', fontWeight: 'bold', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><PlusCircle size={20} /> Skapa privat rum</button>
        </div>
      </div>

      {/* Mitten: Chatt */}
      <div className={`card chat-main-card ${isSpectator ? 'spectator-mode' : ''}`} style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: isSpectator ? '3px solid #ef4444' : '1px solid var(--border-color)', boxShadow: isSpectator ? '0 0 20px rgba(239, 68, 68, 0.2)' : 'none' }}>
        
        {/* Mobile Header Toggle */}
        <div className="mobile-only-flex" style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: isSpectator ? '#fef2f2' : 'var(--bg-card)', alignItems: 'center', justifyContent: 'space-between' }}>
           <button onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--theme-chat)', fontWeight: '600' }}>
              #{activeRoom ? activeRoom.name : 'Byt Rum'} <ChevronDown size={14} style={{ transform: mobileDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
           </button>
           {activeRoom && activeRoom.is_secret && !isSpectator && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                 {canManageMembers && !isAdminRoom && (
                    <button onClick={openInviteModal} style={{ background: 'var(--theme-chat)', color: 'white', border: 'none', padding: '6px', borderRadius: '6px' }} title="Bjud in"><UserPlus size={16} /></button>
                 )}
                 {!isSpectator && !isAdminRoom && (
                    <button onClick={handleLeaveRoom} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px', borderRadius: '6px' }} title="Lämna"><LogOut size={16} /></button>
                 )}
              </div>
           )}
        </div>

        {/* Desktop Header */}
        <div className="hide-on-mobile" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: isSpectator ? '#fef2f2' : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
           <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: isSpectator ? '#ef4444' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             {activeRoom ? activeRoom.name : 'Välj ett rum'} {activeRoom?.password && <Lock size={16} color="#ef4444" />}
             {activeRoom?.created_by === currentUser?.id && !isAdminRoom && ( <button onClick={handleRenameRoom} style={{ background: 'none', border: 'none', color: 'var(--theme-chat)', cursor: 'pointer', padding: '4px' }} title="Byt namn"><Edit size={16} /></button> )}
             {isSpectator && <span style={{ fontSize: '0.8rem', backgroundColor: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '999px', marginLeft: '12px' }}>Moderator-läge</span>}
           </h2>
           {activeRoom && activeRoom.is_secret && !isSpectator && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                 {canManageMembers && !isAdminRoom && (
                    <button onClick={openInviteModal} style={{ backgroundColor: 'var(--theme-chat)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><UserPlus size={16} /> Bjud in</button>
                 )}
                 {!isSpectator && !isAdminRoom && (
                    <button onClick={handleLeaveRoom} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><LogOut size={16} /> Lämna</button>
                 )}
              </div>
           )}
        </div>

        {/* Mobile Room Selection Overlay */}
        {mobileDropdownOpen && (
          <div className="mobile-only-block" style={{ position: 'absolute', top: '50px', left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1.5rem', overflowY: 'auto', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
               <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '0.05rem' }}>TILLGÄNGLIGA RUM</div>
               <button onClick={() => setMobileDropdownOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', cursor: 'pointer' }}>
                  <XCircle size={20} />
               </button>
            </div>
            {rooms.map(room => (
               <button 
                  key={room.id} 
                  onClick={() => { handleJoinRoom(room); setMobileDropdownOpen(false); }} 
                  style={{ 
                    width: '100%', padding: '1.2rem', borderRadius: '16px', 
                    backgroundColor: activeRoom?.id === room.id ? 'var(--theme-chat)' : '#f1f5f9', 
                    color: activeRoom?.id === room.id ? 'white' : 'var(--text-main)', 
                    border: 'none', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontWeight: '600', fontSize: '1.1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
               >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <Hash size={20} opacity={0.6} /> {room.name}
                  </span>
                  {room.password && <Lock size={16} />}
               </button>
            ))}
            <div style={{ marginTop: 'auto', padding: '1rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
               Använd plus-knappen nere i hörnet för att skapa nya rum.
            </div>
          </div>
        )}

        {/* Messages Container */}
        <div className="chat-messages-container" style={{ flex: 1, minHeight: 0, padding: '1.5rem', overflowY: 'auto', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {activeRoom && messages.map(msg => (
             <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: msg.author_id === currentUser?.id ? 'var(--theme-chat)' : 'var(--text-main)', cursor: 'pointer' }} onClick={() => window.location.href=`/krypin?u=${msg.profiles?.username}`}>
                      {msg.profiles?.avatar_url && <img src={msg.profiles.avatar_url} loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
                      {msg.profiles?.username || 'Okänd'} <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>{new Date(msg.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                   <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {msg.author_id !== currentUser?.id && <button onClick={() => { setReportTarget({ id: msg.id, reportedUserId: msg.author_id, content: msg.content }); setShowReportModal(true); }} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}><AlertTriangle size={14}/></button>}
                      {msg.author_id === currentUser?.id && <button onClick={() => handleDeleteMessage(msg.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>}
                   </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', wordBreak: 'break-word' }}>{mask(msg.content)}</p>
             </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-wrapper" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', gap: '0.75rem' }}>
           <input type="text" value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder={isSpectator ? "Moderator-läge" : "Skriv..."} disabled={!activeRoom || (isSpectator && !isAdminRoom)} style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '999px', border: '1px solid var(--border-color)', outline: 'none' }} />
           <button onClick={handleSend} disabled={!activeRoom || (isSpectator && !isAdminRoom)} style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: (activeRoom && (!isSpectator || isAdminRoom)) ? 'var(--theme-chat)' : '#94a3b8', border: 'none', color: 'white', cursor: 'pointer' }}><Send size={18}/></button>
        </div>
      </div>

      {/* Höger: Deltagare */}
      <div className="card hide-on-mobile" style={{ margin: 0, padding: '1rem' }}>
         <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Online ({onlineUsers.length})</h3>
         {onlineUsers.map(user => (
            <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
               <span style={{ fontSize: '0.85rem' }}>{user.username}</span>
               {activeRoom?.is_secret && canManageMembers && !isSpectator && user.id !== currentUser?.id && (
                  <button onClick={() => handleKickUser(user.id, user.username)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Kicka användare"><XCircle size={14}/></button>
               )}
            </div>
         ))}
      </div>

      {/* Floating Plus Mobile */}
      <div className="mobile-only-block" style={{ position: 'fixed', bottom: '80px', left: '20px', zIndex: 60 }}>
         <button onClick={() => setShowCreateModal(true)} style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--theme-chat)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={28}/></button>
      </div>

      {/* MODALS */}
      {showReportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', borderRadius: '18px', backgroundColor: 'white' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}><AlertTriangle size={24}/> Anmäl Chattmeddelande</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.85rem' }}>Vad gällar anmälan? Välj en kategori och beskriv kortfattat vad som är fel.</p>
            
            <select 
              value={reportCategory}
              onChange={e => setReportCategory(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', marginBottom: '1rem', fontWeight: 'bold' }}
            >
              <option value="Spam">Spam/Nedskräpning</option>
              <option value="Hatretorik">Hatretorik/Kränkande</option>
              <option value="Trakasserier">Trakasserier/Mobbning</option>
              <option value="Olämpligt">Olämpligt Innehåll</option>
              <option value="Annat">Annat</option>
            </select>

            <textarea 
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', marginBottom: '1rem', outline: 'none' }}
              placeholder="Beskriv problemet..."
            ></textarea>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => { setShowReportModal(false); setReportReason(''); setReportTarget(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-muted)' }}>Avbryt</button>
              <button 
                onClick={handleReportMessage} 
                disabled={!reportReason.trim()} 
                style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: reportReason.trim() ? 'pointer' : 'not-allowed', opacity: reportReason.trim() ? 1 : 0.5 }}
              >
                Skicka Anmälan
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
         <form onSubmit={handleCreateRoom} className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', backgroundColor: 'white' }}>
            <h3>Skapa privat rum</h3>
            <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="Namn..." style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem' }} required />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
               <button type="button" onClick={() => setShowCreateModal(false)}>Avbryt</button>
               <button type="submit" style={{ backgroundColor: 'var(--theme-chat)', color: 'white' }}>Skapa</button>
            </div>
         </form>
      </div>}

      {showInviteModal && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
         <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', backgroundColor: 'white' }}>
            <h3>Bjud in vänner</h3>
            {friends.map(friend => {
               const isMember = activeRoom?.allowed_users?.includes(friend.id);
               return (
               <div key={friend.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '10px', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '600', alignSelf: 'center' }}>{friend.username}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                     {isMember ? (
                        <>
                           <span style={{ color: '#94a3b8', fontSize: '0.8rem', alignSelf: 'center', marginRight: '0.5rem' }}>Medlem</span>
                           {canManageMembers && friend.id !== currentUser?.id && (
                              <button 
                                 onClick={() => { if(confirm(`Kicka ${friend.username}?`)) handleKickUser(friend.id, friend.username); }}
                                 style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                 Kicka
                              </button>
                           )}
                        </>
                     ) : (
                        <button 
                           onClick={() => handleInviteUser(friend.id, friend.username)}
                           style={{ backgroundColor: 'var(--theme-chat)', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                           Lägg till
                        </button>
                     )}
                  </div>
               </div>
               );
            })}
            <button onClick={() => setShowInviteModal(false)}>Klar</button>
         </div>
      </div>}

      <style jsx global>{`
        .mobile-only-flex { display: none; }
        .mobile-only-block { display: none; }

        @media (max-width: 768px) {
           .chat-layout { height: calc(100vh - 70px) !important; display: flex !important; flex-direction: column !important; gap: 0 !important; }
           .hide-on-mobile { display: none !important; }
           .mobile-only-flex { display: flex !important; }
           .mobile-only-block { display: block !important; }
           
           @keyframes fadeIn {
             from { opacity: 0; transform: translateY(-10px); }
             to { opacity: 1; transform: translateY(0); }
           }
        }
      `}</style>
    </div>
  );
}
