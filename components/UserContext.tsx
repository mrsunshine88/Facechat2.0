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
  const fetchUserAndProfile = async () => {
    try {
      setLoading(true);
      const hasPersistentHint = localStorage.getItem('facechat_persistent_session') === 'true';
      
      // 1. VIKTIGT: Använd getUser() istället för getSession() för att tvinga fram server-validering!
      // Detta eliminerar "stale sessions" som orsakar vita skärmar pga RLS-blockering.
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError && hasPersistentHint) {
         console.log('[UserContext] Förväntad session saknas. Försöker återhämta (2s)...');
         await new Promise(resolve => setTimeout(resolve, 2000));
         const secondTry = await supabase.auth.getUser();
         setUser(secondTry.data.user || null);
         if (secondTry.data.user) await syncProfileData(secondTry.data.user.id);
      } else {
         setUser(currentUser);
         if (currentUser) {
            await syncProfileData(currentUser.id);
         } else {
            setProfile(null);
            if (hasPersistentHint) localStorage.removeItem('facechat_persistent_session');
         }
      }
    } catch (error: any) {
      console.error('[UserContext] Auth Initialization Error:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * CENTRAL SYNC ENGINE: Laddar profilen omedelbart och deterministiskt.
   * Vi separerar "Visa Sidan" (ladda profil) från "Säkerhetsvakt" (kickout).
   */
  const syncProfileData = async (userId: string): Promise<void> => {
    try {
      const localSessKey = localStorage.getItem('facechat_session_key');
      
      // 1. Snabb hämtning utan blockerande loopar
      const { data: profData, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (error || !profData) {
        console.warn('[UserContext] Profil kunde inte laddas:', error?.message);
        setProfile(null);
        return;
      }

      // 2. Sätt profilen OMEDELBART så att Header och UI laddas
      setProfile(profData);
      
      // 3. SÄKERHETS-AUDIT (Sker i bakgrunden, blockerar inte UI)
      const isRoot = profData.auth_email === 'apersson508@gmail.com' || profData.is_root === true;
      
      // Bannings-vakt
      if (profData.is_banned && !isRoot) {
        await supabase.auth.signOut();
        window.location.href = '/login?error=Bannad';
        return;
      }

      // Single-Session vakt (Utkastning vid dubbla enheter)
      const isMismatch = profData.session_key && localSessKey && profData.session_key !== localSessKey;
      
      if (isMismatch && !isRoot) {
        console.warn('[UserContext] Session mismatch detected - Enforcing single session policy.');
        await supabase.auth.signOut();
        localStorage.removeItem('facechat_persistent_session');
        localStorage.removeItem('facechat_session_key');
        window.location.href = '/login?error=session_conflict';
        return;
      }
      
    } catch (err) {
      console.error('[UserContext] Sync Critical Failure:', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[UserContext] Auth Change Triggered:', event);
      const currentUser = session?.user || null;
      
      if (event === 'SIGNED_OUT' || !currentUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        localStorage.removeItem('facechat_persistent_session');
        return;
      }

      setUser(currentUser);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
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
          // Om nyckeln ändras på en annan enhet, logga ut denna omedelbart (om det inte är Root).
          const isRoot = payload.new.auth_email === 'apersson508@gmail.com' || payload.new.is_root === true;
          const localSessKey = localStorage.getItem('facechat_session_key');
          
          if (payload.new.session_key && localSessKey && payload.new.session_key !== localSessKey && !isRoot) {
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
