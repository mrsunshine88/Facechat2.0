"use client"

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, CheckCircle, Ban, ArrowRight, EyeOff } from 'lucide-react';
import { adminResolveReport, adminDeleteContent, toggleBlockUser, adminDeleteReport } from '../../actions/adminActions';
import { adminLogAction } from '@/app/actions/auditActions';

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
      const res = await adminResolveReport(report.id, 'resolved');
      if (res?.error) return alert("Systemfel: " + res.error);
      await adminLogAction(`Hanterade en anmälan mot ${report.reported?.username || 'Okänd'} och raderade ${table || report.item_type}-inlägg.`, report.reported_user_id);
      fetchReports();
    }
  };

  const handleDeleteForumThread = async (postId: string, reportId: string) => {
    if (confirm('Är du säker på att du vill radera HELA tråden? Alla kommentarer kommer också att försvinna.')) {
      try {
        const { data: post, error: fetchErr } = await supabase.from('forum_posts').select('thread_id').eq('id', postId).single();
        if (fetchErr || !post?.thread_id) return alert('Kunde inte hitta tråden för detta inlägg.');

        const res = await adminDeleteContent('forum_threads', post.thread_id);
        if (res?.error) return alert('Kunde inte radera tråd: ' + res.error);

        const res2 = await adminResolveReport(reportId, 'resolved');
        if (res2?.error) return alert('Systemfel: ' + res2.error);
        await adminLogAction(`Hanterade en anmälan och raderade en hel forumtråd (Tråd-ID: ${post.thread_id}).`);
        fetchReports();
      } catch (err: any) { alert('Ett oväntat fel uppstod: ' + err.message); }
    }
  };

  const handleBanUser = async (report: any) => {
    if (confirm(`Ska användare ${report.reported?.username || 'Okänd'} bannas globalt från sajten?`)) {
      const res = await toggleBlockUser(report.reported_user_id, true);
      if (res?.error) return alert('Behörighet saknas: ' + res.error);
      const res2 = await adminResolveReport(report.id, 'resolved');
      if (res2?.error) return alert('Systemfel: ' + res2.error);
      await adminLogAction(`Bannade användare ${report.reported?.username} pga en anmälan.`, report.reported_user_id);
      fetchReports();
    }
  };

  const handleDismiss = async (id: string) => {
    const report = reports.find(r => r.id === id);
    const res = await adminResolveReport(id, 'dismissed');
    if (res?.error) return alert("Systemfel: " + res.error);
    await adminLogAction(`Avvisade anmälan (${id}) mot ${report?.reported?.username || 'Okänd'} utan åtgärd.`);
    fetchReports();
  }

  const handleDeleteReportEntry = async (id: string) => {
    if (!confirm('Vill du ta bort detta ärende helt från listan?')) return;
    const res = await adminDeleteReport(id);
    if (res?.error) return alert("Systemfel vid radering: " + res.error);
    fetchReports();
  };

  const openInRoom = (link: string) => {
    if (link === '#') return;
    window.open(link, '_blank');
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', color: 'var(--text-main)' }}>Anmälningar</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {reports.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga nya anmälningar just nu.</p>}
        {reports.map((r: any) => (
          <div key={r.id} className="admin-card" style={{ borderLeft: r.status === 'open' ? '4px solid #ef4444' : '4px solid #10b981', opacity: r.status === 'open' ? 1 : 0.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold', textTransform: 'uppercase' }}>{r.item_type}</span>
                <h3 style={{ margin: '0.25rem 0', fontSize: '1.1rem', fontWeight: '800' }}>Anmäld: {r.reported?.username || 'Okänd'}</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reporter: {r.reporter?.username || 'Gäst'} • {new Date(r.created_at).toLocaleString('sv-SE')}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ backgroundColor: r.status === 'open' ? '#fef2f2' : '#ecfdf5', color: r.status === 'open' ? '#ef4444' : '#10b981', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {r.status === 'open' ? 'ÖPPEN' : (r.status === 'resolved' ? 'ÅTGÄRDAD' : 'AVVISAD')}
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', borderLeft: '3px solid var(--border-color)' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>ANMÄLNINGS-ORSAK:</p>
              <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-main)' }}>"{r.reason}"</p>
              
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>INNEHÅLL:</p>
                <div style={{ color: 'var(--theme-primary)', fontWeight: '500', marginBottom: '0.5rem' }}>
                   {r.reported_content}
                </div>
                {r.reported_link && r.reported_link !== '#' && (
                  <button 
                    onClick={() => openInRoom(r.reported_link)}
                    style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '0.3rem 0.6rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: 'var(--text-main)' }}
                  >
                    Gå till inlägget <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>

            {r.status === 'open' ? (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={() => handleDeleteItem(r)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Trash2 size={16} /> Radera Innehåll
                </button>
                {r.is_forum_starter && (
                   <button onClick={() => handleDeleteForumThread(r.item_id, r.id)} style={{ backgroundColor: '#7f1d1d', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <Trash2 size={16} /> Radera HELA Tråden
                   </button>
                )}
                <button onClick={() => handleBanUser(r)} style={{ backgroundColor: '#1e293b', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Ban size={16} /> Banna Användare
                </button>
                <button onClick={() => handleDismiss(r.id)} style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <EyeOff size={16} /> Avvisa utan åtgärd
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => handleDeleteReportEntry(r.id)}
                  style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: '1px solid #fca5a5', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Radera Logg-Entry
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminReports;
