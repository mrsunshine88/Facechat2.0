-- =========================================================================
-- COMPLETE FACECHAT FIX (VERSION 7 - THE ULTIMATE CLEANUP)
-- =========================================================================
-- Detta skript fixar:
-- 1. Dubbla notiser (flyttar all logik till databasen)
-- 2. 406 Not Acceptable (rensar dubbla rader som krockar med .single)
-- 3. Spökrutor för Helena och apersson508
-- =========================================================================

-- 1. DROP OLD TRIGGERS AND FUNCTIONS
DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS on_friendship_change ON public.friendships;
    DROP FUNCTION IF EXISTS public.handle_friend_notification();
    DROP FUNCTION IF EXISTS public.fix_duplicate_facechat_data();
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- 2. CREATE MASTER CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION public.fix_duplicate_facechat_data()
RETURNS TABLE (table_name text, deleted_count integer) AS $$
DECLARE
    deleted_p integer := 0;
    deleted_f integer := 0;
    deleted_s integer := 0;
BEGIN
    -- A. Cleanup PROFILES (dubbletter på samma ID/ID-krockar)
    -- Vi sparar den nyaste raden per ID
    WITH d_profiles AS (
        DELETE FROM public.profiles WHERE ctid IN (
            SELECT ctid FROM (
                SELECT ctid, row_number() OVER (PARTITION BY id ORDER BY updated_at DESC, created_at DESC) as rn FROM public.profiles
            ) t WHERE t.rn > 1
        ) RETURNING 1
    ) SELECT count(*) INTO deleted_p FROM d_profiles;

    -- B. Cleanup FRIENDSHIPS
    -- 1. Radera alla 'pending' om det redan finns en 'accepted' för samma par
    WITH d_pending AS (
        DELETE FROM public.friendships f1
        WHERE f1.status = 'pending'
        AND EXISTS (
            SELECT 1 FROM public.friendships f2
            WHERE f2.status = 'accepted'
            AND ((f2.user_id_1 = f1.user_id_1 AND f2.user_id_2 = f1.user_id_2) OR (f2.user_id_1 = f1.user_id_2 AND f2.user_id_2 = f1.user_id_1))
        ) RETURNING 1
    ) SELECT count(*) INTO deleted_f FROM d_pending;

    -- 2. Radera dubbletter av vänskaper (behall bara en rad per unikt par)
    WITH d_dupes AS (
        DELETE FROM public.friendships WHERE ctid IN (
            SELECT ctid FROM (
                SELECT ctid, row_number() OVER (
                    PARTITION BY least(user_id_1, user_id_2), greatest(user_id_1, user_id_2) 
                    ORDER BY (CASE WHEN status = 'accepted' THEN 1 ELSE 2 END), created_at DESC
                ) as rn FROM public.friendships
            ) t WHERE t.rn > 1
        ) RETURNING 1
    ) SELECT count(*) + deleted_f INTO deleted_f FROM d_dupes;

    -- C. Cleanup USER_SECRETS (Fixar 406 i Inställningar)
    WITH d_secrets AS (
        DELETE FROM public.user_secrets WHERE ctid IN (
            SELECT ctid FROM (
                SELECT ctid, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn FROM public.user_secrets
            ) t WHERE t.rn > 1
        ) RETURNING 1
    ) SELECT count(*) INTO deleted_s FROM d_secrets;

    RETURN QUERY SELECT 'profiles'::text, deleted_p;
    RETURN QUERY SELECT 'friendships'::text, deleted_f;
    RETURN QUERY SELECT 'user_secrets'::text, deleted_s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREATE NOTIFICATION TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_friend_notification()
RETURNS TRIGGER AS $$
DECLARE target_uid UUID;
BEGIN
    -- Vid ny vänförfrågan (INSERT)
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        target_uid := CASE WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 ELSE NEW.user_id_1 END;
        -- Skicka notis till mottagaren
        INSERT INTO notifications (receiver_id, actor_id, type, content, link) 
        VALUES (target_uid, NEW.action_user_id, 'friend_request', 'vill bli din vän!', '/krypin?tab=Vänner');
        
    -- Vid accepterad vänförfrågan (UPDATE)
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted') THEN
        target_uid := CASE WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 ELSE NEW.user_id_1 END;
        -- Skicka notis till den som skickade förfrågan från början
        INSERT INTO notifications (receiver_id, actor_id, type, content, link) 
        VALUES (target_uid, NEW.action_user_id, 'friend_accept', 'har accepterat din förfrågan!', '/krypin?tab=Vänner');
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ATTACH TRIGGER
CREATE TRIGGER on_friendship_change 
AFTER INSERT OR UPDATE ON public.friendships 
FOR EACH ROW EXECUTE FUNCTION public.handle_friend_notification();

-- 5. RUN CLEANUP IMMEDIATELY
SELECT * FROM public.fix_duplicate_facechat_data();
