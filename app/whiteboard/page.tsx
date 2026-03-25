"use client"

import { useState, useEffect } from 'react'
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, User, Send, AlertTriangle, Edit2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const WhiteboardSkeleton = () => (
   <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {[1, 2, 3].map(i => (
         <div key={i} className="card skeleton-pulse" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', minHeight: '200px', display: 'flex', flexDirection: 'column', padding: '1.5rem', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
               <div className="skeleton-pulse" style={{ width: '48px', height: '48px', borderRadius: '50%' }}></div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="skeleton-pulse" style={{ width: '120px', height: '20px' }}></div>
                  <div className="skeleton-pulse" style={{ width: '80px', height: '15px' }}></div>
               </div>
            </div>
            <div className="skeleton-pulse" style={{ width: '100%', height: '80px', borderRadius: '8px' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
               <div className="skeleton-pulse" style={{ width: '60px', height: '20px' }}></div>
               <div className="skeleton-pulse" style={{ width: '60px', height: '20px' }}></div>
               <div className="skeleton-pulse" style={{ width: '60px', height: '20px' }}></div>
            </div>
         </div>
      ))}
   </div>
);

export default function Whiteboard() {
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [newPostContent, setNewPostContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTarget, setReportTarget] = useState<any>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportCategory, setReportCategory] = useState('Spam')

  const [editingItem, setEditingItem] = useState<{ id: string, type: 'post' | 'comment', content: string } | null>(null)

  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchData()
    const channel = supabase.channel('realtime whiteboard complex')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whiteboard' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whiteboard_comments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whiteboard_likes' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    
    let currentProfile = null;
    let blockedUserIds: string[] = [];

    if (user) {
      const [profileRes, blocksRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_blocks').select('*').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
      ]);
      
      currentProfile = profileRes.data;
      setCurrentUser(currentProfile);
      
      if (blocksRes.data) {
        blocksRes.data.forEach(b => {
          blockedUserIds.push(b.blocker_id === user.id ? b.blocked_id : b.blocker_id);
        });
      }
    }

    let postsData = [];
    if (currentProfile) {
      // THE ALGORITHM 
      const { data } = await supabase.rpc('get_newsfeed', { viewer_id: currentProfile.id })
      if(data && data.length > 0) {
         const pIds = data.map((x:any) => x.id);
         const { data: enriched } = await supabase.from('whiteboard').select('*, profiles(username, avatar_url)').in('id', pIds).order('created_at', { ascending: false });
         if(enriched) postsData = enriched;
      }
    } else {
      const { data } = await supabase.from('whiteboard').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false }).limit(50);
      if (data) postsData = data;
    }

    if(postsData.length > 0) {
       let filteredPostsData = postsData.filter(p => !blockedUserIds.includes(p.author_id));
       const postIds = filteredPostsData.map(p => p.id);
       
       if (postIds.length > 0) {
         const { data: commentsData } = await supabase.from('whiteboard_comments').select('*, profiles(username, avatar_url)').in('post_id', postIds).order('created_at', { ascending: true });
         const commentIds = commentsData?.map(c => c.id) || [];
         
         let query = `post_id.in.(${postIds.join(',')})`;
         if (commentIds.length > 0) query += `,comment_id.in.(${commentIds.join(',')})`;
         
         const { data: likesData } = await supabase.from('whiteboard_likes').select('*, profiles(username)').or(query);

         const enrichedPosts = filteredPostsData.map(post => {
           const postLikes = likesData?.filter(l => l.post_id === post.id && !blockedUserIds.includes(l.user_id)) || [];
           const postComments = commentsData?.filter(c => c.post_id === post.id && !blockedUserIds.includes(c.author_id)).map(c => ({
              ...c,
              likes: likesData?.filter(l => l.comment_id === c.id && !blockedUserIds.includes(l.user_id)) || []
           })) || [];
           
           return {
             ...post,
             likes: postLikes,
             comments: postComments
           }
         });
         
         setPosts(enrichedPosts.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
       } else {
         setPosts([]);
       }
    } else {
       setPosts([]);
    }
    
    setLoading(false)
  }

  const handlePost = async () => {
    if (!newPostContent.trim() || !currentUser) return
    const { error } = await supabase.from('whiteboard').insert({
      author_id: currentUser.id,
      content: newPostContent
    })
    if (!error) setNewPostContent('')
    await fetchData();
  }

  const handleSaveEdit = async () => {
    if (!editingItem || !editingItem.content.trim()) return;
    const table = editingItem.type === 'post' ? 'whiteboard' : 'whiteboard_comments';
    await supabase.from(table).update({ content: editingItem.content.trim() }).eq('id', editingItem.id);
    setEditingItem(null);
    fetchData();
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('Vill du verkligen radera detta inlägg?')) return
    setPosts(prev => prev.filter(p => p.id !== postId))
    await supabase.from('whiteboard').delete().eq('id', postId)
  }
  
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Vill du verkligen radera denna kommentar?')) return
    
    // Optimistic UI update for instant feedback
    setPosts(prev => prev.map(p => ({
      ...p,
      comments: p.comments.filter((c: any) => c.id !== commentId)
    })))

    await supabase.from('whiteboard_comments').delete().eq('id', commentId)
  }

  const handleToggleLikePost = async (postId: string) => {
    if(!currentUser) return;
    const post = posts.find(p => p.id === postId);
    const hasLiked = post?.likes.some((l:any) => l.user_id === currentUser.id);
    
    if (hasLiked) {
      await supabase.from('whiteboard_likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
    } else {
      await supabase.from('whiteboard_likes').insert({ post_id: postId, user_id: currentUser.id });
      if (post && post.author_id !== currentUser.id) {
         await supabase.from('notifications').insert({
            receiver_id: post.author_id,
            actor_id: currentUser.id,
            type: 'whiteboard_like',
            content: 'gillade ditt inlägg på Whiteboarden.',
            link: `/whiteboard?post=${postId}`
         });
         fetch('/api/send-push', {
           method: 'POST', body: JSON.stringify({ userId: post.author_id, title: 'Facechat Whiteboard', message: `${currentUser.username} gillade ditt inlägg!`, url: `/whiteboard?post=${postId}` }), headers: { 'Content-Type': 'application/json' }
         }).catch(console.error);
      }
    }
    fetchData(); 
  }

  const handleToggleLikeComment = async (commentId: string) => {
    if(!currentUser) return;
    let targetComment: any = null;
    posts.forEach(p => {
       const found = p.comments.find((c:any) => c.id === commentId);
       if(found) targetComment = found;
    });
    
    const hasLiked = targetComment?.likes?.some((l:any) => l.user_id === currentUser.id);
    
    if (hasLiked) {
      await supabase.from('whiteboard_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id);
    } else {
      await supabase.from('whiteboard_likes').insert({ comment_id: commentId, user_id: currentUser.id });
      if (targetComment && targetComment.author_id !== currentUser.id) {
         await supabase.from('notifications').insert({
            receiver_id: targetComment.author_id,
            actor_id: currentUser.id,
            type: 'comment_like',
            content: 'gillade din kommentar på Whiteboarden.',
            link: `/whiteboard?post=${targetComment.post_id}`
         });
         fetch('/api/send-push', {
           method: 'POST', body: JSON.stringify({ userId: targetComment.author_id, title: 'Facechat Whiteboard', message: `${currentUser.username} gillade din kommentar!`, url: `/whiteboard?post=${targetComment.post_id}` }), headers: { 'Content-Type': 'application/json' }
         }).catch(console.error);
      }
    }
    fetchData();
  }
  
  const handlePostComment = async (postId: string) => {
    const txt = commentInputs[postId];
    if(!txt?.trim() || !currentUser) return;
    
    await supabase.from('whiteboard_comments').insert({
       post_id: postId,
       author_id: currentUser.id,
       content: txt.trim()
    });
    
    const post = posts.find(p => p.id === postId);
    if (post) {
       let preview = txt.trim();
       if (preview.length > 20) preview = preview.substring(0, 20) + '...';

       const usersToNotify = new Set<string>();
       usersToNotify.add(post.author_id);
       if (post.comments) {
          post.comments.forEach((c: any) => {
             if (c.author_id) usersToNotify.add(c.author_id);
          });
       }
       usersToNotify.delete(currentUser.id);

       if (usersToNotify.size > 0) {
          for (const uid of Array.from(usersToNotify)) {
             const isPostAuthor = uid === post.author_id;
             const contentMsg = isPostAuthor ? `kommenterade ditt inlägg: "${preview}"` : `svarade i en tråd du har kommenterat: "${preview}"`;
             
             await supabase.from('notifications').insert({
                receiver_id: uid,
                actor_id: currentUser.id,
                type: 'whiteboard_comment',
                content: contentMsg,
                link: `/whiteboard?post=${postId}`
             });
             
             fetch('/api/send-push', {
               method: 'POST', 
               body: JSON.stringify({ 
                 userId: uid, 
                 title: 'Facechat Whiteboard', 
                 message: `${currentUser.username} ${contentMsg}`, 
                 url: `/whiteboard?post=${postId}` 
               }), 
               headers: { 'Content-Type': 'application/json' }
             }).catch(console.error);
          }
       }
    }

    setCommentInputs({ ...commentInputs, [postId]: '' });
    await fetchData();
  }

  const handleSharePost = async (post: any) => {
    if (!currentUser) return;
    if (confirm(`Vill du dela inlägget från ${post.profiles?.username} på din egen Whiteboard?`)) {
       const shareContent = `[Delat från ${post.profiles?.username}]:\n\n"${post.content}"`;
       const { error } = await supabase.from('whiteboard').insert({
         author_id: currentUser.id,
         content: shareContent
       });
       if (!error) {
         if (post.author_id !== currentUser.id) {
           await supabase.from('notifications').insert({
              receiver_id: post.author_id,
              actor_id: currentUser.id,
              type: 'whiteboard_share',
              content: 'delade ditt inlägg på Whiteboarden.',
              link: `/whiteboard?post=${post.id}`
           });
           fetch('/api/send-push', {
             method: 'POST', body: JSON.stringify({ userId: post.author_id, title: 'Facechat Whiteboard', message: `${currentUser.username} delade ditt inlägg!`, url: `/whiteboard?post=${post.id}` }), headers: { 'Content-Type': 'application/json' }
           }).catch(console.error);
         }
         fetchData();
         alert('Inlägget har delats friskt på din Whiteboard!');
       }
    }
  }

  const renderLikeText = (likesArr: any[]) => {
    if(!likesArr || likesArr.length === 0) return null;
    const names = likesArr.map(l => l.profiles?.username).filter(Boolean);
    if(names.length === 1) return `Gillat av ${names[0]}`;
    if(names.length === 2) return `${names[0]} och ${names[1]} gillar detta`;
    return `${names[0]}, ${names[1]} och ${names.length - 2} andra gillar detta`;
  }

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

    // Notifiera alla administratörer om den nya anmälan!
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
                message: `${currentUser.username} har gjort en anmälan på Whiteboard.`,
                url: '/admin?tab=reports'
              }), headers: { 'Content-Type': 'application/json' }
            });
          });
        }
      }
    } catch (notifErr) {
      console.error("Misslyckades att notifiera admins från Whiteboard:", notifErr);
    }

    alert('Din anmälan har skickat till våra moderatorer. Tack!');
    setShowReportModal(false);
    setReportReason('');
    setReportCategory('Spam');
    setReportTarget(null);
  };

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem', color: 'var(--theme-primary)', fontWeight: '700' }}>
        Whiteboard (Nyhetsflöde)
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Dina inlägg, dina vänners inlägg, och vad de gillar.</p>
      
      {/* Skapa inlägg */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--theme-primary)', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden', flexShrink: 0 }}>
          {currentUser?.avatar_url ? <img src={currentUser.avatar_url} alt="Profile" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <User size={24} />}
        </div>
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <textarea 
            placeholder="Vad har du på hjärtat?" 
            value={newPostContent}
            onChange={e => setNewPostContent(e.target.value)}
            style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
          ></textarea>
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <button onClick={handlePost} disabled={!newPostContent.trim()} style={{ padding: '0.875rem 3rem', backgroundColor: 'var(--theme-primary)', color: 'white', borderRadius: '8px', fontWeight: 'bold', opacity: !newPostContent.trim() ? 0.5 : 1, cursor: 'pointer', border: 'none', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}>Posta</button>
          </div>
        </div>
      </div>

      {/* Flöde */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {loading && <WhiteboardSkeleton />}
        {!loading && posts.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Inga inlägg hittades i din nätverksson. Bli den första att skriva något!</p>}
        
        {posts.map(post => {
          const isOwnPost = currentUser?.id === post.author_id;
          const isAdmin = currentUser?.is_admin;
          const timeString = new Date(post.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date(post.created_at).toLocaleDateString('sv-SE');
          const iLiked = post.likes?.some((l:any) => l.user_id === currentUser?.id);
          const showComments = activeCommentPostId === post.id || post.comments.length > 0;

          return (
            <div key={post.id} className="wb-post-card" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0', backgroundColor: 'var(--bg-card)', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              
              {/* POST HEADER & CONTENT */}
              <div className="wb-post-inner" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', backgroundColor: '#e2e8f0', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer' }} onClick={() => window.location.href = `/krypin?u=${post.profiles?.username}`}>
                      {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <User size={24} color="#94a3b8" style={{margin:'12px'}}/>}
                    </div>
                    <div>
                      <span className="user-link" onClick={() => window.location.href = `/krypin?u=${post.profiles?.username}`} style={{ margin: 0, fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}>{post.profiles?.username || 'Okänd Användare'}</span>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{timeString}</p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {isOwnPost && (
                      <button onClick={() => setEditingItem({ id: post.id, type: 'post', content: post.content })} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8 }} title="Redigera inlägg">
                        <Edit2 size={16} />
                      </button>
                    )}
                    {(isOwnPost || isAdmin) && (
                      <button onClick={() => handleDelete(post.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }} title="Radera inlägg">
                        <Trash2 size={18} />
                      </button>
                    )}
                    {!isOwnPost && (
                      <button onClick={() => { setReportTarget({ id: post.id, type: 'whiteboard', reportedUserId: post.author_id }); setShowReportModal(true); }} style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8 }} title="Anmäl inlägg">
                        <AlertTriangle size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                {editingItem?.id === post.id && editingItem?.type === 'post' ? (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <textarea 
                      value={editingItem.content} 
                      onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button onClick={handleSaveEdit} style={{ backgroundColor: '#10b981', color: 'white', padding: '0.25rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Spara</button>
                      <button onClick={() => setEditingItem(null)} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.25rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Avbryt</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '1.5rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{post.content}</p>
                )}
                
                {post.likes && post.likes.length > 0 && (
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Heart size={12} fill="var(--theme-primary)" color="var(--theme-primary)" /> 
                      {renderLikeText(post.likes)}
                   </p>
                )}

                {/* POST ACTIONS */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <button onClick={() => handleToggleLikePost(post.id)} style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: iLiked ? 'var(--theme-primary)' : 'var(--text-muted)', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }} className="hover-lift">
                    <Heart size={20} fill={iLiked ? 'var(--theme-primary)' : 'none'} /> <span className="hide-on-very-small">Gilla</span>
                  </button>
                  <button onClick={() => setActiveCommentPostId(post.id)} style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }} className="hover-lift">
                    <MessageCircle size={20} /> <span className="hide-on-very-small">Kommentera {post.comments?.length > 0 && `(${post.comments.length})`}</span>{post.comments?.length > 0 && <span className="show-on-very-small-only" style={{display:'none'}}>{post.comments.length}</span>}
                  </button>
                  <button onClick={() => handleSharePost(post)} style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }} className="hover-lift">
                    <Share2 size={20} /> <span className="hide-on-very-small">Dela</span>
                  </button>
                </div>
              </div>

              {/* COMMENTS SECTION (Toggled or visible if exists) */}
              {showComments && (
                 <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    
                    {/* Render existing comments */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                       {post.comments?.map((comment: any) => {
                          const cLiked = comment.likes?.some((l:any) => l.user_id === currentUser?.id);
                          const cOwn = comment.author_id === currentUser?.id;
                          return (
                             <div key={comment.id} style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }} onClick={() => window.location.href = `/krypin?u=${comment.profiles?.username}`}>
                                   {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <User size={16} color="#94a3b8" style={{margin:'8px'}}/>}
                                </div>
                                <div style={{ flex: 1 }}>
                                   <div style={{ backgroundColor: '#e2e8f0', padding: '0.75rem 1rem', borderRadius: '12px', display: 'inline-block' }}>
                                     <span className="user-link" onClick={() => window.location.href = `/krypin?u=${comment.profiles?.username}`} style={{ fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', display: 'block', marginBottom: '0.2rem' }}>{comment.profiles?.username || 'Okänd'}</span>
                                     {editingItem?.id === comment.id && editingItem?.type === 'comment' ? (
                                       <div style={{ marginTop: '0.5rem' }}>
                                         <textarea 
                                           value={editingItem.content} 
                                           onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                                           style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', resize: 'vertical', minHeight: '50px', fontFamily: 'inherit' }}
                                         />
                                         <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                           <button onClick={handleSaveEdit} style={{ backgroundColor: '#10b981', color: 'white', padding: '0.2rem 0.75rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Spara</button>
                                           <button onClick={() => setEditingItem(null)} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.2rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Avbryt</button>
                                         </div>
                                       </div>
                                     ) : (
                                       <span style={{ fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{comment.content}</span>
                                     )}
                                   </div>
                                   <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.4rem', marginLeft: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                      <span onClick={() => handleToggleLikeComment(comment.id)} style={{ color: cLiked ? 'var(--theme-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>Gilla</span>
                                      <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>{new Date(comment.created_at).toLocaleTimeString('sv-SE', {hour:'2-digit', minute:'2-digit'})}</span>
                                      {comment.likes?.length > 0 && (
                                         <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Heart size={10} fill="var(--text-muted)" /> {comment.likes.length}</span>
                                      )}
                                      {cOwn && <span onClick={() => setEditingItem({ id: comment.id, type: 'comment', content: comment.content })} style={{ color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.8 }} title="Redigera">Redigera</span>}
                                      {(cOwn || isAdmin) && <span onClick={() => handleDeleteComment(comment.id)} style={{ color: '#ef4444', cursor: 'pointer', opacity: 0.8 }} title="Radera">Ta bort</span>}
                                      {!cOwn && <span onClick={() => { setReportTarget({ id: comment.id, type: 'whiteboard_comment', reportedUserId: comment.author_id }); setShowReportModal(true); }} style={{ color: '#f59e0b', cursor: 'pointer', opacity: 0.8 }} title="Anmäl">Anmäl</span>}
                                   </div>
                                </div>
                             </div>
                          )
                       })}
                    </div>

                    {/* Write new comment */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                       <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--theme-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {currentUser?.avatar_url ? <img src={currentUser.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <User size={16}/>}
                       </div>
                       <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            placeholder="Skriv en kommentar..."
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => setCommentInputs({...commentInputs, [post.id]: e.target.value})}
                            onKeyDown={e => e.key === 'Enter' && handlePostComment(post.id)}
                            style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: '999px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white' }}
                          />
                          <button onClick={() => handlePostComment(post.id)} disabled={!commentInputs[post.id]?.trim()} style={{ background: 'var(--theme-primary)', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: commentInputs[post.id]?.trim() ? 'pointer' : 'not-allowed', opacity: commentInputs[post.id]?.trim() ? 1 : 0.5 }}>
                            <Send size={16} style={{ marginLeft: '-2px' }} />
                          </button>
                       </div>
                    </div>
                 </div>
              )}

            </div>
          )
        })}
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
  )
}
