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
      // 1. Snabbkoll: Förväntar vi oss en session? (Hint från localStorage)
      const hasPersistentHint = localStorage.getItem('facechat_persistent_session') === 'true';
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;

      // 2. MOBIL-OPTIMERING (Grace Period): Om vi förväntar oss en session men getSession returnerar null 
      // direkt vid kallstart, väntar vi några sekunder och försöker igen. 
      // PWA-appar på mobil kan vara extra långsamma med att ladda kakor från disk.
      let finalSession = session;
      if (!session && hasPersistentHint) {
         console.log('[UserContext] PWA-läge detekterat. Väntar på att mobilen ska ladda kakor (2s)...');
         await new Promise(resolve => setTimeout(resolve, 2000));
         const secondTry = await supabase.auth.getSession();
         finalSession = secondTry.data.session;
         if (finalSession) console.log('[UserContext] Session återställd efter väntetid! 🎉');
      }

      const currentUser = finalSession?.user || null;
      setUser(currentUser);

      if (currentUser) {
        let { data: profData, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        // --- RACE CONDITION FIX ---
        // Om profilen inte hittas (eller om nyckeln inte matchar än), 
        // vänta en kort stund och försök igen. Det kan ta några millisekunder 
        // för auth-skrivningen att propagera till profiles-tabellen vid login.
        const localSessKey = localStorage.getItem('facechat_session_key');
        if (!profData || (profData.session_key && localSessKey && profData.session_key !== localSessKey)) {
           console.log('[UserContext] Profil ej redo (Race condition?). Väntar 800ms...');
           await new Promise(resolve => setTimeout(resolve, 800));
           const retry = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
           if (retry.data) profData = retry.data;
        }

        // --- EMERGENCY FALLBACK: "THE EMPTY SHELL" FIX ---
        // Om vi har en användare men ingen profil (efter retry), och vi TROR att vi är inloggade
        // (pga localStorage-hints), då har sessionen blivit ogiltig eller undanputtad.
        if (!profData) {
           const persistentHint = localStorage.getItem('facechat_persistent_session');
           const localSessKey = localStorage.getItem('facechat_session_key');
           if (persistentHint || localSessKey) {
              console.warn('[UserContext] Profile missing (Zombie state). Forcing logout.');
              await supabase.auth.signOut();
              localStorage.removeItem('facechat_persistent_session');
              localStorage.removeItem('facechat_session_key');
              window.location.href = '/login?error=' + encodeURIComponent('Din session har blivit ogiltig. Logga in igen.');
              return;
           }
        }

        if (profData?.is_banned) {
           await supabase.auth.signOut();
           localStorage.removeItem('facechat_persistent_session');
           localStorage.removeItem('facechat_session_key');
           window.location.href = '/login?error=Ditt konto är avstängt.';
           return;
        }

        // --- SINGLE SESSION ENFORCEMENT ---
        if (profData?.session_key && localSessKey && profData.session_key !== localSessKey) {
           console.warn('[UserContext] Session mismatch - Kicking out.');
           await supabase.auth.signOut();
           localStorage.removeItem('facechat_persistent_session');
           localStorage.removeItem('facechat_session_key');
           window.location.href = '/login?error=' + encodeURIComponent('Du har loggat in på en annan enhet. Denna session har avslutats.');
           return;
        }

        setProfile(profData);
      } else {
        setProfile(null);
        // Om vi definitivt inte har en session efter väntetiden, rensa hint-flaggan
        if (hasPersistentHint) {
           localStorage.removeItem('facechat_persistent_session');
        }
      }
    } catch (error: any) {
      console.error('Error fetching user/profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        // Om vi redan har sessionen här, använd den istället för att anropa getSession igen!
        supabase.from('profiles').select('*').eq('id', currentUser.id).single().then(({data}) => {
          if (data) {
            if (data.is_banned) {
               supabase.auth.signOut();
               window.location.href = '/login?error=Ditt konto är avstängt.';
            } else {
               setProfile(data);
            }
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
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
