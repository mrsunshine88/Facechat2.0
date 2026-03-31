-- =========================================================================
-- FACECHAT 2.0 - FINAL PERFORMANCE BOOST 💎⚡
-- SYFTE: Eliminera latens vid inloggning, utloggning och navigering.
-- KÖR DETTA I DIN SUPABASE SQL EDITOR FÖR ATT MAXIMERA HASTIGHETEN.
-- =========================================================================

-- 1. INDEXERING FÖR BLIXTSNABB MIDDLEWARE & AUTH
-- -------------------------------------------------------------------------
-- Dessa index gör att 'check_request_access' hittar din session på 
-- mikrosekunder istället för att behöva skanna hela tabellen.

CREATE INDEX IF NOT EXISTS idx_profiles_session_key ON public.profiles(session_key);
CREATE INDEX IF NOT EXISTS idx_profiles_last_ip ON public.profiles(last_ip);
CREATE INDEX IF NOT EXISTS idx_profiles_is_root ON public.profiles(is_root);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- 2. INDEXERING FÖR FORUM & WHITEBOARD (UX-BOOST)
-- -------------------------------------------------------------------------
-- Gör att din personliga feed laddar omedelbart.
CREATE INDEX IF NOT EXISTS idx_whiteboard_author_id ON public.whiteboard(author_id);
CREATE INDEX IF NOT EXISTS idx_whiteboard_created_at ON public.whiteboard(created_at DESC);

-- 3. INDEXERING FÖR SOCIALA FUNKTIONER
-- -------------------------------------------------------------------------
-- Gör att vän-listor och vän-förfrågningar renderas snabbare.
CREATE INDEX IF NOT EXISTS idx_friendships_user_ids ON public.friendships(user_id_1, user_id_2);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

-- 4. STÄDNING AV GAMLA LOGGAR (FÖRSTÄRKNING)
-- -------------------------------------------------------------------------
-- Vi ser till att admin_logs inte blir en prestanda-tjuv.
-- Detta lägger vi till i den nattliga underhållsrutinen.

DO $$ 
BEGIN
  -- Lägg till index på skapandedatum för snabbare rensning
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_logs_created_at') THEN
    CREATE INDEX idx_admin_logs_created_at ON public.admin_logs(created_at);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_blocked_ips_ip') THEN
    CREATE INDEX idx_blocked_ips_ip ON public.blocked_ips(ip);
  END IF;
END $$;

-- KLART! Din databas är nu optimerad för produktion med maximal prestanda. 🚀💎
