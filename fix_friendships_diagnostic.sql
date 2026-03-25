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
  WITH to_delete AS (
    DELETE FROM public.friendships f1
    WHERE f1.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.friendships f2
      WHERE f2.status = 'accepted'
      AND f2.user_id_1 = f1.user_id_1
      AND f2.user_id_2 = f1.user_id_2
    )
    RETURNING 1
  )
  SELECT count(*) INTO deleted_pending FROM to_delete;

  affected_rows := deleted_pending;
  
  -- 2. (Valfritt) Radera rader där användaren inte längre finns (ifall fix_dead_links missat nåt)
  -- Detta sköts oftast av ON DELETE CASCADE på foreign keys, men för säkerhets skull:
  -- DELETE FROM public.friendships WHERE user_id_1 NOT IN (SELECT id FROM public.profiles) OR user_id_2 NOT IN (SELECT id FROM public.profiles);

  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
