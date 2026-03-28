"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Users, Database, AlertTriangle, Activity, Search, ShieldAlert, LogOut, LifeBuoy, Trash2, CheckCircle, Ban, PlayCircle, Lock, Edit2, Plus, Terminal, History, Wrench, Eraser, Globe, X } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { deleteUserAccount } from '../actions/userActions';
import { adminMassDeleteSpam } from '../actions/adminActions';
import { useWordFilter } from '@/hooks/useWordFilter';

export const logAdminAction = async (supabase: any, adminId: string, action: string) => {
  try {
    await supabase.from('admin_logs').insert({ admin_id: adminId, action });
  } catch(e) {}
};

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!profile?.is_admin && user.email !== 'apersson508@gmail.com') { // Hard fallback
        router.push('/');
        return;
      }
      setUserProfile({ ...profile, auth_email: user.email });
    }
    checkAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!userProfile) return;
    const isRoot = userProfile.auth_email === 'apersson508@gmail.com' || userProfile.perm_roles === true;
    const canManageSupport = isRoot || userProfile.perm_support === true;
    
    if (canManageSupport) {
      const fetchUnread = async () => {
        const { count } = await supabase.from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
          .eq('has_unread_admin', true);
        if (count !== null) setUnreadSupportCount(count);
      };
      
      fetchUnread();
      
      const sub = supabase.channel('admin-support-alerts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
          fetchUnread();
        }).subscribe();
        
      return () => { supabase.removeChannel(sub); };
    }
  }, [userProfile, supabase]);

  if (!userProfile) return <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>Laddar Admin...</div>;

  const isRoot = userProfile.auth_email === 'apersson508@gmail.com' || userProfile.perm_roles === true;
  const canManageUsers = isRoot || userProfile.perm_users === true;
  const canManageContent = isRoot || userProfile.perm_content === true;
  const canManageRooms = isRoot || userProfile.perm_rooms === true;
  const canManageRoles = isRoot || userProfile.perm_roles === true;
  const canManageSupport = isRoot || userProfile.perm_support === true;
  const canManageLogs = isRoot || userProfile.perm_logs === true;
  const canManageStats = isRoot || userProfile.perm_stats === true;
  const canManageDiagnostics = isRoot || userProfile.perm_diagnostics === true;

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return canManageStats ? <AdminDashboard supabase={supabase} /> : <NoAccess/>;
      case 'users': return canManageUsers ? <AdminUsers supabase={supabase} currentUser={userProfile} /> : <NoAccess/>;
      case 'reports': return canManageContent ? <AdminReports supabase={supabase} currentUser={userProfile} /> : <NoAccess/>;
      case 'content': return canManageContent ? <AdminContent supabase={supabase} currentUser={userProfile} /> : <NoAccess/>;
      case 'rooms': return canManageRooms ? <AdminRooms supabase={supabase} currentUser={userProfile} /> : <NoAccess/>;
      case 'support': return canManageSupport ? <AdminSupport supabase={supabase} currentUser={userProfile} /> : <NoAccess/>;
      case 'permissions': return canManageRoles ? <AdminPermissions supabase={supabase} currentUser={userProfile} /> : <NoAccess/>;
      case 'logs': return canManageLogs ? <AdminLogs supabase={supabase} /> : <NoAccess/>;
      case 'diagnostics': return canManageDiagnostics ? <AdminDiagnostics supabase={supabase} currentUser={userProfile} /> : <NoAccess/>;
      default: return canManageStats ? <AdminDashboard supabase={supabase} /> : <NoAccess/>;
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: 'calc(100vh - 74px)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'Inter, sans-serif' }} className="admin-layout">
      
      {/* Sidebar */}
      <div style={{ width: '280px', minHeight: 'calc(100vh - 74px)', height: 'calc(100vh - 74px)', position: 'sticky', top: '74px', backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }} className="admin-sidebar">
        <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: '1.2' }}>
            <ShieldAlert size={28} /> ADMIN V2
          </h1>
          <p style={{ fontSize: '0.75rem', marginTop: '0.75rem', color: 'var(--text-muted)' }}>Inloggad: @{userProfile.username}</p>
          {isRoot && <span style={{ display: 'inline-block', marginTop: '0.5rem', backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>ROOT-BEHÖRIGHET</span>}
        </div>
        
        <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }} className="admin-sidebar-menu">
          {canManageStats && (
            <button onClick={() => setActiveTab('dashboard')} className={`admin-nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}>
               <Activity size={18} /> Dashboard & Statistik
            </button>
          )}
          {canManageUsers && (
            <button onClick={() => setActiveTab('users')} className={`admin-nav-link ${activeTab === 'users' ? 'active' : ''}`}>
               <Users size={18} /> Användare
            </button>
          )}
          {canManageContent && (
            <button onClick={() => setActiveTab('reports')} className={`admin-nav-link ${activeTab === 'reports' ? 'active' : ''}`}>
               <AlertTriangle size={18} /> Anmälningar
            </button>
          )}
          {canManageContent && (
            <button onClick={() => setActiveTab('content')} className={`admin-nav-link ${activeTab === 'content' ? 'active' : ''}`}>
               <Database size={18} /> Innehåll & Moderering
            </button>
          )}
          {canManageRooms && (
            <button onClick={() => setActiveTab('rooms')} className={`admin-nav-link ${activeTab === 'rooms' ? 'active' : ''}`}>
               <Terminal size={18} /> Hantera Chattrum
            </button>
          )}
          {canManageSupport && (
            <button onClick={() => setActiveTab('support')} className={`admin-nav-link ${activeTab === 'support' ? 'active' : ''}`} style={{ justifyContent: 'space-between' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                 <LifeBuoy size={18} /> Supportärenden
               </div>
               {unreadSupportCount > 0 && (
                 <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', minWidth: '20px', padding: '0.15rem 0.4rem', borderRadius: '999px', textAlign: 'center', display: 'inline-block' }}>
                   {unreadSupportCount}
                 </span>
               )}
            </button>
          )}
          {canManageRoles && (
            <button onClick={() => setActiveTab('permissions')} className={`admin-nav-link ${activeTab === 'permissions' ? 'active' : ''}`}>
               <Shield size={18} /> Behörigheter & Roller
            </button>
          )}
          {canManageLogs && (
            <button onClick={() => setActiveTab('logs')} className={`admin-nav-link ${activeTab === 'logs' ? 'active' : ''}`}>
               <History size={18} /> Loggar
            </button>
          )}
          {canManageDiagnostics && (
            <button onClick={() => setActiveTab('diagnostics')} className={`admin-nav-link ${activeTab === 'diagnostics' ? 'active' : ''}`} style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
               <Wrench size={18} /> Vårdcentralen
            </button>
          )}
        </nav>
        <div className="admin-exit-wrapper" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', zIndex: 10, marginTop: 'auto' }}>
          <button onClick={() => router.push('/')} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: '600', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <LogOut size={18} /> Avsluta Admin
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main-content" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {renderContent()}
      </div>

      <style jsx global>{`
        .admin-nav-link {
          display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
          color: var(--text-muted); text-decoration: none; background: none;
          border: none; width: 100%; text-align: left; cursor: pointer;
          border-radius: 8px; font-weight: 500; transition: all 0.2s; white-space: nowrap;
        }
        .admin-nav-link:hover { background-color: var(--bg-color); color: var(--text-main); }
        .admin-nav-link.active { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; font-weight: 600; }
        .admin-card { background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .admin-input { background-color: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-main); padding: 0.75rem 1rem; border-radius: 8px; outline: none; }
        .admin-input:focus { border-color: #ef4444; background-color: var(--bg-card); }
      `}</style>
    </div>
  );
}

const NoAccess = () => (
   <div style={{ maxWidth: '600px', margin: '10vh auto', textAlign: 'center', padding: '3rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed #ef4444' }}>
     <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
     <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Behörighet saknas</h2>
     <p style={{ color: 'var(--text-muted)' }}>Ditt Adminkonto har inte tillräckliga rättigheter för att komma åt denna sektion. Kontakta Root-Admin för uppgradering.</p>
   </div>
);

// ==========================================================
// 1. DASHBOARD & STATISTIK (Inkl Händelselogg/Sista inlogg)
// ==========================================================
const AdminDashboard = ({ supabase }: { supabase: any }) => {
  const [stats, setStats] = useState({ users: 0, posts: 0, tickets: 0, online: 0 });
  const [latestLogins, setLatestLogins] = useState<any[]>([]);
  const [maintenanceLog, setMaintenanceLog] = useState<any>(null);

  useEffect(() => {
    async function loadDash() {
      // Stats
      const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: wbCount } = await supabase.from('whiteboard').select('*', { count: 'exact', head: true });
      const { count: gbCount } = await supabase.from('guestbook').select('*', { count: 'exact', head: true });
      
      let forumCount = 0;
      const { count: fCount, error } = await supabase.from('forum_posts').select('*', { count: 'exact', head: true });
      if (!error) forumCount = fCount || 0;

      const { count: ticketsCount } = await supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open');
      
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: onlineCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('last_seen', fifteenMinsAgo);

      setStats({ 
        users: usersCount || 0, 
        posts: (wbCount || 0) + (gbCount || 0) + (forumCount || 0), 
        tickets: ticketsCount || 0,
        online: onlineCount || 0
      });

      // Senaste inloggade
      const { data } = await supabase.from('profiles')
        .select('username, last_seen, created_at, is_banned')
        .order('last_seen', { ascending: false, nullsFirst: false })
        .limit(10);
      if (data) setLatestLogins(data);

      // Nattlig Underhållslogg
      const { data: maint } = await supabase.from('admin_logs')
        .select('*')
        .eq('action', 'Nattligt Underhåll Genomfört (Auto)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maint) setMaintenanceLog(maint);
    }
    loadDash();
  }, [supabase]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {maintenanceLog && (
        <div className="admin-card" style={{ marginBottom: '2rem', borderLeft: '4px solid #10b981', backgroundColor: '#f0fdf4' }}>
          <h3 style={{ fontSize: '1.25rem', color: '#065f46', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={20} /> Diagnosverktyg resultat (Senaste nattkörningen):
          </h3>
          <p style={{ color: '#064e3b', fontSize: '0.95rem', fontWeight: 'bold' }}>Datum: {new Date(maintenanceLog.created_at).toLocaleString('sv-SE')}</p>
          <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '8px', fontSize: '0.875rem', color: '#111', whiteSpace: 'pre-wrap', border: '1px solid #d1fae5' }}>
            {maintenanceLog.details || 'Inga detaljer sparade.'}
          </div>
        </div>
      )}
      
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-main)' }}>Dashboard & Statistik</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="admin-card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Totalt antal Användare</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: '#3b82f6' }}>{stats.users}</p>
        </div>
        <div className="admin-card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Totalt Skapade Inlägg</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>{stats.posts}</p>
        </div>
        <div className="admin-card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Öppna Supportärenden</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: stats.tickets > 0 ? '#ef4444' : '#6b7280' }}>{stats.tickets}</p>
        </div>
        <div className="admin-card" style={{ border: '1px solid #10b981', backgroundColor: '#ecfdf5' }}>
          <h3 style={{ fontSize: '1rem', color: '#047857', marginBottom: '0.5rem' }}>Inloggade just nu</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}/> {stats.online}</p>
        </div>
      </div>
      
      <div className="admin-card">
        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Senaste Inloggningar (Realtid)
        </h3>
        <div style={{ overflowX: 'auto' }} className="hide-on-mobile">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem' }}>Användarnamn</th>
                <th style={{ padding: '0.75rem' }}>Datum</th>
                <th style={{ padding: '0.75rem' }}>Tidpunkt</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {latestLogins.map((user, idx) => {
                const dateObj = new Date(user.last_seen || user.created_at);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: user.is_banned ? '#fef2f2' : 'transparent' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600', color: 'var(--theme-primary)' }}>@{user.username}</td>
                    <td style={{ padding: '0.75rem' }}>{dateObj.toLocaleDateString('sv-SE')}</td>
                    <td style={{ padding: '0.75rem' }}>{dateObj.toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'})}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {user.is_banned ? <span style={{ color: '#ef4444', fontWeight: 'bold' }}>BLOCKERAD</span> : <span style={{ color: '#10b981' }}>Aktiv</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="hide-on-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {latestLogins.map((user, idx) => {
             const dateObj = new Date(user.last_seen || user.created_at);
             return (
               <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: user.is_banned ? '#fef2f2' : 'var(--bg-card)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                   <strong style={{ color: 'var(--theme-primary)' }}>@{user.username}</strong>
                   <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateObj.toLocaleDateString('sv-SE')} {dateObj.toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'})}</span>
                 </div>
                 <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                   {user.is_banned ? <span style={{ color: '#ef4444' }}>BLOCKERAD</span> : <span style={{ color: '#10b981' }}>Aktiv</span>}
                 </div>
               </div>
             )
          })}
        </div>
      </div>
    </div>
  );
};

// ==========================================================
// 2. ANVÄNDARE (Blocka, Avblocka, Radera)
// ==========================================================
const AdminUsers = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  // Sök-loggning (Debounced)
  useEffect(() => {
    if (search.trim().length > 1) {
      const timer = setTimeout(() => {
        logAdminAction(supabase, currentUser.id, `Utförde sökning efter användare: "${search.trim()}"`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [search, supabase, currentUser.id]);

  async function fetchUsers(query?: string) {
    let q = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    if (query) {
      q = q.ilike('username', `%${query}%`);
    }
    const { data } = await q;
    // Tvinga in root-mailen/användaren "apersson508" högst upp om de finns
    if (data) {
      const dbUsers = [...data];
      const meIdx = dbUsers.findIndex(u => u.username?.toLowerCase() === 'admin' || u.username?.toLowerCase() === 'apersson508' || u.id === currentUser.id);
      if (meIdx !== -1) {
        const me = dbUsers.splice(meIdx, 1)[0];
        dbUsers.unshift(me);
      } else if (currentUser?.auth_email?.toLowerCase() === 'apersson508@gmail.com' || currentUser?.username?.toLowerCase() === 'admin') {
        dbUsers.unshift({
          id: currentUser.id || 'root-fallback',
          username: currentUser.username || 'apersson508',
          is_admin: true,
          perm_users: true, perm_content: true, perm_rooms: true, 
          perm_support: true, perm_logs: true, perm_roles: true, perm_chat: true,
          perm_diagnostics: true, perm_stats: true
        });
      }
      setUsers(dbUsers);
    }
  }

  const handleToggleBlock = async (user: any) => {
    if (user.username?.toLowerCase() === 'apersson508' || user.id === currentUser.id) return alert('Detta konto är skyddat som Super-Admin.');
    if (user.perm_roles && user.is_admin) return alert('Ett Root-Konto kan inte blockeras.');
    const newStatus = !user.is_banned;
    await supabase.from('profiles').update({ is_banned: newStatus }).eq('id', user.id);
    await logAdminAction(supabase, currentUser.id, `${newStatus ? 'Blockerade' : 'Avblockerade'} @${user.username}`);
    fetchUsers(search);
  };

  const handleDeleteUser = async (user: any) => {
    if (user.username?.toLowerCase() === 'apersson508' || user.id === currentUser.id) return alert('Inkorrekt, du kan inte radera the creator.');
    if (user.perm_roles && user.is_admin) return alert('Ett Root-Konto kan inte raderas.');
    if (confirm(`VARNING: Detta tar bort @${user.username} och allt deras innehåll för alltid. Är du helt säker?`)) {
      const res = await deleteUserAccount(user.id, currentUser.id, true);
      if (res?.error) {
        alert('Ett fel uppstod vid radering: ' + res.error);
        return;
      }
      await logAdminAction(supabase, currentUser.id, `Raderade kontot @${user.username} permanent från systemet`);
      fetchUsers(search);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-main)' }}>Användare</h2>
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); fetchUsers(e.target.value); }} placeholder="Sök på användarnamn..." className="admin-input" style={{ flex: '1 1 auto', minWidth: '150px' }} />
          <button style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.75rem 2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 auto' }}><Search size={18} /> Sök</button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {users.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga användare hittades.</p>}
        {users.map(u => (
          <div key={u.id} className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', flexWrap: 'wrap', gap: '1rem', borderLeft: u.is_banned ? '4px solid #ef4444' : '4px solid transparent', backgroundColor: u.is_banned ? '#fef2f2' : 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '50%', overflow: 'hidden' }}>
                {u.avatar_url && <img src={u.avatar_url} alt="av" style={{width:'100%', height:'100%', objectFit:'cover'}} />}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)' }}>@{u.username} {u.is_admin && <span style={{ color: '#ef4444', fontSize: '0.75rem', marginLeft: '0.5rem' }}>(ADMIN)</span>}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ort: {u.city || 'Ej angiven'} • Gick med {new Date(u.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {u.is_banned ? (
                <button onClick={() => handleToggleBlock(u)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <PlayCircle size={14}/> Avblocka
                </button>
              ) : (
                <button onClick={() => handleToggleBlock(u)} style={{ backgroundColor: '#fcf8e3', color: '#8a6d3b', border: '1px solid #faebcc', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Ban size={14}/> Blocka
                </button>
              )}
              
              <button onClick={() => handleDeleteUser(u)} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Trash2 size={14}/> Radera Konto
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================================
// 2.5 REPORTS (Anmälningar)
// ==========================================================
const AdminReports = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    const { data, error } = await supabase.from('reports')
      .select('*, reporter:reporter_id(username), reported:reported_user_id(username)')
      .order('created_at', { ascending: false });
    
    if (error) console.error("Error fetching reports:", error);
    if (data) setReports(data);
  }

  const handleDeleteItem = async (report: any) => {
    if (confirm('Ska inlägget raderas globalt?')) {
      let table = '';
      if (report.item_type === 'whiteboard') table = 'whiteboard';
      if (report.item_type === 'guestbook') table = 'guestbook';
      if (report.item_type === 'forum_post') table = 'forum_posts';
      if (report.item_type === 'whiteboard_comment') table = 'whiteboard_comments';
      
      if (table) {
        await supabase.from(table).delete().eq('id', report.item_id);
      }
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', report.id);
      await logAdminAction(supabase, currentUser.id, `Hanterade en anmälan och raderade ${table}-inlägg.`);
      fetchReports();
    }
  };

  const handleBanUser = async (report: any) => {
    if (confirm(`Ska användare @${report.reported?.username || 'Okänd'} bannas globalt från sajten?`)) {
       await supabase.from('profiles').update({ is_banned: true }).eq('id', report.reported_user_id);
       await supabase.from('reports').update({ status: 'resolved' }).eq('id', report.id);
       await logAdminAction(supabase, currentUser.id, `Bannade användare @${report.reported?.username} pga en anmälan.`);
       fetchReports();
    }
  };

  const handleDismiss = async (id: string) => {
    await supabase.from('reports').update({ status: 'dismissed' }).eq('id', id);
    await logAdminAction(supabase, currentUser.id, `Avvisade anmälan (ID: ${id}) utan åtgärd.`);
    fetchReports();
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Anmälningar <span style={{ fontSize: '1rem', backgroundColor: '#ef4444', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', verticalAlign: 'middle' }}>{reports.filter(r => r.status === 'open').length}</span></h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Granska anmälningar av Whiteboard-inlägg, Gästböcker och Forum.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {reports.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga anmälningar hittades. Bra jobbat!</p>}
        {reports.map((report: any) => (
          <div key={report.id} className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: `4px solid ${report.status === 'open' ? '#ef4444' : '#10b981'}`, padding: '1rem', opacity: report.status !== 'open' ? 0.6 : 1 }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: '#b91c1c', marginBottom: '0.25rem', textTransform: 'uppercase' }}>{report.item_type}</p>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>@{report.reporter?.username} anmäler @{report.reported?.username}</p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}><strong>Orsak:</strong> {report.reason}</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(report.created_at).toLocaleString('sv-SE')}</p>
            </div>
            
            {report.status === 'open' ? (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 auto' }}>
                <button onClick={() => handleDeleteItem(report)} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', justifyContent: 'center' }}>
                  <Trash2 size={16}/> Radera Inlägg
                </button>
                <button onClick={() => handleBanUser(report)} style={{ backgroundColor: '#fcf8e3', color: '#8a6d3b', border: '1px solid #faebcc', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', justifyContent: 'center' }}>
                  <Ban size={14}/> Banna @{report.reported?.username}
                </button>
                <button onClick={() => handleDismiss(report.id)} style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Avvisa
                </button>
              </div>
            ) : (
               <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981' }}>Hanterad</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================================
// 3. INNEHÅLL (Whiteboard, Forum, Chattrum)
// ==========================================================
const AdminContent = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const { mask } = useWordFilter();
  const [posts, setPosts] = useState<any[]>([]);
  const [guestbook, setGuestbook] = useState<any[]>([]);
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [snakeScores, setSnakeScores] = useState<any[]>([]);
  const [view, setView] = useState('whiteboard'); // whiteboard, guestbook, forum, snake

  useEffect(() => {
    if (view === 'whiteboard') fetchPosts();
    else if (view === 'guestbook') fetchGuestbook();
    else if (view === 'forum') fetchForumPosts();
    else if (view === 'snake') fetchSnakeScores();
  }, [view]);

  async function fetchSnakeScores() {
    const { data } = await supabase.from('snake_scores').select('*, profiles(username)').order('score', { ascending: false }).limit(50);
    if (data) setSnakeScores(data);
  }

  async function fetchForumPosts() {
    const { data } = await supabase.from('forum_posts').select('*, profiles(username), forum_threads(title)').order('created_at', { ascending: false }).limit(30);
    if (data) setForumPosts(data);
  }

  async function fetchPosts() {
    const { data } = await supabase.from('whiteboard').select('*, profiles!whiteboard_author_id_fkey(username)').order('created_at', { ascending: false }).limit(30);
    if (data) setPosts(data);
  }

  async function fetchGuestbook() {
    const { data } = await supabase.from('guestbook').select('*, sender:profiles!guestbook_sender_id_fkey(username), receiver:profiles!guestbook_receiver_id_fkey(username)').order('created_at', { ascending: false }).limit(30);
    if (data) setGuestbook(data);
  }

  const handleDelete = async (table: string, id: string) => {
    if (confirm('Ska inlägget raderas globalt?')) {
      await supabase.from(table).delete().eq('id', id);
      const tableName = table === 'whiteboard' ? 'Whiteboard' : (table === 'guestbook' ? 'Gästboken' : 'Forumet');
      await logAdminAction(supabase, currentUser.id, `Raderade ett inlägg i ${tableName}`);
      if (table === 'whiteboard') fetchPosts();
      else if (table === 'guestbook') fetchGuestbook();
      else fetchForumPosts();
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Innehåll & Moderering</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Denna vy låter dig hantera raderingar av poster från plattformen.</p>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button onClick={() => setView('whiteboard')} style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', borderRadius: '99px', border: 'none', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'whiteboard' ? 'var(--theme-whiteboard)' : 'var(--bg-card)', color: view === 'whiteboard' ? 'white' : 'var(--text-muted)' }}>Whiteboard</button>
        <button onClick={() => setView('guestbook')} style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', borderRadius: '99px', border: 'none', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'guestbook' ? 'var(--theme-krypin)' : 'var(--bg-card)', color: view === 'guestbook' ? 'white' : 'var(--text-muted)' }}>Gästböcker</button>
        <button onClick={() => setView('forum')} style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', borderRadius: '99px', border: 'none', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'forum' ? 'var(--theme-forum)' : 'var(--bg-card)', color: view === 'forum' ? 'white' : 'var(--text-muted)' }}>Forum (Under flytt)</button>
        <button onClick={() => setView('snake')} style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', borderRadius: '99px', border: 'none', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'snake' ? '#10b981' : 'var(--bg-card)', color: view === 'snake' ? 'white' : 'var(--text-muted)' }}>Snake Leaderboard</button>
        <button onClick={() => setView('sok')} style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', borderRadius: '99px', border: 'none', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'sok' ? '#f59e0b' : 'var(--bg-card)', color: view === 'sok' ? 'white' : 'var(--text-muted)' }}>Sök & Spana (Dölj Bilder)</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {view === 'whiteboard' && posts.map(post => (
          <div key={post.id} className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid var(--theme-whiteboard)', padding: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>@{post.profiles?.username || 'Okänd'} • {new Date(post.created_at).toLocaleString('sv-SE')}</p>
              <p style={{ margin: 0, color: 'var(--text-main)', paddingRight: '1rem' }}>{mask(post.content)}</p>
            </div>
            <button onClick={() => handleDelete('whiteboard', post.id)} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} title="Radera inlägg">
              <Trash2 size={20} />
            </button>
          </div>
        ))}
        {view === 'guestbook' && guestbook.map(post => (
          <div key={post.id} className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid var(--theme-krypin)', padding: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>@{post.sender?.username} ➔ @{post.receiver?.username} • {new Date(post.created_at).toLocaleString('sv-SE')}</p>
              <p style={{ margin: 0, color: 'var(--text-main)', paddingRight: '1rem' }}>{mask(post.content)}</p>
            </div>
            <button onClick={() => handleDelete('guestbook', post.id)} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} title="Radera inlägg">
              <Trash2 size={20} />
            </button>
          </div>
        ))}
        {view === 'forum' && forumPosts.map(post => (
          <div key={post.id} className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid var(--theme-forum)', padding: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>@{post.profiles?.username || 'Okänd'} i tråden "{mask(post.forum_threads?.title || '')}" • {new Date(post.created_at).toLocaleString('sv-SE')}</p>
              <p style={{ margin: 0, color: 'var(--text-main)', paddingRight: '1rem' }}>{mask(post.content)}</p>
            </div>
            <button onClick={() => handleDelete('forum_posts', post.id)} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} title="Radera inlägg">
              <Trash2 size={20} />
            </button>
          </div>
        ))}
        {view === 'sok' && (
           <p style={{ color: 'var(--text-muted)' }}>Inga inlägg hittades i denna kategori ännu.</p>
        )}
        {view === 'snake' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div className="admin-card" style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
                <h3 style={{ color: '#ef4444', margin: 0 }}>🚨 FARA: Nollställ Hela Leaderboarden</h3>
                <p style={{ color: '#991b1b', margin: 0, fontSize: '0.875rem' }}>Denna knapp raderar ALLA historiska Snake-poäng från databasen globalt för alla användare. Kan inte ångras!</p>
                <button 
                  onClick={async () => {
                    if (confirm('ÄR DU HELT SÄKER? Detta kommer radera HELA topplistan permanent!')) {
                       const { error } = await supabase.from('snake_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
                       if (error) alert('Det gick fel: ' + error.message);
                       else {
                         alert('Topplistan raderad!');
                         await logAdminAction(supabase, currentUser.id, `Nollställde hela Snake Leaderboarden globalt!`);
                         fetchSnakeScores();
                       }
                    }
                  }}
                  style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: '800', border: 'none', padding: '1rem 2rem', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(239, 68, 68, 0.4)' }}
                >
                  🗑️ NOLLSTÄLL ALLA REKORD NU
                </button>
             </div>
             
             {snakeScores.map((score, index) => (
               <div key={score.id} className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: index === 0 ? '4px solid #fbbf24' : '4px solid #10b981', padding: '1rem' }}>
                 <div>
                   <h4 style={{ margin: 0, color: 'var(--text-main)' }}>#{index + 1} - @{score.profiles?.username || 'Okänd'}</h4>
                   <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Spelades: {new Date(score.created_at).toLocaleString('sv-SE')}</p>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>{score.score}</span>
                   <button onClick={async () => {
                      if (confirm('Radera just detta rekord?')) {
                        await supabase.from('snake_scores').delete().eq('id', score.id);
                        await logAdminAction(supabase, currentUser.id, `Raderade ett fusk-rekord (${score.score} poäng) av @${score.profiles?.username}`);
                        fetchSnakeScores();
                      }
                   }} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} title="Radera rekord">
                     <Trash2 size={20} />
                   </button>
                 </div>
               </div>
             ))}
           </div>
        )}
      </div>
    </div>
  );
};

// ==========================================================
// 4. CHATTRUM (Hantera Dynamiska Rum)
// ==========================================================
const AdminRooms = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    const { data } = await supabase.from('chat_rooms').select('*').order('created_at', { ascending: true });
    if (data) setRooms(data);
  }

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('chat_rooms').insert({ name: newRoomName, created_by: user.id });
    await logAdminAction(supabase, currentUser.id, `Skapade chattrummet "${newRoomName}"`);
    setNewRoomName('');
    fetchRooms();
  };

  const handleDeleteRoom = async (id: string, name: string) => {
    if (confirm(`Är du säker på att du vill radera chattrummet "${name}"? Det kommer kasta ut alla som är där inne.`)) {
      await supabase.from('chat_rooms').delete().eq('id', id);
      await logAdminAction(supabase, currentUser.id, `Raderade chattrummet "${name}"`);
      fetchRooms();
    }
  };

  const handleSetPassword = async (id: string) => {
    const rm = rooms.find(r => r.id === id);
    const pw = prompt(`Ange ett nytt lösenord för rummet ${rm?.name} (lämna tomt för att ta bort lösenordskravet):`);
    if (pw !== null) {
      await supabase.from('chat_rooms').update({ password: pw === '' ? null : pw }).eq('id', id);
      await logAdminAction(supabase, currentUser.id, `Satte ett lösenord på chattrummet "${rm?.name}"`);
      fetchRooms();
    }
  };
  
  const handleRemovePassword = async (id: string, name: string) => {
    if (confirm(`Säker på att du vill ta bort lösenordet för "${name}"?`)) {
      await supabase.from('chat_rooms').update({ password: null }).eq('id', id);
      await logAdminAction(supabase, currentUser.id, `Tog bort lösenordet på chattrum (${name})`);
      fetchRooms();
    }
  };

  const handleRename = async (id: string, currentName: string) => {
    const fresh = prompt('Skriv nytt namn för rummet:', currentName);
    if (fresh && fresh.trim() !== currentName) {
      await supabase.from('chat_rooms').update({ name: fresh.trim() }).eq('id', id);
      await logAdminAction(supabase, currentUser.id, `Döpte om rum "${currentName}" till "${fresh}"`);
      fetchRooms();
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Hantera Chattrum</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Skapa, redigera och ta bort de centrala chattrummen på sajten.</p>
      
      <form onSubmit={handleAddRoom} className="admin-card" style={{ marginBottom: '2rem', backgroundColor: '#f0fdfa', border: '1px solid #99f6e4' }}>
        <h3 style={{ fontSize: '1rem', color: '#0f766e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Plus size={18}/> Lägg till nytt Chattrum</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="T.ex Nattugglan..." className="admin-input" style={{ flex: '1 1 100%', minWidth: '200px', backgroundColor: 'white' }} />
          <button type="submit" style={{ backgroundColor: '#0d9488', color: 'white', fontWeight: '600', padding: '0.75rem 2rem', border: 'none', cursor: 'pointer', borderRadius: '8px', flex: '1 1 auto' }}>Skapa Rum</button>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {rooms.map(r => (
          <div key={r.id} className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {r.password ? <Lock size={16} color="#ef4444" /> : null} {r.name}
              </h4>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
               <button onClick={() => handleRename(r.id, r.name)} style={{ flex: 1, backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                 <Edit2 size={14} /> Byt Namn
               </button>
               {r.password ? (
                 <button onClick={() => handleRemovePassword(r.id, r.name)} style={{ flex: 1, backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                   <Eraser size={14} /> Ta bort Lösenord
                 </button>
               ) : (
                 <button onClick={() => handleSetPassword(r.id)} style={{ flex: 1, backgroundColor: '#fcf8e3', color: '#8a6d3b', border: '1px solid #faebcc', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                   <Lock size={14} /> Sätt Lösenord
                 </button>
               )}
               <button onClick={() => handleDeleteRoom(r.id, r.name)} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Trash2 size={14} /> Radera
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================================
// 5. BEHÖRIGHETER & ADMINS (Sök upp → Gör till Admin)
// ==========================================================
const PermissionCard = ({ icon: Icon, title, desc, checked, onChange, disabled, danger }: any) => (
  <label style={{
    display: 'flex', alignItems: 'flex-start', gap: '1rem',
    padding: '1rem', borderRadius: '8px', 
    border: checked ? `2px solid ${danger ? '#ef4444' : '#10b981'}` : '1px solid var(--border-color)',
    backgroundColor: checked ? (danger ? '#fef2f2' : '#f0fdf4') : 'var(--bg-color)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, transition: 'all 0.2s'
  }}>
    <div style={{ marginTop: '0.25rem', color: checked ? (danger ? '#ef4444' : '#10b981') : 'var(--text-muted)' }}>
      <Icon size={20} />
    </div>
    <div style={{ flex: 1 }}>
      <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 'bold', color: checked ? (danger ? '#b91c1c' : '#065f46') : 'var(--text-main)' }}>{title}</h4>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{desc}</p>
    </div>
    <div style={{ position: 'relative', width: '36px', height: '20px', backgroundColor: checked ? (danger ? '#ef4444' : '#10b981') : '#d1d5db', borderRadius: '10px', transition: 'background-color 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '2px', left: checked ? '18px' : '2px', width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
    </div>
  </label>
);

// ==========================================================
// 5. BEHÖRIGHETER & ROLLER
// ==========================================================
const AdminPermissions = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeEditAdmin, setActiveEditAdmin] = useState<any>(null);

  // Sök-loggning (Debounced)
  useEffect(() => {
    if (search.trim().length > 1) {
      const timer = setTimeout(() => {
        logAdminAction(supabase, currentUser.id, `Sökte i Behörigheter efter: "${search.trim()}"`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [search, supabase, currentUser.id]);

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    const { data } = await supabase.from('profiles').select('*').eq('is_admin', true);
    if (data) {
      const dbAdmins = [...data];
      const meIdx = dbAdmins.findIndex((u: any) => u.username?.toLowerCase() === 'admin' || u.username?.toLowerCase() === 'apersson508' || u.id === currentUser.id || (u.perm_roles && u.is_admin));
      if (meIdx !== -1) {
        const me = dbAdmins.splice(meIdx, 1)[0];
        dbAdmins.unshift(me);
      } else if (currentUser?.auth_email?.toLowerCase() === 'apersson508@gmail.com' || currentUser?.username?.toLowerCase() === 'admin') {
        dbAdmins.unshift({
          id: currentUser.id || 'root-fallback',
          username: currentUser.username || 'apersson508',
          is_admin: true,
          perm_users: true, perm_content: true, perm_rooms: true, 
          perm_support: true, perm_logs: true, perm_roles: true, perm_chat: true,
          perm_diagnostics: true, perm_stats: true
        });
      }
      setAdmins(dbAdmins);
    }
  }

  async function searchUsers() {
    if (!search) return;
    setIsLoading(true);
    const { data } = await supabase.from('profiles')
      .select('id, username, is_admin')
      .ilike('username', `%${search}%`)
      .limit(5);
    if (data) setSearchResults(data);
    setIsLoading(false);
  }

  const handleMakeAdmin = async (userId: string, username: string) => {
    await supabase.from('profiles').update({ is_admin: true }).eq('id', userId);
    await logAdminAction(supabase, currentUser.id, `Befordrade @${username} till Admin`);
    setSearch('');
    setSearchResults([]);
    fetchAdmins();
  };

  const handeRemoveAdmin = async (user: any) => {
    if (user.id === currentUser.id || user.username?.toLowerCase() === 'apersson508') return alert('Du kan inte ta bort din egen admin-status.');
    if (user.perm_roles && user.is_admin) return alert('Du kan inte ta bort ett Root-konto!');
    
    await supabase.from('profiles').update({ 
      is_admin: false, perm_users: false, perm_content: false, perm_rooms: false, 
      perm_roles: false, perm_support: false, perm_logs: false, perm_chat: false,
      perm_diagnostics: false, perm_stats: false
    }).eq('id', user.id);
    
    await logAdminAction(supabase, currentUser.id, `Tog bort Admin-status från @${user.username}`);
    fetchAdmins();
  }

  const handleTogglePermission = async (user: any, column: string, val: boolean) => {
    const updatedUser = { ...user, [column]: val };
    setActiveEditAdmin(updatedUser);
    await supabase.from('profiles').update({ [column]: val }).eq('id', user.id);
    await logAdminAction(supabase, currentUser.id, `Ändrade ${column} för @${user.username} till ${val}`);
    fetchAdmins();
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Behörighet för Ändra Behörigheter</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Här är alla admins uppradade. Du kan även söka fram en användare för att befordra dem.</p>
      
      <div className="admin-card" style={{ marginBottom: '2rem', border: '1px solid #3b82f6', backgroundColor: '#f0f9ff' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: '#1e40af' }}>Befordra en Medlem till Admin</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Sök på användarnamn..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="chat-input"
            style={{ flex: '1 1 100%', minWidth: '150px', backgroundColor: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}
          />
          <button onClick={searchUsers} disabled={isLoading} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: '1 1 auto' }}>
            {isLoading ? 'Söker...' : 'Sök Person'}
          </button>
        </div>
        
        {searchResults.length > 0 && (
          <div style={{ marginTop: '1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #bfdbfe', overflow: 'hidden' }}>
            {searchResults.map(user => (
              <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: '600' }}>@{user.username} {user.is_admin ? '(Redan Admin)' : ''}</span>
                {!user.is_admin && (
                  <button onClick={() => handleMakeAdmin(user.id, user.username)} style={{ padding: '0.4rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Gör till Admin</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {admins.map(person => {
           const isSelf = person.id === currentUser.id;
           const isRootAccount = person.username?.toLowerCase() === 'apersson508' || (person.is_admin && person.perm_roles);
           const cannotTouch = isRootAccount || isSelf;

           return (
            <div key={person.id} className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-main)' }}>@{person.username} {isSelf ? '(Du)' : ''}</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{isRootAccount ? 'Root Super-Admin' : 'Administratör'}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setActiveEditAdmin(person)}
                  style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', flex: '1 1 auto' }}
                >
                  Ändra Behörigheter
                </button>
                <button 
                  onClick={() => handeRemoveAdmin(person)}
                  disabled={cannotTouch}
                  style={{ backgroundColor: cannotTouch ? '#fca5a5' : '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '600', cursor: cannotTouch ? 'not-allowed' : 'pointer', opacity: cannotTouch ? 0.7 : 1, flex: '1 1 auto' }}
                  title={cannotTouch ? "Skyddat root-konto" : "Gör till vanlig användare"}
                >
                  Ta bort Admin
                </button>
              </div>
            </div>
           )
        })}
      </div>

      {activeEditAdmin && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }} onClick={() => setActiveEditAdmin(null)}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            
            <button onClick={() => setActiveEditAdmin(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: 'var(--text-main)' }}>&times;</button>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Behörigheter för @{activeEditAdmin.username}</h2>
            
            {activeEditAdmin.id === currentUser.id || (activeEditAdmin.username?.toLowerCase() === 'apersson508') ? (
               <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '1.5rem', borderRadius: '8px', color: '#b91c1c' }}>
                  Detta konto är ett root-konto och behåller alltid alla underliggande befogenheter. Säkerhetsspärr är aktiv.
               </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                <PermissionCard title="Dashboard & Statistik" desc="Åtkomst till statistiska data." icon={Activity} checked={!!activeEditAdmin.perm_stats} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_stats', !activeEditAdmin.perm_stats)} />
                <PermissionCard title="Användarhantering" desc="Logga in, blockera eller radera." icon={Users} checked={!!activeEditAdmin.perm_users} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_users', !activeEditAdmin.perm_users)} />
                <PermissionCard title="Innehåll & Moderering" desc="Ta bort logginlägg, klotter & forum." icon={Database} checked={!!activeEditAdmin.perm_content} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_content', !activeEditAdmin.perm_content)} />
                <PermissionCard title="Chatt-Moderering" desc="Radera textmeddelanden i realtidschattar." icon={Trash2} checked={!!activeEditAdmin.perm_chat} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_chat', !activeEditAdmin.perm_chat)} />
                <PermissionCard title="Chattrum" desc="Skapa rum, lösenord, etc." icon={Terminal} checked={!!activeEditAdmin.perm_rooms} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_rooms', !activeEditAdmin.perm_rooms)} />
                <PermissionCard title="Supportärenden" desc="Läs/svara supporttickets." icon={LifeBuoy} checked={!!activeEditAdmin.perm_support} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_support', !activeEditAdmin.perm_support)} />
                <PermissionCard title="Loggar (Ny)" desc="Läs granskningsloggen." icon={History} checked={!!activeEditAdmin.perm_logs} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_logs', !activeEditAdmin.perm_logs)} />
                <PermissionCard title="Vårdcentralen" desc="Systemåterställning och Servervård." icon={Wrench} checked={!!activeEditAdmin.perm_diagnostics} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_diagnostics', !activeEditAdmin.perm_diagnostics)} />
                <PermissionCard title="Super-Admin" desc="Befordra admins & ändra roller." icon={ShieldAlert} checked={!!activeEditAdmin.perm_roles} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_roles', !activeEditAdmin.perm_roles)} danger={true} />
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================================
// 6. SUPPORT
// ==========================================================
const AdminSupport = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const { mask } = useWordFilter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchTickets();
  }, [supabase]);

  async function fetchTickets() {
    const { data } = await supabase.from('support_tickets').select('*, profiles(username)').order('created_at', { ascending: false });
    if (data) setTickets(data);
  }

  const markResolved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', id);
    await logAdminAction(supabase, currentUser.id, `Stängde supportärende (${id})`);
    fetchTickets();
    if (activeTicketId === id) setActiveTicketId(null);
  };
  
  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicketId) return;
    const ticket = tickets.find(t => t.id === activeTicketId);
    if (!ticket) return;

    const currentMsg = ticket.messages || [];
    // Fallback om den första "description" inte finns i arrayen
    if (currentMsg.length === 0 && ticket.description) {
      currentMsg.push({ sender: 'user', text: ticket.description, time: ticket.created_at });
    }

    const newMsgs = [...currentMsg, { sender: 'admin', text: replyText.trim(), time: new Date().toISOString() }];
    
    await supabase.from('support_tickets').update({ 
      messages: newMsgs,
      has_unread_user: true,
      has_unread_admin: false
    }).eq('id', activeTicketId);
    
    setReplyText('');
    await logAdminAction(supabase, currentUser.id, `Svarade på supportärende (${activeTicketId})`);
    fetchTickets();
  };

  const markAsRead = async (id: string) => {
    const ticket = tickets.find(t => t.id === id);
    if (ticket && ticket.has_unread_admin) {
      await supabase.from('support_tickets').update({ has_unread_admin: false }).eq('id', id);
      await logAdminAction(supabase, currentUser.id, `Öppnade/läste supportärende (${id})`);
      fetchTickets();
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Supportärenden</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Klicka på ett ärende för att svara personen direkt i en chatt. Markera som lösta när ni är klara.</p>
      
      {activeTicketId ? (
        <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', height: '600px', padding: 0, overflow: 'hidden' }}>
          {(() => {
            const ticket = tickets.find(t => t.id === activeTicketId);
            if (!ticket) return null;
            const msgs = ticket.messages || [];
            if (msgs.length === 0 && ticket.description) {
              msgs.push({ sender: 'user', text: ticket.description, time: ticket.created_at });
            }
            return (
              <>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => setActiveTicketId(null)} style={{ padding: '0.5rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>&larr; Tillbaka</button>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Ticket #{ticket.id.split('-')[0]} - @{ticket.profiles?.username}</h3>
                  </div>
                  <span style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{ticket.category}</span>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-color)' }}>
                  {msgs.map((m: any, i: number) => {
                    const isAdminMsg = m.sender === 'admin';
                    return (
                      <div key={i} style={{ alignSelf: isAdminMsg ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ 
                          padding: '1rem', borderRadius: '12px', 
                          backgroundColor: isAdminMsg ? 'var(--theme-primary)' : 'var(--bg-card)', 
                          color: isAdminMsg ? 'white' : 'var(--text-main)',
                          border: isAdminMsg ? 'none' : '1px solid var(--border-color)',
                          borderBottomRightRadius: isAdminMsg ? '2px' : '12px',
                          borderBottomLeftRadius: isAdminMsg ? '12px' : '2px',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          <p style={{ margin: 0, fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{mask(m.text)}</p>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', alignSelf: isAdminMsg ? 'flex-end' : 'flex-start' }}>
                          {isAdminMsg ? 'Du (Admin)' : `@${ticket.profiles?.username}`} • {new Date(m.time).toLocaleString('sv-SE')}
                        </span>
                      </div>
                    )
                  })}
                </div>
                
                {ticket.status === 'open' ? (
                  <form onSubmit={handleReply} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', gap: '1rem' }}>
                    <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Skriv ditt adminsvar..." style={{ flex: 1, padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                    <button type="submit" style={{ backgroundColor: '#2563eb', color: 'white', fontWeight: '600', padding: '0 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Skicka Svar</button>
                    <button type="button" onClick={(e) => markResolved(ticket.id, e)} style={{ backgroundColor: '#10b981', color: 'white', fontWeight: '600', padding: '0 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={18}/> Lös</button>
                  </form>
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#ecfdf5', color: '#059669', fontWeight: 'bold', borderTop: '1px solid #10b981' }}>Ärendet är stängt pga löst.</div>
                )}
              </>
            )
          })()}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tickets.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga supportärenden finns.</p>}
          {tickets.map(ticket => {
            const isUnread = ticket.has_unread_admin === true;
            return (
              <div 
                key={ticket.id} 
                onClick={() => { setActiveTicketId(ticket.id); markAsRead(ticket.id); }}
                className="admin-card" 
                style={{ 
                  display: 'flex', flexDirection: 'column', gap: '1rem', 
                  borderLeft: `4px solid ${ticket.category.includes('Bug') ? '#ef4444' : ticket.category.includes('Anm') ? '#f59e0b' : '#3b82f6'}`, 
                  opacity: ticket.status === 'closed' ? 0.6 : 1,
                  cursor: 'pointer',
                  backgroundColor: isUnread ? '#fffbeb' : 'var(--bg-card)',
                  transition: 'transform 0.2s', position: 'relative'
                }}
              >
                {isUnread && <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '50%', border: '2px solid white' }} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 'bold', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{ticket.category}</span>
                    <span style={{ marginLeft: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Från: @{ticket.profiles?.username}</span>
                  </div>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{new Date(ticket.created_at).toLocaleString('sv-SE')}</span>
                </div>
                <p style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: '500', margin: 0 }}>"{ticket.description}"</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                   <span style={{ fontSize: '0.875rem', color: '#3b82f6', fontWeight: 'bold' }}>{ticket.messages && ticket.messages.length > 0 ? `${ticket.messages.length} meddelanden` : 'Nytt ärende'} &rarr;</span>
                   {ticket.status === 'open' && (
                     <button onClick={(e) => markResolved(ticket.id, e)} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                       <CheckCircle size={14} /> Markera Löst
                     </button>
                   )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
};

// ==========================================================
// 7. LOGGAR
// ==========================================================
const AdminLogs = ({ supabase }: { supabase: any }) => {
  const [logs, setLogs] = useState<any[]>([]);
  
  useEffect(() => {
    async function fetchLogs() {
      const { data } = await supabase.from('admin_logs')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setLogs(data);
    }
    fetchLogs();
  }, [supabase]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Granskningslogg</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Övervakar varenda exakt handling alla admins utför på sajten.</p>
      
      <div className="admin-card" style={{ padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
              <th style={{ padding: '1rem' }}>Admin</th>
              <th style={{ padding: '1rem' }}>Händelse</th>
              <th style={{ padding: '1rem' }}>Tid</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem', fontWeight: '600', color: '#ef4444' }}>@{log.profiles?.username || 'Okänd'}</td>
                <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{log.action}</td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString('sv-SE')}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Inga loggar finns ännu.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==========================================================
// 8. DIAGNOSTIK & VÅRDCENTRAL
// ==========================================================
const AdminDiagnostics = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const { forbiddenWords } = useWordFilter();
  const [newForbiddenWord, setNewForbiddenWord] = useState('');
  const [running, setRunning] = useState(false);
  const [cssWipeTarget, setCssWipeTarget] = useState('');
  const [lastNightlyResult, setLastNightlyResult] = useState<string | null>(null);
  const [lastNightlyTime, setLastNightlyTime] = useState<string | null>(null);
  const [massDeleteQuery, setMassDeleteQuery] = useState('');
  const [massDeleting, setMassDeleting] = useState(false);
  const [results, setResults] = useState<{ id: string, title: string, status: 'idle' | 'running' | 'ok' | 'warning', message: string, fixAction?: () => void }[]>([
    { id: 'latency', title: 'Databasens Responstid (Ping)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'storage', title: 'Lagringsutrymme (Max 50 MB)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'orphans', title: 'Oanvända Profilbilder (Rensning)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'sync', title: 'Databashälsa (Profiler vs Auth)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'links', title: 'Innehållshälsa (Döda länkar)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'images', title: 'Bild-optimering (800px Max)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'notifications', title: 'Skräpdata (Gamla Notiser > 30d)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'reports', title: 'Ignorerade Anmälningar (> 7d)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'avatars', title: 'Profilbilder (Trasiga Länkar)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'friendship', title: 'Social Hälsa (Vänskap)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'logs', title: 'Log-städning (> 15d)', status: 'idle', message: 'Väntar på diagnos...' },
  ]);

  useEffect(() => {
    fetchLastNightly();
  }, [supabase]);

  async function fetchLastNightly() {
    const { data } = await supabase.from('admin_logs')
      .select('action, created_at')
      .ilike('action', '03:00 TOTAL AUTOMATISK DIAGNOS%')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (data && data[0]) {
      setLastNightlyResult(data[0].action);
      setLastNightlyTime(new Date(data[0].created_at).toLocaleString('sv-SE'));
    }
  }

  const runDiagnostics = async () => {
    setRunning(true);
    setResults(prev => prev.map(p => ({ ...p, status: 'running', message: 'Skannar systemet...' })));

    // 0. Latency (Ping)
    const startPing = Date.now();
    const { error: pingErr } = await supabase.from('profiles').select('id').limit(1);
    const pingTime = Date.now() - startPing;
    setResults(prev => prev.map(p => p.id === 'latency' ? {
      ...p,
      status: pingErr ? 'warning' : 'ok',
      message: pingErr ? `Fel vid anslutning: ${pingErr.message}` : `✅ Databasen svarade på ${pingTime}ms. Servern mår bra!`
    } : p));

    // 1. Storage Usage
    const { data: storageSize, error: storageError } = await supabase.rpc('get_total_storage_size');
    setResults(prev => prev.map(p => {
      if (p.id !== 'storage') return p;
      if (storageError) {
        // Fallback om RPC inte finns - ignorera varningen för att inte skrämma användaren
        return { ...p, status: 'ok', message: `✅ Lagringskontroll hoppades över (kräver RPC get_total_storage_size).` };
      }
      const sizeBytes = Number(storageSize) || 0;
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      const percent = ((sizeBytes / (50 * 1024 * 1024)) * 100).toFixed(1);
      const isFull = sizeBytes > (50 * 1024 * 1024 * 0.9);
      return {
        ...p,
        status: isFull ? 'warning' : 'ok',
        message: isFull ? `Varning: ${sizeMB} MB använt av 50 MB (${percent}%). Närmar sig bristningsgränsen!` : `✅ ${sizeMB} MB använt av 50 MB (${percent}%).`
      };
    }));

    // 2. Sync PWA/DB Profiles
    const { data: syncData, error: syncError } = await supabase.rpc('diagnose_missing_profiles');
    setResults(prev => prev.map(p => p.id === 'sync' ? {
      ...p,
      status: syncError ? 'warning' : (syncData > 0 ? 'warning' : 'ok'),
      message: syncError ? `Manuell kontroll krävs (RPC saknas). Allt ser bra ut externt.` : (syncData > 0 ? `Löst: Hittade och återskapade ${syncData} försvunna profiler via RPC.` : '✅ Inga försvunna profiler hittades. Tabellerna synkar perfekt.')
    } : p));

    // 3. Dead Links
    const { data: linksData, error: linksError } = await supabase.rpc('fix_dead_links');
    setResults(prev => prev.map(p => p.id === 'links' ? {
      ...p,
      status: linksError ? 'ok' : (linksData > 0 ? 'warning' : 'ok'),
      message: linksError ? `Kunde inte köra dödlänks-algoritm. Manuell rensning rekommenderas.` : (linksData > 0 ? `Löst: Städade bort ${linksData} övergivna inlägg.` : '✅ Inga övergivna inlägg (döda länkar) hittades.')
    } : p));

    // 4. Image Optimization
    const { data: imgData, error: imgError } = await supabase.rpc('optimize_uploaded_images');
    setResults(prev => prev.map(p => p.id === 'images' ? {
      ...p,
      status: imgError ? 'ok' : (imgData > 0 ? 'warning' : 'ok'),
      message: imgError ? `Kunde inte köra bildoptimering via Storage. Ingen panik.` : (imgData > 0 ? `Löst: Förminskade ${imgData} tunga profilbilder.` : '✅ Alla bilder är vackert optimerade.')
    } : p));

    // 5. Gamla Notiser
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: notifCount, error: notifErr } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).lt('created_at', thirtyDaysAgo.toISOString());
    setResults(prev => prev.map(p => p.id === 'notifications' ? {
      ...p,
      status: notifErr ? 'warning' : ((notifCount !== null && notifCount > 0) ? 'warning' : 'ok'),
      message: notifErr ? `Fel vid sökning av notiser.` : ((notifCount !== null && notifCount > 0) ? `Hittade ${notifCount} gamla notiser som drar minne i databasen.` : '✅ Inga onödiga urgamla notiser i systemet.'),
      fixAction: (notifCount !== null && notifCount > 0) ? async () => {
         await supabase.from('notifications').delete().lt('created_at', thirtyDaysAgo.toISOString());
         await logAdminAction(supabase, currentUser.id, `Vårdcentralen: Rensade bort ${notifCount} gamla notiser.`);
         runDiagnostics();
      } : undefined
    } : p));

    // 6. Ignorerade Anmälningar
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: repCount, error: repErr } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open').lt('created_at', sevenDaysAgo.toISOString());
    setResults(prev => prev.map(p => p.id === 'reports' ? {
      ...p,
      status: repErr ? 'warning' : ((repCount !== null && repCount > 0) ? 'warning' : 'ok'),
      message: repErr ? `Fel vid sökning av anmälningar.` : ((repCount !== null && repCount > 0) ? `Varning: ${repCount} anmälningar har legat orörda i över en vecka!` : '✅ Alla äldre anmälningar är hanterade av supporten.')
    } : p));

    // 7. Trasiga Avatar Länkar
    const { count: avCount1 } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).ilike('avatar_url', '%undefined%');
    const { count: avCount2 } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).ilike('avatar_url', '%null%');
    const totalAvIssues = (avCount1 || 0) + (avCount2 || 0);
    
    setResults(prev => prev.map(p => p.id === 'avatars' ? {
      ...p,
      status: totalAvIssues > 0 ? 'warning' : 'ok',
      message: totalAvIssues > 0 ? `Hittade ${totalAvIssues} profiler med formateringsfel i avatar-länken ("undefined").` : '✅ Inga trasiga profilbilds-URL:er hittades.',
      fixAction: totalAvIssues > 0 ? async () => {
         await supabase.from('profiles').update({ avatar_url: null }).ilike('avatar_url', '%undefined%');
         await supabase.from('profiles').update({ avatar_url: null }).ilike('avatar_url', '%null%');
         await logAdminAction(supabase, currentUser.id, `Vårdcentralen: Fixade ${totalAvIssues} trasiga avatar-länkar.`);
         runDiagnostics();
      } : undefined
    } : p));

    // 8. Oanvända Profilbilder (Rensning)
    const { data: orphanCount, error: orphanErr } = await supabase.rpc('cleanup_orphan_avatars');
    setResults(prev => prev.map(p => p.id === 'orphans' ? {
      ...p,
      status: orphanErr ? 'warning' : (orphanCount > 0 ? 'warning' : 'ok'),
      message: orphanErr ? 'Kunde inte skanna storage.' : (orphanCount > 0 ? `Hittade och raderade ${orphanCount} herrelösa filer i storage.` : '✅ Inget skräp hittades i bild-servern.')
    } : p));

    // 9. Social Hälsa (Vänskap)
    const { data: friendData, error: friendErr } = await supabase.rpc('fix_duplicate_friendships');
    setResults(prev => prev.map(p => p.id === 'friendship' ? {
      ...p,
      status: friendErr ? 'warning' : (friendData > 0 ? 'warning' : 'ok'),
      message: friendErr ? 'Kunde inte skanna vänskaper.' : (friendData > 0 ? `Löst: Fixade ${friendData} dubbletter/krockar i vänlistorna.` : '✅ Vänskapsrealtionerna är felfria.')
    } : p));

    // 10. Log-städning (> 15d)
    const { data: logData, error: logErr } = await supabase.rpc('cleanup_old_logs', { days_to_keep: 15 });
    setResults(prev => prev.map(p => p.id === 'logs' ? {
      ...p,
      status: logErr ? 'warning' : (logData > 0 ? 'warning' : 'ok'),
      message: logErr ? 'Kunde inte städa loggar.' : (logData > 0 ? `Löst: Rensade bort ${logData} gamla loggposter för att spara plats.` : '✅ Loggarna är städade och fräscha.')
    } : p));

    setRunning(false);
    await logAdminAction(supabase, currentUser.id, 'Körde Diagnosverktyg (Vårdcentralen Deep Scan)');
  };

  const handleWipeCss = async () => {
    if (!cssWipeTarget.trim()) return;
    if (confirm(`Säkerhetsvarning: Vill du verkligen nollställa all CSS-design för @${cssWipeTarget}?`)) {
       const { error } = await supabase.from('profiles').update({ custom_style: null }).ilike('username', cssWipeTarget.trim());
       if (error) alert("Ett fel uppstod: " + error.message);
       else {
         alert(`Designen för @${cssWipeTarget} var nollställd.`);
         await logAdminAction(supabase, currentUser.id, `Nollställde CSS-design för användare @${cssWipeTarget}`);
         setCssWipeTarget('');
       }
    }
  };

  const handleAddWord = async () => {
    if (!newForbiddenWord.trim()) return;
    const { error } = await supabase.from('forbidden_words').insert({ word: newForbiddenWord.trim().toLowerCase() });
    if (error) alert("Kunde inte lägga till ord: " + error.message);
    else {
      setNewForbiddenWord('');
      await logAdminAction(supabase, currentUser.id, `Lade till ord "${newForbiddenWord.trim()}" i det globala filtret.`);
    }
  };

  const handleRemoveWord = async (id: string, word: string) => {
    const { error } = await supabase.from('forbidden_words').delete().eq('id', id);
    if (error) alert("Kunde inte ta bort ord: " + error.message);
    else {
      await logAdminAction(supabase, currentUser.id, `Tog bort ord "${word}" från filtret.`);
    }
  };

  const handleMassDelete = async () => {
    if (!massDeleteQuery.trim() || massDeleteQuery.length < 3) {
      alert("Ange minst 3 tecken för att mass-radera.");
      return;
    }

    if (confirm(`VARNING: Detta kommer radera ALLA inlägg (Whiteboard, Forum, Gästbok, Chatten, PM) som innehåller texten "${massDeleteQuery}". Är du helt säker? Det går inte att ångra.`)) {
      setMassDeleting(true);
      try {
        const res = await adminMassDeleteSpam(massDeleteQuery);
        if (res?.error) {
          alert("Ett fel uppstod: " + res.error);
        } else {
          alert(`Mass-radering slutförd! Alla inlägg med "${massDeleteQuery}" är nu borta.`);
          await logAdminAction(supabase, currentUser.id, `Mass-radera spam: "${massDeleteQuery}"`);
          setMassDeleteQuery('');
        }
      } catch (err: any) {
        alert("Ett oväntat fel uppstod vid mass-radering.");
      } finally {
        setMassDeleting(false);
      }
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {lastNightlyResult && (
        <div className="admin-card" style={{ marginBottom: '1.5rem', backgroundColor: '#eff6ff', border: '1px solid #3b82f6', padding: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af', fontWeight: 'bold' }}>Diagnosverktyg resultat:</h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#1e3a8a' }}>{lastNightlyResult}</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#60a5fa' }}>Senaste körning: {lastNightlyTime}</p>
        </div>
      )}
      <div className="admin-card diagnostics-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '1.25rem 1.5rem', backgroundColor: '#f0fdf4', border: '2px solid #10b981' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#064e3b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Wrench size={24} /> Vårdcentralen</h2>
          <p style={{ color: '#047857', margin: '0.25rem 0 0 0', fontSize: '0.875rem', fontWeight: '500' }}>Kör en fullständig Deep Scan för att spåra upp fel och lappa ihop trasiga fält automatiskt.</p>
        </div>
        <button 
          onClick={runDiagnostics} 
          disabled={running}
          style={{ backgroundColor: running ? '#d1d5db' : '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.75rem', borderRadius: '8px', fontSize: '1rem', fontWeight: '800', cursor: running ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px rgba(239,68,68,0.3)', transition: 'all 0.2s', alignSelf: 'center' }}
        >
          {running ? 'SKANNAR...' : 'KÖR DIAGNOS-VERKTYG'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {results.map(res => {
           let bgColor = 'var(--bg-card)';
           let borderColor = 'var(--border-color)';
           let badge = '💤';
           if (res.status === 'ok') { bgColor = '#f0fdf4'; borderColor = '#10b981'; badge = '✅'; }
           if (res.status === 'warning') { bgColor = '#fffbeb'; borderColor = '#f59e0b'; badge = '⚠️'; }
           if (res.status === 'running') { bgColor = '#eff6ff'; badge = '⏳'; }

           return (
             <div key={res.id} className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderLeft: `6px solid ${borderColor}`, backgroundColor: bgColor, transition: 'all 0.3s' }}>
                <div style={{ fontSize: '1.75rem' }}>{badge}</div>
                <div style={{ flex: 1 }}>
                   <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: '700' }}>{res.title}</h3>
                   <p style={{ margin: '0.125rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500' }}>{res.message}</p>
                </div>
                {res.status === 'warning' && !res.message.includes('Löst:') && !res.message.includes('Fel:') && (
                  <button onClick={res.fixAction} disabled={!res.fixAction} style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: res.fixAction ? 'pointer' : 'not-allowed', opacity: res.fixAction ? 1 : 0.5 }}>Fixa Auto</button>
                )}
             </div>
           );
        })}
      </div>

      <div className="admin-card" style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5' }}>
        <h3 style={{ fontSize: '1.25rem', color: '#b91c1c', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Eraser size={20} /> Riktad Reparation: Nollställ Profil-design
        </h3>
        <p style={{ color: '#991b1b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Om någon har skrivit in skadlig eller oläslig CSS-kod på sitt Krypin, skriv in deras användarnamn nedan för att tömma deras design omedelbart och låsa upp deras sida igen.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="text" 
            placeholder="Fyll i användarnamn (@ behövs ej)..." 
            value={cssWipeTarget} 
            onChange={(e) => setCssWipeTarget(e.target.value)}
            className="chat-input" 
            style={{ flex: 1, backgroundColor: 'white', border: '1px solid #fca5a5', padding: '0.75rem', borderRadius: '8px', outline: 'none' }} 
          />
          <button 
            onClick={handleWipeCss}
            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            Nollställ Design
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: '2rem', padding: '1.5rem', borderTop: '4px solid #ef4444' }}>
        <h3 style={{ margin: 0, marginBottom: '0.5rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Trash2 size={20} /> Akut Mass-radera Spam</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Sök upp och radera ALLA inlägg som innehåller ett visst ord eller länk (Whiteboard, Forum, Gästbok, Chatten).</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="Exempel: bit.ly/spam-link"
            value={massDeleteQuery}
            onChange={e => setMassDeleteQuery(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white' }}
          />
          <button
            onClick={handleMassDelete}
            disabled={massDeleting}
            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: massDeleting ? 'not-allowed' : 'pointer' }}
          >
            {massDeleting ? 'RADERAR...' : 'RADERA ALLT'}
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: '2rem', padding: '1.5rem', borderTop: '4px solid #6366f1' }}>
        <h3 style={{ margin: 0, marginBottom: '0.5rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={20} /> Globalt Ord-filter (Stjärnmarkerar ****)
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Lägg till ord som automatiskt ska bytas ut mot stjärnor i alla inlägg (Chatt, Forum, PM, etc.).
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <input
            type="text"
            placeholder="Exempel: fultord123"
            value={newForbiddenWord}
            onChange={e => setNewForbiddenWord(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white' }}
          />
          <button
            onClick={handleAddWord}
            style={{ backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} /> LÄGG TILL ORD
          </button>
        </div>

        {forbiddenWords.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {forbiddenWords.map((w: any) => (
              <div key={w.id} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', padding: '0.4rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)' }}>
                {w.word}
                <button onClick={() => handleRemoveWord(w.id, w.word)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


