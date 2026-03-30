"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Activity, Users, ShieldAlert, Shield, AlertTriangle, 
  Database, Terminal, LifeBuoy, Edit2, Wrench, History, 
  LogOut, ShieldCheck
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getUnreadSupportCountAction } from '../actions/userActions';
import { useUser } from '@/components/UserContext';

// Import Modular Admin Components
import AdminDashboard from './components/AdminDashboard';
import AdminUsers from './components/AdminUsers';
import AdminBlocks from './components/AdminBlocks';
import AdminBilder from './components/AdminBilder';
import AdminReports from './components/AdminReports';
import AdminContent from './components/AdminContent';
import AdminRooms from './components/AdminRooms';
import AdminSupport from './components/AdminSupport';
import AdminPermissions from './components/AdminPermissions';
import AdminDiagnostics from './components/AdminDiagnostics';
import AdminLogs from './components/AdminLogs';

const ROOT_EMAILS = ['apersson508@gmail.com'];

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity, perm: 'stats' },
  { id: 'users', label: 'Användare', icon: Users, perm: 'users' },
  { id: 'blocks', label: 'Blockeringar', icon: ShieldAlert, perm: 'users' },
  { id: 'bilder', label: 'Bilder', icon: Shield, perm: 'images' },
  { id: 'reports', label: 'Anmälningar', icon: AlertTriangle, perm: 'content' },
  { id: 'content', label: 'Moderering', icon: Database, perm: 'content' },
  { id: 'rooms', label: 'Chattrum', icon: Terminal, perm: 'rooms' },
  { id: 'support', label: 'Support', icon: LifeBuoy, perm: 'support' },
  { id: 'permissions', label: 'Behörigheter', icon: Edit2, perm: 'roles' },
  { id: 'diagnostics', label: 'Hälsokontroll', icon: Wrench, perm: 'diagnostics' },
  { id: 'audit', label: 'Granskningslogg', icon: History, perm: 'logs' }
];

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

const NoAccess = () => (
  <div style={{ maxWidth: '600px', margin: '10vh auto', textAlign: 'center', padding: '3rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed #ef4444' }}>
    <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Behörighet saknas</h2>
    <p style={{ color: 'var(--text-muted)' }}>Ditt Adminkonto har inte tillräckliga rättigheter för att komma åt denna sektion. Kontakta Root-Admin för uppgradering.</p>
  </div>
);

