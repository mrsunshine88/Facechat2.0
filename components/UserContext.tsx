"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';

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
        fetchUserAndProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // REALTIDSKOLL: Lyssna på ändringar i din egen profil (t.ex. vid blockering/banning)
    let profileSubscription: any = null;
    if (user) {
      profileSubscription = supabase
        .channel(`self-profile-${user.id}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${user.id}` 
        }, (payload) => {
          setProfile(payload.new);
          // Omedelbar utsparkning om kontot blir bannat!
          if (payload.new.is_banned) {
            supabase.auth.signOut().then(() => {
                window.location.href = '/login?error=Ditt konto har blivit avstängt.';
            });
          }
        })
        .subscribe();
    }

    return () => {
      subscription.unsubscribe();
      if (profileSubscription) supabase.removeChannel(profileSubscription);
    };
  }, [user?.id]);

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
