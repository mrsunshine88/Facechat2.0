-- =========================================================================
-- FACECHAT 2.0 - SÄKERHET & PRESTANDA (Root & Sök) 🩺🛡️
-- Kör detta i Supabase SQL Editor för att aktivera nya funktionerna.
-- =========================================================================

-- 1. LÄGG TILL ROOT-FLAGGA I PROFILER
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_root BOOLEAN DEFAULT false;

-- 2. UTSE DIN ANVÄNDARE TILL ROOT (Permanent låsning)
-- -------------------------------------------------------------------------
UPDATE public.profiles 
SET is_root = true, is_admin = true
WHERE auth_email = 'apersson508@gmail.com';

-- 3. AKTIVERA SÖK-OPTIMERING (Trigram för snabba namnsökningar)
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Skapa index för blixtsnabb sökning (ilike %namn%)
CREATE INDEX IF NOT EXISTS trgm_idx_profiles_username ON public.profiles USING gin (username gin_trgm_ops);

-- 4. FUNKTION FÖR ATT KONTROLLERA ROOT-STATUS (Säkerhetslager)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_root_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = target_user_id AND is_root = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
