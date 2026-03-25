-- =========================================================================
-- DIAGNOSVERKTYG: STÄDA VÄNSKAP (SQL FUNCTION)
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT LÄGGA TILL FUNKTIONEN
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fix_duplicate_friendships()
RETURNS integer AS $$
DECLARE
  affected_rows integer := 0;
  deleted_pending integer := 0;
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
  
  -- 2. Radera krockar där samma person skickat flera förfrågningar (unikt par)
  -- Detta bör inte hända med unika index, men vi städar för säkerhets skull
  WITH duplicates AS (
    DELETE FROM public.friendships f1
    WHERE f1.id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY least(user_id_1, user_id_2), greatest(user_id_1, user_id_2) ORDER BY created_at DESC) as rn
        FROM public.friendships
      ) t WHERE t.rn > 1
    )
    RETURNING 1
  )
  SELECT affected_rows + count(*) INTO affected_rows FROM duplicates;
  
  -- 3. Radera dubbletter i user_secrets (orsakar 406 Not Acceptable vid .single())
  WITH secrets_dupes AS (
    DELETE FROM public.user_secrets s1
    WHERE s1.id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM public.user_secrets
      ) t WHERE t.rn > 1
    )
    RETURNING 1
  )
  SELECT affected_rows + count(*) INTO affected_rows FROM secrets_dupes;

  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
