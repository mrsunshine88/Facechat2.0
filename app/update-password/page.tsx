"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Shield } from 'lucide-react'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  
  const supabase = createClient()
  
  // Kontrollera att det finns en aktiv återställnings-session
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Saknas session (ingen giltig länk användes) -> Skicka tillbaka till login
        router.push('/login?error=Länken+är+inte+längre+giltig+eller+saknas.');
      }
    }
    checkSession();
  }, [supabase, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken långt.')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })
      if (updateError) throw updateError
      
      // Logga ut sessionen permanent så inte länken blir en "bakdörr" om vi backar webbläsaren
      await supabase.auth.signOut()
      
      // Omdirigera till inloggning med meddelande
      router.push('/login?message=Lösenordet+har+ändrats!+Logga+in+med+ditt+nya+lösenord.')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Ett fel uppstod när lösenordet skulle sparas.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f3f6', padding: '1rem' }}>
      <div style={{ marginBottom: '3rem', textAlign: 'center', maxWidth: '800px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '900', color: '#43619c', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>Facechat</h1>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '3rem 2.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', borderRadius: '16px', backgroundColor: 'white' }}>
        <div style={{ width: '64px', height: '64px', backgroundColor: '#e0e7ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#43619c' }}>
            <Shield size={32} />
        </div>
        
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-main)', fontWeight: '700' }}>
          Välj nytt lösenord
        </h2>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', marginBottom: '0.5rem' }}>
            Ange ett nytt lösenord för ditt konto.
          </p>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>Nytt lösenord</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#f9fafb' }} 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--theme-primary)', color: 'white', borderRadius: '8px', fontWeight: '700', fontSize: '1.1rem', marginTop: '0.5rem', opacity: loading ? 0.7 : 1, cursor: 'pointer' }}
          >
            {loading ? 'Sparar...' : 'Spara nytt lösenord'}
          </button>
        </form>
      </div>
    </div>
  )
}
