"use client"

import { useState, useEffect } from 'react'
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, User, Send, AlertTriangle, Edit2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useWordFilter } from '@/hooks/useWordFilter'
import { useUser } from '@/components/UserContext'

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
  const { mask } = useWordFilter()
  const { profile: currentUser, loading: userLoading } = useUser()
  const [posts, setPosts] = useState<any[]>([])
  const [newPostContent, setNewPostContent] = useState('')
  
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportTarget, setReportTarget] = useState<any>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportCategory, setReportCategory] = useState('Spam')

  const [editingItem, setEditingItem] = useState<{ id: string, type: 'post' | 'comment', content: string } | null>(null)

  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({}) // Track which posts show all comments
  const [showLikersPostId, setShowLikersPostId] = useState<string | null>(null) // Track which post's likers list is visible
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // -- PHASE 3: INFINITE SCROLL STATES --
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const LIMIT = 15;

  const supabase = createClient()


  useEffect(() => {
    if (userLoading) return;
    fetchData(0, true);

    const channel = supabase.channel('realtime whiteboard optimized')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whiteboard' }, (payload) => {
         // Prepend new posts if they are from friends or us (handled by fetchSinglePost check or just re-fetch first page)
         fetchData(0, true); 
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'whiteboard' }, (payload) => {
         setPosts(prev => prev.filter(p => p.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whiteboard_comments' }, (payload: any) => {
         const postId = payload.new?.post_id || payload.old?.post_id;
         if (postId) fetchSinglePost(postId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whiteboard_likes' }, (payload: any) => {
         const postId = payload.new?.post_id || payload.old?.post_id;
         if (postId) fetchSinglePost(postId);
         else if (payload.new?.comment_id || payload.old?.comment_id) {
           // If comment like, we need to find which post the comment belongs to. 
           // For simplicity in this case, we re-fetch the affected post if we can find it.
           const commentId = payload.new?.comment_id || payload.old?.comment_id;
           setPosts(prev => {
             const post = prev.find(p => p.comments?.some((c: any) => c.id === commentId));
             if (post) fetchSinglePost(post.id);
             return prev;
           });
         }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userLoading, supabase])



  async function fetchData(pageToLoad = 0, isInitial = false) {
    if (isFetchingMore && !isInitial) return;
    if (!isInitial) setIsFetchingMore(true);
    
    const profileToUse = currentUser;
    let blockedUserIds: string[] = [];

    if (profileToUse) {
      const { data: blocksRes } = await supabase.from('user_blocks').select('*').or(`blocker_id.eq.${profileToUse.id},blocked_id.eq.${profileToUse.id}`);
      
      if (blocksRes) {
        blocksRes.forEach((b: any) => {
          blockedUserIds.push(b.blocker_id === profileToUse.id ? b.blocked_id : b.blocker_id);
        });
      }

    }

    let postsData = [];
    if (profileToUse) {
      // PHASE 3: Call RPC with pagination params
      const { data, error: rpcErr } = await supabase.rpc('get_newsfeed', { 
        viewer_id: profileToUse.id, 
        limit_val: LIMIT, 
        offset_val: pageToLoad * LIMIT 
      })
      
      if (rpcErr) console.error("RPC Error:", rpcErr);
      
      if(data && data.length > 0) {
         const pIds = data.map((x:any) => x.id);
         const { data: enriched } = await supabase.from('whiteboard').select('*, profiles(username, avatar_url)').in('id', pIds).order('created_at', { ascending: false });
         if(enriched) postsData = enriched;
         
         // Update hasMore
         if (data.length < LIMIT) setHasMore(false);
         else setHasMore(true);
      } else {
         setHasMore(false);
      }
    } else {
      const { data } = await supabase.from('whiteboard').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false }).range(pageToLoad * LIMIT, (pageToLoad + 1) * LIMIT - 1);
      if (data) {
        postsData = data;
        if (data.length < LIMIT) setHasMore(false);
        else setHasMore(true);
      } else {
        setHasMore(false);
      }
    }

    const parentPostIds = postsData.map(p => p.parent_id).filter(Boolean);
    let resolvedParentPosts: any[] = [];
    if (parentPostIds.length > 0) {
      const { data: parents } = await supabase.from('whiteboard').select('*, profiles(username, avatar_url)').in('id', parentPostIds);
      if (parents) resolvedParentPosts = parents;
    }

    if(postsData.length > 0) {
       let filteredPostsData = postsData.filter((p: any) => !blockedUserIds.includes(p.author_id));
       const postIds = filteredPostsData.map((p: any) => p.id);
       
       if (postIds.length > 0) {
         const { data: commentsData } = await supabase.from('whiteboard_comments').select('*, profiles(username, avatar_url)').in('post_id', postIds).order('created_at', { ascending: true });
         const commentIds = commentsData?.map((c: any) => c.id) || [];
         
         let query = `post_id.in.(${postIds.join(',')})`;
         if (commentIds.length > 0) query += `,comment_id.in.(${commentIds.join(',')})`;
         
         const { data: likesData } = await supabase.from('whiteboard_likes').select('*, profiles(username)').or(query);

         const enrichedPosts = filteredPostsData.map((post: any) => {
           const postLikes = likesData?.filter((l: any) => l.post_id === post.id && !blockedUserIds.includes(l.user_id)) || [];
           const postComments = commentsData?.filter((c: any) => c.post_id === post.id && !blockedUserIds.includes(c.author_id)).map((c: any) => ({
              ...c,
              likes: likesData?.filter((l: any) => l.comment_id === c.id && !blockedUserIds.includes(l.user_id)) || []
           })) || [];
           
           const parent_post = resolvedParentPosts.find((pp: any) => pp.id === post.parent_id);
           
           return {
             ...post,
             likes: postLikes,
             comments: postComments,
             parent_post: parent_post
           }
         });
         
         const sorted = enrichedPosts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

         
         if (isInitial) {
           setPosts(sorted);
           setPage(0);
         } else {
           // Prevent duplicates if RT triggered a fetch during scroll
           setPosts(prev => {
             const existingIds = new Set(prev.map((p: any) => p.id));
             const uniqueNew = sorted.filter((p: any) => !existingIds.has(p.id));
             return [...prev, ...uniqueNew];
           });

         }
       }
    }
    
    setIsFetchingMore(false);
  }

  async function fetchSinglePost(postId: string) {
    // Phase 3: Optimized fetch for a single item update
    const { data: postsData } = await supabase.from('whiteboard').select('*, profiles(username, avatar_url)').eq('id', postId);
    if (!postsData || postsData.length === 0) return;
    
    const post = postsData[0];
    const { data: commentsData } = await supabase.from('whiteboard_comments').select('*, profiles(username, avatar_url)').eq('post_id', postId).order('created_at', { ascending: true });
    const commentIds = commentsData?.map((c: any) => c.id) || [];
    
    let query = `post_id.eq.${postId}`;
    if (commentIds.length > 0) query += `,comment_id.in.(${commentIds.join(',')})`;
    const { data: likesData } = await supabase.from('whiteboard_likes').select('*, profiles(username)').or(query);

    const enriched = {
      ...post,
      likes: likesData?.filter((l: any) => l.post_id === post.id) || [],
      comments: commentsData?.map((c:any) => ({
        ...c,
        likes: likesData?.filter((l: any) => l.comment_id === c.id) || []
      })) || [],
      parent_post: post.parent_id ? (await supabase.from('whiteboard').select('*, profiles(username, avatar_url)').eq('id', post.parent_id).single()).data : null
    };

    setPosts(prev => prev.map(p => p.id === postId ? enriched : p));
  }


  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage, false);
  };


  const handlePost = async () => {
    if (!newPostContent.trim() || !currentUser || isSending) return
    setIsSending(true);
    const { error } = await supabase.from('whiteboard').insert({
      author_id: currentUser.id,
      content: newPostContent
    })

    if (error) {
       setIsSending(false);
       if (error.message?.includes('DUPLICATE_LIMIT_REACHED')) {
          setShowDuplicateModal(true);
          return;
       }
       alert('Kunde inte posta på Whiteboarden: ' + error.message);
       return;
    }
    setNewPostContent('')
    setIsSending(false);
    await fetchData(0, true);
  }


  const handleSaveEdit = async () => {
    if (!editingItem || !editingItem.content.trim()) return;
    const table = editingItem.type === 'post' ? 'whiteboard' : 'whiteboard_comments';
    await supabase.from(table).update({ content: editingItem.content.trim() }).eq('id', editingItem.id);
    setEditingItem(null);
    fetchData(0, true);
  }


  const handleDelete = async (postId: string) => {
    if (!confirm('Vill du verkligen radera detta inlägg?')) return
    
    const { error } = await supabase.from('whiteboard').delete().eq('id', postId);
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      await fetchData(0, true); // Refresh to sync counters (handled by DB trigger)
    }

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
    fetchData(0, true); 
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
    fetchData(0, true);
  }

  
  const handlePostComment = async (postId: string) => {
    const txt = commentInputs[postId];
    if(!txt?.trim() || !currentUser) return;
    
    const { error } = await supabase.from('whiteboard_comments').insert({
       post_id: postId,
       author_id: currentUser.id,
       content: txt.trim()
    });

    if (error) {
       if (error.message?.includes('DUPLICATE_LIMIT_REACHED')) {
          setShowDuplicateModal(true);
          return;
       }
       alert('Kunde inte posta kommentar: ' + error.message);
       return;
    }
    
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
    await fetchData(0, true);
  }


  const [isSharing, setIsSharing] = useState(false);

  const handleSharePost = async (post: any) => {
    if (!currentUser || isSharing) return;
    setIsSharing(true);
    
    try {
      const caption = prompt(`Skriv något om detta inlägg (valfritt):`, "");
      if (caption === null) {
        setIsSharing(false);
        return;
      }

      const { error } = await supabase.from('whiteboard').insert({
        author_id: currentUser.id,
        content: caption.trim() || "",
        parent_id: post.parent_id || post.id
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
        await fetchData();
        alert('Inlägget har delats friskt på din Whiteboard!');
      }
    } catch (err) {
      console.error("Share error:", err);
    } finally {
      setIsSharing(false);
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
    const contentToReport = reportTarget.type === 'whiteboard' 
      ? posts.find(p => p.id === reportTarget.id)?.content
      : posts.flatMap(p => p.comments || []).find(c => c.id === reportTarget.id)?.content;

    await supabase.from('reports').insert({
      reporter_id: currentUser.id,
      reported_user_id: reportTarget.reportedUserId,
      item_type: reportTarget.type,
      item_id: reportTarget.id,
      reason: finalReason,
      reported_content: contentToReport || ''
    });

    // Notifiera alla administratörer om den nya anmälan!
    try {
      const { data: admins } = await supabase.from('profiles').select('id, username')
        .or('is_admin.eq.true,perm_content.eq.true');
      
      if (admins && admins.length > 0) {
        // Filtrera bort den person som blir anmäld om den är admin (jäv), 
        // men låt Mrsunshine88 (Root) alltid få alla notiser.
        const filteredAdmins = admins.filter(admin => {
          const isReported = admin.id === reportTarget.reportedUserId;
          const isRoot = admin.username === 'mrsunshine88' || admin.username === 'apersson508';
          
          if (isReported && !isRoot) return false;
          return true;
        });

        if (filteredAdmins.length > 0) {
          const adminNotifs = filteredAdmins.map(admin => ({
            receiver_id: admin.id,
            actor_id: currentUser.id,
            type: 'report',
            content: `har skickat in en ny anmälan (${reportTarget.type === 'whiteboard' ? 'Whiteboard' : 'Kommentar'}).`,
            link: '/admin?tab=reports'
          }));

          await supabase.from('notifications').insert(adminNotifs);

          // Skicka även push-notiser till admins
          filteredAdmins.forEach((admin: any) => {
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
        {!isExpanded && !newPostContent.trim() ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--theme-primary)', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden', flexShrink: 0 }}>
              {currentUser?.avatar_url ? <img src={currentUser.avatar_url} alt="Profile" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <User size={20} />}
            </div>
            <button 
              onClick={() => setIsExpanded(true)}
              style={{ flex: 1, backgroundColor: '#f0f2f5', border: 'none', borderRadius: '20px', padding: '0.6rem 1rem', textAlign: 'left', color: '#65676b', fontSize: '1rem', cursor: 'pointer', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e4e6eb'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0f2f5'}
            >
              Vad har du på hjärtat, {currentUser?.username || 'vän'}?
            </button>
          </div>
        ) : (
          <div id="wb-expanded-post">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
               <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>Skapa inlägg</h3>
               <button 
                 onClick={() => setIsExpanded(false)} 
                 style={{ background: 'none', border: 'none', color: '#65676b', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem' }}
               >
                 ✕
               </button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--theme-primary)', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden', flexShrink: 0 }}>
                {currentUser?.avatar_url ? <img src={currentUser.avatar_url} alt="Profile" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <User size={20} />}
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{currentUser?.username || 'Gäst'}</div>
            </div>

            <textarea 
              id="wb-textarea"
              autoFocus={isExpanded}
              placeholder={`Vad har du på hjärtat, ${currentUser?.username || 'vän'}?`} 
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              style={{ width: '100%', padding: '1rem 0', borderRadius: '0', border: 'none', outline: 'none', resize: 'none', minHeight: '150px', fontFamily: 'inherit', marginBottom: '1rem', fontSize: '1.4rem', color: '#1c1e21', backgroundColor: 'transparent' }}
            ></textarea>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
              <button 
                onClick={() => { setIsExpanded(false); setNewPostContent(''); }}
                style={{ background: 'none', border: 'none', color: '#65676b', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Avbryt
              </button>
              <button 
                onClick={() => { handlePost(); setIsExpanded(false); }} 
                disabled={!newPostContent.trim()} 
                style={{ padding: '0.6rem 2.5rem', backgroundColor: newPostContent.trim() ? '#1877f2' : '#e4e6eb', color: newPostContent.trim() ? 'white' : '#bcc0c4', borderRadius: '6px', fontWeight: 'bold', cursor: newPostContent.trim() ? 'pointer' : 'not-allowed', border: 'none', fontSize: '0.95rem' }}
              >
                Posta
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Flöde */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {userLoading && posts.length === 0 && <WhiteboardSkeleton />}
        {!userLoading && posts.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Inga inlägg hittades i din nätverkszon. Bli den första att skriva något!</p>}
        
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
                    {isOwnPost && (
                      <button onClick={() => handleDelete(post.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} title="Radera inlägg">
                        <Trash2 size={16} />
                      </button>
                    )}
                    {!isOwnPost && (
                      <button 
                        onClick={() => { setReportTarget({ id: post.id, type: 'whiteboard', reportedUserId: post.author_id }); setShowReportModal(true); }} 
                        style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center' }} 
                        className="fb-action-btn"
                        title="Anmäl inlägg"
                      >
                        <AlertTriangle size={18} />
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
                      {post.content && <p style={{ color: '#1c1e21', fontSize: '0.95rem', marginBottom: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{mask(post.content)}</p>}
                      
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
                             <p style={{ fontSize: '0.9rem', color: '#1c1e21', margin: 0, whiteSpace: 'pre-wrap' }}>{mask(post.parent_post.content)}</p>
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
                    
                    {/* Show/Hide more comments button */}
                    {hasMoreComments && (
                      <button 
                        onClick={() => setExpandedComments(prev => ({...prev, [post.id]: !prev[post.id]}))}
                        style={{ border: 'none', background: 'none', color: '#65676b', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1rem', padding: 0 }}
                      >
                        {expandedComments[post.id] ? 'Visa färre' : `Visa ${allComments.length - 2} tidigare kommentarer...`}
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
                                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '0.2rem', marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#65676b' }}>
                                      <span onClick={() => handleToggleLikeComment(comment.id)} style={{ color: cLiked ? '#1877f2' : 'inherit', cursor: 'pointer' }}>Gilla</span>
                                      <span style={{ fontWeight: 'normal' }}>{new Date(comment.created_at).toLocaleTimeString('sv-SE', {hour:'2-digit', minute:'2-digit'})}</span>
                                      {comment.likes?.length > 0 && (
                                         <span style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}><Heart size={10} fill="#65676b" color="#65676b" /> {comment.likes.length}</span>
                                      )}
                                      {cOwn && <span onClick={() => setEditingItem({ id: comment.id, type: 'comment', content: comment.content })} style={{ cursor: 'pointer' }}>Ändra</span>}
                                      {cOwn && <span onClick={() => handleDeleteComment(comment.id)} style={{ color: '#ef4444', cursor: 'pointer' }}>Radera</span>}
                                      {!cOwn && (
                                        <button 
                                          onClick={() => { 
                                            setReportTarget({ id: comment.id, type: 'whiteboard_comment', reportedUserId: comment.author_id }); 
                                            setShowReportModal(true); 
                                          }} 
                                          style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', borderRadius: '50%', transition: 'background-color 0.2s' }}
                                          className="fb-action-btn"
                                          title="Anmäl kommentar"
                                        >
                                          <AlertTriangle size={14} />
                                        </button>
                                      )}
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

        {/* --- LOAD MORE BUTTON --- */}
        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
            <button 
              onClick={handleLoadMore} 
              disabled={isFetchingMore}
              className={isFetchingMore ? 'animate-pulse' : ''}
              style={{ 
                padding: '0.8rem 2.5rem', 
                backgroundColor: '#1877f2', 
                color: 'white', 
                border: 'none', 
                borderRadius: '999px', 
                fontWeight: '700', 
                fontSize: '1rem',
                cursor: isFetchingMore ? 'not-allowed' : 'pointer', 
                opacity: isFetchingMore ? 0.7 : 1, 
                transition: 'all 0.3s ease', 
                boxShadow: '0 10px 15px -3px rgba(24,119,242,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              {isFetchingMore ? (
                <>
                  <div style={{ width: '18px', height: '18px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Laddar inlägg...
                </>
              ) : 'Visa äldre inlägg ↓'}
            </button>
          </div>
        )}
        
        {!hasMore && posts.length > 0 && (
          <p style={{ textAlign: 'center', color: '#65676b', fontSize: '0.9rem', padding: '1rem', fontStyle: 'italic' }}>
            Du har nått slutet av nyhetsflödet. Heja dig! ✨
          </p>
        )}
      </div>


      {showReportModal && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
           <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}><AlertTriangle size={24}/> Anmäl Innehåll</h3>
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
                <button onClick={handleReportContent} disabled={!reportReason.trim()} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: reportReason.trim() ? 'pointer' : 'not-allowed', opacity: reportReason.trim() ? 1 : 0.5 }}>Skicka Anmälan</button>
              </div>
           </div>
         </div>
      )}



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
          <style jsx>{`
            @keyframes modalBounce {
              0% { transform: scale(0.8); opacity: 0; }
              70% { transform: scale(1.05); }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