const supabase = createClient();

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
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
    
    if (!profile.is_admin && !ROOT_EMAILS.includes(user.email || '')) { 
      router.push('/');
      return;
    }

    setUserProfile({ ...profile, auth_email: user.email });

    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }

    const profileSub = supabase.channel('admin-self-update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => {
        refreshProfile(); 
      }).subscribe();
    
    return () => { supabase.removeChannel(profileSub); };
  }, [router, user, profile, userLoading, refreshProfile]);

  useEffect(() => {
    if (!userProfile) return;
    const isRoot = ROOT_EMAILS.includes(userProfile.auth_email) || userProfile.perm_roles === true;
    const canManageSupport = isRoot || userProfile.perm_support === true;

    if (canManageSupport) {
      const fetchUnread = async () => {
        const res = await getUnreadSupportCountAction();
        if (res && typeof res.count === 'number') {
           setUnreadSupportCount(res.count);
        }
      };

      fetchUnread();
      const sub = supabase.channel('admin-support-alerts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => fetchUnread())
        .subscribe();

      return () => { supabase.removeChannel(sub); };
    }
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    const isRoot = ROOT_EMAILS.includes(userProfile.auth_email);
    const canManageContent = isRoot || userProfile.perm_content === true;

    if (canManageContent) {
      const fetchReportsCount = async () => {
        let query = supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open');
        if (!isRoot) {
          query = query.neq('reported_user_id', userProfile.id);
        }
        const { count } = await query;
        if (count !== null) setUnreadReportsCount(count);
      };

      fetchReportsCount();
      const sub = supabase.channel('admin-reports-alerts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => fetchReportsCount())
        .subscribe();

      return () => { supabase.removeChannel(sub); };
    }
  }, [userProfile]);

  if (!userProfile) return <AdminSkeleton />;

  const isRoot = ROOT_EMAILS.includes(userProfile.auth_email) || 
                 userProfile.username?.toLowerCase() === 'mrsunshine88' || 
                 userProfile.username?.toLowerCase() === 'apersson508';

  const perms = {
    users: isRoot || userProfile.perm_users === true,
    content: isRoot || userProfile.perm_content === true,
    rooms: isRoot || userProfile.perm_rooms === true,
    roles: isRoot || userProfile.perm_roles === true,
    support: isRoot || userProfile.perm_support === true,
    logs: isRoot || userProfile.perm_logs === true,
    stats: isRoot || userProfile.perm_stats === true,
    diagnostics: isRoot || userProfile.perm_diagnostics === true,
    chat: isRoot || userProfile.perm_chat === true,
    images: isRoot || userProfile.perm_images === true
  };

  const filteredTabs = ADMIN_TABS.filter(tab => {
    if (isRoot) return true;
    const p = tab.perm as keyof typeof perms;
    return perms[p] === true;
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return perms.stats ? <AdminDashboard supabase={supabase} /> : <NoAccess />;
      case 'users': return perms.users ? <AdminUsers supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'bilder': return perms.images ? <AdminBilder supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'reports': return perms.content ? <AdminReports supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'content': return (perms.content || perms.chat) ? <AdminContent supabase={supabase} currentUser={userProfile} perms={{ content: perms.content, chat: perms.chat }} /> : <NoAccess />;
      case 'rooms': return perms.rooms ? <AdminRooms supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'support': return perms.support ? <AdminSupport supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'permissions': return perms.roles ? <AdminPermissions supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'blocks': return perms.users ? <AdminBlocks supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      case 'logs': return perms.logs ? <AdminLogs supabase={supabase} /> : <NoAccess />;
      case 'audit': return perms.logs ? <AdminLogs supabase={supabase} /> : <NoAccess />; // Compatibility
      case 'diagnostics': return perms.diagnostics ? <AdminDiagnostics supabase={supabase} currentUser={userProfile} /> : <NoAccess />;
      default: return perms.stats ? <AdminDashboard supabase={supabase} /> : <NoAccess />;
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: 'calc(100vh - 74px)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'Inter, sans-serif' }} className="admin-layout">

      {/* Sidebar */}
      <div style={{ width: '280px', minHeight: 'calc(100vh - 74px)', height: 'calc(100vh - 74px)', position: 'sticky', top: '74px', backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }} className="admin-sidebar">
        <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: '1.2' }}>
            <ShieldCheck size={28} /> FACECHAT ADMIN
          </h1>
          <p style={{ fontSize: '0.75rem', marginTop: '0.75rem', color: 'var(--text-muted)' }}>Inloggad: {userProfile.username}</p>
          <span style={{ display: 'inline-block', marginTop: '0.5rem', backgroundColor: isRoot ? '#7f1d1d' : '#1e3a8a', color: isRoot ? '#fca5a5' : '#bfdbfe', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
            {isRoot ? 'ROOT ADMIN' : 'MODERATOR'}
          </span>
        </div>

        <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }} className="admin-sidebar-menu">
          <div className="hide-on-mobile">
            {filteredTabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)} 
                className={`admin-nav-link ${activeTab === tab.id ? 'active' : ''}`}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <tab.icon size={18} /> {tab.label}
                </div>
                {(tab.id === 'support' && unreadSupportCount > 0) || (tab.id === 'reports' && unreadReportsCount > 0) ? (
                  <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', minWidth: '20px', padding: '0.15rem 0.4rem', borderRadius: '999px', textAlign: 'center' }}>
                    {tab.id === 'support' ? unreadSupportCount : unreadReportsCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="hide-on-desktop">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '1rem' }}
            >
              {filteredTabs.map(tab => (
                 <option key={tab.id} value={tab.id}>
                   {tab.label}
                 </option>
              ))}
            </select>
          </div>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <button onClick={() => router.push('/')} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: '600', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <LogOut size={18} /> Avsluta Admin
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main-content" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
          {renderContent()}
        </div>
      </div>

      <style jsx global>{`
        .admin-nav-link {
          display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
          color: var(--text-muted); text-decoration: none; background: none;
          border: none; width: 100%; text-align: left; cursor: pointer;
          border-radius: 8px; font-weight: 500; transition: all 0.2s;
        }
        .admin-nav-link:hover { background-color: var(--bg-hover); color: var(--text-main); }
        .admin-nav-link.active { background-color: rgba(239, 68, 68, 0.08); color: #ef4444; font-weight: 600; }
        
        .admin-card { 
          background-color: var(--bg-card); 
          border: 1px solid var(--border-color); 
          border-radius: 12px; 
          padding: 1.5rem; 
          box-shadow: var(--shadow-sm); 
        }

        .admin-input {
          width: 100%; 
          padding: 0.75rem 1rem; 
          border-radius: 8px; 
          border: 1px solid var(--border-color); 
          background-color: var(--bg-color); 
          color: var(--text-main);
          outline: none;
          transition: border-color 0.2s;
        }
        .admin-input:focus { border-color: var(--theme-primary); }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1024px) {
          .admin-sidebar { width: 80px; }
          .admin-sidebar h1, .admin-sidebar p, .admin-sidebar span, .admin-nav-link span:not(.badge) { display: none; }
          .admin-sidebar-menu { padding: 1rem 0.5rem; }
          .admin-nav-link { justify-content: center; padding: 1rem; }
        }

        @media (max-width: 768px) {
          .admin-layout { flex-direction: column; }
          .admin-sidebar { width: 100%; height: auto; position: relative; top: 0; }
          .hide-on-mobile { display: none; }
          .hide-on-desktop { display: block; }
        }
      `}</style>
    </div>
  );
}
