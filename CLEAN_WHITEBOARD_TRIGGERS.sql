-- MASTER CLEAN: Whiteboard Share Triggers
-- Den hÃ¤r filen tar bort ALLA fÃ¶r gamla triggers och installerar EN ren version.
-- Detta gÃ¶r att vi slipper "dubbel-rÃ¤kning".

-- 1. Ta bort precis allt som kan rÃ¶ra delningar (gamla namn)
DROP TRIGGER IF EXISTS tr_whiteboard_share_insert ON whiteboard;
DROP TRIGGER IF EXISTS tr_whiteboard_share_delete ON whiteboard;
DROP TRIGGER IF EXISTS tr_whiteboard_share_decrement ON whiteboard;
DROP TRIGGER IF EXISTS trg_share_count_plus ON whiteboard;
DROP TRIGGER IF EXISTS trg_whiteboard_shares ON whiteboard;

-- 2. Skapa den optimala rÃ¤kna-funktionen
CREATE OR REPLACE FUNCTION maintain_whiteboard_shares()
RETURNS TRIGGER AS $$
BEGIN
    -- Vid INSERT (ny delning)
    IF (TG_OP = 'INSERT') THEN
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE whiteboard 
            SET shares_count = COALESCE(shares_count, 0) + 1 
            WHERE id = NEW.parent_id;
        END IF;
        RETURN NEW;
        
    -- Vid DELETE (raderad delning)
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE whiteboard 
            SET shares_count = GREATEST(0, COALESCE(shares_count, 0) - 1) 
            WHERE id = OLD.parent_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Installera den unifierade triggern
CREATE TRIGGER trg_whiteboard_shares_unified
AFTER INSERT OR DELETE ON whiteboard
FOR EACH ROW
EXECUTE FUNCTION maintain_whiteboard_shares();

-- 4. BONUS: RÃ¤tta till befintliga felaktiga siffror genom att rÃ¤kna om dem!
UPDATE whiteboard w
SET shares_count = (
    SELECT COUNT(*) 
    FROM whiteboard s 
    WHERE s.parent_id = w.id
)
WHERE w.parent_id IS NULL;
