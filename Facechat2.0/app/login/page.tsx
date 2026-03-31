"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { LayoutGrid, User, MessagesSquare, Smartphone, Shield, Users } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [acceptedEula, setAcceptedEula] = useState(false)
  const [showEula, setShowEula] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  
  // Ladda ev. sparad mejl från localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem('facechat_saved_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const msg = urlParams.get('message');
      const err = urlParams.get('error');
      if (msg) setError(msg);
      if (err) setError(err);
    }
  }, [])
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isRegistering) {
        if (username.trim().length < 3) {
          setError('Användarnamnet måste vara minst 3 tecken.');
          setLoading(false);
          return;
        }

        // Kolla om användarnamnet redan är upptaget innan vi registrerar
        const { data: existing } = await supabase.from('profiles').select('id').ilike('username', username.trim()).limit(1);
        if (existing && existing.length > 0) {
          setError('Detta användarnamn är tyvärr redan upptaget!');
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim()
            }
          }
        })
        if (signUpError) throw signUpError
        setError("Registrering lyckades! Du kan nu logga in bäst du vill.")
        setIsRegistering(false)
        setUsername('')
        setPassword('')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (signInError) throw signInError
        
        if (rememberMe) {
          localStorage.setItem('facechat_saved_email', email)
        } else {
          localStorage.removeItem('facechat_saved_email')
        }
        
        router.push('/')
        router.refresh()
      }
    } catch (err: any) {
      if (err.message === 'Invalid login credentials') {
        setError('Fel e-postadress eller lösenord. Försök igen!')
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Du måste bekräfta din e-postadress först.')
      } else {
        setError(err.message || 'Ett fel uppstod vid inloggningen')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })
      if (resetError) throw resetError
      setError("En återställningslänk har skickats till din e-post! (Kolla även skräpposten)")
      setIsForgotPassword(false)
    } catch (err: any) {
      setError(err.message || 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f3f6', padding: '3rem 1rem' }}>
      
      {/* Header & Slogan */}
      <div style={{ marginBottom: '3rem', textAlign: 'center', maxWidth: '800px' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: '900', color: '#43619c', textShadow: '2px 2px 0px rgba(0,0,0,0.1)', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>Facechat</h1>
        <h2 style={{ fontSize: '1.5rem', color: '#475569', fontWeight: '600', margin: '0' }}>
          Sveriges skönaste community - Här möts vänner för att dela livet.
        </h2>
      </div>

      {/* Main Content Area (Login Box Centered) */}
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '5rem' }}>
        
        {/* DO NOT TOUCH LOGIN BOX INSIDES */}
        <div className="card login-box" style={{ width: '100%', maxWidth: '420px', padding: '3rem 2.5rem', margin: 0, boxShadow: '0 20px 40px rgba(0,0,0,0.08)', borderRadius: '16px', backgroundColor: 'white' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-main)', fontWeight: '700' }}>
          {isForgotPassword ? 'Återställ lösenord' : isRegistering ? 'Skapa ett krypin' : 'Logga in'}
        </h2>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: (error.includes('lyckades') || error.includes('ändrats') || error.includes('skickats')) ? '#d1fae5' : '#fee2e2', color: (error.includes('lyckades') || error.includes('ändrats') || error.includes('skickats')) ? '#059669' : '#b91c1c', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', marginBottom: '0.5rem' }}>
              Ange din e-postadress nedan så skickar vi en länk för att återställa ditt lösenord.
            </p>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>E-postadress</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din.mejl@exempel.se"
                required
                style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#f9fafb' }} 
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--theme-primary)', color: 'white', borderRadius: '8px', fontWeight: '700', fontSize: '1.1rem', marginTop: '0.5rem', opacity: loading ? 0.7 : 1, cursor: 'pointer' }}
            >
              {loading ? 'Skickar...' : 'Skicka återställningslänk'}
            </button>
            <button 
              type="button" 
              onClick={() => { setIsForgotPassword(false); setError(''); }}
              style={{ width: '100%', padding: '1rem', backgroundColor: 'transparent', color: 'var(--text-muted)', borderRadius: '8px', fontWeight: '600', fontSize: '1rem', border: '1px solid var(--border-color)', cursor: 'pointer' }}
            >
              Avbryt
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {isRegistering && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>Användarnamn (Ditt unika alias)</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="T.ex. CoolKatt99"
                    required={isRegistering}
                    style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#f9fafb' }} 
                  />
                </div>
              )}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>E-postadress</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din.mejl@exempel.se"
                  required
                  style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#f9fafb' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>Lösenord</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#f9fafb' }} 
                />
              </div>

              {!isRegistering && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-0.25rem', marginBottom: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ cursor: 'pointer' }} />
                    Kom ihåg mig
                  </label>
                  <button 
                    type="button" 
                    onClick={() => { setIsForgotPassword(true); setError(''); }}
                    style={{ fontSize: '0.875rem', color: 'var(--theme-primary)', background: 'none', border: 'none', cursor: 'pointer', outline: 'none', fontWeight: '600' }}
                  >
                    Glömt lösenord?
                  </button>
                </div>
              )}

              {isRegistering && (
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={acceptedEula} 
                      onChange={e => setAcceptedEula(e.target.checked)} 
                      style={{ marginTop: '0.25rem', transform: 'scale(1.2)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.4' }}>
                      Genom att skapa ett konto godkänner du Facechats <button type="button" onClick={(e) => { e.preventDefault(); setShowEula(true); }} style={{ background: 'none', border: 'none', color: '#15803d', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>användarvillkor (EULA)</button> och att vi hanterar dina uppgifter enligt vår <a href="/privacy" target="_blank" style={{ color: '#15803d', fontWeight: 'bold' }}>integritetspolicy</a>. <br/>Vi har nolltolerans mot hat, mobbning och trakasserier.
                    </span>
                  </label>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading || (isRegistering && !acceptedEula)}
                style={{ 
                  width: '100%', padding: '1rem', 
                  backgroundColor: (isRegistering && !acceptedEula) ? '#94a3b8' : 'var(--theme-primary)', 
                  color: 'white', borderRadius: '8px', fontWeight: '700', fontSize: '1.1rem', marginTop: '0.5rem', 
                  opacity: (loading || (isRegistering && !acceptedEula)) ? 0.7 : 1, 
                  cursor: (isRegistering && !acceptedEula) ? 'not-allowed' : 'pointer' 
                }}
              >
                {loading ? 'Laddar...' : isRegistering ? 'Registrera' : 'Logga in'}
              </button>
            </form>

            <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {isRegistering ? 'Har du redan ett konto?' : 'Saknar du inloggning?'}
              </p>
              <button 
                onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                style={{ color: 'var(--theme-primary)', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', outline: 'none', marginTop: '0.25rem' }}
              >
                {isRegistering ? 'Logga in här' : 'Skapa konto'}
              </button>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Three Info Boxes (Bottom, 1 row on Desktop, stacked on Mobile) */}
      <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', maxWidth: '1000px', width: '100%', justifyContent: 'center' }}>
        
        <div style={{ backgroundColor: 'white', padding: '2.5rem 2rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '320px', margin: '0 auto', width: '100%' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#e0e7ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#43619c' }}>
            <LayoutGrid size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem', fontWeight: '800' }}>Nyhetsflöde</h3>
          <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.6', margin: 0 }}>Se vad polarna gör på din Whiteboard.</p>
        </div>

        <div style={{ backgroundColor: 'white', padding: '2.5rem 2rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '320px', margin: '0 auto', width: '100%' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#e0e7ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#43619c' }}>
            <User size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem', fontWeight: '800' }}>Mitt Krypin</h3>
          <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.6', margin: 0 }}>Din egen profil med gästbok & mejl.</p>
        </div>

        <div style={{ backgroundColor: 'white', padding: '2.5rem 2rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '320px', margin: '0 auto', width: '100%' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#e0e7ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#43619c' }}>
            <MessagesSquare size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem', fontWeight: '800' }}>Gemenskap</h3>
          <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.6', margin: 0 }}>Hitta nya vänner i forum & chatt.</p>
        </div>

      </div>
      
      <style>{`
        @media (max-width: 768px) {
          .info-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }
        }
      `}</style>

      {/* EULA MODAL */}
      {showEula && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card animate-fade-in" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'white', position: 'relative', padding: '2rem' }}>
            <button onClick={() => setShowEula(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-main)', paddingRight: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>📜 Användarvillkor (EULA) för Facechat</h2>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ margin: 0 }}>Välkommen till Facechat – Den digitala tidsmaskinen. Genom att skapa ett konto godkänner du följande regler för att hålla vår community trygg och trevlig för alla:</p>
              
              <div>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>1. Nolltolerans mot kränkningar</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Vi tillåter absolut inget hatiskt innehåll, mobbning, trakasserier eller hot. Inlägg eller meddelanden som bryter mot detta kommer att tas bort omedelbart.</p>
              </div>
              
              <div>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>2. User Generated Content (UGC)</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Som användare är du ansvarig för det innehåll du lägger upp på din Whiteboard, i Forumet eller i Chattrum. Vi förbehåller oss rätten att granska och radera innehåll som strider mot våra riktlinjer.</p>
              </div>
              
              <div>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>3. Blockerings- och rapporteringsverktyg</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>För din säkerhet tillhandahåller Facechat verktyg för att:<br/>
                • <strong>Blockera:</strong> Du kan när som helst blockera en annan användare från att kontakta dig eller se dina inlägg.<br/>
                • <strong>Rapportera:</strong> Du kan anmäla olämpligt innehåll direkt till våra moderatorer via rapport-knappen.</p>
              </div>
              
              <div>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>4. Påföljder</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Användare som upprepade gånger bryter mot reglerna eller sprider skadligt innehåll kommer att stängas av (bannas) från tjänsten utan förvarning.</p>
              </div>
              
              <div>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>5. Integritet</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Vi skyddar dina uppgifter. Dina privata mejl och inställningar i Mitt Krypin är personliga och delas inte med utomstående parter.</p>
              </div>
            </div>
            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <button 
                onClick={() => { setAcceptedEula(true); setShowEula(false); }} 
                style={{ padding: '0.875rem 2rem', backgroundColor: 'var(--theme-primary)', color: 'white', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', width: '100%', fontSize: '1.1rem' }}
              >
                Jag Förstår & Godkänner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
