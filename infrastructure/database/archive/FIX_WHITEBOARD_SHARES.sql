-- SQL FIX: Automatiska delnings-rÃ¤knare pÃ¥ Whiteboard
-- KÃ¶r dessa i din Supabase SQL Editor fÃ¶r att gÃ¶ra det robust!

-- 1. Funktion fÃ¶r att hantera rÃ¤knare vid NY delning
CREATE OR REPLACE FUNCTION handle_whiteboard_share_increment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE whiteboard 
    SET shares_count = COALESCE(shares_count, 0) + 1 
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Funktion fÃ¶r att hantera rÃ¤knare vid RADERING av delning
CREATE OR REPLACE FUNCTION handle_whiteboard_share_decrement()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.parent_id IS NOT NULL THEN
    UPDATE whiteboard 
    SET shares_count = GREATEST(0, COALESCE(shares_count, 0) - 1) 
    WHERE id = OLD.parent_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Koppla triggers till tabellen
DROP TRIGGER IF EXISTS tr_whiteboard_share_insert ON whiteboard;
CREATE TRIGGER tr_whiteboard_share_insert
AFTER INSERT ON whiteboard
FOR EACH ROW EXECUTE FUNCTION handle_whiteboard_share_increment();

DROP TRIGGER IF EXISTS tr_whiteboard_share_delete ON whiteboard;
CREATE TRIGGER tr_whiteboard_share_delete
AFTER DELETE ON whiteboard
FOR EACH ROW EXECUTE FUNCTION handle_whiteboard_share_decrement();
