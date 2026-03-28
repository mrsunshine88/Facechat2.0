-- =========================================================================
-- FACECHAT 2.0 - ULTIMATA NATTLIGA DIAGNOS-VERKTYGET v3.0 🩺🛡️
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT AKTIVERA AUTOMATIKEN (03:00)
-- =========================================================================

-- 1. RUTINER FÖR LOG-STÄDNING (> 15 DAGAR)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_logs(days_to_keep integer DEFAULT 15)
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Vi sparar Admin-loggar i 30 dagar för säkerhet, men rensar system-loggar efter 'days_to_keep'
    DELETE FROM public.admin_logs 
    WHERE created_at < NOW() - (days_to_keep || ' days')::interval
      AND action NOT LIKE '%Befordrade%' 
      AND action NOT LIKE '%Tog bort Admin%';
      
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RUTINER FÖR VÄNSKAPS-STÄDNING (SOCIAL HÄLSA)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fix_duplicate_friendships()
RETURNS integer AS $$
DECLARE
    removed_count integer := 0;
BEGIN
    -- Radera dubbel-rader för samma par
    DELETE FROM public.friendships
    WHERE (user_id_1, user_id_2) IN (
        SELECT user_id_1, user_id_2 FROM (
            SELECT user_id_1, user_id_2, ROW_NUMBER() OVER (PARTITION BY LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2) ORDER BY created_at DESC) as row_num
            FROM public.friendships
        ) t WHERE t.row_num > 1
    );
    GET DIAGNOSTICS removed_count = ROW_COUNT;
    RETURN removed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RUTIN FÖR ATT RENSA OANVÄNDA PROFILBILDER (HERRELÖSA FILER)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_orphan_avatars()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Denna raderar metaposter i storage.objects för filer i 'avatars' som INTE finns i profiles.avatar_url
    DELETE FROM storage.objects s
    WHERE s.bucket_id = 'avatars'
      AND s.name NOT LIKE '.%' 
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.avatar_url IS NOT NULL 
          AND p.avatar_url LIKE '%' || s.name || '%'
      );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. HUVUDFUNKTION: TOTAL NATTLIG DIAGNOS (03:00)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_nightly_diagnostic_total()
RETURNS TEXT AS $$
DECLARE
    root_id UUID;
    root_ip TEXT;
    cleared_ips INTEGER := 0;
    cleared_orphans_data INTEGER := 0;
    cleared_orphan_files INTEGER := 0;
    cleared_friendships INTEGER := 0;
    cleared_notifs INTEGER := 0;
    cleared_mails INTEGER := 0;
    cleared_broken_avatars INTEGER := 0;
    cleared_empty_posts INTEGER := 0;
    cleared_logs INTEGER := 0;
    synced_profiles INTEGER := 0;
    log_msg TEXT;
BEGIN
    -- 0. Hämta Root-Admin info (via email för säkerhet)
    SELECT id, last_ip INTO root_id, root_ip FROM public.profiles WHERE auth_email = 'apersson508@gmail.com' LIMIT 1;
    IF root_id IS NULL THEN
        RETURN 'FEL: Root-Admin hittades inte. Avbryter diagnos.';
    END IF;

    -- 1. SÄKERHETSTEST: Root-IP skydd 🛡️
    IF root_ip IS NOT NULL AND root_ip <> '' THEN
        WITH deleted AS (DELETE FROM public.blocked_ips WHERE ip = root_ip RETURNING 1) 
        SELECT count(*) INTO cleared_ips FROM deleted;
    END IF;

    -- 2. DIAGNOS: Saknade profiler
    SELECT public.diagnose_missing_profiles() INTO synced_profiles;

    -- 3. SOCIAL HÄLSA: Vänskaper
    SELECT public.fix_duplicate_friendships() INTO cleared_friendships;

    -- 4. BILD-STÄDNING: Herrelösa filer i storage
    SELECT public.cleanup_orphan_avatars() INTO cleared_orphan_files;

    -- 5. CONTENT: Döda länkar och GDPR-städning
    SELECT public.fix_dead_links() INTO cleared_orphans_data;

    -- 6. DATASANERING: Gamla notiser & Mejl (> 30 dagar)
    WITH d_notifs AS (DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days' RETURNING 1),
         d_mails AS (DELETE FROM public.private_messages WHERE created_at < NOW() - INTERVAL '30 days' AND is_read = true RETURNING 1)
    SELECT (SELECT count(*) FROM d_notifs) INTO cleared_notifs;
    SELECT (SELECT count(*) FROM d_mails) INTO cleared_mails;

    -- 7. BILD-KVALITET: Fixa trasiga URL-strängar
    WITH d_avatars AS (
        UPDATE public.profiles SET avatar_url = NULL 
        WHERE avatar_url ILIKE '%undefined%' OR avatar_url ILIKE '%null%'
        RETURNING 1
    ) SELECT count(*) INTO cleared_broken_avatars FROM d_avatars;

    -- 8. SKRÄPFILTER: Tomma inlägg
    WITH d_empty_posts AS (DELETE FROM public.forum_posts WHERE content = '' OR length(trim(content)) = 0 RETURNING 1),
         d_empty_guests AS (DELETE FROM public.guestbook WHERE content = '' OR length(trim(content)) = 0 RETURNING 1)
    SELECT ((SELECT count(*) FROM d_empty_posts) + (SELECT count(*) FROM d_empty_guests)) INTO cleared_empty_posts;

    -- 9. LOG-STÄDNING: Gamla system-loggar (> 15 dagar)
    SELECT public.cleanup_old_logs(15) INTO cleared_logs;

    -- 10. BILD-OPTIMERARE: Sätt width=800 på alla nya bilder
    PERFORM public.optimize_uploaded_images();

    -- SLUTLIG LOGGNING 📜
    log_msg := '03:00 TOTAL AUTOMATISK DIAGNOS UTFÖRD. ';
    log_msg := log_msg || 'Resultat: ' || cleared_orphan_files || ' bilder raderade, ' ||
               cleared_orphans_data || ' döda länkar fixade, ' ||
               synced_profiles || ' profiler synkade, ' ||
               cleared_friendships || ' vänskapsrättningar, ' ||
               cleared_notifs || ' notiser rensade, ' ||
               cleared_mails || ' gamla mejl rensade, ' ||
               cleared_logs || ' gamla loggar städade.';
    
    INSERT INTO public.admin_logs (admin_id, action) VALUES (root_id, log_msg);

    RETURN log_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. SCHEMALÄGGNING (KL 03:00 VARJE NATT)
-- -------------------------------------------------------------------------
-- Ta bort gammalt schema om det finns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'facechat-nightly-0300') THEN
        PERFORM cron.unschedule('facechat-nightly-0300');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-cleanup') THEN
        PERFORM cron.unschedule('nightly-cleanup');
    END IF;
END $$;

-- Skapa det nya 03:00 schemat
SELECT cron.schedule('facechat-nightly-0300', '0 3 * * *', 'SELECT public.run_nightly_diagnostic_total()');
