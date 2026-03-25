"use client"

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Lock, User, Send, MessageSquare, Trash2, AlertTriangle, Edit2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useParams } from 'next/navigation';

const ForumSkeleton = () => (
  <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
    <div className="skeleton-pulse" style={{ width: '100px', height: '20px', marginBottom: '2rem' }}></div>
    <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
      <div className="skeleton-pulse" style={{ width: '300px', height: '30px', marginBottom: '1rem' }}></div>
      <div className="skeleton-pulse" style={{ width: '100%', height: '100px' }}></div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {[1,2,3].map(i => (
        <div key={i} className="card" style={{ padding: '1.5rem' }}>
           <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
             <div className="skeleton-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
             <div className="skeleton-pulse" style={{ width: '120px', height: '20px' }}></div>
           </div>
           <div className="skeleton-pulse" style={{ width: '100%', height: '60px' }}></div>
        </div>
      ))}
    </div>
  </div>
);

export default function ForumThread() {
  const router = useRouter();
  const params = useParams();
  const threadId = params.id as string;
  const [thread, setThread] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [newReply, setNewReply] = useState('');
  const [useAlias, setUseAlias] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportCategory, setReportCategory] = useState('Spam');

  const [editingPost, setEditingPost] = useState<{ id: string, content: string } | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profList } = await supabase.from('profiles').select('id, username, alias_name').eq('id', user.id).limit(1);
        const profile = profList && profList.length > 0 ? profList[0] : null;
        setCurrentUser(profile);
      }
      fetchData();
    }
    init();

    const sub = supabase.channel(`thread-${threadId}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'forum_posts' }, () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts', filter: `thread_id=eq.${threadId}` }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'forum_posts', filter: `thread_id=eq.${threadId}` }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'forum_threads', filter: `id=eq.${threadId}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [threadId]);

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const [blocksRes, threadRes, postsRes] = await Promise.all([
        user ? supabase.from('user_blocks').select('*').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`) : Promise.resolve({ data: [] }),
        supabase.from('forum_threads').select('*, profiles(username, alias_name, avatar_url)').eq('id', threadId).limit(1),
        supabase.from('forum_posts').select('*, profiles(username, alias_name, avatar_url)').eq('thread_id', threadId).order('created_at', { ascending: true })
      ]);

      let blockedIds: string[] = [];
      if (user && blocksRes.data) {
        blockedIds = blocksRes.data.map((b: any) => b.blocker_id === user.id ? b.blocked_id : b.blocker_id);
        setBlockedUserIds(blockedIds);
      }

      const thread = threadRes.data && threadRes.data.length > 0 ? threadRes.data[0] : null;
      if (thread) {
        if (blockedIds.includes(thread.author_id)) {
          router.push('/forum');
          return;
        }
        setThread(threadRes.data);
      }

      if (postsRes.data) {
        const filtered = postsRes.data.filter((p: any) => p.author_id && !blockedIds.includes(p.author_id));
        setPosts(filtered);
      }
    } catch (err) {
      console.error("Forum fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newReply.trim() || !currentUser) return;
    
    await supabase.from('forum_posts').insert({
      thread_id: threadId,
      author_id: currentUser.id,
      content: newReply.trim(),
      uses_alias: useAlias
    });

    const participants = new Set<string>();
    if (thread?.author_id && !blockedUserIds.includes(thread.author_id)) participants.add(thread.author_id);
    posts.forEach(p => { 
      if(p.author_id && !blockedUserIds.includes(p.author_id)) participants.add(p.author_id); 
    });
    participants.delete(currentUser.id);

    if (participants.size > 0) {
      const payloads = Array.from(participants).map(uid => ({
         receiver_id: uid,
         actor_id: currentUser.id,
         type: 'forum_reply',
         content: `svarade i tråden: "${thread?.title || 'Okänd Tråd'}"`,
         link: `/forum/${threadId}`
      }));
      await supabase.from('notifications').insert(payloads);

      Array.from(participants).forEach(uid => {
         fetch('/api/send-push', {
           method: 'POST', body: JSON.stringify({ userId: uid, title: 'Facechat Forum', message: `${currentUser.username} svarade i tråden: "${thread?.title || 'Okänd Tråd'}"`, url: `/forum/${threadId}` }), headers: { 'Content-Type': 'application/json' }
         }).catch(console.error);
      });
    }

    setNewReply('');
    await fetchData();
  }

  const handleSaveEdit = async () => {
    if(!editingPost || !editingPost.content.trim()) return;
    await supabase.from('forum_posts').update({ content: editingPost.content.trim() }).eq('id', editingPost.id);
    setEditingPost(null);
    fetchData();
  }

  const handleDeleteThread = async () => {
    if(!confirm('Är du säker på att du vill radera Hela tråden? Alla kommentarer kommer också att försvinna.')) return;
    const { error } = await supabase.from('forum_threads').delete().eq('id', threadId);
    if(error) {
       alert(`Radering avbröts: ${error.message}`);
       return;
    }
    router.push('/forum');
  };

  const handleDeletePost = async (postId: string) => {
    if(!confirm('Vill du verkligen radera din kommentar?')) return;
    const { error } = await supabase.from('forum_posts').delete().eq('id', postId);
    if(error) {
       alert(`Radering avbröts: ${error.message}`);
       return;
    }
    await fetchData();
  };

  const handleReportContent = async () => {
    if (!currentUser || !reportTarget || !reportReason.trim()) return;
    const finalReason = `[${reportCategory}] ${reportReason.trim()}`;
    await supabase.from('reports').insert({
      reporter_id: currentUser.id,
      reported_user_id: reportTarget.reportedUserId,
      item_type: reportTarget.type,
      item_id: reportTarget.id,
      reason: finalReason
    });

    // Notifiera alla administratörer!
    try {
      const { data: admins } = await supabase.from('profiles').select('id')
        .or('is_admin.eq.true,perm_content.eq.true');
      
      if (admins && admins.length > 0) {
        // Filtrera bort den person som blir anmäld om den är admin (jäv), 
        // men låt apersson508@gmail.com alltid få notiser.
        const filteredAdmins = admins.filter(admin => 
          admin.id !== reportTarget.reportedUserId || currentUser.auth_email === 'apersson508@gmail.com'
        );

        if (filteredAdmins.length > 0) {
          const adminNotifs = filteredAdmins.map(admin => ({
            receiver_id: admin.id,
            actor_id: currentUser.id,
            type: 'report',
            content: 'har skickat in en ny anmälan.',
            link: '/admin?tab=reports'
          }));

          await supabase.from('notifications').insert(adminNotifs);

          // Skicka även push-notiser till admins
          filteredAdmins.forEach(admin => {
            fetch('/api/send-push', {
              method: 'POST', body: JSON.stringify({
                userId: admin.id,
                title: 'Ny anmälan inkommen!',
                message: `${currentUser.username} har anmält något i forumet.`,
                url: '/admin?tab=reports'
              }), headers: { 'Content-Type': 'application/json' }
            });
          });
        }
      }
    } catch (notifErr) {
      console.error("Misslyckades att notifiera admins från Forumet:", notifErr);
    }

    alert('Din anmälan har skickats till våra moderatorer. Tack!');
    setShowReportModal(false);
    setReportReason('');
    setReportCategory('Spam');
    setReportTarget(null);
  };

  if (loading) return <ForumSkeleton />;

  if (!thread) return <div style={{ padding: '2rem', textAlign: 'center' }}>Hittade inte tråden...</div>;

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <style>{`
        @media (max-width: 768px) {
          .forum-post-row {
            flex-direction: column !important;
          }
          .author-sidebar {
            width: 100% !important;
            flex-direction: row !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border-color) !important;
            padding: 1rem !important;
            justify-content: flex-start !important;
            gap: 1rem !important;
          }
          .author-sidebar > div:first-child {
            width: 50px !important;
            height: 50px !important;
            margin-bottom: 0 !important;
          }
          .author-sidebar div[style*="text-align: center"] {
            text-align: left !important;
          }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <button onClick={() => router.push('/forum')} style={{ background: 'none', border: 'none', color: 'var(--theme-forum)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'bold', marginBottom: '1rem', padding: 0 }}>
            <ArrowLeft size={18} /> Tillbaka till Forumet
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ backgroundColor: 'var(--theme-forum)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{thread.category}</span>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-main)', margin: 0, lineHeight: '1.2' }}>{thread.title}</h1>
             </div>
             <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
               Trådstartad av <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{thread.profiles?.username || 'Okänd'}</span> • {new Date(thread.created_at).toLocaleDateString('sv-SE')}
             </p>
          </div>
        </div>

        {/* Alias Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: useAlias ? '#fef3c7' : 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: 'var(--radius)', border: `2px solid ${useAlias ? 'var(--theme-forum)' : 'var(--border-color)'}`, transition: 'all 0.2s' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Skriver som</span>
            <span style={{ fontWeight: 'bold', color: useAlias ? 'var(--theme-forum)' : 'var(--text-main)' }}>
              {useAlias ? (currentUser?.alias_name || 'Stenansikte (Anonym)') : (currentUser ? `${currentUser.username}` : 'Laddar...')}
            </span>
          </div>
          <button 
            onClick={() => setUseAlias(!useAlias)}
            style={{ 
              backgroundColor: useAlias ? 'var(--theme-forum)' : '#e5e7eb', 
              color: useAlias ? 'white' : 'var(--text-main)',
              width: '40px', height: '40px', borderRadius: '50%', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: useAlias ? 'var(--shadow-retro)' : 'none',
              border: useAlias ? '2px solid var(--text-main)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
            title="Byt till alias"
          >
            {useAlias ? <Lock size={18} /> : <User size={18} />}
          </button>
        </div>
      </div>

      {/* Tråden (Posts) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {posts.map((post, idx) => {
           const isFirst = idx === 0;
           const authorUsername = post.profiles?.username || 'Raderad';
           const authorDisplay = post.uses_alias ? (post.profiles?.alias_name || 'Stenansikte (Anonym)') : (
             <span onClick={(e) => { e.preventDefault(); router.push(`/krypin?u=${authorUsername}`); }} className="user-link" style={{ cursor: 'pointer', fontWeight: 'bold' }}>{authorUsername}</span>
           );
           const avatarSrc = post.uses_alias ? null : post.profiles?.avatar_url;
           const timeStr = new Date(post.created_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

           return (
             <div key={post.id} className="forum-post-row" style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', marginBottom: '1rem' }}>
               {/* Left sidebar info (Flashback Style) */}
               <div className="author-sidebar" style={{ width: '180px', backgroundColor: '#f1f5f9', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--border-color)', flexShrink: 0 }}>
                 <div style={{ width: '80px', height: '80px', borderRadius: '8px', backgroundColor: post.uses_alias ? 'var(--theme-forum)' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: 'white', marginBottom: '1rem', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {avatarSrc ? <img src={avatarSrc} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : (post.uses_alias ? <Lock size={32}/> : <User size={32} />)}
                 </div>
                 
                 <div style={{ textAlign: 'center', width: '100%' }}>
                   <div style={{ fontWeight: '800', fontSize: '1rem', color: post.uses_alias ? 'var(--theme-forum)' : 'var(--text-main)', marginBottom: '0.5rem', wordBreak: 'break-word', lineHeight: '1.2' }}>
                     {authorDisplay}
                   </div>
                   
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                     <span>Reg: {post.profiles?.created_at ? new Date(post.profiles.created_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' }) : 'Jan 2024'}</span>
                     <span>Ort: {post.profiles?.city || 'Okänd'}</span>
                     {isFirst && <span style={{ color: 'var(--theme-forum)', fontWeight: 'bold', marginTop: '0.5rem', fontSize: '0.6rem', letterSpacing: '1px' }}>TRÅDSTARTARE</span>}
                   </div>
                 </div>
               </div>

                {/* Right side content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {/* Post Header */}
                  <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: '600' }}>{timeStr}</span>
                      <span style={{ opacity: 0.5 }}>|</span>
                      <span style={{ fontWeight: 'bold' }}>#{idx + 1}</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button 
                        onClick={() => {
                          setNewReply(prev => (prev ? prev + '\n\n' : '') + `[citat] Ursprungligen postat av ${authorUsername}:\n${post.content}\n[/citat]\n`);
                          document.querySelector('textarea')?.focus();
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--theme-forum)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <MessageSquare size={14} /> Citera
                      </button>

                      {post.author_id === currentUser?.id && (
                        <button onClick={() => setEditingPost({ id: post.id, content: post.content })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Edit2 size={14} /> Ändra
                        </button>
                      )}

                      {post.author_id === currentUser?.id && (
                        <button onClick={() => isFirst ? handleDeleteThread() : handleDeletePost(post.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}>
                          <Trash2 size={14} /> Radera
                        </button>
                      )}

                      {post.author_id !== currentUser?.id && (
                        <button onClick={() => { setReportTarget({ id: post.id, type: 'forum_post', reportedUserId: post.author_id }); setShowReportModal(true); }} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}>
                          <AlertTriangle size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '1.5rem', flex: 1, backgroundColor: 'white' }}>
                    {editingPost?.id === post.id ? (
                      <div>
                        <textarea 
                          value={editingPost!.content}
                          onChange={e => setEditingPost({ ...editingPost!, content: e.target.value })}
                          style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '2px solid var(--theme-forum)', outline: 'none', resize: 'vertical', minHeight: '120px', fontFamily: 'inherit' }}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                          <button onClick={handleSaveEdit} style={{ backgroundColor: '#10b981', color: 'white', padding: '0.5rem 1.5rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Spara ändringar</button>
                          <button onClick={() => setEditingPost(null)} style={{ backgroundColor: '#f1f5f9', color: 'var(--text-main)', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', cursor: 'pointer' }}>Avbryt</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-main)', lineHeight: '1.7', whiteSpace: 'pre-wrap', fontSize: '1.05rem', wordBreak: 'break-word', margin: 0 }}>
                        {post.content.includes('[citat]') ? (
                          (() => {
                            const parts = post.content.split(/\[citat\]|\[\/citat\]/);
                            return parts.map((part: string, i: number) => {
                              if (i === 1) return (
                                <div key={i} style={{ backgroundColor: '#f1f5f9', borderLeft: '4px solid var(--theme-forum)', padding: '1rem', margin: '1rem 0', fontStyle: 'italic', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                                  {part.trim()}
                                </div>
                              );
                              return <span key={i}>{part}</span>;
                            });
                          })()
                        ) : post.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
        })}
      </div>

      {/* Svara Formulär */}
      <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <MessageSquare size={20} color="var(--theme-forum)" /> Svara i tråden
      </h3>
      <div className="card" style={{ padding: '1.5rem' }}>
        <form onSubmit={handleReply} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
           <textarea 
             value={newReply}
             onChange={e => setNewReply(e.target.value)}
             placeholder="Skriv ett svar..."
             style={{ width: '100%', minHeight: '120px', padding: '1rem', borderRadius: '8px', border: '2px solid var(--border-color)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
             disabled={!currentUser}
           />
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
               Du postar som: <span style={{ fontWeight: 'bold', color: useAlias ? 'var(--theme-forum)' : 'inherit' }}>{useAlias ? (currentUser?.alias_name || 'Stenansikte') : ``}</span>
             </p>
             <button type="submit" disabled={!newReply.trim() || !currentUser} style={{ backgroundColor: 'var(--theme-forum)', color: 'white', border: '2px solid var(--text-main)', borderRadius: '8px', padding: '0.75rem 2rem', fontWeight: 'bold', cursor: newReply.trim() ? 'pointer' : 'not-allowed', opacity: newReply.trim() ? 1 : 0.5, boxShadow: 'var(--shadow-retro)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Send size={18} /> Skicka Svar
             </button>
           </div>
        </form>
      </div>

         {showReportModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                 <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c' }}><AlertTriangle size={24}/> Anmäl Innehåll</h3>
                 <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>Vad gällar anmälan? Välj en kategori och beskriv kortfattat.</p>
                 
                 <select 
                   value={reportCategory}
                   onChange={e => setReportCategory(e.target.value)}
                   style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', marginBottom: '1rem', fontWeight: 'bold' }}
                 >
                   <option value="Spam">Spam/Nedskräpning</option>
                   <option value="Hatretorik">Hatretorik/Kränkande</option>
                   <option value="Trakasserier">Trakasserier/Mobbning</option>
                   <option value="Olämpligt">Olämpligt Innehåll</option>
                   <option value="Annat">Annat</option>
                 </select>

                 <textarea 
                   value={reportReason}
                   onChange={e => setReportReason(e.target.value)}
                   rows={4}
                   style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', marginBottom: '1rem' }}
                   placeholder="Beskriv vad som är fel (t.ex. personangrepp, spamlänk)..."
                 ></textarea>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => { setShowReportModal(false); setReportReason(''); setReportTarget(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-muted)' }}>Avbryt</button>
                <button onClick={handleReportContent} disabled={!reportReason.trim()} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: reportReason.trim() ? 'pointer' : 'not-allowed', opacity: reportReason.trim() ? 1 : 0.5 }}>Skicka Anmälan</button>
              </div>
           </div>
         </div>
      )}

    </div>
  );
}
