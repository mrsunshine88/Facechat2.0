"use client"

import React, { useState, useEffect } from 'react';
import { Search, Trash2, Globe } from 'lucide-react';
import { adminDeleteContent, adminDeleteSnakeScore } from '../../actions/adminActions';
import { adminLogAction } from '@/app/actions/auditActions';
import { useWordFilter } from '@/hooks/useWordFilter';

const AdminContent = ({ supabase, currentUser, perms }: { supabase: any, currentUser: any, perms: { content: boolean, chat: boolean } }) => {
  const { mask } = useWordFilter();
  const [posts, setPosts] = useState<any[]>([]);
  const [guestbook, setGuestbook] = useState<any[]>([]);
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [snakeScores, setSnakeScores] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Sätt start-vyn till första tillgängliga behörighet
  const [view, setView] = useState(perms.content ? 'whiteboard' : 'chat');
  const [selectedArcadeGame, setSelectedArcadeGame] = useState('all');

  useEffect(() => {
    if (view === 'snake') {
      fetchSnakeScores();
    }
  }, [selectedArcadeGame, view]);

  useEffect(() => {
    const reloadData = () => {
      if (view === 'whiteboard') fetchPosts();
      else if (view === 'guestbook') fetchGuestbook();
      else if (view === 'forum') fetchForumPosts();
      else if (view === 'snake') fetchSnakeScores();
      else if (view === 'chat') fetchChatMessages();
    };

    reloadData();

    const tableMap: Record<string, string> = {
      'whiteboard': 'whiteboard',
      'guestbook': 'guestbook',
      'forum': 'forum_posts',
      'snake': 'snake_scores',
      'chat': 'chat_messages'
    };

    let tablesToWatch = [tableMap[view]];
    if (view === 'whiteboard') tablesToWatch.push('whiteboard_comments');

    const channels = tablesToWatch.map(t =>
      supabase.channel(`admin_content_${t}_${currentUser?.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, reloadData)
        .subscribe()
    );

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [view, supabase, currentUser?.id]);

  async function fetchChatMessages() {
    const { data } = await supabase.from('chat_messages').select('*, profiles(username), chat_rooms(name)').order('created_at', { ascending: false }).limit(100);
    if (data) setChatMessages(data);
  }

  async function fetchSnakeScores() {
    let query = supabase.from('snake_scores').select('*, profiles(username)').order('score', { ascending: false }).limit(50);
    if (selectedArcadeGame !== 'all') {
      query = query.eq('game_id', selectedArcadeGame);
    }
    const { data } = await query;
    if (data) setSnakeScores(data);
  }

  async function fetchForumPosts() {
    const { data } = await supabase.from('forum_posts')
      .select('*, profiles(username), forum_threads(id, title)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      const enriched = data.map((p: any) => ({
        ...p,
        is_starter: p.is_forum_starter !== undefined ? p.is_forum_starter : (p.content?.trim().toLowerCase() === p.forum_threads?.title?.trim().toLowerCase())
      }));
      setForumPosts(enriched);
    }
  }

  async function fetchPosts() {
    const { data: mainPosts } = await supabase.from('whiteboard').select('*, profiles!whiteboard_author_id_fkey(username)').order('created_at', { ascending: false }).limit(20);
    const { data: comments } = await supabase.from('whiteboard_comments').select('*, profiles(username)').order('created_at', { ascending: false }).limit(20);

    const mixed = [
      ...(mainPosts || []).map((p: any) => ({ ...p, is_comment: false })),
      ...(comments || []).map((c: any) => ({ ...c, is_comment: true }))
    ];
    mixed.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPosts(mixed.slice(0, 30));
  }

  async function fetchGuestbook() {
    const { data } = await supabase.from('guestbook').select('*, sender:profiles!guestbook_sender_id_fkey(username), receiver:profiles!guestbook_receiver_id_fkey(username)').order('created_at', { ascending: false }).limit(30);
    if (data) setGuestbook(data);
  }

  const handleDeleteForumThread = async (threadId: string, threadTitle: string) => {
    if (confirm(`Ska HELA TRÅDEN "${threadTitle}" raderas? Det tar bort alla kommentarer inuti den.`)) {
      const { error } = await supabase.from('forum_threads').delete().eq('id', threadId);
      if (error) return alert('Fel vid radering av tråd: ' + error.message);
      await adminLogAction(`Raderade hela forumtråden "${threadTitle}"`);
      fetchForumPosts();
    }
  };

  const handleDelete = async (table: string, id: string, contentOwner?: string, threadTitle?: string) => {
    if (confirm(`Ska ${contentOwner ? `${contentOwner}s ` : ''}inlägg raderas globalt?`)) {
      const res = await adminDeleteContent(table, id);
      if (res?.error) return alert('Behörighet saknas eller fel: ' + res.error);
      const tableName = table === 'whiteboard' ? 'Whiteboard' : (table === 'guestbook' ? 'Gästboken' : (table === 'chat_messages' ? 'Chatten' : 'forum'));
      
      let actionMsg = `Raderade ett inlägg i ${tableName}${contentOwner ? ` skapat av ${contentOwner}` : ''}`;
      if (table === 'forum_posts' && threadTitle) {
        actionMsg = `Raderade ett inlägg i forumet av ${contentOwner || 'okänd'} i tråden: "${threadTitle}"`;
      }
      
      await adminLogAction(actionMsg);
      if (table === 'whiteboard') fetchPosts();
      else if (table === 'guestbook') fetchGuestbook();
      else if (table === 'chat_messages') fetchChatMessages();
      else fetchForumPosts();
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Innehåll & Moderering</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Denna vy låter dig hantera raderingar av poster från plattformen.</p>

      {/* Skrivbord - Knappar som radbryts snyggt */}
      <div className="hide-on-mobile" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {perms.content && (
          <>
            <button onClick={() => setView('whiteboard')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'whiteboard' ? 'var(--theme-whiteboard)' : 'var(--bg-card)', color: view === 'whiteboard' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Whiteboard</button>
            <button onClick={() => setView('guestbook')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'guestbook' ? 'var(--theme-krypin)' : 'var(--bg-card)', color: view === 'guestbook' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Gästböcker</button>
            <button onClick={() => setView('forum')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'forum' ? 'var(--theme-forum)' : 'var(--bg-card)', color: view === 'forum' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Forum</button>
            <button onClick={() => setView('snake')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'snake' ? '#10b981' : 'var(--bg-card)', color: view === 'snake' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Arkad-Scores</button>
          </>
        )}
        {perms.chat && (
          <button onClick={() => setView('chat')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600', cursor: 'pointer', backgroundColor: view === 'chat' ? '#3b82f6' : 'var(--bg-card)', color: view === 'chat' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', flex: '1 1 auto' }}>Chatten</button>
        )}
      </div>

      {/* Mobil - Dropdown */}
      <div className="hide-on-desktop" style={{ marginBottom: '1.5rem', width: '100%' }}>
        <select
          value={view}
          onChange={(e) => setView(e.target.value)}
          className="admin-input"
          style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}
        >
          {perms.content && (
            <>
              <option value="whiteboard">Whiteboard</option>
              <option value="guestbook">Gästbok</option>
              <option value="forum">Forum</option>
              <option value="snake">Arkad-Scores</option>
            </>
          )}
          {perms.chat && <option value="chat">Chatten</option>}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {view === 'whiteboard' && posts.map(post => (
          <div key={`${post.is_comment ? 'c' : 'p'}-${post.id}`} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid var(--theme-whiteboard)', padding: '1rem' }}>
            <div className="admin-card-content">
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {post.profiles?.username || 'Okänd'} {post.is_comment ? '(Kommentar)' : '(Huvudinlägg)'} • {new Date(post.created_at).toLocaleString('sv-SE')}
              </p>
              <p style={{ margin: 0, color: 'var(--text-main)', paddingRight: '1rem' }}>{mask(post.content)}</p>
            </div>
            <div className="admin-card-actions">
              <button onClick={() => handleDelete(post.is_comment ? 'whiteboard_comments' : 'whiteboard', post.id, post.profiles?.username || 'Okänd')} style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.75rem' }} title={`Radera ${post.is_comment ? 'kommentar' : 'inlägg'}`}>
                <Trash2 size={16} /> Radera {post.is_comment ? 'Kommentar' : 'Inlägg'}
              </button>
            </div>
          </div>
        ))}
        {view === 'guestbook' && guestbook.map(post => (
          <div key={post.id} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid var(--theme-krypin)', padding: '1rem' }}>
            <div className="admin-card-content">
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{post.sender?.username || 'Okänd'} ➔ {post.receiver?.username || 'Okänd'} • {new Date(post.created_at).toLocaleString('sv-SE')}</p>
              <p style={{ margin: 0, color: 'var(--text-main)', paddingRight: '1rem' }}>{mask(post.content)}</p>
            </div>
            <div className="admin-card-actions">
              <button onClick={() => handleDelete('guestbook', post.id, post.sender?.username || 'Okänd')} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} title="Radera inlägg">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {view === 'forum' && forumPosts.map(post => {
          const isStarter = post.is_starter;
          return (
            <div key={post.id} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: `4px solid ${isStarter ? 'var(--theme-forum)' : '#94a3b8'}`, padding: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="admin-card-content" style={{ flex: 1, minWidth: '200px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: isStarter ? 'var(--theme-forum)' : 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  {isStarter ? '📂 [TRÅDSTART]' : '💬 [KOMMENTAR]'} • {post.profiles?.username || 'Okänd'} i "{post.forum_threads?.title || 'Raderad Tråd'}" • {new Date(post.created_at).toLocaleString('sv-SE')}
                </p>
                <p style={{ margin: 0, color: 'var(--text-main)', fontStyle: isStarter ? 'italic' : 'normal', fontSize: '0.9rem' }}>{mask(post.content)}</p>
              </div>
              <div className="admin-card-actions" style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {isStarter ? (
                   <button 
                     onClick={() => handleDeleteForumThread(post.forum_threads?.id, post.forum_threads?.title)} 
                     style={{ color: 'white', backgroundColor: '#ef4444', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(239,68,68,0.3)' }}
                   >
                     <Trash2 size={16} /> Radera hela Tråden
                   </button>
                ) : (
                   <button 
                     onClick={() => handleDelete('forum_posts', post.id, post.profiles?.username || 'Okänd', post.forum_threads?.title)} 
                     style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}
                   >
                     <Trash2 size={16} /> Radera kommentar
                   </button>
                )}
                <button 
                  onClick={() => window.open(`/forum/${post.thread_id}`, '_blank')}
                  style={{ color: 'var(--text-main)', backgroundColor: 'var(--bg-color)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}
                >
                  <Search size={14} /> Visa
                </button>
              </div>
            </div>
          );
        })}
        {view === 'chat' && chatMessages.map(msg => (
          <div key={msg.id} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid #3b82f6', padding: '1rem' }}>
            <div className="admin-card-content">
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{msg.profiles?.username || 'Okänd'} i rummet "{msg.chat_rooms?.name || 'Okänt'}" • {new Date(msg.created_at).toLocaleString('sv-SE')}</p>
              <p style={{ margin: 0, paddingRight: '1rem', fontStyle: msg.is_gif ? 'italic' : 'normal', color: msg.is_gif ? '#8b5cf6' : 'var(--text-main)' }}>{msg.is_gif ? '[GIF/BILD Skickad]' : mask(msg.content)}</p>
            </div>
            <div className="admin-card-actions">
              <button onClick={() => handleDelete('chat_messages', msg.id, msg.profiles?.username || 'Okänd')} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} title="Radera chattmeddelande">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {view === 'snake' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="admin-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Filtrera topplista på specifikt spel:</label>
              <select
                value={selectedArcadeGame}
                onChange={(e) => setSelectedArcadeGame(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}
              >
                <option value="all">Alla Spel (Blandat)</option>
                <option value="snake">Retro Snake</option>
                <option value="racing">Retro Racing</option>
                <option value="breakout">Retro Breakout</option>
                <option value="invaders">Astro Invaders</option>
                <option value="tetris">Retro Tetris</option>
              </select>
            </div>

            <div className="admin-card" style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
              <h3 style={{ color: '#ef4444', margin: 0 }}>🚨 FARA: Nollställ {selectedArcadeGame === 'all' ? 'Alla Arkad-Topplistor' : `Topplistan för ${selectedArcadeGame.toUpperCase()}`}</h3>
              <p style={{ color: '#991b1b', margin: 0, fontSize: '0.875rem' }}>Denna knapp raderar ALLA historiska poäng permanent!</p>
              <button
                onClick={async () => {
                  if (confirm('RENSA ALLA REKORD? Detta går inte att ångra!')) {
                    const res = await adminDeleteSnakeScore(null, true, selectedArcadeGame);
                    if (res?.error) alert('Det gick fel: ' + res.error);
                    else {
                      alert(`Arkadens topplistor raderades (${selectedArcadeGame})!`);
                      await adminLogAction(`Nollställde Facechat Arcade Leaderboarden (${selectedArcadeGame})!`);
                      fetchSnakeScores();
                    }
                  }
                }}
                style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: '800', border: 'none', padding: '1rem 2rem', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(239, 68, 68, 0.4)' }}
              >
                🗑️ NOLLSTÄLL {selectedArcadeGame === 'all' ? 'ALLA REKORD' : selectedArcadeGame.toUpperCase()} NU
              </button>
            </div>

            {snakeScores.map((score, index) => (
              <div key={score.id} className="admin-card admin-responsive-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: index === 0 ? '4px solid #fbbf24' : '4px solid #10b981', padding: '1rem' }}>
                <div className="admin-card-content">
                  <h4 style={{ margin: 0, color: 'var(--text-main)' }}>#{index + 1} - {score.profiles?.username || 'Okänd'} <span style={{ color: '#2563eb', fontSize: '0.8rem' }}>({String(score.game_id || 'snake').toUpperCase()})</span></h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Spelades: {new Date(score.created_at).toLocaleString('sv-SE')}</p>
                </div>
                <div className="admin-card-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>{score.score}</span>
                  <button onClick={async () => {
                    if (confirm('Radera just detta rekord?')) {
                      const res = await adminDeleteSnakeScore(score.id, false);
                      if (res?.error) return alert('Kunde inte radera: ' + res.error);
                      await adminLogAction(`Raderade ett rekord (${score.score} poäng) av ${score.profiles?.username || 'Okänd'}`);
                      fetchSnakeScores();
                    }
                  }} style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} title="Radera rekord">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminContent;
