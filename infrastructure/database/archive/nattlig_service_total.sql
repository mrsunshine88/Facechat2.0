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
    cleared_orphans_data INTEGER := 0;
    cleared_orphan_files INTEGER := 0;
    cleared_friendships INTEGER := 0;
    cleared_notifs INTEGER := 0;
    cleared_mails INTEGER := 0;
    cleared_broken_avatars INTEGER := 0;
    cleared_empty_posts INTEGER := 0;
    synced_profiles INTEGER := 0;
    log_msg TEXT;
BEGIN
    -- 0. Hämta Root-Admin info (via email för säkerhet)
    SELECT id, last_ip INTO root_id, root_ip FROM public.profiles WHERE auth_email = 'apersson508@gmail.com' LIMIT 1;
    IF root_id IS NULL THEN
        RETURN 'FEL: Root-Admin (apersson508@gmail.com) hittades inte. Avbryter diagnos.';
    END IF;

    -- 1. SÄKERHETSTEST: Root-IP skydd 🛡️ (Lås upp om spärrad)
    IF root_ip IS NOT NULL AND root_ip <> '' THEN
        WITH deleted AS (
            DELETE FROM public.blocked_ips WHERE ip = root_ip RETURNING 1
        ) SELECT count(*) INTO cleared_ips FROM deleted;
    END IF;

    -- 2. SYNKRONISERING: Saknade profiler 👥
    SELECT public.diagnose_missing_profiles() INTO synced_profiles;

    -- 3. SOCIAL HÄLSA: Vänskaper & Rykten 👥
    SELECT public.fix_duplicate_friendships() INTO cleared_friendships;

    -- 4. BILD-STÄDNING: Herrelösa filer i storage 🖼️
    -- Detta raderar herrelösa profilbilder helt automatiskt
    SELECT public.cleanup_orphan_avatars() INTO cleared_orphan_files;

    -- 5. CONTENT: Döda länkar och GDPR-städning 📁
    SELECT public.fix_dead_links() INTO cleared_orphans_data;

    -- 6. DATASANERING: Gamla notiser & Mejl (> 30 dagar och lästa) ⏳
    WITH d_notifs AS (DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days' RETURNING 1),
         d_mails AS (DELETE FROM public.private_messages WHERE created_at < NOW() - INTERVAL '30 days' AND is_read = true RETURNING 1)
    SELECT (SELECT count(*) FROM d_notifs) INTO cleared_notifs;
    SELECT (SELECT count(*) FROM d_mails) INTO cleared_mails;

    -- 7. BILD-KVALITET: Fixa trasiga URL-strängar 🖼️
    WITH d_avatars AS (
        UPDATE public.profiles 
        SET avatar_url = NULL 
        WHERE avatar_url ILIKE '%undefined%' OR avatar_url ILIKE '%null%'
        RETURNING 1
    ) SELECT count(*) INTO cleared_broken_avatars FROM d_avatars;

    -- 8. SKRÄPFILTER: Tomma inlägg i Forum & Gästbok 🧹
    WITH d_empty_posts AS (
        DELETE FROM public.forum_posts WHERE content = '' OR length(trim(content)) = 0 RETURNING 1
    ) SELECT count(*) INTO cleared_empty_posts FROM d_empty_posts;
    
    WITH d_empty_guests AS (
        DELETE FROM public.guestbook WHERE content = '' OR length(trim(content)) = 0 RETURNING 1
    ) SELECT cleared_empty_posts + count(*) INTO cleared_empty_posts FROM d_empty_guests;

    -- Extra: Optimera bildparametrar
    PERFORM public.optimize_uploaded_images();

    -- 9. LOGGNING: Skriv till admin_logs för total insyn 📜
    log_msg := '03:00 TOTAL AUTOMATISK DIAGNOS UTFÖRD. ';
    log_msg := log_msg || 'Åtgärder: ' || cleared_orphan_files || ' herrelösa bilder raderade, ' ||
               cleared_orphans_data || ' döda länkar städade, ' ||
               synced_profiles || ' saknade profiler synkade, ' ||
               cleared_friendships || ' sociala rättningar, ' ||
               cleared_notifs || ' gamla notiser borttagna, ' ||
               cleared_mails || ' gamla lästa mejl rensade, ' ||
               cleared_empty_posts || ' tomma poster raderade.';
    
    IF cleared_ips > 0 THEN log_msg := log_msg || ' OBS: Din Root-IP (' || root_ip || ') låstes upp.'; END IF;

    INSERT INTO public.admin_logs (admin_id, action) 
    VALUES (root_id, log_msg);

    RETURN 'Automatiskt underhåll slutfört! Resultat: ' || log_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- INSTRUKTION FÖR SCHEMALÄGGNING (KL 03:00)
-- =========================================================================
-- För att köra detta automatiskt i Supabase (kräver pg_cron extension):
-- SELECT cron.schedule('facechat-nightly-0300', '0 3 * * *', 'SELECT run_nightly_diagnostic_total()');

-- NOTERA: Du kan köra detta manuellt för att testa direkt:
-- SELECT run_nightly_diagnostic_total();
