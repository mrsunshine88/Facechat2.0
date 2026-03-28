import React from 'react';
import { Shield } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f3f6', padding: '3rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div className="card" style={{ maxWidth: '800px', width: '100%', padding: '3rem', margin: 0, marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: 'var(--theme-primary)', padding: '1rem', borderRadius: '12px', color: 'white' }}>
            <Shield size={32} />
          </div>
          <h1 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--text-main)', fontWeight: '800' }}>Integritetspolicy</h1>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', lineHeight: '1.8', color: 'var(--text-main)', fontSize: '1.1rem' }}>
          <p>
            Vi på <strong>Facechat</strong> värnar starkt om din integritet och säkerhet. 
            Detta dokument förklarar hur vi skyddar din information så att du kan känna dig trygg när du umgås med dina vänner.
          </p>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--theme-primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>1. Vilken data samlar vi in?</h2>
            <p>
              Vi sparar din e-postadress <strong>endast</strong> för inloggning och återställning av lösenord. 
              Den delas aldrig med obehöriga. Vi samlar även in det innehåll (UGC) du själv väljer att posta offentligt, som inlägg på Whiteboards eller Forumet.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--theme-primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>2. Vem har tillgång till dina inlägg?</h2>
            <p>
              Dina privata mejl är krypterade och läses <strong>inte</strong> av oss i administrationen eller av någon obehörig tredje part. 
              Vi säljer <strong>aldrig</strong> din data eller e-postadress vidare. Din information stannar på Facechat.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--theme-primary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>3. Rätten att bli bortglömd (Radera konto)</h2>
            <p>
              Du äger din data. Om du vill radera ditt konto och all tillhörande data permanent, kan du när som helst göra det inifrån appen.
              Gå till <strong>Inställningar (Mina Sidor) &gt; Konto</strong> och klicka på "Radera mitt konto".
            </p>
          </section>

        </div>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <Link href="/login" style={{ display: 'inline-block', backgroundColor: 'var(--theme-primary)', color: 'white', padding: '0.75rem 2rem', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>
            Tillbaka till Registrering
          </Link>
        </div>
      </div>
    </div>
  );
}
