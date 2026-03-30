"use client"

import React, { useState, useEffect } from 'react';
import { getUnreadSupportCountAction } from '../../actions/userActions';

const AdminDashboard = ({ supabase }: { supabase: any }) => {
  const [stats, setStats] = useState({ users: 0, posts: 0, tickets: 0, online: 0, banned: 0, reports: 0, ipBlocks: 0 });
  const [latestLogins, setLatestLogins] = useState<any[]>([]);

  useEffect(() => {
    async function loadDash() {
      try {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        
        // 1. FÖRSÖK KÖRA SUPER-QUERY (RPC) FÖR MAXIMAL FART
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_dashboard_stats');

        if (!rpcError && rpcData) {
          // Framgång! Vi laddade allt i ETT anrop.
          setStats({
            users: rpcData.usersCount || 0,
            posts: rpcData.userBlocksCount || 0, 
            tickets: rpcData.ticketsCount || 0,
            online: rpcData.onlineCount || 0,
            banned: rpcData.bannedCount || 0,
            reports: rpcData.reportsCount || 0,
            ipBlocks: rpcData.ipBlocksCount || 0
          });

          // Hämta inloggningar separat (eftersom det är en lista, ej count)
          const { data: logins } = await supabase.from('profiles')
            .select('username, last_seen, created_at, is_banned')
            .order('last_seen', { ascending: false, nullsFirst: false })
            .limit(10);
            
          if (logins) setLatestLogins(logins);
          return;
        }

        // 2. FALLBACK: Om RPC inte finns än, kör gamla metoden (11 anrop)
        const [
          { count: usersCount },
          { count: wbCount },
          { count: gbCount },
          { count: fCount },
          ticketsRes,
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
          getUnreadSupportCountAction(),
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
          tickets: ticketsRes?.count || 0,
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

export default AdminDashboard;
