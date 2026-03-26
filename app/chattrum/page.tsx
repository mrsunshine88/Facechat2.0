"use client"

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Send, Users, Hash, Lock, Trash2, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';

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
  const channelRef = useRef<any>(null);
  const blockedIdsRef = useRef<string[]>([]);

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
         const isAdmin = profile.is_admin || profile.auth_email === 'apersson508@gmail.com' || profile.perm_rooms;
         if (!isAdmin) {
             query = query.or(`is_secret.eq.false,is_secret.is.null,allowed_users.cs.{${profile.id}}`);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, async () => {
         const { data } = await fetchRoomsData(currentProfile);
         if (data) setRooms(data);
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
    
    fetchMessages(activeRoom.id, activeRoom.is_friends_only);
    
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
        fetchMessages(activeRoom.id, activeRoom.is_friends_only);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoom.id}` }, () => {
        fetchMessages(activeRoom.id, activeRoom.is_friends_only);
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

  async function fetchMessages(roomId: string, isFriendsOnly: boolean) {
    let blockedIds = blockedIdsRef.current;

    if (isFriendsOnly && currentUser) {
      const { data: f1 } = await supabase.from('friendships').select('user_id_2').eq('user_id_1', currentUser.id).eq('status', 'accepted');
      const { data: f2 } = await supabase.from('friendships').select('user_id_1').eq('user_id_2', currentUser.id).eq('status', 'accepted');
      const friendIds = [...(f1?.map(f => f.user_id_2) || []), ...(f2?.map(f => f.user_id_1) || []), currentUser.id];
      const safeIds = friendIds.filter(id => !blockedIds.includes(id));
      
      const { data } = await supabase.from('chat_messages').select('*, profiles(username)').eq('room_id', roomId).in('author_id', safeIds).order('created_at', { ascending: true }).limit(100);
      if(data) {
        setMessages(data);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } else {
      const { data } = await supabase.from('chat_messages').select('*, profiles(username)').eq('room_id', roomId).order('created_at', { ascending: true }).limit(100);
      if(data) {
        const filtered = data.filter((m: any) => !blockedIds.includes(m.author_id));
        setMessages(filtered);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }

  const handleSend = async () => {
    if (!inputVal.trim() || !activeRoom || !currentUser) return;
    const txt = inputVal.trim();
    setInputVal('');
    const { error } = await supabase.from('chat_messages').insert({
      room_id: activeRoom.id,
      author_id: currentUser.id,
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

    const { data: participants } = await supabase.from('chat_messages').select('author_id').eq('room_id', activeRoom.id);
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

    await fetchMessages(activeRoom.id, activeRoom.is_friends_only);
    
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
    await fetchMessages(activeRoom.id, activeRoom.is_friends_only);
    
    // Broadcast delete to others
    if (channelRef.current) {
        channelRef.current.send({
            type: 'broadcast',
            event: 'new_message',
            payload: {}
        });
    }
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
                <Hash size={18} opacity={activeRoom?.id === room.id ? 1 : 0.5} /> {room.name} {room.password && <Lock size={14} color={activeRoom?.id === room.id ? "white" : "#ef4444"} />}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Mitten: Chatt */}
      <div className="card chat-main-card" style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Mobile-only Header Dropdown Button */}
        <div className="mobile-only-flex" style={{ position: 'sticky', top: '70px', padding: '1rem 1.5rem', backgroundColor: 'var(--theme-chat)', color: 'white', display: 'none', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 10 }} onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}>
           <span style={{ fontWeight: 'bold', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hash size={20} /> {activeRoom ? activeRoom.name : 'Välj chattrum'}
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
        <div className="hide-on-mobile" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center' }}>
           <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             {activeRoom ? activeRoom.name : 'Välj ett rum i listan'}
             {activeRoom?.password && <Lock size={16} color="#ef4444" />}
           </h2>
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
             const canModerate = isOwn;

             return (
               <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                   <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isOwn ? 'var(--theme-chat)' : 'var(--text-main)' }}>
                      <span className="user-link" onClick={() => window.location.href = `/krypin?u=${msg.profiles?.username}`} style={{ cursor: 'pointer', fontWeight: 'bold' }}>{msg.profiles?.username || 'Okänd'}</span> <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>{timeStr}</span>
                   </span>
                   {canModerate && (
                     <button onClick={() => handleDeleteMessage(msg.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.6 }} title="Radera inlägg">
                       <Trash2 size={14} />
                     </button>
                   )}
                 </div>
                 <p style={{ color: 'var(--text-main)', margin: 0, wordBreak: 'break-word' }}>{msg.content}</p>
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
            placeholder={activeRoom ? `Skriv i ${activeRoom.name}...` : 'Låst. Välj ett rum först!'}
            disabled={!activeRoom}
            style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '999px', fontFamily: 'inherit', outline: 'none', backgroundColor: activeRoom ? 'white' : '#e2e8f0' }}
          />
          <button onClick={handleSend} disabled={!activeRoom} style={{ backgroundColor: activeRoom ? 'var(--theme-chat)' : '#94a3b8', border: 'none', cursor: activeRoom ? 'pointer' : 'not-allowed', color: 'white', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={18} style={{ marginLeft: '-2px', marginTop: '1px' }} />
          </button>
        </div>
      </div>

      {/* Höger: Deltagare */}
      <div className="card hide-on-mobile" style={{ margin: 0, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-main)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={16} /> Online ({onlineUsers.length})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          {onlineUsers.map(user => (
            <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
              <span style={{ fontSize: '0.875rem', fontWeight: '500', color: user.id === currentUser?.id ? 'var(--theme-chat)' : 'var(--text-main)' }}>
                {user.id === currentUser?.id ? 'Du' : `${user.username}`}
              </span>
            </div>
          ))}
        </div>
      </div>

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

      {/* DUPLICATE WARNING MODAL */}
      {showDuplicateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowDuplicateModal(false)}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem 2rem', textAlign: 'center', borderRadius: '24px', position: 'relative', border: '2px solid #ef4444', animation: 'modalBounce 0.4s ease-out' }} onClick={e => e.stopPropagation()}>
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
