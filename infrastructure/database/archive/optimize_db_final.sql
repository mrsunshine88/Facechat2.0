-- =========================================================================
-- COMPLETE PERFORMANCE & BUGFIX OPTIMIZATIONS v3.1 🏎️💨🩺
-- =========================================================================

-- 1. Funktionellt index för blixtsnabb bildrensning
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_filename 
ON public.profiles ( (substring(avatar_url FROM '[^/]+$')) ) 
WHERE avatar_url IS NOT NULL;

-- 2. Snabba upp personliga inställningar (Mina Sidor)
CREATE INDEX IF NOT EXISTS idx_user_secrets_user_id 
ON public.user_secrets (user_id);

-- 3. Städa bort gamla versioner av IP-kontrollen (denna logik flyttas till koden)
DROP FUNCTION IF EXISTS public.get_root_admin_ip();
DROP FUNCTION IF EXISTS public.get_root_admin_ip(text);

-- 4. Uppdaterad get_orphan_avatars som använder det nya indexet
CREATE OR REPLACE FUNCTION public.get_orphan_avatars()
RETURNS TABLE(file_name text) AS $$
BEGIN
    RETURN QUERY
    SELECT s.name::text
    FROM storage.objects s
    WHERE s.bucket_id = 'avatars'
      AND s.name NOT LIKE '.%' 
      AND s.name NOT IN (
        SELECT (substring(avatar_url FROM '[^/]+$'))
        FROM public.profiles 
        WHERE avatar_url IS NOT NULL
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ge rättigheter till funktionerna
GRANT EXECUTE ON FUNCTION public.get_orphan_avatars() TO authenticated, service_role;

-- =========================================================================
-- KLART! Kopiera och kör detta i din SQL Editor.
-- =========================================================================
