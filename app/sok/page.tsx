"use client"

import React from 'react';
import { Search, Filter, UserPlus } from 'lucide-react';

const CITIES = ["Alingsås", "Arvika", "Askersund", "Avesta", "Boden", "Bollnäs", "Borgholm", "Borlänge", "Borås", "Bräkne-Hoby", "Bålsta", "Båstad", "Djursholm", "Eksjö", "Enköping", "Eskilstuna", "Eslöv", "Fagersta", "Falkenberg", "Falköping", "Falun", "Filipstad", "Flen", "Gislaved", "Gävle", "Göteborg", "Hagfors", "Halla", "Halmstad", "Haparanda", "Hedemora", "Helsingborg", "Hjo", "Hudiksvall", "Huskvarna", "Härnösand", "Hässleholm", "Höganäs", "Jämjö", "Jönköping", "Kallinge", "Kalmar", "Karlshamn", "Karlskoga", "Karlskrona", "Karlstad", "Katrineholm", "Kiruna", "Kramfors", "Kristianstad", "Kristinehamn", "Kumla", "Kungsbacka", "Kungälv", "Köping", "Laholm", "Landskrona", "Lerum", "Lidingö", "Lidköping", "Lindesberg", "Linköping", "Listerby", "Ljungby", "Lomma", "Ludvika", "Luleå", "Lund", "Lycksele", "Lysekil", "Malmö", "Mariefred", "Mariestad", "Marstrand", "Motala", "Mölndal", "Mölnlycke", "Mörrum", "Nacka", "Nora", "Norrköping", "Norrtälje", "Nybro", "Nyköping", "Nynäshamn", "Nässjö", "Nättraby", "Olofström", "Oskarshamn", "Piteå", "Ramdala", "Ronneby", "Rödeby", "Sala", "Sandviken", "Sigtuna", "Simrishamn", "Skanör med Falsterbo", "Skara", "Skellefteå", "Skänninge", "Skövde", "Sollefteå", "Solna", "Staffanstorp", "Stockholm", "Strängnäs", "Strömstad", "Sundsvall", "Säffle", "Säter", "Sävsjö", "Söderhamn", "Söderköping", "Södertälje", "Sölvesborg", "Tidaholm", "Timrå", "Torshälla", "Tranås", "Trelleborg", "Trollhättan", "Trosa", "Tyresö", "Täby", "Uddevalla", "Ulricehamn", "Umeå", "Uppsala", "Vadstena", "Vallentuna", "Varberg", "Vaxholm", "Vetlanda", "Vimmerby", "Visby", "Vänersborg", "Värnamo", "Västervik", "Västerås", "Växjö", "Ystad", "Åkersberga", "Åmål", "Ängelholm", "Örebro", "Öregrund", "Örnsköldsvik", "Östersund", "Östhammar"].sort((a, b) => a.localeCompare(b, 'sv-SE'));

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
].sort((a,b)=>a.localeCompare(b,'sv-SE'));

