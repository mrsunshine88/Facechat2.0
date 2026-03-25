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
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({}) // Track which posts show all comments
  const [showLikersPostId, setShowLikersPostId] = useState<string | null>(null) // Track which post's likers list is visible
  
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
        supabase.from('profiles').select('*').eq('id', user.id).limit(1),
        supabase.from('user_blocks').select('*').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
      ]);
      
      currentProfile = profileRes.data && profileRes.data.length > 0 ? profileRes.data[0] : null;
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

    // Resolve parent_posts if they exist
    const parentPostIds = postsData.map(p => p.parent_id).filter(Boolean);
    let resolvedParentPosts: any[] = [];
    if (parentPostIds.length > 0) {
      const { data: parents } = await supabase.from('whiteboard').select('*, profiles(username, avatar_url)').in('id', parentPostIds);
      if (parents) resolvedParentPosts = parents;
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
           
           const parent_post = resolvedParentPosts.find(pp => pp.id === post.parent_id);
           
           return {
             ...post,
             likes: postLikes,
             comments: postComments,
             parent_post: parent_post
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
    
    // Facebook style share: Store original ID but allow a personal caption
    const caption = prompt(`Skriv något om detta inlägg (valfritt):`, "");
    if (caption === null) return; // Cancelled

    const { error } = await supabase.from('whiteboard').insert({
      author_id: currentUser.id,
      content: caption.trim() || "", // Caption can be empty
      parent_id: post.parent_id || post.id // Always reference original if multiple shares
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
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#1c1e21', fontWeight: '800', letterSpacing: '-0.02em' }}>
        Whiteboard
      </h1>
      <p style={{ color: '#65676b', marginBottom: '2rem', fontSize: '0.9rem' }}>Se vad som händer i ditt nätverk just nu.</p>
      
      <style>{`
        .fb-action-btn:hover {
          background-color: #f2f2f2 !important;
        }
        .wb-post-card {
          transition: transform 0.1s ease;
        }
        .user-link:hover {
          text-decoration: underline !important;
        }
        .skeleton-pulse {
          background: linear-gradient(90deg, #f0f2f5 25%, #e2e8f0 50%, #f0f2f5 75%);
          background-size: 200% 100%;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 600px) {
          .card {
            padding: 1rem !important;
          }
          .wb-post-inner {
            padding: 0.75rem !important;
          }
          .fb-action-btn {
            font-size: 0.8rem !important;
            padding: 0.4rem !important;
          }
        }
      `}</style>
      
      {/* Skapa inlägg (Facebook style) */}
      <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #dddfe2', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--theme-primary)', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden', flexShrink: 0 }}>
            {currentUser?.avatar_url ? <img src={currentUser.avatar_url} alt="Profile" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <User size={20} />}
          </div>
          <button 
            onClick={() => document.getElementById('wb-textarea')?.focus()}
            style={{ flex: 1, backgroundColor: '#f0f2f5', border: 'none', borderRadius: '20px', padding: '0.6rem 1rem', textAlign: 'left', color: '#65676b', fontSize: '1rem', cursor: 'pointer' }}
          >
            Vad har du på hjärtat, {currentUser?.username || 'vän'}?
          </button>
        </div>
        
        <div id="wb-expanded-post" style={{ display: newPostContent.trim() ? 'block' : 'none' }}>
          <textarea 
            id="wb-textarea"
            placeholder="Skriv något..." 
            value={newPostContent}
            onChange={e => setNewPostContent(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dddfe2', outline: 'none', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit', marginBottom: '0.75rem', fontSize: '1rem' }}
          ></textarea>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={handlePost} 
              disabled={!newPostContent.trim()} 
              style={{ padding: '0.5rem 2.5rem', backgroundColor: '#1877f2', color: 'white', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none', fontSize: '0.95rem' }}
            >
              Posta
            </button>
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
          
          // Comment folding logic
          const allComments = post.comments || [];
          const isExpanded = expandedComments[post.id];
          const visibleComments = isExpanded ? allComments : allComments.slice(-2);
          const hasMoreComments = allComments.length > 2;

          return (
            <div key={post.id} className="wb-post-card" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0', backgroundColor: 'white', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1rem' }}>
              
              {/* POST HEADER */}
              <div className="wb-post-inner" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer' }} onClick={() => window.location.href = `/krypin?u=${post.profiles?.username}`}>
                      {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <User size={20} color="#94a3b8" style={{margin:'10px'}}/>}
                    </div>
                    <div>
                      <span className="user-link" onClick={() => window.location.href = `/krypin?u=${post.profiles?.username}`} style={{ margin: 0, fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', color: '#1c1e21' }}>{post.profiles?.username || 'Okänd Användare'}</span>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#65676b' }}>{timeString} {post.parent_id && "• Delade ett inlägg"}</p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', opacity: 0.6 }}>
                    {isOwnPost && (
                      <button onClick={() => setEditingItem({ id: post.id, type: 'post', content: post.content })} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }} title="Redigera inlägg">
                        <Edit2 size={14} />
                      </button>
                    )}
                    {(isOwnPost || isAdmin) && (
                      <button onClick={() => handleDelete(post.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} title="Radera inlägg">
                        <Trash2 size={16} />
                      </button>
                    )}
                    {!isOwnPost && (
                      <button onClick={() => { setReportTarget({ id: post.id, type: 'whiteboard', reportedUserId: post.author_id }); setShowReportModal(true); }} style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }} title="Anmäl inlägg">
                        <AlertTriangle size={16} />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* POST CONTENT */}
                <div style={{ marginBottom: '0.75rem' }}>
                  {editingItem?.id === post.id && editingItem?.type === 'post' ? (
                    <div style={{ marginBottom: '1rem' }}>
                      <textarea 
                        value={editingItem.content} 
                        onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button onClick={handleSaveEdit} style={{ backgroundColor: '#10b981', color: 'white', padding: '0.25rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Spara</button>
                        <button onClick={() => setEditingItem(null)} style={{ backgroundColor: 'white', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.25rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.content && <p style={{ color: '#1c1e21', fontSize: '0.95rem', marginBottom: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{post.content}</p>}
                      
                      {/* NESTED SHARED POST */}
                      {post.parent_post && (
                        <div style={{ border: '1px solid #dddfe2', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white', marginTop: '0.5rem' }}>
                          <div style={{ padding: '0.75rem' }}>
                             <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                   {post.parent_post.profiles?.avatar_url ? <img src={post.parent_post.profiles.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <User size={16} color="#94a3b8" style={{margin:'8px'}}/>}
                                </div>
                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{post.parent_post.profiles?.username || 'Okänd'}</span>
                             </div>
                             <p style={{ fontSize: '0.9rem', color: '#1c1e21', margin: 0, whiteSpace: 'pre-wrap' }}>{post.parent_post.content}</p>
                          </div>
                        </div>
                      )}

                      {!post.parent_post && post.parent_id && (
                        <div style={{ padding: '1rem', backgroundColor: '#f0f2f5', borderRadius: '8px', fontSize: '0.85rem', color: '#65676b', fontStyle: 'italic' }}>
                          Originalinlägget har tagits bort.
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* LIKE & SHARE STATS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '0.85rem', color: '#65676b', borderBottom: '1px solid #ebedf0' }}>
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                    onClick={() => setShowLikersPostId(showLikersPostId === post.id ? null : post.id)}
                  >
                    {post.likes && post.likes.length > 0 && (
                      <>
                        <div style={{ backgroundColor: '#1877f2', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Heart size={10} color="white" fill="white" />
                        </div>
                        <span> {post.likes.length} {post.likes.length === 1 ? 'person gillar' : 'personer gillar'} detta</span>
                      </>
                    )}
                  </div>
                  <div>
                    {post.comments?.length > 0 && <span>{post.comments.length} kommentarer</span>}
                    {post.shares_count > 0 && <span> • {post.shares_count} delningar</span>}
                  </div>
                </div>
                
                {/* LIKERS LIST DROPDOWN (Toggleable) */}
                {showLikersPostId === post.id && post.likes && post.likes.length > 0 && (
                  <div style={{ backgroundColor: '#f0f2f5', padding: '0.5rem', borderRadius: '8px', marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 'bold' }}>Gillat av:</span>
                    {post.likes.map((l:any, idx:number) => (
                      <span key={l.id} style={{ color: '#1877f2' }}>{l.profiles?.username}{idx < post.likes.length - 1 ? ',' : ''}</span>
                    ))}
                  </div>
                )}

                {/* POST ACTIONS */}
                <div style={{ display: 'flex', justifyContent: 'space-around', gap: '0.25rem', paddingTop: '0.25rem' }}>
                  <button onClick={() => handleToggleLikePost(post.id)} style={{ flex: 1, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: iLiked ? '#1877f2' : '#65676b', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }} className="fb-action-btn">
                    <Heart size={18} fill={iLiked ? '#1877f2' : 'none'} color={iLiked ? '#1877f2' : '#65676b'} /> Gilla
                  </button>
                  <button onClick={() => setActiveCommentPostId(post.id)} style={{ flex: 1, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#65676b', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }} className="fb-action-btn">
                    <MessageCircle size={18} /> Kommentera
                  </button>
                  <button onClick={() => handleSharePost(post)} style={{ flex: 1, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#65676b', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }} className="fb-action-btn">
                    <Share2 size={18} /> Dela
                  </button>
                </div>
              </div>

              {/* COMMENTS SECTION */}
              {(allComments.length > 0 || activeCommentPostId === post.id) && (
                 <div style={{ backgroundColor: '#f0f2f5', padding: '0.75rem 1rem', borderTop: '1px solid #ebedf0' }}>
                    
                    {/* Show more comments button */}
                    {hasMoreComments && !isExpanded && (
                      <button 
                        onClick={() => setExpandedComments({...expandedComments, [post.id]: true})}
                        style={{ border: 'none', background: 'none', color: '#65676b', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1rem', padding: 0 }}
                      >
                        Visa {allComments.length - 2} tidigare kommentarer...
                      </button>
                    )}

                    {/* Render comments */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
                       {visibleComments.map((comment: any) => {
                          const cLiked = comment.likes?.some((l:any) => l.user_id === currentUser?.id);
                          const cOwn = comment.author_id === currentUser?.id;
                          return (
                             <div key={comment.id} style={{ display: 'flex', gap: '0.5rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }} onClick={() => window.location.href = `/krypin?u=${comment.profiles?.username}`}>
                                   {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <User size={16} color="#94a3b8" style={{margin:'8px'}}/>}
                                </div>
                                <div style={{ flex: 1 }}>
                                   <div style={{ backgroundColor: 'white', padding: '0.5rem 0.75rem', borderRadius: '18px', display: 'inline-block', maxWidth: '100%', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                     <span className="user-link" onClick={() => window.location.href = `/krypin?u=${comment.profiles?.username}`} style={{ fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', display: 'block', color: '#050505' }}>{comment.profiles?.username || 'Okänd'}</span>
                                     {editingItem?.id === comment.id && editingItem?.type === 'comment' ? (
                                       <div style={{ marginTop: '0.4rem' }}>
                                         <textarea 
                                           value={editingItem.content} 
                                           onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                                           style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', resize: 'vertical', minHeight: '40px', fontSize: '0.85rem' }}
                                         />
                                         <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                                           <button onClick={handleSaveEdit} style={{ backgroundColor: '#1877f2', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Spara</button>
                                           <button onClick={() => setEditingItem(null)} style={{ backgroundColor: 'white', color: 'black', border: '1px solid #ddd', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Avbryt</button>
                                         </div>
                                       </div>
                                     ) : (
                                       <span style={{ fontSize: '0.9rem', color: '#050505', whiteSpace: 'pre-wrap' }}>{comment.content}</span>
                                     )}
                                   </div>
                                   <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.2rem', marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#65676b' }}>
                                      <span onClick={() => handleToggleLikeComment(comment.id)} style={{ color: cLiked ? '#1877f2' : 'inherit', cursor: 'pointer' }}>Gilla</span>
                                      <span style={{ fontWeight: 'normal' }}>{new Date(comment.created_at).toLocaleTimeString('sv-SE', {hour:'2-digit', minute:'2-digit'})}</span>
                                      {comment.likes?.length > 0 && (
                                         <span style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}><Heart size={10} fill="#65676b" color="#65676b" /> {comment.likes.length}</span>
                                      )}
                                      {cOwn && <span onClick={() => setEditingItem({ id: comment.id, type: 'comment', content: comment.content })} style={{ cursor: 'pointer' }}>Ändra</span>}
                                      {(cOwn || isAdmin) && <span onClick={() => handleDeleteComment(comment.id)} style={{ color: '#ef4444', cursor: 'pointer' }}>Radera</span>}
                                   </div>
                                </div>
                             </div>
                          )
                       })}
                    </div>

                    {/* Write new comment */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                       <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--theme-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {currentUser?.avatar_url ? <img src={currentUser.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <User size={16}/>}
                       </div>
                       <div style={{ flex: 1, display: 'flex', gap: '0.4rem', position: 'relative' }}>
                          <input 
                            type="text" 
                            placeholder={`Kommentera som ${currentUser?.username}...`}
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => setCommentInputs({...commentInputs, [post.id]: e.target.value})}
                            onKeyDown={e => e.key === 'Enter' && handlePostComment(post.id)}
                            style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid #dddfe2', outline: 'none', backgroundColor: '#f0f2f5', fontSize: '0.9rem' }}
                          />
                          <button onClick={() => handlePostComment(post.id)} disabled={!commentInputs[post.id]?.trim()} style={{ background: 'none', border: 'none', color: commentInputs[post.id]?.trim() ? '#1877f2' : '#bcc0c4', cursor: commentInputs[post.id]?.trim() ? 'pointer' : 'not-allowed' }}>
                            <Send size={18} />
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
