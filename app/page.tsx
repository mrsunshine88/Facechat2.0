"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { LayoutGrid, User, MessagesSquare, MessageSquare } from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const [nickname, setNickname] = useState('Användare')
  const [loading, setLoading] = useState(true)
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  )

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (user) {
        if (!user.email_confirmed_at) {
          await supabase.auth.signOut();
          router.push('/login?error=Du måste bekräfta din e-postadress innan du kan logga in.');
          return;
        }
        const { data: profList } = await supabase.from('profiles').select('username').eq('id', user.id).limit(1)
        const profile = profList && profList.length > 0 ? profList[0] : null
        if (profile?.username) {
          setNickname(profile.username)
        } else if (user.email) {
          setNickname(user.email.split('@')[0])
        }
      }
      setLoading(false)
    }
    getUser()
  }, [])

  const shortcuts = [
    {
      title: "Whiteboard",
      description: "Ditt personliga nyhetsflöde! Här ser du vad dina vänner gör just nu, läser deras inlägg och delar med dig av vad som händer i ditt eget liv.",
      icon: LayoutGrid,
      path: "/whiteboard",
      color: "#38bdf8", 
      bg: "rgba(56, 189, 248, 0.1)",
      border: "rgba(56, 189, 248, 0.2)"
    },
    {
      title: "Mitt Krypin",
      description: "Din egen profil. Här kan folk hälsa på, skriva i din gästbok, skicka privata mejl eller skicka en vänförfrågan för att bli polare.",
      icon: User,
      path: "/krypin",
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.1)",
      border: "rgba(16, 185, 129, 0.2)"
    },
    {
      title: "Forum",
      description: "Här diskuterar vi allt mellan himmel och jord i olika trådar. Perfekt för längre samtal.",
      icon: MessagesSquare,
      path: "/forum",
      color: "#a78bfa",
      bg: "rgba(167, 139, 250, 0.1)",
      border: "rgba(167, 139, 250, 0.2)"
    },
    {
      title: "Chattrum",
      description: "Snacka i realtid! Gå in i olika rum och chatta direkt med de som är online just nu.",
      icon: MessageSquare,
      path: "/chattrum",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.1)",
      border: "rgba(245, 158, 11, 0.2)"
    }
  ]

  if (loading) return null

  return (
    <div style={{ 
       backgroundColor: 'var(--bg-color)',
       minHeight: 'calc(100vh - 64px)', 
       marginLeft: '-1rem', marginRight: '-1rem', marginTop: '-2rem', marginBottom: '-2rem',
       padding: '4rem 1rem',
       display: 'flex',
       flexDirection: 'column',
       alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1000px', width: '100%' }}>
        
        {/* Välkomsttext */}
        <div style={{ marginBottom: '4rem', textAlign: 'center' }}>
          <h1 className="animate-fade-in" style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
            Välkommen till Facechat, <span style={{ color: 'var(--theme-primary)' }}>{nickname}</span>!
          </h1>
          <p className="animate-fade-in" style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
            Här är dina verktyg. Klicka på en ruta för att gå vidare:
          </p>
        </div>

        {/* Grid med Genvägar */}
        <div className="dashboard-grid">
          {shortcuts.map((item, idx) => (
            <div 
              key={idx}
              onClick={() => router.push(item.path)}
              className="dashboard-card animate-fade-in"
              style={{ 
                animationDelay: `${idx * 0.1}s`,
                animationFillMode: 'both',
                padding: '2rem', 
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                border: `1px solid var(--border-color)`,
                borderRadius: '16px',
                backgroundColor: 'var(--bg-card)',
                boxShadow: 'var(--shadow-md)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div className="icon-wrapper" style={{ 
                width: '64px', height: '64px', 
                borderRadius: '16px', 
                backgroundColor: item.bg, 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.3s ease'
              }}>
                <item.icon size={32} color={item.color} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>{item.title}</h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>{item.description}</p>
              </div>
            </div>
          ))}
        </div>

      </div>

      <style>{`
        .dashboard-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1) !important;
          border-color: var(--theme-primary) !important;
        }
        .dashboard-card:hover .icon-wrapper {
          transform: scale(1.1) rotate(-5deg);
        }
      `}</style>
    </div>
  )
}

