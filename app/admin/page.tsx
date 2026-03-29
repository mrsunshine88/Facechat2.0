"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Users, Database, AlertTriangle, Activity, Search, ShieldAlert, LogOut, LifeBuoy, Trash2, CheckCircle, Ban, PlayCircle, Lock, Edit2, Plus, Terminal, History, Wrench, Eraser, UserPlus, EyeOff, Globe, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { deleteUserAccount } from '../actions/userActions';
import { toggleBlockUser, adminDeleteContent, adminResolveReport, adminRoomAction, adminUpdatePermissions, adminDeleteSnakeScore, adminDeleteSupportTicket, adminRunDeepScan, adminFixDeepScanIssue, adminAddSecretUserToRoom, adminRemoveSecretUserFromRoom, adminResetAvatar, adminResetPresentation, adminResetTheme, adminMassDeleteSpam } from '../actions/adminActions';
import { adminBlockIP, adminUnblockIP, adminAddForbiddenWord, adminRemoveForbiddenWord } from '@/app/actions/securityActions';
import { useWordFilter } from '@/hooks/useWordFilter';
import { useUser } from '@/components/UserContext';

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Översikt', icon: Activity },
  { id: 'users', label: 'Användare', icon: Users },
  { id: 'bilder', label: 'Bilder', icon: Shield },
  { id: 'reports', label: 'Anmälningar', icon: AlertTriangle },
  { id: 'security', label: 'Säkerhet', icon: ShieldAlert },
  { id: 'rooms', label: 'Rum', icon: Database },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'diagnostics', label: 'Hälsokontroll', icon: Wrench },
  { id: 'audit', label: 'Loggar', icon: History }
];

export const logAdminAction = async (supabase: any, adminId: string, action: string) => {
  try {
    await supabase.from('admin_logs').insert({ admin_id: adminId, action });
  } catch (e) { }
};

const cleanUrl = (url?: string) => url ? url.split('?')[0] : null;

const AdminSkeleton = () => (
  <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
      <div className="skeleton-pulse" style={{ width: '200px', height: '40px', borderRadius: '8px' }}></div>
      <div className="skeleton-pulse" style={{ width: '100px', height: '40px', borderRadius: '8px' }}></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '2rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton-pulse" style={{ width: '100%', height: '50px', borderRadius: '8px' }}></div>
        ))}
      </div>
      <div className="card skeleton-pulse" style={{ width: '100%', height: '600px', borderRadius: '12px' }}></div>
    </div>
  </div>
);

