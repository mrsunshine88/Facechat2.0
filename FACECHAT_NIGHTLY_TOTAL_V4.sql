-- =========================================================================
-- FACECHAT 2.0 - ULTIMATA NATTLIGA DIAGNOS-VERKTYGET v4.0 (TOTAL) 🩺🛡️
-- DENNA FIL ÄR KOMPLETT OCH INNEHÅLLER ALLA 11 PUNKTER FRÅN DIAGNOS-BILDEN.
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT AKTIVERA HELA RENSNINGEN (03:00 SVENSK TID)
-- =========================================================================

-- 1. FÖRBEREDELSE: AKTIVERA PG_CRON OM DET SAKNAS
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. ALLA UNDERFUNKTIONER (MED SECURITY DEFINER FÖR ATT KLARA NATTLIG KÖRNING)
-- -------------------------------------------------------------------------

-- A. Lagrings-mätare
CREATE OR REPLACE FUNCTION public.get_total_storage_size_v4()
RETURNS bigint AS $$
DECLARE size_sum bigint;
BEGIN
    SELECT SUM(COALESCE((metadata->>'size')::bigint, 0)) INTO size_sum FROM storage.objects;
    RETURN COALESCE(size_sum, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Rensning av herrelösa profilbilder
CREATE OR REPLACE FUNCTION public.cleanup_orphan_avatars_v4()
RETURNS integer AS $$
DECLARE deleted_count integer;
BEGIN
    DELETE FROM storage.objects s
    WHERE s.bucket_id = 'avatars'
      AND s.name NOT LIKE '.%' 
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.avatar_url IS NOT NULL AND p.avatar_url LIKE '%' || s.name || '%'
      );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Huvudfunktion: TOTAL NATTLIG STÄDNING v4.0
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_nightly_diagnostic_total_v4()
RETURNS TEXT AS $$
DECLARE
    root_id UUID;
    root_ip TEXT;
    cleared_ips INTEGER := 0;
    cleared_orphan_files INTEGER := 0;
    synced_profiles INTEGER := 0;
    cleared_links INTEGER := 0;
    optimized_images INTEGER := 0;
    cleared_notifs INTEGER := 0;
    cleared_reports INTEGER := 0;
    fixed_broken_urls INTEGER := 0;
    cleared_friendships INTEGER := 0;
    cleared_logs INTEGER := 0;
    log_msg TEXT;
BEGIN
    -- 0. Hämta Root-Admin info
    SELECT id, last_ip INTO root_id, root_ip FROM public.profiles WHERE auth_email = 'apersson508@gmail.com' LIMIT 1;
    IF root_id IS NULL THEN RETURN 'FEL: Root-Admin saknas.'; END IF;

    -- 1. SÄKERHET: Skydda Root-IP 🛡️
    IF root_ip IS NOT NULL AND root_ip <> '' THEN
        DELETE FROM public.blocked_ips WHERE ip = root_ip;
        cleared_ips := 1;
    END IF;

    -- 2. DATABASHÄLSA: Synka profiler vs Auth
    INSERT INTO public.profiles (id, username, created_at)
    SELECT id, email, created_at FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles)
    ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS synced_profiles = ROW_COUNT;

    -- 3. INNEHÅLLSHÄLSA: Rensning av döda länkar (raderade konton)
    DELETE FROM public.whiteboard WHERE author_id NOT IN (SELECT id FROM public.profiles);
    DELETE FROM public.forum_posts WHERE author_id NOT IN (SELECT id FROM public.profiles);
    DELETE FROM public.guestbook WHERE sender_id NOT IN (SELECT id FROM public.profiles);
    cleared_links := 1; -- Markerad som utförd

    -- 4. BILD-RENSNING: Herrelösa filer i storage
    SELECT public.cleanup_orphan_avatars_v4() INTO cleared_orphan_files;

    -- 5. BILD-OPTIMERING: Tvinga 800px bredd på alla avatarer
    WITH upd AS (
        UPDATE public.profiles SET avatar_url = avatar_url || '?width=800&resize=contain'
        WHERE avatar_url IS NOT NULL AND avatar_url != '' AND avatar_url NOT LIKE '%?width=800%'
        RETURNING 1
    ) SELECT count(*) INTO optimized_images FROM upd;

    -- 6. SKRÄPDATA: Rensning (> 30 dagar)
    DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS cleared_notifs = ROW_COUNT;

    -- 7. NYHET: Ignorerade Anmälningar (> 7 dagar) - Rensar gamla öppna ärenden
    DELETE FROM public.reports WHERE status = 'open' AND created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS cleared_reports = ROW_COUNT;

    -- 8. TRASIGA LÄNKAR: Fixa 'undefined' eller 'null' i profilbilder
    WITH bad_urls AS (
        UPDATE public.profiles SET avatar_url = NULL 
        WHERE avatar_url ILIKE '%undefined%' OR avatar_url ILIKE '%null%'
        RETURNING 1
    ) SELECT count(*) INTO fixed_broken_urls FROM bad_urls;

    -- 9. SOCIAL HÄLSA: Vänskaps-rättningar (dubletter)
    DELETE FROM public.friendships WHERE (user_id_1, user_id_2) IN (
        SELECT user_id_1, user_id_2 FROM (
            SELECT user_id_1, user_id_2, ROW_NUMBER() OVER (PARTITION BY LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2) ORDER BY created_at DESC) as row_num
            FROM public.friendships
        ) t WHERE t.row_num > 1
    );
    GET DIAGNOSTICS cleared_friendships = ROW_COUNT;

    -- 10. LOG-STÄDNING: Gamla system-loggar (> 15 dagar)
    DELETE FROM public.admin_logs WHERE created_at < NOW() - INTERVAL '15 days' AND action NOT LIKE '%Befordrade%';
    GET DIAGNOSTICS cleared_logs = ROW_COUNT;

    -- SLUTLIG LOGGNING 📜
    log_msg := '03:00 TOTAL V4 STÄDNING KLAR. Resultat: ' || 
               cleared_orphan_files || ' bilder raderade, ' ||
               synced_profiles || ' profiler synkade, ' ||
               optimized_images || ' bilder optimerade, ' ||
               cleared_notifs || ' notiser/anmälningar rensade, ' ||
               cleared_logs || ' loggar städade.';
    
    INSERT INTO public.admin_logs (admin_id, action) VALUES (root_id, log_msg);

    RETURN log_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. SCHEMALÄGGNING (FYRVERKERI-FIXEN 🎆)
-- -------------------------------------------------------------------------
-- Vi rensar ALLA gamla scheman först för att undvika krockar
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-cleanup') THEN
        PERFORM cron.unschedule('nightly-cleanup');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'facechat-nightly-0300') THEN
        PERFORM cron.unschedule('facechat-nightly-0300');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'facechat-nightly-total') THEN
        PERFORM cron.unschedule('facechat-nightly-total');
    END IF;
END $$;

-- Vi schemalägger v4 till kl. 01:00 UTC (vilket är kl. 03:00 i Sverige under sommartid)
-- Detta gör att jobbet garanterat körs när sidan har minst trafik.
SELECT cron.schedule('facechat-nightly-total', '0 1 * * *', 'SELECT public.run_nightly_diagnostic_total_v4()');

-- BEKRÄFTELSE:
SELECT * FROM cron.job WHERE jobname = 'facechat-nightly-total';
