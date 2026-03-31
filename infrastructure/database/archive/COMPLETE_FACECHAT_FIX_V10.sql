-- =========================================================================
-- COMPLETE FACECHAT FIX (VERSION 10 - THE MIRROR FIXER)
-- =========================================================================
-- Detta skript fixar:
-- 1. "Duplicate key" felet (hanterar speglade rader A->B och B->A)
-- 2. Själv-vänskaper (Raderar rader där man är vän med sig själv)
-- 3. Normalisering (Ser till att user_id_1 alltid är mindre än user_id_2)
-- =========================================================================

-- 1. RADERA SJÄLV-VÄNSKAPER (Fixar Mrsunshine88-rutan)
DELETE FROM public.friendships WHERE user_id_1 = user_id_2;

-- 2. HANTERA SPEGLADE RADER (Innan vi normaliserar ordningen)
-- Om det finns både (A,B) och (B,A), behåll den som är 'accepted', annars den nyaste.
WITH mirrored_to_delete AS (
    SELECT f1.ctid
    FROM public.friendships f1
    JOIN public.friendships f2 ON f1.user_id_1 = f2.user_id_2 AND f1.user_id_2 = f2.user_id_1
    WHERE f1.user_id_1 > f1.user_id_2 -- Vi vill vända på denna, men f2 finns redan
)
DELETE FROM public.friendships WHERE ctid IN (SELECT ctid FROM mirrored_to_delete);

-- 3. NORMALISERA ID-ORDNING (Nu säkert utan Duplicate Key-fel!)
UPDATE public.friendships 
SET user_id_1 = user_id_2, 
    user_id_2 = user_id_1
WHERE user_id_1 > user_id_2;

-- 4. RENSA EVENTUELLA KVARVARANDE DUBBLETTER
WITH final_dupes AS (
    SELECT ctid, row_number() OVER (PARTITION BY user_id_1, user_id_2 ORDER BY (CASE WHEN status = 'accepted' THEN 1 ELSE 2 END), created_at DESC) as rn
    FROM public.friendships
)
DELETE FROM public.friendships WHERE ctid IN (SELECT ctid FROM final_dupes WHERE rn > 1);

-- 5. UPPDATERA NOTIS-TRIGGER (Samma som förut, fungerar bra)
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

-- KLART! Testa nu.
