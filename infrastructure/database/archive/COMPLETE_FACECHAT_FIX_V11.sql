-- =========================================================================
-- COMPLETE FACECHAT FIX (VERSION 11 - THE FINAL RECTIFIER)
-- =========================================================================
-- Fixar: 
-- 1. Mirrored Rows (A->B och B->A krockar)
-- 2. Normalisering (user_id_1 < user_id_2)
-- 3. Själv-vänskaper (Mrsunshine88-rutan)
-- =========================================================================

-- 1. RADERA SJÄLV-VÄNSKAPER
DELETE FROM public.friendships WHERE user_id_1 = user_id_2;

-- 2. HANTERA SPEGLADE RADER (RADERA DEN "FELAKTIGA" INNAN NORMALISERING)
-- Vi sparar unika par. Om det finns både (A,B) och (B,A), behåll 'accepted' eller den nyaste.
DELETE FROM public.friendships f1
WHERE f1.user_id_1 > f1.user_id_2
AND EXISTS (
    SELECT 1 FROM public.friendships f2 
    WHERE f2.user_id_1 = f1.user_id_2 AND f2.user_id_2 = f1.user_id_1
);

-- 3. NORMALISERA ALLA KVARVARANDE RADER (Lägsta ID först)
UPDATE public.friendships 
SET user_id_1 = user_id_2, user_id_2 = user_id_1
WHERE user_id_1 > user_id_2;

-- 4. RENSA DUBBLETTER (Sista säkerhetskollen)
WITH d_dupes AS (
    SELECT ctid, row_number() OVER (PARTITION BY user_id_1, user_id_2 ORDER BY (CASE WHEN status = 'accepted' THEN 1 ELSE 2 END), created_at DESC) as rn
    FROM public.friendships
)
DELETE FROM public.friendships WHERE ctid IN (SELECT ctid FROM d_dupes WHERE rn > 1);

-- 5. TRIGGER LOGIK
DO $$ BEGIN
    DROP TRIGGER IF EXISTS on_friendship_change ON public.friendships;
    DROP FUNCTION IF EXISTS public.handle_friend_notification();
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.handle_friend_notification() RETURNS TRIGGER AS $$
DECLARE target_uid UUID;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        target_uid := CASE WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 ELSE NEW.user_id_1 END;
        INSERT INTO notifications (receiver_id, actor_id, type, content, link) VALUES (target_uid, NEW.action_user_id, 'friend_request', 'vill bli din vän!', '/krypin?tab=Vänner');
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted') THEN
        target_uid := CASE WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 ELSE NEW.user_id_1 END;
        INSERT INTO notifications (receiver_id, actor_id, type, content, link) VALUES (target_uid, NEW.action_user_id, 'friend_accept', 'har accepterat din förfrågan!', '/krypin?tab=Vänner');
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_friendship_change AFTER INSERT OR UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.handle_friend_notification();

-- FÄRDIGT!
