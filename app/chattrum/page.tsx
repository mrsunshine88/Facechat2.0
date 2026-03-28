"use client"

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Send, Users, Hash, Lock, Trash2, ChevronDown, ChevronUp, ShieldAlert, AlertTriangle, LogOut, UserPlus, XCircle, Edit, PlusCircle } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
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
  const { mask } = useWordFilter();
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
  const channelRef = useRef<any>(null);
  const blockedIdsRef = useRef<string[]>([]);
  
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportCategory, setReportCategory] = useState('Spam');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [friends, setFriends] = useState<any[]>([]);

  useEffect(() => {
    if (!activeRoom && typeof window !== 'undefined' && window.innerWidth <= 768) {
       setMobileDropdownOpen(true);
    }
  }, [activeRoom]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    let currentProfile: any = null;

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profList } = await supabase.from('profiles').select('*').eq('id', user.id).limit(1);
        const profile = profList && profList.length > 0 ? profList[0] : null;
        const fullProfile = { ...profile, auth_email: user.email };
        setCurrentUser(fullProfile);
        return fullProfile;
      }
      return null;
    }

    async function fetchRoomsData(profile: any) {
      let query = supabase.from('chat_rooms').select('*').order('created_at', { ascending: true });
      if (profile) {
         const isRoot = profile.username === 'mrsunshine88' || profile.auth_email === 'apersson508@gmail.com' || profile.perm_roles === true;
         const isAdmin = profile.is_admin || profile.perm_rooms || isRoot;

         if (isRoot) {
             // Root ser allt - ingen ytterligare filtrering
         } else {
             // För alla andra: Visa publika rum + rum de är inbjudna till
             let filter = `is_secret.eq.false,is_secret.is.null,allowed_users.cs.{${profile.id}}`;
             
             // Special för administratörer: De ser alltid rum som heter "admin" (hemligt eller ej)
             if (isAdmin) {
                 filter += `,name.ilike.admin`;
             }
             
             query = query.or(filter);
         }
      } else {
         query = query.or(`is_secret.eq.false,is_secret.is.null`);
      }
      return await query;
    }

    // Initial load logic optimized to avoid double-prompts
    async function initialLoad() {
      const profile = await loadUser();
      currentProfile = profile;
      if (profile) {
         const { data: bData } = await supabase.from('user_blocks').select('*')
             .or(`blocker_id.eq.${profile.id},blocked_id.eq.${profile.id}`);
         if (bData) {
             blockedIdsRef.current = bData.map((b: any) => b.blocker_id === profile.id ? b.blocked_id : b.blocker_id);
         }
      }
      const { data } = await fetchRoomsData(profile);
      if (data) {
        setRooms(data);
        if (urlRoomName) {
           const targetRoom = data.find((r: any) => r.name === urlRoomName || r.id === urlRoomName);
           if (targetRoom) {
              if (targetRoom.password) {
                 const pw = prompt(`Rummet "${targetRoom.name}" är skyddat med lösenord. Ange lösenord för att komma in:`);
                 if (pw === targetRoom.password) {
                    setActiveRoom(targetRoom);
                 } else {
                    alert('Skamvrån! Fel lösenord.');
                 }
              } else {
                 setActiveRoom(targetRoom);
              }
           }
        }
      }
    }
    initialLoad();

    const roomsChannel = supabase.channel('realtime_rooms_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, async (payload: any) => {
         const { data } = await fetchRoomsData(currentProfile);
         if (data) {
            setRooms(data);
            // Om vårt aktiva rum raderades (t.ex. av admin)
            if (payload.event === 'DELETE' && activeRoom?.id === payload.old.id) {
               setActiveRoom(null);
               alert('Detta rummet har stängts eller raderats.');
            }
         }
      })
      .subscribe();

    return () => { supabase.removeChannel(roomsChannel); };
  }, [supabase, urlRoomName]);

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
    
    // Nollställ online-listan inför rumsbytet
    setOnlineUsers([]);
    
    fetchMessages(activeRoom.id);
    
    const roomChannel = supabase.channel(`room-${activeRoom.id}`, {
      config: {
        presence: { key: currentUser.id },
      },
    });
    
    channelRef.current = roomChannel;

    roomChannel
      .on('presence', { event: 'sync' }, () => {
        const state = roomChannel.presenceState();
        const users = Object.values(state).flatMap((presences: any) => 
           presences.map((p: any) => p.user)
        );
        const unique = [];
        const seen = new Set();
        for (const u of users) {
          if (!seen.has(u.id) && !blockedIdsRef.current.includes(u.id)) {
            seen.add(u.id);
            unique.push(u);
          }
        }
        setOnlineUsers(unique);
      })
      .on('broadcast', { event: 'new_message' }, () => {
        fetchMessages(activeRoom.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoom.id}` }, () => {
        fetchMessages(activeRoom.id);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChannel.track({
            user: { id: currentUser.id, username: currentUser.username }
          });
        }
      });

    return () => {
      // Tvinga omedelbar nedstängning av vår presence så vi inte spökar kvar
      roomChannel.untrack().then(() => {
         supabase.removeChannel(roomChannel);
      });
    };
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

  const handleSend = async () => {
    if (!inputVal.trim() || !activeRoom || !currentUser) return;

    // Admin Spectator Check
    const isRoot = currentUser?.username === 'mrsunshine88' || currentUser?.auth_email === 'apersson508@gmail.com' || currentUser?.perm_roles === true;
    const isAdmin = currentUser?.is_admin || currentUser?.perm_rooms || isRoot;
    const isAdminRoom = activeRoom?.name?.toLowerCase() === 'admin';
    const isSpectator = activeRoom?.is_secret && isAdmin && !isAdminRoom && !(activeRoom?.allowed_users?.includes(currentUser.id));

    if (isSpectator) {
       alert('Du är i moderator-läge och kan inte skriva i detta hemliga rum.');
       return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const txt = inputVal.trim();
    setInputVal('');
    const { error } = await supabase.from('chat_messages').insert({
      room_id: activeRoom.id,
      author_id: user.id,
      content: txt
    });

    if (error) {
       if (error.message?.includes('DUPLICATE_LIMIT_REACHED')) {
          setShowDuplicateModal(true);
          return;
       }
       alert('Kunde inte skicka meddelande: ' + error.message);
       return;
    }

    // PRESTANDAFIX: Hämta bara unika deltagare från de senaste 48 timmarna (max 200 rader)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: participants } = await supabase.from('chat_messages')
      .select('author_id')
      .eq('room_id', activeRoom.id)
      .gt('created_at', fortyEightHoursAgo)
      .limit(200);

    if (participants) {
       const uniqueIds = Array.from(new Set(participants.map(p => p.author_id))).filter(id => id !== currentUser.id && !blockedIdsRef.current.includes(id));
       if (uniqueIds.length > 0) {
          let preview = txt;
          if (preview.length > 20) preview = preview.substring(0, 20) + '...';
          
          const payloads = uniqueIds.map(uid => ({
             receiver_id: uid,
             actor_id: currentUser.id,
             type: 'chat',
             content: `skrev i "${activeRoom.name}": "${preview}"`,
             link: `/chattrum?room=${encodeURIComponent(activeRoom.name)}`
          }));
          await supabase.from('notifications').insert(payloads);

          uniqueIds.forEach(uid => {
             fetch('/api/send-push', {
               method: 'POST', body: JSON.stringify({
                 userId: uid,
                 title: `Facechat: Nytt i ${activeRoom.name}`,
                 message: `${currentUser.username}: ${preview}`,
                 url: `/chattrum?room=${encodeURIComponent(activeRoom.name)}`
               }), headers: { 'Content-Type': 'application/json' }
             }).catch(console.error);
          });
       }
    }

    await fetchMessages(activeRoom.id);
    
    // Broadcast to everyone else in the room to refresh
    if (channelRef.current) {
        channelRef.current.send({
            type: 'broadcast',
            event: 'new_message',
            payload: {}
        });
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if(!confirm('Ta bort detta meddelande från chatten?')) return;
    const { error } = await supabase.from('chat_messages').delete().eq('id', msgId);
    
    if (error) {
       alert(`Åtkomst nekad: Du har inte Chatt-Moderator (perm_rooms) behörighet för att radera meddelanden i databasen. (${error.message})`);
       return;
    }

    if(currentUser?.perm_rooms || currentUser?.auth_email?.toLowerCase() === 'apersson508@gmail.com') {
      await supabase.from('admin_logs').insert({
        admin_id: currentUser.id,
        action: `Raderade ett chattmeddelande i rummet "${activeRoom?.name}"`
      });
    }
    
    // Force a local refetch to ensure it disappears instantly
    await fetchMessages(activeRoom.id);
    
    // Broadcast delete to others
    if (channelRef.current) {
        channelRef.current.send({
            type: 'broadcast',
            event: 'new_message',
            payload: {}
        });
    }
  };

  const handleReportMessage = async () => {
    if (!reportReason.trim() || !currentUser || !reportTarget) return;
    
    const finalReason = `[${reportCategory}] ${reportReason.trim()}`;

    await supabase.from('reports').insert({
      reporter_id: currentUser.id,
      reported_user_id: reportTarget.reportedUserId,
      item_type: 'chat_message',
      item_id: reportTarget.id,
      reason: finalReason,
      category: reportCategory,
      status: 'open',
      reported_content: `CHATT: ${activeRoom?.name}\n\n${reportTarget.content}`
    });

    // Notifiera alla administratörer om den nya anmälan!
    try {
      const { data: admins } = await supabase.from('profiles').select('id, username')
        .or('is_admin.eq.true,perm_content.eq.true');
      
      if (admins && admins.length > 0) {
        // JÄVSFILTER: Anmäld admin ska inte se anmälan mot sig själv (undantaget Root)
        const filteredAdmins = admins.filter(admin => {
          const isReported = admin.id === reportTarget.reportedUserId;
          const isRoot = admin.username === 'mrsunshine88';
          if (isReported && !isRoot) return false;
          return true;
        });

        if (filteredAdmins.length > 0) {
          const adminNotifs = filteredAdmins.map(admin => ({
            receiver_id: admin.id,
            actor_id: currentUser.id,
            type: 'report',
            content: `har skickat in en ny anmälan från chatten (${activeRoom?.name}).`,
            link: '/admin?tab=reports'
          }));

          await supabase.from('notifications').insert(adminNotifs);

          // Skicka även push-notiser till admins
          filteredAdmins.forEach(admin => {
            fetch('/api/send-push', {
              method: 'POST', body: JSON.stringify({
                userId: admin.id,
                title: 'Ny anmälan i Chatten!',
                message: `${currentUser.username} har anmält ett chatt-meddelande.`,
                url: '/admin?tab=reports'
              }), headers: { 'Content-Type': 'application/json' }
            });
          });
        }
      }
    } catch (notifErr) {
      console.error("Misslyckades att notifiera admins:", notifErr);
    }

    alert('Din anmälan har skickats till våra moderatorer. Tack!');
    setShowReportModal(false);
    setReportReason('');
    setReportTarget(null);
  };

  const isRoot = currentUser?.username === 'mrsunshine88' || currentUser?.auth_email === 'apersson508@gmail.com' || currentUser?.perm_roles === true;
  const isAdmin = currentUser?.is_admin || currentUser?.perm_rooms || isRoot;
  const isAdminRoom = activeRoom?.name?.toLowerCase() === 'admin';

  const handleLeaveRoom = async () => {
    if (!activeRoom || !currentUser) return;
    
    // Admin-rum kan aldrig lämnas/raderas så här
    if (isAdminRoom) {
       alert('Du kan inte lämna det officiella Admin-rummet.');
       return;
    }

    // Om det är ett hemligt rum och användaren är skaparen
    if (activeRoom.is_secret && activeRoom.created_by === currentUser.id) {
       const othersCount = (activeRoom.allowed_users || []).length - 1;
       if (othersCount > 0) {
          alert('Du kan inte lämna rummet så länge det finns andra medlemmar kvar. Kicka dem först eller be en admin ta bort rummet.');
          return;
       }
       if (!confirm(`Du är ensam kvar i "${activeRoom.name}". Om du lämnar kommer rummet att raderas permanent. Vill du fortsätta?`)) return;
       
       // Radera rummet
       const { error } = await supabase.from('chat_rooms').delete().eq('id', activeRoom.id);
       if (error) alert('Kunde inte radera rummet: ' + error.message);
       else {
          setActiveRoom(null);
          alert('Rummet har raderats.');
       }
       return;
    }

    if (!confirm(`Vill du verkligen lämna rummet "${activeRoom.name}"?`)) return;

    const { error } = await supabase.rpc('leave_chat_room', { p_room_id: activeRoom.id });
    if (error) {
       alert('Kunde inte lämna rummet: ' + error.message);
    } else {
       // Om rummet nu bara har ägaren kvar, radera det (Självdestruktion)
       const { data: updatedRoom } = await supabase.from('chat_rooms').select('allowed_users, created_by').eq('id', activeRoom.id).single();
       if (updatedRoom && updatedRoom.allowed_users.length === 1 && updatedRoom.allowed_users[0] === updatedRoom.created_by) {
          await supabase.from('chat_rooms').delete().eq('id', activeRoom.id);
       }
       
       setActiveRoom(null);
       alert(`Du har lämnat "${activeRoom.name}".`);
    }
  };

  const handleKickUser = async (targetId: string, targetName: string) => {
    if (!activeRoom || !currentUser) return;
    if (targetId === currentUser.id) {
       handleLeaveRoom();
       return;
    }
    
    if (!confirm(`Ska vi verkligen kicka ut ${targetName} från detta rummet?`)) return;

    const newAllowed = (activeRoom.allowed_users || []).filter((id: string) => id !== targetId);
    
    // Om bara ägaren är kvar efter kicken -> Radera rummet (Självdestruktion)
    // UNDANTAG: Radera ALDRIG admin-rummet!
    if (!isAdminRoom && newAllowed.length === 1 && newAllowed[0] === activeRoom.created_by) {
       if (confirm(`${targetName} är sista medlemmen. Om du kickar hen kommer rummet "${activeRoom.name}" att raderas permanent. Fortsätta?`)) {
          const { error } = await supabase.from('chat_rooms').delete().eq('id', activeRoom.id);
          if (error) alert('Kunde inte radera rummet: ' + error.message);
          else {
             setActiveRoom(null);
             alert(`${targetName} kickades och rummet stängdes.`);
          }
       }
       return;
    }

    const { error } = await supabase.from('chat_rooms').update({
       allowed_users: newAllowed
    }).eq('id', activeRoom.id);

    if (error) {
       alert('Kunde inte sparka ut användaren: ' + error.message);
       return;
    }

    // Uppdatera lokalt tillstånd direkt
    setActiveRoom({ ...activeRoom, allowed_users: newAllowed });

    // Skicka notis till den som blev kickad
    await supabase.from('notifications').insert({
       receiver_id: targetId,
       actor_id: currentUser.id,
       type: 'chat_kick',
       content: `har tagit bort dig från det hemliga rummet "${activeRoom.name}".`,
       link: '/chattrum'
    });

    alert(`${targetName} har blivit utkickad.`);
  };

  const handleRenameRoom = async () => {
    if (!activeRoom || !currentUser) return;
    const newName = prompt('Ange nytt namn för rummet:', activeRoom.name);
    if (!newName || newName.trim() === activeRoom.name) return;

    const { error } = await supabase.from('chat_rooms').update({
       name: newName.trim()
    }).eq('id', activeRoom.id);

    if (error) {
       alert('Kunde inte byta namn: ' + error.message);
    } else {
       alert('Rummet har bytt namn!');
       setActiveRoom({ ...activeRoom, name: newName.trim() });
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const { data: roomId, error } = await supabase.rpc('create_chat_room', { 
       p_name: newRoomName.trim(), 
       p_is_secret: true 
    });

    if (error) {
       if (error.message.includes('DUPLICATE_LIMIT_REACHED')) {
          alert('Gräns nådd: Du kan max ha 2 egna chattrum samtidigt.');
       } else {
          alert('Kunde inte skapa rum: ' + error.message);
       }
    } else {
       alert(`Rummet "${newRoomName}" har skapats!`);
       setShowCreateModal(false);
       setNewRoomName('');
       // Rummet dyker upp via realtime-lyssnaren
    }
  };

  const handleInviteUser = async (targetId: string, targetName: string) => {
    if (!activeRoom || !currentUser) return;
    
    const currentAllowed = activeRoom.allowed_users || [];
    if (currentAllowed.includes(targetId)) {
       alert(`${targetName} är redan med i rummet!`);
       return;
    }

    const newAllowed = [...currentAllowed, targetId];
    
    const { error } = await supabase.from('chat_rooms').update({
       allowed_users: newAllowed
    }).eq('id', activeRoom.id);

    if (error) {
       alert('Kunde inte bjuda in användaren: ' + error.message);
       return;
    }

    // Uppdatera lokalt tillstånd direkt så knappen ändras till "Medlem"
    setActiveRoom({ ...activeRoom, allowed_users: newAllowed });

    // Skicka notis till den inbjudna
    await supabase.from('notifications').insert({
       receiver_id: targetId,
       actor_id: currentUser.id,
       type: 'chat_invite',
       content: `har bjudit in dig till rummet "${activeRoom.name}"!`,
       link: `/chattrum?room=${encodeURIComponent(activeRoom.name)}`
    });

    alert(`${targetName} har lagts till i rummet.`);
  };

  const openInviteModal = async () => {
     if (!currentUser) return;
     // Hämta vänner att bjuda in
     const { data: f1 } = await supabase.from('friendships').select('user_id_2, profiles:profiles!friendships_user_id_2_fkey(id, username)').eq('user_id_1', currentUser.id).eq('status', 'accepted');
     const { data: f2 } = await supabase.from('friendships').select('user_id_1, profiles:profiles!friendships_user_id_1_fkey(id, username)').eq('user_id_2', currentUser.id).eq('status', 'accepted');
     
     const friendProfiles = [
        ...(f1?.map(f => f.profiles) || []),
        ...(f2?.map(f => f.profiles) || [])
     ].filter(p => p !== null);

     setFriends(friendProfiles);
     setShowInviteModal(true);
  };

  return (
    <div style={{ height: 'calc(100vh - 140px)', display: 'grid', gridTemplateColumns: '250px 1fr 200px', gap: '1.5rem', alignItems: 'stretch' }} className="krypin-layout chat-layout">
      
      {/* Vänster: Rumlista (Desktop) */}
      <div className="card krypin-sidebar hide-on-mobile" style={{ margin: 0, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--text-main)', fontWeight: '600' }}>Rum (Realtime)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rooms.map(room => (
            <button 
              key={room.id}
              onClick={() => handleJoinRoom(room)}
              style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.875rem 1rem', borderRadius: '12px',
                backgroundColor: activeRoom?.id === room.id ? 'var(--theme-chat)' : 'var(--bg-card)',
                color: activeRoom?.id === room.id ? 'white' : 'var(--text-main)',
                fontWeight: activeRoom?.id === room.id ? '600' : '500',
                border: activeRoom?.id === room.id ? '1px solid var(--theme-chat)' : '1px solid var(--border-color)',
                boxShadow: activeRoom?.id === room.id ? '0 4px 12px rgba(59,130,246,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1rem' }}>
                <Hash size={18} opacity={activeRoom?.id === room.id ? 1 : 0.5} /> {room.name.length > 15 ? room.name.substring(0,15)+'...' : room.name} {room.password && <Lock size={14} color={activeRoom?.id === room.id ? "white" : "#ef4444"} />}
              </span>
            </button>
          ))}
          
          <button 
            onClick={() => setShowCreateModal(true)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.875rem 1rem', borderRadius: '12px',
              backgroundColor: 'white', color: 'var(--theme-chat)',
              fontWeight: 'bold', border: '2px dashed var(--theme-chat)',
              cursor: 'pointer', marginTop: '1rem', transition: 'all 0.2s'
            }}
          >
            <PlusCircle size={20} /> Skapa privat rum
          </button>
        </div>
      </div>

      {/* Mitten: Chatt */}
      {(() => {
        const isSpectator = activeRoom?.is_secret && isAdmin && !(activeRoom?.allowed_users?.includes(currentUser?.id));

        return (
          <div 
            className={`card chat-main-card ${isSpectator ? 'spectator-mode' : ''}`} 
            style={{ 
              margin: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              border: isSpectator ? '3px solid #ef4444' : '1px solid var(--border-color)',
              boxShadow: isSpectator ? '0 0 20px rgba(239, 68, 68, 0.2)' : 'none'
            }}
          >
            
            {/* Mobile-only Header Dropdown Button */}
            <div className="mobile-only-flex" style={{ position: 'sticky', top: '70px', padding: '1rem 1.5rem', backgroundColor: isSpectator ? '#ef4444' : 'var(--theme-chat)', color: 'white', display: 'none', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 10 }} onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}>
               <span style={{ fontWeight: 'bold', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Hash size={20} /> {activeRoom ? activeRoom.name : 'Välj chattrum'} {isSpectator && <span style={{ fontSize: '0.7rem', backgroundColor: 'white', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px' }}>MODERATOR</span>}
               </span>
               <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 'normal', backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.4rem 0.8rem', borderRadius: '999px' }}>
                  {activeRoom ? 'Ändra' : 'Välj'} {mobileDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
               </span>
            </div>

            {/* Mobile Dropdown Menu content */}
            {mobileDropdownOpen && (
               <div className="mobile-only-block" style={{ position: 'sticky', top: '130px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', padding: '1rem', display: 'none', flexDirection: 'column', gap: '0.5rem', maxHeight: '60vh', overflowY: 'auto', zIndex: 9, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>TILLGÄNGLIGA RUM</div>
                  {rooms.map(room => (
                     <button 
                      key={room.id}
                      onClick={(e) => { e.stopPropagation(); handleJoinRoom(room); setMobileDropdownOpen(false); }}
                      style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '1rem', borderRadius: '12px',
                        backgroundColor: activeRoom?.id === room.id ? 'var(--theme-chat)' : 'white',
                        color: activeRoom?.id === room.id ? 'white' : 'var(--text-main)',
                        fontWeight: activeRoom?.id === room.id ? 'bold' : '500',
                        border: '1px solid #e2e8f0',
                        textAlign: 'left', cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                     >
                       <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem' }}>
                         <Hash size={20} opacity={activeRoom?.id === room.id ? 1 : 0.5} /> {room.name} {room.password && <Lock size={16} color={activeRoom?.id === room.id ? "white" : "#ef4444"} />}
                       </span>
                     </button>
                  ))}
               </div>
            )}

            {/* Desktop Header */}
            <div className="hide-on-mobile" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: isSpectator ? '#fef2f2' : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: isSpectator ? '#ef4444' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 {activeRoom ? activeRoom.name : 'Välj ett rum i listan'}
                 {activeRoom?.password && <Lock size={16} color="#ef4444" />}
                 {activeRoom?.created_by === currentUser?.id && !isAdminRoom && (
                    <button onClick={handleRenameRoom} style={{ background: 'none', border: 'none', color: 'var(--theme-chat)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }} title="Byt namn på rummet">
                       <Edit size={16} />
                    </button>
                 )}
                 {(isSpectator || (isAdminRoom && !isAdmin)) && <span style={{ fontSize: '0.8rem', backgroundColor: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '999px', marginLeft: '12px' }}>Moderator-läge (Endast läsa)</span>}
               </h2>

               {/* Header Actions (Leave/Invite) */}
               {activeRoom && activeRoom.is_secret && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                     {(activeRoom.created_by === currentUser?.id || isAdmin) && !isAdminRoom && (
                        <button 
                           onClick={openInviteModal}
                           style={{ backgroundColor: 'var(--theme-chat)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                           title="Bjud in vänner"
                        >
                           <UserPlus size={16} /> Bjud in
                        </button>
                     )}
                     {!isSpectator && !isAdminRoom && (
                        <button 
                           onClick={handleLeaveRoom}
                           style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                           title="Lämna rummet"
                        >
                           <LogOut size={16} /> Lämna
                        </button>
                     )}
                  </div>
               )}
            </div>
            
            <div className="chat-messages-container" style={{ flex: 1, minHeight: 0, padding: '1.5rem', overflowY: 'auto', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
              
              {(!activeRoom || mobileDropdownOpen) && (
                 <div className="mobile-blur-overlay mobile-only-block" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)', zIndex: 10, display: 'none' }} onClick={() => {if(activeRoom) setMobileDropdownOpen(false)}}></div>
              )}

              <div style={{ alignSelf: 'center', backgroundColor: '#e2e8f0', padding: '0.25rem 1rem', borderRadius: '999px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Välkommen till {activeRoom ? activeRoom.name : 'Chatten'}! (Realtime)
              </div>

              {!activeRoom && (
                <p className="hide-on-mobile" style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem', padding: '2rem' }}>Du måste ansluta till ett rum i listan till vänster för att kunna chatta.</p>
              )}

              {activeRoom && messages.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>Rummet ekar tomt...</p>
              )}
              
              {messages.map(msg => {
                 const timeStr = new Date(msg.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                 const isOwn = msg.author_id === currentUser?.id;
                 const canModerate = isOwn || isAdmin;

                 return (
                   <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                       <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isOwn ? 'var(--theme-chat)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span className="user-link" onClick={() => window.location.href = `/krypin?u=${msg.profiles?.username}`} style={{ cursor: 'pointer', fontWeight: 'bold' }}>{msg.profiles?.username || 'Okänd'}</span> <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>{timeStr}</span>
                       </span>
                       <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                         {!isOwn && (
                           <button 
                             onClick={() => {
                               setReportTarget({ id: msg.id, reportedUserId: msg.author_id, content: msg.content });
                               setShowReportModal(true);
                             }}
                             style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} 
                             className="fb-action-btn"
                             title="Anmäl meddelande"
                           >
                             <AlertTriangle size={16} />
                           </button>
                         )}
                         {canModerate && (
                           <button onClick={() => handleDeleteMessage(msg.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.6 }} title="Radera inlägg">
                             <Trash2 size={14} />
                           </button>
                         )}
                       </div>
                     </div>
                     <p style={{ color: 'var(--text-main)', margin: 0, wordBreak: 'break-word' }}>{mask(msg.content)}</p>
                   </div>
                 );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-wrapper" style={{ position: 'sticky', bottom: 0, padding: '1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', gap: '0.75rem', zIndex: 5 }}>
              <input 
                type="text" 
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={isSpectator ? "Moderator-läge: Endast läsrättigheter" : (activeRoom ? `Skriv i ${activeRoom.name}...` : 'Låst. Välj ett rum först!')}
                disabled={!activeRoom || (isSpectator && !isAdminRoom)}
                style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '999px', fontFamily: 'inherit', outline: 'none', backgroundColor: (activeRoom && (!isSpectator || isAdminRoom)) ? 'white' : '#e2e8f0' }}
              />
              <button onClick={handleSend} disabled={!activeRoom || (isSpectator && !isAdminRoom)} style={{ backgroundColor: (activeRoom && (!isSpectator || isAdminRoom)) ? 'var(--theme-chat)' : '#94a3b8', border: 'none', cursor: (activeRoom && (!isSpectator || isAdminRoom)) ? 'pointer' : 'not-allowed', color: 'white', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={18} style={{ marginLeft: '-2px', marginTop: '1px' }} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Höger: Deltagare */}
      <div className="card hide-on-mobile" style={{ margin: 0, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-main)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={16} /> Online ({onlineUsers.length})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          {onlineUsers.map(user => (
            <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: user.id === currentUser?.id ? 'var(--theme-chat)' : 'var(--text-main)' }}>
                  {user.id === currentUser?.id ? 'Du' : `${user.username}`}
                </span>
              </div>

              {/* Kick button for Owner/Admin */}
              {activeRoom?.is_secret && (activeRoom.created_by === currentUser?.id || isAdmin) && user.id !== currentUser?.id && (
                 <button 
                    onClick={() => handleKickUser(user.id, user.username)}
                    style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={`Kicka ${user.username}`}
                 >
                    <XCircle size={14} />
                 </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* REPORT MODAL */}
      {showReportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', borderRadius: '18px', backgroundColor: 'white' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}><AlertTriangle size={24}/> Anmäl Innehåll</h3>
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
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: reportReason.trim() ? 'pointer' : 'not-allowed', opacity: reportReason.trim() ? 1 : 0.5 }}
              >
                Skicka Anmälan
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media (max-width: 768px) {
          .chat-layout {
             height: calc(100dvh - 70px) !important;
             display: flex !important;
             flex-direction: column !important;
             gap: 0 !important;
          }
          .krypin-sidebar { display: none !important; }
          .hide-on-mobile { display: none !important; }
          
          .mobile-only-flex { display: flex !important; }
          .mobile-only-block { display: block !important; }
          
          .chat-main-card {
             flex: 1 !important;
             min-height: 0 !important;
             overflow: visible !important;
             border-radius: 0 !important;
             border: none !important;
             box-shadow: none !important;
          }

          @keyframes modalBounce {
            0% { transform: scale(0.8); opacity: 0; }
            70% { transform: scale(1.05); }
            100% { transform: scale(1); opacity: 1; }
          }
        }
      `}</style>

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onSubmit={handleCreateRoom} className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', borderRadius: '18px', backgroundColor: 'white' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--theme-chat)' }}><PlusCircle size={24}/> Skapa privat rum</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>Ge ditt rum ett namn. Du kan max ha 2 egna rum samtidigt.</p>
            
            <input 
              type="text" 
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              placeholder="T.ex. Hemliga Klubben"
              required
              autoFocus
              maxLength={30}
              style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', outline: 'none', fontSize: '1rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-muted)' }}>Avbryt</button>
              <button 
                type="submit"
                style={{ background: 'var(--theme-chat)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Skapa Rum
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REPORT MODAL */}
      {showReportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', borderRadius: '18px', backgroundColor: 'white' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}><AlertTriangle size={24}/> Anmäl Meddelande</h3>
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

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', borderRadius: '18px', backgroundColor: 'white' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--theme-chat)' }}><UserPlus size={24}/> Bjud in Vänner</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>Välj en vän att lägga till i rummet "{activeRoom?.name}". De kommer få en notis om inbjudan.</p>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
               {friends.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Du har inga vänner att bjuda in ännu...</p>
               ) : (
                  friends.map(friend => {
                     const isMember = (activeRoom?.allowed_users || []).includes(friend.id);
                     return (
                        <div key={friend.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                           <span style={{ fontWeight: '600' }}>{friend.username}</span>
                           <button 
                              onClick={() => handleInviteUser(friend.id, friend.username)}
                              disabled={isMember}
                              style={{ 
                                 backgroundColor: isMember ? '#e2e8f0' : 'var(--theme-chat)', 
                                 color: isMember ? '#94a3b8' : 'white', 
                                 border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', 
                                 cursor: isMember ? 'default' : 'pointer' 
                              }}
                           >
                              {isMember ? 'Medlem' : 'Lägg till'}
                           </button>
                        </div>
                     );
                  })
               )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'var(--theme-chat)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Slutför</button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE WARNING MODAL */}
      {showDuplicateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowDuplicateModal(false)}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem 2rem', textAlign: 'center', borderRadius: '24px', position: 'relative', border: '2px solid #ef4444', animation: 'modalBounce 0.4s ease-out', backgroundColor: 'white' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '80px', height: '80px', backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <ShieldAlert size={40} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--text-main)' }}>Hoppsan! 👋</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '1.1rem', marginBottom: '2rem' }}>
              Du verkar skicka samma sak många gånger. <br/><strong>Vänta lite eller skriv något nytt istället!</strong>
            </p>
            <button 
              onClick={() => setShowDuplicateModal(false)}
              style={{ width: '100%', backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '1rem', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
            >
              Jag fattar!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
