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

  const syncProfileData = async (userId: string): Promise<void> => {
    const localSessKey = localStorage.getItem('facechat_session_key');
    let profData: any = null;
    let success = false;

    // --- AGGRESSIV DB-SYNK (Loop 3 försök) ---
    for (let attempt = 1; attempt <= 3; attempt++) {
      const waitTime = (attempt - 1) * 1000; // 0s, 1s, 2s
      if (waitTime > 0) await new Promise(resolve => setTimeout(resolve, waitTime));

      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (error) {
         console.warn(`[UserContext] Profilfel (försök ${attempt}):`, error.message);
      }

      // Validera: Finns profilen? Matcha även sessions-nyckeln om den finns
      const isMismatch = data?.session_key && localSessKey && data.session_key !== localSessKey;
      
      if (data && !isMismatch) {
          profData = data;
          success = true;
          break;
      }
    }

    if (success && profData) {
      const isRoot = profData.auth_email === 'apersson508@gmail.com' || profData.is_root === true;
      
      if (profData.is_banned && !isRoot) {
        await supabase.auth.signOut();
        window.location.href = '/login?error=Bannad';
        return;
      }

      if (profData.session_key && localSessKey && profData.session_key !== localSessKey && !isRoot) {
        console.warn('[UserContext] Session mismatch persist - Signing out.');
        await supabase.auth.signOut();
        window.location.href = '/login?error=session_conflict';
        return;
      }

      setProfile(profData);
    } else {
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
