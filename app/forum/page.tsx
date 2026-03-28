"use client"

import React, { useState, useEffect } from 'react';
import { Search, PenSquare, Lock, User } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useWordFilter } from '@/hooks/useWordFilter';

export default function Forumet() {
  const router = useRouter();
  const { mask } = useWordFilter();
  const [useAlias, setUseAlias] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [threads, setThreads] = useState<any[]>([]); 
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Allmänt');
  const [newContent, setNewContent] = useState('');
  const [loading, setLoading] = useState(true);

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
      // Nu anropar vi fetchThreads när vi är klara med getUser, för att slippa krockat anrop
      fetchThreads(user);
    }
    init();

    const sub = supabase.channel('real-forum')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_threads' }, () => fetchThreads())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_posts' }, () => fetchThreads())
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchThreads(passedUser?: any) {
    const user = passedUser || (await supabase.auth.getUser()).data.user;
    let blockedIds: string[] = [];
    if (user) {
       const { data: bData } = await supabase.from('user_blocks').select('*')
           .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
       if (bData) {
           bData.forEach((b: any) => {
             blockedIds.push(b.blocker_id === user.id ? b.blocked_id : b.blocker_id);
           });
       }
    }

    const { data } = await supabase.from('forum_threads').select('*, profiles(username, alias_name), forum_posts(id)').order('created_at', { ascending: false });
    if(data) {
       const filtered = data.filter((t: any) => !blockedIds.includes(t.author_id));
       setThreads(filtered);
    }
    setLoading(false);
  }

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newTitle.trim() || !currentUser) return;
    const { data: threadDataList } = await supabase.from('forum_threads').insert({
      author_id: currentUser.id,
      title: newTitle.trim(),
      category: newCategory,
      uses_alias: useAlias
    }).select().limit(1);

    const threadData = threadDataList && threadDataList.length > 0 ? threadDataList[0] : null;

    if (threadData) {
      await supabase.from('forum_posts').insert({
        thread_id: threadData.id,
        author_id: currentUser.id,
        content: newTitle.trim(),
        uses_alias: useAlias
      });
      setShowNewThread(false);
      setNewTitle('');
      fetchThreads();
      router.push(`/forum/${threadData.id}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: 'var(--theme-forum)' }}>Forumet</h1>
          <p style={{ color: 'var(--text-muted)' }}>Diskutera allt mellan himmel och jord.</p>
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

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1rem' }}>
        <input 
          type="text" 
          placeholder="Sök i forumet..." 
          style={{ flex: 1, padding: '0.75rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius)', fontFamily: 'inherit', outline: 'none' }}
        />
        <button style={{ backgroundColor: 'var(--text-main)', color: 'white', border: 'none', cursor: 'pointer', padding: '0 1.5rem', borderRadius: 'var(--radius)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Search size={18} /> Sök
        </button>
        <button onClick={() => setShowNewThread(true)} style={{ backgroundColor: 'var(--theme-forum)', color: 'white', padding: '0 1.5rem', borderRadius: 'var(--radius)', fontWeight: 'bold', border: '2px solid var(--text-main)', boxShadow: 'var(--shadow-retro)', display: 'flex', cursor: 'pointer', alignItems: 'center', gap: '0.5rem' }}>
          <PenSquare size={18} /> Ny Tråd
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="card skeleton-pulse" style={{ height: '86px', marginBottom: '0' }}></div>
          ))
        ) : threads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p>Inga trådar startade än. Bli den första att skriva något!</p>
          </div>
        ) : (
          threads.map((thread) => {
            const authorUsername = thread.profiles?.username || 'Raderad';
            const authorDisplay = thread.uses_alias ? (thread.profiles?.alias_name || 'Stenansikte (Anonym)') : (
              <span onClick={(e) => { e.preventDefault(); router.push(`/krypin?u=${authorUsername}`); }} className="user-link" style={{ cursor: 'pointer', fontWeight: 'bold' }}>{authorUsername}</span>
            );
            const replyCount = thread.forum_posts ? Math.max(0, thread.forum_posts.length - 1) : 0;
            return (
              <a href={`/forum/${thread.id}`} key={thread.id} style={{ textDecoration: 'none' }}>
                <div className="card hover-lift" style={{ padding: '1.25rem', marginBottom: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'transform 0.1s' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem', color: 'var(--text-main)', wordBreak: 'break-word' }}>{mask(thread.title)}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                      I <span style={{ fontWeight: '600', color: 'var(--theme-forum)' }}>{thread.category}</span> • Startad av {authorDisplay} • {new Date(thread.created_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', color: 'var(--text-main)' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{replyCount}</span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', margin: 0 }}>Svar</p>
                  </div>
                </div>
              </a>
            )
          })
        )}
      </div>

      {/* Skapa Tråd Modal */}
      {showNewThread && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowNewThread(false)}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '600px', border: '2px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PenSquare size={24} color="var(--theme-forum)" /> Starta Ny Tråd
            </h2>
            <form onSubmit={handleCreateThread} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '2px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontWeight: 'bold', flex: '1 1 auto' }}>
                  <option value="Allmänt">Allmänt</option>
                  <option value="Kärlek">Kärlek</option>
                  <option value="Spel">Spel & IT</option>
                  <option value="Musik">Musik</option>
                </select>
                <input 
                  type="text" 
                  value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="Skriv en fångande rubrik..." 
                  style={{ flex: '1 1 200px', padding: '0.75rem', borderRadius: '8px', border: '2px solid var(--border-color)', outline: 'none', width: '100%' }}
                  required
                />
              </div>
              
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0 }}><strong>Tips:</strong> Du behöver bara en vass rubrik för att starta tråden. När tråden är skapad kan du skriva din första kommentar för att ge mer detaljer!</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                  Du skickar som: <span style={{ color: useAlias ? 'var(--theme-forum)' : 'inherit', fontWeight: 'bold' }}>{useAlias ? (currentUser?.alias_name || 'Stenansikte') : ``}</span>
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setShowNewThread(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Avbryt</button>
                  <button type="submit" style={{ padding: '0.75rem 2rem', backgroundColor: 'var(--theme-forum)', color: 'white', border: '2px solid var(--text-main)', boxShadow: 'var(--shadow-retro)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Posta Tråd</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
