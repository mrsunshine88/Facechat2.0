-- =========================================================================
-- FACECHAT 2.0 - ADMIN DIAGNOSTIC ROUTINES & NIGHTLY MAINTENANCE v1.1
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT AKTIVERA VÅRDCENTRALEN! 🏥⚡
-- =========================================================================

-- 1. AKTIVERA EXTENSIONS OCH RÄTTIGHETER
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated;
GRANT SELECT ON storage.objects TO postgres, anon, authenticated;
GRANT SELECT ON storage.buckets TO postgres, anon, authenticated;

-- 2. RUTINER FÖR DIAGNOSVERKTYGET (RPC)
-- -------------------------------------------------------------------------

-- Räkna total lagringsstorlek specifikt för 'avatars' hinken (Anpassad för äldre Supabase)
CREATE OR REPLACE FUNCTION public.get_total_storage_size()
RETURNS bigint AS $$
DECLARE
    size_sum bigint;
BEGIN
    -- I äldre Supabase ligger storleken i metadata-fältet som JSON
    SELECT SUM(COALESCE((metadata->>'size')::bigint, 0)) INTO size_sum 
    FROM storage.objects 
    WHERE bucket_id = 'avatars';

    RETURN COALESCE(size_sum, 0);
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hitta och laga profil-rader som saknas trots att användaren finns i Auth
CREATE OR REPLACE FUNCTION public.diagnose_missing_profiles()
RETURNS integer AS $$
DECLARE
    missing_count integer;
BEGIN
    INSERT INTO public.profiles (id, username, created_at)
    SELECT id, email, created_at FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.profiles)
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS missing_count = ROW_COUNT;
    RETURN missing_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rensa döda länkar (Inlägg från raderade konton som blivit kvar)
CREATE OR REPLACE FUNCTION public.fix_dead_links()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
    total_deleted integer := 0;
BEGIN
    -- Whiteboard
    DELETE FROM public.whiteboard WHERE author_id NOT IN (SELECT id FROM public.profiles);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total_deleted := total_deleted + deleted_count;

    -- Forum
    DELETE FROM public.forum_posts WHERE author_id NOT IN (SELECT id FROM public.profiles);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total_deleted := total_deleted + deleted_count;

    -- Gästbok
    DELETE FROM public.guestbook WHERE sender_id NOT IN (SELECT id FROM public.profiles);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total_deleted := total_deleted + deleted_count;
  
    RETURN total_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NY: Rensa herrelösa profilbilder (Bilder i storage som inte används)
CREATE OR REPLACE FUNCTION public.cleanup_orphan_avatars()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Raderar poster från storage.objects som inte finns i någons avatar_url
    DELETE FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND name <> '.emptyFolderPlaceholder'
      AND name NOT IN (
        SELECT split_part(split_part(avatar_url, '/avatars/', 2), '?', 1)
        FROM public.profiles
        WHERE avatar_url IS NOT NULL
      );
      
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.1 Bild-Optimeraren (Append parameters for Supabase transformation service)
CREATE OR REPLACE FUNCTION public.optimize_uploaded_images()
RETURNS integer AS $$
DECLARE
  affected_rows integer;
BEGIN
  WITH updated AS (
    UPDATE public.profiles 
    SET avatar_url = avatar_url || '?width=800&resize=contain'
    WHERE avatar_url IS NOT NULL 
      AND avatar_url != '' 
      -- Vi appendrar endast om inte redan finns bredd-inställning eller token
      -- (Tjänsten fungerar bäst med rena sökvägar till JPG/PNG)
      AND avatar_url NOT LIKE '%width=800%'
      AND avatar_url NOT LIKE '%?%' -- Om den redan har parametrar (t.ex. token) skippar vi för säkerhets skull
      AND avatar_url LIKE '%/avatars/%'
    RETURNING 1
  )
  SELECT count(*) INTO affected_rows FROM updated;
  
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fixa dubbla vänskapsrelationer eller blockeringar
CREATE OR REPLACE FUNCTION public.fix_duplicate_friendships()
RETURNS integer AS $$
DECLARE
    removed_count integer;
BEGIN
    DELETE FROM public.friendships
    WHERE id IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY sender_id, receiver_id ORDER BY created_at DESC) as row_num
            FROM public.friendships
        ) t WHERE t.row_num > 1
    );
    GET DIAGNOSTICS removed_count = ROW_COUNT;
    RETURN removed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Snabba upp hämtning av Root-Admins IP
CREATE OR REPLACE FUNCTION public.get_root_admin_ip()
RETURNS text AS $$
BEGIN
    RETURN (SELECT last_ip FROM public.profiles WHERE auth_email = 'apersson508@gmail.com' LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. NATTLIG UNDERHÅLLSRUTIN (03:00)
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nightly_maintenance()
RETURNS void AS $$
DECLARE
    links_fixed integer;
    profiles_fixed integer;
    friends_fixed integer;
    images_cleaned integer;
    notifs_cleaned integer;
    admin_id uuid;
    log_msg text;
BEGIN
    -- Hämta Root Admin ID för loggning
    SELECT id INTO admin_id FROM public.profiles WHERE auth_email = 'apersson508@gmail.com' LIMIT 1;

    -- Kör alla lagningar
    links_fixed := public.fix_dead_links();
    profiles_fixed := public.diagnose_missing_profiles();
    friends_fixed := public.fix_duplicate_friendships();
    images_cleaned := public.cleanup_orphan_avatars();
    PERFORM public.optimize_uploaded_images(); -- Kör även bildoptimeraren nattetid
    
    -- Rensa gamla notiser (äldre än 30 dagar)
    DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS notifs_cleaned = ROW_COUNT;
    
    -- Skapa loggmeddelandet
    log_msg := format('SYSTEM: Nattlig städning klar. Raderade %s herrelösa bilder, fixade %s döda länkar, lade till %s saknade profiler och rensade %s gamla notiser.', 
        images_cleaned, links_fixed, profiles_fixed, notifs_cleaned);
    
    -- Logga resultatet i admin_logs om admin_id hittades
    IF admin_id IS NOT NULL THEN
        INSERT INTO public.admin_logs (admin_id, action) VALUES (admin_id, log_msg);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SCHEMALÄGGNING VIA PG_CRON
-- -------------------------------------------------------------------------
-- Detta körs varje natt klockan 03:00 (UTC)

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-cleanup') THEN
        PERFORM cron.unschedule('nightly-cleanup');
    END IF;
END $$;

-- Lägg till nytt schema
SELECT cron.schedule('nightly-cleanup', '0 3 * * *', 'SELECT public.nightly_maintenance()');

-- BEKRÄFTELSE: Om du ser 'nightly-cleanup' i listan nedan fungerar det!
SELECT * FROM cron.job;
