"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';



interface UserContextType {
  user: any | null;
  profile: any | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const isSecurityInit = useRef(false);

  const syncingRef = useRef<string | null>(null);

  const fetchUserAndProfile = async () => {
    try {
      setLoading(true);
      const hasPersistentHint = localStorage.getItem('facechat_persistent_session') === 'true';
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      let finalSession = session;
      if (!session && hasPersistentHint) {
         console.log('[UserContext] Väntar på mobil-disk (2s)...');
         await new Promise(resolve => setTimeout(resolve, 2000));
         const secondTry = await supabase.auth.getSession();
         finalSession = secondTry.data.session;
      }

      const currentUser = finalSession?.user || null;
      setUser(currentUser);

      if (currentUser) {
        await syncProfileData(currentUser.id);
      } else {
        setProfile(null);
        if (hasPersistentHint) localStorage.removeItem('facechat_persistent_session');
      }
    } catch (error: any) {
      console.error('[UserContext] Fetch error:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const syncProfileData = async (userId: string, attempt = 1): Promise<void> => {
    // Förhindra att flera synkar körs samtidigt för samma användare
    if (syncingRef.current === userId && attempt === 1) return;
    syncingRef.current = userId;

    try {
      let { data: profData } = await supabase.from('profiles').select('*').eq('id', userId).single();
      const localSessKey = localStorage.getItem('facechat_session_key');

      // --- AGGRESSIV DB-SYNK (Upp till 3 försök) ---
      const needsRetry = !profData || (profData.session_key && localSessKey && profData.session_key !== localSessKey);
      
      if (needsRetry && attempt <= 3) {
          const waitTime = attempt * 800; // 800ms, 1600ms, 2400ms
          console.log(`[UserContext] Retry ${attempt}/3 för ${userId}. Väntar ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return await syncProfileData(userId, attempt + 1);
      }

      if (profData) {
        // Special-check för Root (A. Persson) - Tappa aldrig bort Root-status!
        const isRootEmail = profData.auth_email === 'apersson508@gmail.com' || userId === '66e138a2-f81d-4886-987a-b50a04910cfb'; // Exempel-ID för Root
        
        if (profData.is_banned && !isRootEmail) {
          await supabase.auth.signOut();
          window.location.href = '/login?error=Bannad';
          return;
        }

        // Sessions-kontroll (Bara om det verkligen inte matchar efter alla retries)
        if (profData.session_key && localSessKey && profData.session_key !== localSessKey && !isRootEmail) {
          console.warn('[UserContext] Session mismatch.');
          await supabase.auth.signOut();
          window.location.href = '/login?error=session_conflict';
          return;
        }

        setProfile(profData);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('[UserContext] Sync error:', err);
    } finally {
      if (attempt >= 3 || !syncingRef.current) {
         syncingRef.current = null;
      }
    }
  };

  useEffect(() => {
    // Initial laddning
    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[UserContext] Auth Event:', event);
      const currentUser = session?.user || null;
      
      // Om användaren loggar ut, rensa direkt och avbryt allt annat
      if (event === 'SIGNED_OUT' || !currentUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        syncingRef.current = null;
        localStorage.removeItem('facechat_persistent_session');
        return;
      }

      setUser(currentUser);
      
      // Vid inloggning eller sessionsförnyelse, synka profilen
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setLoading(true);
        await syncProfileData(currentUser.id);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // MASTER SECURITY GUARD (Banniing & Upplåsning!)
  useEffect(() => {
    if (loading || !user?.id) return;

    let securityChannel: any;

    securityChannel = supabase.channel('profile_security_blixt')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${user.id}` 
        }, (payload: any) => {
          if (!payload.new) return;
          setProfile(payload.new);
          
          if (payload.new.is_banned) {
            supabase.auth.signOut().then(() => {
                localStorage.removeItem('facechat_persistent_session');
                localStorage.removeItem('facechat_session_key');
                window.location.href = '/login?error=Ditt konto har blivit avstängt.';
            });
            return;
          }

          // 2. REAL-TIME SESSION ENFORCEMENT
          // Om nyckeln ändras på en annan enhet, logga ut denna omedelbart.
          const localSessKey = localStorage.getItem('facechat_session_key');
          if (payload.new.session_key && localSessKey && payload.new.session_key !== localSessKey) {
             console.warn('[UserContext] Real-time session mismatch detected - Logging out.');
             supabase.auth.signOut().then(() => {
                localStorage.removeItem('facechat_persistent_session');
                localStorage.removeItem('facechat_session_key');
                window.location.href = '/login?error=' + encodeURIComponent('Du har loggat in på en annan enhet. Denna session har avslutats.');
             });
          }


        })
        .subscribe();

    return () => {
       if (securityChannel) supabase.removeChannel(securityChannel);
    };
  }, [user?.id, loading]);

  return (
    <UserContext.Provider value={{ user, profile, loading, refreshProfile: fetchUserAndProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
