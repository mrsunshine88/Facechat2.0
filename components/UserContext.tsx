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

  const fetchUserAndProfile = async () => {
    try {
      setLoading(true);
      // 1. Snabbkoll: Förväntar vi oss en session? (Hint från localStorage)
      const hasPersistentHint = localStorage.getItem('facechat_persistent_session') === 'true';
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      // 2. MOBIL-OPTIMERING: Vänta på disk-laddning om vi förväntar oss en session
      let finalSession = session;
      if (!session && hasPersistentHint) {
         console.log('[UserContext] PWA-läge detekterat. Väntar 2s...');
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
      console.error('Error fetching user/profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const syncProfileData = async (userId: string) => {
    // Försök hämta profilen
    let { data: profData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    const localSessKey = localStorage.getItem('facechat_session_key');

    // --- ROBUST RACE CONDITION FIX ---
    // Om profilen saknas eller har fel nyckel (t.ex. vid inloggning pågår), vänta 800ms och försök igen.
    if (!profData || (profData.session_key && localSessKey && profData.session_key !== localSessKey)) {
        console.log('[UserContext] Väntar på DB-synk (800ms)...');
        await new Promise(resolve => setTimeout(resolve, 800));
        const retry = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (retry.data) profData = retry.data;
    }

    if (profData) {
      if (profData.is_banned) {
        await supabase.auth.signOut();
        localStorage.removeItem('facechat_persistent_session');
        localStorage.removeItem('facechat_session_key');
        window.location.href = '/login?error=Ditt konto är avstängt.';
        return;
      }

      // Single Session Enforcement (om nyckeln fortfarande diffar efter retry)
      if (profData.session_key && localSessKey && profData.session_key !== localSessKey) {
        console.warn('[UserContext] Mismatch - Kicking out.');
        await supabase.auth.signOut();
        window.location.href = '/login?error=' + encodeURIComponent('Du har loggat in på en annan enhet.');
        return;
      }

      setProfile(profData);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      
      if (currentUser) {
        setLoading(true);
        await syncProfileData(currentUser.id);
        setLoading(false);
      } else {
        setProfile(null);
        setLoading(false);
        localStorage.removeItem('facechat_persistent_session');
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
