"use client"

import React, { useState, useEffect } from 'react';
import { 
  Search, Shield, Trash2, UserPlus, Edit2, Eraser, EyeOff, 
  UserCheck, Users, MessageSquare, PlusSquare, History, 
  Settings2, Activity, BarChart3, MessageCircle, Database,
  Terminal, LifeBuoy, Wrench, ShieldAlert
} from 'lucide-react';
import { adminUpdatePermissions } from '../../actions/adminActions';
import { adminLogAction } from '@/app/actions/auditActions';

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
        adminLogAction(`Sökte i Behörigheter efter: "${search.trim()}"`);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [search]);

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
    const { data, error } = await supabase.from('profiles')
      .select('*')
      .eq('is_admin', true)
      .order('is_root', { ascending: false })
      .order('username', { ascending: true });
      
    if (data) {
      setAdmins(data);
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
      .limit(10);
    if (data) setSearchResults(data);
    setIsLoading(false);
  }

  const handleMakeAdmin = async (userId: string, username: string) => {
    const res = await adminUpdatePermissions(userId, { 
      is_admin: true,
      perm_users: false, perm_content: false, perm_rooms: false,
      perm_roles: false, perm_support: false, perm_logs: false, 
      perm_chat: false, perm_diagnostics: false, perm_stats: false,
      perm_images: false 
    });
    
    if (res?.error) return alert('Fel: ' + res.error);
    await adminLogAction(`Befordrade ${username} till Admin`, userId);
    setSearch('');
    setSearchResults([]);
    fetchAdmins();
  };


  const handleRemoveAdmin = async (user: any) => {
    if (user.id === currentUser.id) return alert('Du kan inte ta bort din egen admin-status.');
    if (user.is_root) return alert('Säkerhetsspärr: Du kan inte ta bort en Root-administratör!');

    const res = await adminUpdatePermissions(user.id, {
      is_admin: false, 
      perm_users: false, 
      perm_content: false, 
      perm_rooms: false,
      perm_roles: false, 
      perm_support: false, 
      perm_logs: false, 
      perm_chat: false,
      perm_diagnostics: false, 
      perm_stats: false,
      perm_images: false
    });

    if (res?.error) return alert('Fel: ' + res.error);

    await adminLogAction(`Tog bort Admin-status från ${user.username}`, user.id);
    fetchAdmins();
  }

  const handleTogglePermission = async (user: any, column: string, val: boolean) => {
    const prevState = { ...activeEditAdmin };
    const prevAdmins = [...admins];

    const updatedUser = { ...user, [column]: val };
    setActiveEditAdmin(updatedUser);

    setAdmins(prev => prev.map(a => a.id === user.id ? updatedUser : a));

    const res = await adminUpdatePermissions(user.id, { [column]: val });

    if (res?.error) {
      alert('Kunde inte uppdatera behörighet: ' + res.error);
      setActiveEditAdmin(prevState);
      setAdmins(prevAdmins);
      return;
    }

    await adminLogAction(`Ändrade ${column} för ${user.username} till ${val}`, user.id);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Behörighet & Roller</h2>
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
          <button onClick={() => searchUsers(search)} disabled={isLoading} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: '1 1 auto' }}>
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
          const isRootAccount = !!person.is_root;
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

            {activeEditAdmin.is_root ? (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '1.5rem', borderRadius: '8px', color: '#b91c1c' }}>
                <ShieldAlert size={24} style={{ marginBottom: '0.5rem' }} />
                <p style={{ fontWeight: 'bold', margin: 0 }}>Root Super-Admin Skydd</p>
                Detta konto är systemets ägare och har permanent tillgång till alla funktioner. Behörigheter kan inte begränsas för Root.
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
                <PermissionCard title="Loggar" desc="Läs granskningsloggen." icon={History} checked={!!activeEditAdmin.perm_logs} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_logs', !activeEditAdmin.perm_logs)} />
                <PermissionCard title="Hälsokontroll" desc="Systemåterställning och Servervård." icon={Wrench} checked={!!activeEditAdmin.perm_diagnostics} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_diagnostics', !activeEditAdmin.perm_diagnostics)} />
                <PermissionCard title="Super-Admin" desc="Befordra admins & ändra roller." icon={ShieldAlert} checked={!!activeEditAdmin.perm_roles} onChange={() => handleTogglePermission(activeEditAdmin, 'perm_roles', !activeEditAdmin.perm_roles)} danger={true} />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPermissions;
