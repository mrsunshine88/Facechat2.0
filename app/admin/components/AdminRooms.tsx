"use client"

import React, { useState, useEffect } from 'react';
import { Shield, Trash2, Plus, Lock, UserPlus, Edit2, Eraser, EyeOff } from 'lucide-react';
import { adminRoomAction, adminAddSecretUserToRoom, adminRemoveSecretUserFromRoom } from '../../actions/adminActions';
import { adminLogAction } from '@/app/actions/auditActions';

const SecretRoomMembers = ({ room, supabase, currentUser, onRefresh }: any) => {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const isAdminRoom = room.name === 'Admin' && room.is_secret === true;

    if (isAdminRoom) {
      const adminFilter = 'is_admin.eq.true,perm_roles.eq.true,username.eq."mrsunshine88",username.eq."apersson508"';
      
      supabase.from('profiles').select('id, username').or(adminFilter).then(({ data, error }: any) => {
        if (error) {
           console.error("[ADMIN_ROOM_SYNC] Fel vid hämtning av admins:", error.message);
           supabase.from('profiles').select('id, username').eq('is_admin', true).then(({ data: d }: any) => {
             if (d) setMembers(d);
           });
        } else if (data) {
          setMembers(data);
        }
      });
    } else if (room.allowed_users && room.allowed_users.length > 0) {
      supabase.from('profiles').select('id, username').in('id', room.allowed_users).then(({ data }: any) => {
        if (data) setMembers(data);
      });
    } else {
      setMembers([]);
    }
  }, [room.allowed_users, room.name, room.is_secret, supabase]);

  const handleSearch = async (val: string) => {
    setSearch(val);
    if (val.length < 2) return setResults([]);
    const { data } = await supabase.from('profiles').select('id, username').ilike('username', `%${val}%`).limit(5);
    if (data) setResults(data.filter((u: any) => !(room.allowed_users || []).includes(u.id)));
  };

  const handleAdd = async (userId: string, username: string) => {
    const res = await adminAddSecretUserToRoom(room.id, userId);
    if (res.error) return alert("Fel: " + res.error);
    await adminLogAction(`Lade till ${username} i hemligt rum "${room.name}"`, userId);
    setSearch('');
    setResults([]);
    onRefresh();
  };

  const handleRemove = async (userId: string, username: string) => {
    if (!confirm(`Ta bort ${username} från ${room.name}?`)) return;
    const res = await adminRemoveSecretUserFromRoom(room.id, userId);
    if (res.error) return alert("Fel: " + res.error);
    await adminLogAction(`Tog bort ${username} från hemligt rum "${room.name}"`, userId);
    onRefresh();
  };

  const isAdminRoom = room.name === 'Admin' && room.is_secret === true;

  return (
    <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #94a3b8', position: 'relative' }}>
      <h5 style={{ margin: '0 0 0.5rem 0', color: '#334155', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {isAdminRoom ? <Shield size={14} color="#ef4444" /> : null}
        {isAdminRoom ? 'Automatiska Administratörs-Medlemmar' : 'Bjud in till Hemligt Rum'}
      </h5>
      
      {!isAdminRoom && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input type="text" placeholder="Sök användarnamn..." value={search} onChange={e => handleSearch(e.target.value)} className="admin-input" style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }} />
          </div>
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', maxHeight: '150px', overflowY: 'auto' }}>
              {results.map(su => (
                <div key={su.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'black' }}>{su.username}</span>
                  <button onClick={() => handleAdd(su.id, su.username)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Lägg till</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {isAdminRoom && (
        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem', fontStyle: 'italic' }}>
          Denna lista synkas automatiskt med alla som har Administratörs-behörighet.
        </p>
      )}

      <h6 style={{ margin: '0 0 0.5rem 0', color: '#64748b' }}>Tillagda Medlemmar ({members.length})</h6>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {members.map(m => (
          <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', backgroundColor: isAdminRoom ? '#fee2e2' : '#e2e8f0', border: isAdminRoom ? '1px solid #fca5a5' : 'none', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold', color: isAdminRoom ? '#991b1b' : '#334155' }}>
            {m.username}
            {!isAdminRoom && (
              <button onClick={() => handleRemove(m.id, m.username)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                <Trash2 size={12} />
              </button>
            )}
          </span>
        ))}
        {members.length === 0 && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Inga medlemmar ännu.</span>}
      </div>
    </div>
  );
};

const AdminRooms = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [activeSecretRoomId, setActiveSecretRoomId] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();

    const channel = supabase.channel('admin_rooms_realtime_' + currentUser?.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, fetchRooms)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser?.id]);

  async function fetchRooms() {
    const { data } = await supabase.from('chat_rooms').select('*').order('created_at', { ascending: true });
    if (data) setRooms(data);
  }

  const handleAddRoomEvent = async (e: React.FormEvent | React.MouseEvent, isSecret: boolean = false) => {
    e.preventDefault();
    if (!newRoomName) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const res = await adminRoomAction('insert', null, { name: newRoomName, created_by: user.id, is_secret: isSecret, allowed_users: [] });
    if (res?.error) return alert('Fel: ' + res.error);
    await adminLogAction(`Skapade ${isSecret ? 'hemliga ' : ''}chattrummet "${newRoomName}"`);
    setNewRoomName('');
    fetchRooms();
  };

  const handleDeleteRoom = async (id: string, name: string) => {
    if (confirm(`Är du säker på att du vill radera chattrummet "${name}"? Det kommer kasta ut alla som är där inne.`)) {
      const res = await adminRoomAction('delete', id, null);
      if (res?.error) return alert('Fel: ' + res.error);
      await adminLogAction(`Raderade chattrummet "${name}"`);
      fetchRooms();
    }
  };

  const handleRename = async (id: string, currentName: string) => {
    const fresh = prompt('Skriv nytt namn för rummet:', currentName);
    if (fresh && fresh.trim() !== currentName) {
      const res = await adminRoomAction('update', id, { name: fresh.trim() });
      if (res?.error) return alert('Fel: ' + res.error);
      await adminLogAction(`Döpte om rum "${currentName}" till "${fresh}"`);
      fetchRooms();
    }
  };

  const handleSetPassword = async (id: string) => {
    const rm = rooms.find(r => r.id === id);
    const pw = prompt(`Ange ett nytt lösenord för rummet ${rm?.name} (lämna tomt för att ta bort lösenordskravet):`);
    if (pw !== null) {
      const res = await adminRoomAction('update', id, { password: pw === '' ? null : pw });
      if (res?.error) return alert('Fel: ' + res.error);
      await adminLogAction(`Satte ett lösenord på chattrummet "${rm?.name}"`);
      fetchRooms();
    }
  };

  const handleRemovePassword = async (id: string, name: string) => {
    if (confirm(`Säker på att du vill ta bort lösenordet för "${name}"?`)) {
      const res = await adminRoomAction('update', id, { password: null });
      if (res?.error) return alert('Fel: ' + res.error);
      await adminLogAction(`Tog bort lösenordet på chattrum (${name})`);
      fetchRooms();
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Hantera Chattrum</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Skapa, redigera och ta bort de centrala chattrummen på sajten.</p>

      <form onSubmit={(e) => handleAddRoomEvent(e, false)} className="admin-card" style={{ marginBottom: '2rem', backgroundColor: '#f0fdfa', border: '1px solid #99f6e4' }}>
        <h3 style={{ fontSize: '1rem', color: '#0f766e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Plus size={18} /> Lägg till nytt Chattrum (Öppet eller Hemligt)</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="T.ex Nattugglan..." className="admin-input" style={{ flex: '1 1 100%', minWidth: '200px', backgroundColor: 'white' }} />
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto', flexWrap: 'wrap' }}>
            <button type="button" onClick={(e) => handleAddRoomEvent(e, false)} style={{ backgroundColor: '#0d9488', color: 'white', fontWeight: '600', padding: '0.75rem 2rem', border: 'none', cursor: 'pointer', borderRadius: '8px', flex: '1 1 auto', minWidth: '140px' }}>Skapa Rum</button>
            <button type="button" onClick={(e) => handleAddRoomEvent(e, true)} style={{ backgroundColor: '#312e81', color: 'white', fontWeight: '600', padding: '0.75rem 2rem', border: 'none', cursor: 'pointer', borderRadius: '8px', flex: '1 1 auto', minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><EyeOff size={18} /> Skapa Hemligt Rum</button>
          </div>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {rooms.map(r => (
          <div key={r.id} className="admin-card admin-responsive-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="admin-card-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {r.is_secret ? <span title="Hemligt Rum"><EyeOff size={16} color="#3b82f6" /></span> : r.password ? <Lock size={16} color="#ef4444" /> : null} {r.name}
                </h4>
              </div>
            </div>

            <div className="admin-card-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button onClick={() => handleRename(r.id, r.name)} style={{ flex: 1, backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Edit2 size={14} /> Byt Namn
              </button>
              {r.is_secret ? (
                <button onClick={() => setActiveSecretRoomId(activeSecretRoomId === r.id ? null : r.id)} style={{ flex: 1, backgroundColor: activeSecretRoomId === r.id ? '#e0e7ff' : '#f8fafc', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <UserPlus size={14} /> Hantera Medlemmar
                </button>
              ) : r.password ? (
                <button onClick={() => handleRemovePassword(r.id, r.name)} style={{ flex: 1, backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <Eraser size={14} /> Ta bort Lösenord
                </button>
              ) : (
                <button onClick={() => handleSetPassword(r.id)} style={{ flex: 1, backgroundColor: '#fcf8e3', color: '#8a6d3b', border: '1px solid #faebcc', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                   <Lock size={14} /> Sätt Lösenord
                </button>
              )}
              <button onClick={() => handleDeleteRoom(r.id, r.name)} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={14} /> Radera
              </button>
            </div>
            {r.is_secret && activeSecretRoomId === r.id && (
              <SecretRoomMembers room={r} supabase={supabase} currentUser={currentUser} onRefresh={fetchRooms} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminRooms;
