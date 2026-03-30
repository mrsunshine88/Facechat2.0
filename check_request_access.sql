-- =========================================================================
-- MASTER SECURITY CHECK: check_request_access 🛡️🚀
-- Denna funktion buntar ihop 4 separata SQL-frågor till EN ENDA för Middleware.
-- Minskar latenstid och ökar prestandan drastiskt.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.check_request_access(
  test_ip TEXT, 
  test_user_id UUID DEFAULT NULL, 
  test_session_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    is_root_ip BOOLEAN := false;
    is_blocked_ip BOOLEAN := false;
    is_banned_user BOOLEAN := false;
    session_match BOOLEAN := true;
    root_ip TEXT;
    db_session_key TEXT;
    db_is_banned BOOLEAN;
BEGIN
    -- 1. Hämta Root-Admins senaste IP för immunitet-check
    -- Körs som SECURITY DEFINER för att nå auth_email fältet
    SELECT last_ip INTO root_ip 
    FROM public.profiles 
    WHERE auth_email = 'apersson508@gmail.com' 
    LIMIT 1;
    
    IF test_ip IS NOT NULL AND test_ip = root_ip THEN
        is_root_ip := true;
    END IF;

    -- 2. Kolla om IP-adressen är spärrad (Skippas om man är Root)
    IF NOT is_root_ip AND test_ip IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.blocked_ips WHERE ip = test_ip
        ) INTO is_blocked_ip;
    END IF;

    -- 3. Kolla Användarstatus och Sessions-nyckel (Om inloggad)
    IF test_user_id IS NOT NULL THEN
        SELECT is_banned, session_key
        INTO db_is_banned, db_session_key
        FROM public.profiles 
        WHERE id = test_user_id;
        
        is_banned_user := COALESCE(db_is_banned, false);
        
        -- Kolla sessionsmatch (Endast om vi har en nyckel att jämföra med)
        IF test_session_key IS NOT NULL AND db_session_key IS NOT NULL THEN
            IF db_session_key != test_session_key THEN
                session_match := false;
            END IF;
        END IF;
        
        -- Master-brytare: Root kan aldrig vara bannlyst
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id AND auth_email = 'apersson508@gmail.com') THEN
            is_banned_user := false;
            session_match := true; -- Root tillåts flera sessioner om det skulle krocka
        END IF;
    END IF;

    result := jsonb_build_object(
        'is_root_ip', is_root_ip,
        'is_blocked_ip', is_blocked_ip,
        'is_banned_user', is_banned_user,
        'session_match', session_match
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
