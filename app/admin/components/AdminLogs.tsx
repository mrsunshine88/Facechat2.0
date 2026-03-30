"use client"

import React, { useState, useEffect } from 'react';

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

export default AdminLogs;