export default function SokOchSpana() {
  const [people, setPeople] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCity, setSelectedCity] = React.useState('Alla Städer');
  const [selectedInterest, setSelectedInterest] = React.useState('Alla Intressen');
  const [onlineOnly, setOnlineOnly] = React.useState(true);
  const [friends, setFriends] = React.useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = React.useState<string[]>([]);
  const [viewerId, setViewerId] = React.useState<string | null>(null);
  const [blockedUserIds, setBlockedUserIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    async function fetchPeople() {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
         setViewerId(user.id);
         
         const { data: rels } = await supabase.from('friendships')
            .select('user_id_1, user_id_2, status, action_user_id')
            .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);
         
         if (rels) {
            setFriends(rels.filter(r => r.status === 'accepted').map(r => r.user_id_1 === user.id ? r.user_id_2 : r.user_id_1));
            setPendingRequests(rels.filter(r => r.status === 'pending').map(r => r.user_id_1 === user.id ? r.user_id_2 : r.user_id_1));
         }
          
          const { data: bData } = await supabase.from('user_blocks').select('*')
              .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
          if (bData) {
              setBlockedUserIds(bData.map((b: any) => b.blocker_id === user.id ? b.blocked_id : b.blocker_id));
          }
      }
      
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(40);
      if (user) {
        query = query.neq('id', user.id);
      }
      
      const { data } = await query;
      if (data) setPeople(data);
    }
    fetchPeople();
  }, []);

  const handleAddFriend = async (e: React.MouseEvent, personId: string) => {
    e.stopPropagation();
    if (!viewerId) return;
    if (blockedUserIds.includes(personId)) {
        alert("Du kan inte lägga till en blockerad person som vän.");
        return;
    }
    
    const { createBrowserClient } = await import('@supabase/ssr');
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Check if reverse request exists
    const { data: existing } = await supabase.from('friendships')
      .select('*')
      .or(`and(user_id_1.eq.${personId},user_id_2.eq.${viewerId}),and(user_id_1.eq.${viewerId},user_id_2.eq.${personId})`)
      .single();
      
    if (existing) {
       // Make it 'accepted' if pending from the other side, or ignore
       if (existing.status === 'pending' && existing.action_user_id === personId) {
          await supabase.from('friendships').update({ status: 'accepted', action_user_id: viewerId }).eq('id', existing.id);
          setFriends([...friends, personId]);
          alert("Ni är nu vänner eftersom personen redan skickat en förfrågan till dig!");
       } else {
          alert("En förfrågan finns redan!");
       }
       return;
    }

    const { error } = await supabase.from('friendships').insert({
      user_id_1: viewerId,
      user_id_2: personId,
      status: 'pending',
      action_user_id: viewerId
    });
    
    if (!error) {
      setPendingRequests([...pendingRequests, personId]);
    } else {
      alert("Ett fel uppstod: " + error.message);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: 'var(--text-main)', fontWeight: '800' }}>Sök & Spana</h1>
      
      {/* Sök och Filter */}
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Sök efter namn..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '1rem 1rem 1rem 3.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem', outline: 'none', backgroundColor: '#f8fafc' }}
            />
          </div>
          <button style={{ backgroundColor: 'var(--theme-search)', color: 'white', fontWeight: '600', padding: '0 2.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.125rem' }}>
             Sök
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', fontSize: '0.875rem' }}>
            <Filter size={16} /> Filter:
          </span>
          <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: '500' }}>
            <option value="Alla Städer">Alla Städer</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={selectedInterest} onChange={(e) => setSelectedInterest(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: '500' }}>
            <option value="Alla Intressen">Alla Intressen</option>
            {INTERESTS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#f1f5f9', padding: '0.5rem 1rem', borderRadius: '999px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
            <label htmlFor="online-only" style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.875rem', cursor: 'pointer' }}>Endast inloggade just nu</label>
            <input type="checkbox" id="online-only" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} style={{ outline: 'none', cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      {/* Grid view */}
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)', fontWeight: '600' }}>Kanske känner du...</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {people
          .filter(person => !blockedUserIds.includes(person.id))
          .filter(person => selectedCity === 'Alla Städer' || person.city === selectedCity)
          .filter(person => selectedInterest === 'Alla Intressen' || (person.interests && person.interests.includes(selectedInterest)))
          .filter(person => !searchQuery || (person.username && person.username.toLowerCase().includes(searchQuery.toLowerCase())))
          .filter(person => {
             if (!onlineOnly) return true;
             if (!person.last_seen) return false;
             const lastSeenDate = new Date(person.last_seen);
             const now = new Date();
             return (now.getTime() - lastSeenDate.getTime()) <= 15 * 60 * 1000;
          })
          .map((person, index) => {
            const isFriend = friends.includes(person.id);
            const isPending = pendingRequests.includes(person.id);
            const isOnline = person.last_seen ? (new Date().getTime() - new Date(person.last_seen).getTime()) <= 15 * 60 * 1000 : false;

            return (
              <div key={index} className="card" onClick={() => window.location.href = `/krypin?u=${person.username}`} style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 0, position: 'relative', transition: 'transform 0.2s', cursor: 'pointer' }}>
                <div title={isOnline ? 'Inloggad just nu' : 'Offline'} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', width: '12px', height: '12px', backgroundColor: isOnline ? '#22c55e' : '#ef4444', borderRadius: '50%', border: '2px solid white' }}></div>
                <div style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#e2e8f0', marginBottom: '1.25rem', overflow: 'hidden' }}>
                  {person.avatar_url && <img src={person.avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="Avatar" />}
                </div>
                <h3 className="user-link" style={{ fontSize: '1.125rem', marginBottom: '0.25rem', textAlign: 'center' }}>{person.username || 'Okänd'}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: '500' }}>📍 {person.city || 'Okänd ort'}</p>
                
                {isFriend ? (
                  <button onClick={(e) => e.stopPropagation()} style={{ width: '100%', backgroundColor: '#f0fdf4', color: '#166534', fontWeight: '600', padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '1px solid #bbf7d0', cursor: 'default' }}>
                    <UserPlus size={18} /> ✅ Vänner
                  </button>
                ) : isPending ? (
                  <button onClick={(e) => e.stopPropagation()} style={{ width: '100%', backgroundColor: '#fef3c7', color: '#92400E', fontWeight: '600', padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '1px solid #fde68a', cursor: 'default' }}>
                    <UserPlus size={18} /> Förfrågan skickad
                  </button>
                ) : (
                  <button onClick={(e) => handleAddFriend(e, person.id)} style={{ width: '100%', backgroundColor: '#eff6ff', color: 'var(--theme-primary)', fontWeight: '600', padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer' }} className="hover-split-color">
                    <UserPlus size={18} /> Bli vän
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
