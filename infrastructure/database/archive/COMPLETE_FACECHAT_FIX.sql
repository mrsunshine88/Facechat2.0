-- =========================================================================
-- COMPLETE FACECHAT FIX (VERSION 5 - NUCLEAR CLEANUP)
-- =========================================================================

-- 1. RENSA GAMLA RESTER SÄKERT
DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS on_friendship_change ON public.friendships;
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Kunde inte ta bort trigger: %', SQLERRM;
END $$;

DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS public.handle_friend_notification();
    DROP FUNCTION IF EXISTS public.fix_duplicate_friendships();
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Kunde inte ta bort funktioner: %', SQLERRM;
END $$;

-- 2. SKAPA STÄD-FUNKTION (NUCLEAR FORCE)
CREATE OR REPLACE FUNCTION public.fix_duplicate_friendships()
RETURNS integer AS $$
DECLARE
  total_deleted integer := 0;
  count_temp integer := 0;
BEGIN
  -- A. NUCLEAR FORCE: Radera ALLA 'pending' rader där parterna redan är vänner
  WITH d1 AS (
    DELETE FROM public.friendships f1
    WHERE f1.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.friendships f2
      WHERE f2.status = 'accepted'
      AND ((f2.user_id_1 = f1.user_id_1 AND f2.user_id_2 = f1.user_id_2) OR (f2.user_id_1 = f1.user_id_2 AND f2.user_id_2 = f1.user_id_1))
    )
    RETURNING 1
  ) SELECT count(*) INTO count_temp FROM d1;
  total_deleted := total_deleted + count_temp;

  -- B. DUBBLETT-RENSNING (ctid) - Om det finns två 'accepted' rader för samma par
  WITH d2 AS (
    DELETE FROM public.friendships WHERE ctid IN (
      SELECT ctid FROM (
        SELECT ctid, row_number() OVER (PARTITION BY least(user_id_1, user_id_2), greatest(user_id_1, user_id_2) ORDER BY created_at DESC) as rn FROM public.friendships
      ) t WHERE t.rn > 1
    ) RETURNING 1
  ) SELECT count(*) INTO count_temp FROM d2;
  total_deleted := total_deleted + count_temp;

  -- C. USER_SECRETS CLEANUP (Fixar 406-fel i inställningar)
  WITH d3 AS (
    DELETE FROM public.user_secrets WHERE ctid IN (
      SELECT ctid FROM (
        SELECT ctid, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn FROM public.user_secrets
      ) t WHERE t.rn > 1
    ) RETURNING 1
  ) SELECT count(*) INTO count_temp FROM d3;
  total_deleted := total_deleted + count_temp;

  RETURN total_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ÅTERSKAPA NOTIS-LOGIK (Stabilare version)
CREATE OR REPLACE FUNCTION public.handle_friend_notification()
RETURNS TRIGGER AS $$
DECLARE target UUID;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        target := CASE WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 ELSE NEW.user_id_1 END;
        INSERT INTO notifications (receiver_id, actor_id, type, content, link) VALUES (target, NEW.action_user_id, 'friend_request', 'vill bli din vän!', '/krypin?tab=Vänner');
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted') THEN
        target := CASE WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 ELSE NEW.user_id_1 END;
        INSERT INTO notifications (receiver_id, actor_id, type, content, link) VALUES (target, NEW.action_user_id, 'friend_accept', 'har accepterat din förfrågan!', '/krypin?tab=Vänner');
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGER
CREATE TRIGGER on_friendship_change AFTER INSERT OR UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.handle_friend_notification();

-- 5. KÖR STÄDNINGEN DIREKT
SELECT public.fix_duplicate_friendships() as städade_rader;
