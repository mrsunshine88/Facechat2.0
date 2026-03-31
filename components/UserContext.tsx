"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { getSoundUrl } from '@/utils/sounds';



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
  const syncInProgress = useRef<string | null>(null);
  const router = useRouter();
  const fetchUserAndProfile = async () => {
    try {
      console.log('[UserContext] Starting fetchUserAndProfile...');
      setLoading(true);
      const hasPersistentHint = localStorage.getItem('facechat_persistent_session') === 'true';
      
      console.log('[UserContext] Fetching auth user...');
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
         console.warn('[UserContext] Auth error:', authError.message);
         if (hasPersistentHint) {
            console.log('[UserContext] Persistent hint found, retry in 2s...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            const secondTry = await supabase.auth.getUser();
            console.log('[UserContext] Second try result:', secondTry.data.user ? 'User Found' : 'User Still Missing');
            setUser(secondTry.data.user || null);
            if (secondTry.data.user) await syncProfileData(secondTry.data.user.id);
         } else {
            setUser(null);
         }
      } else {
         console.log('[UserContext] User found:', currentUser?.id);
         setUser(currentUser);
         if (currentUser) {
            await syncProfileData(currentUser.id);
         } else {
            console.log('[UserContext] No user in auth session.');
            setProfile(null);
            if (hasPersistentHint) localStorage.removeItem('facechat_persistent_session');
         }
      }
    } catch (error: any) {
      console.error('[UserContext] Auth Initialization Error:', error);
      setProfile(null);
    } finally {
      console.log('[UserContext] fetchUserAndProfile finished, loading = false');
      setLoading(false);
    }
  };

  /**
   * CENTRAL SYNC ENGINE: Laddar profilen omedelbart och deterministiskt.
   * Vi separerar "Visa Sidan" (ladda profil) från "Säkerhetsvakt" (kickout).
   */
  const syncProfileData = async (userId: string): Promise<void> => {
    // Förhindra dubbla synkar (Auth Lock Guard)
    if (syncInProgress.current === userId) return;
    try {
      syncInProgress.current = userId;
      console.log('[UserContext] Syncing profile for:', userId);
      const localSessKey = localStorage.getItem('facechat_session_key');
      
      // 1. Diagnostisk Hämtning med Retry-logik för "Auth Lock Stolen"
      let profData = null;
      let error = null;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        const response = await supabase.from('profiles')
          .select('id, username, avatar_url, is_admin, is_root, auth_email, is_banned, session_key')
          .eq('id', userId)
          .single();
        
        profData = response.data;
        error = response.error;

        // Om vi får det fruktade "lock stolen" felet, vänta och försök igen.
        if (error?.message?.includes('lock') || error?.message?.includes('stole')) {
          console.warn(`[UserContext] Auth lock stolen (försök ${retries + 1}). Väntar på tur...`);
          retries++;
          await new Promise(res => setTimeout(res, 500 * retries)); // Vänta lite längre för varje försök
          continue;
        }
        break; // Lyckades eller fick ett riktigt fel
      }
      
      if (error || !profData) {
        console.warn('[UserContext] Profil kunde inte laddas:', error?.message);
        setProfile(null);
        return;
      }

      console.log('[UserContext] Profile fetched for:', profData.username);
      setProfile(profData);
      
      const isRoot = profData?.is_root === true || profData?.auth_email === 'apersson508@gmail.com';
      
      // 2. Säkerhetskontroll vid laddning (Banning)
      if (profData.is_banned && !isRoot) {
        console.warn('[UserContext] User is banned. Signing out...');
        await supabase.auth.signOut();
        window.location.href = '/login?error=Bannad';
        return;
      }

      // NOTE: Session-key mismatch hanteras nu av Header.tsx hjärtslag (var 60:e sek)
      // för att hindra låskrockar under inloggningsfönstret.
      
    } catch (err: any) {
      if (err.message?.includes('Lock')) return; // Ignorera låskrockar, onAuthStateChange fixar det nästa gång
      console.error('[UserContext] Sync Failure:', err);
      setProfile(null);
    } finally {
      syncInProgress.current = null;
    }
  };

  // 1. INITIAL LOAD (Runs only on mount)
  useEffect(() => {
    // Vi förlitar oss på onAuthStateChange för att sköta synken.
    // Detta för att undvika att Mount-processen och Listener-processen krockar och låser Auth-klienten.
  }, []);

  // 2. AUTH CHANGE LISTENER (Körs vid inloggning, utloggning och vid start)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[UserContext] Auth Change Triggered:', event);
      const currentUser = session?.user || null;
      
      if (event === 'SIGNED_OUT' || !currentUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        // NUCLEAR LOGOUT: Rensa allt för att undvika "Stale Session" hängningar
        localStorage.removeItem('facechat_persistent_session');
        localStorage.removeItem('facechat_session_key');
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
