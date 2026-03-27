-- =========================================================================
-- FACECHAT 2.0 - OFFICIAL SECURITY HARDENING & DATABASE MASTER FIX
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT LÅSA HELA SYSTEMET! 🛡️🚀
-- =========================================================================

-- 1. SKAPA SAKNADE TABELLER FÖR SÄKERHET OCH NOTISER
-- -------------------------------------------------------------------------

-- Tabell för Administrativa Loggar (Vem ändrade vad?)
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabell för GDPR-säkra personuppgifter (Sjöskumsskydd)
CREATE TABLE IF NOT EXISTS public.user_secrets (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    phone TEXT,
    address TEXT,
    zipcode TEXT,
    show_phone BOOLEAN DEFAULT false,
    show_address BOOLEAN DEFAULT false,
    show_zipcode BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabell för Push-notiser
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    auth TEXT,
    p256dh TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabeller för IP-spärrar och Ordfilter
CREATE TABLE IF NOT EXISTS public.blocked_ips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip TEXT UNIQUE NOT NULL,
    reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.word_filters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phrase TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. SCHEMA-UPPDATERINGAR (FÖRSÄKRA KOLUMNER)
-- -------------------------------------------------------------------------

-- Uppdatera Profiler med Administrativa fält
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_users BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_content BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_rooms BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_roles BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_support BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_logs BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_broadcast BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_chat BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_style TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS presentation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_interests BOOLEAN DEFAULT false;

-- Uppdatera Supportärenden med meddelanden och raderingsstatus
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS has_unread_admin BOOLEAN DEFAULT false;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS has_unread_user BOOLEAN DEFAULT false;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS user_deleted BOOLEAN DEFAULT false;

-- 3. RLS (ROW LEVEL SECURITY) - PANZARVAGN-SKYDD
-- -------------------------------------------------------------------------

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_filters ENABLE ROW LEVEL SECURITY;

-- Admin Logs: Endast admins kan läsa
DROP POLICY IF EXISTS "Admins can read logs" ON public.admin_logs;
CREATE POLICY "Admins can read logs" ON public.admin_logs FOR SELECT USING (
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) OR 
    (SELECT perm_logs FROM public.profiles WHERE id = auth.uid())
);

-- User Secrets: Endast ägaren kan läsa/skriva
DROP POLICY IF EXISTS "Users can manage own secrets" ON public.user_secrets;
CREATE POLICY "Users can manage own secrets" ON public.user_secrets FOR ALL USING (auth.uid() = user_id);

-- Push Subscriptions: Endast ägaren
DROP POLICY IF EXISTS "Users can manage own push" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 4. TRIGGERS (THE MASTER SHIELD)
-- -------------------------------------------------------------------------

-- Förhindra att någon ger sig själv Admin via F12
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger AS $$
BEGIN
  -- Om den som anropar INTE är apersson508@gmail.com och INTE har perm_roles
  IF (auth.email() <> 'apersson508@gmail.com' AND 
      (SELECT perm_roles FROM public.profiles WHERE id = auth.uid()) IS NOT TRUE) THEN
    
    -- Tvinga tillbaka alla administrativa fält till deras gamla värden
    NEW.is_admin = OLD.is_admin;
    NEW.perm_users = OLD.perm_users;
    NEW.perm_content = OLD.perm_content;
    NEW.perm_rooms = OLD.perm_rooms;
    NEW.perm_roles = OLD.perm_roles;
    NEW.perm_support = OLD.perm_support;
    NEW.perm_logs = OLD.perm_logs;
    NEW.perm_broadcast = OLD.perm_broadcast;
    NEW.perm_chat = OLD.perm_chat;
    
    -- Om någon försöker ta bort bannlysningen på sig själv
    NEW.is_banned = OLD.is_banned;
  END IF;

  -- Root-Admin är alltid Root-Admin
  IF OLD.username = 'apersson508' THEN
    NEW.is_admin = true;
    NEW.perm_roles = true;
    NEW.is_banned = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_security_shield ON public.profiles;
CREATE TRIGGER trg_security_shield
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_escalation();

-- Sanera användarnamn från skadliga tecken vid sparning (Last line of defense)
CREATE OR REPLACE FUNCTION public.sanitize_username()
RETURNS trigger AS $$
BEGIN
  NEW.username = REGEXP_REPLACE(NEW.username, '[<>\"''\&]', '', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sanitize_username ON public.profiles;
CREATE TRIGGER trg_sanitize_username
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sanitize_username();

-- 5. AUTOMATISK AKTIVERING AV REALTIME
-- -------------------------------------------------------------------------
DO $$ 
BEGIN
  -- Skapa publikationen om den inte finns
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Lägg till support_tickets om den inte redan är med
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;

  -- Lägg till admin_logs om den inte redan är med
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'admin_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_logs;
  END IF;
END $$;

-- KLART! DIN DATABAS ÄR NU TÄT OCH SÄKRAD. 🟢
