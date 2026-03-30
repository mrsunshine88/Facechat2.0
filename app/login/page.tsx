"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { LayoutGrid, User, MessagesSquare, Smartphone, Shield, Users, Gamepad2, MessageSquare } from 'lucide-react'

import { prepareNewSignup, isUserConfirmed } from '@/app/actions/userActions'
import { updateUserIP, completeLoginProcess } from '@/app/actions/securityActions'

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
  
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // Städa bort gamla felmeddelanden från adressfältet omedelbart
    router.replace('/login', { scroll: false });

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

        // Rensa gamla obekräftade försök med samma mejl (GDPR/UX)
        await prepareNewSignup(email);

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim()
            },
            emailRedirectTo: 'https://facechat.se/auth/callback?next=/'
          }
        })
        if (signUpError) throw signUpError
        setError("Registrering lyckades! VIKTIGT: Kolla din e-post och klicka på länken för att aktivera ditt konto innan du loggar in.")
        setIsRegistering(false)
        setUsername('')
        setPassword('')
      } else {
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (signInError) throw signInError
        
        if (signInData?.user) {
          if (!signInData.user.email_confirmed_at) {
            await supabase.auth.signOut();
            setError('Du måste bekräfta din e-postadress innan du kan logga in.');
            setLoading(false);
            return;
          }
          // "BANG"-inloggning: Uppdatera profil, sessionsnyckel och IP i EN ENDA snabb operation!
          // Vi använder en fallback för randomUUID om det saknas (t.ex. gamla mobiler eller icke-HTTPS)
          const newSessionKey = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2) + Date.now().toString(36);
            
          const res = await completeLoginProcess(signInData.user.id, newSessionKey);
          
          if (res.error) {
             console.error('Inloggningsfel:', res.error);
             setError('Inloggningsäkerhet misslyckades: ' + res.error);
             setLoading(false);
             return;
          }
          const profile = res.profile;

          if (profile?.is_banned) {
            await supabase.auth.signOut();
            setError('Ditt konto har blivit blockerat av en administratör.');
            setLoading(false);
            return;
          }

          localStorage.setItem('facechat_session_key', newSessionKey);
        }
        
        if (rememberMe) {
          localStorage.setItem('facechat_saved_email', email)
        } else {
          localStorage.removeItem('facechat_saved_email')
        }
        
        // "BANG"-inloggning: Skicka vidare direkt utan att ladda om hela sidan
        router.push('/')
      }
    } catch (err: any) {
      if (err.message === 'Invalid login credentials') {
        setError('Fel e-postadress eller lösenord. Försök igen!')
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Du måste bekräfta din e-postadress först.')
      } else {
        // Ensure error is a string so it doesn't render as {}
        const errorMsg = typeof err === 'string' ? err : (err?.message || String(err));
        setError(errorMsg || 'Ett oväntat fel uppstod vid inloggningen');
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
      // SÄKERHETSKONTROLL: Blockera återställning om kontot inte är aktiverat
      const active = await isUserConfirmed(email);
      if (!active) {
        setError('Ditt konto är ej aktiverat. Vänligen aktivera det via ditt välkomstmejl först, eller registrera dig på nytt.');
        setLoading(false);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://facechat.se/update-password',
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
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: 'var(--bg-color)', 
      padding: '3rem 1rem' 
    }}>
      
      {/* Header & Slogan */}
      <div style={{ marginBottom: '3rem', textAlign: 'center', maxWidth: '800px', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: '900', color: '#1e3a8a', textShadow: '2px 2px 0px rgba(0,0,0,0.05)', margin: '0 0 0.5rem 0', letterSpacing: '-0.03em' }}>Facechat</h1>
        <h2 style={{ fontSize: '1.25rem', color: '#475569', fontWeight: '500', margin: '0', lineHeight: '1.5' }}>
          Sveriges skönaste community – Nostalgi, gemenskap och underhållning på ett och samma ställe.
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
          <div style={{ padding: '1.25rem', backgroundColor: (error.includes('lyckades') || error.includes('ändrats') || error.includes('skickats')) ? '#ecfdf5' : '#fee2e2', color: (error.includes('lyckades') || error.includes('ändrats') || error.includes('skickats')) ? '#065f46' : '#b91c1c', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '1rem', textAlign: 'center', border: (error.includes('lyckades') || error.includes('ändrats') || error.includes('skickats')) ? '2px solid #10b981' : '1px solid #fca5a5', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            {(error.includes('lyckades') || error.includes('ändrats') || error.includes('skickats')) && <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📧</div>}
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{error.includes('lyckades') ? 'Registrering Lyckades!' : ''}</strong>
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
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#166534', fontWeight: '700' }}>ℹ️ Du kommer få ett bekräftelse-mejl som måste aktiveras.</p>
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
                onClick={() => { 
                  setIsRegistering(!isRegistering); 
                  setError('');
                  setEmail('');
                  setPassword('');
                  setUsername('');
                }}
                style={{ color: 'var(--theme-primary)', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', outline: 'none', marginTop: '0.25rem' }}
              >
                {isRegistering ? 'Logga in här' : 'Skapa konto'}
              </button>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Four Info Boxes (Bottom, responsive grid) */}
      <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', maxWidth: '1100px', width: '100%', justifyContent: 'center', padding: '0 1rem' }}>
        
        <div className="feature-card" style={{ backgroundColor: 'white', padding: '2rem 1.5rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', textAlign: 'center', width: '100%', transition: 'all 0.3s ease' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#eff6ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#3b82f6', transition: 'transform 0.3s ease' }} className="feature-icon">
            <LayoutGrid size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem', fontWeight: '800' }}>Whiteboard & Flöde</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>Dela med dig av din dag och se vad dina vänner hittar på just nu.</p>
        </div>

        <div className="feature-card" style={{ backgroundColor: 'white', padding: '2rem 1.5rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', textAlign: 'center', width: '100%', transition: 'all 0.3s ease' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#ecfdf5', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#10b981', transition: 'transform 0.3s ease' }} className="feature-icon">
            <User size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem', fontWeight: '800' }}>Mitt Krypin</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>Din personliga fristad. Gästbok, privata mejl och din egen presentation.</p>
        </div>

        <div className="feature-card" style={{ backgroundColor: 'white', padding: '2rem 1.5rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', textAlign: 'center', width: '100%', transition: 'all 0.3s ease' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#fdf4ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#d946ef', transition: 'transform 0.3s ease' }} className="feature-icon">
            <MessageSquare size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem', fontWeight: '800' }}>Chatt & Forum</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>Lär känna nya människor i våra realtidschattar eller djupdyk i spännande forumtrådar.</p>
        </div>

        <div className="feature-card" style={{ backgroundColor: 'white', padding: '2rem 1.5rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', textAlign: 'center', width: '100%', transition: 'all 0.3s ease' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#fffbeb', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#f59e0b', transition: 'transform 0.3s ease' }} className="feature-icon">
            <Gamepad2 size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.75rem', fontWeight: '800' }}>Facechat Arcade</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>Blir du mästaren? Slå rekord i klassiska arkadspel och klättra på topplistorna!</p>
        </div>

      </div>

      {/* Footer */}
      <div style={{ marginTop: '5rem', paddingBottom: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: '600' }}>© {new Date().getFullYear()} Facechat</span>
        <span style={{ color: '#cbd5e1' }}>•</span>
        <button onClick={() => setShowEula(true)} style={{ background: 'none', border: 'none', color: '#1e3a8a', cursor: 'pointer', padding: 0, fontWeight: '600', fontSize: '0.9rem' }} className="hover-link">Villkor & Regler</button>
        <span style={{ color: '#cbd5e1' }}>•</span>
        <a href="/privacy" target="_blank" style={{ color: '#1e3a8a', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }} className="hover-link">Integritetspolicy</a>
      </div>
      
      <style>{`
        .feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.1) !important;
          border-color: #cbd5e1 !important;
        }

        .feature-card:hover .feature-icon {
          transform: scale(1.1) rotate(-5deg);
        }

        .hover-link:hover {
          text-decoration: underline !important;
        }

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
