"use client"

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User, MessageSquare, MessagesSquare, LayoutGrid, Search, Bell, LogOut, ShieldAlert, Settings, Menu, X, Home } from 'lucide-react'
import { logoutAction, syncUserHeartbeatAction } from '@/app/actions/securityActions'
import { getUnreadSupportCountAction, getUserBlocksAction } from '@/app/actions/userActions'


import { getSoundUrl } from '@/utils/sounds'
import { useUser } from './UserContext'

const ROOT_EMAILS = ['apersson508@gmail.com'];

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const isAdminRoute = pathname?.startsWith('/admin')
  const isLoginRoute = pathname === '/login' || pathname === '/update-password'
  const isBlockedRoute = pathname === '/blocked'

  const [showDropdown, setShowDropdown] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, profile, loading: userLoading } = useUser()
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isAndroid, setIsAndroid] = useState(false)
  
  const lastAdminFetch = useRef<number>(0);
  const lastHeartbeatRef = useRef<number>(0);
  const isLoggingOut = useRef(false);

  const supabase = createClient()


  useEffect(() => {
    if (isBlockedRoute || !profile) {
       if (!profile) setUserProfile(null);
       return;
    }
    
    // UI UPDATES ONLY (Runs on page change)
    async function syncHeaderUI() {
       setIsAndroid(/android/i.test(navigator.userAgent));
       setUserProfile({ ...profile, auth_email: user?.email });
       
       // Hämta olästa support-ärenden (Bara vid sidbyte för att hålla siffran aktuell)
       getUnreadSupportCountAction().then(res => {
         if (res && typeof res.count === 'number') {
            setUnreadSupportCount(res.count);
         }
       });
    }
    syncHeaderUI();
  }, [pathname, profile, user]);

  // BACKGROUND SECURITY HEARTBEAT (Runs once on mount + every 60s)
  // Fixar "0 inloggade" felet i Admin genom att faktiskt uppdatera databasen!
  useEffect(() => {
    if (!user || isBlockedRoute || isLoginRoute || userLoading) return;
    
    const sendHeartbeat = async () => {
      try {
        // Kontrollera sessionens giltighet (Nyckel A vs Nyckel B) var 60:e sekund
        const res = await syncUserHeartbeatAction(user.id);
        
        // Om sessionen inte matchar (t.ex. mobilen loggat in), kasta ut datorn lugnt och fint.
        const isRoot = profile?.is_root || profile?.auth_email === 'apersson508@gmail.com';
        if (res?.error === 'Inaktiv session' && !isRoot) {
           console.warn('[Heartbeat] Session mismatch detected. Safety logout triggered.');
           handleLogout();
        }
      } catch (err) {}
    };

    sendHeartbeat(); // Direkt vid start (när profile laddat)
    const interval = setInterval(sendHeartbeat, 60000); // Varje minut
    
    return () => clearInterval(interval);
  }, [user?.id, isBlockedRoute, isLoginRoute, userLoading, profile?.id]);

  // Notiser (Kopplat till Supabase)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0);
  const [arcadeTicker, setArcadeTicker] = useState<{gameId: string, score: number} | null>(null);
  const [isTickerBlinking, setIsTickerBlinking] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1)
  const [snakeTicker, setSnakeTicker] = useState<number | null>(null)
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  const [showOnlineModal, setShowOnlineModal] = useState(false);

  const [onlineUserProfiles, setOnlineUserProfiles] = useState<any[]>([]);

  // AKUT FIX: Återställd blixtsnabb IP-dörrvakt (Hundradels-reaktion!)
  // MODERN FACECHAT: IP-vakt sköts nu helt av Middleware (Server-side)

  // Master Realtime Feed
  useEffect(() => {
    if (!userProfile || isBlockedRoute) return;
    
    // 1. Fetch alla personliga notiser
    async function fetchPersonligaNotiser() {
      // --- SERVER ACTION FÖR BLOCKERINGAR (BYPASS CORS) ---
      const { data: serverBlockIds } = await getUserBlocksAction();
      const blockedIds: string[] = serverBlockIds || [];
      setBlockedUserIds(blockedIds);

      const { data: notifsData } = await supabase.from('notifications')
         .select('*, actor:actor_id(username, avatar_url)')
         .eq('receiver_id', userProfile.id)
         .neq('type', 'visit') 
         .order('created_at', { ascending: false })
         .limit(40);

      const notifs: any[] = [];
      if(notifsData) {
         notifsData.forEach(n => {
           if (!blockedIds.includes(n.actor_id)) {
             notifs.push({ 
               id: n.id, 
               type: n.type, 
               user: (n.actor as any)?.username || 'Facechat',
               avatar: (n.actor as any)?.avatar_url,
               text: n.content, 
               time: new Date(n.created_at).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'}), 
               unread: !n.is_read, 
               link: n.link || '#' 
             });
           }
         });
      }
      setNotifications(notifs);
    }
    fetchPersonligaNotiser();

    // Väckarklocka: Uppdatera notiser när användaren kommer tillbaka till appen (viktigt för mobilen!)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPersonligaNotiser();
        // Uppdatera även support-räknaren
        getUnreadSupportCountAction().then(res => {
          if (res && typeof res.count === 'number') setUnreadSupportCount(res.count);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Lyssna på Notifications (Master Channel)
    const notifChannel = supabase.channel('header-notifs-' + userProfile.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${userProfile.id}` }, (payload: any) => {
         // Spela pling-ljud för alla NYA notiser (utom besök)
         // VIKTIGT: Spela bara ljud om fönstret har FOKUS för att undvika dubbel-pling med push-notiser
          if (payload.new.type !== 'visit' && document.hasFocus()) {
            const soundId = userProfile.notif_sound || 'default';
            if (soundId !== 'none') {
               try {
                  const url = getSoundUrl(soundId);
                  const audio = new Audio(url); 
                  audio.volume = 0.4;
                  audio.play().catch(() => {}); 
               } catch (e) {}
            }
          }
          fetchPersonligaNotiser();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${userProfile.id}` }, (payload: any) => {
         fetchPersonligaNotiser();
      }).subscribe();
    
    // 4. Lyssna på Support-ärenden
    const isRoot = ROOT_EMAILS.includes(userProfile.auth_email?.toLowerCase()) || userProfile.perm_roles;
    const canManageSupport = isRoot || userProfile.perm_support;
    
    const supportChannel = supabase.channel('support_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, (payload) => {
         async function refreshCount() {
           getUnreadSupportCountAction().then(res => {
             if (res && typeof res.count === 'number') {
                setUnreadSupportCount(res.count);
             }
           });
         }

         refreshCount();
      }).subscribe();
    // 5. Lyssna på Online Presence
    const presenceChannel = supabase.channel('online-presence');
    presenceChannel
      .on('presence', { event: 'sync' }, async () => {
        const state = presenceChannel.presenceState();
        let uniqueUserIds = new Set<string>();
        Object.values(state).forEach((presences: any) => {
           presences.forEach((p: any) => {
              if (p.user && !blockedUserIds.includes(p.user)) uniqueUserIds.add(p.user);
           });
        });
        const idList = Array.from(uniqueUserIds);
        setOnlineCount(idList.length > 0 ? idList.length : 1);
        
        // Hämta profiler för modalen om den är öppen eller precis öppnas
        if (idList.length > 0) {
           const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url, last_seen').in('id', idList);
           if (profiles) {
              setOnlineUserProfiles(profiles.sort((a, b) => a.username.localeCompare(b.username)));
           }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user: userProfile.id });
        }
      });
      
    // 6. Lyssna på Arcade Scores (Global Ticker)
    const arcadeChannel = supabase.channel('global-arcade-ticker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'snake_scores' }, (payload) => {
         const gameId = payload.new.game_id || 'snake';
         setArcadeTicker({ gameId, score: payload.new.score });
         setIsTickerBlinking(true);
         setTimeout(() => {
            setIsTickerBlinking(false);
            setArcadeTicker(null); // Går tillbaka till viloläge efter 5 sek
         }, 5000);
      }).subscribe();
      
    // 7. Lyssna på profil-ändringar (Realtime Admin Status)
    const profileChannel = supabase.channel('header-profile-updates-' + userProfile.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userProfile.id}` }, async (payload: any) => {
         if (payload.new.is_banned) {
            await supabase.auth.signOut();
            window.location.href = '/login?error=' + encodeURIComponent('Ditt konto har blivit blockerat av en administratör.');
            return;
         }
         
         // Magiskt: Uppdatera profil-state direkt om admin-status eller behörighet ändras!
         // VATTENTÄTT: Behåll auth_email (Root check) även vid realtime-uppdateringar!
         setUserProfile((prev: any) => ({
            ...prev,
            ...payload.new,
            auth_email: prev?.auth_email // Tappa ALDRIG denna virtuella egenskap!
         }));
      }).subscribe();
      
    return () => { 
       document.removeEventListener('visibilitychange', handleVisibilityChange);
       supabase.removeChannel(notifChannel);
       supabase.removeChannel(supportChannel); 
       supabase.removeChannel(presenceChannel);
       supabase.removeChannel(arcadeChannel);
       supabase.removeChannel(profileChannel);
    };
  }, [userProfile?.id, supabase]) // OPTIMERING: Beror nu bara på ID, inte hela profilen (stoppar loopar!)

  // REAL-TIME IP GUARD (Blixtsnabb reaktion vid spärr!)
  useEffect(() => {
    if (isBlockedRoute || isLoginRoute || isAdminRoute) return;
    
    let channel: any;
    
    async function setupRealtimeGuard() {
      try {
        if (!user?.id) return; // FIX: Fråga ALDRIG efter "guest" i ett UUID-fält!
        
        // Vi hämtar IP:n en gång vid start för att veta vad vi ska lyssna efter
        const res = await supabase.from('profiles').select('last_ip').eq('id', user.id).maybeSingle();
        const myIp = res?.data?.last_ip;
        if (!myIp) return;

        channel = supabase.channel('instant-ip-block')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blocked_ips' }, (payload: any) => {
            if (payload.new.ip === myIp) {
              window.location.href = '/blocked';
            }
          })
          .subscribe();
      } catch (e) {}
    }

    if (!userLoading) {
      setupRealtimeGuard();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [pathname, userLoading, user?.id]);

  const simulateNotification = () => {
    // Legacy demo function (kept for failsafes)
  }

  const unreadCount = notifications.filter(n => n.unread).length

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  if (isAdminRoute || isLoginRoute || isBlockedRoute) return null

  const handleLogout = async () => {
    isLoggingOut.current = true;
    const supabase = createClient()
    await supabase.auth.signOut()
    
    // MODERN FACECHAT: Rensa sessions-cookien på servern och lokalt
    await logoutAction();
    localStorage.removeItem('facechat_session_key');
    localStorage.removeItem('facechat_persistent_session');
    
    window.location.replace('/login')
  }


  return (
    <>
      <header className="main-header">
        <style>{`
          @media (min-width: 769px) {
            .mobile-menu-btn { display: none !important; }
            .hide-on-desktop { display: none !important; }
          }
          .notif-dropdown {
             position: absolute;
             top: 100%;
             right: 0;
             margin-top: 0.5rem;
             width: 350px;
             background-color: var(--bg-card);
             border-radius: 12px;
             border: 1px solid var(--border-color);
             box-shadow: var(--shadow-md);
             z-index: 1000;
             overflow: hidden;
          }
          @media (max-width: 768px) {
             .notif-dropdown {
                position: fixed;
                top: 65px;
                left: 50%;
                right: auto;
                transform: translateX(-50%);
                width: 95vw;
                max-width: 400px;
             }
          }
        `}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button 
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.1rem' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link href="/" className="logo" style={{ textDecoration: 'none' }}>Facechat</Link>
        </div>
        
        {mobileMenuOpen && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileMenuOpen(false)} className="hide-on-desktop" />
        )}
        <nav className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
             <Home size={18} /> <span className="hide-on-mobile">Startskärm</span>
          </Link>
          <Link href="/whiteboard" className={`nav-link ${pathname?.startsWith('/whiteboard') ? 'active' : ''}`}>
             <LayoutGrid size={18} /> <span className="hide-on-mobile">Whiteboard</span>
          </Link>
          <Link href="/krypin" 
             onClick={() => setMobileMenuOpen(false)}
             className={`nav-link ${pathname === '/krypin' ? 'active' : ''}`}>
             <User size={18} /> <span className="hide-on-mobile">Mitt Krypin</span>
          </Link>

          <Link href="/forum" className={`nav-link ${pathname?.startsWith('/forum') ? 'active' : ''}`}>
             <MessagesSquare size={18} /> <span className="hide-on-mobile">Forumet</span>
          </Link>
          <Link href="/chattrum" className={`nav-link ${pathname?.startsWith('/chattrum') ? 'active' : ''}`}>
             <MessageSquare size={18} /> <span className="hide-on-mobile">Chattrum</span>
          </Link>
          <Link href="/sok" className={`nav-link ${pathname?.startsWith('/sok') ? 'active' : ''}`}>
             <Search size={18} /> <span className="hide-on-mobile">Sök & Spana</span>
          </Link>
          <Link href="/minasidor" className={`nav-link ${pathname?.startsWith('/minasidor') ? 'active' : ''}`} style={{ position: 'relative' }}>
             <Settings size={18} /> <span className="hide-on-mobile">Mina Sidor</span>
             {unreadSupportCount > 0 && !(userProfile?.is_admin || userProfile?.perm_support || ROOT_EMAILS.includes(userProfile?.auth_email?.toLowerCase())) && (
               <span style={{ position: 'absolute', top: '8px', right: '10px', backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '10px', fontWeight: 'bold' }}>{unreadSupportCount}</span>
             )}
          </Link>
          {(userProfile?.is_admin || 
            ROOT_EMAILS.includes(userProfile?.auth_email?.toLowerCase()) || 
            userProfile?.perm_users || userProfile?.perm_content || userProfile?.perm_rooms || 
            userProfile?.perm_support || userProfile?.perm_roles || userProfile?.perm_logs || 
            userProfile?.perm_stats || userProfile?.perm_diagnostics || userProfile?.perm_chat || 
            userProfile?.perm_images) && (
            <Link href="/admin" className={`nav-link ${pathname?.startsWith('/admin') ? 'active' : ''}`} style={{ color: '#ef4444', position: 'relative' }}>
               <ShieldAlert size={18} /> <span className="hide-on-mobile">Admin</span>
               {unreadSupportCount > 0 && (userProfile?.is_admin || userProfile?.perm_support || ROOT_EMAILS.includes(userProfile?.auth_email?.toLowerCase())) && (
                 <span style={{ position: 'absolute', top: '8px', right: '10px', backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '10px', fontWeight: 'bold' }}>{unreadSupportCount}</span>
               )}
            </Link>
          )}
        </nav>

        <div className="header-actions" style={{ gap: '0.5rem' }}>
          {/* ARCADE TICKER */}
          <div onClick={() => router.push('/krypin?spela=true')} className="hover-lift" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', gap: '0.3rem', backgroundColor: '#064e3b', padding: '0.2rem 0.6rem', borderRadius: '20px', color: '#34d399', fontWeight: 'bold', fontSize: '0.8rem', border: '1px solid #10b981', boxShadow: '0 0 10px rgba(16,185,129,0.5)', animation: isTickerBlinking ? 'blinkEffect 0.5s infinite alternate' : 'none', whiteSpace: 'nowrap' }}>
            {arcadeTicker !== null ? (
               <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                 {arcadeTicker.gameId === 'snake' ? '🐍' : ''}
                 {arcadeTicker.gameId === 'racing' ? '🏎️' : ''}
                 {arcadeTicker.gameId === 'breakout' ? '🧱' : ''}
                 {arcadeTicker.gameId === 'invaders' ? '🚀' : ''}
                 {arcadeTicker.gameId === 'tetris' ? '🧩' : ''}
                 
                 <span className="hide-on-mobile" style={{ marginLeft: '0.2rem' }}>
                     {arcadeTicker.gameId === 'snake' ? 'Snake:' : ''}
                     {arcadeTicker.gameId === 'racing' ? 'Racing:' : ''}
                     {arcadeTicker.gameId === 'breakout' ? 'Breakout:' : ''}
                     {arcadeTicker.gameId === 'invaders' ? 'Astro:' : ''}
                     {arcadeTicker.gameId === 'tetris' ? 'Tetris:' : ''}
                 </span>
                 <span style={{ marginLeft: '0.2rem' }}>{arcadeTicker.score}</span>
               </span>
            ) : (
               <span>🕹️ <span className="hide-on-mobile">Arcade Live</span></span>
            )}
          </div>

          <div onClick={() => setShowOnlineModal(true)} className="hover-lift" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '20px', color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }} title={`${onlineCount} inloggade just nu. Klicka för att se vilka!`}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 6px #10b981' }} className="blink"></div>
            <span>{onlineCount} <span className="hide-on-mobile">Online</span></span>
          </div>

          {/* ONLINE MODAL */}
          {showOnlineModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: isAndroid ? 'blur(2px)' : 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowOnlineModal(false)}>
               <div className="card" style={{ maxWidth: '450px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'modalBounce 0.4s ease-out', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-color)' }}>
                     <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
                        <div style={{ width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }} className="blink"></div>
                        Inloggade Just Nu ({onlineCount})
                     </h3>
                     <button onClick={() => setShowOnlineModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem' }}><X size={24} /></button>
                  </div>
                  
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                     {onlineUserProfiles.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Hämtar lista...</div>
                     ) : (
                        onlineUserProfiles.map((user) => (
                           <div key={user.id} onClick={() => { setShowOnlineModal(false); router.push(`/krypin?u=${user.username}`); }} 
                              style={{ padding: '0.75rem 1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'all 0.1s' }} className="hover-bg-gray">
                              <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: 'var(--theme-krypin)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '2px solid #10b981' }}>
                                 {user.avatar_url ? <img src={user.avatar_url} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={24} color="white" />}
                              </div>
                              <div style={{ flex: 1 }}>
                                 <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-main)' }}>{user.username}</div>
                                 <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>• Online nu</div>
                              </div>
                              <div style={{ color: 'var(--theme-krypin)', fontWeight: 'bold', fontSize: '0.85rem' }}>Besök &rarr;</div>
                           </div>
                        ))
                     )}
                  </div>
                  
                  <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', backgroundColor: 'var(--bg-color)' }}>
                     Klicka på en användare för att besöka deras Krypin!
                  </div>
               </div>
            </div>
          )}          
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button className="icon-btn" onClick={async () => {
                const isOpening = !showDropdown;
                setShowDropdown(isOpening);
                if (isOpening && unreadCount > 0) {
                   // Markera alla som lästa direkt när man klickar på klockan!
                   setNotifications(prev => prev.map(n => ({...n, unread: false})));
                   await supabase.from('notifications')
                     .update({ is_read: true })
                     .eq('receiver_id', userProfile.id)
                     .eq('is_read', false);
                }
              }} style={{ color: 'white', border: 'none', background: 'none', cursor: 'pointer', padding: '0.5rem', position: 'relative' }}>
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="badge" style={{ position: 'absolute', top: '0', right: '0', backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '10px', fontWeight: 'bold' }}>
                  {unreadCount}
                </span>
              )}
            </button>
            {showDropdown && (
              <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setShowDropdown(false)} />
              <div className="notif-dropdown" style={{ zIndex: 1000 }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Notiser</h3>
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {notifications.length === 0 && <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Inga nya händelser just nu.</div>}
                    {notifications.map(notif => (
                      <div key={notif.id} onClick={() => {
                          setShowDropdown(false);
                          if (notif.link !== '#') window.location.href = notif.link;
                        }} 
                        style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: notif.unread ? '#e0f2fe' : 'transparent', display: 'flex', gap: '0.75rem', cursor: 'pointer' }}
                        className="hover-bg-gray">
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {notif.avatar ? <img src={notif.avatar} loading="lazy" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <User size={20} color="#64748b"/>}
                        </div>
                        <div style={{ wordBreak: 'break-word', paddingRight: '0.5rem' }}>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-main)' }}><strong>@{notif.user}</strong> {notif.text}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{notif.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
              </>
            )}
          </div>
          
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.5rem' }}>
            <LogOut size={20} /> <span style={{ fontSize: '0.875rem', fontWeight: '600', whiteSpace: 'nowrap' }} className="hide-on-mobile">Logga ut</span>
          </button>
        </div>
      </header>
    </>
  )
}