const supabase = createClient();

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const cleanUrl = (url?: string) => url ? url.split('?')[0] : null;
  const { user, profile, loading: userLoading, refreshProfile } = useUser();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);
  const router = useRouter();


  useEffect(() => {
    if (userLoading) return;
    if (!user || !profile) {
      router.push('/');
      return;
    }
    
    if (!profile.is_admin && user.email !== 'apersson508@gmail.com') { 
      router.push('/');
      return;
    }

    setUserProfile({ ...profile, auth_email: user.email });

    // Support for direct links to tabs via ?tab=...
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }

    // Realtime profile/permission listener (Sync med global context vid ändring)
    const profileSub = supabase.channel('admin-self-update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
        refreshProfile(); // Trigga omhämtning i global context
      }).subscribe();
    
    return () => { supabase.removeChannel(profileSub); };
  }, [router, user, profile, userLoading, refreshProfile]);

  useEffect(() => {
    if (!userProfile) return;
    const isRoot = userProfile.auth_email === 'apersson508@gmail.com' || userProfile.perm_roles === true || userProfile.username === 'mrsunshine88';
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

  // Hämta ANMÄLNINGAR count (Open)
  useEffect(() => {
    if (userProfile) {
      const isRoot = userProfile.auth_email === 'apersson508@gmail.com';
      const canManageContent = isRoot || userProfile.perm_content === true;

      if (canManageContent) {
        const fetchReportsCount = async () => {
          let query = supabase.from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'open');
          
          if (!isRoot) {
            // Endast ROOT (mrsunshine88) ser anmälningar mot sig själv
            query = query.neq('reported_user_id', userProfile.id);
          }

          const { count } = await query;
          if (count !== null) setUnreadReportsCount(count);
        };

        fetchReportsCount();
        const sub = supabase.channel('admin-reports-alerts')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
            fetchReportsCount();
          }).subscribe();

        return () => { supabase.removeChannel(sub); };
      }
    }
  }, [userProfile, supabase]);

  if (!userProfile) return <AdminSkeleton />;

  const isRoot = userProfile.auth_email === 'apersson508@gmail.com' || userProfile.perm_roles === true || userProfile.username?.toLowerCase() === 'mrsunshine88';
  const canManageUsers = isRoot || userProfile.perm_users === true;
  const canManageContent = isRoot || userProfile.perm_content === true;
  const canManageRooms = isRoot || userProfile.perm_rooms === true;
  const canManageRoles = isRoot || userProfile.perm_roles === true;
  const canManageSupport = isRoot || userProfile.perm_support === true;
  const canManageLogs = isRoot || userProfile.perm_logs === true;
  const canManageStats = isRoot || userProfile.perm_stats === true;
  const canManageDiagnostics = isRoot || userProfile.perm_diagnostics === true;
  const canManageChat = isRoot || userProfile.perm_chat === true;
  const canManageImages = isRoot || userProfile.perm_images === true;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return canManageStats ? <AdminDashboard supabase={supabase} /> : <NoAccess />;
      case 'users': return canManageUsers ? <AdminUsers supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'bilder': return canManageImages ? <AdminBilder supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'reports': return canManageContent ? <AdminReports supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'content': return (canManageContent || canManageChat) ? <AdminContent supabase={supabase} currentUser={userProfile} perms={{ content: canManageContent, chat: canManageChat }} /> : <NoAccess />;
      case 'rooms': return canManageRooms ? <AdminRooms supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'support': return canManageSupport ? <AdminSupport supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'permissions': return canManageRoles ? <AdminPermissions supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'blocks': return canManageUsers ? <AdminBlocks supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'logs': return canManageLogs ? <AdminLogs supabase={supabase} /> : <NoAccess />;
      case 'diagnostics': return canManageDiagnostics ? <AdminDiagnostics supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      default: return canManageStats ? <AdminDashboard supabase={supabase} /> : <NoAccess />;
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: 'calc(100vh - 74px)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'Inter, sans-serif' }} className="admin-layout">

      {/* Sidebar */}
      <div style={{ width: '280px', minHeight: 'calc(100vh - 74px)', height: 'calc(100vh - 74px)', position: 'sticky', top: '74px', backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }} className="admin-sidebar">
        <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: '1.2' }}>
            <ShieldAlert size={28} /> ADMIN
          </h1>
          <p style={{ fontSize: '0.75rem', marginTop: '0.75rem', color: 'var(--text-muted)' }}>Inloggad: {userProfile.username}</p>
          <span style={{ display: 'inline-block', marginTop: '0.5rem', backgroundColor: isRoot ? '#7f1d1d' : '#1e3a8a', color: isRoot ? '#fca5a5' : '#bfdbfe', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
            {isRoot ? 'SUPERADMIN' : 'ADMIN'}
          </span>
        </div>

        <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }} className="admin-sidebar-menu">

          <div className="hide-on-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
            {canManageUsers && (
              <button onClick={() => setActiveTab('blocks')} className={`admin-nav-link ${activeTab === 'blocks' ? 'active' : ''}`}>
                <ShieldAlert size={18} /> Blockeringar
              </button>
            )}
            {canManageImages && (
              <button onClick={() => setActiveTab('bilder')} className={`admin-nav-link ${activeTab === 'bilder' ? 'active' : ''}`}>
                <Shield size={18} /> Bilder
              </button>
            )}
            {canManageContent && (
              <button onClick={() => setActiveTab('reports')} className={`admin-nav-link ${activeTab === 'reports' ? 'active' : ''}`} style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <AlertTriangle size={18} /> Anmälningar
                </div>
                {unreadReportsCount > 0 && (
                  <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', minWidth: '20px', padding: '0.15rem 0.4rem', borderRadius: '999px', textAlign: 'center', display: 'inline-block' }}>
                    {unreadReportsCount}
                  </span>
                )}
              </button>
            )}
            {(canManageContent || canManageChat) && (
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
          </div>

          <div className="hide-on-desktop" style={{ width: '100%', marginBottom: '1rem' }}>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="admin-input"
              style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}
            >
              {canManageStats && <option value="dashboard">Dashboard & Statistik</option>}
              {canManageUsers && <option value="users">Användare</option>}
              {canManageUsers && <option value="blocks">Blockeringar</option>}
              {canManageImages && <option value="bilder">Bilder</option>}
              {canManageContent && <option value="reports">Anmälningar</option>}
              {(canManageContent || canManageChat) && <option value="content">Innehåll & Moderering</option>}
              {canManageRooms && <option value="rooms">Hantera Chattrum</option>}
              {canManageSupport && <option value="support">Supportärenden {unreadSupportCount > 0 ? `(${unreadSupportCount})` : ''}</option>}
              {canManageRoles && <option value="permissions">Behörigheter & Roller</option>}
              {canManageLogs && <option value="logs">Loggar</option>}
              {canManageDiagnostics && <option value="diagnostics">Vårdcentralen</option>}
            </select>
          </div>

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
        .admin-input:focus { border-color: #ef4444; background-color: var(--bg-card); }
        .permission-card-hover { transition: transform 0.2s, box-shadow 0.2s; }
        .permission-card-hover:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: #3b82f6 !important; }
        
        @media (max-width: 768px) {
          .admin-responsive-card { flex-direction: column !important; gap: 1rem !important; align-items: stretch !important; }
          .admin-card-content { min-width: 0 !important; width: 100% !important; }
          .admin-card-actions { width: 100% !important; justify-content: flex-start !important; }
        }
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

const AdminDashboard = ({ supabase }: { supabase: any }) => {
  const [stats, setStats] = useState({ users: 0, posts: 0, tickets: 0, online: 0, banned: 0, reports: 0, ipBlocks: 0 });
  const [latestLogins, setLatestLogins] = useState<any[]>([]);

  useEffect(() => {
    async function loadDash() {
      try {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        
        const [
          { count: usersCount },
          { count: wbCount },
          { count: gbCount },
          { count: fCount },
          { count: ticketsCount },
          { count: bannedCount },
          { count: reportsCount },
          { count: userBlocksCount },
          { count: ipBlocksCount },
          { count: onlineCount },
          loginsRes
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('whiteboard').select('*', { count: 'exact', head: true }),
          supabase.from('guestbook').select('*', { count: 'exact', head: true }),
          supabase.from('forum_posts').select('*', { count: 'exact', head: true }),
          supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('admin_deleted', false),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
          supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('user_blocks').select('*', { count: 'exact', head: true }),
          supabase.from('blocked_ips').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('last_seen', fifteenMinsAgo),
          supabase.from('profiles').select('username, last_seen, created_at, is_banned').order('last_seen', { ascending: false, nullsFirst: false }).limit(10)
        ]);

        setStats({
          users: usersCount || 0,
          posts: userBlocksCount || 0,
          tickets: ticketsCount || 0,
          online: onlineCount || 0,
          banned: bannedCount || 0,
          reports: reportsCount || 0,
          ipBlocks: ipBlocksCount || 0
        });

        if (loginsRes.data) setLatestLogins(loginsRes.data);
      } catch (err) {
        console.error("Dashboard load error:", err);
      }
    }
    loadDash();

    const channel = supabase.channel('admin_dash_realtime_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadDash)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, loadDash)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, loadDash)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_ips' }, loadDash)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-main)' }}>Dashboard & Statistik</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="admin-card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Totalt antal Användare</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: '#3b82f6' }}>{stats.users}</p>
        </div>
        <div className="admin-card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Antal admin blockat</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: stats.banned > 0 ? '#ef4444' : '#6b7280' }}>{stats.banned}</p>
        </div>
        <div className="admin-card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Öppna Supportärenden</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: stats.tickets > 0 ? '#ef4444' : '#6b7280' }}>{stats.tickets}</p>
        </div>
        <div className="admin-card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Antal personer blockat</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: stats.posts > 0 ? '#ef4444' : '#6b7280' }}>{stats.posts}</p>
        </div>
        <div className="admin-card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Öppna Anmälningar</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: stats.reports > 0 ? '#ef4444' : '#6b7280' }}>{stats.reports}</p>
        </div>
        <div className="admin-card">
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Totalt antal IP-spärrar</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: stats.ipBlocks > 0 ? '#ef4444' : '#6b7280' }}>{stats.ipBlocks}</p>
        </div>
        <div className="admin-card" style={{ border: '1px solid #10b981', backgroundColor: '#ecfdf5' }}>
          <h3 style={{ fontSize: '1rem', color: '#047857', marginBottom: '0.5rem' }}>Inloggade just nu</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} /> {stats.online}</p>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Senaste Inloggningar (Realtid)
        </h3>
        <div style={{ overflowX: 'auto' }} className="hide-on-mobile">
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
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
                    <td style={{ padding: '0.75rem', fontWeight: '600', color: 'var(--theme-primary)' }}>{user.username}</td>
                    <td style={{ padding: '0.75rem' }}>{dateObj.toLocaleDateString('sv-SE')}</td>
                    <td style={{ padding: '0.75rem' }}>{dateObj.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {user.is_banned ? <span style={{ color: '#ef4444', fontWeight: 'bold' }}>BLOCKERAD</span> : <span style={{ color: '#10b981' }}>Aktiv</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="hide-on-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {latestLogins.map((user, idx) => {
            const dateObj = new Date(user.last_seen || user.created_at);
            return (
              <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: user.is_banned ? '#fef2f2' : 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--theme-primary)' }}>{user.username}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateObj.toLocaleDateString('sv-SE')} {dateObj.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
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

const AdminUsers = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [blockedIps, setBlockedIps] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [protectedIp, setProtectedIp] = useState<string | null>(null);

  async function fetchUsers(query?: string) {
    let q = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    if (query) {
      q = q.ilike('username', `%${query}%`);
    }
    const { data } = await q;
    if (data) {
      const dbUsers = [...data];
      const meIdx = dbUsers.findIndex(u => u.username?.toLowerCase() === 'admin' || u.username?.toLowerCase() === 'apersson508' || u.username?.toLowerCase() === 'mrsunshine88' || u.id === currentUser.id);
      if (meIdx !== -1) {
        const me = dbUsers.splice(meIdx, 1)[0];
        dbUsers.unshift(me);
      } else if (currentUser?.auth_email === 'apersson508@gmail.com' || currentUser?.username?.toLowerCase() === 'mrsunshine88') {
        dbUsers.unshift({
          id: currentUser.id || 'root-fallback',
          username: currentUser.username || 'mrsunshine88',
          auth_email: 'apersson508@gmail.com',
          is_admin: true,
          perm_users: true, perm_content: true, perm_rooms: true,
          perm_support: true, perm_logs: true, perm_roles: true, perm_chat: true,
          perm_diagnostics: true, perm_stats: true
        });
      }
      
      const rootAdmin = dbUsers.find(u => u.auth_email === 'apersson508@gmail.com' || u.username?.toLowerCase() === 'apersson508' || u.username?.toLowerCase() === 'mrsunshine88');
      if (rootAdmin && rootAdmin.last_ip) {
        setProtectedIp(rootAdmin.last_ip);
      }
      
      setUsers(dbUsers);
    }
  }

  async function fetchBlockedIps() {
    const { data } = await supabase.from('blocked_ips').select('*').order('created_at', { ascending: false });
    if (data) setBlockedIps(data);
  }

  useEffect(() => {
    async function checkBan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', user.id).single();
        if (profile?.is_banned) {
          window.location.href = '/bannad';
        }
      }
    }
    
    checkBan();
    Promise.all([fetchUsers(), fetchBlockedIps()]);

    const channel = supabase.channel('admin_users_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
        setUsers(prev => prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u));
      })
      .subscribe();

    const ipChannel = supabase.channel('admin_blocked_ips_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_ips' }, fetchBlockedIps)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(ipChannel);
    };
  }, [supabase]);

  useEffect(() => {
    if (search.trim().length > 1) {
      const timer = setTimeout(() => {
        logAdminAction(supabase, currentUser.id, `Sökte efter användare: "${search.trim()}"`);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [search, supabase, currentUser.id]);

  const handleToggleBlock = async (user: any) => {
    if (user.username?.toLowerCase() === 'apersson508' || user.username?.toLowerCase() === 'mrsunshine88' || user.id === currentUser.id) {
       return alert('Detta konto är skyddat som Super-Admin.');
    }
    const newStatus = !user.is_banned;

    // Optimistic UI for User Ban
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_banned: newStatus } : u));

    const res = await toggleBlockUser(user.id, newStatus);
    if (res?.error) {
       setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_banned: !newStatus } : u));
       return alert('Fel: ' + res.error);
    }
    await logAdminAction(supabase, currentUser.id, `${newStatus ? 'Blockerade' : 'Avblockerade'} ${user.username}`);
   };

  const handleBlockIP = async (ip: string, username: string) => {
    const cleanIp = ip?.trim();
    if (!cleanIp || cleanIp === '127.0.0.1') return alert('Kunde inte identifiera giltig IP.');
    const reason = prompt(`Ange anledning för att spärra IP ${cleanIp}:`, 'Spam/Missbruk');
    if (reason === null) return;

    const tempBlock = { ip: cleanIp, reason, created_at: new Date().toISOString() };
    setBlockedIps(prev => [tempBlock, ...prev]);

    const res = await adminBlockIP(cleanIp, reason);
    if (res?.error) {
       setBlockedIps(prev => prev.filter(b => b.ip !== cleanIp));
       return alert('Säkerhetsstopp: ' + res.error);
    }
    
    await logAdminAction(supabase, currentUser.id, `Spärrade IP-adress ${ip} (${username})`);
   };

  const handleUnblockIP = async (ip: string) => {
    if (confirm(`Vill du ta bort spärren för IP ${ip}?`)) {
      const oldBlocks = [...blockedIps];
      setBlockedIps(prev => prev.filter(b => b.ip !== ip));

      const res = await adminUnblockIP(ip);
      if (res?.error) {
         setBlockedIps(oldBlocks);
         return alert('Fel: ' + res.error);
      }
      await logAdminAction(supabase, currentUser.id, `Tog bort IP-spärr för ${ip}`);
    }
   };

  const handleDeleteUser = async (user: any) => {
    if (user.username?.toLowerCase() === 'apersson508' || user.username?.toLowerCase() === 'mrsunshine88' || user.id === currentUser.id) {
       return alert('Nix, du kan inte radera the creator!');
    }
    if (user.perm_roles && user.is_admin) return alert('Ett Root-Konto kan inte raderas.');
    if (confirm(`VARNING: Detta tar bort ${user.username} och allt deras innehåll för alltid. Är du helt säker?`)) {
      const res = await deleteUserAccount(user.id);
      if (res?.error) {
        alert('Ett fel uppstod vid radering: ' + res.error);
        return;
      }
      await logAdminAction(supabase, currentUser.id, `Raderade kontot ${user.username} permanent från systemet`);
      fetchUsers(search);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-main)' }}>Användare</h2>
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); fetchUsers(e.target.value); }} placeholder="Sök på användarnamn..." className="admin-input" style={{ flex: '1 1 auto', minWidth: '150px' }} />
          <button onClick={() => { fetchUsers(search); logAdminAction(supabase, currentUser.id, `Tryckte på SÖK-knappen i Användare (sökterm: "${search}")`); }} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.75rem 2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 auto' }}><Search size={18} /> Sök</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {users.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga användare hittades.</p>}
        {users.map(u => {
          const isAutoBanned = u.ban_reason?.startsWith('System:');
          const isIpBlocked = blockedIps.some(b => b.ip?.trim() === u.last_ip?.trim());
          return (
            <div 
              key={u.id} 
              className="admin-card admin-responsive-card" 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '1rem 1.5rem', 
                flexWrap: 'wrap', 
                gap: '1rem', 
                borderLeft: isAutoBanned ? '4px solid #fb923c' : (u.is_banned ? '4px solid #ef4444' : '4px solid transparent'), 
                backgroundColor: isAutoBanned ? '#fff7ed' : (u.is_banned ? '#fef2f2' : 'var(--bg-card)') 
              }}
            >
              <div className="admin-card-content" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '50%', overflow: 'hidden' }}>
                  {u.avatar_url && <img src={u.avatar_url} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)' }}>
                    {u.username} 
                    {u.is_admin && <span style={{ color: '#ef4444', fontSize: '0.75rem', marginLeft: '0.5rem' }}>(ADMIN)</span>}
                    {isAutoBanned && <span style={{ color: '#fb923c', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>[AUTOMATISKT SPÄRRAD]</span>}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Ort: {u.city || 'Ej angiven'} • Gick med {new Date(u.created_at).toLocaleDateString()}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6366f1', fontWeight: 'bold' }}>
                    IP: {u.last_ip || 'Okänd'}
                  </p>
                  {u.ban_reason && <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: isAutoBanned ? '#c2410c' : '#b91c1c', fontWeight: '600' }}>Anledning: {u.ban_reason}</p>}
                </div>
              </div>

              <div className="admin-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                {u.is_banned ? (
                  <button onClick={() => handleToggleBlock(u)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <PlayCircle size={14} /> Avblocka
                  </button>
                ) : (
                  <button onClick={() => handleToggleBlock(u)} style={{ backgroundColor: '#fcf8e3', color: '#8a6d3b', border: '1px solid #faebcc', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Ban size={14} /> Blocka
                  </button>
                )}

                {(() => {
                  const isRootUser = u.username?.toLowerCase() === 'apersson508' || u.username?.toLowerCase() === 'mrsunshine88' || u.auth_email === 'apersson508@gmail.com';
                  const isCurrentAdmin = u.id === currentUser.id;
                  
                  // Skydda om det är Root, om det är DU, eller om personen delar DIN eller ROOTS nuvarande IP
                  const isProtected = isRootUser || isCurrentAdmin || (u.last_ip && (u.last_ip === protectedIp || u.last_ip === currentUser?.last_ip));

                  if (isProtected) {
                    return (
                      <div style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #10b981', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', boxShadow: '0 2px 4px rgba(22,163,74,0.1)' }}>
                        <CheckCircle size={14} /> Säkert IP ✅
                      </div>
                    );
                  }

                  if (isIpBlocked) {
                    return (
                      <div style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', boxShadow: '0 2px 4px rgba(239,68,68,0.05)' }}>
                        <Lock size={14} /> Redan Spärrad
                      </div>
                    );
                  }

                  return (
                    <button 
                      onClick={() => handleBlockIP(u.last_ip, u.username)} 
                      disabled={!u.last_ip || u.last_ip === 'Okänd'}
                      style={{ 
                        backgroundColor: '#1e293b', 
                        color: 'white', 
                        border: 'none', 
                        padding: '0.5rem 1rem', 
                        borderRadius: '6px', 
                        cursor: (!u.last_ip || u.last_ip === 'Okänd') ? 'not-allowed' : 'pointer', 
                        fontWeight: '600', 
                        fontSize: '0.75rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.25rem',
                        opacity: (!u.last_ip || u.last_ip === 'Okänd') ? 0.5 : 1
                      }}
                      title={(!u.last_ip || u.last_ip === 'Okänd') ? "Går ej att spärra (IP saknas)" : "Spärra personens IP-adress helt"}
                    >
                      <Globe size={14} /> Spärra IP
                    </button>
                  );
                })()}

                <button onClick={() => handleDeleteUser(u)} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Trash2 size={14} /> Radera Konto
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {blockedIps.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} color="#ef4444" /> Spärrade IP-nummer
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {blockedIps.map(item => (
              <div key={item.ip} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderLeft: '4px solid #1e293b', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-main)' }}>{item.ip}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Orsak: {item.reason || 'Ingen'}</p>
                </div>
                <button 
                  onClick={() => handleUnblockIP(item.ip)}
                  style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                >
                  Ta bort spärr
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================================
// 2.3 BILDER (Avatar Review Gallery)
// ==========================================================
const AdminBilder = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [usersWithAvatars, setUsersWithAvatars] = useState<any[]>([]);
  const [inactiveImages, setInactiveImages] = useState<string[]>([]);
  const [mode, setMode] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(true);
  const [deletingAll, setDeletingAll] = useState(false);

  const fetchAvatars = async () => {
    setLoading(true);
    if (mode === 'active') {
      const { data } = await supabase.from('profiles')
        .select('*')
        .not('avatar_url', 'is', null)
        .neq('avatar_url', '')
        .order('created_at', { ascending: false });
      if (data) setUsersWithAvatars(data);
    } else {
      try {
        // 1. Hämta ALLA filer från avatars hinken (hantera 1000+ filer)
        let allStorageFiles: any[] = [];
        let offset = 0;
        let hasMoreFiles = true;
        while (hasMoreFiles) {
          const { data: batch, error: err } = await supabase.storage.from('avatars').list('', { limit: 1000, offset });
          if (err || !batch || batch.length === 0) {
            hasMoreFiles = false;
          } else {
            allStorageFiles = [...allStorageFiles, ...batch];
            offset += 1000;
            if (batch.length < 1000) hasMoreFiles = false;
          }
        }

        // 2. Hämta ALLA aktiva avatar-URL:er (hantera 1000+ användare)
        let allActiveUrls: string[] = [];
        let from = 0;
        let hasMoreProfiles = true;
        while (hasMoreProfiles) {
          const { data: batch, error: err } = await supabase.from('profiles')
            .select('avatar_url')
            .not('avatar_url', 'is', null)
            .range(from, from + 999);
          if (err || !batch || batch.length === 0) {
            hasMoreProfiles = false;
          } else {
            allActiveUrls = [...allActiveUrls, ...batch.map((p: any) => p.avatar_url)];
            from += 1000;
            if (batch.length < 1000) hasMoreProfiles = false;
          }
        }
        
        if (allStorageFiles.length > 0) {
          const activeFileNames = new Set(
            allActiveUrls
              .map((url: string) => {
                try {
                  return url.split('/').pop()?.split('?')[0];
                } catch (e) { return null; }
              })
              .filter(Boolean)
          );
          
          const orphans = allStorageFiles
            .map((f: any) => f.name)
            .filter((name: string) => name !== '.emptyFolderPlaceholder' && !activeFileNames.has(name));
            
          setInactiveImages(orphans);
        }
      } catch (err) {
        console.error("Kunde inte hämta inaktiva bilder:", err);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAvatars();
  }, [supabase, mode]);

  const handleResetAvatar = async (user: any) => {
    if (!confirm(`Vill du verkligen ta bort profilbilden för ${user.username}?`)) return;
    const res = await adminResetAvatar(user.id);
    if (res?.error) return alert('Fel: ' + res.error);
    await logAdminAction(supabase, currentUser.id, `Raderade profilbild för ${user.username} (via Galleri)`);
    fetchAvatars();
  };

  const handleDeleteInactive = async (fileName: string) => {
    if (!confirm('Vill du radera denna inaktiva bild permanent?')) return;
    const { error } = await supabase.storage.from('avatars').remove([fileName]);
    if (error) return alert('Kunde inte radera: ' + error.message);
    await logAdminAction(supabase, currentUser.id, `Raderade inaktiv profilbild: ${fileName}`);
    fetchAvatars();
  };

  const handleDeleteAllInactive = async () => {
    if (inactiveImages.length === 0) return;
    if (!confirm(`VARNING: Du är på väg att radera ALLA ${inactiveImages.length} inaktiva bilder permanent. Vill du fortsätta?`)) return;
    
    setDeletingAll(true);
    const { error } = await supabase.storage.from('avatars').remove(inactiveImages);
    setDeletingAll(false);
    
    if (error) return alert('Ett fel uppstod: ' + error.message);
    
    await logAdminAction(supabase, currentUser.id, `Rensade ALLA (${inactiveImages.length} st) inaktiva profilbilder från systemet.`);
    alert(`Städningen klar! ${inactiveImages.length} bilder raderade.`);
    fetchAvatars();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Bilder</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Här kan du rensa både aktiva och herrelösa profilbilder som tar plats.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-card)', padding: '0.4rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setMode('active')} 
            style={{ 
              padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer',
              backgroundColor: mode === 'active' ? 'var(--theme-primary)' : 'transparent',
              color: mode === 'active' ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            Aktiva Profilbilder
          </button>
          <button 
            onClick={() => setMode('inactive')} 
            style={{ 
              padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer',
              backgroundColor: mode === 'inactive' ? '#f59e0b' : 'transparent',
              color: mode === 'inactive' ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            Inaktiva Bilder {inactiveImages.length > 0 && <span style={{ marginLeft: '0.5rem', backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>{inactiveImages.length}</span>}
          </button>
        </div>
      </div>

      {mode === 'inactive' && inactiveImages.length > 0 && (
        <div className="admin-card" style={{ marginBottom: '2rem', border: '2px dashed #f59e0b', backgroundColor: '#fffbeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#92400e', fontWeight: '800' }}>Hittade {inactiveImages.length} herrelösa bilder</h3>
            <p style={{ margin: '0.25rem 0 0 0', color: '#b45309', fontSize: '0.875rem' }}>Dessa bilder tillhör ingen aktiv användare och tar bara upp utrymme.</p>
          </div>
          <button 
            onClick={handleDeleteAllInactive}
            disabled={deletingAll}
            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 6px rgba(239,68,68,0.2)' }}
          >
            {deletingAll ? 'RENSAR...' : 'RENSA ALLA INAKTIVA'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="skeleton-pulse" style={{ width: '100px', height: '100px', margin: '0 auto', borderRadius: '50%' }}></div><p style={{ marginTop: '1rem' }}>Laddar galleri...</p></div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {mode === 'active' ? (
            <>
              {usersWithAvatars.length === 0 && <p>Inga aktiva profilbilder hittades.</p>}
              {usersWithAvatars.map(u => {
                const cleanedImgUrl = cleanUrl(u.avatar_url);
                if (!cleanedImgUrl || cleanedImgUrl.length < 5) return null; // Skydd mot trasiga/för korta URL:er

                return (
                  <div key={u.id} className="admin-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '140px', height: '140px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f1f5f9', border: '1px solid var(--border-color)' }}>
                        <img src={cleanedImgUrl} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>{u.username}</p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.city || 'Ingen ort'}</p>
                    </div>
                    <button 
                        onClick={() => handleResetAvatar(u)}
                        style={{ width: '100%', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                        <Trash2 size={14} /> Radera
                    </button>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {inactiveImages.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                  <CheckCircle size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ margin: 0 }}>Systemet är rent!</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Inga inaktiva eller herrelösa bilder hittades.</p>
                </div>
              )}
              {inactiveImages.map(img => (
                <div key={img} className="admin-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                  <div style={{ width: '140px', height: '140px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f1f5f9', border: '1px solid var(--border-color)' }}>
                      <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${img}`} alt="Inactive" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ textAlign: 'center', width: '100%' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img}</p>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#f59e0b', fontWeight: 'bold' }}>HERRELÖS</p>
                  </div>
                  <button 
                      onClick={() => handleDeleteInactive(img)}
                      style={{ width: '100%', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  >
                      <Trash2 size={14} /> Radera
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
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

    const channel = supabase.channel('admin_reports_realtime_' + currentUser?.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, fetchReports)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  async function fetchReports() {
    const { data, error } = await supabase.from('reports')
      .select('*, reporter:reporter_id(username), reported:reported_user_id(username)')
      .order('created_at', { ascending: false });

    if (error) console.error("Error fetching reports:", error);
    if (data) {
      // --- JÄVSFILTER (ADMIN-SKYDD) ---
      // Administratörer ska inte se anmälningar mot sig själva.
      // Endast apersson508 eller den med perm_roles kan se allt.
      const isRoot = currentUser.auth_email === 'apersson508@gmail.com' || 
                     currentUser.username === 'apersson508' || 
                     currentUser.perm_roles === true;
                     
      const filteredData = data.filter((r: any) =>
        r.reported_user_id !== currentUser.id || isRoot
      );

      const enriched = await Promise.all(filteredData.map(async (r: any) => {
        let contentStr = '';
        let contentLink = '';
        let isForumStarter = false;

        if (r.item_type === 'whiteboard') {
          const { data: pList } = await supabase.from('whiteboard').select('content').eq('id', r.item_id).limit(1);
          const p = pList && pList.length > 0 ? pList[0] : null;
          if (p) { contentStr = p.content; contentLink = '/whiteboard'; }
        } else if (r.item_type === 'whiteboard_comment') {
          const { data: cList } = await supabase.from('whiteboard_comments').select('content').eq('id', r.item_id).limit(1);
          const c = cList && cList.length > 0 ? cList[0] : null;
          if (c) { contentStr = c.content; contentLink = '/whiteboard'; }
        } else if (r.item_type === 'guestbook') {
          const { data: gList } = await supabase.from('guestbook').select('content').eq('id', r.item_id).limit(1);
          const g = gList && gList.length > 0 ? gList[0] : null;
          if (g) { contentStr = g.content; contentLink = `/krypin?u=${r.reported?.username || ''}`; }
        } else if (r.item_type === 'forum_post') {
          const { data: fList } = await supabase.from('forum_posts').select('content, thread_id, forum_threads(title)').eq('id', r.item_id).limit(1);
          const f = fList && fList.length > 0 ? fList[0] : null;
          if (f) { 
            contentStr = f.content; 
            contentLink = `/forum/${f.thread_id}`;
            // @ts-ignore
            isForumStarter = f.content?.trim().toLowerCase() === f.forum_threads?.title?.trim().toLowerCase();
          }
        } else if (r.item_type === 'profile') {
          contentStr = `Anmälan av profil: ${r.reported?.username || 'Okänd'}`;
          contentLink = `/krypin?u=${r.reported?.username || ''}`;
        } else if (r.item_type === 'private_message') {
          contentStr = "[Privat Meddelande]";
          contentLink = "#"; 
        } else if (r.item_type === 'chat_message') {
          const { data: chatList } = await supabase.from('chat_messages').select('content, room_id, chat_rooms(name)').eq('id', r.item_id).limit(1);
          const msg = chatList && chatList.length > 0 ? chatList[0] : null;
          if (msg) {
            contentStr = msg.content;
            contentLink = `/chattrum?room=${msg.chat_rooms?.name || ''}`;
          }
        }

        return { ...r, reported_content: contentStr, reported_link: contentLink, is_forum_starter: isForumStarter };
      }));
      setReports(enriched);
    }
  }

  const handleDeleteItem = async (report: any) => {
    if (confirm('Ska inlägget raderas globalt?')) {
      let table = '';
      if (report.item_type === 'whiteboard') table = 'whiteboard';
      if (report.item_type === 'guestbook') table = 'guestbook';
      if (report.item_type === 'forum_post') table = 'forum_posts';
      if (report.item_type === 'whiteboard_comment') table = 'whiteboard_comments';

      if (table) {
        const res = await adminDeleteContent(table, report.item_id);
        if (res?.error) return alert('Kunde inte radera: ' + res.error);
      } else if (report.item_type === 'private_message') {
        const { error } = await supabase.from('private_messages').delete().eq('id', report.item_id);
        if (error) return alert('Kunde inte radera DM: ' + error.message);
      } else if (report.item_type === 'chat_message') {
        const { error } = await supabase.from('chat_messages').delete().eq('id', report.item_id);
        if (error) return alert('Kunde inte radera chattmeddelande: ' + error.message);
      }
      await adminResolveReport(report.id, 'resolved');
      await logAdminAction(supabase, currentUser.id, `Hanterade en anmälan och raderade ${table}-inlägg.`);
      fetchReports();
    }
  };

  const handleDeleteForumThread = async (postId: string, reportId: string) => {
    if (confirm('Är du säker på att du vill radera HELA tråden? Alla kommentarer kommer också att försvinna.')) {
      try {
        // 1. Hämta tråd-ID från posten
        const { data: post, error: fetchErr } = await supabase.from('forum_posts').select('thread_id').eq('id', postId).single();
        if (fetchErr || !post?.thread_id) {
          return alert('Kunde inte hitta tråden för detta inlägg.');
        }

        // 2. Radera hela tråden (cascadar till posts i DB)
        const res = await adminDeleteContent('forum_threads', post.thread_id);
        if (res?.error) return alert('Kunde inte radera tråd: ' + res.error);

        // 3. Markera rapporten som löst
        await adminResolveReport(reportId, 'resolved');
        await logAdminAction(supabase, currentUser.id, `Hanterade en anmälan och raderade en hel forumtråd (Tråd-ID: ${post.thread_id}).`);
        fetchReports();
      } catch (err: any) {
        alert('Ett oväntat fel uppstod: ' + err.message);
      }
    }
  };

  const handleBanUser = async (report: any) => {
    if (confirm(`Ska användare ${report.reported?.username || 'Okänd'} bannas globalt från sajten?`)) {
      const res = await toggleBlockUser(report.reported_user_id, true);
      if (res?.error) return alert('Behörighet saknas: ' + res.error);
      await adminResolveReport(report.id, 'resolved');
      await logAdminAction(supabase, currentUser.id, `Bannade användare ${report.reported?.username} pga en anmälan.`);
      fetchReports();
    }
  };

  const handleDismiss = async (id: string) => {
    await adminResolveReport(id, 'dismissed');
    await logAdminAction(supabase, currentUser.id, `Avvisade anmälan (ID: ${id}) utan åtgärd.`);
    fetchReports();
  }

  const handleDeleteReportEntry = async (id: string) => {
    if (!confirm('Vill du ta bort detta ärende helt från listan?')) return;
    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) return alert("Kunde inte radera ärende: " + error.message);
    await logAdminAction(supabase, currentUser.id, `Raderade ett avslutat anmälnings-ärende (ID: ${id})`);
    fetchReports();
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Granska alla anmälningar <span style={{ fontSize: '1rem', backgroundColor: '#ef4444', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', verticalAlign: 'middle' }}>{reports.filter(r => r.status === 'open').length}</span></h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Här visas anmälningar från hela sajten: Whiteboard, Gästböcker, Forum, Krypin och Profiler.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {reports.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga anmälningar hittades. Bra jobbat!</p>}
        {reports.map((report: any) => (
          <div key={report.id} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: `4px solid ${report.status === 'open' ? '#ef4444' : '#10b981'}`, padding: '1rem', opacity: report.status !== 'open' ? 0.6 : 1 }}>
            <div className="admin-card-content" style={{ flex: 1, minWidth: '300px' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: report.item_type === 'profile' ? '#3b82f6' : '#b91c1c', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                {report.item_type === 'profile' ? '👤 Person-Anmälan' : (
                   report.item_type === 'forum_post' 
                   ? `🏛️ Forum ${report.is_forum_starter ? 'TRÅD' : 'KOMMENTAR'}` 
                   : report.item_type === 'private_message'
                   ? '📧 Privat Meddelande (DM)'
                   : report.item_type === 'chat_message'
                   ? '🗨️ Chatt Meddelande'
                   : report.item_type === 'whiteboard'
                   ? '📝 Whiteboard Inlägg'
                   : report.item_type === 'whiteboard_comment'
                   ? '💬 Whiteboard Kommentar'
                   : report.item_type === 'guestbook'
                   ? '📖 Gästbok Inlägg'
                   : `📝 Inläggs-Anmälan (${report.item_type})`
                )}
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>{report.reporter?.username} anmäler {report.reported?.username}</p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}><strong>Orsak/Kategori:</strong> {report.reason}</p>

              {report.reported_content && (
                <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid #f59e0b', margin: '0.5rem 0', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-main)' }}>
                  "{report.reported_content}"
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(report.created_at).toLocaleString('sv-SE')}</p>
                {report.reported_link && (
                  <button onClick={() => window.open(report.reported_link, '_blank')} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}>
                    <Search size={14} /> {report.item_type === 'profile' ? 'Visa Profil' : 'Granska inlägget'}
                  </button>
                )}
              </div>
            </div>

            {report.status === 'open' ? (
              <div className="admin-card-actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 auto' }}>
                {report.item_type === 'forum_post' ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto' }}>
                    {report.is_forum_starter ? (
                      <button onClick={() => handleDeleteForumThread(report.item_id, report.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
                        <Trash2 size={16} /> Radera hela Tråden
                      </button>
                    ) : (
                      <button onClick={() => handleDeleteItem(report)} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
                        <Trash2 size={16} /> Radera kommentar
                      </button>
                    )}
                  </div>
                ) : (
                  <button onClick={() => handleDeleteItem(report)} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', justifyContent: 'center' }}>
                    <Trash2 size={16} /> Radera {report.item_type === 'whiteboard_comment' ? 'Kommentar' : 'Inlägg'}
                  </button>
                )}
                <button onClick={() => handleBanUser(report)} style={{ backgroundColor: '#fcf8e3', color: '#8a6d3b', border: '1px solid #faebcc', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', justifyContent: 'center' }}>
                  <Ban size={14} /> Banna {report.reported?.username}
                </button>
                <button onClick={() => handleDismiss(report.id)} style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Avvisa
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981' }}>Hanterad</span>
                <button onClick={() => handleDeleteReportEntry(report.id)} style={{ backgroundColor: '#f9fafb', color: '#ef4444', border: '1px solid #e5e7eb', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Radera Ärende</button>
              </div>
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
const AdminContent = ({ supabase, currentUser, perms }: { supabase: any, currentUser: any, perms: { content: boolean, chat: boolean } }) => {
  const { mask } = useWordFilter();
  const [posts, setPosts] = useState<any[]>([]);
  const [guestbook, setGuestbook] = useState<any[]>([]);
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [snakeScores, setSnakeScores] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Sätt start-vyn till första tillgängliga behörighet
  const [view, setView] = useState(perms.content ? 'whiteboard' : 'chat');
  const [selectedArcadeGame, setSelectedArcadeGame] = useState('all');

  useEffect(() => {
    if (view === 'snake') {
      fetchSnakeScores();
    }
  }, [selectedArcadeGame, view]); // Added view to dependencies for clarity

  useEffect(() => {
    const reloadData = () => {
      if (view === 'whiteboard') fetchPosts();
      else if (view === 'guestbook') fetchGuestbook();
      else if (view === 'forum') fetchForumPosts();
      else if (view === 'snake') fetchSnakeScores();
      else if (view === 'chat') fetchChatMessages();
    };

    reloadData();

    const tableMap: Record<string, string> = {
      'whiteboard': 'whiteboard',
      'guestbook': 'guestbook',
      'forum': 'forum_posts',
      'snake': 'snake_scores',
      'chat': 'chat_messages'
    };

    let tablesToWatch = [tableMap[view]];
    if (view === 'whiteboard') tablesToWatch.push('whiteboard_comments');

    const channels = tablesToWatch.map(t =>
      supabase.channel(`admin_content_${t}_${currentUser?.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, reloadData)
        .subscribe()
    );

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [view, supabase, currentUser?.id]);

  async function fetchChatMessages() {
    const { data } = await supabase.from('chat_messages').select('*, profiles(username), chat_rooms(name)').order('created_at', { ascending: false }).limit(100);
    if (data) setChatMessages(data);
  }

  async function fetchSnakeScores() {
    let query = supabase.from('snake_scores').select('*, profiles(username)').order('score', { ascending: false }).limit(50);
    if (selectedArcadeGame !== 'all') {
      query = query.eq('game_id', selectedArcadeGame);
    }
    const { data } = await query;
    if (data) setSnakeScores(data);
  }

  async function fetchForumPosts() {
    const { data } = await supabase.from('forum_posts')
      .select('*, profiles(username), forum_threads(id, title)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      // Försök identifiera starters genom att jämföra content med title (trimmat) 
      // eller om is_forum_starter flaggan finns (fallback)
      const enriched = data.map((p: any) => ({
        ...p,
        is_starter: p.is_forum_starter !== undefined ? p.is_forum_starter : (p.content?.trim().toLowerCase() === p.forum_threads?.title?.trim().toLowerCase())
      }));
      setForumPosts(enriched);
    }
  }

  async function fetchPosts() {
    const { data: mainPosts } = await supabase.from('whiteboard').select('*, profiles!whiteboard_author_id_fkey(username)').order('created_at', { ascending: false }).limit(20);
    const { data: comments } = await supabase.from('whiteboard_comments').select('*, profiles(username)').order('created_at', { ascending: false }).limit(20);

    const mixed = [
      ...(mainPosts || []).map((p: any) => ({ ...p, is_comment: false })),
      ...(comments || []).map((c: any) => ({ ...c, is_comment: true }))
    ];
    mixed.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPosts(mixed.slice(0, 30));
  }

  async function fetchGuestbook() {
    const { data } = await supabase.from('guestbook').select('*, sender:profiles!guestbook_sender_id_fkey(username), receiver:profiles!guestbook_receiver_id_fkey(username)').order('created_at', { ascending: false }).limit(30);
    if (data) setGuestbook(data);
  }

  const handleDeleteForumThread = async (threadId: string, threadTitle: string) => {
    if (confirm(`Ska HELA TRÅDEN "${threadTitle}" raderas? Det tar bort alla kommentarer inuti den.`)) {
      const { error } = await supabase.from('forum_threads').delete().eq('id', threadId);
      if (error) return alert('Fel vid radering av tråd: ' + error.message);
      await logAdminAction(supabase, currentUser.id, `Raderade hela forumtråden "${threadTitle}"`);
      fetchForumPosts();
    }
  };

  const handleDelete = async (table: string, id: string, threadTitle?: string) => {
    if (confirm('Ska inlägget raderas globalt?')) {
      const res = await adminDeleteContent(table, id);
      if (res?.error) return alert('Behörighet saknas eller fel: ' + res.error);
      const tableName = table === 'whiteboard' ? 'Whiteboard' : (table === 'guestbook' ? 'Gästboken' : (table === 'chat_messages' ? 'Chatten' : 'forum'));
      
      let actionMsg = `Raderade ett inlägg i ${tableName}`;
      if (table === 'forum_posts' && threadTitle) {
        actionMsg = `raderade ett inlägg i forum för tråd: ${threadTitle}`;
      }
      
      await logAdminAction(supabase, currentUser.id, actionMsg);
      if (table === 'whiteboard') fetchPosts();
      else if (table === 'guestbook') fetchGuestbook();
      else if (table === 'chat_messages') fetchChatMessages();
      else fetchForumPosts();
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Innehåll & Moderering</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Denna vy låter dig hantera raderingar av poster från plattformen.</p>

      {/* Skrivbord - Knappar som radbryts snyggt */}
      <div className="hide-on-mobile" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {perms.content && (
          <>
            <button onClick={() => setView('whiteboard')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'whiteboard' ? 'var(--theme-whiteboard)' : 'var(--bg-card)', color: view === 'whiteboard' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Whiteboard</button>
            <button onClick={() => setView('guestbook')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'guestbook' ? 'var(--theme-krypin)' : 'var(--bg-card)', color: view === 'guestbook' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Gästböcker</button>
            <button onClick={() => setView('forum')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'forum' ? 'var(--theme-forum)' : 'var(--bg-card)', color: view === 'forum' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Forum</button>
            <button onClick={() => setView('snake')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'snake' ? '#10b981' : 'var(--bg-card)', color: view === 'snake' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Arkad-Scores</button>
          </>
        )}
        {perms.chat && (
          <button onClick={() => setView('chat')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'chat' ? '#3b82f6' : 'var(--bg-card)', color: view === 'chat' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Chatten</button>
        )}
      </div>

      {/* Mobil - Dropdown */}
      <div className="hide-on-desktop" style={{ marginBottom: '1.5rem', width: '100%' }}>
        <select
          value={view}
          onChange={(e) => setView(e.target.value)}
          className="admin-input"
          style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}
        >
          {perms.content && (
            <>
              <option value="whiteboard">Whiteboard</option>
              <option value="guestbook">Gästbok</option>
              <option value="forum">Forum</option>
              <option value="snake">Arkad-Scores</option>
            </>
          )}
          {perms.chat && <option value="chat">Chatten</option>}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {view === 'whiteboard' && posts.map(post => (
          <div key={`${post.is_comment ? 'c' : 'p'}-${post.id}`} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid var(--theme-whiteboard)', padding: '1rem' }}>
            <div className="admin-card-content">
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {post.profiles?.username || 'Okänd'} {post.is_comment ? '(Kommentar)' : '(Huvudinlägg)'} • {new Date(post.created_at).toLocaleString('sv-SE')}
              </p>
              <p style={{ margin: 0, color: 'var(--text-main)', paddingRight: '1rem' }}>{mask(post.content)}</p>
            </div>
            <div className="admin-card-actions">
              <button onClick={() => handleDelete(post.is_comment ? 'whiteboard_comments' : 'whiteboard', post.id)} style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.75rem' }} title={`Radera ${post.is_comment ? 'kommentar' : 'inlägg'}`}>
                <Trash2 size={16} /> Radera {post.is_comment ? 'Kommentar' : 'Inlägg'}
              </button>
            </div>
          </div>
        ))}
        {view === 'guestbook' && guestbook.map(post => (
          <div key={post.id} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid var(--theme-krypin)', padding: '1rem' }}>
            <div className="admin-card-content">
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{post.sender?.username || 'Okänd'} ➔ {post.receiver?.username || 'Okänd'} • {new Date(post.created_at).toLocaleString('sv-SE')}</p>
              <p style={{ margin: 0, color: 'var(--text-main)', paddingRight: '1rem' }}>{mask(post.content)}</p>
            </div>
            <div className="admin-card-actions">
              <button onClick={() => handleDelete('guestbook', post.id)} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} title="Radera inlägg">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {view === 'forum' && forumPosts.map(post => {
          const isStarter = post.is_starter;
          return (
            <div key={post.id} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: `4px solid ${isStarter ? 'var(--theme-forum)' : '#94a3b8'}`, padding: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="admin-card-content" style={{ flex: 1, minWidth: '200px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: isStarter ? 'var(--theme-forum)' : 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  {isStarter ? '📂 [TRÅDSTART]' : '💬 [KOMMENTAR]'} • {post.profiles?.username || 'Okänd'} i "{post.forum_threads?.title || 'Raderad Tråd'}" • {new Date(post.created_at).toLocaleString('sv-SE')}
                </p>
                <p style={{ margin: 0, color: 'var(--text-main)', fontStyle: isStarter ? 'italic' : 'normal', fontSize: '0.9rem' }}>{mask(post.content)}</p>
              </div>
              <div className="admin-card-actions" style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {isStarter ? (
                  <button 
                    onClick={() => handleDeleteForumThread(post.forum_threads?.id, post.forum_threads?.title)} 
                    style={{ color: 'white', backgroundColor: '#ef4444', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(239,68,68,0.3)' }}
                  >
                    <Trash2 size={16} /> Radera hela Tråden
                  </button>
                ) : (
                  <button 
                    onClick={() => handleDelete('forum_posts', post.id, post.forum_threads?.title)} 
                    style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}
                  >
                    <Trash2 size={16} /> Radera kommentar
                  </button>
                )}
                <button 
                  onClick={() => window.open(`/forum/${post.thread_id}`, '_blank')}
                  style={{ color: 'var(--text-main)', backgroundColor: 'var(--bg-color)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}
                >
                  <Search size={14} /> Visa
                </button>
              </div>
            </div>
          );
        })}
        {view === 'chat' && chatMessages.map(msg => (
          <div key={msg.id} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid #3b82f6', padding: '1rem' }}>
            <div className="admin-card-content">
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{msg.profiles?.username || 'Okänd'} i rummet "{msg.chat_rooms?.name || 'Okänt'}" • {new Date(msg.created_at).toLocaleString('sv-SE')}</p>
              <p style={{ margin: 0, paddingRight: '1rem', fontStyle: msg.is_gif ? 'italic' : 'normal', color: msg.is_gif ? '#8b5cf6' : 'var(--text-main)' }}>{msg.is_gif ? '[GIF/BILD Skickad]' : mask(msg.content)}</p>
            </div>
            <div className="admin-card-actions">
              <button onClick={() => handleDelete('chat_messages', msg.id)} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} title="Radera chattmeddelande">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {view === 'snake' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Dropdown för Arcade */}
            <div className="admin-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Filtrera topplista på specifikt spel:</label>
              <select
                value={selectedArcadeGame}
                onChange={(e) => setSelectedArcadeGame(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}
              >
                <option value="all">Alla Spel (Blandat)</option>
                <option value="snake">Retro Snake</option>
                <option value="racing">Retro Racing</option>
                <option value="breakout">Retro Breakout</option>
                <option value="invaders">Astro Invaders</option>
                <option value="tetris">Retro Tetris</option>
              </select>
            </div>

            <div className="admin-card" style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
              <h3 style={{ color: '#ef4444', margin: 0 }}>🚨 FARA: Nollställ {selectedArcadeGame === 'all' ? 'Alla Arkad-Topplistor' : `Topplistan för ${selectedArcadeGame.toUpperCase()}`}</h3>
              <p style={{ color: '#991b1b', margin: 0, fontSize: '0.875rem' }}>Denna knapp raderar ALLA historiska poäng för {selectedArcadeGame === 'all' ? 'SAMTLIGA ARKADSPEL' : selectedArcadeGame.toUpperCase()} från databasen globalt för alla användare. Kan inte ångras!</p>
              <button
                onClick={async () => {
                  const confirmMsg = selectedArcadeGame === 'all'
                    ? 'ÄR DU HELT SÄKER? Detta kommer radera HELA topplistan permanent för ALLA spel!'
                    : `ÄR DU SÄKER? Detta nollställer topplistan för ${selectedArcadeGame.toUpperCase()}!`;
                  if (confirm(confirmMsg)) {
                    const res = await adminDeleteSnakeScore(null, true, selectedArcadeGame);
                    if (res?.error) alert('Det gick fel: ' + res.error);
                    else {
                      alert(`Arkadens topplistor raderades (${selectedArcadeGame})!`);
                      await logAdminAction(supabase, currentUser.id, `Nollställde Facechat Arcade Leaderboarden (${selectedArcadeGame})!`);
                      fetchSnakeScores();
                    }
                  }
                }}
                style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: '800', border: 'none', padding: '1rem 2rem', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(239, 68, 68, 0.4)' }}
              >
                🗑️ NOLLSTÄLL {selectedArcadeGame === 'all' ? 'ALLA REKORD' : selectedArcadeGame.toUpperCase()} NU
              </button>
            </div>

            {snakeScores.map((score, index) => (
              <div key={score.id} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: index === 0 ? '4px solid #fbbf24' : '4px solid #10b981', padding: '1rem' }}>
                <div className="admin-card-content">
                  <h4 style={{ margin: 0, color: 'var(--text-main)' }}>#{index + 1} - {score.profiles?.username || 'Okänd'} <span style={{ color: '#2563eb', fontSize: '0.8rem' }}>({String(score.game_id || 'snake').toUpperCase()})</span></h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Spelades: {new Date(score.created_at).toLocaleString('sv-SE')}</p>
                </div>
                <div className="admin-card-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>{score.score}</span>
                  <button onClick={async () => {
                    if (confirm('Radera just detta rekord?')) {
                      const res = await adminDeleteSnakeScore(score.id, false);
                      if (res?.error) return alert('Kunde inte radera: ' + res.error);
                      await logAdminAction(supabase, currentUser.id, `Raderade ett fusk-rekord (${score.score} poäng) av ${score.profiles?.username || 'Okänd'}`);
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

const SecretRoomMembers = ({ room, supabase, currentUser, onRefresh }: any) => {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (room.allowed_users && room.allowed_users.length > 0) {
      supabase.from('profiles').select('id, username').in('id', room.allowed_users).then(({ data }: any) => {
        if (data) setMembers(data);
      });
    } else {
      setMembers([]);
    }
  }, [room.allowed_users, supabase]);

  const handleSearch = async (val: string) => {
    setSearch(val);
    if (val.length < 2) return setResults([]);
    const { data } = await supabase.from('profiles').select('id, username').ilike('username', `%${val}%`).limit(5);
    if (data) setResults(data.filter((u: any) => !(room.allowed_users || []).includes(u.id)));
  };

  const handleAdd = async (userId: string, username: string) => {
    const res = await adminAddSecretUserToRoom(room.id, userId);
    if (res.error) return alert("Fel: " + res.error);
    await logAdminAction(supabase, currentUser.id, `Lade till  i hemligt rum "${room.name}"`);
    setSearch('');
    setResults([]);
    onRefresh();
  };

  const handleRemove = async (userId: string, username: string) => {
    if (!confirm(`Ta bort  från ${room.name}?`)) return;
    const res = await adminRemoveSecretUserFromRoom(room.id, userId);
    if (res.error) return alert("Fel: " + res.error);
    await logAdminAction(supabase, currentUser.id, `Tog bort  från hemligt rum "${room.name}"`);
    onRefresh();
  };

  return (
    <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #94a3b8' }}>
      <h5 style={{ margin: '0 0 0.5rem 0', color: '#334155', fontSize: '0.875rem' }}>Bjud in till Hemligt Rum</h5>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input type="text" placeholder="Sök användarnamn..." value={search} onChange={e => handleSearch(e.target.value)} className="admin-input" style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }} />
      </div>
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', maxHeight: '150px', overflowY: 'auto' }}>
          {results.map(su => (
            <div key={su.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'black' }}>{su.username}</span>
              <button onClick={() => handleAdd(su.id, su.username)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Lägg till</button>
            </div>
          ))}
        </div>
      )}
      <h6 style={{ margin: '0 0 0.5rem 0', color: '#64748b' }}>Tillagda Medlemmar ({members.length})</h6>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {members.map(m => (
          <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', backgroundColor: '#e2e8f0', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold', color: '#334155' }}>
            {m.username}
            <button onClick={() => handleRemove(m.id, m.username)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}><Trash2 size={12} /></button>
          </span>
        ))}
        {members.length === 0 && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Inga medlemmar ännu.</span>}
      </div>
    </div>
  );
};

const AdminRooms = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [activeSecretRoomId, setActiveSecretRoomId] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();

    const channel = supabase.channel('admin_rooms_realtime_' + currentUser?.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, fetchRooms)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser?.id]);

  async function fetchRooms() {
    const { data } = await supabase.from('chat_rooms').select('*').order('created_at', { ascending: true });
    if (data) setRooms(data);
  }

  const handleAddRoomEvent = async (e: React.FormEvent | React.MouseEvent, isSecret: boolean = false) => {
    e.preventDefault();
    if (!newRoomName) return;
    const { data: { user } } = await supabase.auth.getUser();
    const res = await adminRoomAction('insert', null, { name: newRoomName, created_by: user.id, is_secret: isSecret, allowed_users: [] });
    if (res?.error) return alert('Fel: ' + res.error);
    await logAdminAction(supabase, currentUser.id, `Skapade ${isSecret ? 'hemliga ' : ''}chattrummet "${newRoomName}"`);
    setNewRoomName('');
    fetchRooms();
  };

  const handleDeleteRoom = async (id: string, name: string) => {
    if (confirm(`Är du säker på att du vill radera chattrummet "${name}"? Det kommer kasta ut alla som är där inne.`)) {
      const res = await adminRoomAction('delete', id, null);
      if (res?.error) return alert('Fel: ' + res.error);
      await logAdminAction(supabase, currentUser.id, `Raderade chattrummet "${name}"`);
      fetchRooms();
    }
  };

  const handleSetPassword = async (id: string) => {
    const rm = rooms.find(r => r.id === id);
    const pw = prompt(`Ange ett nytt lösenord för rummet ${rm?.name} (lämna tomt för att ta bort lösenordskravet):`);
    if (pw !== null) {
      const res = await adminRoomAction('update', id, { password: pw === '' ? null : pw });
      if (res?.error) return alert('Fel: ' + res.error);
      await logAdminAction(supabase, currentUser.id, `Satte ett lösenord på chattrummet "${rm?.name}"`);
      fetchRooms();
    }
  };

  const handleRemovePassword = async (id: string, name: string) => {
    if (confirm(`Säker på att du vill ta bort lösenordet för "${name}"?`)) {
      const res = await adminRoomAction('update', id, { password: null });
      if (res?.error) return alert('Fel: ' + res.error);
      await logAdminAction(supabase, currentUser.id, `Tog bort lösenordet på chattrum (${name})`);
      fetchRooms();
    }
  };

  const handleRename = async (id: string, currentName: string) => {
    const fresh = prompt('Skriv nytt namn för rummet:', currentName);
    if (fresh && fresh.trim() !== currentName) {
      const res = await adminRoomAction('update', id, { name: fresh.trim() });
      if (res?.error) return alert('Fel: ' + res.error);
      await logAdminAction(supabase, currentUser.id, `Döpte om rum "${currentName}" till "${fresh}"`);
      fetchRooms();
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Hantera Chattrum</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Skapa, redigera och ta bort de centrala chattrummen på sajten.</p>

      <form onSubmit={(e) => handleAddRoomEvent(e, false)} className="admin-card" style={{ marginBottom: '2rem', backgroundColor: '#f0fdfa', border: '1px solid #99f6e4' }}>
        <h3 style={{ fontSize: '1rem', color: '#0f766e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Plus size={18} /> Lägg till nytt Chattrum (Öppet eller Hemligt)</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="T.ex Nattugglan..." className="admin-input" style={{ flex: '1 1 100%', minWidth: '200px', backgroundColor: 'white' }} />
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto', flexWrap: 'wrap' }}>
            <button type="button" onClick={(e) => handleAddRoomEvent(e, false)} style={{ backgroundColor: '#0d9488', color: 'white', fontWeight: '600', padding: '0.75rem 2rem', border: 'none', cursor: 'pointer', borderRadius: '8px', flex: '1 1 auto', minWidth: '140px' }}>Skapa Rum</button>
            <button type="button" onClick={(e) => handleAddRoomEvent(e, true)} style={{ backgroundColor: '#312e81', color: 'white', fontWeight: '600', padding: '0.75rem 2rem', border: 'none', cursor: 'pointer', borderRadius: '8px', flex: '1 1 auto', minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><EyeOff size={18} /> Skapa Hemligt Rum</button>
          </div>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {rooms.map(r => (
          <div key={r.id} className="admin-card admin-responsive-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="admin-card-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {r.is_secret ? <span title="Hemligt Rum"><EyeOff size={16} color="#3b82f6" /></span> : r.password ? <Lock size={16} color="#ef4444" /> : null} {r.name}
                </h4>
              </div>
            </div>

            <div className="admin-card-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button onClick={() => handleRename(r.id, r.name)} style={{ flex: 1, backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Edit2 size={14} /> Byt Namn
              </button>
              {r.is_secret ? (
                <button onClick={() => setActiveSecretRoomId(activeSecretRoomId === r.id ? null : r.id)} style={{ flex: 1, backgroundColor: activeSecretRoomId === r.id ? '#e0e7ff' : '#f8fafc', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <UserPlus size={14} /> Hantera Medlemmar
                </button>
              ) : r.password ? (
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
            {r.is_secret && activeSecretRoomId === r.id && (
              <SecretRoomMembers room={r} supabase={supabase} currentUser={currentUser} onRefresh={fetchRooms} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================================
// 5. BEHÖRIGHETER & ADMINS (Sök upp → Gör till Admin)
// ==========================================================
// ==========================================================
const PermissionCard = ({ icon: Icon, title, desc, checked, onChange, disabled, danger }: any) => (
  <div
    onClick={() => {
      if (!disabled && onChange) onChange();
    }}
    style={{
      display: 'flex', alignItems: 'flex-start', gap: '1rem',
      padding: '1rem', borderRadius: '12px',
      border: checked ? `2px solid ${danger ? '#ef4444' : '#10b981'}` : '1px solid var(--border-color)',
      backgroundColor: checked ? (danger ? '#fef2f2' : '#f0fdf4') : 'var(--bg-card)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1, transition: 'all 0.2s',
      userSelect: 'none'
    }}
    className="permission-card-hover"
  >
    <div style={{ marginTop: '0.25rem', color: checked ? (danger ? '#ef4444' : '#10b981') : 'var(--text-muted)' }}>
      <Icon size={20} />
    </div>
    <div style={{ flex: 1 }}>
      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: checked ? (danger ? '#b91c1c' : '#065f46') : 'var(--text-main)' }}>{title}</h4>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: '1.4' }}>{desc}</p>
    </div>
    <div style={{ position: 'relative', width: '40px', height: '22px', backgroundColor: checked ? (danger ? '#ef4444' : '#10b981') : '#d1d5db', borderRadius: '11px', transition: 'background-color 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '3px', left: checked ? '21px' : '3px', width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </div>
  </div>
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

  // Sök-loggning & Auto-Sök (Debounced)
  useEffect(() => {
    if (search.trim().length > 0) {
      const timer = setTimeout(() => {
        searchUsers(search.trim());
        logAdminAction(supabase, currentUser.id, `Sökte i Behörigheter efter: "${search.trim()}"`);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [search, supabase, currentUser.id]);

  useEffect(() => {
    fetchAdmins();

    const channel = supabase.channel('admin_perms_realtime_' + currentUser?.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, fetchAdmins)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser?.id]);

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

  async function searchUsers(term: string) {
    if (!term) {
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    const { data } = await supabase.from('profiles')
      .select('id, username, is_admin')
      .ilike('username', `%${term}%`)
      .limit(10); // Leta fram till 10 träffar
    if (data) setSearchResults(data);
    setIsLoading(false);
  }

  const handleMakeAdmin = async (userId: string, username: string) => {
    const res = await adminUpdatePermissions(userId, { is_admin: true });
    if (res?.error) return alert('Fel: ' + res.error);
    await logAdminAction(supabase, currentUser.id, `Befordrade ${username} till Admin`);
    setSearch('');
    setSearchResults([]);
    fetchAdmins();
  };

  const handleRemoveAdmin = async (user: any) => {
    if (user.id === currentUser.id || user.username?.toLowerCase() === 'apersson508') return alert('Du kan inte ta bort din egen admin-status.');
    if (user.perm_roles && user.is_admin) return alert('Du kan inte ta bort ett Root-konto!');

    const res = await adminUpdatePermissions(user.id, {
      is_admin: false, perm_users: false, perm_content: false, perm_rooms: false,
      perm_roles: false, perm_support: false, perm_logs: false, perm_chat: false,
      perm_diagnostics: false, perm_stats: false
    });
    if (res?.error) return alert('Fel: ' + res.error);

    await logAdminAction(supabase, currentUser.id, `Tog bort Admin-status från ${user.username}`);
    fetchAdmins();
  }

  const handleTogglePermission = async (user: any, column: string, val: boolean) => {
    // Spara original för att kunna rulla tillbaka vid fel
    const prevState = { ...activeEditAdmin };

    // Uppdatera UI omedelbart för snabb känsla
    const updatedUser = { ...user, [column]: val };
    setActiveEditAdmin(updatedUser);

    // Skicka till servern
    const res = await adminUpdatePermissions(user.id, { [column]: val });

    if (res?.error) {
      alert('Kunde inte uppdatera behörighet: ' + res.error);
      setActiveEditAdmin(prevState); // Rulla tillbaka UI
      return;
    }

    await logAdminAction(supabase, currentUser.id, `Ändrade ${column} för ${user.username} till ${val}`);
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
          <button onClick={() => { searchUsers(search); logAdminAction(supabase, currentUser.id, `Sökte i Behörigheter efter: "${search}"`); }} disabled={isLoading} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: '1 1 auto' }}>
            {isLoading ? 'Söker...' : 'Sök Person'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div style={{ marginTop: '1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #bfdbfe', overflow: 'hidden' }}>
            {searchResults.map(user => (
              <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: '600' }}>{user.username} {user.is_admin ? '(Redan Admin)' : ''}</span>
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
                <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-main)' }}>{person.username} {isSelf ? '(Du)' : ''}</h3>
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
                  onClick={() => handleRemoveAdmin(person)}
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
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Behörigheter för {activeEditAdmin.username}</h2>

            {activeEditAdmin.id === currentUser.id || (activeEditAdmin.username?.toLowerCase() === 'apersson508') ? (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '1.5rem', borderRadius: '8px', color: '#b91c1c' }}>
                Detta konto är ett root-konto och behåller alltid alla underliggande befogenheter. Säkerhetsspärr är aktiv.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                <PermissionCard title="Dashboard & Statistik" desc="Åtkomst till statistiska data." icon={Activity} checked={!!activeEditAdmin.perm_stats} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_stats', !activeEditAdmin.perm_stats)} />
                <PermissionCard title="Användarhantering" desc="Logga in, blockera eller radera." icon={Users} checked={!!activeEditAdmin.perm_users} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_users', !activeEditAdmin.perm_users)} />
                <PermissionCard title="Innehåll & Moderering" desc="Ta bort logginlägg, klotter & forum." icon={Database} checked={!!activeEditAdmin.perm_content} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_content', !activeEditAdmin.perm_content)} />
                <PermissionCard title="Bild-Moderering" desc="Granska och radera profilbilder." icon={Shield} checked={!!activeEditAdmin.perm_images} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_images', !activeEditAdmin.perm_images)} />
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
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchTickets();

    const channel = supabase.channel('admin_support_realtime_' + currentUser?.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, fetchTickets)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser?.id]);

  async function fetchTickets() {
    // Hide tickets soft-deleted by admin!
    const { data } = await supabase.from('support_tickets').select('*, profiles(username)').eq('admin_deleted', false).order('created_at', { ascending: false });
    if (data) setTickets(data);
  }

  const markResolved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    await supabase.from('support_tickets').update({ status: 'closed', has_unread_admin: false }).eq('id', id);
    await logAdminAction(supabase, currentUser.id, `Stängde supportärende (${id})`);
    
    // NOTIFIERA ANVÄNDAREN!
    const msg = `Ditt supportärende #${id.split('-')[0]} har markerats som LÖST av en admin. 🎉`;
    await supabase.from('notifications').insert({
       receiver_id: ticket.user_id,
       actor_id: currentUser.id,
       type: 'admin_alert',
       content: msg,
       link: '/minasidor?tab=Support'
    });
    fetch('/api/send-push', {
       method: 'POST', body: JSON.stringify({
         userId: ticket.user_id,
         title: '✅ Supportärende Löst!',
         message: msg,
         url: '/minasidor?tab=Support'
       }), headers: { 'Content-Type': 'application/json' }
    }).catch(console.error);

    fetchTickets();
    if (activeTicketId === id) setActiveTicketId(null);
  };

  const handleDeleteTicket = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Är du säker på att du vill radera detta supportärende permanent?')) {
      const res = await adminDeleteSupportTicket(id);
      if (res?.error) return alert('Kunde inte radera: ' + res.error);
      await logAdminAction(supabase, currentUser.id, `Raderade ett supportärende (${id})`);
      fetchTickets();
      if (activeTicketId === id) setActiveTicketId(null);
    }
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

    // NOTIFIERA ANVÄNDAREN OM SVARET!
    const msg = `Du har fått ett nytt svar från Admin i ditt supportärende #${activeTicketId.split('-')[0]}.`;
    await supabase.from('notifications').insert({
       receiver_id: ticket.user_id,
       actor_id: currentUser.id,
       type: 'admin_alert',
       content: msg,
       link: '/minasidor?tab=Support'
    });
    fetch('/api/send-push', {
       method: 'POST', body: JSON.stringify({
         userId: ticket.user_id,
         title: '💬 Nytt svar från Support!',
         message: msg,
         url: '/minasidor?tab=Support'
       }), headers: { 'Content-Type': 'application/json' }
    }).catch(console.error);

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
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Ticket #{ticket.id.split('-')[0]} - {ticket.profiles?.username || 'Okänd'}</h3>
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
                          <p style={{ margin: 0, fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{m.text}</p>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', alignSelf: isAdminMsg ? 'flex-end' : 'flex-start' }}>
                          {isAdminMsg ? 'Du (Admin)' : (ticket.profiles?.username || 'Okänd')} • {new Date(m.time).toLocaleString('sv-SE')}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {ticket.status === 'open' ? (
                  <form onSubmit={handleReply} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', gap: '1rem' }}>
                    <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Skriv ditt adminsvar..." style={{ flex: 1, padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                    <button type="submit" style={{ backgroundColor: '#2563eb', color: 'white', fontWeight: '600', padding: '0 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Skicka Svar</button>
                    <button type="button" onClick={(e) => markResolved(ticket.id, e)} style={{ backgroundColor: '#10b981', color: 'white', fontWeight: '600', padding: '0 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={18} /> Lös</button>
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
                className="admin-card admin-responsive-card"
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
                <div className="admin-card-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 'bold', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{ticket.category}</span>
                      <span style={{ marginLeft: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Från: {ticket.profiles?.username || 'Okänd'}</span>
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{new Date(ticket.created_at).toLocaleString('sv-SE')}</span>
                  </div>
                  <p style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: '500', margin: '1rem 0 0.5rem 0' }}>"{ticket.description}"</p>
                </div>
                <div className="admin-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#3b82f6', fontWeight: 'bold' }}>{ticket.messages && ticket.messages.length > 0 ? `${ticket.messages.length} meddelanden` : 'Nytt ärende'} &rarr;</span>
                    {ticket.status === 'closed' && <span style={{ backgroundColor: '#10b981', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>LÖST ✅</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {ticket.status === 'open' && (
                      <button onClick={(e) => markResolved(ticket.id, e)} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                        <CheckCircle size={14} /> Markera Löst
                      </button>
                    )}
                    <button onClick={(e) => handleDeleteTicket(ticket.id, e)} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                      <Trash2 size={14} /> Radera
                    </button>
                  </div>
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

    const channel = supabase.channel('admin_logs_realtime_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_logs' }, fetchLogs)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Granskningslogg</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Övervakar varenda exakt handling alla admins utför på sajten.</p>

      <div className="admin-card" style={{ padding: '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
              <th style={{ padding: '1rem' }}>Admin</th>
              <th style={{ padding: '1rem' }}>Händelse</th>
              <th style={{ padding: '1rem', minWidth: '160px' }}>Tid</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem', fontWeight: '600', color: '#ef4444' }}>{log.profiles?.username || 'System'}</td>
                <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{log.action}</td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('sv-SE')}</td>
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
  const [running, setRunning] = useState(false);
  const [diagSearch, setDiagSearch] = useState('');
  const [diagSearchResults, setDiagSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const [massDeleteQuery, setMassDeleteQuery] = useState('');
  const [massDeleting, setMassDeleting] = useState(false);
  const [forbiddenWords, setForbiddenWords] = useState<any[]>([]);
  const [newForbiddenWord, setNewForbiddenWord] = useState('');
  const [orphanedFiles, setOrphanedFiles] = useState<string[]>([]);

  useEffect(() => {
    fetchForbiddenWords();
    fetchLatestScanResult();
  }, [supabase]);

  // Sök-loggning & Auto-Sök (Debounced)
  useEffect(() => {
    const term = diagSearch.trim();
    if (term.length >= 1) {
      const timer = setTimeout(async () => {
        // Logga sökningen (endast om det är en ny sökning)
        if (term.length >= 2) {
          logAdminAction(supabase, currentUser?.id, `Sökte efter användarprofil i Diagnosverktyget: "${term}"`);
        }
        
        // Utför sökningen
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, presentation, custom_style')
          .ilike('username', `%${term}%`)
          .limit(10);
          
        if (!error && data) {
          setDiagSearchResults(data);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setDiagSearchResults([]);
    }
  }, [diagSearch, supabase, currentUser?.id]);

  async function fetchForbiddenWords() {
    const { data } = await supabase.from('forbidden_words').select('*').order('word', { ascending: true });
    if (data) setForbiddenWords(data);
  }

  const handleAddWord = async () => {
    const wordToAdd = newForbiddenWord.trim().toLowerCase();
    if (!wordToAdd) return;

    // 1. Check impact first
    const searchTerm = `%${wordToAdd}%`;
    const [wb, wbc, fp, ft, gb, cm, pm] = await Promise.all([
      supabase.from('whiteboard').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('whiteboard_comments').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('forum_posts').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('forum_threads').select('id', { count: 'exact', head: true }).ilike('title', searchTerm),
      supabase.from('guestbook').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('private_messages').select('id', { count: 'exact', head: true }).ilike('content', searchTerm)
    ]);

    const totalLines = (wb.count || 0) + (wbc.count || 0) + (fp.count || 0) + (ft.count || 0) + (gb.count || 0) + (cm.count || 0) + (pm.count || 0);

    const { error } = await supabase.from('forbidden_words').insert({ word: wordToAdd });
    if (error) alert("Kunde inte lägga till ord: " + error.message);
    else {
      setNewForbiddenWord('');
      fetchForbiddenWords();
      alert(`✅ Ordet "${wordToAdd}" har lagts till i det globala filtret.\n\nDetta påverkar just nu ${totalLines} inlägg på sajten som omedelbart kommer att stjärnmarkeras.`);
      await logAdminAction(supabase, currentUser.id, `Lade till ord "${wordToAdd}" i det globala filtret (Påverkar ${totalLines} rader).`);
    }
  };

  const handleRemoveWord = async (id: string, word: string) => {
    if (confirm(`Vill du ta bort "${word}" från filtret?`)) {
      const res = await adminRemoveForbiddenWord(id);
      if (res?.error) return alert('Fel: ' + res.error);
      await logAdminAction(supabase, currentUser.id, `Tog bort förbjudet ord: "${word}"`);
      fetchForbiddenWords();
    }
  };

  const [results, setResults] = useState<{ id: string, title: string, status: 'idle' | 'running' | 'ok' | 'warning', message: string, fixAction?: () => void }[]>([
    { id: 'latency', title: 'Databasens Responstid (Ping)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'storage', title: 'Lagringsutrymme (Max 50 MB)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'orphaned_avatars', title: 'Oanvända Profilbilder (Rensning)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'sync', title: 'Databashälsa (Profiler vs Auth)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'links', title: 'Innehållshälsa (Döda länkar)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'images', title: 'Bild-optimering (400px Jpeg)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'notifications', title: 'Skräpdata (Gamla Notiser > 30d)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'reports', title: 'Ignorerade Anmälningar (> 7d)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'avatars', title: 'Profilbilder (Trasiga Länkar)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'friendships', title: 'Social Hälsa (Vänskap)', status: 'idle', message: 'Väntar på diagnos...' },
    { id: 'logs', title: 'Log-städning (> 15d)', status: 'idle', message: 'Väntar på diagnos...' },
  ]);

  const isExecutingRef = useRef(false);

  const runDiagnostics = async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    setRunning(true);
    
    // Initialisera resultat-vyn med explicit typning för att undvika TS-narrowing
    let currentResults: { id: string, title: string, status: 'idle' | 'running' | 'ok' | 'warning', message: string, fixAction?: () => void }[] = results.map(r => ({ ...r, status: 'running' as const, message: 'Skannar systemet...' }));
    setResults(currentResults);

    const updateOne = (id: string, update: any) => {
      currentResults = currentResults.map(r => r.id === id ? { ...r, ...update } : r);
      setResults([...currentResults]);
    };

    try {
      let fixesCount = 0;
      // 0. Latency (Ping)
      const startPing = Date.now();
      const { error: pingErr } = await supabase.from('profiles').select('id').limit(1);
      const pingTime = Date.now() - startPing;
      
      if (pingErr?.message?.includes('503')) {
        alert("⚠️ Databasen är överbelastad (503). Vänta 2-3 minuter.");
        throw new Error("DB_OVERLOAD");
      }

      // Latency-betyg (Rating)
      let pingRating = "✅ Svarar normalt";
      let pingIcon = "🆗";
      if (pingTime < 200) { pingRating = "⚡ Blixtsnabb"; pingIcon = "🚀"; }
      else if (pingTime < 500) { pingRating = "✅ Snabb"; pingIcon = "🚅"; }
      else if (pingTime < 1500) { pingRating = "🆗 Normal"; pingIcon = "🚗"; }
      else if (pingTime < 3000) { pingRating = "⚠️ Seg"; pingIcon = "🐢"; }
      else { pingRating = "🚨 Mycket seg (Databasen flisar!)"; pingIcon = "💥"; }

      updateOne('latency', { 
         status: pingErr ? 'warning' : (pingTime > 2000 ? 'warning' : 'ok'), 
         message: pingErr ? `Ping-fel: ${pingErr.message}` : `${pingIcon} ${pingRating} (${pingTime}ms).` 
      });

      // 1. Oanvända Bilder (Storage API + RPC)
      // Vi hämtar en lista på filnamnen och raderar dem via Storage-porten för att undvika 403-fel.
      const { data: orphans } = await supabase.rpc('get_orphan_avatars');
      if (orphans && orphans.length > 0) {
        fixesCount++;
        updateOne('orphaned_avatars', { status: 'warning', message: `Hittade ${orphans.length} bilder. Rensar via Storage...` });
        
        // Radera alla via Storage API (Detta är den "rätta" porten)
        // Vi mappar objekten från RPC:n till en lista med bara filnamn
        const orphanNames = orphans.map((o: any) => o.file_name);
        const { error: storageErr } = await supabase.storage.from('avatars').remove(orphanNames);
        
        if (!storageErr) {
          await logAdminAction(supabase, currentUser.id, `Vårdcentralen: Rensade ${orphans.length} herrelösa bilder via Storage API.`);
          updateOne('orphaned_avatars', { status: 'ok', message: `✅ Rensade ${orphans.length} bilder.` });
        } else {
          updateOne('orphaned_avatars', { status: 'warning', message: `⚠️ Storage-fel: ${storageErr.message}` });
        }
      } else {
        updateOne('orphaned_avatars', { status: 'ok', message: '✅ Inga herrelösa bilder.' });
      }

      // 2. Storage
      const { data: storageSize } = await supabase.rpc('get_total_storage_size');
      const sizeMB = ((storageSize || 0) / (1024 * 1024)).toFixed(2);
      updateOne('storage', { status: 'ok', message: `✅ ${sizeMB} MB använt.` });

      // 3. Profil-sync (Auth vs Profile)
      const { data: syncData } = await supabase.rpc('diagnose_missing_profiles');
      if (syncData > 0) fixesCount++;
      updateOne('sync', { status: 'ok', message: syncData > 0 ? `✅ Fixade ${syncData} profiler.` : '✅ Allt synkat.' });

      // 4. Döda länkar
      const { data: linksData } = await supabase.rpc('fix_dead_links');
      if (linksData > 0) fixesCount++;
      updateOne('links', { status: 'ok', message: linksData > 0 ? `✅ Rensade ${linksData} inlägg.` : '✅ Inga döda länkar.' });

      // 5. Gamla notiser (>30 dagar)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: oldNotif } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).lt('created_at', thirtyDaysAgo.toISOString());
      if ((oldNotif || 0) > 0) {
         fixesCount++;
         await supabase.from('notifications').delete().lt('created_at', thirtyDaysAgo.toISOString());
         updateOne('notifications', { status: 'ok', message: `✅ Rensade ${oldNotif} notiser.` });
      } else {
         updateOne('notifications', { status: 'ok', message: '✅ Inget skräp.' });
      }

      // 6. Trasiga avatar-URLer (undefined/null i strängar)
      const { count: badAvatars } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).or('avatar_url.ilike.%undefined%,avatar_url.ilike.%null%');
      if ((badAvatars || 0) > 0) {
        fixesCount++;
        await supabase.from('profiles').update({ avatar_url: null }).or('avatar_url.ilike.%undefined%,avatar_url.ilike.%null%');
        updateOne('avatars', { status: 'ok', message: `✅ Fixade ${badAvatars} URL:er.` });
      } else {
        updateOne('avatars', { status: 'ok', message: '✅ Inga trasiga länkar.' });
      }

      // 7. Deep Scan (Social och Struktur)
      const scanRes = await adminRunDeepScan();
      if (scanRes?.issues && scanRes.issues.length > 0) {
         fixesCount++;
         for (const issue of scanRes.issues) {
            await adminFixDeepScanIssue(issue.id);
         }
         updateOne('friendships', { status: 'ok', message: '✅ Djupanalys klar och lagad.' });
      } else {
         updateOne('friendships', { status: 'ok', message: '✅ Deep scan felfri.' });
      }

      // 8. Bildoptimering
      const { data: optImg } = await supabase.rpc('optimize_uploaded_images');
      if (optImg > 0) fixesCount++;
      updateOne('images', { status: 'ok', message: optImg > 0 ? `✅ Optimerade ${optImg} bilder.` : '✅ Alle bilder optimerade.' });

      // 9. Ignorerade Anmälningar (> 7 dagar)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: oldReports } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open').lt('created_at', sevenDaysAgo.toISOString());
      if ((oldReports || 0) > 0) {
         fixesCount++;
         updateOne('reports', { status: 'warning', message: `Hittade ${oldReports} gamla anmälningar. Auto-löser...` });
         await supabase.from('reports').update({ status: 'resolved' }).eq('status', 'open').lt('created_at', sevenDaysAgo.toISOString());
         await logAdminAction(supabase, currentUser.id, `Vårdcentralen: Auto-löste ${oldReports} gamla anmälningar.`);
         updateOne('reports', { status: 'ok', message: `✅ Rensade ${oldReports} anmälningar.` });
      } else {
         updateOne('reports', { status: 'ok', message: '✅ Inga gamla anmälningar.' });
      }

      // 10. Log-städning (> 15 dagar)
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      const { count: logsToDelete } = await supabase.from('admin_logs').select('*', { count: 'exact', head: true }).lt('created_at', fifteenDaysAgo.toISOString());
      if ((logsToDelete || 0) > 0) {
         fixesCount++;
         updateOne('logs', { status: 'warning', message: `Rensar ${logsToDelete} gamla loggar...` });
         await supabase.from('admin_logs').delete().lt('created_at', fifteenDaysAgo.toISOString());
         updateOne('logs', { status: 'ok', message: `✅ Rensade ${logsToDelete} rader.` });
      } else {
         updateOne('logs', { status: 'ok', message: '✅ Loggarna är fräscha.' });
      }

      // Slutgiltig summering
      const totalSteps = currentResults.length;
      const okCount = currentResults.filter(r => r.status === 'ok').length;
      const summaryText = `${okCount} av ${totalSteps} felfria, ${fixesCount} åtgärdade automatiskt.`;
      
      await logAdminAction(supabase, currentUser.id, `Vårdcentralen: ${summaryText}`);
      fetchLatestScanResult();

    } catch (err: any) {
      if (err.message !== 'DB_OVERLOAD') console.error('Diagnosfel:', err);
    } finally {
      setRunning(false);
      isExecutingRef.current = false;
    }
  };

  const fetchLatestScanResult = async () => {
    const { data } = await supabase
      .from('admin_logs')
      .select('action, created_at')
      .ilike('action', 'Vårdcentralen:%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setLastScanResult(data[0].action.replace('Vårdcentralen: ', ''));
    }
  };

  const handleWipeBio = async () => {
    if (!selectedUser) return;
    if (confirm(`Säkerhetsvarning: Vill du verkligen rensa all profiltext/biografi för ${selectedUser.username}?`)) {
      const res = await adminResetPresentation(selectedUser.id);
      if (res?.error) alert("Kunde inte rensa: " + res.error);
      else {
        alert(`Biografin för ${selectedUser.username} är nu raderad.`);
        await logAdminAction(supabase, currentUser.id, `Rensade biografi för användare ${selectedUser.username}`);
        setSelectedUser(null);
        setDiagSearch('');
      }
    }
  };

  const handleWipeCss = async () => {
    if (!selectedUser) return;
    if (confirm(`Säkerhetsvarning: Vill du verkligen nollställa all CSS-design för ${selectedUser.username}?`)) {
      const res = await adminResetTheme(selectedUser.id);
      if (res?.error) alert("Kunde inte nollställa: " + res.error);
      else {
        alert(`Designen för ${selectedUser.username} var nollställd.`);
        await logAdminAction(supabase, currentUser.id, `Nollställde CSS-design för användare ${selectedUser.username}`);
        setSelectedUser(null);
        setDiagSearch('');
      }
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
          alert(`🔥 Mass-radering slutförd! Totalt raderades ${res.count || 0} inlägg som innehöll "${massDeleteQuery}".`);
          await logAdminAction(supabase, currentUser.id, `Mass-radera spam: "${massDeleteQuery}" (Raderade ${res.count || 0} rader)`);
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
      <div className="admin-card diagnostics-header admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '1.25rem 1.5rem', backgroundColor: '#f0fdf4', border: '2px solid #10b981' }}>
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

      <div className="admin-card" style={{ marginBottom: '1.5rem', padding: '1.5rem', borderLeft: '6px solid #3b82f6', backgroundColor: '#f8fafc' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e40af', fontWeight: '800' }}>Diagnosverktyg resultat:</h3>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#334155', fontStyle: 'italic' }}>
          {lastScanResult || 'Ingen skanning har körts nyligen.'}
        </p>
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

      <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}>
        <div className="admin-card" style={{ padding: '1.5rem', borderTop: '4px solid #ef4444' }}>
          <h3 style={{ margin: 0, marginBottom: '0.5rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Trash2 size={20} /> Akut Mass-radera Spam</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Sök upp och radera ALLA inlägg som innehåller ett visst ord eller länk (Whiteboard, Forum, Gästbok, Chatten).</p>
          <div style={{ display: 'flex', gap: '0.75rem' }} className="admin-responsive-card">
            <input
              type="text"
              placeholder="Exempel: bit.ly/spam-link"
              value={massDeleteQuery}
              onChange={e => setMassDeleteQuery(e.target.value)}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
            <button
              onClick={handleMassDelete}
              disabled={massDeleting}
              style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {massDeleting ? 'RADERAR...' : 'RADERA ALLT'}
            </button>
          </div>
        </div>

        <div className="admin-card" style={{ padding: '1.5rem', borderTop: '4px solid #6366f1' }}>
          <h3 style={{ margin: 0, marginBottom: '0.5rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={20} /> Globalt Ord-filter (Stjärnmarkerar ****)
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Lägg till ord som automatiskt ska bytas ut mot stjärnor i alla inlägg (Chatt, Forum, PM, etc.).
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }} className="admin-responsive-card">
            <input
              type="text"
              placeholder="Exempel: fultord123"
              value={newForbiddenWord}
              onChange={e => setNewForbiddenWord(e.target.value)}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
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
              {forbiddenWords.map(w => (
                <div key={w.id} style={{ backgroundColor: '#f1f5f9', color: '#1e293b', padding: '0.4rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #cbd5e1' }}>
                  {w.word}
                  <button onClick={() => handleRemoveWord(w.id, w.word)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-card" style={{ padding: '2rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5' }}>
          <h3 style={{ margin: 0, marginBottom: '1rem', color: '#be185d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Search size={22} /> Hitta Användarprofil (för rensning)</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Sök fram en användare för att nollställa deras design eller biografi. Skriv in början på ett namn för att få förslag.</p>
          
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Sök på användarnamn..."
                value={diagSearch}
                onChange={(e) => setDiagSearch(e.target.value)}
                className="chat-input"
                style={{ width: '100%', backgroundColor: 'white', border: '1px solid #fca5a5', padding: '0.75rem', paddingRight: '2.5rem', borderRadius: '8px', outline: 'none' }}
              />
              {diagSearch && (
                <button 
                  onClick={() => { setDiagSearch(''); setDiagSearchResults([]); setSelectedUser(null); }}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#be185d', display: 'flex', alignItems: 'center' }}
                  title="Rensa sökning"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            
            {diagSearchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', backgroundColor: 'white', border: '1px solid #fca5a5', borderRadius: '8px', marginTop: '4px', zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                {diagSearchResults.map(u => (
                  <div 
                    key={u.id} 
                    onClick={() => { setSelectedUser(u); setDiagSearchResults([]); setDiagSearch(u.username); }}
                    style={{ padding: '0.75rem', borderBottom: '1px solid #fff5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                      <img src={u.avatar_url || 'https://via.placeholder.com/30'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    </div>
                    <strong>{u.username}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedUser && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '2px solid #be185d', marginBottom: '1rem', animation: 'fadeIn 0.3s', position: 'relative' }}>
              {/* STÄNG-KNAPP (KRYSS) */}
              <button 
                onClick={() => { setSelectedUser(null); setDiagSearch(''); }}
                style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#be185d' }}
                title="Stäng sökresultat"
              >
                <X size={24} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #fca5a5' }}>
                  <img src={selectedUser.avatar_url || 'https://via.placeholder.com/60'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.25rem', color: '#be185d' }}>{selectedUser.username}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {selectedUser.id}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }} className="admin-responsive-card">
                <button
                  onClick={handleWipeCss}
                  style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Eraser size={18} /> Nollställ Design
                </button>
                <button
                  onClick={handleWipeBio}
                  style={{ flex: 1, backgroundColor: '#be185d', color: 'white', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Edit2 size={18} /> Rensa Biografi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==========================================================
// 10. BLOCKERADE (Hantera vem som blockat vem)
// ==========================================================
const AdminBlocks = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBlocks();
  }, [supabase]);

  // Sök-loggning (Debounced)
  useEffect(() => {
    if (search.trim().length > 1) {
      const timer = setTimeout(() => {
        logAdminAction(supabase, currentUser.id, `Sökte i Blockeringar efter: "${search.trim()}"`);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [search, supabase, currentUser.id]);

  async function fetchBlocks(query?: string) {
    setLoading(true);
    let q = supabase
      .from('user_blocks')
      .select(`
        created_at,
        blocker_id,
        blocked_id,
        blocker:profiles!blocker_id(username),
        blocked:profiles!blocked_id(username)
      `)
      .order('created_at', { ascending: false });

    if (query && query.trim().length > 1) {
      const term = query.trim();
      // För att söka effektivt i båda riktningar utan join-limitations
      const { data: matchedProfiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', `%${term}%`);

      const matchedIds = matchedProfiles?.map((p: any) => p.id) || [];
      if (matchedIds.length > 0) {
        // Vi söker efter rader där antingen blockeraren eller den blockade matchar ID:t
        q = q.or(`blocker_id.in.(${matchedIds.map((id: string) => `"${id}"`).join(',')}),blocked_id.in.(${matchedIds.map((id: string) => `"${id}"`).join(',')})`);
      } else {
        setBlocks([]);
        setLoading(false);
        return;
      }
    }

    const { data } = await q.limit(100);
    if (data) setBlocks(data);
    setLoading(false);
  }

  const handleUnblock = async (blockerId: string, blockedId: string, blockerName: string, blockedName: string) => {
    if (confirm(`Är du säker på att du vill ta bort blockeringen mellan ${blockerName} och ${blockedName}?`)) {
      const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
      if (error) return alert('Fel vid avblockering: ' + error.message);
      await logAdminAction(supabase, currentUser.id, `Tog bort blockering: ${blockerName} hade blockat ${blockedName}`);
      fetchBlocks(search);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Blockeringar</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Överblicka vem som har blockerat vem på plattformen. Sök på ett namn för att se vem som blockerat den personen.</p>

      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 auto' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); fetchBlocks(e.target.value); }}
              placeholder="Sök på den blockade användaren (t.ex. kalle)..."
              className="admin-input"
              style={{ width: '100%', paddingLeft: '3rem' }}
            />
          </div>
          <button onClick={() => { fetchBlocks(search); logAdminAction(supabase, currentUser.id, `Tryckte på SÖK-knappen i Blockeringar (sökterm: "${search}")`); }} className="admin-input" style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.75rem 2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Sök
          </button>
        </div>
        {search && blocks.length > 0 && (
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--theme-primary)' }}>
            Hittade {blocks.length} träffar relaterat till "{search}".
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading && <p style={{ color: 'var(--text-muted)' }}>Laddar blockeringar...</p>}
        {!loading && blocks.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga aktiva blockeringar hittades{search ? ` för "${search}"` : ''}.</p>}
        {blocks.map(b => (
          <div key={`${b.blocker_id}-${b.blocked_id}`} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderLeft: '4px solid #ef4444', transition: 'all 0.2s' }}>
            <div className="admin-card-content">
              <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                <span style={{ color: '#ef4444' }}>{b.blocker?.username || 'Okänd'}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0.75rem', fontWeight: 'normal' }}>har blockerat</span>
                <span style={{ color: '#3b82f6' }}>{b.blocked?.username || 'Okänd'}</span>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                <History size={14} color="var(--text-muted)" />
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(b.created_at).toLocaleDateString('sv-SE')} klockan {new Date(b.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="admin-card-actions">
              <button
                onClick={() => handleUnblock(b.blocker_id, b.blocked_id, b.blocker?.username || 'Okänd', b.blocked?.username || 'Okänd')}
                style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
              >
                <Eraser size={16} /> Avblockera
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


