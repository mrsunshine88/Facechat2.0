"use client"

import React, { useState, useEffect } from 'react';

const AdminLogs = ({ supabase }: { supabase: any }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState('all');
  const [dateRange, setDateRange] = useState('7d'); // 'today', '7d', '30d'

  useEffect(() => {
    fetchAdmins();
  }, []);

  useEffect(() => {
    fetchLogs();

    const channel = supabase.channel('admin_logs_realtime_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_logs' }, fetchLogs)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, search, selectedAdmin, dateRange]);

  async function fetchAdmins() {
    const { data } = await supabase.from('profiles').select('id, username').eq('is_admin', true).order('username');
    if (data) setAdmins(data);
  }

  async function fetchLogs() {
    let query = supabase.from('admin_logs')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false });

    // Filter by Search
    if (search.trim()) {
      query = query.ilike('action', `%${search.trim()}%`);
    }

    // Filter by Admin
    if (selectedAdmin !== 'all') {
      query = query.eq('admin_id', selectedAdmin);
    }

    // Filter by Date
    if (dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        now.setHours(0, 0, 0, 0);
      } else if (dateRange === '7d') {
        now.setDate(now.getDate() - 7);
      } else if (dateRange === '30d') {
        now.setDate(now.getDate() - 30);
      }
      query = query.gte('created_at', now.toISOString());
    }

    const { data } = await query.limit(150);
    if (data) setLogs(data);
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Granskningslogg</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Övervakar varenda exakt handling alla admins utför på sajten.</p>

      {/* FILTER BAR */}
      <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', padding: '1rem' }}>
        <div style={{ flex: '2 1 300px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>SÖK HÄNDELSE</label>
          <input 
            type="text" 
            placeholder="Tex: blockering, raderade..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }} 
          />
        </div>
        
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>ADMINISTRATÖR</label>
          <select 
            value={selectedAdmin} 
            onChange={(e) => setSelectedAdmin(e.target.value)}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}
          >
            <option value="all">Alla admins</option>
            {admins.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
          </select>
        </div>

        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>TIDSPERIOD</label>
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}
          >
            <option value="today">Idag</option>
            <option value="7d">Sista 7 dagarna</option>
            <option value="30d">Sista 30 dagarna</option>
            <option value="all">All tid</option>
          </select>
        </div>
      </div>

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
                <td style={{ padding: '1rem', fontWeight: '600', color: (log.profiles?.is_root || log.action.includes('Befordrade')) ? '#2563eb' : '#ef4444' }}>{log.profiles?.username || 'System'}</td>
                <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{log.action}</td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('sv-SE')}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Inga loggar matchar dina filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminLogs;
