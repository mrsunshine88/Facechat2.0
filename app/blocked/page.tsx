"use client"

import React, { useState, useEffect, useRef } from 'react'
import { ShieldAlert, Mail, ArrowLeft, Lock, Send, MessageSquare, User, LifeBuoy, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { updateUserIP } from '@/app/actions/securityActions'

export default function BlockedPage() {
  const router = useRouter()
  const [showChat, setShowChat] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [activeTicket, setActiveTicket] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setCurrentUser(session.user)
        updateUserIP(session.user.id)
        fetchTickets(session.user.id)
      } else {
        setLoading(false)
      }
    }
    init()

    // Realtime listener for support updates
    const channel = supabase.channel('blocked_support_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        if (currentUser?.id) fetchTickets(currentUser.id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeTicket?.messages, showChat])

  async function fetchTickets(userId: string) {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .eq('admin_deleted', false)
      .order('created_at', { ascending: false })
    
    if (data) {
      setTickets(data)
      if (data.length > 0) {
        // Om ett ärende är öppet, välj det senaste
        const openTicket = data.find(t => t.status === 'open') || data[0]
        setActiveTicket(openTicket)
      }
    }
    setLoading(false)
  }

  const handleCreateTicket = async () => {
    if (!message.trim() || !currentUser) return
    setSending(true)

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: currentUser.id,
        category: 'Spärrad IP / Överklagan',
        description: message.trim(),
        status: 'open',
        messages: [{ sender: 'user', text: message.trim(), time: new Date().toISOString() }],
        has_unread_admin: true
      })
      .select()
      .single()

    if (error) {
      alert('Kunde inte skicka ärendet: ' + error.message)
    } else {
      setMessage('')
      fetchTickets(currentUser.id)
    }
    setSending(false)
  }

  const handleReply = async () => {
    if (!message.trim() || !activeTicket) return
    setSending(true)

    const updatedMessages = [
      ...(activeTicket.messages || []),
      { sender: 'user', text: message.trim(), time: new Date().toISOString() }
    ]

    const { error } = await supabase
      .from('support_tickets')
      .update({
        messages: updatedMessages,
        has_unread_admin: true,
        has_unread_user: false
      })
      .eq('id', activeTicket.id)

    if (error) {
      alert('Kunde inte skicka meddelandet: ' + error.message)
    } else {
      setMessage('')
      fetchTickets(currentUser.id)
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        Laddar säkerhetssystem...
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#0f172a', 
      background: 'radial-gradient(circle at center, #1e1b4b 0%, #020617 100%)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ 
        maxWidth: showChat ? '800px' : '500px', 
        width: '100%', 
        backgroundColor: 'rgba(30, 41, 59, 0.5)', 
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '24px',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(220, 38, 38, 0.1)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        
        {!showChat ? (
          <>
            {/* ICON CONTAINER */}
            <div style={{ 
              width: '80px', 
              height: '80px', 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
            }}>
              <ShieldAlert size={40} color="#ef4444" strokeWidth={1.5} />
            </div>

            <h1 style={{ color: 'white', fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.75rem' }}>
              Åtkomst Nekad 🛡️
            </h1>

            <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '2rem', fontSize: '1rem' }}>
              Din IP-adress har spärrats pga upprepade regelöverträdelser eller spam. 
              Om du anser att detta är felaktigt kan du överklaga här nedan.
            </p>

            <div style={{ backgroundColor: 'rgba(2, 6, 23, 0.4)', borderRadius: '16px', padding: '1.25rem', marginBottom: '2rem', textAlign: 'left', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Lock size={16} color="#ef4444" />
                <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  Status: Permanent Spärrad
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                Automatiska skyddssystem har identifierat din anslutning som en risk.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowChat(true)}
                style={{ backgroundColor: '#2563eb', color: 'white', padding: '1rem', borderRadius: '14px', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
              >
                <MessageSquare size={18} /> Öppna Support-ärende
              </button>

              <button 
                onClick={() => router.push('/')}
                style={{ backgroundColor: 'transparent', color: '#94a3b8', padding: '1rem', borderRadius: '14px', fontWeight: '600', border: '1px solid rgba(148, 163, 184, 0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={18} /> Försök igen
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'left', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.5rem', backgroundColor: '#2563eb22', borderRadius: '12px', border: '1px solid #2563eb66' }}>
                   <LifeBuoy size={24} color="#3b82f6" />
                </div>
                <div>
                  <h2 style={{ color: 'white', fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Support & Överklagan</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Direktkontakt med Admin-Teamet</p>
                </div>
              </div>
              <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem' }}>
                <ArrowLeft size={20} />
              </button>
            </div>

            {!activeTicket ? (
              <div style={{ padding: '2rem 0' }}>
                <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>Skapa ett nytt ärende</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Förklara varför du anser att spärren bör hävas. Vi läser alla meddelanden.</p>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Skriv ditt meddelande här..."
                  style={{ width: '100%', padding: '1rem', borderRadius: '12px', backgroundColor: 'rgba(2, 6, 23, 0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', minHeight: '150px', outline: 'none', marginBottom: '1rem' }}
                />
                <button 
                  disabled={sending || !message.trim()}
                  onClick={handleCreateTicket}
                  style={{ width: '100%', backgroundColor: '#2563eb', color: 'white', padding: '1rem', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: (sending || !message.trim()) ? 0.5 : 1 }}
                >
                   {sending ? 'Skickar...' : <><Send size={18} /> Skicka Ärende</>}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
                {/* CHAT THREAD */}
                <div 
                  ref={scrollRef}
                  style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'rgba(2, 6, 23, 0.2)', borderRadius: '12px', marginBottom: '1rem' }}
                >
                  {activeTicket.messages?.map((msg: any, i: number) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ 
                        maxWidth: '85%', 
                        padding: '0.75rem 1rem', 
                        borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        backgroundColor: msg.sender === 'user' ? '#2563eb' : 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '0.95rem'
                      }}>
                        {msg.text}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', padding: '0 0.5rem' }}>
                        {msg.sender === 'admin' ? 'Admin' : 'Du'} • {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {activeTicket.status === 'closed' && (
                    <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '0.85rem' }}>
                      Detta ärende har markerats som löst/avslutat. ✅
                    </div>
                  )}
                </div>

                {/* REPLY INPUT */}
                {activeTicket.status === 'open' && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input 
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleReply()}
                      placeholder="Skriv ett svar..."
                      style={{ flex: 1, padding: '0.875rem 1.25rem', borderRadius: '12px', backgroundColor: 'rgba(2, 6, 23, 0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                    />
                    <button 
                      disabled={sending || !message.trim()}
                      onClick={handleReply}
                      style={{ padding: '0.875rem 1.25rem', backgroundColor: '#2563eb', color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', opacity: (sending || !message.trim()) ? 0.5 : 1 }}
                    >
                      <Send size={20} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LOGO FOOTER */}
        <div style={{ marginTop: '2.5rem', opacity: 0.2 }}>
           <h2 style={{ fontSize: '1.25rem', color: 'white', letterSpacing: '0.1em', fontWeight: '400' }}>FACECHAT</h2>
        </div>
      </div>
    </div>
  )
}
