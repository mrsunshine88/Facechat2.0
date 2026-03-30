-- =========================================================================
-- SÄKERHETS-RPC: HÄMTA ROOT-ADMINS IP (SÄKERT) 🛡️✅
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT AKTIVERA "SÄKERT IP"-INDICATORN
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_root_admin_ip()
RETURNS TEXT AS $$
DECLARE
    found_ip TEXT;
BEGIN
    -- Denna funktion körs som 'SECURITY DEFINER' (med systemrättigheter)
    -- Vilket gör att vi kan läsa 'auth_email' även om det är skyddat i RLS!
    SELECT last_ip INTO found_ip 
    FROM public.profiles 
    WHERE auth_email = 'apersson508@gmail.com' 
    LIMIT 1;

    RETURN found_ip;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TESTA FUNKTIONEN (Ska returnera din IP):
-- SELECT get_root_admin_ip();
