-- FACECHAT ROOT-IP SAFETY NET
-- Detta skript skapar en funktion som automatiskt rensar bort 
-- Root-Admins IP från spärrlistan ifall den hamnat där av misstag.

-- 1. Funktionen som utför rensningen
CREATE OR REPLACE FUNCTION public.nuke_root_ip_blocks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Körs med höjda rättigheter
AS $$
DECLARE
    root_ip TEXT;
BEGIN
    -- Hämta nuvarande IP för apersson508
    SELECT last_ip INTO root_ip FROM public.profiles WHERE username = 'apersson508' LIMIT 1;

    -- Om en IP hittas, radera den från blocked_ips
    IF root_ip IS NOT NULL AND root_ip <> '' THEN
        DELETE FROM public.blocked_ips WHERE ip = root_ip;
        
        -- Logga händelsen om något raderades
        IF FOUND THEN
            INSERT INTO public.admin_logs (admin_id, action)
            SELECT id, 'System: Automatisk nöd-upplåsning av Root-IP (' || root_ip || ')'
            FROM public.profiles 
            WHERE username = 'apersson508' 
            LIMIT 1;
        END IF;
    END IF;
END;
$$;

-- 2. (VALFRITT) Schemaläggning via pg_cron (Kräver att extension är påslagen i Supabase)
-- Om du vill att detta ska köras automatiskt kl 03:00 varje natt:
-- SELECT cron.schedule('root-ip-safety-0300', '0 3 * * *', 'SELECT nuke_root_ip_blocks()');

-- NOTERA: Du kan även köra denna manuellt i SQL Editor när som helst:
-- SELECT nuke_root_ip_blocks();
