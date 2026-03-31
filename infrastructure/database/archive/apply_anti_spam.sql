-- =========================================================================
-- FACECHAT 2.0 - ANTI-SPAM & AUTO-BAN RATE LIMITER (30/60 & 50/60 RULE) 🛡️🚀
-- =========================================================================

-- Funktion för att kontrollera meddelandehastighet enligt användarens regler:
-- 30 meddelanden på 60 sekunder -> Varning till Admin
-- 50 meddelanden på 60 sekunder -> Auto-Ban & Utkastning
CREATE OR REPLACE FUNCTION public.check_message_rate_limit()
RETURNS trigger AS $$
DECLARE
    msg_count_60 INTEGER;
    current_user_id UUID;
    v_username TEXT;
BEGIN
    -- Identifiera avsändaren
    IF TG_TABLE_NAME = 'guestbook' OR TG_TABLE_NAME = 'private_messages' THEN
        current_user_id := NEW.sender_id;
    ELSE
        current_user_id := NEW.author_id;
    END IF;

    -- Undantag för Root-Admin
    SELECT username INTO v_username FROM public.profiles WHERE id = current_user_id;
    IF v_username = 'apersson508' THEN
        RETURN NEW;
    END IF;

    -- Räkna meddelanden från denna användare de senaste 60 sekunderna (Globalt i Gästbok + PM)
    SELECT (
        (SELECT COUNT(*) FROM public.guestbook WHERE sender_id = current_user_id AND created_at > (NOW() - INTERVAL '60 seconds')) +
        (SELECT COUNT(*) FROM public.private_messages WHERE sender_id = current_user_id AND created_at > (NOW() - INTERVAL '60 seconds'))
    ) INTO msg_count_60;

    -- REGEL 1: 50 meddelanden inom 60 sekunder -> AUTO-BAN 🚫
    IF msg_count_60 >= 50 THEN
        UPDATE public.profiles SET is_banned = true WHERE id = current_user_id;
        
        -- Logga händelsen för Admin
        INSERT INTO public.admin_logs (admin_id, action, details) 
        VALUES (current_user_id, 'AUTO_BAN_SPAM', jsonb_build_object('reason', 'Överskred 50 meddelanden/60s', 'count', msg_count_60));
        
        RAISE EXCEPTION 'Säkerhetsspärr: Ditt konto har automatiskt spärrats pga extrem spamming (50+ meddelanden/min).';

    -- REGEL 2: 30 meddelanden inom 60 sekunder -> VARNING TILL ADMIN 🚨
    ELSIF msg_count_60 >= 30 THEN
        -- Skicka en "Varning" via admin_logs (syns i Audit) och skapa en log-notis
        INSERT INTO public.admin_logs (admin_id, action, details) 
        VALUES (current_user_id, 'SPAM_WARNING_30', jsonb_build_object('message', 'Användare skickar meddelanden mycket snabbt', 'count', msg_count_60));
        
        -- Vi låter meddelandet gå igenom, men vi har flaggat användaren för admins
    END IF;

    -- Mjuk spärr för att förhindra "Listener Storm" dubbletter (max 1 meddelande per sekund)
    IF EXISTS (
        SELECT 1 FROM public.guestbook WHERE sender_id = current_user_id AND created_at > (NOW() - INTERVAL '1 second')
        UNION ALL
        SELECT 1 FROM public.private_messages WHERE sender_id = current_user_id AND created_at > (NOW() - INTERVAL '1 second')
    ) THEN
        RAISE EXCEPTION 'Vänta en sekund innan du skickar nästa meddelande.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Koppla triggern till Gästbok
DROP TRIGGER IF EXISTS trg_ratelimit_guestbook ON public.guestbook;
CREATE TRIGGER trg_ratelimit_guestbook
BEFORE INSERT ON public.guestbook
FOR EACH ROW EXECUTE FUNCTION public.check_message_rate_limit();

-- Koppla triggern till PM
DROP TRIGGER IF EXISTS trg_ratelimit_pm ON public.private_messages;
CREATE TRIGGER trg_ratelimit_pm
BEFORE INSERT ON public.private_messages
FOR EACH ROW EXECUTE FUNCTION public.check_message_rate_limit();

-- Logga att systemet är uppdaterat till 30/50 reglerna
INSERT INTO public.admin_logs (action, details) 
VALUES ('system_update', '{"feature": "anti_spam_30_50_rule", "status": "restored_to_full_strength"}');
