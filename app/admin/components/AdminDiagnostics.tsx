"use client"

import React, { useState, useEffect, useRef } from 'react';
import { 
  Wrench, Search, Trash2, Globe, Plus, X, 
  CheckCircle, RefreshCw, Eraser, Edit2 
} from 'lucide-react';
import { 
  adminMassDeleteSpam, adminDeleteContent, adminResetPresentation, 
  adminResetTheme, adminRunDeepScan, 
  adminFixDeepScanIssue 
} from '../../actions/adminActions';
import { adminRemoveForbiddenWord, adminAddForbiddenWord } from '../../actions/securityActions';
import { adminLogAction } from '@/app/actions/auditActions';

const AdminDiagnostics = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [running, setRunning] = useState(false);
  const [diagSearch, setDiagSearch] = useState('');
  const [diagSearchResults, setDiagSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const [massDeleteQuery, setMassDeleteQuery] = useState('');
  const [massDeleting, setMassDeleting] = useState(false);
  const [forbiddenWords, setForbiddenWords] = useState<any[]>([]);
  const [newForbiddenWord, setNewForbiddenWord] = useState('');

  useEffect(() => {
    fetchForbiddenWords();
    fetchLatestScanResult();
  }, [supabase]);

  useEffect(() => {
    const term = diagSearch.trim();
    if (term.length >= 1) {
      const timer = setTimeout(async () => {
        if (term.length >= 2) {
          adminLogAction(`Sökte efter användarprofil i Diagnosverktyget: "${term}"`);
        }
        
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, presentation, custom_style')
          .ilike('username', `%${term}%`)
          .limit(10);
          
        if (!error && data) {
          setDiagSearchResults(data);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setDiagSearchResults([]);
    }
  }, [diagSearch]);

  const fetchForbiddenWords = async () => {
    const { data } = await supabase.from('forbidden_words').select('*').order('word', { ascending: true });
    if (data) setForbiddenWords(data);
  };

  const fetchLatestScanResult = async () => {
    const { data } = await supabase
      .from('admin_logs')
      .select('action, created_at')
      .ilike('action', 'Vårdcentralen:%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setLastScanResult(data[0].action.replace('Diagnosverktyget: ', '').replace('Vårdcentralen: ', ''));
    }
  };

  const handleAddWord = async () => {
    const wordToAdd = newForbiddenWord.trim().toLowerCase();
    if (!wordToAdd) return;

    const searchTerm = `%${wordToAdd}%`;
    const [wb, wbc, fp, ft, gb, cm, pm] = await Promise.all([
      supabase.from('whiteboard').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('whiteboard_comments').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('forum_posts').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('forum_threads').select('id', { count: 'exact', head: true }).ilike('title', searchTerm),
      supabase.from('guestbook').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }).ilike('content', searchTerm),
      supabase.from('private_messages').select('id', { count: 'exact', head: true }).ilike('content', searchTerm)
    ]);

    const totalLines = (wb.count || 0) + (wbc.count || 0) + (fp.count || 0) + (ft.count || 0) + (gb.count || 0) + (cm.count || 0) + (pm.count || 0);

    const res = await adminAddForbiddenWord(wordToAdd);
    if (res?.error) alert("Kunde inte lägga till ord: " + res.error);
    else {
      setNewForbiddenWord('');
      fetchForbiddenWords();
      alert(`✅ Ordet "${wordToAdd}" har lagts till.\n\nPåverkar ${totalLines} inlägg.`);
      await adminLogAction(`Lade till ord "${wordToAdd}" i det globala filtret (Påverkar ${totalLines} rader).`);
    }
  };

  const handleRemoveWord = async (id: string, word: string) => {
    if (confirm(`Vill du ta bort "${word}" från filtret?`)) {
      const res = await adminRemoveForbiddenWord(id);
      if (res?.error) return alert('Fel: ' + res.error);
      await adminLogAction(`Tog bort förbjudet ord: "${word}"`);
      fetchForbiddenWords();
    }
  };

  const [results, setResults] = useState<{ id: string, title: string, status: 'idle' | 'running' | 'ok' | 'warning', message: string, fixAction?: () => void }[]>([
    { id: 'latency', title: 'Ping', status: 'idle', message: 'Väntar...' },
    { id: 'storage', title: 'Lagring', status: 'idle', message: 'Väntar...' },
    { id: 'orphaned_avatars', title: 'Oanvända Bilder', status: 'idle', message: 'Väntar...' },
    { id: 'sync', title: 'Synk', status: 'idle', message: 'Väntar...' },
    { id: 'links', title: 'Döda Länkar', status: 'idle', message: 'Väntar...' },
    { id: 'images', title: 'Bild-optimering', status: 'idle', message: 'Väntar...' },
    { id: 'notifications', title: 'Gamla Notiser', status: 'idle', message: 'Väntar...' },
    { id: 'reports', title: 'Gamla Anmälningar', status: 'idle', message: 'Väntar...' },
    { id: 'avatars', title: 'Profilbilder', status: 'idle', message: 'Väntar...' },
    { id: 'friendships', title: 'Social Hälsa', status: 'idle', message: 'Väntar...' },
    { id: 'logs', title: 'Log-städning', status: 'idle', message: 'Väntar...' },
  ]);

  const isExecutingRef = useRef(false);

  const runDiagnostics = async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    setRunning(true);
    
    let currentResults: { id: string, title: string, status: 'idle' | 'running' | 'ok' | 'warning', message: string, fixAction?: () => void }[] = results.map(r => ({ ...r, status: 'running' as const, message: 'Skannar...' }));
    setResults(currentResults);

    const updateOne = (id: string, update: any) => {
      currentResults = currentResults.map(r => r.id === id ? { ...r, ...update } : r);
      setResults([...currentResults]);
    };

    try {
      let fixesCount = 0;
      
      const startPing = Date.now();
      const { error: pingErr } = await supabase.from('profiles').select('id').limit(1);
      const pingTime = Date.now() - startPing;
      
      updateOne('latency', { 
         status: pingErr ? 'warning' : (pingTime > 2000 ? 'warning' : 'ok'), 
         message: pingErr ? `Fel: ${pingErr.message}` : `${pingTime}ms` 
      });

      const { data: orphans } = await supabase.rpc('get_orphan_avatars');
      if (orphans && orphans.length > 0) {
        fixesCount++;
        const orphanNames = orphans.map((o: any) => o.file_name);
        const { error: storageErr } = await supabase.storage.from('avatars').remove(orphanNames);
        if (!storageErr) {
          await adminLogAction(`Vårdcentralen: Rensade ${orphans.length} herrelösa bilder.`);
          updateOne('orphaned_avatars', { status: 'ok', message: `✅ Rensade ${orphans.length} bilder.` });
        } else {
          updateOne('orphaned_avatars', { status: 'warning', message: `⚠️ Fel: ${storageErr.message}` });
        }
      } else {
        updateOne('orphaned_avatars', { status: 'ok', message: '✅ Allt grönt.' });
      }

      const { data: storageSize } = await supabase.rpc('get_total_storage_size');
      const sizeMB = ((storageSize || 0) / (1024 * 1024)).toFixed(2);
      updateOne('storage', { status: 'ok', message: `✅ ${sizeMB} MB` });

      const { data: syncData } = await supabase.rpc('diagnose_missing_profiles');
      if (syncData > 0) fixesCount++;
      updateOne('sync', { status: 'ok', message: syncData > 0 ? `✅ Fixade ${syncData}.` : '✅ Allt synkat.' });

      const { data: linksData } = await supabase.rpc('fix_dead_links');
      if (linksData > 0) fixesCount++;
      updateOne('links', { status: 'ok', message: linksData > 0 ? `✅ Rensade ${linksData}.` : '✅ Inga döda länkar.' });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: oldNotif } = await supabase.from('notifications').delete({ count: 'exact' }).lt('created_at', thirtyDaysAgo.toISOString());
      if ((oldNotif || 0) > 0) {
         fixesCount++;
         updateOne('notifications', { status: 'ok', message: `✅ Rensade ${oldNotif} notiser.` });
      } else {
         updateOne('notifications', { status: 'ok', message: '✅ Inget skräp.' });
      }

      await supabase.from('profiles').update({ avatar_url: null }).or('avatar_url.ilike.%undefined%,avatar_url.ilike.%null%');
      updateOne('avatars', { status: 'ok', message: '✅ Fixade trasiga länkar.' });

      const scanRes = await adminRunDeepScan();
      if (scanRes?.issues && scanRes.issues.length > 0) {
         fixesCount++;
         for (const issue of scanRes.issues) {
            await adminFixDeepScanIssue(issue.id);
         }
         updateOne('friendships', { status: 'ok', message: '✅ Lagat.' });
      } else {
         updateOne('friendships', { status: 'ok', message: '✅ Allt grönt.' });
      }

      const { data: optImg } = await supabase.rpc('optimize_uploaded_images');
      if (optImg > 0) fixesCount++;
      updateOne('images', { status: 'ok', message: optImg > 0 ? `✅ Optimerade ${optImg}.` : '✅ Allt optimerat.' });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: oldReports } = await supabase.from('reports').update({ status: 'resolved' }, { count: 'exact' }).eq('status', 'open').lt('created_at', sevenDaysAgo.toISOString());
      if ((oldReports || 0) > 0) {
         fixesCount++;
         await adminLogAction(`Vårdcentralen: Auto-löste ${oldReports} gamla anmälningar.`);
         updateOne('reports', { status: 'ok', message: `✅ Rensade ${oldReports}.` });
      } else {
         updateOne('reports', { status: 'ok', message: '✅ Allt grönt.' });
      }

      const thirtyDaysAgoLogs = new Date();
      thirtyDaysAgoLogs.setDate(thirtyDaysAgoLogs.getDate() - 30);
      const { count: logsToDelete } = await supabase.from('admin_logs').delete({ count: 'exact' }).lt('created_at', thirtyDaysAgoLogs.toISOString());
      if ((logsToDelete || 0) > 0) {
         fixesCount++;
         updateOne('logs', { status: 'ok', message: `✅ Rensade ${logsToDelete}.` });
      } else {
         updateOne('logs', { status: 'ok', message: '✅ Allt grönt.' });
      }

      fetchLatestScanResult();
      
      // LOGGA RESULTATET
      const resultSummary = `Diagnosverktyget kördes: ${fixesCount === 0 ? 'Inga problem hittades.' : `Fixade ${fixesCount} systemrelaterade problem.`}`;
      await adminLogAction(resultSummary);

    } catch (err: any) {
      console.error('Diagnosfel:', err);
    } finally {
      setRunning(false);
      isExecutingRef.current = false;
    }
  };

  const handleWipeBio = async () => {
    if (!selectedUser) return;
    if (confirm(`Nollställ biografi för ${selectedUser.username}?`)) {
      const res = await adminResetPresentation(selectedUser.id);
      if (!res?.error) {
        await adminLogAction(`Rensade biografi för ${selectedUser.username}`, selectedUser.id);
        setSelectedUser(null);
        setDiagSearch('');
      } else alert(res.error);
    }
  };

  const handleWipeCss = async () => {
    if (!selectedUser) return;
    if (confirm(`Nollställ CSS för ${selectedUser.username}?`)) {
      const res = await adminResetTheme(selectedUser.id);
      if (!res?.error) {
        await adminLogAction(`Nollställde CSS för ${selectedUser.username}`, selectedUser.id);
        setSelectedUser(null);
        setDiagSearch('');
      } else alert(res.error);
    }
  };

  const handleMassDelete = async () => {
    if (massDeleteQuery.length < 3) return;
    if (confirm(`RADERA ALLT innehåll med "${massDeleteQuery}"?`)) {
      setMassDeleting(true);
      const res = await adminMassDeleteSpam(massDeleteQuery);
      if (!res?.error) {
        await adminLogAction(`Mass-radera spam: "${massDeleteQuery}" (${res.count} rader)`);
        setMassDeleteQuery('');
        alert(`Klart! Raderade ${res.count} inlägg.`);
      } else alert(res.error);
      setMassDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '1.25rem 1.5rem', backgroundColor: '#f0fdf4', border: '2px solid #10b981' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#064e3b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Wrench size={24} /> Diagnosverktyget</h2>
          <p style={{ color: '#047857', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>Fullständig system-skanning och lagning.</p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={running}
          style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
        >
          {running ? 'SKANNAR...' : 'STÄDA SAJTEN'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {results.map(res => (
          <div key={res.id} className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', borderLeft: `4px solid ${res.status === 'ok' ? '#10b981' : (res.status === 'warning' ? '#ef4444' : '#cbd5e1')}`, backgroundColor: 'white' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>{res.title}</h4>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{res.message}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem' }} className="admin-card">
        <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}><Trash2 size={20} /> Akut Mass-radering</h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input type="text" value={massDeleteQuery} onChange={e => setMassDeleteQuery(e.target.value)} placeholder="Sökord/Länk..." style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          <button onClick={handleMassDelete} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold' }}>RADERA</button>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }} className="admin-card">
        <h3 style={{ color: '#be185d', marginBottom: '1rem' }}><Search size={20} /> Hitta & Rensa Profil</h3>
        <div style={{ position: 'relative' }}>
          <input type="text" value={diagSearch} onChange={e => setDiagSearch(e.target.value)} placeholder="Användarnamn..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          {diagSearchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', width: '100%', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', zIndex: 10 }}>
              {diagSearchResults.map(u => (
                <div key={u.id} onClick={() => { setSelectedUser(u); setDiagSearchResults([]); }} style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>{u.username}</div>
              ))}
            </div>
          )}
        </div>
        {selectedUser && (
          <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #be185d', borderRadius: '8px' }}>
            <p>Vald: <strong>{selectedUser.username}</strong></p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleWipeCss} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px' }}>Nollställ CSS</button>
              <button onClick={handleWipeBio} style={{ backgroundColor: '#be185d', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px' }}>Rensa Bio</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem' }} className="admin-card">
        <h3 style={{ color: '#4f46e5', marginBottom: '1rem' }}><Globe size={20} /> Globalt Ord-filter</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input type="text" value={newForbiddenWord} onChange={e => setNewForbiddenWord(e.target.value)} placeholder="Fult ord..." style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          <button onClick={handleAddWord} style={{ backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px' }}>LÄGG TILL</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {forbiddenWords.map(w => (
            <span key={w.id} style={{ backgroundColor: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {w.word}
              <X size={14} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => handleRemoveWord(w.id, w.word)} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDiagnostics;
