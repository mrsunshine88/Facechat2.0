"use client"

import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, Ban, PlayCircle, Lock, Trash2, Globe, Shield } from 'lucide-react';
import { deleteUserAccount } from '../../actions/userActions';
import { toggleBlockUser } from '../../actions/adminActions';
import { adminBlockIP, adminUnblockIP } from '@/app/actions/securityActions';
import { adminLogAction } from '@/app/actions/auditActions';

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
      // Hitta ROOT-Admin (Dig) oavsett vem som är inloggad
      const rootIdx = dbUsers.findIndex((u: any) => u.auth_email === 'apersson508@gmail.com' || u.username?.toLowerCase() === 'apersson508' || u.username?.toLowerCase() === 'mrsunshine88');
      
      if (rootIdx !== -1) {
        const root = dbUsers.splice(rootIdx, 1)[0];
        dbUsers.unshift(root); // Du ska ALLTID vara överst för alla
        if (root.last_ip) setProtectedIp(root.last_ip);
      } else if (currentUser?.auth_email === 'apersson508@gmail.com' || currentUser?.username?.toLowerCase() === 'mrsunshine88' || currentUser?.username?.toLowerCase() === 'apersson508') {
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
      
      setUsers(dbUsers);
    }
  }

  async function fetchBlockedIps() {
    const { data } = await supabase.from('blocked_ips').select('*').order('created_at', { ascending: false });
    if (data) setBlockedIps(data);
  }

  useEffect(() => {
    fetchUsers();
    fetchBlockedIps();

    const channel = supabase.channel('admin_users_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
        setUsers((prev: any[]) => prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u));
        
        // Uppdatera skyddat IP direkt om det är DIN profil som ändras
        const p = payload.new;
        if (p.auth_email === 'apersson508@gmail.com' || p.username?.toLowerCase() === 'apersson508' || p.username?.toLowerCase() === 'mrsunshine88') {
          if (p.last_ip) setProtectedIp(p.last_ip);
        }
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
        adminLogAction(`Sökte efter användare: "${search.trim()}"`);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [search]);

  const handleToggleBlock = async (user: any) => {
    if (user.username?.toLowerCase() === 'apersson508' || user.username?.toLowerCase() === 'mrsunshine88' || user.id === currentUser.id || user.auth_email === 'apersson508@gmail.com') {
       return alert('Detta konto är skyddat som Master-Admin.');
    }
    const newStatus = !user.is_banned;

    // Optimistic UI for User Ban
    setUsers((prev: any[]) => prev.map(u => u.id === user.id ? { ...u, is_banned: newStatus } : u));

    const res = await toggleBlockUser(user.id, newStatus);
    if (res?.error) {
       setUsers((prev: any[]) => prev.map(u => u.id === user.id ? { ...u, is_banned: !newStatus } : u));
       return alert('Fel: ' + res.error);
    }
    await adminLogAction(`${newStatus ? 'Blockerade' : 'Avblockerade'} ${user.username}`, user.id);
  };

  const handleBlockIP = async (ip: string, username: string) => {
    const cleanIp = ip?.trim();
    if (!cleanIp || cleanIp === '127.0.0.1') return alert('Kunde inte identifiera giltig IP.');
    const reason = prompt(`Ange anledning för att spärra IP ${cleanIp}:`, 'Spam/Missbruk');
    if (reason === null) return;

    const tempBlock = { ip: cleanIp, reason, created_at: new Date().toISOString() };
    setBlockedIps((prev: any[]) => [tempBlock, ...prev]);

    const res = await adminBlockIP(cleanIp, reason);
    if (res?.error) {
       setBlockedIps((prev: any[]) => prev.filter(b => b.ip !== cleanIp));
       return alert('Säkerhetsstopp: ' + res.error);
    }
    
    await adminLogAction(`Spärrade IP-adress ${ip} (${username})`);
   };

  const handleUnblockIP = async (ip: string) => {
    if (confirm(`Vill du ta bort spärren för IP ${ip}?`)) {
      const oldBlocks = [...blockedIps];
      setBlockedIps((prev: any[]) => prev.filter(b => b.ip !== ip));

      const res = await adminUnblockIP(ip);
      if (res?.error) {
         setBlockedIps(oldBlocks);
         return alert('Fel: ' + res.error);
      }
      await adminLogAction(`Tog bort IP-spärr för ${ip}`);
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
      await adminLogAction(`Raderade kontot ${user.username} permanent från systemet`);
      fetchUsers(search);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-main)' }}>Användare</h2>
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); fetchUsers(e.target.value); }} placeholder="Sök på användarnamn..." className="admin-input" style={{ flex: '1 1 auto', minWidth: '150px' }} />
          <button onClick={() => { fetchUsers(search); adminLogAction(`Tryckte på SÖK-knappen i Användare (sökterm: "${search}")`); }} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.75rem 2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 auto' }}><Search size={18} /> Sök</button>
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
                  const isRootInLoop = u.username?.toLowerCase() === 'apersson508' || u.username?.toLowerCase() === 'mrsunshine88' || u.auth_email === 'apersson508@gmail.com';
                  
                  // Skydda Root-användare OCH alla som delar Root's sparade IP. Inget annat.
                  const isProtected = isRootInLoop || (u.last_ip && u.last_ip === protectedIp);

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
            {blockedIps.map((item: any) => (
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

export default AdminUsers;
