-- =========================================================================
-- FACECHAT 2.0 - FAS 2 MODERNISERING (Master Upgrade) 🛡️⚡
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT SLUTFÖRA OPTIMERINGEN!
-- =========================================================================

-- 1. PRESTANDA-INDEX (Gör sidan blixtsnabb när den växer)
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_whiteboard_author_id ON public.whiteboard(author_id);
CREATE INDEX IF NOT EXISTS idx_whiteboard_created_at ON public.whiteboard(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guestbook_receiver_id ON public.guestbook(receiver_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_receiver_id ON public.private_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_sender_id ON public.private_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_id ON public.notifications(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
-- Index för att snabbt hitta Root-administratörer
CREATE INDEX IF NOT EXISTS idx_profiles_is_root ON public.profiles(is_root) WHERE (is_root = true);

-- 2. UNIFIERAD SÄKERHET (Ta bort hårdkodad e-post från RLS)
-- -------------------------------------------------------------------------
-- Profiler
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
FOR UPDATE USING (auth.uid() = id OR (SELECT is_root FROM public.profiles WHERE id = auth.uid()));

-- Gästbok
DROP POLICY IF EXISTS "Delete guestbook posts" ON public.guestbook;
CREATE POLICY "Delete guestbook posts" ON public.guestbook 
FOR DELETE USING (auth.uid() = receiver_id OR auth.uid() = sender_id OR (SELECT is_root FROM public.profiles WHERE id = auth.uid()));

-- Whiteboard
DROP POLICY IF EXISTS "Owner/Admin can delete" ON public.whiteboard;
CREATE POLICY "Owner/Admin can delete" ON public.whiteboard 
FOR DELETE USING (auth.uid() = author_id OR (SELECT is_root FROM public.profiles WHERE id = auth.uid()));

-- Support Tickets
DROP POLICY IF EXISTS "Users read own tickets" ON support_tickets;
CREATE POLICY "Users read own tickets" ON public.support_tickets 
FOR SELECT USING (auth.uid() = user_id OR (SELECT is_root FROM public.profiles WHERE id = auth.uid()));


-- 3. UPPDATERADE FUNKTIONER (RPC)
-- -------------------------------------------------------------------------

-- Hämta Root-IP (Använder nu is_root flaggan)
CREATE OR REPLACE FUNCTION public.get_root_admin_ip()
RETURNS text AS $$
BEGIN
    RETURN (SELECT last_ip FROM public.profiles WHERE is_root = true LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master Access Check (Middleware-vakt)
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
    root_ips TEXT[];
    db_session_key TEXT;
    db_is_banned BOOLEAN;
    user_is_root BOOLEAN := false;
BEGIN
    -- 1. Hämta alla Root-administratörers IP:n
    SELECT array_agg(last_ip) INTO root_ips FROM public.profiles WHERE is_root = true;
    
    IF test_ip IS NOT NULL AND test_ip = ANY(root_ips) THEN
        is_root_ip := true;
    END IF;

    -- 2. Kolla om IP-adressen är spärrad
    IF NOT is_root_ip AND test_ip IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.blocked_ips WHERE ip = test_ip
        ) INTO is_blocked_ip;
    END IF;

    -- 3. Kolla Användarstatus
    IF test_user_id IS NOT NULL THEN
        SELECT is_banned, session_key, is_root
        INTO db_is_banned, db_session_key, user_is_root
        FROM public.profiles 
        WHERE id = test_user_id;
        
        is_banned_user := COALESCE(db_is_banned, false);
        
        -- Master-brytare: Root kan aldrig vara bannlyst
        IF user_is_root THEN
            is_banned_user := false;
            session_match := true;
        ELSE
            -- Kolla sessionsmatch för vanliga användare
            IF test_session_key IS NOT NULL AND db_session_key IS NOT NULL THEN
                IF db_session_key != test_session_key THEN
                    session_match := false;
                END IF;
            END IF;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. FÖRBÄTTRAT NATTLIGT UNDERHÅLL (Inkl. Log-städning 30 dagar)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nightly_maintenance()
RETURNS void AS $$
DECLARE
    links_fixed integer;
    profiles_fixed integer;
    friends_fixed integer;
    images_cleaned integer;
    notifs_cleaned integer;
    logs_cleaned integer;
    admin_id uuid;
    log_msg text;
BEGIN
    -- Hämta första tillgängliga Root Admin ID för loggning
    SELECT id INTO admin_id FROM public.profiles WHERE is_root = true LIMIT 1;

    -- Kör alla lagningar
    links_fixed := public.fix_dead_links();
    profiles_fixed := public.diagnose_missing_profiles();
    friends_fixed := public.fix_duplicate_friendships();
    images_cleaned := public.cleanup_orphan_avatars();
    PERFORM public.optimize_uploaded_images();
    
    -- Rensa gamla notiser (äldre än 30 dagar)
    DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS notifs_cleaned = ROW_COUNT;
    
    -- NYTT: Rensa gamla admin-loggar (äldre än 30 dagar) enligt ditt önskemål!
    DELETE FROM public.admin_logs WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS logs_cleaned = ROW_COUNT;
    
    -- Skapa loggmeddelandet
    log_msg := format('SYSTEM: Nattlig städning klar. Raderade %s bilder, %s loggar, fixade %s döda länkar, %s profiler och rensade %s notiser.', 
        images_cleaned, logs_cleaned, links_fixed, profiles_fixed, notifs_cleaned);
    
    -- Logga resultatet
    IF admin_id IS NOT NULL THEN
        INSERT INTO public.admin_logs (admin_id, action) VALUES (admin_id, log_msg);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- KLART! Fas 2 Modernisering är genomförd. 🚀
