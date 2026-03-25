-- =========================================================================
-- COMPLETE FACECHAT FIX (VERSION 2) - KÖR DETTA I SUPABASE SQL EDITOR
-- Detta skript fixar:
-- 1. Automatiska vän-notiser (Trigger)
-- 2. "Social hälsa" (Städar bort dubbla vänrader via ctid)
-- 3. "406 Not Acceptable" (Städar bort dubbla inställningar via ctid)
-- =========================================================================

-- DEL 1: STÄD-FUNKTION (För Admin-panelen)
CREATE OR REPLACE FUNCTION public.fix_duplicate_friendships()
RETURNS integer AS $$
DECLARE
  affected_rows integer := 0;
  deleted_pending integer := 0;
  deleted_secrets integer := 0;
  deleted_dupes integer := 0;
BEGIN
  -- 1. Radera 'pending' rader där det redan finns en 'accepted' rad för samma par
  WITH to_delete_pending AS (
    DELETE FROM public.friendships f1
    WHERE f1.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.friendships f2
      WHERE f2.status = 'accepted'
      AND ((f2.user_id_1 = f1.user_id_1 AND f2.user_id_2 = f1.user_id_2)
           OR (f2.user_id_1 = f1.user_id_2 AND f2.user_id_2 = f1.user_id_1))
    )
    RETURNING 1
  )
  SELECT count(*) INTO deleted_pending FROM to_delete_pending;

  affected_rows := deleted_pending;
  
  -- 2. Radera krockar och dubbletter (Vi använder 'ctid' eftersom 'id' saknas)
  WITH duplicates AS (
    DELETE FROM public.friendships
    WHERE ctid IN (
      SELECT ctid FROM (
        SELECT ctid, row_number() OVER (PARTITION BY least(user_id_1, user_id_2), greatest(user_id_1, user_id_2) ORDER BY created_at DESC) as rn
        FROM public.friendships
      ) t WHERE t.rn > 1
    )
    RETURNING 1
  )
  SELECT count(*) INTO deleted_dupes FROM duplicates;

  affected_rows := affected_rows + deleted_dupes;
  
  -- 3. Radera dubbletter i user_secrets (fixar 406-felet via ctid)
  WITH secrets_dupes AS (
    DELETE FROM public.user_secrets
    WHERE ctid IN (
      SELECT ctid FROM (
        SELECT ctid, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM public.user_secrets
      ) t WHERE t.rn > 1
    )
    RETURNING 1
  )
  SELECT count(*) INTO deleted_secrets FROM secrets_dupes;

  RETURN affected_rows + deleted_secrets;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- DEL 2: AUTOMATISKA NOTISER (Trigger-funktion)
CREATE OR REPLACE FUNCTION public.handle_friend_notification()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Om status är 'pending' och det är en INSERT: Skicka notis till den andre personen
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        target_user_id := CASE 
            WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 
            ELSE NEW.user_id_1 
        END;
        
        INSERT INTO public.notifications (receiver_id, actor_id, type, content, link)
        VALUES (target_user_id, NEW.action_user_id, 'friend_request', 'vill bli din vän!', '/krypin?tab=Vänner');
        
    -- Om status ändras till 'accepted': Skicka notis till den som skickade förfrågan
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted') THEN
        target_user_id := CASE 
            WHEN NEW.user_id_1 = NEW.action_user_id THEN NEW.user_id_2 
            ELSE NEW.user_id_1 
        END;

        INSERT INTO public.notifications (receiver_id, actor_id, type, content, link)
        VALUES (target_user_id, NEW.action_user_id, 'friend_accept', 'har accepterat din vänförfrågan! Ni är nu vänner.', '/krypin?tab=Vänner');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Koppla triggern (Ta bort gamla om de finns först)
DROP TRIGGER IF EXISTS on_friendship_change ON public.friendships;
CREATE TRIGGER on_friendship_change
    AFTER INSERT OR UPDATE ON public.friendships
    FOR EACH ROW EXECUTE FUNCTION public.handle_friend_notification();


-- DEL 3: KÖR STÄDNINGEN DIREKT EN GÅNG
SELECT public.fix_duplicate_friendships();
