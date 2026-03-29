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

  const fetchUserAndProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
    } catch (error) {
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

  // MASTER SECURITY GUARD (Samma sekund-fix!)
  useEffect(() => {
    if (loading || isSecurityInit.current) return;
    isSecurityInit.current = true;

    let securityChannel: any;

    async function setupSecurity() {
      // 1. Hämta IP direkt (och uppdatera profilen i bakgrunden)
      const res = await updateUserIP(user?.id || 'guest');
      const myIp = res?.ip;
      if (!myIp) return;

      // 2. Initial koll (Är jag spärrad NU?)
      const { data: ipBlock } = await supabase.from('blocked_ips').select('ip').eq('ip', myIp);
      const currentlyIpBlocked = ipBlock && ipBlock.length > 0;
      
      const isBlockedPage = pathname === '/blocked';

      if (currentlyIpBlocked && !isBlockedPage) {
        router.replace('/blocked');
      } else if (!currentlyIpBlocked && isBlockedPage) {
        router.replace('/');
      }

      // 3. REALTID: Lyssna på ALLT (IP-spärrar, Bans och Profil-uppdateringar)
      securityChannel = supabase.channel('master_security_guard')
        // Lyssna på IP-spärrar
        .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_ips' }, (payload: any) => {
          if (payload.eventType === 'INSERT' && payload.new.ip === myIp) {
            router.replace('/blocked');
          } else if (payload.eventType === 'DELETE' && payload.old.ip === myIp) {
             // Om vi är på block-sidan, skicka tillbaka till start direkt!
             if (window.location.pathname === '/blocked') {
                window.location.href = '/';
             }
          }
        })
        // Lyssna på din egen profil-rad (för Banning och Behörigheter)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: user?.id ? `id=eq.${user.id}` : undefined 
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
    }

    setupSecurity();

    return () => {
       if (securityChannel) supabase.removeChannel(securityChannel);
       isSecurityInit.current = false;
    };
  }, [user?.id, loading, pathname, router]);

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
