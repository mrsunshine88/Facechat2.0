"use client"

import React, { useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function BannedPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Tvinga utloggning så fort de landar här
    supabase.auth.signOut();
  }, [supabase]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#0f172a', 
      color: 'white',
      fontFamily: 'sans-serif',
      padding: '2rem'
    }}>
      <div style={{ 
        maxWidth: '500px', 
        width: '100%', 
        backgroundColor: '#1e293b', 
        padding: '3rem', 
        borderRadius: '24px', 
        textAlign: 'center',
        border: '2px solid #ef4444',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          color: '#ef4444', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 1.5rem auto'
        }}>
          <ShieldAlert size={48} />
        </div>
        
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ef4444' }}>
          Konto permanent blockat
        </h1>
        
        <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '2rem' }}>
          Din profil har blivit permanent avstängd från Facechat på grund av brott mot våra medlemsvillkor. 
          Du kan inte längre logga in eller använda plattformens tjänster.
        </p>

        <a 
          href="/" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            textDecoration: 'none', 
            color: '#94a3b8', 
            fontWeight: 'bold', 
            fontSize: '0.9rem',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid #334155'
          }}
        >
          <LogOut size={16} /> Tillbaka till startsidan
        </a>
      </div>
    </div>
  );
}
