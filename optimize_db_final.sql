-- =========================================================================
-- COMPLETE PERFORMANCE & BUGFIX OPTIMIZATIONS v3.0 🏎️💨🩺
-- =========================================================================

-- 1. Funktionellt index för blixtsnabb bildrensning
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_filename 
ON public.profiles ( (substring(avatar_url FROM '[^/]+$')) ) 
WHERE avatar_url IS NOT NULL;

-- 2. Snabba upp personliga inställningar (Mina Sidor)
CREATE INDEX IF NOT EXISTS idx_user_secrets_user_id 
ON public.user_secrets (user_id);

-- 3. Hämta Root-Admins IP (Fixar 400 Bad Request-felet)
CREATE OR REPLACE FUNCTION public.get_root_admin_ip(target_email text)
RETURNS text AS $$
BEGIN
    RETURN (SELECT last_ip FROM public.profiles WHERE auth_email = target_email LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
GRANT EXECUTE ON FUNCTION public.get_root_admin_ip() TO authenticated, service_role;

-- =========================================================================
-- KLART! Kör detta i din SQL Editor så försvinner 400-felet och segheten.
-- =========================================================================
