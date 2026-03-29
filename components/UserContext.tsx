"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { updateUserIP } from '@/app/actions/securityActions';

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

  const fetchUserAndProfile = async (retryCount = 0) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        // Om låset är upptaget, vänta och försök igen upp till 3 gånger
        if (sessionError.message?.includes('lock') && retryCount < 3) {
          const delay = (retryCount + 1) * 500;
          console.warn(`Auth lock contested (Attempt ${retryCount + 1}/3), retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
          return fetchUserAndProfile(retryCount + 1);
        }
        throw sessionError;
      }

      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (profData?.is_banned) {
           await supabase.auth.signOut();
           window.location.href = '/login?error=Ditt konto är avstängt.';
           return;
        }
        setProfile(profData);
      } else {
        setProfile(null);
      }
    } catch (error: any) {
      console.error('Error fetching user/profile:', error);
      // Fallback if lock issue persists
      if (error.message?.includes('lock')) {
         setLoading(false); // Släpp laddningen så UI inte hänger
      }
    } finally {
      if (retryCount === 0 || !loading) {
        setLoading(false);
      }
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
