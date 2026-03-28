"use client"

import React, { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  
  useEffect(() => {
    // Registrera Service Worker för PWA
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js?v=4').catch(console.error);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (typeof window !== 'undefined') {
      const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(iosDevice);

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      // På iOS finns inte beforeinstallprompt, så vi visar rutan ändå om det inte är standalone
      if (iosDevice && !isStandalone) {
        setShowInstallPrompt(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [])
  
  const handleInstallClick = async () => {
    if (isIOS) {
       alert('På iPhone: Klicka på delningsikonen (fyrkanten med pil upp) i Safaris bottenmeny och välj "Lägg till på hemskärmen".')
       return;
    }
    
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    }
  }

  if (!showInstallPrompt) return null;

  return (
    <div className="hide-on-desktop" style={{ position: 'fixed', bottom: '1rem', left: '1rem', right: '1rem', backgroundColor: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 99999, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img src="/icon-192x192.png" alt="Facechat Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }} />
        <div>
          <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>Facechat Appen</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Lägg till på hemskärmen</p>
        </div>
      </div>
      
      <button onClick={handleInstallClick} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--theme-primary)', color: 'white', borderRadius: '8px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
        Installera
      </button>
    </div>
  )
}

