"use client"

import React, { useState, useEffect } from 'react';
import { Book, Shield, HelpCircle, User, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { deleteUserAccount } from '../actions/userActions';

const INTERESTS = [
  "Bakning", "Bilar och meckande", "Brädspel", "Båtliv och segling", "Camping",
  "Datorbygge", "Drönarflygning", "Dryckesprovning", "Film och serier", "Fiske",
  "Foto och video", "Fågelskådning", "Gaming (TV- och datorspel)", "Grillning",
  "Jakt", "Läsning", "Matlagning", "Motorcyklar", "Motorsport", "Musik (spela instrument)",
  "Måleri och teckning", "Programmering", "Radiostyrda fordon", "Resor", "Ridning",
  "Samlarobjekt (t.ex. klockor, kort eller mynt)", "Skrivande", "Släktforskning", "Vandring",
  
  // Handarbete & Hantverk
  "Stickning", "Virkning", "Sy och designa kläder", "Broderi", "Läderarbete",
  "Träslöjd och snickeri", "Keramik och lera", "Smyckestillverkning",
  
  // Hem & Trädgård
  "Odling och trädgård", "Inomhusväxter (Urban Jungle)", "Inredning och styling", 
  "Renovering", "Biodling",
  
  // Sport & Hälsa
  "Yoga och meditation", "Gym och styrketräning", "Löpning", "Padel", "Simning",
  "Kampsport", "Cykling (Mountainbike/Landsväg)",
  
  // Livsstil & Kultur
  "Aktier och ekonomi", "Kryptovalutor", "Poddar", "Brädspel och Rollspel (t.ex. D&D)",
  "Teater och scenkonst", "Vinylskivor", "Urban Exploration (UE)", "Geocaching",
  
  // Mat & Dryck
  "Kaffekonst (Barista)", "Ölbryggning", "Surdegsbakning", "Vegansk matlagning",

  // Kids (7-12 år)
  "Roblox-byggande", "Minecraft & Arkitektur", "E-sport & Gaming", "Youtube-skapande", "Programmering för kids",
  "Pärlplattor & Smycken", "Slime-tillverkning", "LEGO-bygge", "Rita Manga & Serier", "Lera & Modellering",
  "Fotboll & Lagidrott", "Dans & TikTok-moves", "Skateboard & Kickbike", "Gymnastik & Parkour", "Ridning & Stallmys",
  "Pokémon-kort", "Detektiv & Mysterier", "Djurens värld", "Magitrick & Trolleri", "Science & Experiment"
].sort((a, b) => a.localeCompare(b, 'sv-SE'));

const PrivacyToggle = ({ label, isVisible, onToggle }: { label: string, isVisible: boolean, onToggle: () => void }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
      <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</label>
      <button type="button" onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: isVisible ? '#d1fae5' : '#f3f4f6', color: isVisible ? '#059669' : '#6b7280', border: '1px solid', borderColor: isVisible ? '#34d399' : '#d1d5db', cursor: 'pointer', fontWeight: 'bold' }}>
        {isVisible ? '👁️ Visa' : '🔒 Dölj'}
      </button>
    </div>
  );
};

