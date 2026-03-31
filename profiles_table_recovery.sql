-- =========================================================================
-- FACECHAT 2.0 - NUCLEAR CLEANUP & SESSION FIX 🛡️🚨
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT RENSA ALLT SKRÄP!
-- =========================================================================

-- 1. TOTAL RENSRING AV GAMLA TRIGGERS (Nollställer för att hindra DEADLOCKS)
-- -------------------------------------------------------------------------
-- Denna del sopar rent så att INGA dolda gamla spärrar ligger kvar och "fryser" profilen.

DO $$ 
DECLARE 
    trig_record RECORD;
BEGIN
    FOR trig_record IN (
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'profiles' 
        AND trigger_schema = 'public'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trig_record.trigger_name) || ' ON public.profiles CASCADE;';
    END LOOP;
END $$;

-- 2. SÄKERSTÄLL ATT ALLA KOLUMNER FINNS (Ingen data raderas)
-- -------------------------------------------------------------------------
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_root') THEN
    ALTER TABLE public.profiles ADD COLUMN is_root BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='auth_email') THEN
    ALTER TABLE public.profiles ADD COLUMN auth_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='session_key') THEN
    ALTER TABLE public.profiles ADD COLUMN session_key TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_ip') THEN
    ALTER TABLE public.profiles ADD COLUMN last_ip TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_banned') THEN
    ALTER TABLE public.profiles ADD COLUMN is_banned BOOLEAN DEFAULT false;
  END IF;

  -- Lägg till alla perm-fält om de saknas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_roles') THEN
    ALTER TABLE public.profiles ADD COLUMN perm_roles BOOLEAN DEFAULT false;
  END IF;
  
  -- (Och övriga viktiga fält)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_users') THEN ALTER TABLE public.profiles ADD COLUMN perm_users BOOLEAN DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='perm_content') THEN ALTER TABLE public.profiles ADD COLUMN perm_content BOOLEAN DEFAULT false; END IF;
END $$;

-- 3. NY, ULTRA-GRENAD SÄKERHETSTRIGGER (Helt utan deadlock-risk)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.master_security_shield()
RETURNS trigger AS $$
BEGIN
  -- 1. Identifiera Root via Auth-session (Snabbare och låser inte tabellen)
  -- 2. Bypass för Service Role (Backend Server Actions / Admin Client)
  IF (auth.email() = 'apersson508@gmail.com' OR auth.jwt()->>'role' = 'service_role') THEN
     RETURN NEW;
  END IF;

  -- 3. Förhindra Privilege Escalation för vanliga användare
  -- (Vi tillåter INTE ändring av administrativa fält här)
  NEW.is_admin = OLD.is_admin;
  NEW.is_root = OLD.is_root;
  NEW.is_banned = OLD.is_banned;
  NEW.perm_users = OLD.perm_users;
  NEW.perm_content = OLD.perm_content;
  NEW.perm_roles = OLD.perm_roles;

  -- 4. Root-kontot (Hårdkodat Skydd så man aldrig blir utlåst)
  IF (OLD.auth_email = 'apersson508@gmail.com' OR OLD.username = 'mrsunshine88') THEN
     NEW.is_admin = true;
     NEW.is_root = true;
     NEW.is_banned = false;
  END IF;

  -- 5. Sanera Användarnamn
  NEW.username = REGEXP_REPLACE(NEW.username, '[<>\"''\&]', '', 'g');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_master_security_shield
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.master_security_shield();

-- 4. MASTER SECURITY CHECK RPC (Root Immunitet)
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
    SELECT last_ip, session_key, is_banned, is_root 
    INTO root_ip, db_session_key, db_is_banned, db_is_root
    FROM public.profiles 
    WHERE is_root = true OR auth_email = 'apersson508@gmail.com' 
    LIMIT 1;
    
    IF test_ip IS NOT NULL AND test_ip = root_ip THEN
        is_root_ip := true;
    END IF;

    -- Kolla IP-block (ej för Root)
    IF NOT is_root_ip AND test_ip IS NOT NULL THEN
        SELECT EXISTS (SELECT 1 FROM public.blocked_ips WHERE ip = test_ip) INTO is_blocked_ip;
    END IF;

    -- Användarkontroll
    IF test_user_id IS NOT NULL THEN
        SELECT is_banned, session_key, is_root INTO db_is_banned, db_session_key, db_is_root
        FROM public.profiles WHERE id = test_user_id;
        
        is_banned_user := COALESCE(db_is_banned, false);
        
        IF test_session_key IS NOT NULL AND db_session_key IS NOT NULL AND db_session_key != test_session_key THEN
            session_match := false;
        END IF;

        IF db_is_root = true THEN
           is_banned_user := false;
           session_match := true;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'is_root_ip', is_root_ip,
        'is_blocked_ip', is_blocked_ip,
        'is_banned_user', is_banned_user,
        'session_match', session_match
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. KORRIGERA PROFIL-DATAN
UPDATE public.profiles SET is_root = true, is_admin = true WHERE auth_email = 'apersson508@gmail.com' OR username = 'mrsunshine88';

-- KLART! Nu finns ingen gammal trigger som kan blockera. 🛡️🟢
