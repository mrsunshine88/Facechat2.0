-- =========================================================================
-- FACECHAT 2.0 - SÄKERHET, GDPR & BEHÖRIGHETSSKYDD (WATERTIGHT)
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT LÅSA HELA SYSTEMET!
-- =========================================================================

-- 1. Skapa en separat och ultra-säker tabell för känsliga personuppgifter (GDPR)
-- Eftersom 'profiles' används i hela appen för namn/avatars MÅSTE den vara offentlig. 
-- Därför flyttar vi telefonnummer etc hit där INGEN förutom ägaren själv kan läsa datan!
CREATE TABLE IF NOT EXISTS public.user_secrets (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    phone TEXT,
    address TEXT,
    zipcode TEXT,
    show_phone BOOLEAN DEFAULT false,
    show_address BOOLEAN DEFAULT false,
    show_zipcode BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Vi slår på extrem RLS så att inte ens inloggade users kan se andras hemligheter
ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only read their own secrets" ON public.user_secrets;
CREATE POLICY "Users can only read their own secrets" ON public.user_secrets 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own secrets" ON public.user_secrets;
CREATE POLICY "Users can insert their own secrets" ON public.user_secrets 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own secrets" ON public.user_secrets;
CREATE POLICY "Users can update their own secrets" ON public.user_secrets 
FOR UPDATE USING (auth.uid() = user_id);

-- 2. Datamigrering: Flytta över eventuell befintlig data från profiles till user_secrets
INSERT INTO public.user_secrets (user_id, phone, address, zipcode, show_phone, show_address, show_zipcode)
SELECT id, phone, address, zipcode, show_phone, show_address, show_zipcode
FROM public.profiles
WHERE phone IS NOT NULL OR address IS NOT NULL OR zipcode IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Radera GDPR-kolumnerna från standardprofilen så de AAAAALDRIG KAN LÄCKA!
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS address;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS zipcode;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS show_phone;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS show_address;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS show_zipcode;


-- 3. BYGG DEN VATTENTÄTA TRIGGERN MOT F12-HACKERS!
-- Denna Trigger ligger tyst och djupt i Postgres och raderar/korrigerar alla 
-- försök till att uppdatera `is_admin`, `is_banned`, eller `perm_*` av vanliga användare!
CREATE OR REPLACE FUNCTION public.check_profile_escalation()
RETURNS trigger AS $$
DECLARE
  is_updating_self boolean;
  executor_is_root boolean;
  executor_has_roles_perm boolean;
BEGIN
  is_updating_self := (auth.uid() = NEW.id);
  executor_is_root := (auth.email() = 'apersson508@gmail.com');
  
  -- Om man använder Service Role-nyckeln (server backend bypassing RLS)
  IF auth.jwt()->>'role' = 'service_role' THEN
     RETURN NEW;
  END IF;

  -- Kollar om den som utför detta uppdateringsanrop verkligen HAR RÄTTIGHETER
  SELECT perm_roles INTO executor_has_roles_perm FROM public.profiles WHERE id = auth.uid();

  -- Om användaren INTE är ROOT och INTE har Administrativa Roller-behörigheter; 
  -- Tvinga tillbaka alla känsliga fält till vad de var innan (OLD)!
  IF (executor_is_root = false AND executor_has_roles_perm = false) THEN
    -- Skrivbordshackern försöker byta sina roller via F12. NEJ TACK.
    NEW.is_admin = OLD.is_admin;
    NEW.is_banned = OLD.is_banned;
    NEW.perm_users = OLD.perm_users;
    NEW.perm_content = OLD.perm_content;
    NEW.perm_rooms = OLD.perm_rooms;
    NEW.perm_roles = OLD.perm_roles;
    NEW.perm_support = OLD.perm_support;
    NEW.perm_logs = OLD.perm_logs;
    NEW.perm_broadcast = OLD.perm_broadcast;
  END IF;
  
  -- Sätt last_seen OM the user updates their own profile
  IF is_updating_self THEN
    NEW.last_seen = TIMEZONE('utc', NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sätt Triggern på profiles!
DROP TRIGGER IF EXISTS trigger_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER trigger_prevent_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_profile_escalation();

-- KLART! DIN DATABAS ÄR NU PANZARVAGN-SKYDDAD.