export default function MinaSidor() {
  const [activeTab, setActiveTab] = useState('Konto');
  const [showSaved, setShowSaved] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [supportSent, setSupportSent] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [supportCategory, setSupportCategory] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [activeUserTicketId, setActiveUserTicketId] = useState<string | null>(null);
  const [userReplyText, setUserReplyText] = useState('');
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  const [showPhone, setShowPhone] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showZipcode, setShowZipcode] = useState(false);
  const [showInterests, setShowInterests] = useState(false);
  const [userInterests, setUserInterests] = useState<string[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const { data: secrets } = await supabase.from('user_secrets').select('*').eq('user_id', user.id).maybeSingle();
        
        if (profile) {
          setCurrentUser({ ...profile, email: user.email, ...secrets });
          setNewUsername(profile.username);
          setShowPhone(secrets?.show_phone || false);
          setShowAddress(secrets?.show_address || false);
          setShowZipcode(secrets?.show_zipcode || false);
          setShowInterests(profile.show_interests || false);
          setUserInterests(profile.interests || []);
        } else {
          setCurrentUser({ id: user.id, email: user.email, username: user.email?.split('@')[0] || 'Unknown' });
          setNewUsername(user.email?.split('@')[0] || 'Unknown');
        }
      }
    }
    fetchUser();
  }, [supabase]);

  useEffect(() => {
    if (currentUser?.id) {
      const fetchMyTickets = async () => {
        const { data } = await supabase.from('support_tickets').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        if (data) setMyTickets(data);
      };
      fetchMyTickets();
    }
  }, [currentUser?.id, supabase]);

  const tabs = [
    { id: 'Konto', icon: User },
    { id: 'Personuppgifter', icon: Book },
    { id: 'Support', icon: HelpCircle },
  ];

  const handleSaveKonto = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    if (newUsername.trim() !== currentUser.username) {
      if (newUsername.trim().length < 3) {
        setUsernameError('Användarnamnet måste vara minst 3 tecken.');
        return;
      }
      // Check collision safely
      const { data: existing } = await supabase.from('profiles').select('id').ilike('username', newUsername.trim()).limit(1)
      if (existing && existing.length > 0) {
        setUsernameError('Detta användarnamn är redan upptaget!');
        return;
      }
      // Update Username
      const { error } = await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', currentUser.id);
      if (error) {
        setUsernameError('Ett fel uppstod i Psql update: ' + error.message);
        return;
      }
      setCurrentUser({ ...currentUser, username: newUsername.trim() });
    }

    // Har användaren fyllt i ett nytt lösenord? Update det vi Auth API.
    if (newPassword.trim().length > 0) {
      if (newPassword.trim().length < 6) {
        setUsernameError('Lösenordet måste vara minst 6 tecken.');
        return;
      }
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (pwError) {
        setUsernameError('Kunde inte uppdatera lösenordet: ' + pwError.message);
        return;
      }
      setNewPassword(''); // Rensa fältet när det lyckats
    }
    
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const handleDeleteMyAccount = async () => {
    if (!currentUser) return;
    try {
      // Skriv logg direkt innan vi raderar the creator
      await supabase.from('admin_logs').insert({ 
        admin_id: currentUser.id, 
        action: `SYSTEM: Användaren @${currentUser.username} skrotade sitt eget konto.` 
      });
      // Radera kontot från databasen och Auth via Server Action
      const res = await deleteUserAccount(currentUser.id, currentUser.id, false);
      if (res?.error) {
         setCustomAlert("Fel vid radering: " + res.error);
         return;
      }
      // Logga ut auth-sessionen
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch(e) {
      setCustomAlert("Nätverksfel vid radering: " + e);
    }
  };

  const handleSaveOther = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const publicPayload = {
      city: formData.get('city') || null,
      show_interests: showInterests,
      interests: userInterests
    };
    
    // Save public parts to 'profiles'
    const { error: error1 } = await supabase.from('profiles').update(publicPayload).eq('id', currentUser.id);
    
    if (error1) {
       setCustomAlert('Kunde inte spara profilen (Fel: ' + error1.message + ')');
       return;
    }

    const secretPayload = {
      user_id: currentUser.id,
      phone: formData.get('phone') || null,
      address: formData.get('address') || null,
      zipcode: formData.get('zipcode') || null,
      show_phone: showPhone,
      show_address: showAddress,
      show_zipcode: showZipcode
    };

    // Save heavily protected chunks to 'user_secrets'
    const { error: error2 } = await supabase.from('user_secrets').upsert(secretPayload, { onConflict: 'user_id' });
    
    if (error2) {
       setCustomAlert('Kunde inte spara dina privata personuppgifter (Se till att databastabellen har skapats): ' + error2.message);
       return;
    }

    setCurrentUser({ ...currentUser, ...publicPayload, ...secretPayload });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportCategory || !supportMessage.trim() || !currentUser) return;

    const { error: insertError } = await supabase.from('support_tickets').insert({
      user_id: currentUser.id,
      category: supportCategory,
      description: supportMessage.trim(),
      status: 'open',
      has_unread_admin: true,
      has_unread_user: false,
      messages: [{ sender: 'user', text: supportMessage.trim(), time: new Date().toISOString() }]
    });

    if (insertError) {
      setCustomAlert(`Det gick inte att skicka ärendet. Databasfel: ${insertError.message}`);
      return;
    }

    setSupportSent(true);
    setSupportCategory('');
    setSupportMessage('');
    setTimeout(() => setSupportSent(false), 5000);
    
    // Skriv ett logg-event om systemhändelsen
    await supabase.from('admin_logs').insert({ 
      admin_id: currentUser.id, 
      action: `SYSTEM: Användaren @${currentUser.username} skapade en support-ticket (${supportCategory}).` 
    });

    // Refresh list
    const { data } = await supabase.from('support_tickets').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setMyTickets(data);
  };

  const handleDeleteTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm('Är du säker på att du vill ta bort det här ärendet för gott? Det försvinner även för Admin.')) return;
    
    // Add optimistic UI filter
    setMyTickets(myTickets.filter((t: any) => t.id !== ticketId));
    if (activeUserTicketId === ticketId) setActiveUserTicketId(null);
    
    const { error } = await supabase.from('support_tickets').delete().eq('id', ticketId);
    if(error){
      setCustomAlert(`Fel vid borttagning: ${error.message}`);
    }
  };

  const handleUserReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userReplyText.trim() || !activeUserTicketId) return;
    const ticket = myTickets.find(t => t.id === activeUserTicketId);
    if (!ticket) return;

    const currentMsg = ticket.messages || [];
    if (currentMsg.length === 0 && ticket.description) {
      currentMsg.push({ sender: 'user', text: ticket.description, time: ticket.created_at });
    }

    const newMsgs = [...currentMsg, { sender: 'user', text: userReplyText.trim(), time: new Date().toISOString() }];
    
    await supabase.from('support_tickets').update({ 
      messages: newMsgs,
      has_unread_admin: true,
      has_unread_user: false
    }).eq('id', activeUserTicketId);
    
    setUserReplyText('');
    
    // Skriv ett logg-event 
    await supabase.from('admin_logs').insert({ 
      admin_id: currentUser.id, 
      action: `SYSTEM: Användaren @${currentUser.username} svarade på support-ticket.` 
    });

    const { data } = await supabase.from('support_tickets').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setMyTickets(data);
  };

  const markUserRead = async (id: string) => {
    const ticket = myTickets.find(t => t.id === id);
    if (ticket && ticket.has_unread_user) {
      await supabase.from('support_tickets').update({ has_unread_user: false }).eq('id', id);
      const { data } = await supabase.from('support_tickets').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
      if (data) setMyTickets(data);
    }
  };

  const handleSubscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setCustomAlert('Din webbläsare stödjer inte Push-notiser.'); return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setCustomAlert('Du måste tillåta notiser i din webbläsare/telefon för att detta ska fungera.'); return;
      }
      
      await navigator.serviceWorker.register('/sw.js?v=3');
      const registration = await navigator.serviceWorker.ready;
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BIIu5FLF16h7zmkHnv4v9Tnx-8t4VndYds5FWvQKmGtTDJWLcHrrcjOfZWzINmMwClCmNLekCC1_vTb97fwIxhQ";
      function urlBase64(base64String: string) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const out = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
        return out;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: urlBase64(publicVapidKey)
      });
      const subJSON = subscription.toJSON();
      if (!currentUser) return;
      
      const { error } = await supabase.from('push_subscriptions').upsert({
         user_id: currentUser.id, endpoint: subJSON.endpoint,
         auth: subJSON.keys?.auth, p256dh: subJSON.keys?.p256dh
      }, { onConflict: 'endpoint' });

      if (error) throw error;
      setCustomAlert('Push-notiser är nu aktiverade för denna enhet! 🎉');
    } catch (err: any) {
      console.error(err);
      setCustomAlert('Ett fel uppstod: ' + err.message);
    }
  };

  if (!currentUser) return <div style={{ padding: '2rem', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>Laddar Mina Sidor...</div>;

  return (
    <div style={{ display: 'flex', gap: '2rem', minHeight: 'calc(100vh - 120px)' }} className="krypin-layout">
       
      {/* Global Custom Alert Modal */}
      {customAlert && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <AlertTriangle size={48} color="var(--theme-krypin)" style={{ marginBottom: '1.5rem' }} />
              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: 'bold' }}>Meddelande</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem' }}>{customAlert}</p>
              <button onClick={() => setCustomAlert(null)} style={{ background: 'var(--theme-krypin)', color: 'white', border: 'none', padding: '0.875rem 2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', width: '100%', fontSize: '1rem', transition: 'transform 0.1s' }} className="hover-lift">Okej, jag förstår!</button>
           </div>
         </div>
      )}

      {/* Sidebar */}
      <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem', paddingRight: '1rem' }} className="krypin-sidebar">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <SettingsIcon size={20}/> Mina Sidor
        </h2>
        <div className="krypin-sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setShowConfirmDelete(false); setSupportSent(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: activeTab === tab.id ? 'var(--theme-krypin)' : 'transparent', color: activeTab === tab.id ? 'white' : 'var(--text-main)', fontWeight: activeTab === tab.id ? '600' : '500', textAlign: 'left', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <tab.icon size={18} opacity={activeTab === tab.id ? 1 : 0.6} />
              {tab.id}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '1rem', position: 'relative' }}>
        {showSaved && (
          <div style={{ position: 'fixed', top: '80px', right: '1rem', backgroundColor: '#10b981', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '999px', fontSize: '0.875rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 9999, boxShadow: 'var(--shadow-md)' }}>
            <CheckCircle size={18} /> Sparat!
          </div>
        )}

        {supportSent && (
          <div style={{ position: 'fixed', top: '80px', right: '1rem', backgroundColor: '#3b82f6', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '999px', fontSize: '0.875rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 9999, boxShadow: 'var(--shadow-md)' }}>
            <CheckCircle size={18} /> Ärendet skickat till Admin!
          </div>
        )}

        <div className="card" style={{ padding: '2.5rem', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
          {activeTab === 'Konto' && (
             <form onSubmit={handleSaveKonto} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
               <div>
                 <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: '700' }}>Kontouppgifter</h3>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   <div>
                     <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Användarnamn</label>
                     <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                     {usernameError && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem', fontWeight: '600' }}>{usernameError}</p>}
                   </div>
                   <div>
                     <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>E-post</label>
                     <input type="email" defaultValue={currentUser.email} disabled style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#f9fafb', color: 'var(--text-muted)' }} />
                   </div>
                 </div>
               </div>

               <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                 <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: '700' }}>Ändra Lösenord</h3>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Skriv in ett nytt lösenord..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lämna fältet tomt om du inte vill byta lösenord.</p>
                 </div>
               </div>

               <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                 <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: '700' }}>Inbyggda Notifieringar</h3>
                 <div style={{ padding: '1.5rem', border: '1px solid #10b981', borderRadius: '8px', backgroundColor: '#f0fdf4' }}>
                   <h4 style={{ margin: '0 0 0.5rem 0', color: '#064e3b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📱 Push-Notiser (Mobil/Dator)</h4>
                   <p style={{ color: '#047857', fontSize: '0.875rem', marginBottom: '1rem' }}>Få ett riktigt 'pling' i telefonen när du får Mejl, Gästboksinlägg, Chatt, Whiteboard och Forum, även när skärmen är avstängd!</p>
                   <button type="button" onClick={handleSubscribePush} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(16,185,129,0.3)' }} className="hover-lift">
                     Aktivera Push-notiser för denna enhet 🎉
                   </button>
                 </div>
               </div>
   
               <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <button type="submit" style={{ backgroundColor: 'var(--theme-krypin)', color: 'white', fontWeight: '600', padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Spara ändringar</button>
                 
                 <div style={{ position: 'relative' }}>
                   {!showConfirmDelete ? (
                     <button type="button" onClick={() => setShowConfirmDelete(true)} style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.875rem', textDecoration: 'underline', padding: '0.5rem', border: 'none', background: 'none', cursor: 'pointer' }}>Radera mitt konto</button>
                   ) : (
                     <div style={{ position: 'absolute', bottom: '100%', right: '0', width: '300px', marginBottom: '1rem', backgroundColor: 'var(--bg-card)', border: '2px solid #ef4444', borderRadius: '8px', padding: '1.5rem', boxShadow: 'var(--shadow-md)', zIndex: 10 }}>
                       <h4 style={{ color: '#ef4444', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle size={18} /> Är du helt säker?</h4>
                       <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '1rem' }}>All din historik från Facechat kommer att försvinna rakt ner i soptunnan.</p>
                       <input type="password" placeholder="Beskäfta med lösenord..." style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem', fontSize: '0.875rem' }} />
                       <div style={{ display: 'flex', gap: '0.5rem' }}>
                         <button type="button" onClick={() => setShowConfirmDelete(false)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#e5e7eb', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}>Ångra</button>
                         <button type="button" onClick={handleDeleteMyAccount} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px', fontWeight: '600', fontSize: '0.875rem' }}>Radera</button>
                       </div>
                     </div>
                   )}
                 </div>
               </div>
             </form>
          )}

          {activeTab === 'Personuppgifter' && (
             <form onSubmit={handleSaveOther} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
               <div>
                 <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: '700' }}>Personuppgifter</h3>
                 <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Din privata information. Använd gröna knapparna för att dölja data från allmänheten.</p>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <PrivacyToggle label="Telefonnummer" isVisible={showPhone} onToggle={() => setShowPhone(!showPhone)} />
                      <input name="phone" type="tel" defaultValue={currentUser.phone || ''} placeholder="T.ex 070-123 45 67" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <PrivacyToggle label="Gatuadress" isVisible={showAddress} onToggle={() => setShowAddress(!showAddress)} />
                        <input name="address" type="text" defaultValue={currentUser.address || ''} placeholder="Gatunamn 123" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                      </div>
                      <div>
                        <PrivacyToggle label="Postnummer" isVisible={showZipcode} onToggle={() => setShowZipcode(!showZipcode)} />
                        <input name="zipcode" type="text" defaultValue={currentUser.zipcode || ''} placeholder="112 34" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Hemort (Visas officiellt på din profil)</label>
                       <input name="city" type="text" defaultValue={currentUser.city || ''} placeholder="T.ex Stockholm" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--theme-krypin)', backgroundColor: 'rgba(0,132,118,0.05)', outline: 'none' }} />
                     </div>
                   </div>

                   <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0, fontWeight: '600' }}>Mina Intressen</h4>
                        <PrivacyToggle label="" isVisible={showInterests} onToggle={() => setShowInterests(!showInterests)} />
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Välj vad du gillar att göra så andra kan hitta dig via Sök & Spana.</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                        {INTERESTS.map(interest => (
                          <label key={interest} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={userInterests.includes(interest)} 
                              onChange={(e) => {
                                if (e.target.checked) setUserInterests([...userInterests, interest]);
                                else setUserInterests(userInterests.filter(i => i !== interest));
                              }}
                              style={{ accentColor: 'var(--theme-krypin)', width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                            />
                            {interest}
                          </label>
                        ))}
                      </div>
                   </div>
                </div>
                <button type="submit" style={{ alignSelf: 'flex-start', border: 'none', cursor: 'pointer', backgroundColor: 'var(--theme-krypin)', color: 'white', fontWeight: '600', padding: '0.75rem 2rem', borderRadius: '8px' }}>Spara uppgifter</button>
             </form>
          )}



          {activeTab === 'Support' && (
            activeUserTicketId ? (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '600px', padding: 0, overflow: 'hidden', margin: 0 }}>
                {(() => {
                  const ticket = myTickets.find(t => t.id === activeUserTicketId);
                  if (!ticket) return null;
                  const msgs = ticket.messages || [];
                  if (msgs.length === 0 && ticket.description) {
                    msgs.push({ sender: 'user', text: ticket.description, time: ticket.created_at });
                  }
                  return (
                    <>
                      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <button onClick={() => setActiveUserTicketId(null)} style={{ padding: '0.5rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>&larr; Tillbaka</button>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Supportärende #{ticket.id.split('-')[0]}</h3>
                        </div>
                        <span style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{ticket.status === 'open' ? 'Öppet' : 'Löst (Stängt)'}</span>
                      </div>
                      
                      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-color)' }}>
                        {msgs.map((m: any, i: number) => {
                          const isMe = m.sender === 'user';
                          return (
                            <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column' }}>
                              <div style={{ 
                                padding: '1rem', borderRadius: '12px', 
                                backgroundColor: isMe ? 'var(--theme-forum)' : 'var(--bg-card)', 
                                color: isMe ? 'white' : 'var(--text-main)',
                                border: isMe ? 'none' : '1px solid var(--border-color)',
                                borderBottomRightRadius: isMe ? '2px' : '12px',
                                borderBottomLeftRadius: isMe ? '12px' : '2px',
                                boxShadow: 'var(--shadow-sm)'
                              }}>
                                <p style={{ margin: 0, fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{m.text}</p>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                                {isMe ? 'Du' : 'Facechat Support'} • {new Date(m.time).toLocaleString('sv-SE')}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      
                      {ticket.status === 'open' ? (
                        <form onSubmit={handleUserReply} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', gap: '1rem' }}>
                          <input type="text" value={userReplyText} onChange={e => setUserReplyText(e.target.value)} placeholder="Skriv ett svar..." style={{ flex: 1, padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                          <button type="submit" style={{ backgroundColor: 'var(--theme-forum)', color: 'white', fontWeight: '600', padding: '0 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Skicka</button>
                        </form>
                      ) : (
                        <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#ecfdf5', color: '#059669', fontWeight: 'bold', borderTop: '1px solid #10b981' }}>Ärendet har blivit löst av en Admin och är nu stängt.</div>
                      )}
                    </>
                  )
                })()}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                <form onSubmit={handleSupportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                   <div>
                     <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: '700' }}>Kontakta Admin-Teamet</h3>
                     <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Är det problem på sajten eller vill du anmäla någon? Vi läser allt!</p>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <select 
                          value={supportCategory}
                          onChange={e => setSupportCategory(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                          required
                        >
                          <option value="">Välj Kategori...</option>
                          <option value="Buggrapport">Buggrapport (Tekniskt fel)</option>
                          <option value="Anmäla">Anmäla Användare</option>
                          <option value="BytaNamn">Byta mitt Användarnamn</option>
                          <option value="Övrigt">Övrig Fråga</option>
                        </select>
                        <textarea 
                          value={supportMessage}
                          onChange={e => setSupportMessage(e.target.value)}
                          placeholder="Förklara problemet lugnt och sansat..." 
                          style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', minHeight: '150px', resize: 'vertical' }}
                          required
                        ></textarea>
                      </div>
                   </div>
                   <button type="submit" style={{ alignSelf: 'flex-start', border: 'none', cursor: 'pointer', backgroundColor: 'var(--theme-forum)', color: 'white', fontWeight: '600', padding: '0.75rem 2rem', borderRadius: '8px' }}>Skapa Nytt Ärende</button>
                </form>
                
                {myTickets.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: '700' }}>Skapade Ärenden</h3>
                    {myTickets.map(ticket => {
                      const unread = ticket.has_unread_user;
                      return (
                        <div 
                          key={ticket.id} 
                          onClick={() => { setActiveUserTicketId(ticket.id); markUserRead(ticket.id); }}
                          style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: unread ? '#eff6ff' : 'var(--bg-card)', cursor: 'pointer', position: 'relative' }}
                        >
                          {unread && <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '50%' }} />}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>#{ticket.id.split('-')[0]} - {ticket.category}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ticket.status === 'open' ? 'Öppet' : 'Löst'}</span>
                              <button onClick={(e) => handleDeleteTicket(ticket.id, e)} style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.7, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Radera ärendet">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-main)' }}>{unread ? <strong style={{ color: '#3b82f6' }}>Nytt svar från Admin! Klicka för att läsa.</strong> : 'Klicka för att se hela konversationen.'}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          )}

        </div>
      </div>
    </div>
  );
}

const SettingsIcon = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
)
