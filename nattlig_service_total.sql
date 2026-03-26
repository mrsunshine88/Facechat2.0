-- =========================================================================
-- FACECHAT 2.0 - TOTAL NATTLIG DIAGNOS & SJÄLVRENGÖRING (03:00) 🩺🛡️
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT AKTIVERA AUTOMATIKEN
-- =========================================================================

CREATE OR REPLACE FUNCTION public.run_nightly_diagnostic_total()
RETURNS TEXT AS $$
DECLARE
    root_id UUID;
    root_ip TEXT;
    cleared_ips INTEGER := 0;
    cleared_orphans INTEGER := 0;
    cleared_friendships INTEGER := 0;
    cleared_notifs INTEGER := 0;
    cleared_mails INTEGER := 0;
    cleared_broken_avatars INTEGER := 0;
    cleared_empty_posts INTEGER := 0;
    log_msg TEXT;
BEGIN
    -- 0. Hämta Root-Admin info (apersson508)
    SELECT id, last_ip INTO root_id, root_ip FROM public.profiles WHERE username = 'apersson508' LIMIT 1;
    IF root_id IS NULL THEN
        RETURN 'FEL: Root-Admin (apersson508) hittades inte. Avbryter diagnos.';
    END IF;

    -- 1. SÄKERHETSTEST: Root-IP skydd 🛡️
    IF root_ip IS NOT NULL AND root_ip <> '' THEN
        WITH deleted AS (
            DELETE FROM public.blocked_ips WHERE ip = root_ip RETURNING 1
        ) SELECT count(*) INTO cleared_ips FROM deleted;
    END IF;

    -- 2. SOCIAL HÄLSA: Vänskaper & Dupes 👥
    -- Använder befintlig städ-logik för vänner och secrets
    SELECT public.fix_duplicate_friendships() INTO cleared_friendships;

    -- 3. GDPR: Föräldralös data (Orphans) 📁
    -- Vi går igenom de tyngsta tabellerna och rensar bort inlägg från raderade konton
    WITH o_forum AS (DELETE FROM public.forum_posts WHERE profiles_id NOT IN (SELECT id FROM public.profiles) RETURNING 1),
         o_guest AS (DELETE FROM public.guestbook WHERE sender_id NOT IN (SELECT id FROM public.profiles) OR receiver_id NOT IN (SELECT id FROM public.profiles) RETURNING 1),
         o_white AS (DELETE FROM public.whiteboard WHERE profiles_id NOT IN (SELECT id FROM public.profiles) RETURNING 1),
         o_chats AS (DELETE FROM public.chat_messages WHERE profiles_id NOT IN (SELECT id FROM public.profiles) RETURNING 1)
    SELECT (SELECT count(*) FROM o_forum) + (SELECT count(*) FROM o_guest) + (SELECT count(*) FROM o_white) + (SELECT count(*) FROM o_chats) INTO cleared_orphans;

    -- 4. DATASANERING: Gamla notiser & Mejl (> 30 dagar) ⏳
    WITH d_notifs AS (DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days' RETURNING 1),
         d_mails AS (DELETE FROM public.private_messages WHERE created_at < NOW() - INTERVAL '30 days' AND is_read = true RETURNING 1)
    SELECT (SELECT count(*) FROM d_notifs) INTO cleared_notifs;
    SELECT (SELECT count(*) FROM d_mails) INTO cleared_mails;

    -- 5. BILD-STÄDNING: Trasiga avatar-URL:er 🖼️
    WITH d_avatars AS (
        UPDATE public.profiles 
        SET avatar_url = NULL 
        WHERE avatar_url ILIKE '%undefined%' OR avatar_url ILIKE '%null%'
        RETURNING 1
    ) SELECT count(*) INTO cleared_broken_avatars FROM d_avatars;

    -- 6. SKRÄPFILTER: Tomma inlägg 🧹
    WITH d_empty_posts AS (
        DELETE FROM public.forum_posts WHERE content = '' OR length(content) = 0 RETURNING 1
    ) SELECT count(*) INTO cleared_empty_posts FROM d_empty_posts;
    
    WITH d_empty_guests AS (
        DELETE FROM public.guestbook WHERE content = '' OR length(content) = 0 RETURNING 1
    ) SELECT cleared_empty_posts + count(*) INTO cleared_empty_posts FROM d_empty_guests;

    -- 7. LOGGNING: Skriv till admin_logs för total insyn 📜
    log_msg := '03:00 Nattlig Diagnos utförd. Åtgärder: ';
    IF cleared_ips > 0 THEN log_msg := log_msg || 'Låste upp din Root-IP (' || cleared_ips || '). '; END IF;
    log_msg := log_msg || 'Städat: ' || cleared_orphans || ' GDPR-orphans, ' || 
               cleared_notifs || ' notiser, ' || 
               cleared_mails || ' gamla mejl, ' || 
               cleared_broken_avatars || ' trasiga bilder, ' || 
               cleared_empty_posts || ' tomma inlägg. ' ||
               'Social hälsa: ' || cleared_friendships || ' åtgärdade vänskaper/secrets.';

    INSERT INTO public.admin_logs (admin_id, action) 
    VALUES (root_id, log_msg);

    RETURN 'Diagnos slutförd! Logg skapad: ' || log_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- INSTRUKTION FÖR SCHEMALÄGGNING (KL 03:00)
-- =========================================================================
-- För att köra detta automatiskt i Supabase (kräver pg_cron extension):
-- SELECT cron.schedule('facechat-nightly-0300', '0 3 * * *', 'SELECT run_nightly_diagnostic_total()');

-- NOTERA: Du kan köra detta manuellt för att testa direkt:
-- SELECT run_nightly_diagnostic_total();
