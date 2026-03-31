"use client"

import React, { useState, useEffect } from 'react';
import { Trash2, CheckCircle } from 'lucide-react';
import { adminResetAvatar } from '../../actions/adminActions';
import { adminLogAction } from '@/app/actions/auditActions';

const cleanUrl = (url?: string) => url ? url.split('?')[0] : null;

const AdminBilder = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [usersWithAvatars, setUsersWithAvatars] = useState<any[]>([]);
  const [inactiveImages, setInactiveImages] = useState<string[]>([]);
  const [mode, setMode] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(true);
  const [deletingAll, setDeletingAll] = useState(false);

  const fetchAvatars = async () => {
    setLoading(true);
    if (mode === 'active') {
      const { data } = await supabase.from('profiles')
        .select('*')
        .not('avatar_url', 'is', null)
        .neq('avatar_url', '')
        .order('created_at', { ascending: false });
      if (data) setUsersWithAvatars(data);
    } else {
      try {
        // 1. Hämta ALLA filer från avatars hinken (hantera 1000+ filer)
        let allStorageFiles: any[] = [];
        let offset = 0;
        let hasMoreFiles = true;
        while (hasMoreFiles) {
          const { data: batch, error: err } = await supabase.storage.from('avatars').list('', { limit: 1000, offset });
          if (err || !batch || batch.length === 0) {
            hasMoreFiles = false;
          } else {
            allStorageFiles = [...allStorageFiles, ...batch];
            offset += 1000;
            if (batch.length < 1000) hasMoreFiles = false;
          }
        }

        // 2. Hämta ALLA aktiva avatar-URL:er (hantera 1000+ användare)
        let allActiveUrls: string[] = [];
        let from = 0;
        let hasMoreProfiles = true;
        while (hasMoreProfiles) {
          const { data: batch, error: err } = await supabase.from('profiles')
            .select('avatar_url')
            .not('avatar_url', 'is', null)
            .range(from, from + 999);
          if (err || !batch || batch.length === 0) {
            hasMoreProfiles = false;
          } else {
            allActiveUrls = [...allActiveUrls, ...batch.map((p: any) => p.avatar_url)];
            from += 1000;
            if (batch.length < 1000) hasMoreProfiles = false;
          }
        }
        
        if (allStorageFiles.length > 0) {
          const activeFileNames = new Set(
            allActiveUrls
              .map((url: string) => {
                try {
                  return url.split('/').pop()?.split('?')[0];
                } catch (e) { return null; }
              })
              .filter(Boolean)
          );
          
          const orphans = allStorageFiles
            .map((f: any) => f.name)
            .filter((name: string) => name !== '.emptyFolderPlaceholder' && !activeFileNames.has(name));
            
          setInactiveImages(orphans);
        }
      } catch (err) {
        console.error("Kunde inte hämta inaktiva bilder:", err);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAvatars();
  }, [supabase, mode]);

  const handleResetAvatar = async (user: any) => {
    if (!confirm(`Vill du verkligen ta bort profilbilden för ${user.username}?`)) return;
    const res = await adminResetAvatar(user.id);
    if (res?.error) return alert('Fel: ' + res.error);
    await adminLogAction(`Raderade profilbild för ${user.username} (via Galleri)`);
    fetchAvatars();
  };

  const handleDeleteInactive = async (fileName: string) => {
    if (!confirm('Vill du radera denna inaktiva bild permanent?')) return;
    const { error } = await supabase.storage.from('avatars').remove([fileName]);
    if (error) return alert('Kunde inte radera: ' + error.message);
    await adminLogAction(`Raderade inaktiv profilbild: ${fileName}`);
    fetchAvatars();
  };

  const handleDeleteAllInactive = async () => {
    if (inactiveImages.length === 0) return;
    if (!confirm(`VARNING: Du är på väg att radera ALLA ${inactiveImages.length} inaktiva bilder permanent. Vill du fortsätta?`)) return;
    
    setDeletingAll(true);
    const { error } = await supabase.storage.from('avatars').remove(inactiveImages);
    setDeletingAll(false);
    
    if (error) return alert('Ett fel uppstod: ' + error.message);
    
    await adminLogAction(`Rensade ALLA (${inactiveImages.length} st) inaktiva profilbilder från systemet.`);
    alert(`Städningen klar! ${inactiveImages.length} bilder raderade.`);
    fetchAvatars();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Bilder</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Här kan du rensa både aktiva och herrelösa profilbilder som tar plats.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-card)', padding: '0.4rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setMode('active')} 
            style={{ 
              padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer',
              backgroundColor: mode === 'active' ? 'var(--theme-primary)' : 'transparent',
              color: mode === 'active' ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            Aktiva Profilbilder
          </button>
          <button 
            onClick={() => setMode('inactive')} 
            style={{ 
              padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer',
              backgroundColor: mode === 'inactive' ? '#f59e0b' : 'transparent',
              color: mode === 'inactive' ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            Inaktiva Bilder {inactiveImages.length > 0 && <span style={{ marginLeft: '0.5rem', backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>{inactiveImages.length}</span>}
          </button>
        </div>
      </div>

      {mode === 'inactive' && inactiveImages.length > 0 && (
        <div className="admin-card" style={{ marginBottom: '2rem', border: '2px dashed #f59e0b', backgroundColor: '#fffbeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#92400e', fontWeight: '800' }}>Hittade {inactiveImages.length} herrelösa bilder</h3>
            <p style={{ margin: '0.25rem 0 0 0', color: '#b45309', fontSize: '0.875rem' }}>Dessa bilder tillhör ingen aktiv användare och tar bara upp utrymme.</p>
          </div>
          <button 
            onClick={handleDeleteAllInactive}
            disabled={deletingAll}
            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 6px rgba(239,68,68,0.2)' }}
          >
            {deletingAll ? 'RENSAR...' : 'RENSA ALLA INAKTIVA'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="skeleton-pulse" style={{ width: '100px', height: '100px', margin: '0 auto', borderRadius: '50%' }}></div><p style={{ marginTop: '1rem' }}>Laddar galleri...</p></div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {mode === 'active' ? (
            <>
              {usersWithAvatars.length === 0 && <p>Inga aktiva profilbilder hittades.</p>}
              {usersWithAvatars.map(u => {
                const cleanedImgUrl = cleanUrl(u.avatar_url);
                if (!cleanedImgUrl || cleanedImgUrl.length < 5) return null; // Skydd mot trasiga/för korta URL:er

                return (
                  <div key={u.id} className="admin-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '140px', height: '140px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f1f5f9', border: '1px solid var(--border-color)' }}>
                        <img src={cleanedImgUrl} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem' }}>{u.username}</p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.city || 'Ingen ort'}</p>
                    </div>
                    <button 
                        onClick={() => handleResetAvatar(u)}
                        style={{ width: '100%', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                        <Trash2 size={14} /> Radera
                    </button>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {inactiveImages.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                  <CheckCircle size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ margin: 0 }}>Systemet är rent!</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Inga inaktiva eller herrelösa bilder hittades.</p>
                </div>
              )}
              {inactiveImages.map(img => (
                <div key={img} className="admin-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                  <div style={{ width: '140px', height: '140px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f1f5f9', border: '1px solid var(--border-color)' }}>
                      <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${img}`} alt="Inactive" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ textAlign: 'center', width: '100%' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img}</p>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#f59e0b', fontWeight: 'bold' }}>HERRELÖS</p>
                  </div>
                  <button 
                      onClick={() => handleDeleteInactive(img)}
                      style={{ width: '100%', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  >
                      <Trash2 size={14} /> Radera
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminBilder;
