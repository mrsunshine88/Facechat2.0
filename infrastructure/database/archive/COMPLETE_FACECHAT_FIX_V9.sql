-- =========================================================================
-- COMPLETE FACECHAT FIX (VERSION 9 - THE NORMALIZER)
-- =========================================================================
-- Detta skript fixar:
-- 1. Normalisering (Ser till att user_id_1 alltid är mindre än user_id_2)
-- 2. Själv-vänskaper (Raderar rader där man är vän med sig själv)
-- 3. Dubbletter (Rensar en sista gång efter normalisering)
-- =========================================================================

-- 1. STÄDA BORT "SJÄLV-VÄNSKAPER" (Man kan inte vara vän med sig själv)
DELETE FROM public.friendships WHERE user_id_1 = user_id_2;

-- 2. NORMALISERA ID-ORDNING (Mycket viktigt för att frontend-matchning ska fungera!)
-- Vi ser till att user_id_1 alltid är det lägre UUID-värdet.
UPDATE public.friendships 
SET user_id_1 = user_id_2, 
    user_id_2 = user_id_1
WHERE user_id_1 > user_id_2;

-- 3. RENSA DUBBLETTER SOM UPPSTÅTT EFTER NORMALISERING
-- Om det nu finns två rader för samma par (t.ex. en gammal bakvänd rad), behåll bara den bästa.
WITH d_dupes AS (
    DELETE FROM public.friendships WHERE ctid IN (
        SELECT ctid FROM (
            SELECT ctid, row_number() OVER (
                PARTITION BY user_id_1, user_id_2 
                ORDER BY (CASE WHEN status = 'accepted' THEN 1 ELSE 2 END), created_at DESC
            ) as rn FROM public.friendships
        ) t WHERE t.rn > 1
    ) RETURNING 1
) SELECT count(*) as raderade_dubbletter FROM d_dupes;

-- 4. RENSA PENDING OM ACCEPTED FINNS (Igen, för säkerhets skull)
DELETE FROM public.friendships f1
WHERE f1.status = 'pending'
AND EXISTS (
    SELECT 1 FROM public.friendships f2
    WHERE f2.status = 'accepted'
    AND f2.user_id_1 = f1.user_id_1 
    AND f2.user_id_2 = f1.user_id_2
);

-- 5. ÅTERSTÄLL TRIGGER-LOGIK EN SISTA GÅNG (Version 8 logik var bra, men vi kör om den)
DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS on_friendship_change ON public.friendships;
    DROP FUNCTION IF EXISTS public.handle_friend_notification();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.handle_friend_notification()
RETURNS TRIGGER AS $$
DECLARE target_uid UUID;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        target_uid := CASE WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 ELSE NEW.user_id_1 END;
        INSERT INTO notifications (receiver_id, actor_id, type, content, link) 
        VALUES (target_uid, NEW.action_user_id, 'friend_request', 'vill bli din vän!', '/krypin?tab=Vänner');
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted') THEN
        target_uid := CASE WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 ELSE NEW.user_id_1 END;
        INSERT INTO notifications (receiver_id, actor_id, type, content, link) 
        VALUES (target_uid, NEW.action_user_id, 'friend_accept', 'har accepterat din förfrågan!', '/krypin?tab=Vänner');
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_friendship_change AFTER INSERT OR UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.handle_friend_notification();

-- KLART! Testa att ladda om sidan och trycka på knapparna nu.
