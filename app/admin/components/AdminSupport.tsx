"use client"

import React, { useState, useEffect } from 'react';
import { CheckCircle, Trash2, MessageSquare, Send, Bell, AlertCircle, Clock } from 'lucide-react';
import { adminDeleteSupportTicket } from '../../actions/adminActions';
import { adminLogAction } from '@/app/actions/auditActions';

const AdminSupport = ({ supabase, currentUser }: { supabase: any, currentUser: any }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchTickets();

    const channel = supabase.channel('admin_support_realtime_' + currentUser?.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, fetchTickets)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser?.id]);

  async function fetchTickets() {
    // Hide tickets soft-deleted by admin!
    const { data } = await supabase.from('support_tickets').select('*, profiles(username)').eq('admin_deleted', false).order('created_at', { ascending: false });
    if (data) setTickets(data);
  }

  const markResolved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    await supabase.from('support_tickets').update({ status: 'closed', has_unread_admin: false }).eq('id', id);
    await adminLogAction(`Stängde supportärende (${id}) skapat av ${ticket.profiles?.username || 'Okänd'}`, ticket.user_id);
    
    // NOTIFIERA ANVÄNDAREN!
    const msg = `Ditt supportärende #${id.split('-')[0]} har markerats som LÖST av en admin. 🎉`;
    await supabase.from('notifications').insert({
       receiver_id: ticket.user_id,
       actor_id: currentUser.id,
       type: 'admin_alert',
       content: msg,
       link: '/minasidor?tab=Support'
    });

    fetch('/api/send-push', {
       method: 'POST', body: JSON.stringify({
         userId: ticket.user_id,
         title: '✅ Supportärende Löst!',
         message: msg,
         url: '/minasidor?tab=Support'
       }), headers: { 'Content-Type': 'application/json' }
    }).catch(console.error);

    fetchTickets();
    if (activeTicketId === id) setActiveTicketId(null);
  };

  const handleDeleteTicket = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Är du säker på att du vill radera detta supportärende permanent?')) {
      const res = await adminDeleteSupportTicket(id);
      if (res?.error) return alert('Kunde inte radera: ' + res.error);
      const t = tickets.find(x => x.id === id);
      await adminLogAction(`Raderade supportärende (${id}) skapat av ${t?.profiles?.username || 'Okänd'}`);
      fetchTickets();
      if (activeTicketId === id) setActiveTicketId(null);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicketId) return;
    const ticket = tickets.find(t => t.id === activeTicketId);
    if (!ticket) return;

    const currentMsg = ticket.messages || [];
    // Fallback om den första "description" inte finns i arrayen
    if (currentMsg.length === 0 && ticket.description) {
      currentMsg.push({ sender: 'user', text: ticket.description, time: ticket.created_at });
    }

    const newMsgs = [...currentMsg, { sender: 'admin', text: replyText.trim(), time: new Date().toISOString() }];

    await supabase.from('support_tickets').update({
      messages: newMsgs,
      has_unread_user: true,
      has_unread_admin: false
    }).eq('id', activeTicketId);

    // NOTIFIERA ANVÄNDAREN OM SVARET!
    const msg = `Du har fått ett nytt svar från Admin i ditt supportärende #${activeTicketId.split('-')[0]}.`;
    await supabase.from('notifications').insert({
       receiver_id: ticket.user_id,
       actor_id: currentUser.id,
       type: 'admin_alert',
       content: msg,
       link: '/minasidor?tab=Support'
    });
    fetch('/api/send-push', {
       method: 'POST', body: JSON.stringify({
         userId: ticket.user_id,
         title: '💬 Nytt svar från Support!',
         message: msg,
         url: '/minasidor?tab=Support'
       }), headers: { 'Content-Type': 'application/json' }
    }).catch(console.error);

    setReplyText('');
    await adminLogAction(`Svarade på supportärende (${activeTicketId}) till ${ticket.profiles?.username || 'Okänd'}`, ticket.user_id);
    fetchTickets();
  };

  const markAsRead = async (id: string) => {
    const ticket = tickets.find(t => t.id === id);
    if (ticket && ticket.has_unread_admin) {
      await supabase.from('support_tickets').update({ has_unread_admin: false }).eq('id', id);
      await adminLogAction(`Öppnade/läste supportärende (${id}) från ${ticket.profiles?.username || 'Okänd'}`);
      fetchTickets();
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Supportärenden</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Klicka på ett ärende för att svara personen direkt i en chatt. Markera som lösta när ni är klara.</p>

      {activeTicketId ? (
        <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', height: '600px', padding: 0, overflow: 'hidden' }}>
          {(() => {
            const ticket = tickets.find(t => t.id === activeTicketId);
            if (!ticket) return null;
            const msgs = ticket.messages || [];
            if (msgs.length === 0 && ticket.description) {
              msgs.push({ sender: 'user', text: ticket.description, time: ticket.created_at });
            }
            return (
              <>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => setActiveTicketId(null)} style={{ padding: '0.5rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>&larr; Tillbaka</button>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Ticket #{ticket.id.split('-')[0]} - {ticket.profiles?.username || 'Okänd'}</h3>
                  </div>
                  <span style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{ticket.category}</span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-color)' }}>
                  {msgs.map((m: any, i: number) => {
                    const isAdminMsg = m.sender === 'admin';
                    return (
                      <div key={i} style={{ alignSelf: isAdminMsg ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                          padding: '1rem', borderRadius: '12px',
                          backgroundColor: isAdminMsg ? '#2563eb' : 'white',
                          color: isAdminMsg ? 'white' : '#1e293b',
                          border: isAdminMsg ? 'none' : '1px solid var(--border-color)',
                          borderBottomRightRadius: isAdminMsg ? '2px' : '12px',
                          borderBottomLeftRadius: isAdminMsg ? '12px' : '2px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                          <p style={{ margin: 0, fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{m.text}</p>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', alignSelf: isAdminMsg ? 'flex-end' : 'flex-start' }}>
                          {isAdminMsg ? 'Du (Admin)' : (ticket.profiles?.username || 'Okänd')} • {new Date(m.time).toLocaleString('sv-SE')}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {ticket.status === 'open' ? (
                  <form onSubmit={handleReply} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'white', display: 'flex', gap: '1rem' }}>
                    <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Skriv ditt adminsvar..." style={{ flex: 1, padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
                    <button type="submit" style={{ backgroundColor: '#2563eb', color: 'white', fontWeight: '600', padding: '0 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Skicka Svar</button>
                    <button type="button" onClick={(e) => markResolved(ticket.id, e)} style={{ backgroundColor: '#10b981', color: 'white', fontWeight: '600', padding: '0 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={18} /> Lös</button>
                  </form>
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#ecfdf5', color: '#059669', fontWeight: 'bold', borderTop: '1px solid #10b981' }}>Ärendet är stängt pga löst.</div>
                )}
              </>
            )
          })()}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tickets.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga supportärenden finns.</p>}
          {tickets.map(ticket => {
            const isUnread = ticket.has_unread_admin === true;
            return (
              <div
                key={ticket.id}
                onClick={() => { setActiveTicketId(ticket.id); markAsRead(ticket.id); }}
                className="admin-card admin-responsive-card"
                style={{
                  display: 'flex', flexDirection: 'column', gap: '1rem',
                  borderLeft: `4px solid ${ticket.category.includes('Bug') ? '#ef4444' : ticket.category.includes('Anm') ? '#f59e0b' : '#3b82f6'}`,
                  opacity: ticket.status === 'closed' ? 0.6 : 1,
                  cursor: 'pointer',
                  backgroundColor: isUnread ? '#fffbeb' : 'var(--bg-card)',
                  transition: 'transform 0.2s', position: 'relative'
                }}
              >
                {isUnread && <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>NYTT SVAR</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Ticket #{ticket.id.split('-')[0]} - {ticket.profiles?.username || 'Okänd'}</h3>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(ticket.created_at).toLocaleString('sv-SE')} • {ticket.category}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {ticket.status === 'open' ? (
                      <button onClick={(e) => markResolved(ticket.id, e)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle size={14} /> Markera Löst
                      </button>
                    ) : (
                      <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem' }}>STÄNGD ✅</span>
                    )}
                    <button onClick={(e) => handleDeleteTicket(ticket.id, e)} style={{ backgroundColor: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      <Trash2 size={14} /> Radera
                    </button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {ticket.messages && ticket.messages.length > 0 ? ticket.messages[ticket.messages.length - 1].text : ticket.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  <MessageSquare size={16} /> {ticket.messages?.length || 1} meddelande(n)
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSupport;
