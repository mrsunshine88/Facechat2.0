"use client"

import React, { useState, useEffect } from 'react';
import { Search, History, Eraser } from 'lucide-react';
import { adminLogAction } from '@/app/actions/auditActions';

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
        adminLogAction(`Sökte i Blockeringar efter: "${search.trim()}"`);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [search]);

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
      const { data: matchedProfiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', `%${term}%`);

      const matchedIds = matchedProfiles?.map((p: any) => p.id) || [];
      if (matchedIds.length > 0) {
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
    if (confirm(`Ta bort blockeringen mellan ${blockerName} och ${blockedName}?`)) {
      const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
      if (error) return alert('Fel: ' + error.message);
      await adminLogAction(`Tog bort blockering: ${blockerName} hade blockat ${blockedName}`, blockedId);
      fetchBlocks(search);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Blockeringar</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Överblicka vem som har blockerat vem på plattformen.</p>

      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 auto' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); fetchBlocks(e.target.value); }}
              placeholder="Sök på användaren (t.ex. kalle)..."
              className="admin-input"
              style={{ width: '100%', paddingLeft: '3rem' }}
            />
          </div>
          <button onClick={() => fetchBlocks(search)} className="admin-input" style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '0.75rem 2rem', borderRadius: '8px' }}>
            Sök
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading && <p style={{ color: 'var(--text-muted)' }}>Laddar blockeringar...</p>}
        {!loading && blocks.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga aktiva blockeringar hittades.</p>}
        {blocks.map(b => (
          <div key={`${b.blocker_id}-${b.blocked_id}`} className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderLeft: '4px solid #ef4444' }}>
            <div>
              <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                <span style={{ color: '#ef4444' }}>{b.blocker?.username || 'Okänd'}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0.5rem', fontWeight: 'normal' }}>blockar</span>
                <span style={{ color: '#2563eb' }}>{b.blocked?.username || 'Okänd'}</span>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <History size={14} />
                {new Date(b.created_at).toLocaleString('sv-SE')}
              </div>
            </div>
            <button
              onClick={() => handleUnblock(b.blocker_id, b.blocked_id, b.blocker?.username || 'Okänd', b.blocked?.username || 'Okänd')}
              style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Eraser size={16} /> Avblockera
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminBlocks;
