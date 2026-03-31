-- =========================================================================
-- FACECHAT 2.0 - UNIVERSAL SCHEMA RECOVERY & SECURITY CONSOLIDATION 🛡️🚀
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT LAGNA ALLA INLOGGNINGSPROBLEM!
-- =========================================================================

-- 1. SÄKERSTÄLL ATT ALLA KOLUMNER FINNS (RECOVER FROM BARE-BONES SCHEMA)
-- -------------------------------------------------------------------------
DO $$ 
BEGIN
  -- Grundläggande administrativ kontroll
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='auth_email') THEN
    ALTER TABLE public.profiles ADD COLUMN auth_email TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_root') THEN
    ALTER TABLE public.profiles ADD COLUMN is_root BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_banned') THEN
    ALTER TABLE public.profiles ADD COLUMN is_banned BOOLEAN DEFAULT false;
  END IF;

  -- Sessions-hantering (Single Session Enforcement)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='session_key') THEN
    ALTER TABLE public.profiles ADD COLUMN session_key TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_ip') THEN
    ALTER TABLE public.profiles ADD COLUMN last_ip TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_seen') THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Design & Anpassning
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='custom_style') THEN
    ALTER TABLE public.profiles ADD COLUMN custom_style TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='presentation') THEN
    ALTER TABLE public.profiles ADD COLUMN presentation TEXT;
  END IF;

  -- Behörigheter (Permissions)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_users') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_users BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_content') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_content BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_rooms') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_rooms BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_roles') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_roles BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_support') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_support BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_logs') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_logs BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_broadcast') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_broadcast BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_chat') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_chat BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_images') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_images BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_stats') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_stats BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_diagnostics') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_diagnostics BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. KONSOLIDERA SÄKERHETS-TRIGGER (Fixar Deadlocks & Hängning)
-- -------------------------------------------------------------------------

-- Radera GAMLA och konkurrerande triggers för att undvika konflikter
DROP TRIGGER IF EXISTS trg_security_shield ON public.profiles;
DROP TRIGGER IF EXISTS trigger_prevent_privilege_escalation ON public.profiles;
DROP TRIGGER IF EXISTS trg_sanitize_username ON public.profiles;

-- Den NYA, ultra-effektiva och konsoliderade säkerhetstriggern
CREATE OR REPLACE FUNCTION public.master_security_shield()
RETURNS trigger AS $$
DECLARE
  executor_is_root boolean := false;
  executor_has_roles_perm boolean := false;
BEGIN
  -- 1. Identifiera Root (Den absoluta sanningen)
  IF (auth.email() = 'apersson508@gmail.com') THEN
     executor_is_root := true;
  END IF;

  -- 2. bypass för Service Role (Backend Server Actions)
  IF auth.jwt()->>'role' = 'service_role' THEN
     -- Om det är backend som uppdaterar, tillåt allt
     -- Men säkerställ att Root-flaggan aldrig tas bort av misstag
     IF OLD.is_root = true THEN
        NEW.is_root = true;
        NEW.is_admin = true;
     END IF;
     RETURN NEW;
  END IF;

  -- 3. Behörighetskontroll för Administratör
  SELECT perm_roles INTO executor_has_roles_perm FROM public.profiles WHERE id = auth.uid();

  -- 4. Förhindra Privilege Escalation (Endast Root eller Roll-Admin får ändra dessa fält)
  IF NOT executor_is_root AND NOT COALESCE(executor_has_roles_perm, false) THEN
    NEW.is_admin = OLD.is_admin;
    NEW.is_root = OLD.is_root;
    NEW.is_banned = OLD.is_banned;
    NEW.perm_users = OLD.perm_users;
    NEW.perm_content = OLD.perm_content;
    NEW.perm_rooms = OLD.perm_rooms;
    NEW.perm_roles = OLD.perm_roles;
    NEW.perm_support = OLD.perm_support;
    NEW.perm_logs = OLD.perm_logs;
    NEW.perm_broadcast = OLD.perm_broadcast;
    NEW.perm_chat = OLD.perm_chat;
    NEW.perm_images = OLD.perm_images;
    NEW.perm_stats = OLD.perm_stats;
    NEW.perm_diagnostics = OLD.perm_diagnostics;
  END IF;

  -- 5. Root-kontot (Hardcoded Protection)
  -- Root-kontot kan aldrig bannas och ska alltid vara admin
  IF (OLD.auth_email = 'apersson508@gmail.com' OR OLD.username = 'mrsunshine88') THEN
     NEW.is_admin = true;
     NEW.is_root = true;
     NEW.is_banned = false;
  END IF;

  -- 6. Sanera Användarnamn (Skydd mot XSS/CSS injection)
  NEW.username = REGEXP_REPLACE(NEW.username, '[<>\"''\&]', '', 'g');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_master_security_shield
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.master_security_shield();

-- 3. UPPDATERA Master Security Check RPC
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_request_access(
  test_ip TEXT, 
  test_user_id UUID DEFAULT NULL, 
  test_session_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    is_root_ip BOOLEAN := false;
    is_blocked_ip BOOLEAN := false;
    is_banned_user BOOLEAN := false;
    session_match BOOLEAN := true;
    root_ip TEXT;
    db_session_key TEXT;
    db_is_banned BOOLEAN;
    db_is_root BOOLEAN;
BEGIN
    -- 1. Hämta Root-Admins senaste IP för immunitet-check
    SELECT last_ip INTO root_ip 
    FROM public.profiles 
    WHERE is_root = true OR auth_email = 'apersson508@gmail.com' 
    LIMIT 1;
    
    IF test_ip IS NOT NULL AND test_ip = root_ip THEN
        is_root_ip := true;
    END IF;

    -- 2. Kolla IP-block (Skippas för Root)
    IF NOT is_root_ip AND test_ip IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.blocked_ips WHERE ip = test_ip
        ) INTO is_blocked_ip;
    END IF;

    -- 3. Användarkontroll
    IF test_user_id IS NOT NULL THEN
        SELECT is_banned, session_key, is_root
        INTO db_is_banned, db_session_key, db_is_root
        FROM public.profiles 
        WHERE id = test_user_id;
        
        is_banned_user := COALESCE(db_is_banned, false);
        
        -- Sessionsmatchning
        IF test_session_key IS NOT NULL AND db_session_key IS NOT NULL THEN
            IF db_session_key != test_session_key THEN
                session_match := false;
            END IF;
        END IF;
        
        -- ROOT IMMUNITET (Bannning / Sessionsmatch)
        IF db_is_root = true THEN
           is_banned_user := false;
           session_match := true; -- ROOT FÅR VARA INLOGGAD PÅ FLERA ENHETER
        END IF;
    END IF;

    result := jsonb_build_object(
        'is_root_ip', is_root_ip,
        'is_blocked_ip', is_blocked_ip,
        'is_banned_user', is_banned_user,
        'session_match', session_match
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. KORRIGERA PROFIL-DATAN (Fixar synk-fel)
-- -------------------------------------------------------------------------
-- Se till att root-kontot har rätt flagga satt om det finns
UPDATE public.profiles SET is_root = true, is_admin = true WHERE auth_email = 'apersson508@gmail.com' OR username = 'mrsunshine88';

-- KLART! Din databas är nu återställd och fixad med full Root-immunitet. 🛡️🟢
