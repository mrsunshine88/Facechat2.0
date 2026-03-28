"use client"

import { useState, useEffect, use } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  MessageSquare, 
  User, 
  Trash2, 
  Edit2, 
  ArrowLeft, 
  Lock, 
  Calendar, 
  Tag, 
  AlertTriangle,
  ChevronRight,
  Send,
  Loader2,
  ShieldAlert 
} from 'lucide-react'
import React from 'react'
import { useWordFilter } from '@/hooks/useWordFilter'

export default function ForumThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { mask } = useWordFilter()
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [thread, setThread] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newReply, setNewReply] = useState('')
  const [editingPost, setEditingPost] = useState<{ id: string, content: string, title?: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTarget, setReportTarget] = useState<any>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportCategory, setReportCategory] = useState('Spam')
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchThread()
    const channel = supabase.channel(`thread-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_posts', filter: `thread_id=eq.${id}` }, () => fetchThread())
      .subscribe()

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    return () => { 
      supabase.removeChannel(channel);
      window.removeEventListener('resize', handleResize);
    }
  }, [id])

  async function fetchThread() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setCurrentUser(profile)
    }

    const { data: threadData } = await supabase.from('forum_threads')
      .select('*, profiles(username, avatar_url)')
      .eq('id', id)
      .single()

    if (threadData) {
      setThread(threadData)
      const { data: postsData } = await supabase.from('forum_posts')
        .select('*, profiles(username, avatar_url, city, created_at)')
        .eq('thread_id', id)
        .order('created_at', { ascending: true })

      if (postsData) setPosts(postsData)
    }
    setLoading(false)
  }

  async function handleReply() {
    if (!newReply.trim() || !currentUser) return
    const { data: newPost, error } = await supabase.from('forum_posts').insert({
      thread_id: id,
      author_id: currentUser.id,
      content: newReply
    }).select().single()

    if (error) {
       if (error.message?.includes('DUPLICATE_LIMIT_REACHED')) {
          setShowDuplicateModal(true);
          return;
       }
       alert('Kunde inte posta svar: ' + error.message);
       return;
    }

    if (!error && newPost) {
       setNewReply('')
       fetchThread()

       // --- NOTIFIKATIONS-LOGIK ---
       
       // 1. Hitta alla unika deltagare i tråden
       const participantIds = Array.from(new Set(posts.map(p => p.author_id)))
         .filter(pid => pid !== currentUser.id); // Notifiera inte oss själva

       // 2. Kolla efter citat för att special-notifiera
       const quoteMatch = newReply.match(/\[citat\] Ursprungligen postat av (.*?):/);
       let quotedId = null;
       if (quoteMatch && quoteMatch[1]) {
         const quotedUsername = quoteMatch[1].trim();
         const quotedUser = posts.find(p => p.profiles?.username === quotedUsername);
         if (quotedUser) {
           quotedId = quotedUser.author_id;
         }
       }

       // 3. Notifiera citerad person (högst prioritet)
       if (quotedId && quotedId !== currentUser.id) {
         await supabase.from('notifications').insert({
           receiver_id: quotedId,
           actor_id: currentUser.id,
           type: 'forum_quote',
           content: `citerade dig i tråden "${thread?.title}"`,
           link: `/forum/${id}#post-${newPost.id}`
         });

         fetch('/api/send-push', {
           method: 'POST', body: JSON.stringify({ userId: quotedId, title: 'Facechat Forum', message: `${currentUser.username} citerade dig!`, url: `/forum/${id}#post-${newPost.id}` }), headers: { 'Content-Type': 'application/json' }
         }).catch(console.error);
       }

       // 4. Notifiera trådstartaren (om det inte var vi eller den citerade)
       if (thread?.author_id && thread.author_id !== currentUser.id && thread.author_id !== quotedId) {
          await supabase.from('notifications').insert({
            receiver_id: thread.author_id,
            actor_id: currentUser.id,
            type: 'forum_reply',
            content: `svarade i din tråd "${thread?.title}"`,
            link: `/forum/${id}#post-${newPost.id}`
          });

          fetch('/api/send-push', {
            method: 'POST', body: JSON.stringify({ userId: thread.author_id, title: 'Facechat Forum', message: `${currentUser.username} svarade i din tråd!`, url: `/forum/${id}#post-${newPost.id}` }), headers: { 'Content-Type': 'application/json' }
          }).catch(console.error);
       }

       // 5. Notifiera övriga deltagare
       for (const pid of participantIds) {
         if (pid !== quotedId && pid !== thread?.author_id) {
           await supabase.from('notifications').insert({
             receiver_id: pid,
             actor_id: currentUser.id,
             type: 'forum_activity',
             content: `Ny aktivitet i tråden "${thread?.title}"`,
             link: `/forum/${id}#post-${newPost.id}`
           });

           fetch('/api/send-push', {
             method: 'POST', body: JSON.stringify({ userId: pid, title: 'Facechat Forum', message: `Ny aktivitet i tråden "${thread?.title}"`, url: `/forum/${id}#post-${newPost.id}` }), headers: { 'Content-Type': 'application/json' }
           }).catch(console.error);
         }
       }
    }
  }

  async function handleDeletePost(postId: string) {
    if (confirm('Är du säker på att du vill radera detta inlägg?')) {
      await supabase.from('forum_posts').delete().eq('id', postId)
      fetchThread()
    }
  }

  async function handleDeleteThread() {
    if (confirm('VARNING: Vill du radera hela tråden? Detta kan inte ångras.')) {
      await supabase.from('forum_posts').delete().eq('thread_id', id)
      await supabase.from('forum_threads').delete().eq('id', id)
      router.push('/forum')
    }
  }

  async function handleSaveEdit() {
    if (!editingPost) return
    
    // Om det är första inlägget (trådstarten), uppdatera även trådens titel
    if (posts[0] && editingPost.id === posts[0].id && editingPost.title) {
      await supabase.from('forum_threads')
        .update({ title: editingPost.title })
        .eq('id', id);
    }

    await supabase.from('forum_posts')
      .update({ content: editingPost.content })
      .eq('id', editingPost.id)
      
    setEditingPost(null)
    fetchThread()
  }

  const handleReport = async () => {
    if (!reportReason.trim() || !currentUser || !reportTarget) return;
    
    const finalReason = `[${reportCategory}] ${reportReason.trim()}`;
    const contentToReport = posts.find(p => p.id === reportTarget.id)?.content || thread?.title || '';

    await supabase.from('reports').insert({
      reporter_id: currentUser.id,
      reported_user_id: reportTarget.reportedUserId,
      item_type: reportTarget.type, // 'forum_post'
      item_id: reportTarget.id,
      reason: finalReason,
      category: reportCategory,
      status: 'open',
      reported_content: `FORUM: ${thread?.title}\n\n${contentToReport}`
    });

    // Notifiera alla administratörer om den nya anmälan!
    try {
      const { data: admins } = await supabase.from('profiles').select('id')
        .or('is_admin.eq.true,perm_content.eq.true');
      
      if (admins && admins.length > 0) {
        // JÄVSFILTER: Anmäld admin ska inte se anmälan mot sig själv (undantaget Root)
        const filteredAdmins = admins.filter(admin => 
          admin.id !== reportTarget.reportedUserId || currentUser?.auth_email === 'apersson508@gmail.com'
        );

        if (filteredAdmins.length > 0) {
          const adminNotifs = filteredAdmins.map(admin => ({
            receiver_id: admin.id,
            actor_id: currentUser.id,
            type: 'report',
            content: `har skickat in en ny anmälan i forumet (${thread?.title}).`,
            link: '/admin?tab=reports'
          }));

          await supabase.from('notifications').insert(adminNotifs);

          // Skicka även push-notiser till admins
          filteredAdmins.forEach(admin => {
            fetch('/api/send-push', {
              method: 'POST', body: JSON.stringify({
                userId: admin.id,
                title: 'Ny anmälan i Forum!',
                message: `${currentUser.username} har anmält ett forum-inlägg.`,
                url: '/admin?tab=reports'
              }), headers: { 'Content-Type': 'application/json' }
            });
          });
        }
      }
    } catch (notifErr) {
      console.error("Misslyckades att notifiera admins:", notifErr);
    }

    alert('Din anmälan har skickats till våra moderatorer. Tack!');
    setShowReportModal(false);
    setReportReason('');
    setReportTarget(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <Loader2 className="animate-spin" size={48} color="var(--theme-forum)" />
        <p style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Laddar...</p>
      </div>
    )
  }

  const threadDateStr = thread.created_at ? new Date(thread.created_at).toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' }) : '...';
  const isMobile = windowWidth < 768;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <button onClick={() => router.push('/forum')} style={{ background: 'none', border: 'none', color: 'var(--theme-forum)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
          <ArrowLeft size={16} /> Tillbaka till Forumet
        </button>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{thread.category || 'Allmänt'}</span>
      </div>

      {/* HEADER (Top Rubric) */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderRadius: '12px', 
        border: '1px solid var(--border-color)', 
        padding: isMobile ? '1.5rem 1rem' : '2rem',
        marginBottom: '2rem',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? '1.5rem' : '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Accent strip */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: 'var(--theme-forum)' }}></div>

        {/* Left Side: Title and Meta */}
        <div style={{ flex: 1 }}>
          {editingPost && posts[0] && editingPost.id === posts[0].id ? (
            <div style={{ width: '100%', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '900', color: 'var(--theme-forum)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Ändra rubrik</label>
                <input 
                  value={editingPost.title !== undefined ? editingPost.title : thread.title}
                  onChange={e => setEditingPost({ ...editingPost!, title: e.target.value })}
                  autoFocus
                  style={{ width: '100%', fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)', padding: '0.75rem', borderRadius: '8px', border: '2px solid var(--theme-forum)', backgroundColor: 'white', outline: 'none', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)' }}
                />
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '900', color: 'var(--theme-forum)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Ändra innehåll</label>
                <textarea 
                  value={editingPost.content}
                  onChange={e => setEditingPost({ ...editingPost!, content: e.target.value })}
                  style={{ width: '100%', minHeight: '150px', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontFamily: 'inherit', fontSize: '1.1rem', lineHeight: '1.6', backgroundColor: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={handleSaveEdit} 
                  style={{ backgroundColor: '#10b981', color: 'white', padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}
                >
                  Spara ändringar
                </button>
                <button 
                  onClick={() => setEditingPost(null)} 
                  style={{ backgroundColor: '#f1f5f9', color: 'var(--text-main)', padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: '1.1', marginBottom: '1rem' }}>
                {mask(thread.title)}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <Calendar size={16}  color="var(--theme-forum)" />
                   <span>Startad {threadDateStr}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <Tag size={16} color="var(--theme-forum)" />
                   <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--theme-forum)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>{thread.category || 'Forum'}</span>
                </div>
                
                {posts[0] && (
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap',
                    gap: isMobile ? '0.5rem' : '1rem', 
                    marginTop: isMobile ? '1rem' : '0',
                    marginLeft: isMobile ? '0' : 'auto',
                    justifyContent: isMobile ? 'flex-start' : 'flex-end'
                  }}>
                    <button 
                      onClick={() => { setNewReply(`[citat]${thread.title}[/citat]\n`); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600' }}
                    >
                      <MessageSquare size={14} /> Citera
                    </button>
                    {(currentUser?.id === posts[0].author_id) && (
                      <button 
                        onClick={() => setEditingPost({ id: posts[0].id, content: posts[0].content, title: thread.title })}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600' }}
                      >
                        <Edit2 size={14} /> Ändra
                      </button>
                    )}
                    {(currentUser?.id === posts[0].author_id) && (
                      <button 
                        onClick={() => handleDeleteThread()}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600' }}
                      >
                        <Trash2 size={14} /> Radera
                      </button>
                    )}
                    {(currentUser?.id !== posts[0]?.author_id) && (
                      <button 
                        onClick={() => {
                          setReportTarget({ id: posts[0].id, type: 'forum_post', reportedUserId: posts[0].author_id });
                          setShowReportModal(true);
                        }}
                        style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '50%', transition: 'background-color 0.2s' }}
                        className="fb-action-btn"
                        title="Anmäl inlägg"
                      >
                        <AlertTriangle size={18} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Side: Author Info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '150px', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#cbd5e1', marginBottom: '0.75rem', border: '3px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              {thread.profiles?.avatar_url ? <img src={thread.profiles.avatar_url} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <User size={32} style={{margin:'16px'}} />}
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.25rem' }}>Trådstartad av</span>
              <span className="user-link" style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--theme-forum)', cursor: 'pointer' }} onClick={() => router.push(`/krypin?u=${thread.profiles?.username}`)}>
                {thread.profiles?.username || 'Okänd'}
              </span>
            </div>
        </div>
      </div>

      {/* Posts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        {posts.slice(1).map((post, idx) => {
            const actualIdx = idx + 2;
            const isFirst = false;
            const isDuplicateTitle = isFirst && post.content.trim().toLowerCase() === thread.title.trim().toLowerCase();
            
            const authorUsername = post.profiles?.username || 'Raderad';
            const authorDisplay = post.uses_alias ? (post.profiles?.alias_name || 'Stenansikte (Anonym)') : (
              <span onClick={(e) => { e.preventDefault(); router.push(`/krypin?u=${authorUsername}`); }} className="user-link" style={{ cursor: 'pointer', fontWeight: 'bold' }}>{authorUsername}</span>
            );
            const avatarSrc = post.uses_alias ? null : post.profiles?.avatar_url;
            const timeStr = new Date(post.created_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

            return (
              <div id={`post-${post.id}`} key={post.id} className="forum-post-row" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', border: isFirst ? '3px solid var(--theme-forum)' : '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-card)', boxShadow: isFirst ? '0 10px 30px rgba(0,0,0,0.1)' : 'var(--shadow-sm)' }}>
                {/* Left sidebar info (Differentiated look) */}
                <div className="author-sidebar" style={{ width: isMobile ? '100%' : '180px', backgroundColor: isFirst ? '#f8fafc' : '#f1f5f9', padding: isMobile ? '0.75rem 1rem' : '1.5rem 1rem', display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: 'center', borderRight: isMobile ? 'none' : '1px solid var(--border-color)', borderBottom: isMobile ? '1px solid var(--border-color)' : 'none', flexShrink: 0, gap: isMobile ? '1rem' : '0' }}>
                  <div style={{ width: isMobile ? '40px' : '80px', height: isMobile ? '40px' : '80px', borderRadius: '8px', backgroundColor: post.uses_alias ? 'var(--theme-forum)' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: 'white', marginBottom: isMobile ? '0' : '1rem', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                    {avatarSrc ? <img src={avatarSrc} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : (post.uses_alias ? <Lock size={isMobile ? 20 : 32}/> : <User size={isMobile ? 20 : 32} />)}
                  </div>
                  
                  <div style={{ textAlign: isMobile ? 'left' : 'center', width: '100%', flex: 1 }}>
                    <div style={{ fontWeight: '800', fontSize: isMobile ? '0.9rem' : '1rem', color: post.uses_alias ? 'var(--theme-forum)' : 'var(--text-main)', marginBottom: isMobile ? '0' : '0.5rem', wordBreak: 'break-word', lineHeight: '1.2' }}>
                      {authorDisplay}
                    </div>
                    
                    {!isMobile && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                        <span>Reg: {post.profiles?.created_at ? new Date(post.profiles.created_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' }) : 'Jan 2024'}</span>
                        <span>Ort: {post.profiles?.city || 'Okänd'}</span>
                        {isFirst && <span style={{ color: 'var(--theme-forum)', fontWeight: '900', marginTop: '0.5rem', fontSize: '0.65rem', letterSpacing: '1px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 6px', borderRadius: '4px' }}>TRÅDSTARTARE</span>}
                      </div>
                    )}
                    {isMobile && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Ort: {post.profiles?.city || 'Okänd'}
                      </div>
                    )}
                  </div>
                  {isMobile && <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>#{actualIdx}</div>}
                </div>

                {/* Right side content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {/* Post Header */}
                  <div style={{ padding: '0.75rem 1.25rem', backgroundColor: isFirst ? '#f1f5f9' : '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: '600' }}>{timeStr}</span>
                      <span style={{ opacity: 0.5 }}>|</span>
                      <span style={{ fontWeight: 'bold' }}>#{actualIdx}</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button 
                        onClick={() => {
                          setNewReply(prev => (prev ? prev + '\n\n' : '') + `[citat] Ursprungligen postat av ${authorUsername}:\n${post.content}\n[/citat]\n`);
                          const textarea = document.querySelector('textarea');
                          if (textarea) textarea.focus();
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
                        <button 
                          onClick={() => {
                            setReportTarget({ id: post.id, type: 'forum_post', reportedUserId: post.author_id });
                            setShowReportModal(true);
                          }}
                          style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '50%', transition: 'background-color 0.2s' }}
                          className="fb-action-btn"
                          title="Anmäl inlägg"
                        >
                          <AlertTriangle size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: isDuplicateTitle ? '0.5rem' : '1.5rem', flex: 1, backgroundColor: 'white' }}>
                    {editingPost?.id === post.id ? (
                      <div>
                        <textarea 
                          value={editingPost!.content}
                          onChange={e => setEditingPost({ ...editingPost!, content: e.target.value })}
                          style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '2px solid var(--theme-forum)', outline: 'none', resize: 'vertical', minHeight: '120px', fontFamily: 'inherit' }}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                          <button onClick={handleSaveEdit} style={{ backgroundColor: '#10b981', color: 'white', padding: '0.5rem 1.5rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Spara</button>
                          <button onClick={() => setEditingPost(null)} style={{ backgroundColor: '#f1f5f9', color: 'var(--text-main)', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', cursor: 'pointer' }}>Avbryt</button>
                        </div>
                      </div>
                    ) : !isDuplicateTitle ? (
                      <div style={{ color: 'var(--text-main)', lineHeight: '1.7', whiteSpace: 'pre-wrap', fontSize: isFirst ? '1.15rem' : '1.05rem', wordBreak: 'break-word', margin: 0 }}>
                        {post.content.includes('[citat]') ? (
                          (() => {
                            const parts = post.content.split(/\[citat\]|\[\/citat\]/);
                            return parts.map((part: string, i: number) => {
                              if (i === 1) return (
                                <div key={i} style={{ backgroundColor: '#f1f5f9', borderLeft: '4px solid var(--theme-forum)', padding: '1rem', margin: '1rem 0', fontStyle: 'italic', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                                  {mask(part.trim())}
                                </div>
                              );
                              return <span key={i}>{mask(part)}</span>;
                            });
                          })()
                        ) : mask(post.content)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
        })}
      </div>

      {/* Reply Area */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <MessageSquare size={24} color="var(--theme-forum)" /> Svara i tråden
        </h3>
        <textarea
          value={newReply}
          onChange={e => setNewReply(e.target.value)}
          placeholder="Skriv ditt svar här..."
          style={{ width: '100%', padding: '1.5rem', borderRadius: '12px', border: '2px solid var(--border-color)', outline: 'none', resize: 'vertical', minHeight: '150px', backgroundColor: 'white', fontSize: '1.05rem', transition: 'border-color 0.2s', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            onClick={handleReply}
            disabled={!newReply.trim()}
            style={{ 
              backgroundColor: 'var(--theme-forum)', 
              color: 'white', 
              padding: '0.875rem 2.5rem', 
              borderRadius: '99px', 
              border: 'none', 
              cursor: newReply.trim() ? 'pointer' : 'not-allowed', 
              fontWeight: '900', 
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <Send size={18} /> Publicera svar
          </button>
        </div>
      </div>

      {/* DUPLICATE WARNING MODAL */}
      {showDuplicateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowDuplicateModal(false)}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem 2rem', textAlign: 'center', borderRadius: '24px', position: 'relative', border: '2px solid #ef4444', animation: 'modalBounce 0.4s ease-out', backgroundColor: 'white' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '80px', height: '80px', backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <ShieldAlert size={40} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--text-main)' }}>Hoppsan! 👋</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '1.1rem', marginBottom: '2rem' }}>
              Du verkar posta samma sak många gånger. <br/><strong>Vänta lite eller skriv något nytt istället!</strong>
            </p>
            <button 
              onClick={() => setShowDuplicateModal(false)}
              style={{ width: '100%', backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '1rem', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
            >
              Jag fattar!
            </button>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {showReportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', borderRadius: '18px', backgroundColor: 'white' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}><AlertTriangle size={24}/> Anmäl Innehåll</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.85rem' }}>Vad gällar anmälan? Välj en kategori och beskriv kortfattat vad som är fel.</p>
            
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
              style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', marginBottom: '1rem', outline: 'none' }}
              placeholder="Beskriv problemet..."
            ></textarea>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => { setShowReportModal(false); setReportReason(''); setReportTarget(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-muted)' }}>Avbryt</button>
              <button 
                onClick={handleReport} 
                disabled={!reportReason.trim()} 
                style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: reportReason.trim() ? 'pointer' : 'not-allowed', opacity: reportReason.trim() ? 1 : 0.5 }}
              >
                Skicka Anmälan
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes modalBounce {
          0% { transform: scale(0.8); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
