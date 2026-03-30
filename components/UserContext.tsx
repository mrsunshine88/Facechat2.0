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
      // direkt vid kallstart, väntar vi några hundra millisekunder och försöker igen. 
      // Mobila webbläsare kan ibland vara sega med att ladda kakor från disk.
      let finalSession = session;
      if (!session && hasPersistentHint) {
         console.log('[UserContext] Väntar på att mobilen ska ladda kakor...');
         await new Promise(resolve => setTimeout(resolve, 800));
         const secondTry = await supabase.auth.getSession();
         finalSession = secondTry.data.session;
      }

      const currentUser = finalSession?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (profData?.is_banned) {
           await supabase.auth.signOut();
           localStorage.removeItem('facechat_persistent_session');
           window.location.href = '/login?error=Ditt konto är avstängt.';
           return;
        }

        setProfile(profData);
      } else {
        setProfile(null);
        // Om vi definitivt inte har en session, rensa hint-flaggan
        if (!hasPersistentHint) {
           // Vi rör inte flaggan om den fanns men sessionen saknas, 
           // för att inte förstöra för nästa försök om det var tillfälligt nätfel.
        }
      }
    } catch (error: any) {
      console.error('Error fetching user/profile:', error);
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
                window.location.href = '/login?error=Ditt konto har blivit avstängt.';
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
