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
  Loader2
} from 'lucide-react'
import React from 'react'

export default function ForumThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [thread, setThread] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newReply, setNewReply] = useState('')
  const [editingPost, setEditingPost] = useState<{ id: string, content: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTarget, setReportTarget] = useState<any>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportCategory, setReportCategory] = useState('Spam')

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
           user_id: quotedId,
           type: 'forum_quote',
           content: `${currentUser.username} citerade dig i tråden "${thread?.title}"`,
           link: `/forum/${id}#post-${newPost.id}`
         });
       }

       // 4. Notifiera trådstartaren (om det inte var vi eller den citerade)
       if (thread?.author_id && thread.author_id !== currentUser.id && thread.author_id !== quotedId) {
          await supabase.from('notifications').insert({
            user_id: thread.author_id,
            type: 'forum_reply',
            content: `${currentUser.username} svarade i din tråd "${thread?.title}"`,
            link: `/forum/${id}#post-${newPost.id}`
          });
       }

       // 5. Notifiera övriga deltagare
       for (const pid of participantIds) {
         if (pid !== quotedId && pid !== thread?.author_id) {
           await supabase.from('notifications').insert({
             user_id: pid,
             type: 'forum_activity',
             content: `Ny aktivitet i tråden "${thread?.title}"`,
             link: `/forum/${id}#post-${newPost.id}`
           });
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
    await supabase.from('forum_posts')
      .update({ content: editingPost.content })
      .eq('id', editingPost.id)
    setEditingPost(null)
    fetchThread()
  }

  const handleReport = async () => {
    if (!reportReason.trim() || !currentUser) return;
    
    await supabase.from('reports').insert({
      reporter_id: currentUser.id,
      reported_user_id: reportTarget.reportedUserId,
      item_type: reportTarget.type,
      item_id: reportTarget.id,
      reason: reportReason,
      category: reportCategory,
      status: 'open',
      reported_content: posts.find(p => p.id === reportTarget.id)?.content || thread?.title || ''
    });

    alert('Din anmälan har skickat till våra moderatorer. Tack!');
    setShowReportModal(false);
    setReportReason('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <Loader2 className="animate-spin" size={48} color="var(--theme-forum)" />
        <p style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Laddar...</p>
      </div>
    )
  }

  if (!thread) return <div style={{ padding: '2rem', textAlign: 'center' }}>Tråden hittades inte.</div>

  const threadDateStr = thread.created_at ? new Date(thread.created_at).toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' }) : '...';

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
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Accent strip */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: 'var(--theme-forum)' }}></div>

        {/* Left Side: Title and Meta */}
        <div style={{ flex: 1 }}>
           <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: '1.1', marginBottom: '1rem' }}>
             {thread.title}
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
             
             {/* ACTIONS MOVED TO HEADER */}
             {posts[0] && (
               <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                 <button 
                   onClick={() => { setNewReply(`[citat]${thread.title}[/citat]\n`); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }}
                   style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600' }}
                 >
                   <MessageSquare size={14} /> Citera
                 </button>
                 {(currentUser?.id === posts[0].author_id) && (
                   <button 
                     onClick={() => setEditingPost({ id: posts[0].id, content: posts[0].content })}
                     style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600' }}
                   >
                     <Edit2 size={14} /> Ändra
                   </button>
                 )}
                 {(currentUser?.id === posts[0].author_id || currentUser?.is_admin) && (
                   <button 
                     onClick={() => handleDeleteThread()}
                     style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600' }}
                   >
                     <Trash2 size={14} /> Radera
                   </button>
                 )}
               </div>
             )}
           </div>
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

            const isMobile = windowWidth < 768;

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
                                  {part.trim()}
                                </div>
                              );
                              return <span key={i}>{part}</span>;
                            });
                          })()
                        ) : post.content}
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
    </div>
  )
}
