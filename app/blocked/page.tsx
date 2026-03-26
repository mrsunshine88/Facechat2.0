"use client"

import React from 'react'
import { ShieldAlert, Mail, ArrowLeft, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function BlockedPage() {
  const router = useRouter()

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
        maxWidth: '500px', 
        width: '100%', 
        backgroundColor: 'rgba(30, 41, 59, 0.5)', 
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '24px',
        padding: '3rem 2rem',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(220, 38, 38, 0.1)'
      }}>
        {/* ICON CONTAINER */}
        <div style={{ 
          width: '80px', 
          height: '80px', 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          borderRadius: '24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: '0 auto 2rem',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
        }}>
          <ShieldAlert size={40} color="#ef4444" strokeWidth={1.5} />
        </div>

        {/* TITLE */}
        <h1 style={{ 
          color: 'white', 
          fontSize: '2rem', 
          fontWeight: '800', 
          marginBottom: '1rem',
          letterSpacing: '-0.02em' 
        }}>
          Åtkomst Nekad 🛡️
        </h1>

        {/* DESCRIPTION */}
        <p style={{ 
          color: '#94a3b8', 
          lineHeight: '1.6', 
          marginBottom: '2.5rem',
          fontSize: '1.05rem' 
        }}>
          Din IP-adress har spärrats från att använda Facechat på grund av upprepade regelöverträdelser eller misstänkt spam-aktivitet.
        </p>

        {/* INFO BOX */}
        <div style={{ 
          backgroundColor: 'rgba(2, 6, 23, 0.4)', 
          borderRadius: '16px', 
          padding: '1.25rem',
          marginBottom: '2.5rem',
          textAlign: 'left',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Lock size={16} color="#ef4444" />
            <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Säkerhetsstatus: Spärrad
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Automatiska skyddssystem identifierade din anslutning som en risk för communityt.
          </p>
        </div>

        {/* ACTIONS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button 
            onClick={() => window.location.href = 'mailto:support@facechat.se'}
            style={{ 
              backgroundColor: '#ef4444', 
              color: 'white', 
              padding: '1rem', 
              borderRadius: '14px', 
              fontWeight: '700', 
              border: 'none', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Mail size={18} /> Kontakta Support
          </button>

          <button 
            onClick={() => router.push('/')}
            style={{ 
              backgroundColor: 'transparent', 
              color: '#94a3b8', 
              padding: '1rem', 
              borderRadius: '14px', 
              fontWeight: '600', 
              border: '1px solid rgba(148, 163, 184, 0.2)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ArrowLeft size={18} /> Försök igen
          </button>
        </div>

        {/* LOGO FOOTER */}
        <div style={{ marginTop: '3rem', opacity: 0.3 }}>
           <h2 style={{ fontSize: '1.25rem', color: 'white', letterSpacing: '0.1em', fontWeight: '400' }}>FACECHAT</h2>
        </div>
      </div>
    </div>
  )
}
