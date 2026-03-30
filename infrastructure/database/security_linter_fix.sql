-- =========================================================================
-- FACECHAT 2.0 - SECURITY LINTER FINAL FIX 🛡️🔒
-- ÅTGÄRDAR: Search Path Mutable (0011) & Extension in Public (0014)
-- KÖR DETTA I DIN SUPABASE SQL EDITOR FÖR ATT RENA LINTER-RAPPORTEN!
-- =========================================================================

-- 1. ORGANISERA TILLÄGG (Extension Security)
-- -------------------------------------------------------------------------
-- Det är säkrast att flytta tillägg från 'public' till ett dedikerat schema.
CREATE SCHEMA IF NOT EXISTS extensions;

-- Flytta pg_trgm (Används för sökning i forumet)
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Se till att alla användare kan se tillägg i det nya schemat (Valfritt men rekommenderat)
GRANT USAGE ON SCHEMA extensions TO public;

-- 2. HÄRDA FUNKTIONERS SÖK-VÄGAR (Search Path Hardening)
-- -------------------------------------------------------------------------
-- Linter-varning 0011 kräver att funktioner har en fastställd search_path.
-- Vi hämtar automatiskt alla relevanta funktioner och låser dem till 'public'.

DO $$
DECLARE
    f_record record;
BEGIN
    FOR f_record IN 
        SELECT 
            p.oid,
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'get_root_admin_ip',
            'check_request_access',
            'get_newsfeed',
            'run_nightly_diagnostic_total',
            'nightly_maintenance',
            'handle_new_user',
            'get_total_storage_size',
            'protect_root_admin',
            'protect_root_ip_block',
            'check_is_root_ip',
            'is_root_user',
            'nuke_root_ip_blocks'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', f_record.proname, f_record.args);
    END LOOP;
END $$;

-- KLART! Din databas är nu polerad och säkrad enligt Supabase best practices. 🎷💎

-- KLART! Din databas är nu polerad och säkrad enligt Supabase best practices. 🎷💎
